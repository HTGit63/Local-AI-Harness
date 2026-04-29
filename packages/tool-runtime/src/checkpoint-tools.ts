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

async function copyIntoCheckpoint(cwd: string, checkpointRoot: string, filePath: string): Promise<number> {
  const source = path.join(cwd, filePath);
  const target = path.join(checkpointRoot, 'files', filePath);
  const stat = await fs.stat(source);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return stat.size;
}

export async function createWorkspaceCheckpoint(cwd: string, label?: string): Promise<WorkspaceCheckpoint> {
  const id = checkpointId();
  const root = checkpointPath(cwd, id);
  const allFiles = await walkFiles(cwd);
  let totalBytes = 0;
  const files: ManifestFile[] = [];

  await fs.mkdir(root, { recursive: true });
  for (const filePath of allFiles) {
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

export async function rollbackWorkspaceCheckpoint(cwd: string, id: string): Promise<{ checkpoint: WorkspaceCheckpoint; restoredFiles: number; deletedFiles: number }> {
  const root = checkpointPath(cwd, id);
  const manifestPath = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as CheckpointManifest;
  const checkpointFiles = new Set(manifest.files.map((file) => file.path));
  const currentFiles = await walkFiles(cwd);
  let deletedFiles = 0;
  let restoredFiles = 0;

  for (const filePath of currentFiles) {
    if (!checkpointFiles.has(filePath)) {
      await fs.rm(path.join(cwd, filePath), { force: true });
      deletedFiles += 1;
    }
  }

  for (const file of manifest.files) {
    const source = path.join(root, 'files', file.path);
    const target = path.join(cwd, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
    restoredFiles += 1;
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
    restoredFiles,
    deletedFiles,
  };
}
