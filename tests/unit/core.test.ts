import assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CoreEngine, HarnessRunLogger, PromptAnalyzer, listHarnessLogRuns, readHarnessRunLog, readHarnessRunSummary } from '@local-harness/core';
import { ModelAdapter, PROFILES, buildRuntimeSelectionConfig, type ChatMessage as AdapterChatMessage } from '@local-harness/model-adapter';
import { PromptOptimizer, RECIPES } from '@local-harness/prompt-recipes';
import { RepoIndexer } from '@local-harness/repo-indexer';
import { FileSessionStore, type SessionMetadata } from '@local-harness/session-store';
import {
  TaskOrchestrator,
  normalizeAdaptivePlanToTaskPlan,
  renderAdaptivePlanMarkdown,
  validateAdaptivePlan,
} from '@local-harness/task-orchestrator';
import { WorkspacePolicy } from '@local-harness/workspace-policy';
import { createMockFetch, MOCK_CHAT_RESPONSE, MOCK_MODEL_CAPABILITIES, MOCK_MODEL_LIST } from '../mocks/model-responses';

function assertAgentWorkResponse(response: string, expectedPrefix: string) {
  assert.ok(response.startsWith(expectedPrefix), `Expected response to start with "${expectedPrefix}" but got: ${response}`);
  assert.ok(response.includes('What I did:'), 'Expected agent run summary in response.');
  assert.ok(response.includes('Files changed:'), 'Expected changed-file summary in response.');
}

function assertLeanThinkingControl(value: unknown) {
  assert.ok(value === undefined || value === false || value === 'none' || value === 'low', `Expected lean thinking control, got: ${String(value)}`);
}

function getLatestAgentRunSummary(engine: CoreEngine) {
  return [...(engine.getSession()?.turnHistory || [])]
    .reverse()
    .find((turn) => turn.executionMode === 'agent')
    ?.runSummary;
}

async function testConfigDefaults() {
  const engine = new CoreEngine();
  const config = engine.getPublicConfig();

  assert.strictEqual(config.provider, 'ollama-legacy');
  assert.ok(config.baseUrl.includes('11434'));
  assert.strictEqual(config.model, 'gemma4:e4b-it-qat');
  assert.strictEqual(config.mode, 'chat');
  assert.strictEqual(config.profile, 'balanced');
  assert.strictEqual(config.contextBudget, 16000);
  assert.strictEqual(config.toolRetryMax, 2);
  assert.strictEqual(config.internetAccessEnabled, false);
  assert.strictEqual(config.sessionMemoryEnabled, true);
  assert.strictEqual(config.sessionMemoryTurns, 3);
  assert.strictEqual(config.selfCheckEnabled, true);
}

function testRuntimeSelectionDefaultsPreserveOllamaAnchor() {
  const keys = [
    'HARNESS_RUNTIME_PROVIDER',
    'HARNESS_PRIMARY_RUNTIME',
    'HARNESS_FALLBACK_RUNTIME',
    'HARNESS_MODEL',
    'OLLAMA_MODEL',
    'LLAMACPP_MODEL_ALIAS',
    'OLLAMA_BASE_URL',
    'LLAMACPP_BASE_URL',
  ];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    delete process.env[key];
  }

  try {
    const selection = buildRuntimeSelectionConfig();
    assert.strictEqual(selection.primary.provider, 'ollama-legacy');
    assert.strictEqual(selection.primary.baseUrl, 'http://127.0.0.1:11434/v1');
    assert.strictEqual(selection.primary.apiKey, 'ollama');
    assert.strictEqual(selection.primary.model, 'gemma4:e4b-it-qat');
    assert.strictEqual(selection.fallback?.provider, 'llamacpp');
    assert.strictEqual(selection.fallback?.baseUrl, 'http://127.0.0.1:8080/v1');
    assert.strictEqual(selection.fallback?.model, 'gemma-4-gguf');
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
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
  const policy = new WorkspacePolicy({ workspaceRoot: root, mode: 'full-agent' });
  const trustedPolicy = new WorkspacePolicy({ workspaceRoot: root, mode: 'trusted-edit' });
  const chatPolicy = new WorkspacePolicy({ workspaceRoot: root, mode: 'chat' });
  const dangerPolicy = new WorkspacePolicy({ workspaceRoot: root, mode: 'danger-sandbox' });

  assert.deepStrictEqual(policy.checkAction('read', 'src/index.ts').allowed, true);
  assert.deepStrictEqual(policy.checkAction('write', 'src/index.ts').requiresApproval, true);
  assert.deepStrictEqual(policy.checkAction('write', '/etc/passwd').allowed, false);
  assert.deepStrictEqual(policy.checkAction('write', `${root}-outside/file.ts`).allowed, false);
  assert.deepStrictEqual(policy.checkAction('read', '.env').allowed, false);
  assert.deepStrictEqual(trustedPolicy.checkAction('write', 'src/index.ts').requiresApproval, false);
  assert.deepStrictEqual(trustedPolicy.checkAction('delete', 'src/index.ts').requiresApproval, true);
  assert.deepStrictEqual(chatPolicy.checkAction('write', 'src/index.ts').allowed, false);
  assert.deepStrictEqual(dangerPolicy.checkAction('write', 'src/index.ts').allowed, true);
  assert.deepStrictEqual(dangerPolicy.checkAction('write', 'src/index.ts').requiresApproval, false);
  assert.deepStrictEqual(dangerPolicy.checkAction('write', '/etc/passwd').allowed, false);
}

async function testPlanModeDoesNotExposeEditToolsOrCheckpoints() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-plan-mode-'));
  const chatRequests: any[] = [];
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const ok = true;\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Plan only: inspect src/index.ts, patch the export, then run targeted verification after edit mode is enabled.' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'plan', model: 'gemma4:e4b' });
    const response = await engine.chat([
      { role: 'user', content: 'Edit src/index.ts and run npm test.' },
    ]);

    assert.ok(response.includes('Plan only:'));
    assert.ok(chatRequests.length >= 1);
    const toolRequest = chatRequests.find((body) => Array.isArray(body.tools) && body.tools.length > 0) || chatRequests[0];
    const exposedTools = new Set<string>((toolRequest.tools || []).map((tool: { function?: { name?: string } }) => tool.function?.name).filter(Boolean));
    for (const deniedTool of ['writeFile', 'patchFile', 'runCommand', 'createCheckpoint', 'rollbackToCheckpoint']) {
      assert.ok(!exposedTools.has(deniedTool), `${deniedTool} should not be exposed in Plan Mode`);
    }
    assert.ok(exposedTools.size === 0 || exposedTools.has('listDir') || exposedTools.has('searchText') || exposedTools.has('readFile'));
    assert.ok(!engine.getTraceLog().some((entry) => entry.type === 'task_checkpoint_saved' || entry.type === 'run_auto_checkpoint_created'));

    const write = await engine.writeFile('src/index.ts', 'export const changed = true;\n');
    assert.strictEqual(write.success, false);
    const checkpoint = await engine.createCheckpoint('plan should not checkpoint');
    assert.strictEqual(checkpoint.success, false);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testInspectModeAllowsOnlyDeterministicReadTools() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-inspect-mode-'));
  await fs.writeFile(path.join(workspaceRoot, 'file.txt'), 'hello inspect\n', 'utf8');

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'inspect' });
    const read = await engine.readFile('file.txt');
    assert.strictEqual(read.success, true);
    assert.ok(read.output.includes('hello inspect'));

    const gitStatus = await engine.gitStatus();
    assert.strictEqual(gitStatus.success, true);

    const write = await engine.writeFile('file.txt', 'blocked\n');
    assert.strictEqual(write.success, false);
    assert.ok(write.output.includes('Denied'));

    const command = await engine.runCommand('git status');
    assert.strictEqual(command.success, false);
    assert.ok(command.output.includes('Denied'));

    const checkpoint = await engine.createCheckpoint('inspect should not checkpoint');
    assert.strictEqual(checkpoint.success, false);
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testTrustedEditAllowsSafeVerificationCommandWithoutApproval() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-verify-allowlist-'));
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    scripts: {
      test: 'node -e "console.log(\'verification ok\')"',
    },
  }), 'utf8');

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'trusted-edit' });
    const result = await engine.runCommand('npm test');
    assert.strictEqual(result.success, true);
    assert.ok(result.output.includes('verification ok'));
    assert.strictEqual(result.metadata?.command?.approvalRequired, false);
    assert.strictEqual(result.metadata?.command?.status, 'executed');
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testProjectMemoryIsStructuredEditableAndSelective() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-project-memory-'));
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Memory-aware response.' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent' });
    const saved = await engine.updateProjectMemory({
      projectName: 'Memory Test',
      packageManager: 'npm',
      testCommands: ['npm test'],
      userPreferences: ['keep replies terse'],
      rules: ['do not run full build unless requested'],
    });
    assert.strictEqual(saved.projectName, 'Memory Test');
    assert.ok(saved.updatedAt >= saved.createdAt);

    await engine.chat([{ role: 'user', content: 'Fix the project test failure.' }]);
    assert.ok(chatRequests.some((body) => JSON.stringify(body.messages).includes('[Project Memory]')));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'project_memory_loaded'));

    assert.strictEqual(await engine.deleteProjectMemory(), true);
    const empty = await engine.getProjectMemory();
    assert.strictEqual(empty.projectName, undefined);
    assert.deepStrictEqual(empty.testCommands, []);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

