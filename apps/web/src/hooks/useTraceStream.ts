import type { RunTraceEntry } from '../types/run';

export function getRecentRunTraces(traces: RunTraceEntry[], limit = 50): RunTraceEntry[] {
  return traces.slice(-limit);
}
