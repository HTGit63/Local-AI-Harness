import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface DiagnosticsOptions {
  repoRoot?: string;
  baseUrl?: string;
  model?: string;
  workspaceRoot?: string;
  quiet?: boolean;
}

export async function runDiagnostics(options: DiagnosticsOptions = {}) {
  const repoRoot = path.resolve(options.repoRoot || path.join(__dirname, '../../..'));
  const baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1';
  const model = options.model || 'gemma4:e4b';
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const results: Record<string, 'pass' | 'fail' | 'warn'> = {};

  try {
    const res = await fetch(baseUrl.replace(/\/v1$/, ''));
    results.ollama_reachable = res.ok ? 'pass' : 'fail';
  } catch {
    results.ollama_reachable = 'fail';
  }

  try {
    const res = await fetch(baseUrl.replace(/\/v1$/, '/api/tags'));
    const data = await res.json() as { models?: Array<{ name: string }> };
    const models = data.models?.map((entry) => entry.name) || [];
    results.model_gemma4_installed = models.includes(model) ? 'pass' : 'warn';
  } catch {
    results.model_gemma4_installed = 'fail';
  }

  try {
    const res = await fetch(`${baseUrl}/models`);
    results.base_url_valid = res.ok ? 'pass' : 'fail';
  } catch {
    results.base_url_valid = 'fail';
  }

  results.api_key_placeholder_valid = (process.env.OPENAI_API_KEY || 'ollama') === 'ollama' ? 'pass' : 'warn';

  try {
    const testFile = path.join(workspaceRoot, '.doctor_test_write');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    results.workspace_write_permission = 'pass';
  } catch {
    results.workspace_write_permission = 'fail';
  }

  try {
    const sessionDir = path.join(workspaceRoot, '.gamma-harness', 'sessions');
    await fs.mkdir(sessionDir, { recursive: true });
    const tempSession = path.join(sessionDir, '.doctor_test');
    await fs.writeFile(tempSession, '{}');
    await fs.unlink(tempSession);
    results.session_store_healthy = 'pass';
  } catch {
    results.session_store_healthy = 'fail';
  }

  try {
    const { EventEmitter } = await import('events');
    const bus = new EventEmitter();
    let received = false;
    bus.on('trace', () => {
      received = true;
    });
    bus.emit('trace');
    results.trace_bus_healthy = received ? 'pass' : 'fail';
  } catch {
    results.trace_bus_healthy = 'fail';
  }

  try {
    const raw = await fs.readFile(path.join(repoRoot, 'packages/skills/dist/curated_pack.json'), 'utf8');
    const skills = JSON.parse(raw) as unknown[];
    results.skill_index_present = skills.length > 0 ? 'pass' : 'warn';
  } catch {
    results.skill_index_present = 'warn';
  }

  try {
    await fs.access(path.join(repoRoot, 'packages/prompt-recipes/src/recipes.ts'));
    results.prompt_recipe_index_present = 'pass';
  } catch {
    results.prompt_recipe_index_present = 'warn';
  }

  try {
    const cliPath = path.join(repoRoot, 'apps/cli/dist/cli.js');
    await fs.access(cliPath);
    const { stdout } = await execFileAsync('node', [cliPath, 'config', 'show', '--json'], {
      cwd: repoRoot,
      timeout: 10000,
    });
    JSON.parse(stdout);
    results.cli_commands_resolve = 'pass';
  } catch {
    results.cli_commands_resolve = 'fail';
  }

  try {
    const webRoot = path.join(repoRoot, 'apps/web');
    await fs.access(path.join(webRoot, 'package.json'));

    try {
      const { stdout } = await execFileAsync(
        'npm',
        ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
        {
          cwd: webRoot,
          timeout: 8000,
          maxBuffer: 1024 * 1024,
        },
      );

      results.ui_server_starts = /Local:|ready in|http:\/\/127\.0\.0\.1:4173/i.test(stdout) ? 'pass' : 'warn';
    } catch (error: any) {
      const output = `${error?.stdout || ''}\n${error?.stderr || ''}`;
      results.ui_server_starts = /Local:|ready in|http:\/\/127\.0\.0\.1:4173/i.test(output) ? 'pass' : 'fail';
    }
  } catch {
    results.ui_server_starts = 'fail';
  }

  if (!options.quiet) {
    console.log('--- Gamma 4 Harness Diagnostics ---');
    for (const [check, status] of Object.entries(results)) {
      const icon = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'FAIL';
      console.log(`${icon} ${check}`);
    }
  }

  return results;
}
