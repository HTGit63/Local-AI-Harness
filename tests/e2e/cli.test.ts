import assert from 'assert';
import { spawn, execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(ROOT, 'apps/cli/dist/cli.js');

interface RunCliOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

interface ChatResponderBody {
  messages?: Array<{ role?: string; content?: string }>;
  stream?: boolean;
  agentic?: boolean;
  thinking?: boolean;
  images?: unknown[];
}

function runCli(args: string[], options: RunCliOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: options.cwd || ROOT,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `CLI exited with code ${code}`));
    });
  });
}

function makeOpenAiResponse(content: string) {
  return {
    id: `mock-${Math.random().toString(36).slice(2, 8)}`,
    object: 'chat.completion',
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 12,
      completion_tokens: Math.max(1, content.length),
      total_tokens: Math.max(13, content.length + 12),
    },
  };
}

function makeNativeResponse(content: string) {
  return {
    model: 'mock-native',
    message: {
      role: 'assistant',
      content,
    },
    done: true,
    done_reason: 'stop',
    prompt_eval_count: 12,
    eval_count: Math.max(1, content.length),
  };
}

function encodeNdjson(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
}

function createNativeStream(content: string): ReadableStream<Uint8Array> {
  const midpoint = Math.max(1, Math.floor(content.length / 2));
  const parts = [content.slice(0, midpoint), content.slice(midpoint)].filter(Boolean);
  const native = makeNativeResponse(content);
  const lines = parts.map((part, index) => JSON.stringify({
    model: native.model,
    message: {
      role: native.message.role,
      content: part,
    },
    done: index === parts.length - 1 ? false : false,
  }));

  lines.push(JSON.stringify({
    model: native.model,
    message: {},
    done: true,
    done_reason: native.done_reason,
    prompt_eval_count: native.prompt_eval_count,
    eval_count: native.eval_count,
  }));

  return encodeNdjson(lines);
}

function createOpenAiStream(content: string): ReadableStream<Uint8Array> {
  const midpoint = Math.max(1, Math.floor(content.length / 2));
  const parts = [content.slice(0, midpoint), content.slice(midpoint)].filter(Boolean);
  const chunks = parts.map((part) => `data: ${JSON.stringify({
    id: `mock-${Math.random().toString(36).slice(2, 8)}`,
    object: 'chat.completion.chunk',
    choices: [{
      index: 0,
      delta: { role: 'assistant', content: part },
      finish_reason: null,
    }],
  })}\n\n`);

  chunks.push(`data: ${JSON.stringify({
    id: `mock-${Math.random().toString(36).slice(2, 8)}`,
    object: 'chat.completion.chunk',
    choices: [{
      index: 0,
      delta: {},
      finish_reason: 'stop',
    }],
  })}\n\n`);
  chunks.push('data: [DONE]\n\n');

  return encodeNdjson(chunks);
}

interface ModelServerOptions {
  chatResponder: (body: ChatResponderBody, callIndex: number) => string;
  initialRunningModels?: Array<{ name: string; model: string; context_length: number }>;
}

