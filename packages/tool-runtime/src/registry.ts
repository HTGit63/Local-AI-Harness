import { ApprovalDecision, ToolActionContext, ToolResult } from './types';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_LINES = 200;
const MAX_BUFFER_BYTES = 1024 * 1024;

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of command.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaped) {
    current += '\\';
  }

  if (quote) {
    throw new Error('Unterminated quoted argument in command.');
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function containsUnsupportedShellSyntax(command: string): boolean {
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of command.trim()) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && quote !== "'") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if ('|&;<>`$'.includes(char)) {
      return true;
    }
  }

  return false;
}

function truncateOutput(output: string): string {
  const lines = output.split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) {
    return output.trim() || 'No output';
  }

  return `${lines.slice(0, MAX_OUTPUT_LINES).join('\n')}\n... output truncated ...`;
}

function createSummaryPreview(filePath: string, before: string, after: string): string {
  const beforeLines = before.split('\n').length;
  const afterLines = after.split('\n').length;
  return [
    `Change preview for ${filePath}`,
    `Before: ${before.length} chars, ${beforeLines} lines`,
    `After: ${after.length} chars, ${afterLines} lines`,
  ].join('\n');
}

function globToRegExp(pattern: string): RegExp {
  let escaped = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];

    if (char === '*' && nextChar === '*') {
      escaped += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      escaped += '[^/]*';
      continue;
    }

    if (char === '?') {
      escaped += '[^/]';
      continue;
    }

    if ('\\.[]{}()+-^$|'.includes(char)) {
      escaped += `\\${char}`;
      continue;
    }

    escaped += char;
  }

  return new RegExp(`^${escaped}$`);
}

async function walkFiles(cwd: string, currentDir = cwd): Promise<string[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (['.git', 'node_modules', 'dist', 'build', '.next'].includes(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(cwd, absolutePath));
      continue;
    }

    results.push(path.relative(cwd, absolutePath));
  }

  return results.sort();
}

