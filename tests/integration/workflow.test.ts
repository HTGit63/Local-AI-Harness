import assert from 'assert';
import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { CoreEngine } from '@local-harness/core';
import { ApprovalQueueManager } from '@local-harness/approval-workflow';
import { FileSessionStore } from '@local-harness/session-store';
import { ToolRegistry } from '@local-harness/tool-runtime';
import { WorkspacePolicy } from '@local-harness/workspace-policy';
import { WorkflowRunner } from '@local-harness/workflow-runner';
import { createMockFetch } from '../mocks/model-responses';

const execFileAsync = promisify(execFile);

async function testSessionStore() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-sessions-'));
  const store = new FileSessionStore(tempDir);

  await store.saveSession({
    id: 'session-1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: 'gemma4:e4b',
    mode: 'workspace-write',
    cwd: tempDir,
    skillsActive: ['engineering-frontend-developer'],
    toolsAllowlist: ['read_file'],
  });

  const loaded = await store.loadSession('session-1');
  assert.ok(loaded);
  assert.strictEqual(loaded?.model, 'gemma4:e4b');
  assert.strictEqual((await store.listSessions()).length, 1);
  assert.strictEqual(await store.deleteSession('session-1'), true);
  await fs.rm(tempDir, { recursive: true, force: true });
}

async function testApprovalQueue() {
  const events: unknown[] = [];
  const queue = new ApprovalQueueManager({
    emitEvent(event) {
      events.push(event);
    },
  });

  const approvalPromise = queue.requestApproval({
    target: 'src/app.ts',
    changeType: 'modify_file',
    severity: 'warning',
    diffPreview: 'diff preview',
  });
  const pending = queue.getPendingQueue();
  assert.strictEqual(pending.length, 1);
  queue.resolveApproval(pending[0].id, { approved: true });
  const result = await approvalPromise;
  assert.strictEqual(result.approved, true);
  assert.ok(events.length >= 2);
}

async function testToolRegistry() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-tools-'));
  const policy = new WorkspacePolicy({ workspaceRoot: tempDir, mode: 'workspace-write' });
  const approvals: Array<{ resolve: (approved: boolean) => void }> = [];
  const traces: unknown[] = [];

  await fs.writeFile(path.join(tempDir, 'test.txt'), 'hello world', 'utf8');

  const registry = new ToolRegistry({
    cwd: tempDir,
    emitTrace(type, data) {
      traces.push({ type, data });
    },
    checkPolicy(action, target) {
      return policy.checkAction(action, target);
    },
    requestApproval: async ({ preview }) => new Promise<boolean>((resolve) => {
      approvals.push({ resolve });
      assert.ok(preview.length > 0);
    }),
  });

  const readResult = await registry.readFile('test.txt');
  assert.strictEqual(readResult.success, true);
  assert.strictEqual(readResult.output, 'hello world');

  const writePromise = registry.writeFile('test.txt', 'updated content');
  assert.strictEqual(approvals.length, 1);
  approvals[0].resolve(true);
  const writeResult = await writePromise;
  assert.strictEqual(writeResult.success, true);
  assert.ok((writeResult.preview || '').includes('test.txt'));

  const searchResult = await registry.searchText('x"; echo INJECTED; #');
  assert.strictEqual(searchResult.output.includes('INJECTED'), false);

  const deniedResult = await registry.readFile('../outside.txt');
  assert.strictEqual(deniedResult.success, false);
  assert.ok(traces.length > 0);

  const approvalsBeforeCommandEscape = approvals.length;
  const commandEscapeResult = await registry.runCommand('cat ../outside.txt');
  assert.strictEqual(commandEscapeResult.success, false);
  assert.ok(commandEscapeResult.output.includes('outside the workspace root'));
  assert.strictEqual(approvals.length, approvalsBeforeCommandEscape);

  await fs.mkdir(path.join(tempDir, 'nested'));
  await fs.writeFile(path.join(tempDir, 'nested', 'child.txt'), 'nested', 'utf8');
  const deleteDirectoryPromise = registry.deleteFile('nested');
  assert.strictEqual(approvals.length, 1);
  approvals[0].resolve(true);
  const deleteDirectoryResult = await deleteDirectoryPromise;
  assert.strictEqual(deleteDirectoryResult.success, true);
  assert.strictEqual(await fs.stat(path.join(tempDir, 'nested')).then(() => true).catch(() => false), false);

  await fs.rm(tempDir, { recursive: true, force: true });
}

