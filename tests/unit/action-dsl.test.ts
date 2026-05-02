import assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ActionDslExecutor, buildActionDslRepairPrompt, parseActionDsl } from '@local-harness/action-dsl';
import { ToolRegistry } from '@local-harness/tool-runtime';

function createApprovalDecision(approved = true) {
  const decision: Promise<boolean> & { updatePreview?: (preview: string) => void } = Promise.resolve(approved) as Promise<boolean> & { updatePreview?: (preview: string) => void };
  decision.updatePreview = () => {};
  return decision;
}

function createToolRuntime(cwd: string, traces: Array<{ type: string; data: unknown }>) {
  return new ToolRegistry({
    cwd,
    internetAccessEnabled: false,
    emitTrace: (type, data) => {
      traces.push({ type, data });
    },
    checkPolicy: () => ({
      allowed: true,
      requiresApproval: false,
    }),
    requestApproval: () => createApprovalDecision(true),
  });
}

function assertParseOk<T>(value: ReturnType<typeof parseActionDsl>) {
  assert.ok(value.ok, `Expected parse success, got ${value.ok ? 'success' : value.error.code}`);
  return value as Extract<ReturnType<typeof parseActionDsl>, { ok: true }>;
}

async function testParser() {
  const read = assertParseOk(parseActionDsl('{"kind":"action","action":"read_file","args":{"path":"src/index.ts"}}'));
  assert.deepStrictEqual(read.value, {
    kind: 'action',
    action: 'read_file',
    args: { path: 'src/index.ts' },
  });

  const wrapped = assertParseOk(parseActionDsl('```json\n{"kind":"action","action":"list_dir","args":{"path":"src"}}\n```'));
  assert.deepStrictEqual(wrapped.value, {
    kind: 'action',
    action: 'list_dir',
    args: { path: 'src' },
  });

  const writeAlias = assertParseOk(parseActionDsl('{"kind":"action","action":"write_file","path":"hello.txt","content":"hello\\n"}'));
  assert.deepStrictEqual(writeAlias.value, {
    kind: 'action',
    action: 'apply_approved_change',
    args: { path: 'hello.txt', content: 'hello' },
  });

  const malformed = parseActionDsl('{"kind":"action","action":"read_file","args":{');
  assert.ok(!malformed.ok);
  assert.strictEqual(malformed.error.code, 'INVALID_JSON');
  const repairPrompt = buildActionDslRepairPrompt(malformed, '{"kind":"action","action":"read_file","args":{', ['read_file']);
  assert.ok(repairPrompt.includes('INVALID_JSON'));
  assert.ok(repairPrompt.includes('read_file'));

  const unknown = parseActionDsl('{"kind":"action","action":"nope","args":{}}');
  assert.ok(!unknown.ok);
  assert.strictEqual(unknown.error.code, 'UNKNOWN_ACTION');

  const missingArgs = parseActionDsl('{"kind":"action","action":"read_file","args":{}}');
  assert.ok(!missingArgs.ok);
  assert.strictEqual(missingArgs.error.code, 'MISSING_REQUIRED_ARGUMENT');

  const multiple = parseActionDsl('```json\n{"kind":"action","action":"read_file","args":{"path":"a"}}\n```\n```json\n{"kind":"action","action":"read_file","args":{"path":"b"}}\n```');
  assert.ok(!multiple.ok);
  assert.strictEqual(multiple.error.code, 'MULTIPLE_OBJECTS');
}

async function testExecutor() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-action-dsl-'));
  const traces: Array<{ type: string; data: unknown }> = [];

  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const value = "hello";\n', 'utf8');

  try {
    const runtime = createToolRuntime(workspaceRoot, traces);
    const executor = new ActionDslExecutor(runtime, {
      emitTrace: (type, data) => {
        traces.push({ type, data });
      },
    });

    const readResult = await executor.execute(assertParseOk(parseActionDsl('{"kind":"action","action":"read_file","args":{"path":"src/index.ts"}}')).value);
    assert.strictEqual(readResult.kind, 'tool');
    assert.strictEqual(readResult.action, 'read_file');
    assert.ok(readResult.result.output.includes('export const value'));

    const listResult = await executor.execute(assertParseOk(parseActionDsl('{"kind":"action","action":"list_dir","args":{"path":"src"}}')).value);
    assert.strictEqual(listResult.kind, 'tool');
    assert.ok(listResult.result.output.includes('index.ts'));

    const searchResult = await executor.execute(assertParseOk(parseActionDsl('{"kind":"action","action":"search_text","args":{"query":"hello","path":"src/**/*.ts"}}')).value);
    assert.strictEqual(searchResult.kind, 'tool');
    assert.ok(searchResult.result.output.includes('hello'));

    const patchResult = await executor.execute(assertParseOk(parseActionDsl('{"kind":"action","action":"propose_patch","args":{"path":"src/index.ts","oldText":"hello","newText":"agent"}}')).value);
    assert.strictEqual(patchResult.kind, 'tool');
    assert.ok(patchResult.result.preview?.includes('agent'));

    assert.ok(traces.some((entry) => entry.type === 'action_dsl_action_started'));
    assert.ok(traces.some((entry) => entry.type === 'action_dsl_action_finished'));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function run() {
  await testParser();
  await testExecutor();
  console.log('action dsl tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
