import assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

const ROOT = path.resolve(__dirname, '../..');
const API_PATH = path.join(ROOT, 'apps/api/dist/server.js');
const API_PORT = '3051';
const API_BASE = `http://127.0.0.1:${API_PORT}`;

interface ToolResult {
  success: boolean;
  output: string;
  preview?: string;
  error?: string;
}

interface ApprovalItem {
  id: string;
  target: string;
  diffPreview?: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  assert.ok(response.ok, `Request failed for ${url}: ${response.status} ${body}`);
  return JSON.parse(body) as T;
}

async function waitFor<T>(factory: () => Promise<T | null>, timeoutMs = 10000): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await factory();
    if (value !== null) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error('Timed out waiting for condition.');
}

async function startApiServer(workspaceRoot: string): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn('node', [API_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      API_PORT,
      HARNESS_WORKSPACE_ROOT: workspaceRoot,
    },
    stdio: 'pipe',
  });

  child.stderr.on('data', () => {
    // Keep stderr drained so the process cannot block.
  });

  await waitFor(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/config`);
      return response.ok ? true : null;
    } catch {
      return null;
    }
  });

  return child;
}

async function stopApiServer(child: ChildProcessWithoutNullStreams) {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
}

async function testApiWorkflow() {
  const workspaceParent = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-api-e2e-'));
  const workspaceRoot = path.join(workspaceParent, 'Gamma 4 Harness');
  const pickedWorkspace = path.join(workspaceParent, 'art-gallery');
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(path.join(pickedWorkspace, 'src'), { recursive: true });
  await fs.writeFile(path.join(pickedWorkspace, 'package.json'), JSON.stringify({ name: 'art-gallery' }), 'utf8');
  await fs.writeFile(path.join(pickedWorkspace, 'src', 'index.ts'), 'export const gallery = true;\n', 'utf8');
  const server = await startApiServer(workspaceRoot);

  try {
    const initialConfig = await fetchJson<{
      workspaceRoot: string;
      profile: string;
      mode: string;
      model: string;
      baseUrl: string;
    }>(`${API_BASE}/api/config`);
    assert.strictEqual(initialConfig.workspaceRoot, workspaceRoot);

    const updatedConfig = await fetchJson<{
      profile: string;
      mode: string;
      model: string;
      baseUrl: string;
    }>(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: 'fast',
        mode: 'workspace-write',
        model: 'gemma4:e4b',
        baseUrl: 'http://127.0.0.1:11434/v1',
      }),
    });
    assert.strictEqual(updatedConfig.profile, 'fast');
    assert.strictEqual(updatedConfig.mode, 'workspace-write');

    const session = await fetchJson<{ id: string; skillsActive: string[] }>(`${API_BASE}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: ['engineering-code-reviewer'] }),
    });
    assert.ok(session.id);
    assert.deepStrictEqual(session.skillsActive, ['engineering-code-reviewer']);

    const pendingWrite = fetchJson<ToolResult>(`${API_BASE}/api/workspace/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'notes.txt', content: 'approved content\n' }),
    });

    const approval = await waitFor(async () => {
      const approvals = await fetchJson<ApprovalItem[]>(`${API_BASE}/api/approvals`);
      return approvals[0] || null;
    });
    assert.strictEqual(approval.target, 'notes.txt');
    assert.ok((approval.diffPreview || '').includes('notes.txt'));

    const resolution = await fetchJson<{ resolved: boolean }>(`${API_BASE}/api/approvals/${approval.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    assert.strictEqual(resolution.resolved, true);

    const writeResult = await pendingWrite;
    assert.strictEqual(writeResult.success, true);
    assert.strictEqual(await fs.readFile(path.join(workspaceRoot, 'notes.txt'), 'utf8'), 'approved content\n');

    const deniedWrite = await fetchJson<ToolResult>(`${API_BASE}/api/workspace/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '../outside.txt', content: 'blocked' }),
    });
    assert.strictEqual(deniedWrite.success, false);
    assert.ok(deniedWrite.output.includes('Denied'));

    const sessions = await fetchJson<Array<{ id: string }>>(`${API_BASE}/api/sessions`);
    assert.ok(sessions.some((entry) => entry.id === session.id));

    const resumed = await fetchJson<{ id: string }>(`${API_BASE}/api/session/${session.id}/resume`, {
      method: 'POST',
    });
    assert.strictEqual(resumed.id, session.id);

    const resolvedWorkspace = await fetchJson<{
      resolved: boolean;
      workspaceRoot: string;
      matchedFiles: number;
    }>(`${API_BASE}/api/workspace/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderLabel: 'art-gallery',
        relativeFiles: ['package.json', 'src/index.ts'],
      }),
    });
    assert.strictEqual(resolvedWorkspace.resolved, true);
    assert.strictEqual(resolvedWorkspace.workspaceRoot, pickedWorkspace);
    assert.ok(resolvedWorkspace.matchedFiles >= 1);

    const configAfterResolve = await fetchJson<{ workspaceRoot: string }>(`${API_BASE}/api/config`);
    assert.strictEqual(configAfterResolve.workspaceRoot, pickedWorkspace);
  } finally {
    await stopApiServer(server);
    await fs.rm(workspaceParent, { recursive: true, force: true });
  }
}

testApiWorkflow()
  .then(() => {
    console.log('api e2e tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
