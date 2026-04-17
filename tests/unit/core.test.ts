import assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { CoreEngine, PromptAnalyzer } from '@local-harness/core';
import { ModelAdapter, PROFILES, type ChatMessage as AdapterChatMessage } from '@local-harness/model-adapter';
import { PromptOptimizer, RECIPES } from '@local-harness/prompt-recipes';
import { RepoIndexer } from '@local-harness/repo-indexer';
import { WorkspacePolicy } from '@local-harness/workspace-policy';
import { createMockFetch, MOCK_CHAT_RESPONSE, MOCK_MODEL_CAPABILITIES, MOCK_MODEL_LIST } from '../mocks/model-responses';

async function testConfigDefaults() {
  const engine = new CoreEngine();
  const config = engine.getPublicConfig();

  assert.ok(config.baseUrl.includes('11434'));
  assert.strictEqual(config.model, 'gemma4:e4b');
  assert.strictEqual(config.mode, 'workspace-write');
  assert.strictEqual(config.profile, 'fast');
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

  assert.deepStrictEqual(policy.checkAction('read', 'src/index.ts').allowed, true);
  assert.deepStrictEqual(policy.checkAction('write', 'src/index.ts').requiresApproval, true);
  assert.deepStrictEqual(policy.checkAction('write', '/etc/passwd').allowed, false);
  assert.deepStrictEqual(policy.checkAction('write', `${root}-outside/file.ts`).allowed, false);
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

async function testEnginePromptRecipeSelection() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine();
    const response = await engine.chat([
      { role: 'user', content: 'Review this diff for regressions' },
    ]);
    assert.strictEqual(response, MOCK_CHAT_RESPONSE.choices[0].message.content);
    assert.ok(engine.getTraceLog().some((entry) => entry.type === 'prompt_recipe_selected'));
  } finally {
    globalThis.fetch = originalFetch;
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
    const engine = new CoreEngine();
    const response = await engine.chatStream(
      [{ role: 'user', content: 'Explain what you are doing' }],
      {
        onStatus: (event) => statuses.push(event.action),
        onDelta: (chunk) => deltas.push(chunk),
      },
    );

    assert.strictEqual(response, '<think>Inspecting files</think>Streamed answer');
    assert.ok(deltas.join('').includes(response));
    assert.ok(statuses.some((entry) => entry.includes('Generating assistant response')));
    assert.ok(statuses.some((entry) => entry.includes('Awaiting user input')));
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEngineRecordsExecutionModes() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch() as typeof fetch;

  try {
    const engine = new CoreEngine();
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
    const engine = new CoreEngine({ workspaceRoot });
    await engine.chat([
      { role: 'user', content: 'Create a README that explains this repo' },
    ]);

    assert.ok(chatRequests.length >= 1);
    const payload = JSON.stringify(chatRequests[0]);
    assert.ok(payload.includes('[Workspace Context]'));
    assert.ok(payload.includes(workspaceRoot));
    assert.ok(!payload.includes('[Repo Context Summary]'));
    assert.ok(
      payload.includes('Inspect only the minimum files needed before editing') ||
      payload.includes('Inspect the target files before editing'),
    );

    const recipeTrace = engine.getTraceLog().find((entry) => entry.type === 'prompt_recipe_selected');
    assert.strictEqual((recipeTrace?.data as { mode?: string } | undefined)?.mode, 'targeted_edit');
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

    assert.strictEqual(response, MOCK_CHAT_RESPONSE.choices[0].message.content);
    assert.ok(chatRequests.length >= 1);
    const payload = JSON.stringify(chatRequests[0]);
    assert.ok(!payload.includes('[Repo Context Summary]'));
    assert.strictEqual(chatRequests[0].tools, undefined);
    assert.strictEqual(chatRequests[0].options?.num_predict ?? chatRequests[0].max_tokens, 128);
    assert.strictEqual(chatRequests[0].think ?? chatRequests[0].reasoning_effort, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testEnginePrefersManualToolsForGemmaTargetedEdits() {
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
    const engine = new CoreEngine();
    const response = await engine.chat([
      { role: 'user', content: 'Fix src/index.ts so it exports a default value' },
    ]);

    assert.strictEqual(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 1);
    assert.strictEqual(chatRequests[0].tools, undefined);
    assert.ok(JSON.stringify(chatRequests[0].messages).includes('Use this lightweight JSON tool protocol'));
    assert.strictEqual(chatRequests[0].think ?? chatRequests[0].reasoning_effort, false);
    assert.strictEqual(chatRequests[0].options?.num_predict ?? chatRequests[0].max_tokens, 128);
  } finally {
    globalThis.fetch = originalFetch;
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
    const engine = new CoreEngine({ workspaceRoot, model: 'deepseek-coder-v2:latest' });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect src/index.ts and answer with its content' },
    ]);

    assert.strictEqual(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 2);
    assert.strictEqual(chatRequests[0].tools, undefined);
    assert.ok(JSON.stringify(chatRequests[0].messages).includes('Use this lightweight JSON tool protocol'));
    assert.strictEqual(chatRequests[0].think ?? chatRequests[0].reasoning_effort, false);
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

    assert.strictEqual(response, 'gamma4-local-harness');
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
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b' });
    const response = await engine.chat([
      {
        role: 'user',
        content: 'Create AGENTIC_PROBE.md in this workspace with exactly three bullets: project name, start command, main server file. Then reply with the file path only.',
      },
    ]);

    assert.strictEqual(response, 'AGENTIC_PROBE.md');
    assert.ok(chatRequests.length >= 1);
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
}

async function testEnginePrefersManualToolsForGemmaQuickInspect() {
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
    const engine = new CoreEngine({ workspaceRoot, model: 'gemma4:e4b' });
    const response = await engine.chat([
      { role: 'user', content: 'Inspect src/index.ts and answer with its content' },
    ]);

    assert.strictEqual(response, 'export const ok = true;');
    assert.ok(chatRequests.length >= 1);
    assert.strictEqual(chatRequests[0].tools, undefined);
    assert.ok(JSON.stringify(chatRequests[0].messages).includes('Use this lightweight JSON tool protocol'));
    assert.strictEqual(chatRequests[0].think ?? chatRequests[0].reasoning_effort, false);
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
    const engine = new CoreEngine({ model: 'gemma4:e4b' });
    const response = await engine.chat([
      { role: 'user', content: 'Explain the plan briefly' },
    ], { think: true });

    assert.strictEqual(response, 'Thinking unavailable response');
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

    assert.strictEqual(response, '/tmp/gamma-status-test');
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
      { role: 'system', content: '[Browser Folder Context]\nFolder label: art-gallery\nTree:\n- src/\n  - index.ts' },
      { role: 'user', content: 'List all files in the workspace' },
    ]);

    assert.strictEqual(response, 'Browser folder summary');
    assert.strictEqual(chatRequests.length, 1);
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
    const engine = new CoreEngine();
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

