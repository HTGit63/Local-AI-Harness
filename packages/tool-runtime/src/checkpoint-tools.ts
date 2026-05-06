import * as fs from 'fs/promises';
import * as path from 'path';

const CHECKPOINT_DIR = '.gamma-harness/checkpoints';
const IGNORED_DIRS = new Set(['.git', '.gamma-harness', 'node_modules', 'dist', 'build', '.next', 'base_repos', 'third_party']);
const MAX_SNAPSHOT_FILES = 5000;
const MAX_SNAPSHOT_BYTES = 30 * 1024 * 1024;

export interface WorkspaceCheckpoint {
  id: string;
  label?: string;
  createdAt: number;
  fileCount: number;
  totalBytes: number;
  path: string;
}

interface ManifestFile {
  path: string;
  size: number;
}

interface CheckpointManifest extends WorkspaceCheckpoint {
  files: ManifestFile[];
  missingFiles?: string[];
}

async function walkFiles(cwd: string, dir = cwd): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        files.push(...await walkFiles(cwd, path.join(dir, entry.name)));
      }
      continue;
    }
    files.push(path.relative(cwd, path.join(dir, entry.name)).replace(/\\/g, '/'));
  }
  return files.sort();
}

function checkpointId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `cp-${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function checkpointPath(cwd: string, id: string): string {
  return path.join(cwd, CHECKPOINT_DIR, id);
}

function normalizeCheckpointTarget(filePath: string): string {
  const normalized = path.normalize(filePath).replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`Invalid checkpoint target: ${filePath}`);
  }
  return normalized;
}

async function expandCheckpointTargets(cwd: string, targetFiles?: string[]): Promise<{ files: string[]; missingFiles: string[] }> {
  if (!targetFiles?.length) {
    return { files: await walkFiles(cwd), missingFiles: [] };
  }

  const files = new Set<string>();
  const missingFiles = new Set<string>();
  for (const target of targetFiles) {
    const normalized = normalizeCheckpointTarget(target);
    const absolute = path.join(cwd, normalized);
    try {
      const stat = await fs.stat(absolute);
      if (stat.isDirectory()) {
        for (const nested of await walkFiles(cwd, absolute)) {
          files.add(nested);
        }
      } else {
        files.add(normalized);
      }
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        missingFiles.add(normalized);
        continue;
      }
      throw error;
    }
  }
  return { files: Array.from(files).sort(), missingFiles: Array.from(missingFiles).sort() };
}

async function copyIntoCheckpoint(cwd: string, checkpointRoot: string, filePath: string): Promise<number> {
  const source = path.join(cwd, filePath);
  const target = path.join(checkpointRoot, 'files', filePath);
  const stat = await fs.stat(source);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return stat.size;
}

export async function createWorkspaceCheckpoint(cwd: string, label?: string, targetFiles?: string[]): Promise<WorkspaceCheckpoint> {
  const id = checkpointId();
  const root = checkpointPath(cwd, id);
  const targetSnapshot = await expandCheckpointTargets(cwd, targetFiles);
  let totalBytes = 0;
  const files: ManifestFile[] = [];

  await fs.mkdir(root, { recursive: true });
  for (const filePath of targetSnapshot.files) {
    if (files.length >= MAX_SNAPSHOT_FILES) {
      throw new Error(`Checkpoint exceeds max file count (${MAX_SNAPSHOT_FILES}).`);
    }
    const size = await copyIntoCheckpoint(cwd, root, filePath);
    totalBytes += size;
    if (totalBytes > MAX_SNAPSHOT_BYTES) {
      throw new Error(`Checkpoint exceeds max snapshot size (${MAX_SNAPSHOT_BYTES} bytes).`);
    }
    files.push({ path: filePath, size });
  }

  const manifest: CheckpointManifest = {
    id,
    label,
    createdAt: Date.now(),
    fileCount: files.length,
    totalBytes,
    path: path.relative(cwd, root).replace(/\\/g, '/'),
    files,
    missingFiles: targetSnapshot.missingFiles,
  };
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return {
    id,
    label,
    createdAt: manifest.createdAt,
    fileCount: manifest.fileCount,
    totalBytes: manifest.totalBytes,
    path: manifest.path,
  };
}

async function readCheckpointManifest(cwd: string, id: string): Promise<CheckpointManifest> {
  const root = checkpointPath(cwd, id);
  const manifestPath = path.join(root, 'manifest.json');
  return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as CheckpointManifest;
}

export async function getWorkspaceCheckpointAffectedFiles(cwd: string, id: string): Promise<string[]> {
  const manifest = await readCheckpointManifest(cwd, id);
  return Array.from(new Set([
    ...manifest.files.map((file) => file.path),
    ...(manifest.missingFiles ?? []),
  ])).sort();
}

export async function rollbackWorkspaceCheckpoint(cwd: string, id: string): Promise<{
  checkpoint: WorkspaceCheckpoint;
  restoredFiles: number;
  deletedFiles: number;
  restoredPaths: string[];
  deletedPaths: string[];
  affectedFiles: string[];
}> {
  const root = checkpointPath(cwd, id);
  const manifest = await readCheckpointManifest(cwd, id);
  const deletedPaths: string[] = [];
  const restoredPaths: string[] = [];

  for (const filePath of manifest.missingFiles ?? []) {
    const target = path.join(cwd, filePath);
    try {
      await fs.rm(target, { force: true, recursive: true });
      deletedPaths.push(filePath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  for (const file of manifest.files) {
    const source = path.join(root, 'files', file.path);
    const target = path.join(cwd, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    restoredPaths.push(file.path);
  }

  return {
    checkpoint: {
      id: manifest.id,
      label: manifest.label,
      createdAt: manifest.createdAt,
      fileCount: manifest.fileCount,
      totalBytes: manifest.totalBytes,
      path: manifest.path,
    },
    restoredFiles: restoredPaths.length,
    deletedFiles: deletedPaths.length,
    restoredPaths,
    deletedPaths,
    affectedFiles: Array.from(new Set([...restoredPaths, ...deletedPaths])).sort(),
  };
}
