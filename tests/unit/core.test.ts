import assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CoreEngine, PromptAnalyzer } from '@local-harness/core';
import { ModelAdapter, PROFILES, type ChatMessage as AdapterChatMessage } from '@local-harness/model-adapter';
import { PromptOptimizer, RECIPES } from '@local-harness/prompt-recipes';
import { RepoIndexer } from '@local-harness/repo-indexer';
import { TaskOrchestrator } from '@local-harness/task-orchestrator';
import { WorkspacePolicy } from '@local-harness/workspace-policy';
import { createMockFetch, MOCK_CHAT_RESPONSE, MOCK_MODEL_CAPABILITIES, MOCK_MODEL_LIST } from '../mocks/model-responses';

function assertAgenticResponse(response: string, expectedPrefix: string) {
  assert.ok(response.startsWith(expectedPrefix), `Expected response to start with "${expectedPrefix}" but got: ${response}`);
  assert.ok(response.includes('What I did:'), 'Expected agentic run summary in response.');
  assert.ok(response.includes('Files changed:'), 'Expected changed-file summary in response.');
}

function assertLeanThinkingControl(value: unknown) {
  assert.ok(value === false || value === 'low', `Expected lean thinking control, got: ${String(value)}`);
}

async function testConfigDefaults() {
  const engine = new CoreEngine();
  const config = engine.getPublicConfig();

  assert.ok(config.baseUrl.includes('11434'));
  assert.strictEqual(config.model, 'gemma4:e4b');
  assert.strictEqual(config.mode, 'workspace-write');
  assert.strictEqual(config.profile, 'fast');
  assert.strictEqual(config.agentProtocol, 'action_dsl');
  assert.strictEqual(config.contextBudget, 24000);
  assert.strictEqual(config.toolRetryMax, 2);
  assert.strictEqual(config.sessionMemoryEnabled, true);
  assert.strictEqual(config.sessionMemoryTurns, 3);
  assert.strictEqual(config.selfCheckEnabled, true);
}

function testPromptRecipes() {
  assert.ok(RECIPES.zeroShot('Fix bug', 'Return JSON only').includes('Fix bug'));
  assert.ok(RECIPES.toolReAct(['read_file'], 'Inspect repo').includes('Call:'));
  assert.ok(RECIPES.codeReview('+ const x = 1;').includes('Diff:'));
  assert.ok(RECIPES.fileSummary('const x = 1;').includes('Summary:'));

  const optimizer = new PromptOptimizer('code_review');
  assert.ok(optimizer.optimizeForTask('diff content', 100).length > 0);
  assert.ok(optimizer.optimizeForTask('rewrite entire codebase', 5000).includes('FALLBACK'));
  assert.strictEqual(optimizer.detectReframing(Array(120).fill('word').join(' ')), true);
}

async function testPromptAnalyzerIsPassThrough() {
  const analyzer = new PromptAnalyzer({} as ModelAdapter);
  const messages: AdapterChatMessage[] = [
    { role: 'system', content: 'setup' },
    { role: 'user', content: '  keep wording  ' },
  ];

  const result = await analyzer.analyzeAndRefine(messages);
  assert.strictEqual(result.needsClarification, false);
  assert.strictEqual(result.originalPrompt, '  keep wording  ');
  assert.strictEqual(result.refinedPrompt, '  keep wording  ');
  assert.strictEqual(messages[1].content, '  keep wording  ');
}

function testWorkspacePolicy() {
  const root = '/tmp/gamma-project';
  const policy = new WorkspacePolicy({ workspaceRoot: root, mode: 'workspace-write' });
  const dangerPolicy = new WorkspacePolicy({ workspaceRoot: root, mode: 'danger' });

  assert.deepStrictEqual(policy.checkAction('read', 'src/index.ts').allowed, true);
  assert.deepStrictEqual(policy.checkAction('write', 'src/index.ts').requiresApproval, true);
  assert.deepStrictEqual(policy.checkAction('write', '/etc/passwd').allowed, false);
  assert.deepStrictEqual(policy.checkAction('write', `${root}-outside/file.ts`).allowed, false);
  assert.deepStrictEqual(dangerPolicy.checkAction('write', 'src/index.ts').allowed, true);
  assert.deepStrictEqual(dangerPolicy.checkAction('write', 'src/index.ts').requiresApproval, false);
  assert.deepStrictEqual(dangerPolicy.checkAction('write', '/etc/passwd').allowed, false);
}

function testTaskOrchestratorClassifiesComplexity() {
  const orchestrator = new TaskOrchestrator();

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Which model is active?',
    intent: 'model_status',
  }), 'direct_answer');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Fix apps/web/src/HarnessApp.tsx',
    intent: 'edit_code',
  }), 'single_file');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Refactor the web UI into components and add a run console',
    intent: 'edit_code',
  }), 'multi_file');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Add a task orchestrator and fix complex agent execution architecture',
    intent: 'edit_code',
  }), 'architecture_change');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Audit the whole codebase and find all bottlenecks',
    intent: 'read_repo',
  }), 'repo_wide_audit');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Look at the art gallery website and tell me what kind of project it is and if there are any bugs',
    intent: 'general_chat',
  }), 'repo_wide_audit');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Rewrite the whole project from scratch',
    intent: 'edit_code',
  }), 'unsafe_or_too_broad');
}

