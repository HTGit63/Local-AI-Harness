import assert from 'assert';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ApprovalQueueManager } from '@local-harness/approval-workflow';
import { FileSessionStore } from '@local-harness/session-store';
import { ToolRegistry } from '@local-harness/tool-runtime';
import { WorkspacePolicy } from '@local-harness/workspace-policy';

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
  const traces: Array<{ type: string; data: any }> = [];

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
  assert.strictEqual(commandEscapeResult.metadata?.command?.status, 'denied');
  assert.strictEqual(commandEscapeResult.metadata?.command?.approvalRequired, true);
  assert.strictEqual(approvals.length, approvalsBeforeCommandEscape);
  assert.ok(traces.some((entry) =>
    entry.type === 'command_policy_checked' &&
    entry.data.command === 'cat ../outside.txt' &&
    entry.data.status === 'denied' &&
    entry.data.approvalRequired === true,
  ));

  const shellSyntaxResult = await registry.runCommand('npm test && rm -rf .');
  assert.strictEqual(shellSyntaxResult.success, false);
  assert.strictEqual(shellSyntaxResult.metadata?.command?.status, 'denied');
  assert.ok(shellSyntaxResult.output.includes('Shell operators'));
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

  const contextPack = await registry.buildContextPack('RunState command approval safety', 2000);
  assert.strictEqual(contextPack.success, true);
  assert.ok((contextPack.metadata?.contextBudgetUsed || 0) <= 2000);
  assert.strictEqual(contextPack.metadata?.contextBudgetLimit, 2000);
  assert.ok((contextPack.metadata?.fileReads || []).length <= 5);

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
  console.log('integration tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