async function buildDiffPreview(filePath: string, before: string, after: string): Promise<string> {
  if (before === after) {
    return `No content changes for ${filePath}`;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-diff-'));
  const beforePath = path.join(tempDir, 'before.txt');
  const afterPath = path.join(tempDir, 'after.txt');

  await fs.writeFile(beforePath, before, 'utf8');
  await fs.writeFile(afterPath, after, 'utf8');

  try {
    try {
      const { stdout } = await execFileAsync(
        'diff',
        ['-u', '--label', `${filePath} (before)`, '--label', `${filePath} (after)`, beforePath, afterPath],
        { maxBuffer: MAX_BUFFER_BYTES },
      );
      return truncateOutput(stdout);
    } catch (error: any) {
      if (typeof error?.stdout === 'string' && error.stdout.trim()) {
        return truncateOutput(error.stdout);
      }

      return createSummaryPreview(filePath, before, after);
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function isMissingExecutable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT');
}

function isNotGitRepository(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('not a git repository');
}

export class ToolRegistry {
  private context: ToolActionContext;

  constructor(context: ToolActionContext) {
    this.context = context;
  }

  updateContext(context: Partial<ToolActionContext>) {
    this.context = {
      ...this.context,
      ...context,
    };
  }

  private resolveTarget(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return path.resolve(targetPath);
    }
    return path.resolve(this.context.cwd, targetPath);
  }

  private withApproval(action: string, target: string, preview: string, metadata?: Record<string, string>): ApprovalDecision {
    return this.context.requestApproval({
      action,
      target,
      preview,
      metadata,
    });
  }

  private wrapExecution(name: string, inputSummary: string, executor: () => Promise<ToolResult>): Promise<ToolResult> {
    this.context.emitTrace('tool_call', { name, inputSummary });
    return executor()
      .then((result) => {
        this.context.emitTrace('tool_result', {
          name,
          resultSummary: result.success ? 'Success' : 'Failed',
          output: truncateOutput(result.output),
        });
        return result;
      })
      .catch((error: Error) => {
        this.context.emitTrace('tool_result', {
          name,
          resultSummary: 'Error',
          output: error.message,
        });
        return { success: false, output: error.message, error: error.message };
      });
  }

  async readFile(filePath: string): Promise<ToolResult> {
    return this.wrapExecution('read_file', `Reading ${filePath}`, async () => {
      const policy = this.context.checkPolicy('read', filePath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const content = await fs.readFile(this.resolveTarget(filePath), 'utf8');
      return { success: true, output: content };
    });
  }

  async listDir(dirPath: string): Promise<ToolResult> {
    return this.wrapExecution('list_dir', `Listing ${dirPath}`, async () => {
      const policy = this.context.checkPolicy('read', dirPath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const entries = await fs.readdir(this.resolveTarget(dirPath), { withFileTypes: true });
      const output = entries
        .map((entry) => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
        .sort()
        .join('\n');

      return { success: true, output: output || 'No entries' };
    });
  }

  async glob(pattern: string): Promise<ToolResult> {
    return this.wrapExecution('glob', `Glob ${pattern}`, async () => {
      const policy = this.context.checkPolicy('read', '.');
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      try {
        const { stdout } = await execFileAsync(
          'rg',
          ['--files', '--glob', pattern, '--glob', '!node_modules/**', '--glob', '!.git/**'],
          { cwd: this.context.cwd, maxBuffer: MAX_BUFFER_BYTES },
        );
        return { success: true, output: truncateOutput(stdout) || 'No matches' };
      } catch (error) {
        if (!isMissingExecutable(error)) {
          throw error;
        }
      }

      const matcher = globToRegExp(pattern);
      const matches = (await walkFiles(this.context.cwd)).filter((file) => matcher.test(file));
      return { success: true, output: matches.join('\n') || 'No matches' };
    });
  }

  async searchText(query: string, filePattern?: string): Promise<ToolResult> {
    return this.wrapExecution('search_text', `Searching for "${query}"`, async () => {
      const policy = this.context.checkPolicy('read', '.');
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      try {
        const rgArgs = ['-n', '--no-heading', '--color', 'never', '--glob', '!node_modules/**', '--glob', '!.git/**'];
        if (filePattern) {
          rgArgs.push('--glob', filePattern);
        }
        rgArgs.push('-e', query, '.');

        const { stdout } = await execFileAsync('rg', rgArgs, {
          cwd: this.context.cwd,
          maxBuffer: MAX_BUFFER_BYTES,
        });
        return { success: true, output: truncateOutput(stdout) || 'No matches' };
      } catch (error: any) {
        if (!isMissingExecutable(error)) {
          if (typeof error?.stdout === 'string' && error.stdout.trim()) {
            return { success: true, output: truncateOutput(error.stdout) };
          }
          if (error?.code === 1) {
            return { success: true, output: 'No matches' };
          }
        }
      }

      const grepArgs = ['-rnI', '--exclude-dir=node_modules', '--exclude-dir=.git'];
      if (filePattern) {
        grepArgs.push(`--include=${filePattern}`);
      }
      grepArgs.push('-e', query, '.');

      try {
        const { stdout } = await execFileAsync('grep', grepArgs, {
          cwd: this.context.cwd,
          maxBuffer: MAX_BUFFER_BYTES,
        });
        return { success: true, output: truncateOutput(stdout) || 'No matches' };
      } catch (error: any) {
        if (error?.code === 1) {
          return { success: true, output: 'No matches' };
        }
        if (typeof error?.stdout === 'string' && error.stdout.trim()) {
          return { success: true, output: truncateOutput(error.stdout) };
        }
        throw error;
      }
    });
  }

  async patchFile(filePath: string, oldContent: string, newContent: string): Promise<ToolResult> {
    return this.wrapExecution('patch_file', `Patching ${filePath}`, async () => {
      const policy = this.context.checkPolicy('write', filePath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const absolutePath = this.resolveTarget(filePath);
      const fileContent = await fs.readFile(absolutePath, 'utf8');
      if (!fileContent.includes(oldContent)) {
        return { success: false, output: 'Target content not found in file.' };
      }

      const patched = fileContent.replace(oldContent, newContent);
      const preview = await buildDiffPreview(filePath, fileContent, patched);

      if (policy.requiresApproval) {
        const approved = await this.withApproval('patch_file', filePath, preview);
        if (!approved) {
          return { success: false, output: 'Rejected by user.', preview };
        }
      }

      await fs.writeFile(absolutePath, patched, 'utf8');
      return { success: true, output: `Patched ${filePath}`, preview };
    });
  }

  async makeDir(dirPath: string): Promise<ToolResult> {
    return this.wrapExecution('make_dir', `Creating directory ${dirPath}`, async () => {
      const policy = this.context.checkPolicy('write', dirPath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const preview = `Create directory ${dirPath}`;
      if (policy.requiresApproval) {
        const approved = await this.withApproval('make_dir', dirPath, preview);
        if (!approved) {
          return { success: false, output: 'Rejected by user.', preview };
        }
      }

      await fs.mkdir(this.resolveTarget(dirPath), { recursive: true });
      return { success: true, output: `Created directory ${dirPath}`, preview };
    });
  }

  async writeFile(filePath: string, content: string): Promise<ToolResult> {
    return this.wrapExecution('write_file', `Writing to ${filePath}`, async () => {
      const policy = this.context.checkPolicy('write', filePath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const absolutePath = this.resolveTarget(filePath);
      const approvalPromise: ApprovalDecision = policy.requiresApproval
        ? this.withApproval('write_file', filePath, `Preparing diff preview for ${filePath}`)
        : Promise.resolve(true) as ApprovalDecision;

      let before = '';
      try {
        before = await fs.readFile(absolutePath, 'utf8');
      } catch {
        before = '';
      }

      const preview = await buildDiffPreview(filePath, before, content);
      if ('updatePreview' in approvalPromise && typeof approvalPromise.updatePreview === 'function') {
        approvalPromise.updatePreview(preview);
      }
      if (!(await approvalPromise)) {
        return { success: false, output: 'Rejected by user.', preview };
      }

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf8');
      return { success: true, output: `Successfully wrote to ${filePath}`, preview };
    });
  }

  async deleteFile(filePath: string): Promise<ToolResult> {
    return this.wrapExecution('delete_file', `Deleting ${filePath}`, async () => {
      const policy = this.context.checkPolicy('delete', filePath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const absolutePath = this.resolveTarget(filePath);
      const stat = await fs.stat(absolutePath);
      const preview = stat.isDirectory()
        ? `Delete directory ${filePath}`
        : await buildDiffPreview(filePath, await fs.readFile(absolutePath, 'utf8'), '');
      if (policy.requiresApproval) {
        const approved = await this.withApproval('delete_file', filePath, preview);
        if (!approved) {
          return { success: false, output: 'Rejected by user.', preview };
        }
      }

      if (stat.isDirectory()) {
        await fs.rm(absolutePath, { recursive: true, force: true });
      } else {
        await fs.unlink(absolutePath);
      }
      return { success: true, output: `Deleted ${filePath}`, preview };
    });
  }

  async gitStatus(): Promise<ToolResult> {
    return this.wrapExecution('git_status', 'git status -s', async () => {
      try {
        const { stdout } = await execFileAsync('git', ['status', '-s'], {
          cwd: this.context.cwd,
          maxBuffer: MAX_BUFFER_BYTES,
        });
        return { success: true, output: stdout.trim() || 'Clean tree' };
      } catch (error) {
        if (isNotGitRepository(error)) {
          return { success: true, output: 'Not a git repository.' };
        }
        throw error;
      }
    });
  }

  async gitDiff(): Promise<ToolResult> {
    return this.wrapExecution('git_diff', 'git diff', async () => {
      try {
        const { stdout } = await execFileAsync('git', ['diff', '--'], {
          cwd: this.context.cwd,
          maxBuffer: MAX_BUFFER_BYTES,
        });
        return { success: true, output: stdout.trim() || 'No output' };
      } catch (error: any) {
        if (isNotGitRepository(error)) {
          return { success: true, output: 'Not a git repository.' };
        }
        if (typeof error?.stdout === 'string' && error.stdout.trim()) {
          return {
            success: true,
            output: `${truncateOutput(error.stdout)}\n\n[git diff truncated: output exceeded buffer]`,
          };
        }
        throw error;
      }
    });
  }

  async runCommand(command: string): Promise<ToolResult> {
    return this.wrapExecution('run_command', 'Running shell command', async () => {
      const policy = this.context.checkPolicy('execute', '.');
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      if (containsUnsupportedShellSyntax(command)) {
        return {
          success: false,
          output: 'Safe command execution only supports a single executable with arguments. Shell operators, redirection, and command substitution are not supported.',
        };
      }

      const preview = `Run command: ${command}`;
      if (policy.requiresApproval) {
        const approved = await this.withApproval('run_command', command, preview);
        if (!approved) {
          return { success: false, output: 'Rejected by user.', preview };
        }
      }

      const tokens = tokenizeCommand(command);
      const [commandName, ...commandArgs] = tokens;

      if (!commandName) {
        return {
          success: false,
          output: 'Command is empty.',
          preview,
        };
      }

      const { stdout, stderr } = await execFileAsync(commandName, commandArgs, {
        cwd: this.context.cwd,
        timeout: 30000,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      return { success: true, output: truncateOutput(stdout || stderr || 'No output'), preview };
    });
  }
}