function testTaskOrchestratorPlanAndStepTransitions() {
  const orchestrator = new TaskOrchestrator();
  const plan = orchestrator.createPlan({
    userRequest: 'Fix apps/web/src/HarnessApp.tsx',
    intent: 'edit_code',
    workspaceRoot: '/repo',
  });

  assert.strictEqual(plan.complexity, 'single_file');
  assert.deepStrictEqual(plan.steps.map((step) => step.type), ['inspect', 'edit', 'verify', 'summarize']);

  const first = orchestrator.getNextStep(plan);
  assert.ok(first);
  assert.strictEqual(first?.id, 'inspect_target');

  const running = orchestrator.markStepRunning(plan, first!.id);
  assert.strictEqual(running.steps[0].status, 'running');

  const done = orchestrator.markStepDone(running, first!.id, 'Read target file');
  assert.strictEqual(done.steps[0].status, 'done');
  assert.strictEqual(done.steps[0].detail, 'Read target file');
  assert.strictEqual(orchestrator.getNextStep(done)?.id, 'focused_action');

  const failed = orchestrator.markStepFailed(done, 'focused_action', 'Patch rejected');
  assert.strictEqual(failed.steps[1].status, 'failed');
  assert.ok(failed.failedAt);

  const blocked = orchestrator.markStepBlocked(done, 'focused_action', 'Approval pending');
  assert.strictEqual(blocked.steps[1].status, 'blocked');
  assert.strictEqual(orchestrator.isComplete(blocked), false);
  assert.ok(orchestrator.summarizeProgress(blocked).includes('1/4 steps done'));
}

