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
    executionMode: 'chat' | 'agent';
    runSummary?: {
      summary?: string;
      workspaceSource?: 'backend' | 'browser_snapshot';
      workspaceBound?: boolean;
      toolProtocol?: 'native' | 'manual';
      fallbackPath?: string;
      fallbackReason?: string;
    };
  }>;
}

function requestText(body: any): string {
  if (!Array.isArray(body.messages)) {
    return '';
  }
  return body.messages
    .map((message: { content?: unknown }) => typeof message.content === 'string' ? message.content : '')
    .join('\n');
}

function isAdaptivePlanningRequest(body: any): boolean {
  return requestText(body).includes('[Adaptive Planning Task]');
}

function workspaceRootFromPlanningRequest(body: any): string {
  return requestText(body).match(/^Workspace root:\s*(.+)$/m)?.[1]?.trim() || '';
}

function simpleAdaptivePlan(body: any) {
  const workspaceRoot = workspaceRootFromPlanningRequest(body);
  return {
    id: 'api_simple_adaptive_plan',
    task: 'Answer agent request',
    summary: 'Produce a bounded answer for the agent request.',
    complexity: 'small',
    mode: 'agent',
    status: 'pending',
    workspaceRoot,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    planner: 'ai',
    goals: [{
      id: 'G1',
      title: 'Summarize agent response',
      type: 'summarize',
      status: 'pending',
      tools: [],
      files: [],
      success_check: 'Final response is returned without unnecessary workspace changes.',
      budget: {
        maxModelCalls: 1,
        maxToolCalls: 0,
        maxFilesToRead: 0,
        maxFilesToWrite: 0,
        maxOutputTokens: 512,
      },
    }],
  };
}

