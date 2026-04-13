import assert from 'assert';
import { execFileSync } from 'child_process';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(ROOT, 'apps/cli/dist/cli.js');

function runCli(args: string[]) {
  return execFileSync('node', [CLI_PATH, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
}

function testConfigShow() {
  const output = runCli(['config', 'show', '--json']);
  const config = JSON.parse(output);
  assert.strictEqual(config.model, 'gemma4:e4b');
  assert.ok(config.baseUrl.includes('11434'));
}

function testSessionList() {
  const output = runCli(['session', 'list', '--json']);
  const result = JSON.parse(output);
  assert.ok(Array.isArray(result.sessions));
}

function testWorkspaceStatus() {
  const output = runCli(['workspace', 'status', '--json']);
  const result = JSON.parse(output);
  assert.ok(result.workspaceRoot || result.mode);
}

function testSkillsList() {
  const output = runCli(['skills', 'list', '--json']);
  const result = JSON.parse(output);
  assert.ok(Array.isArray(result.skills));
  assert.ok(result.skills.length > 0);
}

function testDoctorJson() {
  const output = runCli(['doctor', '--json']);
  const result = JSON.parse(output);
  assert.ok(result.cli_commands_resolve);
  assert.ok(result.ui_server_starts);
}

function run() {
  testConfigShow();
  testSessionList();
  testWorkspaceStatus();
  testSkillsList();
  testDoctorJson();
  console.log('e2e tests passed');
}

run();
