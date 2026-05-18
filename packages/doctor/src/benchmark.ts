import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001/api';
const DEFAULT_MODEL = 'gemma4:e4b';
const DEFAULT_TIMEOUT_MS = 30_000;
const ONE_PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBApV6X9kAAAAASUVORK5CYII=';

export interface BenchmarkOptions {
  baseUrl?: string;
  apiBaseUrl?: string;
  model?: string;
  workspaceRoot?: string;
  quiet?: boolean;
  timeoutMs?: number;
}

interface BenchmarkMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

interface BenchmarkScenario {
  name: string;
  note: string;
  mode: 'chat' | 'agent';
  thinking: boolean;
  messages: BenchmarkMessage[];
  images?: string[];
}

interface TurnTiming {
  ok: boolean;
  totalMs: number;
  firstDeltaMs: number;
  statusCount: number;
  deltaCount: number;
  executionCount: number;
  responseLength: number;
  responsePreview: string;
  error?: string;
}

export interface BenchmarkScenarioResult extends BenchmarkScenario {
  cold: TurnTiming;
  warm: TurnTiming;
}

export interface BenchmarkResults {
  apiBaseUrl: string;
  model: string;
  workspaceRoot: string;
  hardware: {
    cpuOnly: boolean;
    ram: string;
    runtime: string;
  };
  scenarios: BenchmarkScenarioResult[];
  support: {
    fileWriteLatency: number;
    fileReadLatency: number;
    writePreviewLatency: number;
    toolLoopLatency: number;
    uiEventLag: number;
  };
}