function testTaskOrchestratorClassifiesIntent() {
  const orchestrator = new TaskOrchestrator();

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Which model is active?',
    intent: 'model_status',
  }), 'chat');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Fix apps/web/src/app/HarnessApp.tsx',
    intent: 'edit_code',
  }), 'edit_file');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Refactor the web UI into components and add a run console',
    intent: 'edit_code',
  }), 'edit_file');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Add a task orchestrator and fix complex agent execution architecture',
    intent: 'edit_code',
  }), 'edit_file');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Audit the whole codebase and find all bottlenecks',
    intent: 'read_repo',
  }), 'full_audit');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Look at the sample website and tell me what kind of project it is and if there are any bugs',
    intent: 'general_chat',
  }), 'inspect_project');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Run npm test',
    intent: 'run_command',
  }), 'run_command');

  assert.strictEqual(orchestrator.classifyComplexity({
    userRequest: 'Summarize current git diff',
    intent: 'review_diff',
  }), 'summarize_changes');
}

function testTaskOrchestratorPlanAndStepTransitions() {
  const orchestrator = new TaskOrchestrator();
  const plan = orchestrator.createPlan({
    userRequest: 'Fix apps/web/src/app/HarnessApp.tsx',
    intent: 'edit_code',
    workspaceRoot: '/repo',
  });

  assert.strictEqual(plan.intent, 'edit_file');
  assert.strictEqual(plan.sizeEstimate, 'small');
  assert.strictEqual((plan as any).complexity, undefined);
  assert.deepStrictEqual(plan.steps.map((step) => step.type), ['inspect', 'edit', 'verify', 'summarize']);
  assert.ok(plan.stopCondition.includes('minimal patch'));

  const first = orchestrator.getNextStep(plan);
  assert.ok(first);
  assert.strictEqual(first?.id, 'inspect');

  const running = orchestrator.markStepRunning(plan, first!.id);
  assert.strictEqual(running.steps[0].status, 'running');

  const done = orchestrator.markStepDone(running, first!.id, 'Read target file');
  assert.strictEqual(done.steps[0].status, 'done');
  assert.strictEqual(done.steps[0].detail, 'Read target file');
  assert.ok(done.evidence.includes('Read target file'));
  assert.strictEqual(orchestrator.getNextStep(done)?.id, 'edit');

  const revised = orchestrator.revisePlan(done, { nextAction: 'Narrow edit scope', evidence: ['Need smaller patch'] });
  assert.strictEqual(revised.nextAction, 'Narrow edit scope');
  assert.ok(revised.evidence.includes('Need smaller patch'));
  assert.ok(revised.revisedAt);

  const failed = orchestrator.markStepFailed(done, 'edit', 'Patch rejected');
  assert.strictEqual(failed.steps[1].status, 'failed');
  assert.ok(failed.failedAt);

  const blocked = orchestrator.markStepBlocked(done, 'edit', 'Approval pending');
  assert.strictEqual(blocked.steps[1].status, 'blocked');
  assert.strictEqual(orchestrator.isComplete(blocked), false);
  assert.ok(orchestrator.summarizeProgress(blocked).includes('1/4 steps done'));

  const safeIdle = orchestrator.markSafeIdle(done, 'Approval rejected');
  assert.strictEqual(safeIdle.status, 'safe_idle');
  assert.ok(safeIdle.evidence.includes('Approval rejected'));
}