async function run() {
  await testConfigDefaults();
  testPromptRecipes();
  await testPromptAnalyzerIsPassThrough();
  testWorkspacePolicy();
  await testModelAdapter();
  await testModelAdapterPrefersNativeOllamaChat();
  await testEnginePromptRecipeSelection();
  await testEngineChatStream();
  await testEngineRecordsExecutionModes();
  await testEnginePrioritizesEditsWithoutAutoRepoContext();
  await testRepoIndexerExcludesVendoredAndSessionDirs();
  await testRepoIndexerBuildsWorkspaceInventory();
  await testEngineKeepsSimplePromptsLean();
  await testEnginePrefersManualToolsForGemmaTargetedEdits();
  await testEngineUsesManualToolProtocolWhenModelLacksNativeTools();
  await testEngineAnswersRepoOverviewFromLocalInventory();
  await testEngineAnswersRootManifestNameFromLocalInventory();
  await testEngineDoesNotShortCircuitWritePromptsThatMentionProjectMetadata();
  await testEnginePrefersManualToolsForGemmaQuickInspect();
  await testEngineWarnsWhenThinkingUnsupported();
  await testEngineAnswersStatusOnlyQuestionsFromLocalState();
  await testEngineAnswersSimpleWorkspaceListingsWithoutModelRoundTrip();
  await testEngineChatStreamShowsStatusesForDirectWorkspaceListing();
  await testEngineSkipsWorkspaceShortcutsWhenBrowserFolderContextIsAttached();
  await testEngineModelSwitchUpdatesSession();
  await testEngineRejectsSimulatedToolTranscripts();
  console.log('unit tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
