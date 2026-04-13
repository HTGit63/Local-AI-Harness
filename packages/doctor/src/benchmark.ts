import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface BenchmarkOptions {
  baseUrl?: string;
  model?: string;
  quiet?: boolean;
}

export async function runBenchmarks(options: BenchmarkOptions = {}) {
  const baseUrl = options.baseUrl || process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1';
  const model = options.model || 'gemma4:e4b';
  const results: Record<string, number> = {};

  if (!options.quiet) {
    console.log('--- Gamma 4 Harness Benchmarks ---');
  }

  const payload = {
    model,
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 32,
    temperature: 0.1,
    stream: false,
  };

  const coldStart = Date.now();
  try {
    await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || 'ollama'}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // Keep the timer so the benchmark still reports failure latency.
  }
  results.coldLatency = Date.now() - coldStart;
  if (!options.quiet) {
    console.log(`Cold prompt latency: ${results.coldLatency}ms`);
  }

  const warmStart = Date.now();
  try {
    await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || 'ollama'}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // Keep the timer so the benchmark still reports failure latency.
  }
  results.warmLatency = Date.now() - warmStart;
  if (!options.quiet) {
    console.log(`Warm prompt latency: ${results.warmLatency}ms`);
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gamma-bench-'));
  const tempFile = path.join(tempDir, 'file.txt');
  const writeStart = Date.now();
  await fs.writeFile(tempFile, 'benchmark test data '.repeat(250), 'utf8');
  results.fileWriteLatency = Date.now() - writeStart;

  const readStart = Date.now();
  await fs.readFile(tempFile, 'utf8');
  results.fileReadLatency = Date.now() - readStart;
  await fs.rm(tempDir, { recursive: true, force: true });
  if (!options.quiet) {
    console.log(`File write latency: ${results.fileWriteLatency}ms`);
    console.log(`File read latency: ${results.fileReadLatency}ms`);
  }

  const toolBus = new EventEmitter();
  const toolStart = Date.now();
  for (let index = 0; index < 1000; index += 1) {
    toolBus.emit('trace', { type: 'tool_call', data: { name: 'test' } });
  }
  results.toolLoopLatency = Date.now() - toolStart;
  if (!options.quiet) {
    console.log(`Tool loop latency: ${results.toolLoopLatency}ms`);
  }

  const diffStart = Date.now();
  const before = 'const x = 1;\n'.repeat(100);
  const after = 'const x = 2;\n'.repeat(100);
  const preview = before !== after ? `changed ${before.length} -> ${after.length}` : 'unchanged';
  void preview;
  results.writePreviewLatency = Date.now() - diffStart;
  if (!options.quiet) {
    console.log(`Write preview latency: ${results.writePreviewLatency}ms`);
  }

  const uiBus = new EventEmitter();
  let eventCount = 0;
  uiBus.on('ui_event', () => {
    eventCount += 1;
  });
  const uiStart = Date.now();
  for (let index = 0; index < 10000; index += 1) {
    uiBus.emit('ui_event', { type: 'trace' });
  }
  results.uiEventLag = Date.now() - uiStart;
  if (!options.quiet) {
    console.log(`UI event lag: ${results.uiEventLag}ms (${eventCount} received)`);
  }

  return results;
}