function testAdaptivePlanValidationAndNormalization() {
  const workspaceRoot = '/repo';
  const validPlan = {
    id: 'plan_valid',
    task: 'Patch target component',
    summary: 'Inspect target component, apply one focused patch, verify, then report.',
    complexity: 'single_file',
    mode: 'agent',
    status: 'pending',
    workspaceRoot,
    createdAt: 1,
    updatedAt: 1,
    goals: [
      {
        id: 'G1',
        title: 'Inspect target component file',
        type: 'inspect',
        status: 'pending',
        tools: ['readFile'],
        files: ['src/App.tsx'],
        success_check: 'Target component behavior and edit location are understood.',
        budget: { maxModelCalls: 0, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 0 },
      },
      {
        id: 'G2',
        title: 'Patch target component copy',
        type: 'edit',
        status: 'pending',
        tools: ['patchFile'],
        files: ['src/App.tsx'],
        success_check: 'Focused component patch is applied without unrelated files.',
        budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 1 },
      },
      {
        id: 'G3',
        title: 'Verify component build signal',
        type: 'verify',
        status: 'pending',
        tools: ['runCommand'],
        files: [],
        success_check: 'Targeted verification command completes or failure is reported.',
        budget: { maxModelCalls: 0, maxToolCalls: 1, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
      {
        id: 'G4',
        title: 'Report final plan result',
        type: 'summarize',
        status: 'pending',
        tools: [],
        files: [],
        success_check: 'Changed files, checks, and remaining risk are summarized.',
        budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
    ],
  };

  const valid = validateAdaptivePlan(validPlan, {
    workspaceRoot,
    allowedTools: ['readFile', 'patchFile', 'runCommand'],
  });
  assert.strictEqual(valid.valid, true);
  assert.ok(valid.plan);
  const taskPlan = normalizeAdaptivePlanToTaskPlan({
    adaptivePlan: valid.plan!,
    intent: 'edit_file',
    userRequest: 'Patch src/App.tsx',
  });
  assert.strictEqual(taskPlan.steps.length, 4);
  assert.strictEqual(taskPlan.steps[1].toolsAllowed[0], 'patchFile');
  assert.ok(taskPlan.adaptivePlan);
  assert.ok(renderAdaptivePlanMarkdown(valid.plan!).includes('G2: Patch target component copy'));

  const invalid = validateAdaptivePlan({
    ...validPlan,
    id: 'plan_invalid',
    goals: [
      {
        id: 'G1',
        title: 'fix',
        type: 'inspect',
        status: 'pending',
        tools: ['patchFile', 'unknownTool'],
        files: ['/etc/passwd'],
        success_check: '',
        budget: { maxModelCalls: 0, maxToolCalls: 20, maxFilesToRead: 0, maxFilesToWrite: 5 },
      },
      {
        id: 'G1',
        title: 'Another duplicate goal',
        type: 'summarize',
        status: 'pending',
        tools: [],
        files: [],
        success_check: 'Final report exists.',
        budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
    ],
  }, {
    workspaceRoot,
    allowedTools: ['readFile'],
    maxGoalsPerPlan: 12,
  });
  assert.strictEqual(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('vague title')));
  assert.ok(invalid.errors.some((error) => error.includes('Duplicate goal id')));
  assert.ok(invalid.errors.some((error) => error.includes('unknown tool')));
  assert.ok(invalid.errors.some((error) => error.includes('outside workspace')));
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
    assert.strictEqual(runtimeBefore.provider, 'ollama-legacy');
    assert.strictEqual(runtimeBefore.activeModel, null);
    assert.strictEqual(runtimeBefore.runtimeStatus, 'idle');
    assert.ok(runtimeBefore.installedModels.includes('qwen3.5:9b-q4_K_M'));
    assert.deepStrictEqual(runtimeBefore.configuredModelCapabilities, MOCK_MODEL_CAPABILITIES['gemma4:e4b']);
    assert.strictEqual(runtimeBefore.reasoningSupported, true);
    assert.strictEqual(runtimeBefore.nativeToolCallingSupported, true);
    assert.strictEqual(runtimeBefore.lifecyclePolicy.preloadKeepAlive, '2m');
    assert.strictEqual(runtimeBefore.lifecyclePolicy.unloadKeepAlive, 0);

    const switchResult = await adapter.activateModel('qwen3.5:9b-q4_K_M', 'gemma4:e4b');
    assert.strictEqual(switchResult.activeModel, 'qwen3.5:9b-q4_K_M');
    assert.strictEqual(switchResult.supportsLifecycle, true);
    assert.deepStrictEqual(switchResult.runningModels.map((entry) => entry.model), ['qwen3.5:9b-q4_K_M']);
    assert.deepStrictEqual(switchResult.unloadedModels, []);

    const runtimeAfter = await adapter.getRuntimeState();
    assert.strictEqual(runtimeAfter.activeModel, 'qwen3.5:9b-q4_K_M');
    assert.strictEqual(runtimeAfter.runtimeStatus, 'ready');
    assert.strictEqual(runtimeAfter.lastSwitchResult?.requestedModel, 'qwen3.5:9b-q4_K_M');
    assert.strictEqual(runtimeAfter.lifecyclePolicy.chatTimeoutMs >= 180_000, true);
    assert.strictEqual(PROFILES.fast.max_tokens, 512);

    const secondSwitch = await adapter.activateModel('gemma4:e4b', 'qwen3.5:9b-q4_K_M');
    assert.deepStrictEqual(secondSwitch.unloadedModels, []);
    assert.ok(secondSwitch.runningModels.map((entry) => entry.model).includes('gemma4:e4b'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testModelAdapterLegacyOllamaLifecycle() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const adapter = new ModelAdapter({
      provider: 'ollama-legacy',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
    });
    const runtimeBefore = await adapter.getRuntimeState();
    assert.strictEqual(runtimeBefore.provider, 'ollama-legacy');
    assert.strictEqual(runtimeBefore.activeModel, null);
    assert.strictEqual(runtimeBefore.runtimeStatus, 'idle');
    assert.deepStrictEqual(runtimeBefore.configuredModelCapabilities, MOCK_MODEL_CAPABILITIES['gemma4:e4b']);
    assert.strictEqual(runtimeBefore.reasoningSupported, true);

    const switchResult = await adapter.activateModel('qwen3.5:9b-q4_K_M', 'gemma4:e4b');
    assert.strictEqual(switchResult.activeModel, 'qwen3.5:9b-q4_K_M');
    assert.deepStrictEqual(switchResult.runningModels.map((entry) => entry.model), ['qwen3.5:9b-q4_K_M']);
    assert.strictEqual(switchResult.supportsLifecycle, true);
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
    const adapter = new ModelAdapter({
      provider: 'ollama-legacy',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
    });
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

async function testModelAdapterReportsLlamaCppOffline() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('offline');
  }) as typeof fetch;

  try {
    const adapter = new ModelAdapter({
      provider: 'llamacpp',
      baseUrl: 'http://127.0.0.1:8080/v1',
    });
    const runtime = await adapter.getRuntimeState(0);
    assert.strictEqual(runtime.runtimeStatus, 'unavailable');
    assert.strictEqual(runtime.activeModel, null);
    assert.ok(runtime.statusMessage.includes('not reachable'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testModelAdapterUsesVisibleOllamaFallback() {
  const originalFetch = globalThis.fetch;
  const mockFetch = createMockFetch();
  const requests: string[] = [];

  globalThis.fetch = (async (url: any, opts?: any) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl === 'http://127.0.0.1:8080/v1/models') {
      throw new Error('llama.cpp down');
    }
    return mockFetch(requestUrl, opts);
  }) as typeof fetch;

  try {
    const adapter = new ModelAdapter({
      provider: 'llamacpp',
      baseUrl: 'http://127.0.0.1:8080/v1',
      fallbackProvider: 'ollama-legacy',
      fallbackBaseUrl: 'http://127.0.0.1:11434/v1',
      fallbackModel: 'gemma4:e4b',
      healthCheckTimeoutMs: 1000,
    });

    const runtime = await adapter.getRuntimeState(0);
    assert.strictEqual(runtime.activeProvider, 'ollama-legacy');
    assert.strictEqual(runtime.primaryRuntime.provider, 'llamacpp');
    assert.strictEqual(runtime.primaryRuntime.status, 'offline');
    assert.strictEqual(runtime.fallbackRuntime?.provider, 'ollama-legacy');
    assert.strictEqual(runtime.fallbackRuntime?.status, 'connected');
    assert.ok(runtime.fallbackWarning?.includes('Using ollama-legacy fallback'));
    assert.strictEqual(runtime.fallbackRuntime?.warning, runtime.fallbackWarning);
    assert.ok(requests.some((entry) => entry === 'http://127.0.0.1:8080/v1/models'));
    assert.ok(requests.some((entry) => entry === 'http://127.0.0.1:11434/v1/models'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testModelAdapterCapsLocalOutputTokens() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const cases: Array<[string, number]> = [
      ['gemma4:e4b', 2048],
      ['deepseek-coder-v2:latest', 2048],
      ['qwen3.5:9b-q4_K_M', 1536],
    ];

    for (const [model, expectedCap] of cases) {
      const adapter = new ModelAdapter({ model, profile: 'deep' });
      await adapter.createChatCompletion({
        messages: [{ role: 'user', content: 'write a bounded response' }],
        max_tokens: 50000,
      });
      const latestRequest = chatRequests[chatRequests.length - 1];
      assert.strictEqual(latestRequest.max_tokens ?? latestRequest.options?.num_predict, expectedCap);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEnginePromptRecipeSelection() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine({ mode: 'full-agent' });
    const response = await engine.chat([
      { role: 'user', content: 'Review this diff for regressions' },
    ]);
    assertAgentWorkResponse(response, MOCK_CHAT_RESPONSE.choices[0].message.content);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'prompt_recipe_selected'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineSanitizesDisabledSkills() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-skill-sanitize-'));
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-skill-sanitize-store-'));
  const engine = new CoreEngine({ workspaceRoot, sessionDataDir });
  const session = engine.startSession(['caveman', 'patch-surgeon', 'patch-surgeon']);
  assert.deepStrictEqual(session.skillsActive, ['patch-surgeon']);
  assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'caveman')?.status, 'filtered');
  assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'caveman')?.reason, 'disabled by harness policy');
  assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'patch-surgeon')?.status, 'available');

  const updated = await engine.updateSessionSkills(['caveman', 'repo-cartographer']);
  assert.deepStrictEqual(updated.skillsActive, ['repo-cartographer']);
  assert.strictEqual(updated.skillAudit?.records.find((entry) => entry.slug === 'repo-cartographer')?.status, 'available');

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await fs.rm(sessionDataDir, { recursive: true, force: true });
}

async function testEngineTracksSkillAudit() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-skill-audit-'));
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-skill-audit-store-'));
  const availableSkills = ['patch-surgeon', 'repo-cartographer'];
  const engine = new CoreEngine({ workspaceRoot, sessionDataDir });
  const session = engine.startSession(['caveman', 'patch-surgeon', 'ghost-skill'], availableSkills);

  assert.deepStrictEqual(session.skillsActive, ['patch-surgeon']);
  assert.deepStrictEqual(session.skillAudit?.requested, ['caveman', 'patch-surgeon', 'ghost-skill']);
  assert.deepStrictEqual(session.skillAudit?.catalog, availableSkills);
  assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'caveman')?.status, 'filtered');
  assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'ghost-skill')?.status, 'missing');
  assert.strictEqual(session.skillAudit?.records.find((entry) => entry.slug === 'ghost-skill')?.reason, 'not present in curated skill catalog');

  const resumedEngine = new CoreEngine({ workspaceRoot, sessionDataDir });
  const resumed = await resumedEngine.resumeSession(session.id, availableSkills);
  assert.deepStrictEqual(resumed?.skillsActive, ['patch-surgeon']);
  assert.strictEqual(resumed?.skillAudit?.records.find((entry) => entry.slug === 'caveman')?.status, 'filtered');
  assert.strictEqual(resumed?.skillAudit?.records.find((entry) => entry.slug === 'ghost-skill')?.status, 'missing');

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await fs.rm(sessionDataDir, { recursive: true, force: true });
}

