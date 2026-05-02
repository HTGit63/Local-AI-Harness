import { ApprovalDecision, ToolActionContext, ToolDiffStats, ToolResult } from './types';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_LINES = 200;
const MAX_BUFFER_BYTES = 1024 * 1024;
const MAX_WEB_RESULTS = 5;
const MAX_WEB_FETCH_BYTES = 180_000;
const MAX_WEB_FETCH_TEXT_CHARS = 16_000;
const WEB_REQUEST_TIMEOUT_MS = 12_000;

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

function isUrlLikeArgument(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function commandArgLooksLikePath(value: string): boolean {
  if (!value || isUrlLikeArgument(value)) {
    return false;
  }

  return (
    path.isAbsolute(value) ||
    value === '.' ||
    value === '..' ||
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('~/') ||
    value.includes('/')
  );
}

function truncateOutputResult(output: string): { text: string; truncated: boolean } {
  const lines = output.split('\n');
  if (lines.length <= MAX_OUTPUT_LINES) {
    return {
      text: output.trim() || 'No output',
      truncated: false,
    };
  }

  return {
    text: `${lines.slice(0, MAX_OUTPUT_LINES).join('\n')}\n... output truncated ...`,
    truncated: true,
  };
}

function truncateOutput(output: string): string {
  return truncateOutputResult(output).text;
}

function truncateChars(value: string, limit: number): { text: string; truncated: boolean } {
  const normalized = value.trim();
  if (normalized.length <= limit) {
    return {
      text: normalized,
      truncated: false,
    };
  }

  return {
    text: `${normalized.slice(0, limit)}\n... output truncated ...`,
    truncated: true,
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return normalizeWhitespace(decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')));
}

function looksLikeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractPageTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1] ? stripHtml(match[1]) : '';
  return title || undefined;
}

function extractReadableText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/gi, '$&\n');
  return stripHtml(cleaned);
}

function resolveDuckDuckGoResultUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const absolute = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;

  try {
    const url = new URL(absolute, 'https://duckduckgo.com');
    if (url.hostname.endsWith('duckduckgo.com')) {
      const redirected = url.searchParams.get('uddg');
      if (redirected && looksLikeHttpUrl(redirected)) {
        return redirected;
      }
    }
  } catch {
    return absolute;
  }

  return absolute;
}

type ParsedWebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function parseDuckDuckGoResults(html: string): ParsedWebSearchResult[] {
  const anchorPattern = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const anchors = Array.from(html.matchAll(anchorPattern));
  const results: ParsedWebSearchResult[] = [];

  for (let index = 0; index < anchors.length && results.length < MAX_WEB_RESULTS; index += 1) {
    const match = anchors[index];
    const rawUrl = match[1] || '';
    const title = stripHtml(match[2] || '');
    if (!rawUrl || !title) {
      continue;
    }

    const start = match.index ?? 0;
    const end = index + 1 < anchors.length ? (anchors[index + 1].index ?? html.length) : html.length;
    const resultBlock = html.slice(start, end);
    const snippetMatch = resultBlock.match(/result__snippet[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    const snippet = stripHtml(snippetMatch?.[1] || '');
    results.push({
      title,
      url: resolveDuckDuckGoResultUrl(rawUrl),
      snippet,
    });
  }

  return results;
}

async function fetchTextWithTimeout(url: string): Promise<{ text: string; contentType: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEB_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal as AbortSignal,
      headers: {
        'User-Agent': 'GammaHarness/1.0 (+local agentic coding harness)',
        'Accept': 'text/html, text/plain, application/json;q=0.9, text/markdown;q=0.8, */*;q=0.2',
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const clipped = text.length > MAX_WEB_FETCH_BYTES ? text.slice(0, MAX_WEB_FETCH_BYTES) : text;
    return {
      text: clipped,
      contentType: response.headers.get('content-type') || 'text/plain',
    };
  } finally {
    clearTimeout(timeoutId);
  }
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

function countDiffStatsFromContent(before: string, after: string): ToolDiffStats {
  const beforeLines = before ? before.split('\n') : [];
  const afterLines = after ? after.split('\n') : [];
  let prefix = 0;
  let suffix = 0;

  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  while (
    suffix + prefix < beforeLines.length &&
    suffix + prefix < afterLines.length &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removedLines = Math.max(0, beforeLines.length - prefix - suffix);
  const addedLines = Math.max(0, afterLines.length - prefix - suffix);
  return {
    changedFiles: before === after ? 0 : 1,
    addedLines,
    removedLines,
  };
}

function parseUnifiedDiffStats(diff: string): ToolDiffStats {
  const lines = diff.split('\n');
  let addedLines = 0;
  let removedLines = 0;

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) {
      continue;
    }
    if (line.startsWith('+')) {
      addedLines += 1;
    } else if (line.startsWith('-')) {
      removedLines += 1;
    }
  }

  return {
    changedFiles: addedLines > 0 || removedLines > 0 ? 1 : 0,
    addedLines,
    removedLines,
  };
}

async function buildDiffPreview(filePath: string, before: string, after: string): Promise<{ preview: string; lineStats: ToolDiffStats }> {
  if (before === after) {
    return {
      preview: `No content changes for ${filePath}`,
      lineStats: { changedFiles: 0, addedLines: 0, removedLines: 0 },
    };
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
      return {
        preview: truncateOutput(stdout),
        lineStats: parseUnifiedDiffStats(stdout),
      };
    } catch (error: any) {
      if (typeof error?.stdout === 'string' && error.stdout.trim()) {
        return {
          preview: truncateOutput(error.stdout),
          lineStats: parseUnifiedDiffStats(error.stdout),
        };
      }

      return {
        preview: createSummaryPreview(filePath, before, after),
        lineStats: countDiffStatsFromContent(before, after),
      };
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

  private findCommandPathEscape(commandArgs: string[]): string | null {
    for (const arg of commandArgs) {
      if (!commandArgLooksLikePath(arg)) {
        continue;
      }

      const normalizedArg = arg.startsWith('~/')
        ? path.join(os.homedir(), arg.slice(2))
        : arg;
      const policy = this.context.checkPolicy('execute', normalizedArg);
      if (!policy.allowed) {
        return arg;
      }
    }

    return null;
  }

  private internetDisabledResult(): ToolResult {
    return {
      success: false,
      output: 'Denied: Internet access is disabled by harness configuration.',
    };
  }

  private wrapExecution(name: string, inputSummary: string, executor: () => Promise<ToolResult>): Promise<ToolResult> {
    const startedAt = Date.now();
    this.context.emitTrace('tool_call', { name, inputSummary });
    return executor()
      .then((result) => {
        const durationMs = Date.now() - startedAt;
        this.context.emitTrace('tool_result', {
          name,
          resultSummary: result.success ? 'Success' : 'Failed',
          output: truncateOutput(result.output),
          durationMs,
        });
        return {
          ...result,
          metadata: {
            ...(result.metadata ?? {}),
            durationMs,
          },
        };
      })
      .catch((error: Error) => {
        const durationMs = Date.now() - startedAt;
        this.context.emitTrace('tool_result', {
          name,
          resultSummary: 'Error',
          output: error.message,
          durationMs,
        });
        return {
          success: false,
          output: error.message,
          error: error.message,
          metadata: { durationMs },
        };
      });
  }

  async readFile(filePath: string): Promise<ToolResult> {
    return this.wrapExecution('read_file', `Reading ${filePath}`, async () => {
      const policy = this.context.checkPolicy('read', filePath);
      if (!policy.allowed) {
        return { success: false, output: `Denied: ${policy.reason}` };
      }

      const content = await fs.readFile(this.resolveTarget(filePath), 'utf8');
      return {
        success: true,
        output: content,
        metadata: {
          fileReads: [filePath],
        },
      };
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

      return {
        success: true,
        output: output || 'No entries',
        metadata: {
          directoriesRead: [dirPath],
        },
      };
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
        const truncated = truncateOutputResult(stdout);
        return {
          success: true,
          output: truncated.text || 'No matches',
          metadata: {
            searches: [{ query: pattern, pattern }],
            truncated: truncated.truncated,
          },
        };
      } catch (error) {
        if (!isMissingExecutable(error)) {
          throw error;
        }
      }

      const matcher = globToRegExp(pattern);
      const matches = (await walkFiles(this.context.cwd)).filter((file) => matcher.test(file));
      return {
        success: true,
        output: matches.join('\n') || 'No matches',
        metadata: {
          searches: [{ query: pattern, pattern }],
        },
      };
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
        const truncated = truncateOutputResult(stdout);
        return {
          success: true,
          output: truncated.text || 'No matches',
          metadata: {
            searches: [{ query, pattern: filePattern }],
            truncated: truncated.truncated,
          },
        };
      } catch (error: any) {
        if (!isMissingExecutable(error)) {
          if (typeof error?.stdout === 'string' && error.stdout.trim()) {
            const truncated = truncateOutputResult(error.stdout);
            return {
              success: true,
              output: truncated.text,
              metadata: {
                searches: [{ query, pattern: filePattern }],
                truncated: truncated.truncated,
              },
            };
          }
          if (error?.code === 1) {
            return {
              success: true,
              output: 'No matches',
              metadata: {
                searches: [{ query, pattern: filePattern }],
              },
            };
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
        const truncated = truncateOutputResult(stdout);
        return {
          success: true,
          output: truncated.text || 'No matches',
          metadata: {
            searches: [{ query, pattern: filePattern }],
            truncated: truncated.truncated,
          },
        };
      } catch (error: any) {
        if (error?.code === 1) {
          return {
            success: true,
            output: 'No matches',
            metadata: {
              searches: [{ query, pattern: filePattern }],
            },
          };
        }
        if (typeof error?.stdout === 'string' && error.stdout.trim()) {
          const truncated = truncateOutputResult(error.stdout);
          return {
            success: true,
            output: truncated.text,
            metadata: {
              searches: [{ query, pattern: filePattern }],
              truncated: truncated.truncated,
            },
          };
        }
        throw error;
      }
    });
  }

  async webSearch(query: string): Promise<ToolResult> {
    return this.wrapExecution('web_search', `Searching web for "${query}"`, async () => {
      if (this.context.internetAccessEnabled === false) {
        return this.internetDisabledResult();
      }

      const { text } = await fetchTextWithTimeout(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
      const results = parseDuckDuckGoResults(text);
      if (results.length === 0) {
        return {
          success: true,
          output: `No web results found for "${query}".`,
          metadata: {
            webSearches: [{ query, engine: 'duckduckgo_html', resultCount: 0 }],
          },
        };
      }

      const output = [
        `Web search results for "${query}"`,
        ...results.map((result, index) => [
          `${index + 1}. ${result.title}`,
          `URL: ${result.url}`,
          result.snippet ? `Snippet: ${result.snippet}` : null,
        ].filter((entry): entry is string => Boolean(entry)).join('\n')),
      ].join('\n\n');

      const truncated = truncateChars(output, MAX_WEB_FETCH_TEXT_CHARS);
      return {
        success: true,
        output: truncated.text,
        metadata: {
          webSearches: [{ query, engine: 'duckduckgo_html', resultCount: results.length }],
          webFetches: results.map((result) => ({ url: result.url, title: result.title })),
          truncated: truncated.truncated,
        },
      };
    });
  }

  async fetchUrl(url: string): Promise<ToolResult> {
    return this.wrapExecution('fetch_url', `Fetching ${url}`, async () => {
      if (this.context.internetAccessEnabled === false) {
        return this.internetDisabledResult();
      }

      if (!looksLikeHttpUrl(url)) {
        return {
          success: false,
          output: 'Only http:// and https:// URLs are supported.',
        };
      }

      const { text, contentType } = await fetchTextWithTimeout(url);
      const normalizedType = contentType.toLowerCase();
      if (!/(text\/|application\/json|application\/xml|application\/xhtml\+xml)/.test(normalizedType)) {
        return {
          success: false,
          output: `Unsupported content type: ${contentType}`,
        };
      }

      const isHtml = /text\/html|application\/xhtml\+xml/.test(normalizedType);
      const title = isHtml ? extractPageTitle(text) : undefined;
      const body = isHtml ? extractReadableText(text) : normalizeWhitespace(text);
      const truncated = truncateChars(body, MAX_WEB_FETCH_TEXT_CHARS);

      return {
        success: true,
        output: [
          `Source: ${url}`,
          title ? `Title: ${title}` : null,
          `Content-Type: ${contentType}`,
          '',
          truncated.text || 'No readable text found.',
        ].filter((entry): entry is string => entry !== null).join('\n'),
        metadata: {
          webFetches: [{ url, title }],
          truncated: truncated.truncated || text.length > MAX_WEB_FETCH_BYTES,
        },
      };
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
      const diff = await buildDiffPreview(filePath, fileContent, patched);

      if (policy.requiresApproval) {
        const approved = await this.withApproval('patch_file', filePath, diff.preview);
        if (!approved) {
          return {
            success: false,
            output: 'Rejected by user.',
            preview: diff.preview,
            metadata: {
              fileWrites: [filePath],
              lineStats: diff.lineStats,
            },
          };
        }
      }

      await fs.writeFile(absolutePath, patched, 'utf8');
      return {
        success: true,
        output: `Patched ${filePath}`,
        preview: diff.preview,
        metadata: {
          fileWrites: [filePath],
          lineStats: diff.lineStats,
        },
      };
    });
  }

  async previewPatch(filePath: string, oldContent: string, newContent: string): Promise<ToolResult> {
    return this.wrapExecution('patch_preview', `Previewing patch for ${filePath}`, async () => {
      const diff = await buildDiffPreview(filePath, oldContent, newContent);
      return {
        success: true,
        output: diff.preview,
        preview: diff.preview,
        metadata: {
          lineStats: diff.lineStats,
        },
      };
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
      return {
        success: true,
        output: `Created directory ${dirPath}`,
        preview,
        metadata: {
          directoriesCreated: [dirPath],
        },
      };
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

      const diff = await buildDiffPreview(filePath, before, content);
      if ('updatePreview' in approvalPromise && typeof approvalPromise.updatePreview === 'function') {
        approvalPromise.updatePreview(diff.preview);
      }
      if (!(await approvalPromise)) {
        return {
          success: false,
          output: 'Rejected by user.',
          preview: diff.preview,
          metadata: {
            fileWrites: [filePath],
            lineStats: diff.lineStats,
          },
        };
      }

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, 'utf8');
      return {
        success: true,
        output: `Successfully wrote to ${filePath}`,
        preview: diff.preview,
        metadata: {
          fileWrites: [filePath],
          lineStats: diff.lineStats,
        },
      };
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
      const diff = stat.isDirectory()
        ? {
            preview: `Delete directory ${filePath}`,
            lineStats: { changedFiles: 0, addedLines: 0, removedLines: 0 },
          }
        : await buildDiffPreview(filePath, await fs.readFile(absolutePath, 'utf8'), '');
      if (policy.requiresApproval) {
        const approved = await this.withApproval('delete_file', filePath, diff.preview);
        if (!approved) {
          return {
            success: false,
            output: 'Rejected by user.',
            preview: diff.preview,
            metadata: {
              fileDeletes: stat.isDirectory() ? undefined : [filePath],
              lineStats: diff.lineStats,
            },
          };
        }
      }

      if (stat.isDirectory()) {
        await fs.rm(absolutePath, { recursive: true, force: true });
      } else {
        await fs.unlink(absolutePath);
      }
      return {
        success: true,
        output: `Deleted ${filePath}`,
        preview: diff.preview,
        metadata: {
          fileDeletes: stat.isDirectory() ? undefined : [filePath],
          lineStats: diff.lineStats,
        },
      };
    });
  }

  async gitStatus(): Promise<ToolResult> {
    return this.wrapExecution('git_status', 'git status -s', async () => {
      try {
        const { stdout } = await execFileAsync('git', ['status', '-s'], {
          cwd: this.context.cwd,
          maxBuffer: MAX_BUFFER_BYTES,
        });
        return {
          success: true,
          output: stdout.trim() || 'Clean tree',
          metadata: {
            command: {
              command: 'git status -s',
              success: true,
            },
          },
        };
      } catch (error) {
        if (isNotGitRepository(error)) {
          return {
            success: true,
            output: 'Not a git repository.',
            metadata: {
              command: {
                command: 'git status -s',
                success: true,
              },
            },
          };
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
        const truncated = truncateOutputResult(stdout);
        return {
          success: true,
          output: truncated.text || 'No output',
          metadata: {
            command: {
              command: 'git diff --',
              success: true,
            },
            truncated: truncated.truncated,
          },
        };
      } catch (error: any) {
        if (isNotGitRepository(error)) {
          return {
            success: true,
            output: 'Not a git repository.',
            metadata: {
              command: {
                command: 'git diff --',
                success: true,
              },
            },
          };
        }
        if (typeof error?.stdout === 'string' && error.stdout.trim()) {
          return {
            success: true,
            output: `${truncateOutput(error.stdout)}\n\n[git diff truncated: output exceeded buffer]`,
            metadata: {
              command: {
                command: 'git diff --',
                success: true,
              },
              truncated: true,
            },
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
      const tokens = tokenizeCommand(command);
      const [commandName, ...commandArgs] = tokens;

      if (!commandName) {
        return {
          success: false,
          output: 'Command is empty.',
          preview,
        };
      }

      const escapedArg = this.findCommandPathEscape(commandArgs);
      if (escapedArg) {
        return {
          success: false,
          output: `Denied: Command argument "${escapedArg}" resolves outside the workspace root.`,
          preview,
        };
      }

      if (policy.requiresApproval) {
        const approved = await this.withApproval('run_command', command, preview);
        if (!approved) {
          return { success: false, output: 'Rejected by user.', preview };
        }
      }

      const commandStartedAt = Date.now();
      const { stdout, stderr } = await execFileAsync(commandName, commandArgs, {
        cwd: this.context.cwd,
        timeout: 30000,
        maxBuffer: MAX_BUFFER_BYTES,
      });
      const truncated = truncateOutputResult(stdout || stderr || 'No output');

      return {
        success: true,
        output: truncated.text,
        preview,
        metadata: {
          command: {
            command,
            success: true,
            durationMs: Date.now() - commandStartedAt,
          },
          truncated: truncated.truncated,
        },
      };
    });
  }
}
