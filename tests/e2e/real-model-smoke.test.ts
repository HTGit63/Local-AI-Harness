import assert from 'assert';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { CoreEngine } from '@local-harness/core';

const execFileAsync = promisify(execFile);

type SmokeResult = {
  status: 'passed' | 'failed' | 'skipped';
  model: string;
  provider: string;
  baseUrl: string;
  workspacePath: string;
  runId?: string;
  logPath?: string;
  summaryPath?: string;
  reason?: string;
};

const provider = process.env.HARNESS_RUNTIME_PROVIDER || 'ollama-legacy';
const model = process.env.HARNESS_MODEL || process.env.OLLAMA_MODEL || 'nemotron-3-nano:4b';
const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
const SCENARIO_TIMEOUT_MS = Number(process.env.HARNESS_REAL_MODEL_TIMEOUT_MS || 30_000);

function printResult(result: SmokeResult) {
  console.log([
    'Real model smoke result:',
    `- ${result.status}`,
    `- model: ${result.model}`,
    `- provider: ${result.provider}`,
    `- base URL: ${result.baseUrl}`,
    `- workspace path: ${result.workspacePath}`,
    `- run id: ${result.runId || 'n/a'}`,
    `- log jsonl path: ${result.logPath || 'n/a'}`,
    `- summary path: ${result.summaryPath || 'n/a'}`,
    result.reason ? `- reason: ${result.reason}` : '',
  ].filter(Boolean).join('\n'));
}

async function ollamaModelAvailable(targetModel: string): Promise<{ available: boolean; reason?: string }> {
  try {
    const { stdout } = await execFileAsync('ollama', ['list'], { timeout: 10_000 });
    if (!stdout.includes(targetModel)) {
      return { available: false, reason: `Model ${targetModel} missing from ollama list.` };
    }
    return { available: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { available: false, reason: `Ollama unavailable: ${message}` };
  }
}

async function makeWorkspace() {
  const workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-smoke-'));
  await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspacePath, 'package.json'), JSON.stringify({
    name: 'harness-smoke',
    type: 'module',
    scripts: {
      test: 'node test/math.test.js',
    },
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workspacePath, 'src', 'math.js'), [
    'export function add(a, b) {',
    '  return a + b;',
    '}',
    '',
  ].join('\n'), 'utf8');
  await fs.mkdir(path.join(workspacePath, 'test'), { recursive: true });
  await fs.writeFile(path.join(workspacePath, 'test', 'math.test.js'), [
    "import assert from 'assert';",
    "import { add } from '../src/math.js';",
    'assert.strictEqual(add(2, 3), 5);',
    "console.log('math-ok');",
    '',
  ].join('\n'), 'utf8');
  return workspacePath;
}

async function withAbortTimeout<T>(
  label: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`${label} timed out after ${SCENARIO_TIMEOUT_MS}ms`)), SCENARIO_TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function latestRun(runs: Array<{ runId: string; logPath: string; summaryPath?: string }>) {
  return runs[0];
}