async function testSessionCleanupPreservesActiveAndDeletesExpiredOnly() {
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-session-cleanup-'));
  const baseNow = Date.now();
  const store = new FileSessionStore(sessionDataDir);

  function session(id: string, updatedAt: number): SessionMetadata {
    return {
      id,
      createdAt: updatedAt - 1000,
      updatedAt,
      model: 'gemma4:e4b-it-qat',
      mode: 'chat',
      cwd: '/tmp/project',
      skillsActive: [],
      toolsAllowlist: [],
      turnHistory: [],
    };
  }

  await fs.writeFile(path.join(sessionDataDir, 'active.json'), JSON.stringify(session('active', baseNow - 100_000), null, 2));
  await fs.writeFile(path.join(sessionDataDir, 'stale.json'), JSON.stringify(session('stale', baseNow - 100_000), null, 2));
  await fs.writeFile(path.join(sessionDataDir, 'fresh.json'), JSON.stringify(session('fresh', baseNow - 500), null, 2));
  await fs.writeFile(path.join(sessionDataDir, 'orphan-turns.jsonl'), '{"timestamp":1}\n');

  try {
    const dryRun = await store.cleanupSessions({
      activeSessionId: 'active',
      maxAgeMs: 10_000,
      now: baseNow,
      dryRun: true,
    });
    assert.deepStrictEqual(dryRun.deletedSessions.map((entry) => entry.id), ['stale']);
    assert.ok(await store.loadSession('stale'));

    const result = await store.cleanupSessions({
      activeSessionId: 'active',
      maxAgeMs: 10_000,
      now: baseNow,
    });

    assert.deepStrictEqual(result.deletedSessions.map((entry) => entry.id), ['stale']);
    assert.ok(result.preservedSessions.some((entry) => entry.id === 'active' && entry.reason === 'active_session'));
    assert.ok(result.preservedSessions.some((entry) => entry.id === 'fresh' && entry.reason === 'not_expired'));
    assert.deepStrictEqual(result.deletedOrphanTurnSidecars, ['orphan']);
    assert.strictEqual(await store.loadSession('stale'), null);
    assert.ok(await store.loadSession('active'));
    assert.ok(await store.loadSession('fresh'));
  } finally {
    await fs.rm(sessionDataDir, { recursive: true, force: true });
  }
}

async function testHarnessRunLoggerWritesRedactedLogsAndRejectsTraversal() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-run-logs-'));
  const previousPromptMode = process.env.HARNESS_LOG_PROMPTS;
  process.env.HARNESS_LOG_PROMPTS = 'summary';

  try {
    const logger = new HarnessRunLogger({
      workspaceRoot,
      runId: 'run_unit_log',
      sessionId: 'session_unit',
      executionMode: 'agent',
      promptMode: 'implementation',
      model: 'gemma4:e4b-it-qat',
    });

    await logger.write({
      eventType: 'request_received',
      source: 'core',
      data: {
        token: 'sk-test-secret-value',
        messages: [
          { role: 'system', content: 'authorization: Bearer abcdefghijklmnopqrstuvwxyz123456' },
          { role: 'user', content: 'Please inspect src/index.ts and keep this prompt bounded.' },
        ],
      },
    });
    await logger.write({
      eventType: 'tool_call_completed',
      source: 'tool',
      data: { outputPreview: 'token=ghp_abcdefghijklmnopqrstuvwxyz123456' },
    });
    await logger.writeSummary({ status: 'done', summary: 'Logged safely.' });

    const runs = await listHarnessLogRuns(workspaceRoot);
    assert.ok(runs.some((run) => run.runId === 'run_unit_log'));

    const log = await readHarnessRunLog(workspaceRoot, 'run_unit_log');
    assert.ok(log);
    assert.ok(log?.events.some((event) => event.eventType === 'request_received'));
    const serialized = JSON.stringify(log);
    assert.ok(!serialized.includes('sk-test-secret-value'));
    assert.ok(!serialized.includes('Bearer abcdefghijklmnopqrstuvwxyz123456'));
    assert.ok(!serialized.includes('ghp_abcdefghijklmnopqrstuvwxyz123456'));
    assert.ok(serialized.includes('[REDACTED_SECRET]'));
    assert.ok(serialized.includes('contentSummary'));

    const summary = await readHarnessRunSummary(workspaceRoot, 'run_unit_log');
    assert.strictEqual(summary?.status, 'done');
    await assert.rejects(() => readHarnessRunLog(workspaceRoot, '../bad'));
  } finally {
    if (previousPromptMode === undefined) {
      delete process.env.HARNESS_LOG_PROMPTS;
    } else {
      process.env.HARNESS_LOG_PROMPTS = previousPromptMode;
    }
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
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
    const engine = new CoreEngine({ mode: 'full-agent' });
    const response = await engine.chatStream(
      [{ role: 'user', content: 'Explain what you are doing' }],
      {
        onStatus: (event) => statuses.push(event.action),
        onDelta: (chunk) => deltas.push(chunk),
      },
    );

    assertAgentWorkResponse(response, '<think>Inspecting files</think>Streamed answer');
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
      mode: 'full-agent',
      model: 'gemma4:e4b',
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
    const engine = new CoreEngine();
    await engine.recordTurnExecution('chat', { messageCount: 1, thinkingEnabled: false });

    const firstSession = engine.getSession();
    assert.strictEqual(firstSession?.turnHistory?.[0]?.executionMode, 'chat');
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'chat_turn_mode' && (entry.data as { executionMode?: string }).executionMode === 'chat'));

    await engine.chat([
      { role: 'user', content: 'Reply with exactly: PING' },
    ]);

    const modes = engine.getSession()?.turnHistory?.map((turn) => turn.executionMode) || [];
    assert.ok(modes.includes('agent'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'chat_turn_mode' && (entry.data as { executionMode?: string }).executionMode === 'agent'));
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
    const engine = new CoreEngine({ workspaceRoot });
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