function approvalAdaptivePlan(body: any) {
  const workspaceRoot = workspaceRootFromPlanningRequest(body);
  return {
    id: 'api_approval_adaptive_plan',
    task: 'Read source and create approved notes',
    summary: 'Read the target source file, write the requested notes file after approval, then verify and summarize.',
    complexity: 'single_file',
    mode: 'agent',
    status: 'pending',
    workspaceRoot,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    planner: 'ai',
    goals: [
      {
        id: 'G1',
        title: 'Inspect requested source file',
        type: 'inspect',
        status: 'pending',
        tools: ['readFile'],
        files: ['src/index.ts'],
        success_check: 'src/index.ts is read before creating notes.',
        budget: {
          maxModelCalls: 0,
          maxToolCalls: 1,
          maxFilesToRead: 1,
          maxFilesToWrite: 0,
          maxOutputTokens: 512,
        },
      },
      {
        id: 'G2',
        title: 'Create approved notes file',
        type: 'edit',
        status: 'pending',
        tools: ['writeFile'],
        files: ['notes.txt'],
        success_check: 'notes.txt is written only through the approval workflow.',
        requiresApproval: true,
        budget: {
          maxModelCalls: 0,
          maxToolCalls: 1,
          maxFilesToRead: 0,
          maxFilesToWrite: 1,
          maxOutputTokens: 512,
        },
      },
      {
        id: 'G3',
        title: 'Verify and summarize approved write',
        type: 'summarize',
        status: 'pending',
        tools: [],
        files: ['notes.txt'],
        success_check: 'Verification result and final summary are reported to the user.',
        budget: {
          maxModelCalls: 1,
          maxToolCalls: 0,
          maxFilesToRead: 0,
          maxFilesToWrite: 0,
          maxOutputTokens: 512,
        },
      },
    ],
  };
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

      if (requestUrl.pathname === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'gemma4:e4b', object: 'model', owned_by: 'local' }] }));
        return;
      }

      if (requestUrl.pathname === '/v1/chat/completions') {
        chatRequests.push(body);
        if (isAdaptivePlanningRequest(body)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'mock-openai-plan',
            object: 'chat.completion',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: JSON.stringify(simpleAdaptivePlan(body)) },
              finish_reason: 'stop',
            }],
            usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
          }));
          return;
        }
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
          res.write(`data: ${JSON.stringify({
            id: 'mock-openai-stream',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { role: 'assistant', content: 'Direct stream works.' }, finish_reason: null }],
          })}\n\n`);
          res.write(`data: ${JSON.stringify({
            id: 'mock-openai-stream',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'mock-openai',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Direct stream works.' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        }));
        return;
      }

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

async function fetchNdjsonWithIntervention(
  url: string,
  init: RequestInit,
  onEvent?: (event: Record<string, unknown>) => Promise<void> | void,
): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text();
    assert.fail(`Request failed for ${url}: ${response.status} ${body}`);
  }
  assert.ok(response.body, `No response body for ${url}`);

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const event = JSON.parse(trimmed) as Record<string, unknown>;
        events.push(event);
        await onEvent?.(event);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const event = JSON.parse(buffer.trim()) as Record<string, unknown>;
      events.push(event);
      await onEvent?.(event);
    }
  } finally {
    reader.releaseLock();
  }

  return events;
}

async function startApprovalFlowMockModelServer(): Promise<{ server: http.Server; baseUrl: string; getChatRequests: () => any[] }> {
  const chatRequests: any[] = [];
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody.trim() ? JSON.parse(rawBody) : {};

      if (requestUrl.pathname === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'gemma4:e4b', object: 'model', owned_by: 'local' }] }));
        return;
      }

      if (requestUrl.pathname === '/v1/chat/completions') {
        chatRequests.push(body);
        if (isAdaptivePlanningRequest(body)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'mock-openai-approval-plan',
            object: 'chat.completion',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: JSON.stringify(approvalAdaptivePlan(body)) },
              finish_reason: 'stop',
            }],
            usage: { prompt_tokens: 50, completion_tokens: 40, total_tokens: 90 },
          }));
          return;
        }
        const hasToolResults = Array.isArray(body.messages) && body.messages.some((message: { role?: string }) => message.role === 'tool');
        const toolCalls = [
          { id: 'call_read', type: 'function', function: { name: 'readFile', arguments: JSON.stringify({ filePath: 'src/index.ts' }) } },
          { id: 'call_write', type: 'function', function: { name: 'writeFile', arguments: JSON.stringify({ filePath: 'notes.txt', content: 'approved complex content\n' }) } },
        ];

        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
          if (hasToolResults) {
            res.write(`data: ${JSON.stringify({
              id: 'mock-openai-approval',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { role: 'assistant', content: 'Complex task finished after approval.' }, finish_reason: null }],
            })}\n\n`);
            res.write(`data: ${JSON.stringify({
              id: 'mock-openai-approval',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({
              id: 'mock-openai-approval',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: { role: 'assistant', tool_calls: toolCalls.map((toolCall, index) => ({ ...toolCall, index })) }, finish_reason: null }],
            })}\n\n`);
            res.write(`data: ${JSON.stringify({
              id: 'mock-openai-approval',
              object: 'chat.completion.chunk',
              choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
            })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          id: 'mock-openai-approval',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: hasToolResults
              ? { role: 'assistant', content: 'Complex task finished after approval.' }
              : { role: 'assistant', content: '', tool_calls: toolCalls },
            finish_reason: hasToolResults ? 'stop' : 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: hasToolResults ? 12 : 8, total_tokens: hasToolResults ? 22 : 18 },
        }));
        return;
      }

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
        const hasToolResults = Array.isArray(body.messages) && body.messages.some((message: { role?: string }) => message.role === 'tool');

        const firstPayload = hasToolResults
          ? {
              model: 'mock-native',
              message: { role: 'assistant', content: 'Complex task finished after approval.' },
              done: false,
            }
          : {
              model: 'mock-native',
              message: {
                role: 'assistant',
                tool_calls: [
                  { function: { name: 'readFile', arguments: { filePath: 'src/index.ts' } } },
                  { function: { name: 'writeFile', arguments: { filePath: 'notes.txt', content: 'approved complex content\n' } } },
                ],
              },
              done: false,
            };

        const donePayload = {
          model: 'mock-native',
          message: {},
          done: true,
          done_reason: hasToolResults ? 'stop' : 'tool_calls',
          prompt_eval_count: 10,
          eval_count: hasToolResults ? 12 : 8,
        };

        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
          res.write(`${JSON.stringify(firstPayload)}\n`);
          res.write(`${JSON.stringify(donePayload)}\n`);
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: 'mock-native',
          message: firstPayload.message,
          done: true,
          done_reason: donePayload.done_reason,
          prompt_eval_count: donePayload.prompt_eval_count,
          eval_count: donePayload.eval_count,
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