async function main() {
  const workspacePath = await makeWorkspace();
  const hardTimeoutMs = SCENARIO_TIMEOUT_MS * 4;
  let currentStage = 'workspace-created';
  const hardExitTimer = setTimeout(() => {
    printResult({
      status: 'failed',
      model,
      provider,
      baseUrl,
      workspacePath,
      reason: `Smoke exceeded hard timeout ${hardTimeoutMs}ms during ${currentStage}.`,
    });
    process.exit(124);
  }, hardTimeoutMs);

  if (process.env.HARNESS_REAL_MODEL_TESTS !== '1') {
    printResult({ status: 'skipped', model, provider, baseUrl, workspacePath, reason: 'Set HARNESS_REAL_MODEL_TESTS=1 to run.' });
    clearTimeout(hardExitTimer);
    await fs.rm(workspacePath, { recursive: true, force: true });
    return;
  }

  const availability = await ollamaModelAvailable(model);
  if (!availability.available) {
    printResult({ status: 'skipped', model, provider, baseUrl, workspacePath, reason: availability.reason });
    clearTimeout(hardExitTimer);
    await fs.rm(workspacePath, { recursive: true, force: true });
    return;
  }

  try {
    currentStage = 'direct-chat';
    const chatEngine = new CoreEngine({
      workspaceRoot: workspacePath,
      provider: provider as 'ollama-legacy',
      baseUrl,
      model,
      mode: 'chat',
      profile: 'fast',
      streamIdleTimeoutMs: 60_000,
    });
    let directDelta = '';
    const direct = await withAbortTimeout('direct chat smoke', (signal) =>
      chatEngine.directChatStream(
        [{ role: 'user', content: 'Do not think. Final answer exactly: harness-ok' }],
        { onDelta: (chunk) => { directDelta += chunk; } },
        { signal, think: false },
      ),
    );
    assert.ok(/harness-ok/i.test(direct || directDelta), `Direct chat did not return harness-ok. Output: ${direct || directDelta}`);
    assert.ok(!chatEngine.getTraceLog().some((event) => event.type === 'tool_call_started'));

    currentStage = 'agent-inspect';
    const inspectEngine = new CoreEngine({
      workspaceRoot: workspacePath,
      provider: provider as 'ollama-legacy',
      baseUrl,
      model,
      mode: 'inspect',
      profile: 'fast',
      streamIdleTimeoutMs: 60_000,
      localModelBudgetProfile: 'lean',
    });
    const beforeInspect = await fs.readFile(path.join(workspacePath, 'src', 'math.js'), 'utf8');
    await withAbortTimeout('agent inspect smoke', (signal) =>
      inspectEngine.agentWorkStream(
        [{ role: 'user', content: 'Inspect this temporary workspace and list files relevant to the math function. Do not edit files.' }],
        {},
        { signal, think: false },
      ),
    );
    const afterInspect = await fs.readFile(path.join(workspacePath, 'src', 'math.js'), 'utf8');
    assert.strictEqual(afterInspect, beforeInspect);
    const inspectTraceTypes = inspectEngine.getTraceLog().map((event) => event.type);
    assert.ok(inspectTraceTypes.includes('workspace_doc_inventory'));
    assert.ok(inspectTraceTypes.includes('workspace_context_collected'));
    assert.ok(inspectTraceTypes.includes('tool_call_started'), 'Agent inspect did not run a read/list/search tool.');

    currentStage = 'agent-edit';
    const editEngine = new CoreEngine({
      workspaceRoot: workspacePath,
      provider: provider as 'ollama-legacy',
      baseUrl,
      model,
      mode: 'trusted-edit',
      profile: 'fast',
      streamIdleTimeoutMs: 60_000,
      toolRetryMax: 2,
      localModelBudgetProfile: 'lean',
    });
    const beforeEdit = await fs.readFile(path.join(workspacePath, 'src', 'math.js'), 'utf8');
    await withAbortTimeout('agent edit smoke', (signal) =>
      editEngine.agentWorkStream(
        [{ role: 'user', content: 'Make this exact minimal edit: in src/math.js change `return a + b;` to `return Number(a) + Number(b);`, then run `npm test`, then summarize.' }],
        {
          onStatus: (event) => {
            currentStage = `agent-edit:${event.phase}`;
          },
          onTool: (event) => {
            currentStage = `agent-edit:${event.name}:${event.state}`;
          },
        },
        { signal, think: false },
      ),
    );
    const afterEdit = await fs.readFile(path.join(workspacePath, 'src', 'math.js'), 'utf8');
    assert.notStrictEqual(afterEdit, beforeEdit, 'Agent edit did not change src/math.js.');
    assert.ok(afterEdit.includes('return Number(a) + Number(b);'), 'Agent edit did not apply the expected math change.');
    const editTraceTypes = editEngine.getTraceLog().map((event) => event.type);
    assert.ok(editTraceTypes.includes('agent_skill_selection'));
    assert.ok(editTraceTypes.includes('adaptive_plan_validated'));
    assert.ok(editTraceTypes.includes('tool_call_started'), 'Agent edit did not execute tools.');
    assert.ok(
      editTraceTypes.includes('verification_started') || editTraceTypes.includes('verification_completed'),
      'Agent edit did not log verification start/completion.',
    );

    const runs = await editEngine.listLogRuns(5);
    const run = latestRun(runs);
    assert.ok(run?.runId);
    printResult({
      status: 'passed',
      model,
      provider,
      baseUrl,
      workspacePath,
      runId: run.runId,
      logPath: run.logPath,
      summaryPath: run.summaryPath,
    });
  } catch (error) {
    printResult({
      status: 'failed',
      model,
      provider,
      baseUrl,
      workspacePath,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    clearTimeout(hardExitTimer);
    await fs.rm(workspacePath, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