async function testWorkflowRunner() {
  const traces: Array<{ type: string; data: unknown }> = [];
  const runner = new WorkflowRunner({
    workflowId: 'workflow-1',
    workflowType: 'inspect_project',
    runId: 'run-1',
    sessionId: 'session-1',
    workspaceRoot: '/workspace',
    modelRole: 'agent',
    protocol: 'workflow_runner',
    emitTrace: (type, data) => {
      traces.push({ type, data });
    },
  });

  const started = runner.start('bootstrap workflow');
  assert.strictEqual(started.status, 'started');

  const step = runner.startStep({
    id: 'step-1',
    type: 'inspect',
    title: 'Inspect project',
    detail: 'scan the workspace',
    action: 'inspect_project',
    inputSummary: 'workspace snapshot',
  });
  assert.strictEqual(step.status, 'running');

  runner.recordFileRead('src/index.ts');
  runner.recordFileChanged('README.md');
  runner.recordCommand('npm test');
  runner.waitForApproval('need approval for next change');
  runner.verify('checking workflow output');

  const finishedStep = runner.finishStep(step.id, 'done', 'project inspected', 'waiting_for_model_action');
  assert.strictEqual(finishedStep.status, 'done');

  const completed = runner.complete('workflow finished cleanly');
  assert.strictEqual(completed.status, 'completed');
  assert.ok(traces.some((entry) => entry.type === 'workflow_started'));
  assert.ok(traces.some((entry) => entry.type === 'workflow_step_started'));
  assert.ok(traces.some((entry) => entry.type === 'workflow_completed'));

  const snapshot = runner.snapshot();
  const restored = WorkflowRunner.fromState(snapshot);
  assert.deepStrictEqual(restored.snapshot(), snapshot);

  const blockedRunner = new WorkflowRunner({
    workflowId: 'workflow-2',
    workflowType: 'inspect_project',
    runId: 'run-2',
    sessionId: 'session-2',
    workspaceRoot: '/workspace',
    modelRole: 'agent',
    protocol: 'workflow_runner',
  });
  blockedRunner.start();
  const blocked = blockedRunner.block('workspace policy blocked the step');
  assert.strictEqual(blocked.status, 'blocked');

  const failedRunner = new WorkflowRunner({
    workflowId: 'workflow-3',
    workflowType: 'inspect_project',
    runId: 'run-3',
    sessionId: 'session-3',
    workspaceRoot: '/workspace',
    modelRole: 'agent',
    protocol: 'workflow_runner',
  });
  failedRunner.start();
  const failed = failedRunner.fail('workflow failed during validation');
  assert.strictEqual(failed.status, 'failed');
}

