import * as fs from 'fs/promises';
import * as path from 'path';
import type { TraceEvent } from '@local-harness/trace-bus';

export type HarnessLogPromptMode = 'off' | 'summary' | 'full';
export type HarnessLogSource = 'core' | 'trace' | 'model' | 'runtime' | 'tool' | 'api';
export type HarnessLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface HarnessLogEvent {
  timestamp: number;
  isoTime: string;
  runId: string;
  sessionId?: string;
  requestId?: string;
  stepId?: string;
  goalId?: string;
  eventType: string;
  source: HarnessLogSource;
  level: HarnessLogLevel;
  data?: unknown;
}

export interface HarnessRunLoggerOptions {
  workspaceRoot: string;
  runId: string;
  sessionId?: string;
  executionMode: 'chat' | 'agent';
  promptMode?: string;
  model?: string;
}

export interface HarnessRunSummary {
  runId: string;
  sessionId?: string;
  executionMode: 'chat' | 'agent';
  status: 'done' | 'error';
  model?: string;
  promptMode?: string;
  workspaceRoot: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  summary?: string;
  error?: string;
  eventCount: number;
  logPath: string;
  summaryPath: string;
}

export interface HarnessLogRunListItem {
  runId: string;
  date: string;
  executionMode?: 'chat' | 'agent';
  status?: string;
  model?: string;
  promptMode?: string;
  startedAt?: number;
  endedAt?: number;
  eventCount?: number;
  summary?: string;
  logPath: string;
  summaryPath?: string;
  sizeBytes: number;
}

const MAX_STRING_CHARS = 12_000;
const MAX_ARRAY_ITEMS = 60;
const MAX_OBJECT_KEYS = 80;
const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|bearer|cookie|password|secret|session[_-]?secret|token)/i;
const RUN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export function resolveHarnessLogPromptMode(value = process.env.HARNESS_LOG_PROMPTS): HarnessLogPromptMode {
  return value === 'off' || value === 'full' || value === 'summary' ? value : 'summary';
}

export function getHarnessLogRoot(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, '.gamma-harness', 'logs');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED_SECRET]')
    .replace(/\b(?:sk|rk|pat|ghp|gho|github_pat|xox[baprs]?)-[A-Za-z0-9_=-]{8,}\b/gi, '[REDACTED_SECRET]')
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, '[REDACTED_JWT]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]')
    .replace(/\b(api[_-]?key|token|secret|password|authorization)\b\s*[:=]\s*["']?[^"'\s,;}]+/gi, '$1=[REDACTED_SECRET]');
}

function summarizePromptText(value: string): string {
  const normalized = redactString(value).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function shouldTreatAsPrompt(key?: string): boolean {
  return key === 'messages' || key === 'prompt' || key === 'content' || key === 'systemPrompt' || key === 'userPrompt';
}

export function redactHarnessLogValue(value: unknown, promptMode = resolveHarnessLogPromptMode(), key?: string): unknown {
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    if (shouldTreatAsPrompt(key)) {
      if (promptMode === 'off') {
        return '[PROMPT_LOGGING_OFF]';
      }
      if (promptMode === 'summary') {
        return summarizePromptText(value);
      }
    }
    const redacted = redactString(value);
    return redacted.length > MAX_STRING_CHARS ? `${redacted.slice(0, MAX_STRING_CHARS)}...` : redacted;
  }

  if (Array.isArray(value)) {
    if (shouldTreatAsPrompt(key)) {
      if (promptMode === 'off') {
        return '[PROMPT_LOGGING_OFF]';
      }
      if (promptMode === 'summary') {
        return value.slice(0, 20).map((entry) => {
          if (!isRecord(entry)) {
            return redactHarnessLogValue(entry, promptMode);
          }
          return {
            role: typeof entry.role === 'string' ? entry.role : 'unknown',
            contentSummary: summarizePromptText(typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content ?? '')),
          };
        });
      }
    }
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => redactHarnessLogValue(entry, promptMode, key));
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS).map(([entryKey, entryValue]) => {
      if (SECRET_KEY_PATTERN.test(entryKey)) {
        return [entryKey, '[REDACTED_SECRET]'];
      }
      return [entryKey, redactHarnessLogValue(entryValue, promptMode, entryKey)];
    });
    return Object.fromEntries(entries);
  }

  return '[UNSERIALIZABLE]';
}