async function startMockModelServer(options: ModelServerOptions) {
  const requests: Array<{ url: string; body: any }> = [];
  const installedModels = [
    { name: 'gemma4:e4b' },
    { name: 'VladimirGav/gemma4-26b-16GB-VRAM:latest' },
  ];
  let runningModels = [...(options.initialRunningModels || [
    { name: 'gemma4:e4b', model: 'gemma4:e4b', context_length: 8192 },
  ])];
  let chatCount = 0;

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody.trim() ? JSON.parse(rawBody) : {};
      requests.push({ url: requestUrl.pathname, body });

      if (requestUrl.pathname === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: installedModels }));
        return;
      }

      if (requestUrl.pathname === '/api/ps') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: runningModels }));
        return;
      }

      if (requestUrl.pathname === '/api/generate') {
        if (body.keep_alive === 0) {
          runningModels = runningModels.filter((entry) => entry.model !== body.model);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ model: body.model, done: true, done_reason: 'unload', response: '' }));
          return;
        }

        runningModels = [{ name: body.model, model: body.model, context_length: 8192 }];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ model: body.model, done: true, done_reason: 'load', response: '' }));
        return;
      }

      if (requestUrl.pathname === '/api/show') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ capabilities: ['completion', 'thinking', 'tools'] }));
        return;
      }

      if (requestUrl.pathname === '/api/chat') {
        const content = options.chatResponder(body, chatCount++);
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
          res.write(`${JSON.stringify({
            model: 'mock-native',
            message: { role: 'assistant', content: content.slice(0, Math.max(1, Math.floor(content.length / 2))) },
            done: false,
          })}\n`);
          res.write(`${JSON.stringify({
            model: 'mock-native',
            message: { role: 'assistant', content: content.slice(Math.max(1, Math.floor(content.length / 2))) },
            done: false,
          })}\n`);
          res.write(`${JSON.stringify({
            model: 'mock-native',
            message: {},
            done: true,
            done_reason: 'stop',
            prompt_eval_count: 12,
            eval_count: Math.max(1, content.length),
          })}\n`);
          res.end();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(makeNativeResponse(content)));
        return;
      }

      if (requestUrl.pathname === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          object: 'list',
          data: installedModels.map((entry) => ({
            id: entry.name,
            object: 'model',
            owned_by: 'local',
          })),
        }));
        return;
      }

      if (requestUrl.pathname === '/v1/chat/completions') {
        const content = options.chatResponder(body, chatCount++);
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
          const stream = createOpenAiStream(content);
          const reader = stream.getReader();
          const decoder = new TextDecoder();

          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              res.write(decoder.decode(value));
            }
            reader.releaseLock();
            res.end();
          };

          void pump();
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(makeOpenAiResponse(content)));
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
    requests,
  };
}

