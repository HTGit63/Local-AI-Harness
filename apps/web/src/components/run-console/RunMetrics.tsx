import type { RunApprovalItem, RunTraceEntry, TaskPlan } from '../../types/run';

interface RunMetricsProps {
  plan?: TaskPlan;
  traces: RunTraceEntry[];
  approvals: RunApprovalItem[];
  filesChangedCount: number;
}

function uniqueTraceValues(traces: RunTraceEntry[], key: string): string[] {
  const values = new Set<string>();
  for (const trace of traces) {
    const data = (trace.data && typeof trace.data === 'object') ? trace.data as Record<string, unknown> : {};
    const value = data[key];
    if (typeof value === 'string' && value.trim()) values.add(value);
  }
  return Array.from(values);
}

export function RunMetrics({ plan, traces, approvals, filesChangedCount }: RunMetricsProps) {
  const filesRead = uniqueTraceValues(traces, 'filePath').length;
  const toolEvents = traces.filter((trace) => trace.type === 'tool_call_started' || trace.type === 'tool_call_completed').length;

  return (
    <section className="run-console-section">
      <div className="run-console-section-head">
        <span>Run Metrics</span>
        <span>{plan?.completedAt ? 'complete' : plan?.failedAt ? 'failed' : plan ? 'active' : 'idle'}</span>
      </div>
      <div className="run-console-metrics">
        <div><span>Steps</span><strong>{plan?.steps.length || 0}</strong></div>
        <div><span>Tools</span><strong>{toolEvents}</strong></div>
        <div><span>Files Read</span><strong>{filesRead}</strong></div>
        <div><span>Files Changed</span><strong>{filesChangedCount}</strong></div>
        <div><span>Approvals</span><strong>{approvals.length}</strong></div>
      </div>
    </section>
  );
}