async function approveNextPendingApproval(): Promise<void> {
  const script = `
const base = process.argv[1];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  const deadline = Date.now() + 10000;
  let approvedCount = 0;
  let lastApprovedAt = 0;
  while (Date.now() < deadline) {
    const approvalsResponse = await fetch(base + '/api/approvals');
    if (!approvalsResponse.ok) {
      throw new Error('Approval list failed: ' + approvalsResponse.status + ' ' + await approvalsResponse.text());
    }
    const approvals = await approvalsResponse.json();
    for (const approval of approvals) {
      const response = await fetch(base + '/api/approvals/' + approval.id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error('Approval request failed: ' + response.status + ' ' + body);
      }
      const parsed = JSON.parse(body);
      if (!parsed.resolved) {
        throw new Error('Approval was not resolved.');
      }
      approvedCount += 1;
      lastApprovedAt = Date.now();
    }
    if (approvedCount > 0 && Date.now() - lastApprovedAt > 1000) {
      return;
    }
    await sleep(100);
  }
  if (approvedCount === 0) {
    throw new Error('Timed out waiting for pending approval.');
  }
}
main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
`;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, API_BASE], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(Buffer.concat(chunks).toString('utf8') || `Approval resolver exited with ${code}`));
    });
  });
}

async function testApiWorkflow() {
  const workspaceParent = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-api-e2e-'));
  const workspaceRoot = path.join(workspaceParent, 'Gamma 4 Harness');
  const pickedWorkspace = path.join(workspaceParent, 'sample-express-app');
  const mockModel = await startMockModelServer();
  await fs.mkdir(workspaceRoot, { recursive: true });
  await fs.mkdir(path.join(pickedWorkspace, 'src'), { recursive: true });
  await fs.writeFile(path.join(pickedWorkspace, 'package.json'), JSON.stringify({ name: 'sample-express-app' }), 'utf8');
  await fs.writeFile(path.join(pickedWorkspace, 'src', 'index.ts'), 'export const gallery = true;\n', 'utf8');
  const server = await startApiServer(workspaceRoot, mockModel.baseUrl);

  try {
    const initialConfig = await fetchJson<{
      workspaceRoot: string;
      provider: string;
      profile: string;
      mode: string;
      model: string;
      baseUrl: string;
      contextBudget: number;
      toolRetryMax: number;
      internetAccessEnabled: boolean;
      sessionMemoryEnabled: boolean;
      sessionMemoryTurns: number;
      selfCheckEnabled: boolean;
      localModelBudgetProfile?: string;
      localModelBudget?: { maxModelCallsPerRun: number; maxToolCallsPerRun: number };
    }>(`${API_BASE}/api/config`);
    assert.strictEqual(initialConfig.workspaceRoot, workspaceRoot);
    assert.strictEqual(initialConfig.provider, 'ollama-legacy');
    assert.strictEqual(initialConfig.baseUrl, mockModel.baseUrl);
    assert.strictEqual(initialConfig.profile, 'balanced');
    assert.strictEqual(initialConfig.contextBudget, 16000);
    assert.strictEqual(initialConfig.toolRetryMax, 2);
    assert.strictEqual(initialConfig.internetAccessEnabled, false);
    assert.strictEqual(initialConfig.sessionMemoryEnabled, true);
    assert.strictEqual(initialConfig.sessionMemoryTurns, 3);
    assert.strictEqual(initialConfig.selfCheckEnabled, true);
    assert.strictEqual(initialConfig.localModelBudgetProfile, 'balanced');
    assert.strictEqual(initialConfig.localModelBudget?.maxModelCallsPerRun, 10);

    const updatedConfig = await fetchJson<{
      provider: string;
      profile: string;
      mode: string;
      model: string;
      baseUrl: string;
      contextBudget: number;
      toolRetryMax: number;
      sessionMemoryEnabled: boolean;
      sessionMemoryTurns: number;
      selfCheckEnabled: boolean;
      localModelBudgetProfile?: string;
    }>(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'llamacpp',
        profile: 'fast',
        mode: 'trusted-edit',
        model: 'gemma4:e4b',
        baseUrl: mockModel.baseUrl,
        contextBudget: 12000,
        toolRetryMax: 1,
        sessionMemoryEnabled: true,
        sessionMemoryTurns: 2,
        selfCheckEnabled: false,
        localModelBudgetProfile: 'lean',
      }),
    });
    assert.strictEqual(updatedConfig.provider, 'llamacpp');
    assert.strictEqual(updatedConfig.profile, 'fast');
    assert.strictEqual(updatedConfig.mode, 'trusted-edit');
    assert.strictEqual(updatedConfig.contextBudget, 12000);
    assert.strictEqual(updatedConfig.toolRetryMax, 1);
    assert.strictEqual(updatedConfig.sessionMemoryEnabled, true);
    assert.strictEqual(updatedConfig.sessionMemoryTurns, 2);
    assert.strictEqual(updatedConfig.selfCheckEnabled, false);
    assert.strictEqual(updatedConfig.localModelBudgetProfile, 'lean');

    const session = await fetchJson<{ id: string; skillsActive: string[]; skillAudit?: { requested: string[]; catalog: string[]; records: Array<{ slug: string; status: string; reason: string }> } }>(`${API_BASE}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: ['caveman', 'patch-surgeon', 'definitely-not-a-skill'] }),
    });
    assert.ok(session.id);
    assert.deepStrictEqual(session.skillsActive, ['patch-surgeon']);
    assert.deepStrictEqual(session.skillAudit?.requested, ['caveman', 'patch-surgeon', 'definitely-not-a-skill']);
    assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'caveman')?.status, 'filtered');
    assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'definitely-not-a-skill')?.status, 'missing');

    const sessionReloaded = await fetchJson<{ id: string; skillsActive: string[]; skillAudit?: { requested: string[]; catalog: string[]; records: Array<{ slug: string; status: string; reason: string }> } }>(`${API_BASE}/api/session`);
    assert.strictEqual(sessionReloaded.skillAudit?.records.find((entry) => entry.slug === 'caveman')?.status, 'filtered');
    assert.strictEqual(sessionReloaded.skillAudit?.records.find((entry) => entry.slug === 'definitely-not-a-skill')?.status, 'missing');

    const writeResult = await fetchJson<ToolResult>(`${API_BASE}/api/workspace/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'notes.txt', content: 'approved content\n' }),
    });
    assert.strictEqual(writeResult.success, true);
    assert.strictEqual(await fs.readFile(path.join(workspaceRoot, 'notes.txt'), 'utf8'), 'approved content\n');
    const approvalsAfterTrustedWrite = await fetchJson<ApprovalItem[]>(`${API_BASE}/api/approvals`);
    assert.ok(!approvalsAfterTrustedWrite.some((approval) => approval.target === 'notes.txt'));

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
        folderLabel: 'sample-express-app',
        relativeFiles: ['package.json', 'src/index.ts'],
      }),
    });
    assert.strictEqual(resolvedWorkspace.resolved, true);
    assert.strictEqual(resolvedWorkspace.workspaceRoot, pickedWorkspace);
    assert.ok(resolvedWorkspace.matchedFiles >= 1);

    const configAfterResolve = await fetchJson<{ workspaceRoot: string }>(`${API_BASE}/api/config`);
    assert.strictEqual(configAfterResolve.workspaceRoot, pickedWorkspace);

    const chatRequestsBeforeDefaultChat = mockModel.getChatRequests().length;
    const defaultChatEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Reply with exactly: API chat' }],
      }),
    });
    const defaultChatDone = defaultChatEvents.find((event) => event.type === 'done');
    assert.ok(String(defaultChatDone?.response || '').includes('Direct stream works.'));
    assert.strictEqual(defaultChatDone?.executionMode, 'chat');
    assert.ok(!defaultChatEvents.some((event) => event.type === 'task_plan_created'));
    assert.strictEqual(mockModel.getChatRequests().length, chatRequestsBeforeDefaultChat + 1);

    const unsafeChatEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'chat',
        agentic: false,
        executionMode: 'direct',
        workspaceRoot: pickedWorkspace,
        allowTools: true,
        messages: [{ role: 'user', content: 'List workspace files' }],
      }),
    });
    assert.ok(unsafeChatEvents.some((event) => event.type === 'error' && String(event.message || '').includes('Chat Mode')));
    assert.ok(!unsafeChatEvents.some((event) => event.type === 'tool' || event.type === 'task_plan_created' || event.type === 'run_started'));

    const unsafeChatPost = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'chat',
        executionMode: 'direct',
        allowTools: true,
        messages: [{ role: 'user', content: 'Run a command' }],
      }),
    });
    assert.strictEqual(unsafeChatPost.status, 400);

    const invalidAdvancedTools = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'agent',
        advancedTools: 'yes',
        messages: [{ role: 'user', content: 'Invalid advanced tools type' }],
      }),
    });
    assert.strictEqual(invalidAdvancedTools.status, 400);

    const chatRequestsBeforeAgent = mockModel.getChatRequests().length;
    const agentEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'agent',
        messages: [{ role: 'user', content: 'Reply with exactly: API agent' }],
      }),
    });
    const agentDone = agentEvents.find((event) => event.type === 'done');
    assert.ok(String(agentDone?.response || '').includes('Direct stream works.'));
    assert.ok(String(agentDone?.response || '').includes('What I did:'));
    assert.strictEqual(agentDone?.executionMode, 'agent');
    const agentEventTypes = agentEvents.map((event) => String(event.type || ''));
    const requiredAgentOrder = [
      'intent_classified',
      'workspace_doc_inventory',
      'agent_skill_selection',
      'workspace_context_collected',
      'adaptive_plan_requested',
      'adaptive_plan_validated',
      'task_plan_created',
      'current_goal_selected',
    ];
    let previousAgentIndex = -1;
    for (const type of requiredAgentOrder) {
      const index = agentEventTypes.indexOf(type);
      assert.ok(index > previousAgentIndex, `${type} should stream after ${requiredAgentOrder[Math.max(0, requiredAgentOrder.indexOf(type) - 1)]}`);
      previousAgentIndex = index;
    }
    assert.ok(agentEvents.some((event) => event.type === 'task_step_started'));
    assert.ok(agentEvents.some((event) => event.type === 'task_step_completed'));
    assert.ok(agentEvents.some((event) => event.type === 'task_checkpoint_saved'));
    const agentRunSummary = agentEvents.find((event) => event.type === 'run_summary');
    assert.ok(agentRunSummary);
    assert.strictEqual(agentRunSummary?.summary?.workspaceSource, 'backend');
    assert.strictEqual(agentRunSummary?.summary?.workspaceBound, true);
    assert.ok(mockModel.getChatRequests().length > chatRequestsBeforeAgent);

    const logRuns = await fetchJson<Array<{ runId: string; status?: string; eventCount?: number }>>(`${API_BASE}/api/logs/runs`);
    assert.ok(logRuns.some((run) => run.runId === agentRunSummary.runId));
    const agentLog = await fetchJson<{ runId: string; events: Array<{ eventType: string }> }>(`${API_BASE}/api/logs/runs/${agentRunSummary.runId}`);
    assert.ok(agentLog.events.some((event) => event.eventType === 'request_received'));
    assert.ok(agentLog.events.some((event) => event.eventType === 'task_plan_created'));
    const agentLogSummary = await fetchJson<{ runId: string; status: string; eventCount: number }>(`${API_BASE}/api/logs/runs/${agentRunSummary.runId}/summary`);
    assert.strictEqual(agentLogSummary.status, 'done');
    assert.ok(agentLogSummary.eventCount > 0);
    const traversalLog = await fetch(`${API_BASE}/api/logs/runs/bad%25id`);
    assert.strictEqual(traversalLog.status, 400);

    const planState = await fetchJson<{ taskPlan?: { intent?: string; sizeEstimate?: string; complexity?: string; steps?: unknown[] } }>(`${API_BASE}/api/plan`);
    assert.ok(planState.taskPlan);
    assert.ok(planState.taskPlan?.intent);
    assert.ok(planState.taskPlan?.sizeEstimate);
    assert.strictEqual(planState.taskPlan?.complexity, undefined);
    assert.ok(Array.isArray(planState.taskPlan?.steps));

    const runs = await fetchJson<Array<{ runId: string; taskPlan: { id: string; intent: string; sizeEstimate: string; complexity?: string } }>>(`${API_BASE}/api/runs`);
    assert.ok(runs.length >= 1);
    assert.ok(runs[0].taskPlan.intent);
    assert.ok(runs[0].taskPlan.sizeEstimate);
    assert.strictEqual(runs[0].taskPlan.complexity, undefined);
    const firstRun = await fetchJson<{ runId: string; taskPlan: { id: string } }>(`${API_BASE}/api/runs/${runs[0].runId}`);
    assert.strictEqual(firstRun.runId, runs[0].runId);
    const checkpoint = await fetchJson<{ runId: string; taskPlan: { id: string }; completedSteps: string[] }>(`${API_BASE}/api/runs/${runs[0].runId}/checkpoint`);
    assert.strictEqual(checkpoint.runId, runs[0].runId);
    assert.ok(Array.isArray(checkpoint.completedSteps));

    const sessionAfterAgent = await fetchJson<SessionState>(`${API_BASE}/api/session`);
    const latestAgentTurn = [...(sessionAfterAgent.turnHistory || [])]
      .reverse()
      .find((turn) => turn.executionMode === 'agent');
    assert.ok(latestAgentTurn?.runSummary?.summary);
    assert.strictEqual(latestAgentTurn?.runSummary?.toolProtocol, 'native');
    assert.strictEqual(latestAgentTurn?.runSummary?.fallbackPath, 'native_tools');
    assert.strictEqual((latestAgentTurn?.runSummary as any)?.workspaceSource, undefined);
    assert.strictEqual((latestAgentTurn?.runSummary as any)?.steps, undefined);

    const chatRequestsBeforeSnapshot = mockModel.getChatRequests().length;
    const snapshotEvents = await fetchNdjson(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: '[Browser Folder Context]\nFolder label: sample-express-app\nTree:\n- src/\n  - index.ts' },
          { role: 'user', content: 'Create notes.txt and run npm test' },
        ],
        mode: 'agent',
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
        messages: [{ role: 'user', content: 'Say hello from Chat Mode' }],
        mode: 'chat',
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
      sessionAfterDirect.turnHistory?.filter((turn) => turn.executionMode === 'chat').length,
      2,
    );
  } finally {
    await stopApiServer(server);
    await stopMockModelServer(mockModel.server);
    await fs.rm(workspaceParent, { recursive: true, force: true });
  }
}