async function stopMockServer(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function bootstrapWorkspace(files: Record<string, string>) {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-cli-workspace-'));

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(workspaceRoot, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }

  await execFileAsync('git', ['init'], { cwd: workspaceRoot });
  await execFileAsync('git', ['config', 'user.email', 'codex@example.com'], { cwd: workspaceRoot });
  await execFileAsync('git', ['config', 'user.name', 'Codex'], { cwd: workspaceRoot });
  await execFileAsync('git', ['add', '.'], { cwd: workspaceRoot });
  await execFileAsync('git', ['commit', '-m', 'baseline'], { cwd: workspaceRoot });

  return workspaceRoot;
}

async function testConfigShow() {
  const output = await runCli(['config', 'show', '--json']);
  const config = JSON.parse(output);
  assert.strictEqual(config.model, 'gemma4:e4b');
  assert.ok(config.baseUrl.includes('11434'));
}

async function testSessionList() {
  const output = await runCli(['session', 'list', '--json']);
  const result = JSON.parse(output);
  assert.ok(Array.isArray(result.sessions));
}

async function testWorkspaceStatus() {
  const output = await runCli(['workspace', 'status', '--json']);
  const result = JSON.parse(output);
  assert.ok(result.workspaceRoot || result.mode);
}

async function testSkillsList() {
  const output = await runCli(['skills', 'list', '--json']);
  const result = JSON.parse(output);
  assert.ok(Array.isArray(result.skills));
  assert.ok(result.skills.length > 0);
}

async function testDoctorJson() {
  const output = await runCli(['doctor', '--json']);
  const result = JSON.parse(output);
  assert.ok(result.cli_commands_resolve);
  assert.ok(result.ui_server_starts);
}

async function testAgentSmokeReadFile() {
  const workspaceRoot = await bootstrapWorkspace({
    'package.json': JSON.stringify({
      name: 'smoke-read',
      private: true,
      scripts: {
        test: 'node --version',
      },
    }, null, 2) + '\n',
    'README.md': '# Smoke Read\n',
  });

  const server = await startMockModelServer({
    chatResponder(body, callIndex) {
      if (callIndex === 0) {
        return [
          'Summary:',
          'Repo inspection completed.',
          'API entry file:',
          'package.json',
          'Files read:',
          '- package.json',
          '- README.md',
          'Commands detected:',
          '- npm test',
          'Notes:',
          'Package metadata read from workflow summary.',
        ].join('\n');
      }

      return JSON.stringify({
        kind: 'final',
        summary: 'Repo inspection completed.',
        filesChanged: [],
        verification: 'Summary provided.',
      });
    },
  });

  try {
    const output = await runCli([
      'agent-smoke',
      '--task',
      'Read package.json and tell me the package name',
      '--require-action',
      'read_file',
      '--json',
    ], {
      cwd: workspaceRoot,
      env: {
        OPENAI_BASE_URL: server.baseUrl,
      },
    });
    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.protocol, 'workflow_runner');
    assert.strictEqual(result.workflow, 'inspect_project');
    assert.ok(Array.isArray(result.observedActions));
    assert.ok(result.observedActions.includes('readfile'));
    assert.ok(typeof result.summary === 'string' && result.summary.length > 0);
  } finally {
    await stopMockServer(server.server);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testAgentSmokeWriteFile() {
  const workspaceRoot = await bootstrapWorkspace({
    'package.json': JSON.stringify({
      name: 'smoke-write',
      private: true,
      scripts: {
        test: 'node --version',
      },
    }, null, 2) + '\n',
    'README.md': '# Smoke Write\n',
  });

  const server = await startMockModelServer({
    chatResponder(body, callIndex) {
      if (callIndex === 0) {
        return JSON.stringify({
          kind: 'action',
          action: 'apply_approved_change',
          args: {
            path: 'hello.txt',
            content: 'hello',
          },
        });
      }

      return JSON.stringify({
        kind: 'final',
        summary: 'Created hello.txt.',
        filesChanged: ['hello.txt'],
        verification: 'Approval and write completed.',
      });
    },
  });

  try {
    const output = await runCli([
      'agent-smoke',
      '--task',
      'Create hello.txt with the word hello',
      '--require-approval',
      '--require-diff',
      '--json',
    ], {
      cwd: workspaceRoot,
      env: {
        OPENAI_BASE_URL: server.baseUrl,
        HARNESS_AGENT_PROTOCOL: 'action_dsl',
      },
    });
    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.ok(result.approvals >= 1);
    assert.ok(typeof result.diffPreview === 'string' && result.diffPreview.length > 0);
    assert.ok(result.observedActions.includes('applyapprovedchange'));
  } finally {
    await stopMockServer(server.server);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testAgentSmokeInspectProject() {
  const workspaceRoot = await bootstrapWorkspace({
    'package.json': JSON.stringify({
      name: 'smoke-inspect',
      private: true,
      scripts: {
        dev: 'node apps/api/src/server.ts',
        test: 'node --version',
        build: 'node --version',
      },
    }, null, 2) + '\n',
    'README.md': '# Smoke Inspect\n',
    'apps/api/src/server.ts': 'export const api = true;\n',
  });

  const server = await startMockModelServer({
    chatResponder(body, callIndex) {
      if (callIndex === 0) {
        return [
          'Summary:',
          'Repo inspection completed.',
          'API entry file:',
          'apps/api/src/server.ts',
          'Files read:',
          '- package.json',
          '- README.md',
          'Commands detected:',
          '- npm run dev',
          '- npm test',
          '- npm run build',
          'Notes:',
          'Entry file is visible and workspace is small.',
        ].join('\n');
      }

      return JSON.stringify({
        kind: 'final',
        summary: 'Repo inspection completed.',
        filesChanged: [],
        verification: 'Summary provided.',
      });
    },
  });

  try {
    const output = await runCli([
      'agent-smoke',
      '--task',
      'Inspect this repo and identify the API entry file',
      '--workflow',
      'inspect_project',
      '--json',
    ], {
      cwd: workspaceRoot,
      env: {
        OPENAI_BASE_URL: server.baseUrl,
      },
    });
    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.workflow, 'inspect_project');
    assert.ok(typeof result.summary === 'string' && result.summary.length > 0);
  } finally {
    await stopMockServer(server.server);
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testBenchmarkJson() {
  const server = await httpMockBenchmarkApiServer();

  try {
    const output = await runCli(['benchmark', '--json'], {
      env: {
        HARNESS_API_BASE_URL: server.baseUrl,
        HARNESS_MODEL: 'gemma4:e4b',
      },
    });
    const result = JSON.parse(output);

    assert.strictEqual(result.apiBaseUrl, server.baseUrl);
    assert.strictEqual(result.model, 'gemma4:e4b');
    assert.ok(Array.isArray(result.scenarios));
    assert.strictEqual(result.scenarios.length, 5);
    assert.ok(result.scenarios.some((scenario: { protocol: string }) => scenario.protocol === 'agentic'));
    assert.ok(result.scenarios.some((scenario: { telemetry: { parseFailureCount: number } }) => scenario.telemetry.parseFailureCount > 0));
    assert.ok(result.scenarios.some((scenario: { telemetry: { routingNotes: string[] } }) => scenario.telemetry.routingNotes.length > 0));
    assert.ok(result.scenarios.some((scenario: { telemetry: { memoryNotes: string[] } }) => scenario.telemetry.memoryNotes.length > 0));
    assert.ok(result.scenarios.some((scenario: { cold: { toolCount: number } }) => scenario.cold.toolCount > 0));
    assert.ok(result.support.fileWriteLatency >= 0);
    assert.ok(result.support.toolLoopLatency >= 0);
  } finally {
    await stopMockServer(server.server);
  }
}

async function httpMockBenchmarkApiServer() {
  const traceEvents = [
    {
      id: 'trace-1',
      timestamp: 1,
      type: 'action_dsl_parse_failed',
      data: {
        error: { code: 'INVALID_JSON', message: 'Mock parse failure' },
        response: '{"kind":"action"}',
      },
    },
    {
      id: 'trace-2',
      timestamp: 2,
      type: 'action_dsl_repair_started',
      data: { attempt: 1 },
    },
    {
      id: 'trace-3',
      timestamp: 3,
      type: 'action_dsl_repair_succeeded',
      data: { attempt: 1 },
    },
    {
      id: 'trace-4',
      timestamp: 4,
      type: 'model_route_selected',
      data: {
        protocol: 'action_dsl',
        agentModel: 'VladimirGav/gemma4-26b-16GB-VRAM:latest',
        reason: 'Action DSL route selected for agentic run',
      },
    },
    {
      id: 'trace-5',
      timestamp: 5,
      type: 'heavy_model_lock_acquired',
      data: { queued: 1 },
    },
    {
      id: 'trace-6',
      timestamp: 6,
      type: 'heavy_model_lock_released',
      data: {},
    },
  ];

  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      const body = rawBody.trim() ? JSON.parse(rawBody) : {};

      if (requestUrl.pathname === '/api/chat/stream') {
        const prompt = String(body?.messages?.[0]?.content || '');
        const wantsTool = /Read package\.json/i.test(prompt);
        const lines = wantsTool
          ? [
              JSON.stringify({ type: 'status', phase: 'model', action: 'Generating response' }),
              JSON.stringify({ type: 'delta', delta: 'reading package.json' }),
              JSON.stringify({ type: 'tool', name: 'readFile', state: 'start', inputSummary: 'package.json' }),
              JSON.stringify({ type: 'tool', name: 'readFile', state: 'done', inputSummary: 'package.json', output: 'name: smoke' }),
              JSON.stringify({ type: 'done', response: 'reading package.json' }),
            ]
          : [
              JSON.stringify({ type: 'status', phase: 'model', action: 'Generating response' }),
              JSON.stringify({ type: 'delta', delta: 'ok' }),
              JSON.stringify({ type: 'done', response: 'ok' }),
            ];

        res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
        res.end(lines.join('\n') + '\n');
        return;
      }

      if (requestUrl.pathname === '/api/trace') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(traceEvents));
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
    baseUrl: `http://127.0.0.1:${address.port}/api`,
  };
}

async function run() {
  await testConfigShow();
  await testSessionList();
  await testWorkspaceStatus();
  await testSkillsList();
  await testDoctorJson();
  await testAgentSmokeReadFile();
  await testAgentSmokeWriteFile();
  await testAgentSmokeInspectProject();
  await testBenchmarkJson();
  console.log('e2e tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