async function testSessionStorePreservesWorkflowSummary() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-session-'));
  const store = new FileSessionStore(tempDir);
  const workflowRunner = new WorkflowRunner({
    workflowId: 'workflow-session',
    workflowType: 'inspect_project',
    runId: 'run-session',
    sessionId: 'session-session',
    workspaceRoot: tempDir,
    modelRole: 'agent',
    protocol: 'workflow_runner',
  });
  workflowRunner.start('session workflow');
  workflowRunner.block('waiting on policy');

  try {
    await store.saveSession({
      id: 'session-session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'gemma4:e4b',
      mode: 'workspace-write',
      cwd: tempDir,
      skillsActive: ['engineering-frontend-developer'],
      toolsAllowlist: ['read_file'],
      turnHistory: [
        {
          timestamp: Date.now(),
          executionMode: 'agentic',
          messageCount: 3,
          summary: 'workflow run',
          runSummary: {
            id: 'run-session',
            sessionId: 'session-session',
            startedAt: Date.now(),
            executionMode: 'agentic',
            workspaceRoot: tempDir,
            workspaceSource: 'backend',
            model: 'gemma4:e4b',
            agentProtocol: 'workflow_runner',
            promptMode: 'planning',
            intent: 'inspect_project',
            browserContextActive: false,
            workspaceBound: true,
            usedNativeTools: false,
            usedManualFallback: false,
            steps: [],
            filesRead: [],
            directoriesRead: [],
            filesWritten: [],
            filesDeleted: [],
            directoriesCreated: [],
            searches: [],
            webSearches: [],
            webFetches: [],
            commands: [],
            approvals: [],
            workflow: workflowRunner.snapshot(),
          },
        },
      ],
    });

    const loaded = await store.loadSession('session-session');
    assert.ok(loaded);
    assert.strictEqual(loaded?.turnHistory?.[0]?.runSummary?.agentProtocol, 'workflow_runner');
    assert.strictEqual(loaded?.turnHistory?.[0]?.runSummary?.workflow?.status, 'blocked');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function makeChatResponse(content: string) {
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

function getSystemPrompt(body: any): string {
  const systemMessage = body.messages?.find((message: any) => message.role === 'system') ?? body.messages?.[0];
  return String(systemMessage?.content ?? '');
}

function workflowChatResponder(body: any) {
  const systemPrompt = getSystemPrompt(body);

  if (systemPrompt.includes('You are summarizing a focused repository inspection.')) {
    return makeChatResponse([
      'Summary:',
      'Repo scanned with focused context only.',
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
      'Manifests and README were enough for the summary.',
    ].join('\n'));
  }

  if (systemPrompt.includes('You are producing a repository audit report.')) {
    return makeChatResponse([
      'Summary:',
      'Repo audit found a clear app entry point and a small, testable surface.',
      'Commands detected:',
      '- npm run dev',
      '- npm test',
      '- npm run build',
      'Architecture evidence:',
      '- README.md: repo overview is present.',
      '- apps/api/src/server.ts: API entry file exists.',
      'Tests/config evidence:',
      '- tsconfig.json: TypeScript config present.',
      '- eslint.config.js: lint config present.',
      'Risks:',
      '- API and test files should stay aligned as the surface grows.',
      'Follow-up workflows:',
      '- inspect_project',
      '- fix_single_file',
      '- small_patch',
    ].join('\n'));
  }

  if (systemPrompt.includes('Task: Propose one patch for src/index.ts.')) {
    return makeChatResponse(JSON.stringify({
      kind: 'action',
      action: 'propose_patch',
      args: {
        path: 'src/index.ts',
        oldText: "export const value = 'old';",
        newText: "export const value = 'new';",
      },
    }));
  }

  if (systemPrompt.includes('Task: Select the smallest useful verification command for src/index.ts.')) {
    return makeChatResponse(JSON.stringify({
      kind: 'action',
      action: 'run_selected_command',
      args: {
        command: 'node --version',
      },
    }));
  }

  if (systemPrompt.includes('Write a concise final summary for a one-file workflow.')) {
    return makeChatResponse([
      'Fixed src/index.ts.',
      'Verification: node --version passed.',
      'Files changed: src/index.ts.',
    ].join('\n'));
  }

  if (systemPrompt.includes('Task: Propose one patch for src/a.ts.')) {
    return makeChatResponse(JSON.stringify({
      kind: 'action',
      action: 'propose_patch',
      args: {
        path: 'src/a.ts',
        oldText: "export const alpha = 'old-a';",
        newText: "export const alpha = 'new-a';",
      },
    }));
  }

  if (systemPrompt.includes('Task: Propose one patch for src/b.ts.')) {
    return makeChatResponse(JSON.stringify({
      kind: 'action',
      action: 'propose_patch',
      args: {
        path: 'src/b.ts',
        oldText: "export const beta = 'old-b';",
        newText: "export const beta = 'new-b';",
      },
    }));
  }

  if (systemPrompt.includes('Task: Select the smallest useful verification command for these changes.')) {
    return makeChatResponse(JSON.stringify({
      kind: 'action',
      action: 'run_selected_command',
      args: {
        command: 'node --version',
      },
    }));
  }

  if (systemPrompt.includes('Write a concise final summary for a small multi-file workflow.')) {
    return makeChatResponse([
      'Patched src/a.ts and src/b.ts.',
      'Verification: node --version passed.',
      'Files changed: src/a.ts, src/b.ts.',
    ].join('\n'));
  }

  throw new Error(`Unexpected workflow prompt: ${systemPrompt}`);
}

async function bootstrapGitWorkspace(workspaceRoot: string, files: Record<string, string>) {
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
}

async function getLatestWorkflowRun(engine: CoreEngine) {
  const session = engine.getSession();
  assert.ok(session);
  const turnHistory = session?.turnHistory ?? [];
  assert.ok(turnHistory.length > 0);
  const latestTurn = turnHistory[turnHistory.length - 1];
  assert.ok(latestTurn?.runSummary);
  return latestTurn.runSummary;
}

async function testWorkflowRunnerInspectProject() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-inspect-'));
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-sessions-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch({
    chatResponder: workflowChatResponder,
  }) as typeof fetch;

  try {
    await bootstrapGitWorkspace(workspaceRoot, {
      'package.json': JSON.stringify({
        name: 'inspect-workspace',
        private: true,
        scripts: {
          dev: 'node apps/api/src/server.ts',
          test: 'node --version',
          build: 'node --version',
        },
      }, null, 2) + '\n',
      'README.md': '# Inspect Workspace\n',
      'apps/api/src/server.ts': 'export const api = true;\n',
    });

    const engine = new CoreEngine({
      workspaceRoot,
      sessionDataDir,
      agentProtocol: 'workflow_runner',
      model: 'gemma4:e4b',
      agentModel: 'gemma4:e4b',
      summaryModel: 'gemma4:e4b',
    });

    const response = await engine.chat([
      { role: 'user', content: 'Inspect this repo and identify the API entry file.' },
    ]);

    const runSummary = await getLatestWorkflowRun(engine);
    assert.strictEqual(runSummary.workflow?.workflowType, 'inspect_project');
    assert.strictEqual(runSummary.workflow?.status, 'completed');
    assert.deepStrictEqual(runSummary.workflow?.filesRead, ['package.json', 'README.md']);
    assert.ok((runSummary.workflow?.commands ?? []).includes('npm test'));
    assert.ok(response.includes('Summary:'));
    assert.ok(response.includes('API entry file:'));
    assert.ok(response.includes('Commands detected:'));
    assert.ok(response.includes('What I did:'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(sessionDataDir, { recursive: true, force: true });
  }
}

async function testWorkflowRunnerRepoAudit() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-audit-'));
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-sessions-'));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch({
    chatResponder: workflowChatResponder,
  }) as typeof fetch;

  try {
    await bootstrapGitWorkspace(workspaceRoot, {
      'package.json': JSON.stringify({
        name: 'audit-workspace',
        private: true,
        scripts: {
          dev: 'node apps/api/src/server.ts',
          test: 'node --version',
          build: 'node --version',
        },
      }, null, 2) + '\n',
      'README.md': '# Audit Workspace\n',
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
        },
      }, null, 2) + '\n',
      'eslint.config.js': 'export default [];\n',
      'apps/api/src/server.ts': 'export const api = true;\n',
    });

    const engine = new CoreEngine({
      workspaceRoot,
      sessionDataDir,
      agentProtocol: 'workflow_runner',
      model: 'gemma4:e4b',
      agentModel: 'gemma4:e4b',
      summaryModel: 'gemma4:e4b',
    });

    const response = await engine.chat([
      { role: 'user', content: 'Audit this repo for risks, tests, and configuration gaps.' },
    ]);

    const runSummary = await getLatestWorkflowRun(engine);
    assert.strictEqual(runSummary.workflow?.workflowType, 'repo_audit');
    assert.strictEqual(runSummary.workflow?.status, 'completed');
    assert.ok((runSummary.workflow?.filesRead ?? []).includes('package.json'));
    assert.ok((runSummary.workflow?.filesRead ?? []).includes('README.md'));
    assert.ok((runSummary.workflow?.filesRead ?? []).some((file) => file.includes('tsconfig.json') || file.includes('eslint.config.js')));
    assert.ok(response.includes('Summary:'));
    assert.ok(response.includes('Risks:'));
    assert.ok(response.includes('Follow-up workflows:'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(sessionDataDir, { recursive: true, force: true });
  }
}

