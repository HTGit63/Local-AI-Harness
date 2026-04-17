import * as fs from 'fs/promises';
import * as path from 'path';

const IGNORED_DIR_NAMES = new Set([
  '.git',
  '.gamma-harness',
  '.next',
  '.playwright-cli',
  'base_repos',
  'build',
  'dist',
  'node_modules',
  'third_party',
]);
const MAX_MANIFEST_PREVIEW = 8;
const MAX_ENTRY_POINT_PREVIEW = 8;
const MAX_README_PREVIEW = 4;
const DEFAULT_CACHE_TTL_MS = 30_000;

export interface ProjectContext {
  cwd: string;
  files: string[];
  manifests: Record<string, string>;
  readmes: Record<string, string>;
  entryPoints: string[];
  summary: string;
}

export interface WorkspaceModuleInfo {
  path: string;
  name: string;
  description?: string;
}

export interface WorkspaceReferenceInfo {
  area: string;
  entries: string[];
}

export interface WorkspaceInventory {
  rootPackageName: string | null;
  workspaceGlobs: string[];
  apps: WorkspaceModuleInfo[];
  packages: WorkspaceModuleInfo[];
  references: WorkspaceReferenceInfo[];
  topLevelAreas: string[];
}

interface CacheEntry<T> {
  signature: string;
  expiresAt: number;
  value: T;
}

function resolveCacheTtlMs(): number {
  const rawValue = Number(
    process.env.HARNESS_REPO_CONTEXT_CACHE_TTL_MS ??
    process.env.HARNESS_REPO_CONTEXT_TTL_MS ??
    DEFAULT_CACHE_TTL_MS,
  );

  if (!Number.isFinite(rawValue)) {
    return DEFAULT_CACHE_TTL_MS;
  }

  return Math.max(1_000, Math.floor(rawValue));
}

export class RepoIndexer {
  private cwd: string;
  private readonly cacheTtlMs: number;
  private contextCache: CacheEntry<ProjectContext> | null = null;
  private inventoryCache: CacheEntry<WorkspaceInventory> | null = null;

  constructor(cwd: string) {
    this.cwd = path.resolve(cwd);
    this.cacheTtlMs = resolveCacheTtlMs();
  }

  updateWorkspaceRoot(cwd: string) {
    this.cwd = path.resolve(cwd);
    this.clearCaches();
  }

  clearCaches() {
    this.contextCache = null;
    this.inventoryCache = null;
  }

  private buildCacheEntry<T>(signature: string, value: T): CacheEntry<T> {
    return {
      signature,
      value,
      expiresAt: Date.now() + this.cacheTtlMs,
    };
  }

  private isCacheValid<T>(cache: CacheEntry<T> | null, signature: string): cache is CacheEntry<T> {
    return Boolean(cache && cache.signature === signature && cache.expiresAt > Date.now());
  }

  private async getPathFingerprint(relativePath: string): Promise<string> {
    try {
      const stat = await fs.stat(path.join(this.cwd, relativePath));
      return `${relativePath}:${Math.trunc(stat.mtimeMs)}:${stat.size}`;
    } catch {
      return `${relativePath}:missing`;
    }
  }

  private async getWorkspaceSignature(): Promise<string> {
    const sentinelPaths = [
      '.git/index',
      'package.json',
      'pnpm-workspace.yaml',
      'package-lock.json',
      'yarn.lock',
      'bun.lockb',
    ];

    let topLevelEntries: string[] = [];
    try {
      const entries = await fs.readdir(this.cwd, { withFileTypes: true });
      topLevelEntries = entries
        .filter((entry) => !IGNORED_DIR_NAMES.has(entry.name))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    } catch {
      topLevelEntries = [];
    }

    const fingerprintTargets = Array.from(new Set([...sentinelPaths, ...topLevelEntries]));
    const fingerprints = await Promise.all(
      fingerprintTargets.map((target) => this.getPathFingerprint(target)),
    );

    return fingerprints.join('|');
  }

  async walk(dir: string, depth = 0, maxDepth = 3): Promise<string[]> {
    if (depth > maxDepth) return [];
    
    let results: string[] = [];
    try {
      const list = await fs.readdir(dir, { withFileTypes: true });
      for (const item of list) {
        if (item.isDirectory() && IGNORED_DIR_NAMES.has(item.name)) {
          continue;
        }
        
        const fullPath = path.join(dir, item.name);
        const relPath = path.relative(this.cwd, fullPath);

        if (item.isDirectory()) {
          results = results.concat(await this.walk(fullPath, depth + 1, maxDepth));
        } else {
          results.push(relPath);
        }
      }
    } catch {}
    return results;
  }

  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  private async collectWorkspaceModules(area: string): Promise<WorkspaceModuleInfo[]> {
    const areaPath = path.join(this.cwd, area);

    try {
      const entries = await fs.readdir(areaPath, { withFileTypes: true });
      const validEntries = entries.filter((entry) => entry.isDirectory() && !IGNORED_DIR_NAMES.has(entry.name));
      const modules: Array<WorkspaceModuleInfo | null> = [];
      const batchSize = 10;
      for (let i = 0; i < validEntries.length; i += batchSize) {
        const batch = validEntries.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (entry) => {
            const manifestPath = path.join(areaPath, entry.name, 'package.json');
            const manifest = await this.readJsonFile<{ name?: unknown; description?: unknown }>(manifestPath);
            if (!manifest || typeof manifest.name !== 'string' || !manifest.name.trim()) {
              return null;
            }

            const moduleInfo: WorkspaceModuleInfo = {
              path: `${area}/${entry.name}`,
              name: manifest.name.trim(),
              description: typeof manifest.description === 'string' && manifest.description.trim()
                ? manifest.description.trim()
                : undefined,
            };
            return moduleInfo;
          }),
        );
        modules.push(...results);
      }