function resolveApiBaseUrl(options: BenchmarkOptions): string {
  return (options.apiBaseUrl || options.baseUrl || process.env.HARNESS_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

function resolveModel(options: BenchmarkOptions): string {
  return (options.model || process.env.HARNESS_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function createBenchmarkScenarios(): BenchmarkScenario[] {
  return [
    {
      name: 'Chat Mode',
      note: 'Baseline plain turn with thinking off.',
      mode: 'chat',
      thinking: false,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    },
    {
      name: 'Agent Work',
      note: 'Planner and trace route without tool pressure.',
      mode: 'agent',
      thinking: false,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    },
    {
      name: 'Tool call',
      note: 'Native tool loop on workspace file read.',
      mode: 'agent',
      thinking: false,
      messages: [{ role: 'user', content: 'Read package.json and return the package name.' }],
    },
    {
      name: 'Image turn',
      note: 'Multimodal pass through raw image bytes.',
      mode: 'chat',
      thinking: false,
      messages: [{ role: 'user', content: 'Describe this image in one short sentence.' }],
      images: [ONE_PIXEL_PNG_BASE64],
    },
    {
      name: 'Think on',
      note: 'Same chat prompt with thinking enabled.',
      mode: 'chat',
      thinking: true,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    },
  ];
}

function parseNdjsonEvent(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function extractString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

async function measureChatTurn(apiBaseUrl: string, scenario: BenchmarkScenario, timeoutMs: number): Promise<TurnTiming> {
  const startedAt = Date.now();
  let firstDeltaMs = 0;
  let seenVisibleEvent = false;
  let statusCount = 0;
  let deltaCount = 0;
  let executionCount = 0;
  let responseText = '';

  try {
    const response = await fetch(`${apiBaseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: scenario.messages,
        mode: scenario.mode,
        thinking: scenario.thinking,
        images: scenario.images,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText ? `${response.status} ${response.statusText}: ${errorText}` : `${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Stream response missing body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex !== -1) {
          const rawLine = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (!rawLine) {
            continue;
          }

          const event = parseNdjsonEvent(rawLine);
          if (!event) {
            continue;
          }

          const eventType = extractString(event.type);
          const now = Date.now();

          if (!seenVisibleEvent && (eventType === 'delta' || eventType === 'done')) {
            firstDeltaMs = now - startedAt;
            seenVisibleEvent = true;
          }

          if (eventType === 'status') {
            statusCount += 1;
            if (extractString(event.phase) === 'execution') {
              executionCount += 1;
            }
            continue;
          }

          if (eventType === 'delta') {
            const delta = extractString(event.delta);
            if (delta) {
              deltaCount += 1;
              responseText += delta;
            }
            continue;
          }

          if (eventType === 'done') {
            const doneResponse = extractString(event.response);
            if (doneResponse) {
              responseText = doneResponse;
            }
            continue;
          }

          if (eventType === 'error') {
            throw new Error(extractString(event.message) || 'Stream failed.');
          }
        }
      }

      const tail = decoder.decode().trim();
      if (tail) {
        const event = parseNdjsonEvent(tail);
        if (event) {
          const eventType = extractString(event.type);
          const now = Date.now();

          if (!seenVisibleEvent && (eventType === 'delta' || eventType === 'done')) {
            firstDeltaMs = now - startedAt;
            seenVisibleEvent = true;
          }

          if (eventType === 'status') {
            statusCount += 1;
            if (extractString(event.phase) === 'execution') {
              executionCount += 1;
            }
          } else if (eventType === 'delta') {
            const delta = extractString(event.delta);
            if (delta) {
              deltaCount += 1;
              responseText += delta;
            }
          } else if (eventType === 'done') {
            const doneResponse = extractString(event.response);
            if (doneResponse) {
              responseText = doneResponse;
            }
          } else if (eventType === 'error') {
            throw new Error(extractString(event.message) || 'Stream failed.');
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const totalMs = Date.now() - startedAt;
    return {
      ok: true,
      totalMs,
      firstDeltaMs: seenVisibleEvent ? firstDeltaMs : totalMs,
      statusCount,
      deltaCount,
      executionCount,
      responseLength: responseText.length,
      responsePreview: responseText.slice(0, 120),
    };
  } catch (error: any) {
    const totalMs = Date.now() - startedAt;
    const message = error?.message || 'Benchmark turn failed.';
    return {
      ok: false,
      totalMs,
      firstDeltaMs: seenVisibleEvent ? firstDeltaMs : totalMs,
      statusCount,
      deltaCount,
      executionCount,
      responseLength: responseText.length,
      responsePreview: responseText.slice(0, 120),
      error: message,
    };
  }
}

async function measureScenario(apiBaseUrl: string, scenario: BenchmarkScenario, timeoutMs: number): Promise<BenchmarkScenarioResult> {
  const cold = await measureChatTurn(apiBaseUrl, scenario, timeoutMs);
  const warm = await measureChatTurn(apiBaseUrl, scenario, timeoutMs);
  return {
    ...scenario,
    cold,
    warm,
  };
}

async function measureSupportMetrics(): Promise<BenchmarkResults['support']> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-bench-'));
  const tempFile = path.join(tempDir, 'file.txt');

  const writeStart = Date.now();
  await fs.writeFile(tempFile, 'benchmark test data '.repeat(250), 'utf8');
  const fileWriteLatency = Date.now() - writeStart;

  const readStart = Date.now();
  await fs.readFile(tempFile, 'utf8');
  const fileReadLatency = Date.now() - readStart;
  await fs.rm(tempDir, { recursive: true, force: true });

  const toolBus = new EventEmitter();
  const toolStart = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    toolBus.emit('trace', { type: 'tool_call', data: { name: 'test' } });
  }
  const toolLoopLatency = Date.now() - toolStart;

  const diffStart = Date.now();
  const before = 'const x = 1;\n'.repeat(100);
  const after = 'const x = 2;\n'.repeat(100);
  const preview = before !== after ? `changed ${before.length} -> ${after.length}` : 'unchanged';
  void preview;
  const writePreviewLatency = Date.now() - diffStart;

  const uiBus = new EventEmitter();
  let eventCount = 0;
  uiBus.on('ui_event', () => {
    eventCount += 1;
  });
  const uiStart = Date.now();
  for (let index = 0; index < 10000; index += 1) {
    uiBus.emit('ui_event', { type: 'trace' });
  }
  const uiEventLag = Date.now() - uiStart;
  void eventCount;

  return {
    fileWriteLatency,
    fileReadLatency,
    writePreviewLatency,
    toolLoopLatency,
    uiEventLag,
  };
}

function formatTurnTiming(turn: TurnTiming): string {
  const base = `${turn.totalMs}ms total / ${turn.firstDeltaMs}ms first token / ${turn.statusCount} status / ${turn.deltaCount} delta / ${turn.executionCount} execution`;
  if (turn.ok) {
    return `${base} / ${turn.responseLength} chars`;
  }

  return `${base} / ${turn.responseLength} chars / error: ${turn.error}`;
}

function printScenarioResult(result: BenchmarkScenarioResult) {
  console.log(`- ${result.name} (${result.mode}, think ${result.thinking ? 'on' : 'off'})`);
  console.log(`  note: ${result.note}`);
  console.log(`  cold: ${formatTurnTiming(result.cold)}`);
  console.log(`  warm: ${formatTurnTiming(result.warm)}`);
}

export async function runBenchmarks(options: BenchmarkOptions = {}): Promise<BenchmarkResults> {
  const apiBaseUrl = resolveApiBaseUrl(options);
  const model = resolveModel(options);
  const workspaceRoot = path.resolve(options.workspaceRoot || process.cwd());
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const scenarios = createBenchmarkScenarios();

  if (!options.quiet) {
    console.log('--- Gamma 4 Harness Benchmarks ---');
    console.log(`API base: ${apiBaseUrl}`);
    console.log(`Model: ${model}`);
    console.log('Matrix: Chat Mode, Agent Work, tool call, image turn, think on/off');
  }

  const matrix: BenchmarkScenarioResult[] = [];
  for (const scenario of scenarios) {
    const result = await measureScenario(apiBaseUrl, scenario, timeoutMs);
    matrix.push(result);
    if (!options.quiet) {
      printScenarioResult(result);
    }
  }

  const support = await measureSupportMetrics();

  if (!options.quiet) {
    console.log('- Support metrics');
    console.log(`  file write: ${support.fileWriteLatency}ms`);
    console.log(`  file read: ${support.fileReadLatency}ms`);
    console.log(`  write preview: ${support.writePreviewLatency}ms`);
    console.log(`  tool loop: ${support.toolLoopLatency}ms`);
    console.log(`  ui event lag: ${support.uiEventLag}ms`);
  }

  return {
    apiBaseUrl,
    model,
    workspaceRoot,
    hardware: {
      cpuOnly: true,
      ram: '16 GB',
      runtime: 'Local Ollama',
    },
    scenarios: matrix,
    support,
  };
}
