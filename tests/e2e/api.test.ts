import assert from 'assert';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

const ROOT = path.resolve(__dirname, '../..');
const API_PATH = path.join(ROOT, 'apps/api/dist/server.js');
const API_PORT = String(3051 + Math.floor(Math.random() * 2000));
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

interface SessionState {
  id: string;
  turnHistory?: Array<{
    executionMode: 'direct' | 'agentic';
    runSummary?: {
      summary?: string;
      workspaceSource?: 'backend' | 'browser_snapshot';
      workspaceBound?: boolean;
    };
  }>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  assert.ok(response.ok, `Request failed for ${url}: ${response.status} ${body}`);
  return JSON.parse(body) as T;
}

async function fetchNdjson(url: string, init?: RequestInit): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(url, init);
  const body = await response.text();
  assert.ok(response.ok, `Request failed for ${url}: ${response.status} ${body}`);
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
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

async function startMockModelServer(): Promise<{ server: http.Server; baseUrl: string; getChatRequests: () => any[] }> {
  const chatRequests: any[] = [];
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody.trim() ? JSON.parse(rawBody) : {};

      if (requestUrl.pathname === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [{ name: 'gemma4:e4b' }] }));
        return;
      }

      if (requestUrl.pathname === '/api/ps') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [{ name: 'gemma4:e4b', model: 'gemma4:e4b', context_length: 8192 }] }));
        return;
      }

      if (requestUrl.pathname === '/api/show') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ capabilities: ['completion', 'thinking'] }));
        return;
      }

      if (requestUrl.pathname === '/api/chat') {
        chatRequests.push(body);
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
          res.write(`${JSON.stringify({
            model: 'mock-native',
            message: { role: 'assistant', content: 'Direct stream works.' },
            done: false,
          })}\n`);
          res.write(`${JSON.stringify({
            model: 'mock-native',
            message: {},
            done: true,
            done_reason: 'stop',
            prompt_eval_count: 10,
            eval_count: 4,
          })}\n`);
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: 'mock-native',
          message: { role: 'assistant', content: 'Direct stream works.' },
          done: true,
          done_reason: 'stop',
          prompt_eval_count: 10,
          eval_count: 4,
        }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    getChatRequests: () => [...chatRequests],
  };
}

async function stopMockModelServer(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function startApiServer(workspaceRoot: string, modelBaseUrl?: string): Promise<ChildProcessWithoutNullStreams> {
  const child = spawn('node', [API_PATH], {
    cwd: ROOT,
    env: {
      ...process.env,
      API_PORT,
      HARNESS_WORKSPACE_ROOT: workspaceRoot,
      ...(modelBaseUrl ? { OPENAI_BASE_URL: modelBaseUrl } : {}),
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
  const mockModel = await startMockModelServer();
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(path.join(pickedWorkspace, 'src'), { recursive: true });
  await fs.writeFile(path.join(pickedWorkspace, 'package.json'), JSON.stringify({ name: 'art-gallery' }), 'utf8');
  await fs.writeFile(path.join(pickedWorkspace, 'src', 'index.ts'), 'export const gallery = true;\n', 'utf8');
  const server = await startApiServer(workspaceRoot, mockModel.baseUrl);

  try {
    const initialConfig = await fetchJson<{
      workspaceRoot: string;
      profile: string;
      mode: string;
      model: string;
      baseUrl: string;
    }>(`${API_BASE}/api/config`);
    assert.strictEqual(initialConfig.workspaceRoot, workspaceRoot);
    assert.strictEqual(initialConfig.baseUrl, mockModel.baseUrl);

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
        baseUrl: mockModel.baseUrl,
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

    const chatRequestsBeforeAgentic = mockModel.getChatRequests().length;
    const agenticEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Reply with exactly: API agentic' }],
      }),
    });
    const agenticDone = agenticEvents.find((event) => event.type === 'done');
    assert.ok(String(agenticDone?.response || '').includes('Direct stream works.'));
    assert.ok(String(agenticDone?.response || '').includes('What I did:'));
    const agenticRunSummary = agenticEvents.find((event) => event.type === 'run_summary');
    assert.ok(agenticRunSummary);
    assert.strictEqual(agenticRunSummary?.summary?.workspaceSource, 'backend');
    assert.strictEqual(agenticRunSummary?.summary?.workspaceBound, true);
    assert.ok(mockModel.getChatRequests().length > chatRequestsBeforeAgentic);

    const sessionAfterAgentic = await fetchJson<SessionState>(`${API_BASE}/api/session`);
    const latestAgenticTurn = [...(sessionAfterAgentic.turnHistory || [])]
      .reverse()
      .find((turn) => turn.executionMode === 'agentic');
    assert.ok(latestAgenticTurn?.runSummary?.summary);
    assert.strictEqual(latestAgenticTurn?.runSummary?.workspaceSource, 'backend');

    const chatRequestsBeforeSnapshot = mockModel.getChatRequests().length;
    const snapshotEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '[Browser Folder Context]\nFolder label: art-gallery\nTree:\n- src/\n  - index.ts' },
          { role: 'user', content: 'Create notes.txt and run npm test' },
        ],
      }),
    });
    const snapshotDone = snapshotEvents.find((event) => event.type === 'done');
    assert.ok(String(snapshotDone?.response || '').includes('Workspace is browser snapshot only.'));
    const snapshotRunSummary = snapshotEvents.find((event) => event.type === 'run_summary');
    assert.ok(snapshotRunSummary);
    assert.strictEqual(snapshotRunSummary?.summary?.workspaceSource, 'browser_snapshot');
    assert.strictEqual(snapshotRunSummary?.summary?.workspaceBound, false);
    assert.strictEqual(mockModel.getChatRequests().length, chatRequestsBeforeSnapshot);

    const streamEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Say hello from direct mode' }],
        agentic: false,
      }),
    });
    const streamedText = streamEvents
      .map((event) => {
        if (event.type === 'delta') return String(event.delta || '');
        if (event.type === 'done') return String(event.response || '');
        return '';
      })
      .join('');
    assert.ok(streamedText.includes('Direct stream works.'));

    const sessionAfterDirect = await fetchJson<SessionState>(`${API_BASE}/api/session`);
    assert.strictEqual(
      sessionAfterDirect.turnHistory?.filter((turn) => turn.executionMode === 'direct').length,
      1,
    );
  } finally {
    await stopApiServer(server);
    await stopMockModelServer(mockModel.server);
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