async function testDirectChatStreamRetriesVisibleOnIdle() {
  const originalFetch = globalThis.fetch;
  const fallbackFetch = createMockFetch({
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [
        {
          ...MOCK_CHAT_RESPONSE.choices[0],
          message: { role: 'assistant', content: 'Recovered from stalled stream.' },
        },
      ],
    }),
  });
  let stalledStreamCalls = 0;

  globalThis.fetch = (async (url: any, opts?: any) => {
    const requestUrl = String(url);
    const body = typeof opts?.body === 'string' && opts.body.trim() ? JSON.parse(opts.body) : {};
    if (requestUrl.includes('/v1/chat/completions') && body.stream) {
      stalledStreamCalls += 1;
      const error = new Error('stream stalled') as Error & { code: string; receivedContent: boolean };
      error.code = 'stream_idle_timeout';
      error.receivedContent = false;
      return {
        ok: true,
        status: 200,
        body: new ReadableStream({
          start(controller) {
            controller.error(error);
          },
        }),
      } as any;
    }
    return fallbackFetch(requestUrl, opts);
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({
      provider: 'llamacpp',
      baseUrl: 'http://127.0.0.1:8080/v1',
      model: 'gemma-4-gguf',
      streamIdleTimeoutMs: 1,
    });
    const statuses: string[] = [];
    const deltas: string[] = [];
    const response = await engine.directChatStream(
      [{ role: 'user', content: 'Reply after a stall' }],
      {
        onStatus(event) {
          statuses.push(event.phase);
        },
        onDelta(chunk) {
          deltas.push(chunk);
        },
      },
    );

    assert.strictEqual(stalledStreamCalls, 1);
    assert.ok(response.includes('Recovered from stalled stream.'));
    assert.ok(deltas.join('').includes('Recovered from stalled stream.'));
    assert.ok(statuses.includes('model_loading'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'stream_idle_timeout_retry'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testDirectChatDoesNotInspectProjectWithoutAgentMode() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sample-vite-app-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    name: 'sample-vite-app',
    scripts: {
      dev: 'vite',
      build: 'vite build',
    },
    dependencies: {
      '@vitejs/plugin-react': '^5.0.0',
      vite: '^8.0.0',
      react: '^19.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
    },
  }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'src', 'main.tsx'), 'import React from "react";\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'vite.config.ts'), 'export default {};\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n', 'utf8');

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot });
    const response = await engine.directChat([
      { role: 'user', content: 'What kind of project is this app?' },
    ]);

    assert.ok(response.includes('This is a mocked model response for testing.'));
    assert.strictEqual(chatRequests.length, 1);
    const payload = JSON.stringify(chatRequests[0].messages || []);
    assert.ok(!payload.includes(workspaceRoot));
    assert.ok(!payload.includes('sample-vite-app'));
    assert.ok(!engine.getTraceLog().some((entry) => entry.type === 'task_plan_created'));
    const runs = await engine.listRuns();
    assert.strictEqual(runs.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
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
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b', localModelBudgetProfile: 'lean' });
    const response = await engine.chat([
      { role: 'user', content: 'Add a task orchestrator and fix complex agent execution architecture' },
    ]);

    assertAgentWorkResponse(response, 'Architecture pass scoped into visible steps.');
    assert.ok(chatRequests.length >= 1);
    const promptPayload = JSON.stringify(chatRequests[0].messages);
    assert.ok(promptPayload.includes('[Current Task Plan]'));
    assert.ok(promptPayload.includes('[Current Step]'));
    assert.ok(promptPayload.includes('[Task Relevant Context]'));
    assert.ok(promptPayload.includes('Task intent: edit_file'));
    assert.ok(promptPayload.includes('Task size: small'));

    const traceTypes = engine.getTraceLog().map((entry) => entry.type);
    const requiredOrder = [
      'intent_classified',
      'workspace_doc_inventory',
      'agent_skill_selection',
      'workspace_context_collected',
      'adaptive_plan_requested',
      'adaptive_plan_validated',
      'task_plan_created',
      'current_goal_selected',
    ];
    let previousIndex = -1;
    for (const type of requiredOrder) {
      const index = traceTypes.indexOf(type);
      assert.ok(index > previousIndex, `${type} should appear after ${requiredOrder[Math.max(0, requiredOrder.indexOf(type) - 1)]}`);
      previousIndex = index;
    }
    assert.ok(traceTypes.includes('task_step_started'));
    assert.ok(traceTypes.includes('task_step_completed'));
    assert.ok(traceTypes.includes('task_checkpoint_saved'));

    const taskPlanTrace = engine.getTraceLog().find((entry) => entry.type === 'task_plan_created');
    const tracedPlan = (taskPlanTrace?.data as { plan?: { intent?: string; sizeEstimate?: string; complexity?: string } } | undefined)?.plan;
    assert.strictEqual(tracedPlan?.intent, 'edit_file');
    assert.strictEqual(tracedPlan?.sizeEstimate, 'small');
    assert.strictEqual(tracedPlan?.complexity, undefined);

    const runFiles = await fs.readdir(path.join(workspaceRoot, '.gamma-harness', 'runs'));
    assert.ok(runFiles.some((file) => file.endsWith('.json')));
    const runs = await engine.listRuns();
    assert.ok(runs.length >= 1);
    assert.strictEqual(runs[0].taskPlan.intent, 'edit_file');
    assert.strictEqual(runs[0].taskPlan.sizeEstimate, 'small');
    assert.strictEqual((runs[0].taskPlan as any).complexity, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineCreatesAdaptivePlanArtifactsAndCanResume() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-adaptive-plan-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const value = 1;\n', 'utf8');
  const planJson = {
    id: 'plan_test_adaptive',
    task: 'Update source value safely',
    summary: 'Inspect src/index.ts, patch one value, verify with git diff, then report.',
    complexity: 'single_file',
    mode: 'agent',
    status: 'pending',
    workspaceRoot,
    createdAt: 1,
    updatedAt: 1,
    goals: [
      {
        id: 'G1',
        title: 'Inspect src index file',
        type: 'inspect',
        status: 'pending',
        tools: ['readFile'],
        files: ['src/index.ts'],
        success_check: 'The current export in src/index.ts is known before editing.',
        budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 0 },
      },
      {
        id: 'G2',
        title: 'Patch src index value',
        type: 'edit',
        status: 'pending',
        tools: ['patchFile'],
        files: ['src/index.ts'],
        success_check: 'src/index.ts changes only the requested export value.',
        budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 1 },
      },
      {
        id: 'G3',
        title: 'Verify focused git diff',
        type: 'verify',
        status: 'pending',
        tools: ['gitDiff'],
        files: [],
        success_check: 'Git diff shows the focused source value change.',
        budget: { maxModelCalls: 0, maxToolCalls: 1, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
      {
        id: 'G4',
        title: 'Report adaptive plan result',
        type: 'summarize',
        status: 'pending',
        tools: [],
        files: [],
        success_check: 'User sees changed files, checks, and remaining risk.',
        budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
    ],
  };

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder(body) {
      const payload = JSON.stringify(body.messages || []);
      if (payload.includes('[Adaptive Planning Task]')) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(planJson) }, finish_reason: 'stop' }],
        };
      }
      return {
        ...MOCK_CHAT_RESPONSE,
        choices: [{ index: 0, message: { role: 'assistant', content: 'Goal worked.' }, finish_reason: 'stop' }],
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'gemma4:e4b' });
    const response = await engine.chat([
      { role: 'user', content: 'Update src/index.ts value safely' },
    ]);
    assertAgentWorkResponse(response, 'Goal worked.');
    assert.strictEqual(chatRequests.filter((body) => JSON.stringify(body.messages || []).includes('[Adaptive Planning Task]')).length, 1);

    const runs = await engine.listRuns();
    assert.ok(runs.length >= 1);
    const checkpoint = runs[0];
    assert.strictEqual(checkpoint.activePlanId, 'plan_test_adaptive');
    assert.ok(checkpoint.taskPlan.adaptivePlan);
    assert.ok(checkpoint.taskPlan.planArtifactPaths?.json);
    assert.ok(checkpoint.taskPlan.steps.some((step) => step.status === 'pending'), 'pending goals should remain resumable');
    const planJsonOnDisk = JSON.parse(await fs.readFile(checkpoint.taskPlan.planArtifactPaths!.json, 'utf8'));
    assert.strictEqual(planJsonOnDisk.id, 'plan_test_adaptive');
    const planMd = await fs.readFile(checkpoint.taskPlan.planArtifactPaths!.markdown, 'utf8');
    assert.ok(planMd.includes('G2: Patch src index value'));

    await engine.chat([{ role: 'user', content: 'continue' }]);
    assert.strictEqual(chatRequests.filter((body) => JSON.stringify(body.messages || []).includes('[Adaptive Planning Task]')).length, 1);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'adaptive_plan_resumed'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testAdaptiveGoalBlocksDisallowedTool() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-adaptive-tool-scope-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const value = 1;\n', 'utf8');
  const planJson = {
    id: 'plan_tool_scope',
    task: 'Inspect before editing',
    summary: 'Current goal allows only readFile before later patching.',
    complexity: 'single_file',
    mode: 'agent',
    status: 'pending',
    workspaceRoot,
    createdAt: 1,
    updatedAt: 1,
    goals: [
      {
        id: 'G1',
        title: 'Inspect source before patch',
        type: 'inspect',
        status: 'pending',
        tools: ['readFile'],
        files: ['src/index.ts'],
        success_check: 'Source file is read before editing.',
        budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 0 },
      },
      {
        id: 'G2',
        title: 'Patch source after inspection',
        type: 'edit',
        status: 'pending',
        tools: ['patchFile'],
        files: ['src/index.ts'],
        success_check: 'Patch is applied only after inspection goal.',
        budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 1 },
      },
      {
        id: 'G3',
        title: 'Verify focused diff',
        type: 'verify',
        status: 'pending',
        tools: ['gitDiff'],
        files: [],
        success_check: 'Diff confirms any change is focused.',
        budget: { maxModelCalls: 0, maxToolCalls: 1, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
      {
        id: 'G4',
        title: 'Report scoped execution result',
        type: 'summarize',
        status: 'pending',
        tools: [],
        files: [],
        success_check: 'Report states whether disallowed tool use was blocked.',
        budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
      },
    ],
  };

  globalThis.fetch = createMockFetch({
    chatResponder(body) {
      const payload = JSON.stringify(body.messages || []);
      if (payload.includes('[Adaptive Planning Task]')) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(planJson) }, finish_reason: 'stop' }],
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
              id: 'call_patch_too_soon',
              type: 'function',
              function: {
                name: 'patchFile',
                arguments: JSON.stringify({ filePath: 'src/index.ts', oldContent: 'value = 1', newContent: 'value = 2' }),
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      };
    },
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'gemma4:e4b' });
    await engine.chat([{ role: 'user', content: 'Patch src/index.ts after inspection' }]);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'adaptive_goal_tool_blocked'));
    const content = await fs.readFile(path.join(workspaceRoot, 'src', 'index.ts'), 'utf8');
    assert.ok(content.includes('value = 1'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testAdaptiveGoalBlocksFileScopeAndBudget() {
  const originalFetch = globalThis.fetch;

  async function runGuardScenario(params: {
    traceType: string;
    planBudget: { maxModelCalls: number; maxToolCalls: number; maxFilesToRead: number; maxFilesToWrite: number };
    filePath: string;
  }) {
    const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-adaptive-goal-guard-'));
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const value = 1;\n', 'utf8');
    await fs.writeFile(path.join(workspaceRoot, 'src', 'other.ts'), 'export const other = true;\n', 'utf8');
    const planJson = {
      id: `plan_${params.traceType}`,
      task: 'Read scoped source file',
      summary: 'The current goal may read only src/index.ts within its declared budget.',
      complexity: 'single_file',
      mode: 'agent',
      status: 'pending',
      workspaceRoot,
      createdAt: 1,
      updatedAt: 1,
      goals: [
        {
          id: 'G1',
          title: 'Inspect scoped source file',
          type: 'inspect',
          status: 'pending',
          tools: ['readFile'],
          files: ['src/index.ts'],
          success_check: 'Only src/index.ts is read for this goal.',
          budget: params.planBudget,
        },
        {
          id: 'G2',
          title: 'Report scoped guard result',
          type: 'summarize',
          status: 'pending',
          tools: [],
          files: [],
          success_check: 'The final report states whether guardrails blocked execution.',
          budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
        },
      ],
    };

    globalThis.fetch = createMockFetch({
      chatResponder(body) {
        const payload = JSON.stringify(body.messages || []);
        if (payload.includes('[Adaptive Planning Task]')) {
          return {
            ...MOCK_CHAT_RESPONSE,
            choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(planJson) }, finish_reason: 'stop' }],
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
                id: 'call_read_guard',
                type: 'function',
                function: {
                  name: 'readFile',
                  arguments: JSON.stringify({ filePath: params.filePath }),
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        };
      },
    }) as typeof fetch;

    try {
      const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'gemma4:e4b' });
      await engine.chat([{ role: 'user', content: 'Patch src/index.ts after scoped inspection' }]);
      assert.ok(engine.getTraceLog().some((entry) => entry.type === params.traceType));
    } finally {
      await fs.rm(workspaceRoot, { recursive: true, force: true });
    }
  }

  try {
    await runGuardScenario({
      traceType: 'adaptive_goal_file_scope_blocked',
      planBudget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 0 },
      filePath: 'src/other.ts',
    });
    await runGuardScenario({
      traceType: 'adaptive_goal_budget_blocked',
      planBudget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 1, maxFilesToWrite: 0 },
      filePath: 'src/index.ts',
    });
  } finally {
    globalThis.fetch = originalFetch;
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
  assert.deepStrictEqual(inventory.references, []);
  assert.ok(!inventory.topLevelAreas.includes('base_repos'));
  assert.ok(!inventory.topLevelAreas.includes('third_party'));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testDeterministicToolsBoundLargeAndBinaryFiles() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-tool-bounds-'));
  const largeText = `${'x'.repeat(300_000)}\nend\n`;
  await fs.writeFile(path.join(workspaceRoot, 'large.txt'), largeText, 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'binary.bin'), Buffer.from([0, 1, 2, 3, 4, 5, 0, 8]));

  try {
    const engine = new CoreEngine({ workspaceRoot });
    const large = await engine.readFile('large.txt');
    assert.strictEqual(large.success, true);
    assert.ok(large.output.includes('file truncated'));
    assert.strictEqual(large.metadata?.truncated, true);
    assert.ok(typeof large.metadata?.durationMs === 'number');

    const binary = await engine.readFile('binary.bin');
    assert.strictEqual(binary.success, false);
    assert.ok(binary.output.includes('Binary file not rendered as text'));
    assert.strictEqual(binary.metadata?.truncated, true);
    assert.ok(typeof binary.metadata?.durationMs === 'number');
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testDeterministicToolsIgnoreHeavyAndReferenceDirs() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-tool-ignore-'));
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'node_modules', 'demo'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'third_party', 'demo'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'base_repos', 'demo'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export const kept = "needle";\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'node_modules', 'demo', 'ignored.ts'), 'needle\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'third_party', 'demo', 'ignored.ts'), 'needle\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'base_repos', 'demo', 'ignored.ts'), 'needle\n', 'utf8');

  try {
    const engine = new CoreEngine({ workspaceRoot });
    const listing = await engine.listDir('.');
    assert.strictEqual(listing.success, true);
    assert.ok(listing.output.includes('dir  src'));
    assert.ok(!listing.output.includes('node_modules'));
    assert.ok(!listing.output.includes('third_party'));
    assert.ok(!listing.output.includes('base_repos'));
    assert.ok(typeof listing.metadata?.durationMs === 'number');

    const search = await engine.searchText('needle');
    assert.strictEqual(search.success, true);
    assert.ok(search.output.includes('src/index.ts'));
    assert.ok(!search.output.includes('node_modules'));
    assert.ok(!search.output.includes('third_party'));
    assert.ok(!search.output.includes('base_repos'));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRepoIndexerInspectsGenericExpressProject() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sample-express-app-'));
  await fs.mkdir(path.join(workspaceRoot, 'views'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'public'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({
    name: 'sample-express-app',
    scripts: {
      start: 'node server.js',
      test: 'node --test',
    },
    dependencies: {
      express: '^5.0.0',
      ejs: '^3.1.0',
    },
  }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'server.js'), 'import express from "express";\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'views', 'index.ejs'), '<main>ok</main>\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'public', 'app.css'), 'body {}\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'package-lock.json'), '{}\n', 'utf8');

  try {
    const indexer = new RepoIndexer(workspaceRoot);
    const inspection = await indexer.inspectProject();
    assert.strictEqual(inspection.projectName, 'sample-express-app');
    assert.strictEqual(inspection.likelyProjectType, 'Express server-rendered web app');
    assert.ok(inspection.frameworkSignals.includes('Express'));
    assert.ok(inspection.frameworkSignals.includes('EJS'));
    assert.ok(inspection.mainEntryPoints.includes('server.js'));
    assert.ok(inspection.staticDirectories.includes('public/'));
    assert.strictEqual(inspection.packageManager, 'npm');
    assert.ok(inspection.howToRun.includes('npm run start'));
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testRepoIndexerBuildsTaskContext() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-task-context-'));
  await fs.mkdir(path.join(workspaceRoot, 'apps', 'web', 'src', 'app'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'core', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'packages', 'planner', 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'tests', 'unit'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'apps', 'web', 'src', 'app', 'HarnessApp.tsx'), 'export default function App() { return null; }\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'apps', 'web', 'src', 'index.css'), ':root {}\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'core', 'src', 'engine.ts'), 'export const engine = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'packages', 'planner', 'src', 'planner.ts'), 'export const planner = true;\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'tests', 'unit', 'core.test.ts'), 'export {};\n', 'utf8');

  try {
    const indexer = new RepoIndexer(workspaceRoot);
    const webContext = await indexer.buildTaskContext({
      userRequest: 'Redesign the messy web UI and add a right run console',
      intent: 'edit_code',
      taskIntent: 'edit_file',
      sizeEstimate: 'medium',
    });
    assert.strictEqual(webContext.taskArea, 'web_ui');
    assert.ok(webContext.relevantFiles.includes('apps/web/src/app/HarnessApp.tsx'));
    assert.ok(webContext.relevantFiles.includes('apps/web/src/index.css'));

    const architectureContext = await indexer.buildTaskContext({
      userRequest: 'Add task orchestration to the agent loop architecture',
      intent: 'edit_code',
      taskIntent: 'edit_file',
      sizeEstimate: 'medium',
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
    const engine = new CoreEngine();
    const response = await engine.chat([
      { role: 'user', content: 'Reply with exactly: PING' },
    ]);

    assertAgentWorkResponse(response, MOCK_CHAT_RESPONSE.choices[0].message.content);
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
    const engine = new CoreEngine({ mode: 'full-agent' });
    const response = await engine.chat([
      { role: 'user', content: 'Fix src/index.ts so it exports a default value' },
    ]);

    assertAgentWorkResponse(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 1);
    const toolRequest = chatRequests.find((body) => Array.isArray(body.tools) && body.tools.length > 0);
    assert.ok(toolRequest);
    assert.ok(!JSON.stringify(toolRequest.messages).includes('Use this lightweight JSON tool protocol'));
    assertLeanThinkingControl(toolRequest.think ?? toolRequest.reasoning_effort);
    assert.strictEqual(toolRequest.options?.num_predict ?? toolRequest.max_tokens, 128);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'agent_direct_answer_repaired'));
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
    const engine = new CoreEngine({
      provider: 'ollama-legacy',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
      model: 'gemma4:e4b',
      mode: 'full-agent',
    });
    const response = await engine.chat([
      { role: 'user', content: 'Fix src/index.ts so it exports a default value' },
    ]);

    assertAgentWorkResponse(response, 'Native tool trial stayed active.');
    assert.ok(chatRequests.length >= 1);
    const toolRequest = chatRequests.find((body) => Array.isArray(body.tools) && body.tools.length > 0);
    assert.ok(toolRequest);
    assert.ok(!JSON.stringify(toolRequest.messages).includes('Use exactly one JSON tool action at a time.'));
    assert.ok(!engine.getTraceLog().some((entry) => entry.type === 'manual_tool_fallback'));
    const runSummary = getLatestAgentRunSummary(engine);
    assert.strictEqual(runSummary?.toolProtocol, 'native');
    assert.ok(runSummary?.fallbackPath === 'native_tools' || runSummary?.fallbackPath === 'native_retry');
    assert.strictEqual(runSummary?.usedManualFallback, false);
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
      const payload = JSON.stringify(body.messages || []);
      if (payload.includes('[Adaptive Planning Task]')) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({
            id: 'plan_read_index',
            task: 'Read source index export',
            summary: 'Read src/index.ts and report the exported value.',
            complexity: 'single_file',
            mode: 'agent',
            status: 'pending',
            workspaceRoot,
            createdAt: 1,
            updatedAt: 1,
            goals: [
              {
                id: 'G1',
                title: 'Read source index file',
                type: 'inspect',
                status: 'pending',
                tools: ['readFile'],
                files: ['src/index.ts'],
                success_check: 'src/index.ts is read and export statement is known.',
                budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 0 },
              },
              {
                id: 'G2',
                title: 'Report source export',
                type: 'summarize',
                status: 'pending',
                tools: [],
                files: [],
                success_check: 'The export found in src/index.ts is summarized.',
                budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
              },
            ],
          }) }, finish_reason: 'stop' }],
        };
      }
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
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'gemma4:e4b' });
    const response = await engine.chat([
      { role: 'user', content: 'Read src/index.ts and tell me what it exports.' },
    ]);

    assertAgentWorkResponse(response, 'Recovered after tool call.');
    assert.ok(chatRequests.length >= 2);
    assert.ok(chatRequests.some((body) => Array.isArray(body.tools) && body.tools.length > 0));
    assert.ok(chatRequests.some((body) => JSON.stringify(body.messages).includes('Planning-only text is not enough.')));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'native_tool_retry_requested'));
    const runSummary = getLatestAgentRunSummary(engine);
    assert.strictEqual(runSummary?.toolProtocol, 'native');
    assert.strictEqual(runSummary?.fallbackPath, 'native_retry');
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineUsesManualToolProtocolWhenModelLacksNativeTools() {
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
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'deepseek-coder-v2:latest' });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect src/index.ts and answer with its content' },
    ]);

    assertAgentWorkResponse(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 2);
    const manualRequest = chatRequests.find((body) =>
      JSON.stringify(body.messages || []).includes('Use exactly one JSON tool action at a time.'),
    );
    assert.ok(manualRequest);
    assert.strictEqual(manualRequest.tools, undefined);
    assert.ok(
      JSON.stringify(manualRequest.messages).includes('Use exactly one JSON tool action at a time.'),
    );
    assertLeanThinkingControl(manualRequest.think ?? manualRequest.reasoning_effort);
    const runSummary = getLatestAgentRunSummary(engine);
    assert.strictEqual(runSummary?.toolProtocol, 'manual');
    assert.strictEqual(runSummary?.fallbackPath, 'manual_fallback');
    assert.ok(runSummary?.usedManualFallback);
    assert.ok((runSummary?.fallbackReason || '').includes('native tools'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'manual_tool_fallback'));
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
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'agent_direct_answer_allowed' && (entry.data as { source?: string }).source === 'local_inventory'));
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

    assertAgentWorkResponse(response, 'gamma4-local-harness');
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
    name: 'sample-express-app',
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
      choices: [{ index: 0, message: { role: 'assistant', content: 'AGENT_PROBE.md' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'gemma4:e4b' });
    const response = await engine.chat([
      {
        role: 'user',
        content: 'Create AGENT_PROBE.md in this workspace with exactly three bullets: project name, start command, main server file. Then reply with the file path only.',
      },
    ]);

    assertAgentWorkResponse(response, 'AGENT_PROBE.md');
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
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent', model: 'gemma4:e4b' });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect src/index.ts and answer with its content' },
    ]);

    assertAgentWorkResponse(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 1);
    const toolRequest = chatRequests.find((body) => Array.isArray(body.tools) && body.tools.length > 0);
    assert.ok(toolRequest);
    assert.ok(!JSON.stringify(toolRequest.messages).includes('Use this lightweight JSON tool protocol'));
    assertLeanThinkingControl(toolRequest.think ?? toolRequest.reasoning_effort);
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
    const engine = new CoreEngine({
      provider: 'ollama-legacy',
      baseUrl: 'http://127.0.0.1:11434/v1',
      apiKey: 'ollama',
      model: 'gemma4:e4b',
    });
    const response = await engine.chat([
      { role: 'user', content: 'Explain the plan briefly' },
    ], { think: true });

    assertAgentWorkResponse(response, 'Thinking unavailable response');
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

    assertAgentWorkResponse(response, '/tmp/gamma-status-test');
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
    const engine = new CoreEngine({ workspaceRoot: '/tmp/gamma-browser-context-test' });
    const response = await engine.chat([
      { role: 'system', content: '[Browser Folder Context]\nFolder label: sample-express-app\nTree:\n- src/\n  - index.ts' },
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
    const engine = new CoreEngine();
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
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-simulated-tool-'));
  let chatCalls = 0;
  globalThis.fetch = createMockFetch({
    chatResponder(body) {
      const payload = JSON.stringify(body.messages || []);
      if (payload.includes('[Adaptive Planning Task]')) {
        chatCalls += 1;
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({
            id: 'plan_simulated_tool',
            task: 'Create notes file',
            summary: 'Create notes.txt, verify diff, then report.',
            complexity: 'single_file',
            mode: 'agent',
            status: 'pending',
            workspaceRoot,
            createdAt: 1,
            updatedAt: 1,
            goals: [
              {
                id: 'G1',
                title: 'Create notes text file',
                type: 'edit',
                status: 'pending',
                tools: ['writeFile'],
                files: ['notes.txt'],
                success_check: 'notes.txt is created with requested hello content.',
                budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 0, maxFilesToWrite: 1 },
              },
              {
                id: 'G2',
                title: 'Verify notes diff',
                type: 'verify',
                status: 'pending',
                tools: ['gitDiff'],
                files: [],
                success_check: 'Git diff or equivalent evidence shows notes.txt only.',
                budget: { maxModelCalls: 0, maxToolCalls: 1, maxFilesToRead: 0, maxFilesToWrite: 0 },
              },
              {
                id: 'G3',
                title: 'Report notes creation result',
                type: 'summarize',
                status: 'pending',
                tools: [],
                files: [],
                success_check: 'Report states no fake tool transcript was trusted.',
                budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
              },
            ],
          }) }, finish_reason: 'stop' }],
        };
      }
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
    const engine = new CoreEngine({ workspaceRoot, mode: 'full-agent' });
    const response = await engine.chat([
      { role: 'user', content: 'Create notes.txt with hello' },
    ]);

    assert.ok(response.includes('No tools were executed'));
    assert.ok(chatCalls >= 3);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'tool_simulation_detected'));
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'agent_direct_answer_repaired'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
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
      const payload = JSON.stringify(messages);
      if (payload.includes('[Adaptive Planning Task]')) {
        return {
          ...MOCK_CHAT_RESPONSE,
          choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify({
            id: 'plan_self_check',
            task: 'Create verified notes file',
            summary: 'Write notes.txt, read it back for verification, then report.',
            complexity: 'single_file',
            mode: 'agent',
            status: 'pending',
            workspaceRoot,
            createdAt: 1,
            updatedAt: 1,
            goals: [
              {
                id: 'G1',
                title: 'Write verified notes file',
                type: 'edit',
                status: 'pending',
                tools: ['writeFile'],
                files: ['notes.txt'],
                success_check: 'notes.txt is written with verified content.',
                budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 0, maxFilesToWrite: 1 },
              },
              {
                id: 'G2',
                title: 'Verify notes readback',
                type: 'verify',
                status: 'pending',
                tools: ['readFile'],
                files: ['notes.txt'],
                success_check: 'notes.txt is read back and contains verified content.',
                budget: { maxModelCalls: 1, maxToolCalls: 1, maxFilesToRead: 1, maxFilesToWrite: 0 },
              },
              {
                id: 'G3',
                title: 'Report verified notes result',
                type: 'summarize',
                status: 'pending',
                tools: [],
                files: [],
                success_check: 'Report confirms file content was verified.',
                budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0 },
              },
            ],
          }) }, finish_reason: 'stop' }],
        };
      }
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
      mode: 'full-agent',
      selfCheckEnabled: true,
      toolRetryMax: 2,
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
    const engine = new CoreEngine();
    const response = await engine.chat([
      { role: 'user', content: 'Explain this harness behavior in one answer without stopping midway.' },
    ]);

    assertAgentWorkResponse(response, 'First half of the answer continues here.');
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
      model: 'gemma4:e4b',
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

