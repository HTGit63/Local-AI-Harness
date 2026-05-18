import assert from 'assert';
import { spawn } from 'child_process';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(ROOT, 'apps/cli/dist/cli.js');

function runCli(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd: ROOT,
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

async function testConfigShow() {
  const output = await runCli(['config', 'show', '--json']);
  const config = JSON.parse(output);
  assert.strictEqual(config.model, 'gemma4:e4b');
  assert.ok(config.baseUrl.includes('11434'));
}

async function testHelp() {
  const output = await runCli(['help']);
  assert.ok(output.includes('Default: Chat Mode'));
  assert.ok(output.includes('harness agent'));
  assert.ok(output.includes('harness inspect'));
  assert.ok(output.includes('prompt --agent'));
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

async function testInspectJson() {
  const output = await runCli(['inspect', '--json']);
  const result = JSON.parse(output);
  assert.strictEqual(result.inspection.projectName, 'gamma4-local-harness');
  assert.ok(result.inspection.summary.includes('gamma4-local-harness'));
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

async function run() {
  await testHelp();
  await testConfigShow();
  await testSessionList();
  await testWorkspaceStatus();
  await testInspectJson();
  await testSkillsList();
  await testDoctorJson();
  console.log('e2e tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
