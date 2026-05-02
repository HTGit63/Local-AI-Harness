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
  agentic: boolean;
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
  toolCount: number;
  executionCount: number;
  responseLength: number;
  responsePreview: string;
  error?: string;
}

export interface BenchmarkScenarioResult extends BenchmarkScenario {
  protocol: 'direct' | 'agentic';
  cold: TurnTiming;
  warm: TurnTiming;
  telemetry: {
    parseFailureCount: number;
    routingNotes: string[];
    memoryNotes: string[];
  };
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

interface TraceEventLike {
  type: string;
  data: unknown;
  timestamp?: number;
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
      name: 'Direct chat',
      note: 'Baseline plain turn with thinking off.',
      agentic: false,
      thinking: false,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    },
    {
      name: 'Agentic chat',
      note: 'Planner and trace route without tool pressure.',
      agentic: true,
      thinking: false,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
    },
    {
      name: 'Tool call',
      note: 'Native tool loop on workspace file read.',
      agentic: true,
      thinking: false,
      messages: [{ role: 'user', content: 'Read package.json and return the package name.' }],
    },
    {
      name: 'Image turn',
      note: 'Multimodal pass through raw image bytes.',
      agentic: false,
      thinking: false,
      messages: [{ role: 'user', content: 'Describe this image in one short sentence.' }],
      images: [ONE_PIXEL_PNG_BASE64],
    },
    {
      name: 'Think on',
      note: 'Same direct prompt with thinking enabled.',
      agentic: false,
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

function extractTraceData(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function summarizeTraceTelemetry(events: TraceEventLike[]) {
  const routingNotes = new Set<string>();
  const memoryNotes = new Set<string>();
  let parseFailureCount = 0;

  for (const event of events) {
    const data = extractTraceData(event.data);
    switch (event.type) {
      case 'action_dsl_parse_failed':
        parseFailureCount += 1;
        if (typeof data?.error === 'object' && data.error) {
          const error = data.error as { code?: unknown; message?: unknown };
          const code = typeof error.code === 'string' ? error.code : 'unknown';
          const message = typeof error.message === 'string' ? error.message : '';
          routingNotes.add(`Action DSL parse failed: ${code}${message ? ` (${message})` : ''}`);
        }
        break;
      case 'action_dsl_repair_started':
        routingNotes.add(`Action DSL repair attempt ${typeof data?.attempt === 'number' ? data.attempt : ''}`.trim());
        break;
      case 'action_dsl_repair_succeeded':
        routingNotes.add(`Action DSL repair succeeded${typeof data?.attempt === 'number' ? ` on attempt ${data.attempt}` : ''}`);
        break;
      case 'model_route_selected':
        routingNotes.add(
          typeof data?.reason === 'string'
            ? data.reason
            : `Route ${extractString(data?.protocol) || 'agent'} → ${extractString(data?.agentModel) || 'model'}`,
        );
        break;
      case 'action_dsl_protocol_selected':
        routingNotes.add('Action DSL protocol selected');
        break;
      case 'manual_tool_fallback':
        routingNotes.add(`Manual tool fallback: ${extractString(data?.reason) || 'enabled'}`);
        break;
      case 'manual_tool_strategy_selected':
        routingNotes.add(`Manual tool strategy selected: ${extractString(data?.reason) || 'forced'}`);
        break;
      case 'heavy_model_lock_acquired':
        memoryNotes.add(`Heavy model lock acquired${typeof data?.queued === 'number' ? ` (queued ${data.queued})` : ''}`);
        break;
      case 'heavy_model_lock_released':
        memoryNotes.add('Heavy model lock released');
        break;
      case 'model_warmup_completed':
        {
          const route = data?.route && typeof data.route === 'object'
            ? data.route as { model?: unknown }
            : undefined;
          memoryNotes.add(`Model warmup completed for ${extractString(route?.model) || 'agent model'}`);
        }
        break;
      case 'stream_idle_timeout_retry':
        memoryNotes.add(`Stream stalled after ${typeof data?.timeoutMs === 'number' ? data.timeoutMs : 0}ms`);
        break;
      case 'stream_idle_timeout_partial':
        memoryNotes.add(`Stream stalled after ${typeof data?.timeoutMs === 'number' ? data.timeoutMs : 0}ms with partial output`);
        break;
      default:
        break;
    }
  }

  return {
    parseFailureCount,
    routingNotes: Array.from(routingNotes),
    memoryNotes: Array.from(memoryNotes),
  };
}

async function measureChatTurn(apiBaseUrl: string, scenario: BenchmarkScenario, timeoutMs: number): Promise<TurnTiming> {
  const startedAt = Date.now();
  let firstDeltaMs = 0;
  let seenVisibleEvent = false;
  let statusCount = 0;
  let deltaCount = 0;
  let toolCount = 0;
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
        agentic: scenario.agentic,
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

          if (eventType === 'tool') {
            toolCount += 1;
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
          } else if (eventType === 'tool') {
            toolCount += 1;
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
      toolCount,
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
      toolCount,
      executionCount,
      responseLength: responseText.length,
      responsePreview: responseText.slice(0, 120),
      error: message,
    };
  }
}

async function readLatestTraceTimestamp(apiBaseUrl: string): Promise<number> {
  try {
    const response = await fetch(`${apiBaseUrl}/trace?limit=1`);
    if (!response.ok) {
      return 0;
    }
    const trace = await response.json() as TraceEventLike[];
    const last = Array.isArray(trace) && trace.length > 0 ? trace[trace.length - 1] : null;
    return typeof last?.timestamp === 'number' ? last.timestamp : 0;
  } catch {
    return 0;
  }
}

async function readTraceEventsSince(apiBaseUrl: string, since: number): Promise<TraceEventLike[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/trace?since=${since}`);
    if (!response.ok) {
      return [];
    }
    const trace = await response.json() as TraceEventLike[];
    return Array.isArray(trace) ? trace : [];
  } catch {
    return [];
  }
}

async function measureScenario(apiBaseUrl: string, scenario: BenchmarkScenario, timeoutMs: number): Promise<BenchmarkScenarioResult> {
  const traceSince = await readLatestTraceTimestamp(apiBaseUrl);
  const cold = await measureChatTurn(apiBaseUrl, scenario, timeoutMs);
  const warm = await measureChatTurn(apiBaseUrl, scenario, timeoutMs);
  const telemetry = summarizeTraceTelemetry(await readTraceEventsSince(apiBaseUrl, traceSince));
  return {
    ...scenario,
    protocol: scenario.agentic ? 'agentic' : 'direct',
    cold,
    warm,
    telemetry,
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
  const base = `${turn.totalMs}ms total / ${turn.firstDeltaMs}ms first token / ${turn.statusCount} status / ${turn.deltaCount} delta / ${turn.toolCount} tool / ${turn.executionCount} execution`;
  if (turn.ok) {
    return `${base} / ${turn.responseLength} chars`;
  }

  return `${base} / ${turn.responseLength} chars / error: ${turn.error}`;
}

function printScenarioResult(result: BenchmarkScenarioResult) {
  console.log(`- ${result.name}`);
  console.log(`  protocol: ${result.protocol}`);
  console.log(`  think: ${result.thinking ? 'on' : 'off'}`);
  console.log(`  note: ${result.note}`);
  console.log(`  cold: ${formatTurnTiming(result.cold)}`);
  console.log(`  warm: ${formatTurnTiming(result.warm)}`);
  console.log(`  parse failures: ${result.telemetry.parseFailureCount}`);
  if (result.telemetry.routingNotes.length > 0) {
    console.log(`  routing: ${result.telemetry.routingNotes.join(' | ')}`);
  }
  if (result.telemetry.memoryNotes.length > 0) {
    console.log(`  memory: ${result.telemetry.memoryNotes.join(' | ')}`);
  }
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
    console.log('Matrix: direct chat, agentic chat, tool call, image turn, think on/off');
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
