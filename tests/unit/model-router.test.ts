import assert from 'assert';
import { HeavyModelLock, ModelRouter, selectUnloadCandidates } from '@local-harness/model-router';

async function testModelRouterSelectsRoles() {
  const router = new ModelRouter({
    fastModel: 'gemma4:e4b',
    agentModel: 'VladimirGav/gemma4-26b-16GB-VRAM:latest',
    codingModel: 'deepseek-coder-v2:latest',
    reviewModel: 'qwen3.5:9b-q4_K_M',
    summaryModel: 'gemma4:e4b',
    agentProtocol: 'action_dsl',
    agentKeepAlive: '90s',
  });

  const agentRoute = router.selectRoute({ role: 'agent', purpose: 'read file' });
  assert.strictEqual(agentRoute.model, 'VladimirGav/gemma4-26b-16GB-VRAM:latest');
  assert.strictEqual(agentRoute.protocol, 'action_dsl');
  assert.strictEqual(agentRoute.keepAlive, '90s');

  const codingRoute = router.selectRoute({ role: 'coding' });
  assert.strictEqual(codingRoute.model, 'deepseek-coder-v2:latest');
  assert.strictEqual(codingRoute.protocol, undefined);
}

function testSelectUnloadCandidates() {
  const candidates = selectUnloadCandidates([
    { model: 'deepseek-coder-v2:latest' },
    { name: 'qwen3.5:9b-q4_K_M' },
    { model: 'VladimirGav/gemma4-26b-16GB-VRAM:latest' },
    { model: 'deepseek-coder-v2:latest' },
  ], 'VladimirGav/gemma4-26b-16GB-VRAM:latest');

  assert.deepStrictEqual(candidates, ['deepseek-coder-v2:latest', 'qwen3.5:9b-q4_K_M']);
}

async function testHeavyModelLockSerializesRuns() {
  const events: Array<{ type: string; data: unknown }> = [];
  const lock = new HeavyModelLock((type, data) => events.push({ type, data }));
  const order: string[] = [];

  const first = lock.acquire('run-1').then(async (release) => {
    order.push('run-1-acquired');
    assert.strictEqual(lock.snapshot().ownerRunId, 'run-1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    order.push('run-1-released');
  });

  const second = lock.acquire('run-2').then((release) => {
    order.push('run-2-acquired');
    assert.strictEqual(lock.snapshot().ownerRunId, 'run-2');
    release();
    order.push('run-2-released');
  });

  await Promise.all([first, second]);

  assert.deepStrictEqual(order, [
    'run-1-acquired',
    'run-1-released',
    'run-2-acquired',
    'run-2-released',
  ]);
  assert.strictEqual(lock.snapshot().held, false);
  assert.strictEqual(lock.snapshot().queued, 0);
  assert.deepStrictEqual(events.map((event) => event.type), [
    'heavy_model_lock_acquired',
    'heavy_model_lock_released',
    'heavy_model_lock_acquired',
    'heavy_model_lock_released',
  ]);
}

async function run() {
  await testModelRouterSelectsRoles();
  testSelectUnloadCandidates();
  await testHeavyModelLockSerializesRuns();
  console.log('model-router tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
