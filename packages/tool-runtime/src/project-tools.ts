import * as fs from 'fs/promises';
import * as path from 'path';
import ts from 'typescript';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORED_DIRS = new Set(['.git', '.gamma-harness', 'node_modules', 'dist', 'build', '.next', 'base_repos', 'third_party']);

export interface ImportEntry {
  source: string;
  resolvedPath?: string;
  defaultImport?: string;
  namespaceImport?: string;
  namedImports: string[];
  typeOnly: boolean;
}

export interface ProjectCommands {
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
  build?: string;
  test?: string;
  lint?: string;
  dev?: string;
  packageJsonPath?: string;
  detectedFiles: string[];
}

export interface TestSelection {
  changedFiles: string[];
  tests: string[];
  commands: string[];
  reason: string;
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true).catch(() => false);
}

function scriptKindForPath(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath)) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.jsx':
      return ts.ScriptKind.JSX;
    case '.js':
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

async function walkSourceFiles(cwd: string, dir = cwd): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...await walkSourceFiles(cwd, path.join(dir, entry.name)));
      }
      continue;
    }
    if (SOURCE_EXTENSIONS.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      files.push(path.relative(cwd, path.join(dir, entry.name)).replace(/\\/g, '/'));
    }
  }
  return files.sort();
}

async function parseSource(cwd: string, filePath: string): Promise<ts.SourceFile> {
  const absolutePath = path.join(cwd, filePath);
  const text = await fs.readFile(absolutePath, 'utf8');
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, scriptKindForPath(filePath));
}

async function resolveImport(cwd: string, fromFile: string, source: string): Promise<string | undefined> {
  if (!source.startsWith('.')) {
    return undefined;
  }
  const fromDir = path.dirname(path.join(cwd, fromFile));
  const base = path.resolve(fromDir, source);
  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...SOURCE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return path.relative(cwd, candidate).replace(/\\/g, '/');
    }
  }
  return undefined;
}

export async function whatDoesThisImport(cwd: string, filePath: string): Promise<ImportEntry[]> {
  const source = await parseSource(cwd, filePath);
  const imports: ImportEntry[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }
    const clause = statement.importClause;
    const namedImports: string[] = [];
    let namespaceImport: string | undefined;
    if (clause?.namedBindings) {
      if (ts.isNamespaceImport(clause.namedBindings)) {
        namespaceImport = clause.namedBindings.name.text;
      } else {
        namedImports.push(...clause.namedBindings.elements.map((element) => element.name.text));
      }
    }
    imports.push({
      source: statement.moduleSpecifier.text,
      resolvedPath: await resolveImport(cwd, filePath, statement.moduleSpecifier.text),
      defaultImport: clause?.name?.text,
      namespaceImport,
      namedImports,
      typeOnly: clause?.isTypeOnly === true,
    });
  }
  return imports;
}

function equivalentImportTarget(candidate: string | undefined, requested: string): boolean {
  if (!candidate) {
    return false;
  }
  const strip = (value: string) => value.replace(/\.(ts|tsx|js|jsx)$/, '').replace(/\/index$/, '');
  return strip(candidate) === strip(requested);
}

export async function whoImports(cwd: string, filePath: string): Promise<string[]> {
  const sourceFiles = await walkSourceFiles(cwd);
  const importers: string[] = [];
  for (const candidate of sourceFiles) {
    if (candidate === filePath) {
      continue;
    }
    const imports = await whatDoesThisImport(cwd, candidate);
    if (imports.some((entry) => equivalentImportTarget(entry.resolvedPath, filePath))) {
      importers.push(candidate);
    }
  }
  return importers;
}

export async function affectedFiles(cwd: string, filePath: string, maxDepth = 4): Promise<string[]> {
  const affected = new Set<string>();
  const queue: Array<{ filePath: string; depth: number }> = [{ filePath, depth: 0 }];
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || next.depth >= maxDepth) {
      continue;
    }
    const importers = await whoImports(cwd, next.filePath);
    for (const importer of importers) {
      if (!affected.has(importer)) {
        affected.add(importer);
        queue.push({ filePath: importer, depth: next.depth + 1 });
      }
    }
  }
  return Array.from(affected).sort();
}

function normalizeFiles(changedFiles: string | string[]): string[] {
  if (Array.isArray(changedFiles)) {
    return changedFiles.map((file) => file.trim()).filter(Boolean);
  }
  return changedFiles
    .split(/\r?\n|,/)
    .map((file) => file.trim())
    .filter(Boolean);
}