function datePart(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function assertSafeRunId(runId: string): void {
  if (!RUN_ID_PATTERN.test(runId) || runId.includes('/') || runId.includes('\\') || runId.includes('..')) {
    throw new Error('Invalid run id.');
  }
}

async function findRunLogPath(workspaceRoot: string, runId: string, suffix: '.jsonl' | '.summary.json'): Promise<string | null> {
  assertSafeRunId(runId);
  const root = getHarnessLogRoot(workspaceRoot);
  let dates: string[] = [];
  try {
    dates = await fs.readdir(root);
  } catch {
    return null;
  }

  for (const date of dates.sort((a, b) => b.localeCompare(a))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }
    const candidate = path.resolve(root, date, `${runId}${suffix}`);
    if (!candidate.startsWith(`${path.resolve(root)}${path.sep}`)) {
      throw new Error('Invalid log path.');
    }
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue searching dates.
    }
  }
  return null;
}

export class HarnessRunLogger {
  readonly runId: string;
  readonly sessionId?: string;
  readonly executionMode: 'chat' | 'agent';
  readonly startedAt: number;
  readonly logPath: string;
  readonly summaryPath: string;
  private readonly workspaceRoot: string;
  private readonly model?: string;
  private readonly promptMode?: string;
  private readonly logPromptMode: HarnessLogPromptMode;
  private eventCount = 0;
  private pending = Promise.resolve();
  private lastWarning: string | null = null;

  constructor(options: HarnessRunLoggerOptions) {
    assertSafeRunId(options.runId);
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    this.runId = options.runId;
    this.sessionId = options.sessionId;
    this.executionMode = options.executionMode;
    this.promptMode = options.promptMode;
    this.model = options.model;
    this.startedAt = Date.now();
    this.logPromptMode = resolveHarnessLogPromptMode();
    const dir = path.join(getHarnessLogRoot(this.workspaceRoot), datePart(this.startedAt));
    this.logPath = path.join(dir, `${this.runId}.jsonl`);
    this.summaryPath = path.join(dir, `${this.runId}.summary.json`);
  }

  get warning(): string | null {
    return this.lastWarning;
  }

  write(event: {
    eventType: string;
    source?: HarnessLogSource;
    level?: HarnessLogLevel;
    data?: unknown;
    requestId?: string;
    stepId?: string;
    goalId?: string;
  }): Promise<void> {
    const timestamp = Date.now();
    const payload: HarnessLogEvent = {
      timestamp,
      isoTime: new Date(timestamp).toISOString(),
      runId: this.runId,
      sessionId: this.sessionId,
      requestId: event.requestId,
      stepId: event.stepId,
      goalId: event.goalId,
      eventType: event.eventType,
      source: event.source ?? 'core',
      level: event.level ?? 'info',
      data: redactHarnessLogValue(event.data, this.logPromptMode),
    };
    this.eventCount += 1;
    this.pending = this.pending
      .then(async () => {
        await fs.mkdir(path.dirname(this.logPath), { recursive: true });
        await fs.appendFile(this.logPath, `${JSON.stringify(payload)}\n`, 'utf8');
      })
      .catch((error: any) => {
        this.lastWarning = error?.message || 'Harness log write failed.';
      });
    return this.pending;
  }

  writeTrace(event: TraceEvent): Promise<void> {
    return this.write({
      eventType: event.type,
      source: 'trace',
      data: {
        traceId: event.id,
        traceTimestamp: event.timestamp,
        ...(isRecord(event.data) ? event.data : { value: event.data }),
      },
    });
  }