async function testEngineSelectsInternetToolsOnlyForExplicitWebIntent() {
  const originalFetch = globalThis.fetch;
  const chatRequests: any[] = [];

  globalThis.fetch = createMockFetch({
    onChatRequest(body) {
      chatRequests.push(body);
    },
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Tool selection inspected.' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ internetAccessEnabled: true });
    await engine.agentWork([
      { role: 'user', content: 'Find TODO text in src/index.ts.' },
    ]);
    await engine.agentWork([
      { role: 'user', content: 'Look up the latest TypeScript release notes online.' },
    ]);
    await engine.agentWork([
      { role: 'user', content: 'Look up the latest TypeScript release notes online.' },
    ], { advancedTools: true });

    assert.ok(chatRequests.length >= 3);
    const localToolNames = (chatRequests[0].tools || []).map((tool: { function?: { name?: string } }) => tool.function?.name);
    const defaultWebToolNames = (chatRequests[1].tools || []).map((tool: { function?: { name?: string } }) => tool.function?.name);
    const advancedWebToolNames = (chatRequests[2].tools || []).map((tool: { function?: { name?: string } }) => tool.function?.name);
    assert.ok(localToolNames.includes('searchText'));
    assert.ok(!localToolNames.includes('webSearch'));
    assert.ok(!defaultWebToolNames.includes('webSearch'));
    assert.ok(advancedWebToolNames.includes('webSearch'));
    assert.ok(!advancedWebToolNames.includes('fetchUrl'));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineGatesAdvancedToolProfile() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-advanced-tools-'));

  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'advanced-tools-test' }), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'src', 'index.ts'), 'export function run() { return true; }\n', 'utf8');

  globalThis.fetch = createMockFetch({
    chatResponder: () => ({
      ...MOCK_CHAT_RESPONSE,
      choices: [{ index: 0, message: { role: 'assistant', content: 'Tool profile inspected.' }, finish_reason: 'stop' }],
    }),
  }) as typeof fetch;

  try {
    const engine = new CoreEngine({ workspaceRoot, internetAccessEnabled: true });
    const getLatestToolPlan = () =>
      [...engine.getTraceLog()]
        .reverse()
        .find((entry) => entry.type === 'chat_execution_plan')?.data as { toolNames?: string[]; toolProfile?: string; advancedToolsEnabled?: boolean } | undefined;

    await engine.agentWork([
      { role: 'user', content: 'Fix src/index.ts and inspect symbol references before patching.' },
    ]);
    const basicPlan = getLatestToolPlan();
    assert.strictEqual(basicPlan?.toolProfile, 'basic');
    assert.strictEqual(basicPlan?.advancedToolsEnabled, false);
    assert.ok(basicPlan?.toolNames?.includes('readFile'));
    assert.ok(basicPlan?.toolNames?.includes('patchFile'));
    assert.ok(!basicPlan?.toolNames?.includes('findSymbol'));
    assert.ok(!basicPlan?.toolNames?.includes('createCheckpoint'));
    assert.ok(!basicPlan?.toolNames?.includes('webSearch'));

    await engine.agentWork([
      { role: 'user', content: 'Fix src/index.ts and inspect symbol references before patching.' },
    ], { advancedTools: true });
    const advancedPlan = getLatestToolPlan();
    assert.strictEqual(advancedPlan?.toolProfile, 'advanced');
    assert.strictEqual(advancedPlan?.advancedToolsEnabled, true);
    assert.ok(advancedPlan?.toolNames?.includes('findSymbol'));
    assert.ok(advancedPlan?.toolNames?.includes('findFunction'));
    assert.ok(advancedPlan?.toolNames?.includes('createCheckpoint'));
    assert.ok(advancedPlan?.toolNames?.includes('getStructuredDiff'));
    assert.ok(advancedPlan?.toolNames?.includes('selectTestsForChangedFiles'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEngineRecordsDeniedCommandEventContract() {
  const originalFetch = globalThis.fetch;
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-command-contract-'));
  const streamedTraces: Array<{ type: string; data: any }> = [];

  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'command-contract-test' }), 'utf8');

  globalThis.fetch = createMockFetch({
    chatResponder(body) {
      if (body.messages?.some((message: { role?: string }) => message.role === 'tool')) {
        return {
          id: 'mock-command-final',
          object: 'chat.completion',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Unsafe command was blocked and reported.' },
            finish_reason: 'stop',
          }],
          usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 },
        };
      }

      return {
        id: 'mock-command-tool-call',
        object: 'chat.completion',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{
              function: {
                name: 'runCommand',
                arguments: JSON.stringify({ command: 'npm test && rm -rf .' }),
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
    const engine = new CoreEngine({ workspaceRoot });
    const response = await engine.chatStream(
      [{ role: 'user', content: 'Run npm test and report command safety.' }],
      {
        onTrace: (event) => streamedTraces.push({ type: event.type, data: event.data }),
      },
    );

    assert.ok(response.includes('Unsafe command was blocked and reported.'));
    const policyTrace = engine.getTraceLog().find((entry) => entry.type === 'command_policy_checked');
    assert.ok(policyTrace);
    assert.deepStrictEqual(
      Object.keys(policyTrace?.data as Record<string, unknown>).sort(),
      ['allowed', 'approvalRequired', 'command', 'policyMode', 'reason', 'shellOperatorsAllowed', 'status', 'workspaceRoot'].sort(),
    );
    assert.strictEqual((policyTrace?.data as { command?: string }).command, 'npm test && rm -rf .');
    assert.strictEqual((policyTrace?.data as { status?: string }).status, 'denied');
    assert.ok(streamedTraces.some((entry) => entry.type === 'command_policy_checked'));

    const runSummary = getLatestAgentRunSummary(engine);
    assert.strictEqual(runSummary?.commandsRun.length, 1);
    assert.strictEqual(runSummary?.commandsRun[0], 'npm test && rm -rf .');
    assert.strictEqual(runSummary?.outcome, 'blocked');
    assert.ok(runSummary?.summary?.includes('attempted 1 command'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function run() {
  await testConfigDefaults();
  testRuntimeSelectionDefaultsPreserveOllamaAnchor();
  testPromptRecipes();
  await testPromptAnalyzerIsPassThrough();
  testWorkspacePolicy();
  await testPlanModeDoesNotExposeEditToolsOrCheckpoints();
  await testInspectModeAllowsOnlyDeterministicReadTools();
  await testTrustedEditAllowsSafeVerificationCommandWithoutApproval();
  await testProjectMemoryIsStructuredEditableAndSelective();
  testTaskOrchestratorClassifiesIntent();
  testTaskOrchestratorPlanAndStepTransitions();
  testAdaptivePlanValidationAndNormalization();
  await testModelAdapter();
  await testModelAdapterLegacyOllamaLifecycle();
  await testModelAdapterPrefersNativeOllamaChat();
  await testModelAdapterReportsLlamaCppOffline();
  await testModelAdapterUsesVisibleOllamaFallback();
  await testModelAdapterCapsLocalOutputTokens();
  await testEnginePromptRecipeSelection();
  await testEngineSanitizesDisabledSkills();
  await testEngineTracksSkillAudit();
  await testSessionCleanupPreservesActiveAndDeletesExpiredOnly();
  await testHarnessRunLoggerWritesRedactedLogsAndRejectsTraversal();
  await testEngineChatStream();
  await testEngineChatStreamEmitsToolEvents();
  await testEngineRecordsExecutionModes();
  await testEnginePrioritizesEditsWithoutAutoRepoContext();
  await testDirectChatDoesNotCreateTaskPlan();
  await testDirectChatDoesNotInspectProjectWithoutAgentMode();
  await testDirectChatStreamRetriesVisibleOnIdle();
  await testEngineCreatesTaskPlanTraceAndCheckpoint();
  await testEngineCreatesAdaptivePlanArtifactsAndCanResume();
  await testAdaptiveGoalBlocksDisallowedTool();
  await testAdaptiveGoalBlocksFileScopeAndBudget();
  await testRepoIndexerExcludesVendoredAndSessionDirs();
  await testRepoIndexerBuildsWorkspaceInventory();
  await testDeterministicToolsBoundLargeAndBinaryFiles();
  await testDeterministicToolsIgnoreHeavyAndReferenceDirs();
  await testRepoIndexerInspectsGenericExpressProject();
  await testRepoIndexerBuildsTaskContext();
  await testEngineKeepsSimplePromptsLean();
  await testEnginePrefersNativeToolsForGemmaTargetedEdits();
  await testEngineKeepsNativeToolsWhenCapabilitiesOmitTools();
  await testEngineRecoversFromPlanningOnlyNativeReply();
  await testEngineUsesManualToolProtocolWhenModelLacksNativeTools();
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
  await testEngineSelectsInternetToolsOnlyForExplicitWebIntent();
  await testEngineGatesAdvancedToolProfile();
  await testEngineRecordsDeniedCommandEventContract();
  console.log('unit tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