      return modules
        .filter((entry): entry is WorkspaceModuleInfo => entry !== null)
        .sort((left, right) => left.path.localeCompare(right.path));
    } catch {
      return [];
    }
  }

  private async collectReferenceEntries(area: string): Promise<WorkspaceReferenceInfo | null> {
    const areaPath = path.join(this.cwd, area);

    try {
      const entries = await fs.readdir(areaPath, { withFileTypes: true });
      const names = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));

      return names.length > 0 ? { area, entries: names } : null;
    } catch {
      return null;
    }
  }

  async buildWorkspaceInventory(forceRefresh = false): Promise<WorkspaceInventory> {
    if (!forceRefresh && this.inventoryCache && this.inventoryCache.expiresAt > Date.now()) {
      return this.inventoryCache.value;
    }
    const signature = await this.getWorkspaceSignature();
    if (!forceRefresh && this.isCacheValid(this.inventoryCache, signature)) {
      return this.inventoryCache.value;
    }

    const rootManifest = await this.readJsonFile<{ name?: unknown; workspaces?: unknown }>(path.join(this.cwd, 'package.json'));
    const rootPackageName = typeof rootManifest?.name === 'string' && rootManifest.name.trim()
      ? rootManifest.name.trim()
      : null;
    const workspaceGlobs = Array.isArray(rootManifest?.workspaces)
      ? rootManifest.workspaces.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    const [apps, packages, baseRepos, thirdParty, topLevelEntries] = await Promise.all([
      this.collectWorkspaceModules('apps'),
      this.collectWorkspaceModules('packages'),
      this.collectReferenceEntries('base_repos'),
      this.collectReferenceEntries('third_party'),
      fs.readdir(this.cwd, { withFileTypes: true }).catch(() => [] as Array<{ isDirectory(): boolean; name: string }>),
    ]);

    const references = [baseRepos, thirdParty].filter((entry): entry is WorkspaceReferenceInfo => entry !== null);
    const topLevelAreas = topLevelEntries
      .filter((entry) => entry.isDirectory() && !IGNORED_DIR_NAMES.has(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    const inventory = {
      rootPackageName,
      workspaceGlobs,
      apps,
      packages,
      references,
      topLevelAreas,
    };
    this.inventoryCache = this.buildCacheEntry(signature, inventory);
    return inventory;
  }

  async buildContext(forceRefresh = false): Promise<{ context: ProjectContext; cached: boolean }> {
    if (!forceRefresh && this.contextCache && this.contextCache.expiresAt > Date.now()) {
      return { context: this.contextCache.value, cached: true };
    }

    const signature = await this.getWorkspaceSignature();
    if (!forceRefresh && this.isCacheValid(this.contextCache, signature)) {
      return { context: this.contextCache.value, cached: true };
    }

    const allFiles = await this.walk(this.cwd);

    const manifests: Record<string, string> = {};
    const readmes: Record<string, string> = {};
    const entryPoints: string[] = [];

    const entryRegex = /src\/(index|main|app)\.(ts|js|jsx|tsx)$/;

    for (const file of allFiles) {
      if ((file.endsWith('package.json') || file.endsWith('Cargo.toml') || file.endsWith('requirements.txt')) && Object.keys(manifests).length < MAX_MANIFEST_PREVIEW) {
        try { manifests[file] = await fs.readFile(path.join(this.cwd, file), 'utf8'); } catch {}
      }
      else if (file.toLowerCase().endsWith('readme.md') && Object.keys(readmes).length < MAX_README_PREVIEW) {
        try { readmes[file] = (await fs.readFile(path.join(this.cwd, file), 'utf8')).slice(0, 1000); } catch {}
      }
      else if ((entryRegex.test(file) || file === 'index.js' || file === 'main.py' || file.endsWith('App.tsx')) && entryPoints.length < MAX_ENTRY_POINT_PREVIEW) {
        entryPoints.push(file);
      }
    }

    const topLevelAreas = Array.from(
      new Set(
        allFiles
          .map((file) => file.split('/')[0])
          .filter((segment) => segment && segment !== '.'),
      ),
    ).sort();
    const topLevelPreview = topLevelAreas.slice(0, 6);
    const summary = [
      `Project roots at ${this.cwd}.`,
      `Recognized ${allFiles.length} workspace files across ${topLevelAreas.length} top-level areas${topLevelPreview.length ? ` (${topLevelPreview.join(', ')})` : ''}.`,
      `Key entry points: ${entryPoints.length > 0 ? entryPoints.join(', ') : 'unknown'}.`,
    ].join(' ');

    const context = {
      cwd: this.cwd,
      files: allFiles,
      manifests,
      readmes,
      entryPoints,
      summary
    };
    this.contextCache = this.buildCacheEntry(signature, context);
    return { context, cached: false };
  }

  generatePromptInjection(ctx: ProjectContext): string {
    const manifestPaths = Object.keys(ctx.manifests);
    const readmePaths = Object.keys(ctx.readmes);
    return [
      `[Repo Context Summary]`,
      ctx.summary,
      `Primary manifests: ${manifestPaths.length > 0 ? manifestPaths.join(', ') : 'none detected'}`,
      `Project READMEs: ${readmePaths.length > 0 ? readmePaths.join(', ') : 'none detected'}`,
      `Entry paths: ${ctx.entryPoints.length > 0 ? ctx.entryPoints.join(', ') : 'unknown'}`,
      `Ignored from auto-context: base_repos, third_party, .gamma-harness, .playwright-cli, and build outputs.`,
      `Note: Do not read every file blindly. Start at entry points or manifests.`
    ].join('\n');
  }
}