  async writeSummary(input: {
    status: 'done' | 'error';
    summary?: string;
    error?: string;
  }): Promise<HarnessRunSummary> {
    await this.flush();
    const endedAt = Date.now();
    const summary: HarnessRunSummary = {
      runId: this.runId,
      sessionId: this.sessionId,
      executionMode: this.executionMode,
      status: input.status,
      model: this.model,
      promptMode: this.promptMode,
      workspaceRoot: this.workspaceRoot,
      startedAt: this.startedAt,
      endedAt,
      durationMs: endedAt - this.startedAt,
      summary: input.summary,
      error: input.error,
      eventCount: this.eventCount,
      logPath: this.logPath,
      summaryPath: this.summaryPath,
    };
    this.pending = this.pending
      .then(async () => {
        await fs.mkdir(path.dirname(this.summaryPath), { recursive: true });
        await fs.writeFile(this.summaryPath, `${JSON.stringify(redactHarnessLogValue(summary, this.logPromptMode), null, 2)}\n`, 'utf8');
      })
      .catch((error: any) => {
        this.lastWarning = error?.message || 'Harness summary write failed.';
      });
    await this.pending;
    return summary;
  }

  async flush(): Promise<void> {
    await this.pending;
  }
}

export async function listHarnessLogRuns(workspaceRoot: string, limit = 50): Promise<HarnessLogRunListItem[]> {
  const root = getHarnessLogRoot(workspaceRoot);
  let dates: string[] = [];
  try {
    dates = await fs.readdir(root);
  } catch {
    return [];
  }

  const runs: HarnessLogRunListItem[] = [];
  for (const date of dates.sort((a, b) => b.localeCompare(a))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      continue;
    }
    const dir = path.join(root, date);
    const files = await fs.readdir(dir).catch(() => []);
    for (const file of files.filter((entry) => entry.endsWith('.jsonl')).sort((a, b) => b.localeCompare(a))) {
      const runId = file.slice(0, -'.jsonl'.length);
      if (!RUN_ID_PATTERN.test(runId)) {
        continue;
      }
      const logPath = path.join(dir, file);
      const summaryPath = path.join(dir, `${runId}.summary.json`);
      const stat = await fs.stat(logPath).catch(() => null);
      const summary = await readHarnessRunSummary(workspaceRoot, runId).catch(() => null);
      runs.push({
        runId,
        date,
        executionMode: summary?.executionMode,
        status: summary?.status,
        model: summary?.model,
        promptMode: summary?.promptMode,
        startedAt: summary?.startedAt,
        endedAt: summary?.endedAt,
        eventCount: summary?.eventCount,
        summary: summary?.summary,
        logPath,
        summaryPath,
        sizeBytes: stat?.size ?? 0,
      });
      if (runs.length >= limit) {
        return runs;
      }
    }
  }
  return runs;
}

export async function readHarnessRunLog(workspaceRoot: string, runId: string): Promise<{ runId: string; path: string; events: HarnessLogEvent[] } | null> {
  const logPath = await findRunLogPath(workspaceRoot, runId, '.jsonl');
  if (!logPath) {
    return null;
  }
  const text = await fs.readFile(logPath, 'utf8');
  const events = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HarnessLogEvent)
    .map((event) => redactHarnessLogValue(event, resolveHarnessLogPromptMode()) as HarnessLogEvent);
  return { runId, path: logPath, events };
}

export async function readHarnessRunSummary(workspaceRoot: string, runId: string): Promise<HarnessRunSummary | null> {
  const summaryPath = await findRunLogPath(workspaceRoot, runId, '.summary.json');
  if (!summaryPath) {
    return null;
  }
  const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8')) as HarnessRunSummary;
  return redactHarnessLogValue(summary, resolveHarnessLogPromptMode()) as HarnessRunSummary;
}
