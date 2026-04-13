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

async function run() {
  await testSessionStore();
  await testApprovalQueue();
  await testToolRegistry();
  console.log('integration tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
