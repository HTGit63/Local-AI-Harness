import type { RunTraceEntry } from '../../types/run';
import { formatTime } from '../../lib/formatters';

interface ToolCallListProps {
  traces: RunTraceEntry[];
  currentTool?: string;
}

function getTraceData(trace: RunTraceEntry): Record<string, unknown> {
  return (trace.data && typeof trace.data === 'object') ? trace.data as Record<string, unknown> : {};
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asDuration(value: unknown): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}ms` : undefined;
}

export function ToolCallList({ traces, currentTool }: ToolCallListProps) {
  const toolEvents = traces
    .filter((trace) =>
      trace.type === 'tool_call_started' ||
      trace.type === 'tool_call_completed' ||
      trace.type === 'command_policy_checked' ||
      trace.type === 'verification_started' ||
      trace.type === 'verification_completed')
    .slice(-10)
    .reverse();

  return (
    <section className="run-console-section">
      <div className="run-console-section-head">
        <span>Tools</span>
        <span>{currentTool || 'none'}</span>
      </div>
      {toolEvents.length === 0 ? (
        <div className="empty-note">No tool events yet</div>
      ) : (
        <div className="tool-call-list">
          {toolEvents.map((trace, index) => {
            const data = getTraceData(trace);
            const ok = data.success === true;
            const failed = data.success === false || data.status === 'denied' || data.status === 'rejected' || data.status === 'failed';
            const title = asText(data.tool) || asText(data.command) || 'verification';
            const body = asText(data.inputSummary) || asText(data.outputPreview) || asText(data.reason) || asText(data.status) || 'Running.';
            const duration = asDuration(data.durationMs);
            return (
              <div key={`${trace.timestamp}-${trace.type}-${index}`} className={`tool-call-row ${ok ? 'tool-call-row-ok' : failed ? 'tool-call-row-failed' : ''}`}>
                <div className="tool-call-meta">
                  <span>{formatTime(trace.timestamp)}</span>
                  <span>{trace.type.replace(/_/g, ' ')}</span>
                  {duration && <span>{duration}</span>}
                </div>
                <strong>{title}</strong>
                <p>{body}</p>
                {asText(data.outputPreview) && asText(data.inputSummary) && <p className="tool-call-output">Output: {asText(data.outputPreview)}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