async function testModelAdapter() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const adapter = new ModelAdapter();
    assert.strictEqual(await adapter.isHealthy(), true);
    const models = await adapter.listModels();
    assert.deepStrictEqual(models, MOCK_MODEL_LIST.data);

    const response = await adapter.createChatCompletion({
      messages: [{ role: 'user', content: 'hello' }],
    }) as typeof MOCK_CHAT_RESPONSE;
    assert.strictEqual(response.choices[0].message.content, MOCK_CHAT_RESPONSE.choices[0].message.content);
    const runtimeBefore = await adapter.getRuntimeState();
    assert.strictEqual(runtimeBefore.activeModel, null);
    assert.ok(runtimeBefore.installedModels.includes('qwen3.5:9b-q4_K_M'));
    assert.deepStrictEqual(runtimeBefore.configuredModelCapabilities, MOCK_MODEL_CAPABILITIES['gemma4:e4b']);

    const switchResult = await adapter.activateModel('qwen3.5:9b-q4_K_M', 'gemma4:e4b');
    assert.strictEqual(switchResult.activeModel, 'qwen3.5:9b-q4_K_M');
    assert.deepStrictEqual(switchResult.runningModels.map((entry) => entry.model), ['qwen3.5:9b-q4_K_M']);

    const runtimeAfter = await adapter.getRuntimeState();
    assert.strictEqual(runtimeAfter.activeModel, 'qwen3.5:9b-q4_K_M');
    assert.strictEqual(runtimeAfter.lastSwitchResult?.requestedModel, 'qwen3.5:9b-q4_K_M');
    assert.strictEqual(PROFILES.fast.max_tokens, 512);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testModelAdapterPrefersNativeOllamaChat() {
  const originalFetch = globalThis.fetch;
  const mockFetch = createMockFetch();
  const requests: Array<{ url: string; body: any }> = [];

  globalThis.fetch = (async (url: any, opts?: any) => {
    const requestUrl = String(url);
    const parsedBody = typeof opts?.body === 'string' && opts.body.trim() ? JSON.parse(opts.body) : undefined;
    requests.push({ url: requestUrl, body: parsedBody });
    return mockFetch(requestUrl, opts);
  }) as typeof fetch;

  try {
    const adapter = new ModelAdapter();
    await adapter.createChatCompletion({
      messages: [{ role: 'user', content: 'Describe this image', images: ['abc123'] }],
      think: true,
    });

    assert.ok(requests.some((entry) => entry.url.includes('/api/tags')));
    const chatRequest = requests.find((entry) => entry.url.includes('/api/chat'));
    assert.ok(chatRequest);
    assert.deepStrictEqual(chatRequest?.body.messages?.[0]?.images, ['abc123']);
    assert.strictEqual(chatRequest?.body.think, true);
    assert.ok(!requests.some((entry) => entry.url.includes('/v1/chat/completions')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineRoutesAgenticRunsThroughThe26BModel() {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: any }> = [];
  const mockFetch = createMockFetch({
    initialRunningModels: [
      { name: 'deepseek-coder-v2:latest', model: 'deepseek-coder-v2:latest', context_length: 4096 },
    ],
  });

  globalThis.fetch = (async (url: any, opts?: any) => {
    const requestUrl = String(url);
    const parsedBody = typeof opts?.body === 'string' && opts.body.trim() ? JSON.parse(opts.body) : undefined;
    requests.push({ url: requestUrl, body: parsedBody });
    return mockFetch(requestUrl, opts);
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    await engine.updateConfig({ agentProtocol: 'native_tools' });
    const runtimeBefore = await engine.getModelRuntime();
    assert.strictEqual(runtimeBefore.agentModel, 'VladimirGav/gemma4-26b-16GB-VRAM:latest');
    assert.strictEqual(runtimeBefore.agentModelActive, false);

    const response = await engine.chat([
      { role: 'user', content: 'Tell me a short joke about llamas.' },
    ]);

    assertAgenticResponse(response, MOCK_CHAT_RESPONSE.choices[0].message.content);

    const runtimeAfter = await engine.getModelRuntime();
    assert.strictEqual(runtimeAfter.agentModel, 'VladimirGav/gemma4-26b-16GB-VRAM:latest');
    assert.strictEqual(runtimeAfter.activeModel, 'VladimirGav/gemma4-26b-16GB-VRAM:latest');
    assert.strictEqual(runtimeAfter.agentModelActive, true);
    assert.strictEqual(runtimeAfter.lastRouteSelection?.model, 'VladimirGav/gemma4-26b-16GB-VRAM:latest');
    assert.strictEqual(runtimeAfter.lastRouteSelection?.keepAlive, '90s');

    const traceTypes = engine.getTraceLog().map((entry) => entry.type);
    assert.ok(traceTypes.includes('model_route_selected'));
    assert.ok(traceTypes.includes('agent_protocol_selected'));
    assert.ok(traceTypes.includes('heavy_model_lock_acquired'));
    assert.ok(traceTypes.includes('heavy_model_lock_released'));
    assert.ok(traceTypes.includes('model_warmup_completed'));
    assert.ok(traceTypes.includes('model_unload_attempted'));

    const warmupRequest = requests.find((entry) => entry.url.includes('/api/generate') && entry.body?.keep_alive === '90s');
    assert.ok(warmupRequest, 'Expected agent warmup request with short keep_alive.');
    assert.strictEqual(warmupRequest?.body?.model, 'VladimirGav/gemma4-26b-16GB-VRAM:latest');

    const unloadRequest = requests.find((entry) => entry.url.includes('/api/generate') && entry.body?.keep_alive === 0);
    assert.ok(unloadRequest, 'Expected unrelated model unload request.');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEnginePromptRecipeSelection() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    await engine.updateConfig({ agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Review this diff for regressions' },
    ]);
    assertAgenticResponse(response, MOCK_CHAT_RESPONSE.choices[0].message.content);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'prompt_recipe_selected'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineUsesActionDslProtocol() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch({
    chatResponder() {
      return {
        id: 'mock-action-dsl',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '{"kind":"final","summary":"Action DSL completed","filesChanged":[],"verification":"checked"}',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    await engine.updateConfig({ agentProtocol: 'action_dsl' });
    const response = await engine.chat([
      { role: 'user', content: 'Summarize the action dsl path' },
    ]);

    assert.ok(response.startsWith('Action DSL completed'));
    assert.ok(response.includes('What I did:'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'action_dsl_protocol_selected'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineSanitizesDisabledSkills() {
  const engine = new CoreEngine();
  const session = engine.startSession(['caveman', 'patch-surgeon', 'patch-surgeon']);
  assert.deepStrictEqual(session.skillsActive, ['patch-surgeon']);

  const updated = await engine.updateSessionSkills(['caveman', 'repo-cartographer']);
  assert.deepStrictEqual(updated.skillsActive, ['repo-cartographer']);
}

async function testEngineChatStream() {
  const originalFetch = globalThis.fetch;
  const deltas: string[] = [];
  const statuses: string[] = [];
  globalThis.fetch = createMockFetch({
    chatResponder() {
      return {
        id: 'mock-stream',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '<think>Inspecting files</think>Streamed answer',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    const response = await engine.chatStream(
      [{ role: 'user', content: 'Explain what you are doing' }],
      {
        onStatus: (event) => statuses.push(event.action),
        onDelta: (chunk) => deltas.push(chunk),
      },
    );

    assertAgenticResponse(response, '<think>Inspecting files</think>Streamed answer');
    assert.ok(deltas.join('').includes('<think>Inspecting files</think>Streamed answer'));
    assert.ok(statuses.some((entry) => entry.includes('Generating assistant response')));
    assert.ok(statuses.some((entry) => entry.includes('Awaiting user input')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineChatStreamEmitsToolEvents() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-tool-stream-'));
  const toolEvents: Array<{ name: string; state: string; output?: string; success?: boolean }> = [];

  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'tool-stream-test' }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    chatResponder(body) {
      if (body.messages?.some((message: { role?: string }) => message.role === 'tool')) {
        return {
          id: 'mock-tool-final',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'The file exports `ok` as `true`.',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      return {
        id: 'mock-tool-call',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: {
                name: 'readFile',
                arguments: JSON.stringify({ filePath: 'src/index.ts' }),
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({
      workspaceRoot,
      model: 'qwen3.5:9b-q4_K_M',
      agentProtocol: 'native_tools',
    });
    const response = await engine.chatStream(
      [{ role: 'user', content: 'Read src/index.ts and tell me what it exports' }],
      {
        onTool: (event) => toolEvents.push(event),
      },
    );

    assert.ok(response.includes('exports `ok`'));
    assert.ok(toolEvents.some((event) => event.name === 'readFile' && event.state === 'start'));
    const doneEvent = toolEvents.find((event) => event.name === 'readFile' && event.state === 'done');
    assert.ok(doneEvent);
    assert.strictEqual(doneEvent?.success, true);
    assert.ok(doneEvent?.output?.includes('export const ok = true;'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineRecordsExecutionModes() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    await engine.recordTurnExecution('direct', { messageCount: 1, thinkingEnabled: false });

    const firstSession = engine.getSession();
    assert.strictEqual(firstSession?.turnHistory?.[0]?.executionMode, 'direct');
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'chat_turn_mode' && (entry.data as { executionMode?: string }).executionMode === 'direct'));

    await engine.chat([
      { role: 'user', content: 'Reply with exactly: PING' },
    ]);

    const modes = engine.getSession()?.turnHistory?.map((turn) => turn.executionMode) || [];
    assert.ok(modes.includes('agentic'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'chat_turn_mode' && (entry.data as { executionMode?: string }).executionMode === 'agentic'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEnginePrioritizesEditsWithoutAutoRepoContext() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-context-'));

  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'context-test' }), 'utf8');
  await fs.mkdir(path.join(workspaceRoot, 'src'));
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, agentProtocol: 'native_tools' });
    await engine.chat([
      { role: 'user', content: 'Create a README that explains this repo' },
    ]);

    assert.ok(chatRequests.length >= 1);
    const payload = JSON.stringify(chatRequests[0]);
    assert.ok(payload.includes('[Workspace Context]'));
    assert.ok(payload.includes(workspaceRoot));
    assert.ok(!payload.includes('[Repo Context Summary]'));

    const recipeTrace = engine.getTraceLog().find((entry) => entry.type === 'prompt_recipe_selected');
    assert.strictEqual((recipeTrace?.data as { mode?: string } | undefined)?.mode, 'targeted_edit');
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testDirectChatDoesNotCreateTaskPlan() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine();
    await engine.directChat([
      { role: 'user', content: 'Say PING in direct mode' },
    ]);

    assert.ok(!engine.getTraceLog().some((entry) => entry.type === 'task_plan_created'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineCreatesTaskPlanTraceAndCheckpoint() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-orchestrated-run-'));
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'core', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'planner', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'apps', 'api', 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'orchestrated-run' }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'core', 'src', 'engine.ts'), 'export const engine = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'planner', 'src', 'planner.ts'), 'export const planner = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'apps', 'api', 'src', 'server.ts'), 'export const server = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Architecture pass scoped into visible steps.' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b', localModelBudgetProfile: 'lean', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Add a task orchestrator and fix complex agent execution architecture' },
    ]);

    assertAgenticResponse(response, 'Architecture pass scoped into visible steps.');
    assert.ok(chatRequests.length >= 1);
    const promptPayload = JSON.stringify(chatRequests[0].messages);
    assert.ok(promptPayload.includes('[Current Task Plan]'));
    assert.ok(promptPayload.includes('[Current Step]'));
    assert.ok(promptPayload.includes('[Task Relevant Context]'));
    assert.ok(promptPayload.includes('Task complexity: architecture_change'));

    const traceTypes = engine.getTraceLog().map((entry) => entry.type);
    assert.ok(traceTypes.includes('task_plan_created'));
    assert.ok(traceTypes.includes('task_step_started'));
    assert.ok(traceTypes.includes('task_step_completed'));
    assert.ok(traceTypes.includes('task_checkpoint_saved'));

    const taskPlanTrace = engine.getTraceLog().find((entry) => entry.type === 'task_plan_created');
    assert.strictEqual((taskPlanTrace?.data as { plan?: { complexity?: string } } | undefined)?.plan?.complexity, 'architecture_change');

    const runFiles = await fs.readdir(path.join(workspaceRoot, '.gamma-harness', 'runs'));
    assert.ok(runFiles.some((file) => file.endsWith('.json')));
    const runs = await engine.listRuns();
    assert.ok(runs.length >= 1);
    assert.strictEqual(runs[0].taskPlan.complexity, 'architecture_change');
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRepoIndexerExcludesVendoredAndSessionDirs() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-indexer-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'third_party', 'demo'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'base_repos', 'demo'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, '.gamma-harness', 'sessions'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, '.playwright-cli'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'indexer-test' }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'third_party', 'demo', 'ignored.md'), 'ignore me\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'base_repos', 'demo', 'ignored.md'), 'ignore me\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, '.gamma-harness', 'sessions', 'session.json'), '{}\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, '.playwright-cli', 'console.log'), 'noise\n', 'utf8');

  try {
    const indexer = new RepoIndexer(workspaceRoot);
    const { context } = await indexer.buildContext();
    assert.ok(context.files.includes('src/index.ts'));
    assert.ok(!context.files.some((file) => file.startsWith('third_party/')));
    assert.ok(!context.files.some((file) => file.startsWith('base_repos/')));
    assert.ok(!context.files.some((file) => file.startsWith('.gamma-harness/')));
    assert.ok(!context.files.some((file) => file.startsWith('.playwright-cli/')));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRepoIndexerBuildsWorkspaceInventory() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-inventory-'));
  await fs.mkdir(path.join(workspaceRoot, 'apps', 'api'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'core'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'base_repos', 'claw-code'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'third_party', 'openclaw'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    name: 'gamma-root',
    workspaces: ['apps/*', 'packages/*'],
  }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'apps', 'api', 'package.json'), JSON.stringify({
    name: '@local-harness/api',
  }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'core', 'package.json'), JSON.stringify({
    name: '@local-harness/core',
  }), 'utf8');

  try {
    const indexer = new RepoIndexer(workspaceRoot);
    const inventory = await indexer.buildWorkspaceInventory();
    assert.strictEqual(inventory.rootPackageName, 'gamma-root');
    assert.deepStrictEqual(inventory.workspaceGlobs, ['apps/*', 'packages/*']);
    assert.deepStrictEqual(inventory.apps.map((entry) => entry.name), ['@local-harness/api']);
    assert.deepStrictEqual(inventory.packages.map((entry) => entry.name), ['@local-harness/core']);
    assert.ok(inventory.references.some((entry) => entry.area === 'base_repos' && entry.entries.includes('claw-code')));
    assert.ok(inventory.references.some((entry) => entry.area === 'third_party' && entry.entries.includes('openclaw')));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRepoIndexerBuildsTaskContext() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-task-context-'));
  await fs.mkdir(path.join(workspaceRoot, 'apps', 'web', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'core', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'planner', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'tests', 'unit'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'apps', 'web', 'src', 'HarnessApp.tsx'), 'export default function App() { return null; }\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'apps', 'web', 'src', 'index.css'), ':root {}\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'core', 'src', 'engine.ts'), 'export const engine = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'planner', 'src', 'planner.ts'), 'export const planner = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'tests', 'unit', 'core.test.ts'), 'export {};\n', 'utf8');

  try {
    const indexer = new RepoIndexer(workspaceRoot);
    const webContext = await indexer.buildTaskContext({
      userRequest: 'Redesign the messy web UI and add a right run console',
      intent: 'edit_code',
      complexity: 'multi_file',
    });
    assert.strictEqual(webContext.taskArea, 'web_ui');
    assert.ok(webContext.relevantFiles.includes('apps/web/src/HarnessApp.tsx'));
    assert.ok(webContext.relevantFiles.includes('apps/web/src/index.css'));

    const architectureContext = await indexer.buildTaskContext({
      userRequest: 'Add task orchestration to the agent loop architecture',
      intent: 'edit_code',
      complexity: 'architecture_change',
    });
    assert.strictEqual(architectureContext.taskArea, 'task_orchestration');
    assert.ok(architectureContext.relevantFiles.includes('packages/core/src/engine.ts'));
    assert.ok(architectureContext.relevantFiles.includes('packages/planner/src/planner.ts'));
    assert.ok(architectureContext.likelyTests.includes('tests/unit/core.test.ts'));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineKeepsSimplePromptsLean() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Reply with exactly: PING' },
    ]);

    assertAgenticResponse(response, MOCK_CHAT_RESPONSE.choices[0].message.content);
    assert.ok(chatRequests.length >= 1);
    const payload = JSON.stringify(chatRequests[0]);
    assert.ok(!payload.includes('[Repo Context Summary]'));
    assert.strictEqual(chatRequests[0].tools, undefined);
    assert.strictEqual(chatRequests[0].options?.num_predict ?? chatRequests[0].max_tokens, 128);
    assertLeanThinkingControl(chatRequests[0].think ?? chatRequests[0].reasoning_effort);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEnginePrefersNativeToolsForGemmaTargetedEdits() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'export const ok = true;' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Fix src/index.ts so it exports a default value' },
    ]);

    assertAgenticResponse(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 1);
    assert.ok(Array.isArray(chatRequests[0].tools));
    assert.ok(chatRequests[0].tools.length > 0);
    assert.ok(!JSON.stringify(chatRequests[0].messages).includes('Use this lightweight JSON tool protocol'));
    assertLeanThinkingControl(chatRequests[0].think ?? chatRequests[0].reasoning_effort);
    assert.strictEqual(chatRequests[0].options?.num_predict ?? chatRequests[0].max_tokens, 128);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineKeepsNativeToolsWhenCapabilitiesOmitTools() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    showResponder: () => ({ capabilities: ['completion', 'thinking'] }),
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Native tool trial stayed active.' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ model: 'gemma4:e4b', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Fix src/index.ts so it exports a default value' },
    ]);

    assertAgenticResponse(response, 'Native tool trial stayed active.');
    assert.ok(chatRequests.length >= 1);
    assert.ok(Array.isArray(chatRequests[0].tools));
    assert.ok(chatRequests[0].tools.length > 0);
    assert.ok(!JSON.stringify(chatRequests[0].messages).includes('Use exactly one JSON tool action at a time.'));
    assert.ok(!engine.getTraceLog().some((entry) => entry.type === 'manual_tool_fallback'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineRecoversFromPlanningOnlyNativeReply() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-planning-only-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  let chatCalls = 0;
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder(body) {
      chatCalls += 1;
      if (body.messages?.some((message: { role?: string }) => message.role === 'tool')) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: 'Recovered after tool call.' }, finish_reason: 'stop' }],
        };
      }

      if (chatCalls === 1) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: '<think>Need to inspect file before editing.</think>' }, finish_reason: 'stop' }],
        };
      }

      return {
        ...MOCK_CHAT_RESPONSE,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: {
                name: 'readFile',
                arguments: JSON.stringify({ filePath: 'src/index.ts' }),
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Read src/index.ts and tell me what it exports.' },
    ]);

    assertAgenticResponse(response, 'Recovered after tool call.');
    assert.ok(chatRequests.length >= 2);
    assert.ok(chatRequests.some((body) => Array.isArray(body.tools) && body.tools.length > 0));
    assert.ok(chatRequests.some((body) => JSON.stringify(body.messages).includes('Planning-only text is not enough.')));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'native_tool_retry_requested'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineUsesManualToolProtocolWhenAgentModelLacksNativeTools() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-manual-tools-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder(body) {
      const lastUser = [...body.messages].reverse().find((message: any) => message.role === 'user')?.content || '';
      if (lastUser.includes('[Tool Result]')) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: '{"final":"export const ok = true;"}' }, finish_reason: 'stop' }],
        };
      }
      return {
        ...MOCK_CHAT_RESPONSE,
        choices: [{ index: 0, message: { role: 'assistant', content: '{"action":"readFile","args":{"filePath":"src/index.ts"}}' }, finish_reason: 'stop' }],
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({
      workspaceRoot,
      model: 'deepseek-coder-v2:latest',
      agentModel: 'deepseek-coder-v2:latest',
      agentProtocol: 'native_tools',
    });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect src/index.ts and answer with its content' },
    ]);

    assertAgenticResponse(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 2);
    assert.strictEqual(chatRequests[0].tools, undefined);
    assert.ok(
      JSON.stringify(chatRequests[0].messages).includes('Use exactly one JSON tool action at a time.'),
    );
    assertLeanThinkingControl(chatRequests[0].think ?? chatRequests[0].reasoning_effort);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineAnswersRepoOverviewFromLocalInventory() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot: path.resolve('.') });
    const response = await engine.chat([
      { role: 'user', content: 'What are the main packages in this repo? Keep it short.' },
    ]);

    assert.ok(response.includes('Main packages:'));
    assert.ok(response.includes('core'));
    assert.strictEqual(chatRequests.length, 0);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'chat_response' && (entry.data as { source?: string }).source === 'local_inventory'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineAnswersRootManifestNameFromLocalInventory() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot: path.resolve('.') });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect package.json and answer with its package name only.' },
    ]);

    assertAgenticResponse(response, 'gamma4-local-harness');
    assert.strictEqual(chatRequests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineDoesNotShortCircuitWritePromptsThatMentionProjectMetadata() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-root-manifest-write-'));
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    name: 'art-gallery',
    scripts: {
      start: 'node server.js',
    },
  }), 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'AGENTIC_PROBE.md' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      {
        role: 'user',
        content: 'Create AGENTIC_PROBE.md in this workspace with exactly three bullets: project name, start command, main server file. Then reply with the file path only.',
      },
    ]);

    assertAgenticResponse(response, 'AGENTIC_PROBE.md');
    assert.ok(chatRequests.length >= 1);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEnginePrefersNativeToolsForGemmaQuickInspect() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-thinking-model-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'export const ok = true;' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect src/index.ts and answer with its content' },
    ]);

    assertAgenticResponse(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 1);
    assert.ok(Array.isArray(chatRequests[0].tools));
    assert.ok(chatRequests[0].tools.length > 0);
    assert.ok(!JSON.stringify(chatRequests[0].messages).includes('Use this lightweight JSON tool protocol'));
    assertLeanThinkingControl(chatRequests[0].think ?? chatRequests[0].reasoning_effort);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineWarnsWhenThinkingUnsupported() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    showResponder() {
      return { capabilities: ['completion', 'vision', 'tools'] };
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Thinking unavailable response' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ model: 'gemma4:e4b', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Explain the plan briefly' },
    ], { think: true });

    assertAgenticResponse(response, 'Thinking unavailable response');
    assert.strictEqual(chatRequests[0].think, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineAnswersStatusOnlyQuestionsFromLocalState() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot: '/tmp/gamma-status-test' });
    const response = await engine.chat([
      { role: 'user', content: 'Which workspace folder is open? Reply with the absolute path only.' },
    ]);

    assertAgenticResponse(response, '/tmp/gamma-status-test');
    assert.strictEqual(chatRequests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineAnswersSimpleWorkspaceListingsWithoutModelRoundTrip() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-direct-list-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'README.md'), '# demo\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot });
    const response = await engine.chat([
      { role: 'user', content: 'List all files in the workspace' },
    ]);

    assert.ok(response.includes('dir  src'));
    assert.ok(response.includes('file README.md'));
    assert.strictEqual(chatRequests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineChatStreamShowsStatusesForDirectWorkspaceListing() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-direct-list-status-'));
  const statuses: string[] = [];
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'README.md'), '# demo\n', 'utf8');

  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot });
    const response = await engine.chatStream(
      [{ role: 'user', content: 'List all files in the workspace' }],
      { onStatus: (event) => statuses.push(event.action || event.phase) },
    );

    assert.ok(response.includes('dir  src'));
    assert.ok(statuses.includes('Listing workspace files'));
    assert.ok(statuses.includes('Awaiting user input'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineSkipsWorkspaceShortcutsWhenBrowserFolderContextIsAttached() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder() {
      return {
        ...MOCK_CHAT_RESPONSE,
        choices: [{ index: 0, message: { role: 'assistant', content: 'Browser folder summary' }, finish_reason: 'stop' }],
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot: '/tmp/gamma-browser-context-test', agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'system', content: '[Browser Folder Context]\nFolder label: art-gallery\nTree:\n- src/\n  - index.ts' },
      { role: 'user', content: 'List all files in the workspace' },
    ]);

    assert.ok(response.length > 0);
    assert.ok(chatRequests.length <= 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineModelSwitchUpdatesSession() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    engine.startSession();
    await engine.updateConfig({ model: 'deepseek-coder-v2:latest' });

    assert.strictEqual(engine.getPublicConfig().model, 'deepseek-coder-v2:latest');
    assert.strictEqual(engine.getSession()?.model, 'deepseek-coder-v2:latest');

    const runtime = await engine.getModelRuntime();
    assert.strictEqual(runtime.activeModel, 'deepseek-coder-v2:latest');
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'model_switch_completed'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineRejectsSimulatedToolTranscripts() {
  const originalFetch = globalThis.fetch;
  let chatCalls = 0;
  globalThis.fetch = createMockFetch({
    chatResponder() {
      chatCalls += 1;
      return {
        id: `mock-simulated-${chatCalls}`,
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>function<｜tool▁sep｜>create_file\n```python\nprint("fake")\n```',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Create notes.txt with hello' },
    ]);

    assert.ok(response.includes('No tools were executed'));
    assert.strictEqual(chatCalls, 2);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'tool_simulation_detected'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineInjectsSessionContinuityMemory() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-session-memory-'));

  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'session-memory-test' }), 'utf8');
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({
      workspaceRoot,
      sessionMemoryEnabled: true,
      sessionMemoryTurns: 2,
      agentProtocol: 'native_tools',
    });

    await engine.chat([
      { role: 'user', content: 'Read src/index.ts and explain how it should be documented for a teammate' },
    ]);
    await engine.chat([
      { role: 'user', content: 'Update the same repo documentation plan and keep earlier work consistent with the last turn' },
    ]);

    assert.ok(chatRequests.length >= 1);
    const latestPayload = JSON.stringify(chatRequests[chatRequests.length - 1]);
    assert.ok(latestPayload.includes('[Session Continuity]'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'session_memory_loaded'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineRequestsSelfCheckAfterWrite() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-self-check-'));

  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'self-check-test' }), 'utf8');
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder(body) {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const toolMessages = messages.filter((message: { role?: string }) => message.role === 'tool');
      const hasSelfCheckPrompt = messages.some((message: { role?: string; content?: string }) =>
        message.role === 'system' && typeof message.content === 'string' && message.content.includes('[Self Check]'),
      );
      const hasReadBack = toolMessages.some((message: { name?: string }) => message.name === 'readFile');

      if (toolMessages.length === 0) {
        return {
          id: 'mock-self-check-write',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                function: {
                  name: 'writeFile',
                  arguments: JSON.stringify({ filePath: 'notes.txt', content: 'verified content\n' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      if (hasReadBack) {
        return {
          id: 'mock-self-check-final',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'Verified after readback. notes.txt now contains the requested content.',
            },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      if (hasSelfCheckPrompt) {
        return {
          id: 'mock-self-check-read',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                function: {
                  name: 'readFile',
                  arguments: JSON.stringify({ filePath: 'notes.txt' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      return {
        id: 'mock-self-check-too-early',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Wrote the requested file.',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({
      workspaceRoot,
      selfCheckEnabled: true,
      toolRetryMax: 2,
      agentProtocol: 'native_tools',
    });
    const response = await engine.chat([
      { role: 'user', content: 'Create notes.txt with verified content and then summarize the result.' },
    ]);

    assert.ok(response.includes('Verified after readback.'));
    assert.ok(chatRequests.some((body) => JSON.stringify(body).includes('[Self Check]')));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'self_check_requested'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineContinuesTruncatedResponses() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  let requestCount = 0;

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder(body) {
      requestCount += 1;
      const hasContinuationPrompt = Array.isArray(body.messages) && body.messages.some((message: { content?: string }) =>
        typeof message.content === 'string' && message.content.includes('[Continuation]'),
      );

      if (requestCount === 1) {
        return {
          id: 'mock-truncated-1',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: 'First half of the answer ',
            },
            finish_reason: 'length',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      assert.ok(hasContinuationPrompt);
      return {
        id: 'mock-truncated-2',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'continues here.',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ agentProtocol: 'native_tools' });
    const response = await engine.chat([
      { role: 'user', content: 'Explain this harness behavior in one answer without stopping midway.' },
    ]);

    assertAgenticResponse(response, 'First half of the answer continues here.');
    assert.ok(chatRequests.length >= 2);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'response_continuation_requested'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testDirectChatCompactsConversationHistory() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine();
    const repeated = 'History block '.repeat(140);
    const longHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (let index = 0; index < 12; index += 1) {
      longHistory.push({ role: 'user', content: `User turn ${index} ${repeated}` });
      longHistory.push({ role: 'assistant', content: `Assistant turn ${index} ${repeated}` });
    }

    await engine.directChat([
      { role: 'system', content: 'Keep thread coherent.' },
      ...longHistory,
      { role: 'user', content: 'Continue same conversation with context intact.' },
    ]);

    assert.ok(chatRequests.length >= 1);
    const payload = JSON.stringify(chatRequests[0]);
    assert.ok(payload.includes('[Conversation Memory]'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'conversation_context_compacted'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineCompactsLargeToolOutputsForModel() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-tool-compact-'));
  const largeContent = Array.from({ length: 5000 }, (_, index) => `line ${index} alpha beta gamma`).join('\n');

  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'tool-compaction-test' }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'large.txt'), largeContent, 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder(body) {
      const hasToolResult = Array.isArray(body.messages) && body.messages.some((message: { role?: string }) => message.role === 'tool');
      if (!hasToolResult) {
        return {
          id: 'mock-large-tool-call',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [{
                function: {
                  name: 'readFile',
                  arguments: JSON.stringify({ filePath: 'large.txt' }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      return {
        id: 'mock-large-tool-final',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Large file inspected safely.',
          },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({
      workspaceRoot,
      model: 'qwen3.5:9b-q4_K_M',
      agentProtocol: 'native_tools',
    });
    const response = await engine.chat([
      { role: 'user', content: 'Read large.txt and summarize it for me.' },
    ]);

    assert.ok(response.includes('Large file inspected safely.'));
    const toolPayload = chatRequests.find((body) =>
      Array.isArray(body.messages) && body.messages.some((message: { role?: string }) => message.role === 'tool'),
    );
    assert.ok(toolPayload);
    const toolMessage = toolPayload.messages.find((message: { role?: string }) => message.role === 'tool');
    assert.ok(typeof toolMessage?.content === 'string');
    assert.ok(toolMessage.content.includes('[Tool readFile result]'));
    assert.ok(toolMessage.content.length < largeContent.length);
    assert.ok(toolMessage.content.includes('[readFile output truncated for model context]'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function run() {
  await testConfigDefaults();
  testPromptRecipes();
  await testPromptAnalyzerIsPassThrough();
  testWorkspacePolicy();
  testTaskOrchestratorClassifiesComplexity();
  testTaskOrchestratorPlanAndStepTransitions();
  await testModelAdapter();
  await testModelAdapterPrefersNativeOllamaChat();
  await testEngineRoutesAgenticRunsThroughThe26BModel();
  await testEnginePromptRecipeSelection();
  await testEngineUsesActionDslProtocol();
  await testEngineSanitizesDisabledSkills();
  await testEngineChatStream();
  await testEngineChatStreamEmitsToolEvents();
  await testEngineRecordsExecutionModes();
  await testEnginePrioritizesEditsWithoutAutoRepoContext();
  await testDirectChatDoesNotCreateTaskPlan();
  await testEngineCreatesTaskPlanTraceAndCheckpoint();
  await testRepoIndexerExcludesVendoredAndSessionDirs();
  await testRepoIndexerBuildsWorkspaceInventory();
  await testRepoIndexerBuildsTaskContext();
  await testEngineKeepsSimplePromptsLean();
  await testEnginePrefersNativeToolsForGemmaTargetedEdits();
  await testEngineKeepsNativeToolsWhenCapabilitiesOmitTools();
  await testEngineRecoversFromPlanningOnlyNativeReply();
  await testEngineUsesManualToolProtocolWhenAgentModelLacksNativeTools();
  await testEngineAnswersRepoOverviewFromLocalInventory();
  await testEngineAnswersRootManifestNameFromLocalInventory();
  await testEngineDoesNotShortCircuitWritePromptsThatMentionProjectMetadata();
  await testEnginePrefersNativeToolsForGemmaQuickInspect();
  await testEngineWarnsWhenThinkingUnsupported();
  await testEngineAnswersStatusOnlyQuestionsFromLocalState();
  await testEngineAnswersSimpleWorkspaceListingsWithoutModelRoundTrip();
  await testEngineChatStreamShowsStatusesForDirectWorkspaceListing();
  await testEngineSkipsWorkspaceShortcutsWhenBrowserFolderContextIsAttached();
  await testEngineModelSwitchUpdatesSession();
  await testEngineRejectsSimulatedToolTranscripts();
  await testEngineInjectsSessionContinuityMemory();
  await testEngineRequestsSelfCheckAfterWrite();
  await testEngineContinuesTruncatedResponses();
  await testDirectChatCompactsConversationHistory();
  await testEngineCompactsLargeToolOutputsForModel();
  console.log('unit tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