async function testWorkflowRunnerFixSingleFile() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-fix-'));
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-sessions-'));
  const originalFetch = globalThis.fetch;
  let approvalCount = 0;
  globalThis.fetch = createMockFetch({
    chatResponder: workflowChatResponder,
  }) as typeof fetch;

  try {
    await bootstrapGitWorkspace(workspaceRoot, {
      'package.json': JSON.stringify({
        name: 'fix-workspace',
        private: true,
        scripts: {
          test: 'node --version',
        },
      }, null, 2) + '\n',
      'README.md': '# Fix Workspace\n',
      'src/index.ts': "export const value = 'old';\n",
    });

    const engine = new CoreEngine({
      workspaceRoot,
      sessionDataDir,
      agentProtocol: 'workflow_runner',
      model: 'gemma4:e4b',
      agentModel: 'gemma4:e4b',
      summaryModel: 'gemma4:e4b',
    });
    engine.on('approval_requested', (event) => {
      approvalCount += 1;
      engine.resolveApproval(event.id, true);
    });

    const response = await engine.chat([
      { role: 'user', content: 'Fix src/index.ts so it returns the new value instead of the old one.' },
    ]);

    const runSummary = await getLatestWorkflowRun(engine);
    assert.strictEqual(runSummary.workflow?.workflowType, 'fix_single_file');
    assert.strictEqual(runSummary.workflow?.status, 'completed');
    assert.deepStrictEqual(runSummary.workflow?.filesChanged, ['src/index.ts']);
    assert.ok((runSummary.workflow?.commands ?? []).includes('node --version'));
    assert.ok(approvalCount >= 1);
    assert.ok(response.includes('Fixed src/index.ts.'));
    assert.ok(response.includes('What I did:'));
    assert.ok(response.includes('Files changed:'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(sessionDataDir, { recursive: true, force: true });
  }
}

async function testWorkflowRunnerSmallPatch() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-small-'));
  const sessionDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-workflow-sessions-'));
  const originalFetch = globalThis.fetch;
  let approvalCount = 0;
  globalThis.fetch = createMockFetch({
    chatResponder: workflowChatResponder,
  }) as typeof fetch;

  try {
    await bootstrapGitWorkspace(workspaceRoot, {
      'package.json': JSON.stringify({
        name: 'small-patch-workspace',
        private: true,
        scripts: {
          test: 'node --version',
        },
      }, null, 2) + '\n',
      'README.md': '# Small Patch Workspace\n',
      'src/a.ts': "export const alpha = 'old-a';\n",
      'src/b.ts': "export const beta = 'old-b';\n",
    });

    const engine = new CoreEngine({
      workspaceRoot,
      sessionDataDir,
      agentProtocol: 'workflow_runner',
      model: 'gemma4:e4b',
      agentModel: 'gemma4:e4b',
      summaryModel: 'gemma4:e4b',
    });
    engine.on('approval_requested', (event) => {
      approvalCount += 1;
      engine.resolveApproval(event.id, true);
    });

    const response = await engine.chat([
      { role: 'user', content: 'Fix src/a.ts and src/b.ts so both export updated values.' },
    ]);

    const runSummary = await getLatestWorkflowRun(engine);
    assert.strictEqual(runSummary.workflow?.workflowType, 'small_patch');
    assert.strictEqual(runSummary.workflow?.status, 'completed');
    assert.deepStrictEqual([...(runSummary.workflow?.filesChanged ?? [])].sort(), ['src/a.ts', 'src/b.ts']);
    assert.ok((runSummary.workflow?.commands ?? []).includes('node --version'));
    assert.ok(approvalCount >= 1);
    assert.ok(response.includes('Patched src/a.ts and src/b.ts.'));
    assert.ok(response.includes('What I did:'));
    assert.ok(response.includes('Files changed:'));
  } finally {
    globalThis.fetch = originalFetch;
    await fs.rm(workspaceRoot, { recursive: true, force: true });
    await fs.rm(sessionDataDir, { recursive: true, force: true });
  }
}

