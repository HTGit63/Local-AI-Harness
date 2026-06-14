type HarnessLogRunListItem = {
  runId: string;
  status?: string;
  eventCount?: number;
  startedAt?: number;
  endedAt?: number;
  logPath: string;
};

interface AgentRunLogPanelProps {
  apiBase: string;
  logStatus: string;
  runs: HarnessLogRunListItem[];
  now: number;
  shortenText: (value: string, max?: number) => string;
  formatRelativeTime: (timestamp: number) => string;
}

export function AgentRunLogPanel({
  apiBase,
  logStatus,
  runs,
  now,
  shortenText,
  formatRelativeTime,
}: AgentRunLogPanelProps) {
  return (
    <div className="activity-card activity-log-card">
      <div className="command-center-section-head">
        <span>Run Logs</span>
        <span>{runs.length}</span>
      </div>
      {logStatus ? (
        <div className="empty-note">{logStatus}</div>
      ) : runs.length === 0 ? (
        <div className="empty-note">No durable logs yet</div>
      ) : (
        <div className="activity-log-list">
          {runs.map((run) => (
            <a
              key={run.runId}
              className="activity-log-row"
              href={`${apiBase}/logs/runs/${encodeURIComponent(run.runId)}`}
              target="_blank"
              rel="noreferrer"
              title={run.logPath}
            >
              <div className="activity-log-row-main">
                <strong>{shortenText(run.runId, 18)}</strong>
                <span>{run.status || 'open'} · {run.eventCount ?? 0} events</span>
              </div>
              <span>{formatRelativeTime(run.endedAt || run.startedAt || now)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