async function testApiApprovalStreamResumesComplexTask() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-api-approval-'));
  const mockModel = await startApprovalFlowMockModelServer();
  const server = await startApiServer(workspaceRoot, mockModel.baseUrl);

  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  try {
    await fetchJson(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'llamacpp',
        baseUrl: mockModel.baseUrl,
        mode: 'full-agent',
      }),
    });

    const eventsPromise = fetchNdjsonWithIntervention(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'agent',
        messages: [{
          role: 'user',
          content: 'Read src/index.ts, create notes.txt, wait for approval, then summarize result.',
        }],
      }),
    });
    await approveNextPendingApproval();
    const events = await eventsPromise;

    const planningRequest = mockModel.getChatRequests().find((request) => isAdaptivePlanningRequest(request));
    assert.ok(planningRequest);
    const executionRequest = mockModel.getChatRequests().find((request) => Array.isArray(request?.tools) && request.tools.length > 0);
    assert.ok(executionRequest);

    const approvalPending = events.find((event) => event.type === 'approval' && event.state === 'pending');
    assert.ok(approvalPending);
    const approvalResolvedEvent = events.find((event) => event.type === 'approval' && event.state === 'resolved');
    assert.ok(approvalResolvedEvent);

    const statusTexts = events
      .filter((event) => event.type === 'status')
      .map((event) => String(event.action || ''));
    assert.ok(statusTexts.some((text) => text.includes('Approval required for notes.txt')));

    const doneEvent = events.find((event) => event.type === 'done');
    assert.ok(String(doneEvent?.response || '').includes('Complex task finished after approval.'));
    assert.ok(String(doneEvent?.response || '').includes('What I did:'));
    assert.strictEqual(await fs.readFile(path.join(workspaceRoot, 'notes.txt'), 'utf8'), 'approved complex content\n');
    const planState = await fetchJson<{ taskPlan?: { adaptivePlan?: { planner?: string; goals?: unknown[] }; planArtifactPaths?: { json?: string; markdown?: string } } }>(`${API_BASE}/api/plan`);
    assert.strictEqual(planState.taskPlan?.adaptivePlan?.planner, 'ai');
    assert.ok(Array.isArray(planState.taskPlan?.adaptivePlan?.goals));
    assert.ok(String(planState.taskPlan?.planArtifactPaths?.json || '').endsWith('plan.json'));
  } finally {
    await stopApiServer(server);
    await stopMockModelServer(mockModel.server);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

Promise.resolve()
  .then(() => testApiWorkflow())
  .then(() => testApiApprovalStreamResumesComplexTask())
  .then(() => {
    console.log('api e2e tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