async function filterExisting(cwd: string, files: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const file of Array.from(new Set(files))) {
    if (await exists(path.join(cwd, file))) {
      existing.push(file);
    }
  }
  return existing;
}

export async function selectTestsForChangedFiles(cwd: string, changedFilesInput: string | string[]): Promise<TestSelection> {
  const changedFiles = normalizeFiles(changedFilesInput);
  const testCandidates = new Set<string>();
  const commandCandidates = new Set<string>();

  for (const file of changedFiles) {
    if (file.startsWith('packages/tool-runtime/')) {
      testCandidates.add('tests/integration/workflow.test.ts');
      testCandidates.add('tests/unit/core.test.ts');
    }
    if (file.startsWith('packages/core/') || file.startsWith('packages/planner/') || file.startsWith('packages/task-orchestrator/')) {
      testCandidates.add('tests/unit/core.test.ts');
      testCandidates.add('tests/e2e/api.test.ts');
    }
    if (file.startsWith('packages/repo-indexer/')) {
      testCandidates.add('tests/unit/core.test.ts');
      testCandidates.add('tests/integration/workflow.test.ts');
    }
    if (file.startsWith('apps/api/')) {
      testCandidates.add('tests/e2e/api.test.ts');
    }
    if (file.startsWith('apps/cli/')) {
      testCandidates.add('tests/e2e/cli.test.ts');
    }
    if (file.startsWith('apps/web/')) {
      commandCandidates.add('npm run build --workspace web');
      testCandidates.add('tests/e2e/api.test.ts');
    }
    if (file === 'package.json' || file.endsWith('package.json') || file.endsWith('tsconfig.json')) {
      commandCandidates.add('npm run build');
    }
  }

  const tests = await filterExisting(cwd, Array.from(testCandidates));
  if (tests.length === 0 && changedFiles.length > 0) {
    tests.push(...await filterExisting(cwd, ['tests/unit/core.test.ts', 'tests/integration/workflow.test.ts']));
  }
  const commands = Array.from(commandCandidates);
  if (tests.length > 0) {
    commands.push(...tests.map((testFile) => `node --import tsx ${testFile}`));
  }

  return {
    changedFiles,
    tests,
    commands,
    reason: tests.length > 0
      ? `Selected tests from changed path ownership for ${changedFiles.length} file(s).`
      : 'No matching targeted tests found.',
  };
}

export async function detectProjectCommands(cwd: string): Promise<ProjectCommands> {
  const detectedFiles: string[] = [];
  for (const file of ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb', 'vite.config.ts', 'tsconfig.json']) {
    if (await exists(path.join(cwd, file))) {
      detectedFiles.push(file);
    }
  }

  let packageManager: ProjectCommands['packageManager'] = 'unknown';
  if (detectedFiles.includes('pnpm-lock.yaml')) packageManager = 'pnpm';
  else if (detectedFiles.includes('package-lock.json')) packageManager = 'npm';
  else if (detectedFiles.includes('yarn.lock')) packageManager = 'yarn';
  else if (detectedFiles.includes('bun.lockb')) packageManager = 'bun';
  else if (detectedFiles.includes('package.json')) packageManager = 'npm';

  const packageJsonPath = path.join(cwd, 'package.json');
  let scripts: Record<string, unknown> = {};
  try {
    const manifest = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, unknown> };
    scripts = manifest.scripts ?? {};
  } catch {
    scripts = {};
  }

  const run = packageManager === 'yarn'
    ? 'yarn'
    : packageManager === 'pnpm'
      ? 'pnpm'
      : packageManager === 'bun'
        ? 'bun'
        : 'npm run';

  const scriptCommand = (name: string): string | undefined => {
    if (typeof scripts[name] !== 'string') {
      return undefined;
    }
    if (packageManager === 'npm') {
      return name === 'test' ? 'npm test' : `npm run ${name}`;
    }
    return `${run} ${name}`;
  };

  return {
    packageManager,
    build: scriptCommand('build'),
    test: scriptCommand('test'),
    lint: scriptCommand('lint'),
    dev: scriptCommand('dev'),
    packageJsonPath: detectedFiles.includes('package.json') ? 'package.json' : undefined,
    detectedFiles,
  };
}