async function testSaferEditTools() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-safe-edits-'));
  const policy = new WorkspacePolicy({ workspaceRoot: tempDir, mode: 'danger' });
  const traces: Array<{ type: string; data: any }> = [];

  await fs.writeFile(path.join(tempDir, 'app.ts'), [
    'export function demo() {',
    '  const value = 1;',
    '  return value;',
    '}',
    '',
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(tempDir, 'patch-target.txt'), 'old\n', 'utf8');
  await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ scripts: { build: 'tsc', test: 'node test.js', dev: 'vite' } }), 'utf8');
  await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'src', 'types.ts'), [
    'export interface RunState {',
    '  id: string;',
    '}',
    '',
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(tempDir, 'src', 'consumer.ts'), [
    'import type { RunState } from "./types";',
    '',
    'export function chatStream(state: RunState) {',
    '  const messageText = state.id;',
    '  return messageText;',
    '}',
    '',
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(tempDir, 'src', 'RunConsole.tsx'), [
    'export function RunConsole() {',
    '  return <div>Run</div>;',
    '}',
    '',
  ].join('\n'), 'utf8');

  const registry = new ToolRegistry({
    cwd: tempDir,
    emitTrace(type, data) {
      traces.push({ type, data });
    },
    checkPolicy(action, target) {
      return policy.checkAction(action, target);
    },
    requestApproval: async () => {
      throw new Error('Danger mode should not request approval.');
    },
  });

  const replaceRange = await registry.replaceRange('app.ts', 2, 2, '  const value = 2;');
  assert.strictEqual(replaceRange.success, true);
  assert.ok((replaceRange.preview || '').includes('-  const value = 1;'));
  assert.ok((replaceRange.preview || '').includes('+  const value = 2;'));
  assert.ok(replaceRange.metadata?.lineStats?.added >= 1);

  const insertAfter = await registry.insertAfter('app.ts', '  const value = 2;', '  const doubled = value * 2;');
  assert.strictEqual(insertAfter.success, true);

  const insertBefore = await registry.insertBefore('app.ts', '  return value;', '  void doubled;');
  assert.strictEqual(insertBefore.success, true);

  const replaceBlock = await registry.replaceBlock('app.ts', '  const value = 2;', '  return value;', [
    '  const value = 3;',
    '  const doubled = value * 2;',
    '  return doubled;',
  ].join('\n'));
  assert.strictEqual(replaceBlock.success, true);
  const appContent = await fs.readFile(path.join(tempDir, 'app.ts'), 'utf8');
  assert.ok(appContent.includes('const value = 3;'));
  assert.ok(appContent.includes('return doubled;'));

  const preview = await registry.previewPatch('app.ts', 'before\n', 'after\n');
  assert.strictEqual(preview.success, true);
  assert.ok((preview.preview || '').includes('-before'));
  assert.ok((preview.preview || '').includes('+after'));

  const patchResult = await registry.applyUnifiedPatch([
    '--- patch-target.txt',
    '+++ patch-target.txt',
    '@@ -1 +1 @@',
    '-old',
    '+new',
    '',
  ].join('\n'));
  assert.strictEqual(patchResult.success, true);
  assert.strictEqual(await fs.readFile(path.join(tempDir, 'patch-target.txt'), 'utf8'), 'new\n');
  assert.ok(patchResult.metadata?.filesWritten?.includes('patch-target.txt'));
  assert.ok(traces.some((entry) => entry.type === 'tool_call_started' && entry.data.tool === 'replaceRange'));
  assert.ok(traces.some((entry) => entry.type === 'tool_call_completed' && entry.data.tool === 'applyUnifiedPatch'));

  const symbolResult = await registry.findSymbol('RunState');
  assert.strictEqual(symbolResult.success, true);
  assert.ok(symbolResult.output.includes('src/types.ts'));

  const functionResult = await registry.findFunction('chatStream');
  assert.strictEqual(functionResult.success, true);
  assert.ok(functionResult.output.includes('src/consumer.ts'));

  const componentResult = await registry.findComponent('RunConsole');
  assert.strictEqual(componentResult.success, true);
  assert.ok(componentResult.output.includes('src/RunConsole.tsx'));

  const importsResult = await registry.whatDoesThisImport('src/consumer.ts');
  assert.strictEqual(importsResult.success, true);
  assert.ok(importsResult.output.includes('./types'));

  const importersResult = await registry.whoImports('src/types.ts');
  assert.strictEqual(importersResult.success, true);
  assert.ok(importersResult.output.includes('src/consumer.ts'));

  const affectedResult = await registry.affectedFiles('src/types.ts');
  assert.strictEqual(affectedResult.success, true);
  assert.ok(affectedResult.output.includes('src/consumer.ts'));

  const replaceFunctionResult = await registry.replaceFunction('src/consumer.ts', 'chatStream', 'return "patched";');
  assert.strictEqual(replaceFunctionResult.success, true);
  assert.ok((await fs.readFile(path.join(tempDir, 'src', 'consumer.ts'), 'utf8')).includes('return "patched";'));

  const importResult = await registry.insertImport('src/consumer.ts', 'import { readFile } from "fs/promises";');
  assert.strictEqual(importResult.success, true);
  assert.ok((await fs.readFile(path.join(tempDir, 'src', 'consumer.ts'), 'utf8')).includes('fs/promises'));

  const propertyResult = await registry.addTypeProperty('src/types.ts', 'RunState', 'status?: string;');
  assert.strictEqual(propertyResult.success, true);
  assert.ok((await fs.readFile(path.join(tempDir, 'src', 'types.ts'), 'utf8')).includes('status?: string;'));

  const renameResult = await registry.renameIdentifier('src/consumer.ts', 'chatStream', 'chatStreamPatched');
  assert.strictEqual(renameResult.success, true);
  assert.ok((await fs.readFile(path.join(tempDir, 'src', 'consumer.ts'), 'utf8')).includes('chatStreamPatched'));

  const commandsResult = await registry.detectProjectCommands();
  assert.strictEqual(commandsResult.success, true);
  assert.ok(commandsResult.output.includes('"packageManager": "npm"'));
  assert.ok(commandsResult.output.includes('"build": "npm run build"'));

  const testSelection = await registry.selectTestsForChangedFiles(['packages/tool-runtime/src/registry.ts']);
  assert.strictEqual(testSelection.success, true);
  assert.ok(testSelection.output.includes('tests/integration/workflow.test.ts'));

  const checkpoint = await registry.createCheckpoint('before test edit');
  assert.strictEqual(checkpoint.success, true);
  const checkpointId = checkpoint.metadata?.checkpointId;
  assert.ok(checkpointId);
  await fs.writeFile(path.join(tempDir, 'src', 'created-after-checkpoint.ts'), 'remove me', 'utf8');
  await fs.writeFile(path.join(tempDir, 'src', 'types.ts'), 'changed\n', 'utf8');
  const rollback = await registry.rollbackToCheckpoint(checkpointId);
  assert.strictEqual(rollback.success, true);
  assert.ok((await fs.readFile(path.join(tempDir, 'src', 'types.ts'), 'utf8')).includes('status?: string;'));
  assert.strictEqual(await fs.stat(path.join(tempDir, 'src', 'created-after-checkpoint.ts')).then(() => true).catch(() => false), false);

  await fs.rm(tempDir, { recursive: true, force: true });
}

async function run() {
  await testSessionStore();
  await testApprovalQueue();
  await testToolRegistry();
  await testSaferEditTools();
  await testWorkflowRunner();
  await testSessionStorePreservesWorkflowSummary();
  await testWorkflowRunnerInspectProject();
  await testWorkflowRunnerRepoAudit();
  await testWorkflowRunnerFixSingleFile();
  await testWorkflowRunnerSmallPatch();
  console.log('integration tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
