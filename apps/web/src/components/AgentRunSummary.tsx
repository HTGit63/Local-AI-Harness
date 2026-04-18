interface AgentRunLineStats {
  changedFiles: number;
  addedLines: number;
  removedLines: number;
}

interface AgentRunCommand {
  command: string;
  success: boolean;
  durationMs?: number;
}

interface AgentRunApproval {
  id: string;
  target: string;
  approved: boolean | null;
}

interface AgentRunMetrics {
  totalMs?: number;
}

export interface AgentRunSummaryData {
  workspaceSource: 'backend' | 'browser_snapshot';
  workspaceBound: boolean;
  filesRead: string[];
  directoriesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  directoriesCreated: string[];
  searches: Array<{ query: string; pattern?: string }>;
  commands: AgentRunCommand[];
  approvals: AgentRunApproval[];
  git?: AgentRunLineStats;
  usedManualFallback: boolean;
  fallbackReason?: string;
  metrics?: AgentRunMetrics;
  summary?: string;
}

function formatDuration(totalMs?: number): string {
  if (!totalMs || totalMs <= 0) return '0s';
  if (totalMs < 1000) return `${totalMs}ms`;
  const seconds = totalMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remSeconds}s`;
}

export function AgentRunSummary({ run }: { run: AgentRunSummaryData }) {
  const changedSummary = run.git && run.git.changedFiles > 0
    ? `${run.git.changedFiles} file${run.git.changedFiles === 1 ? '' : 's'} (+${run.git.addedLines} / -${run.git.removedLines})`
    : 'none';
  const approvalsApproved = run.approvals.filter((entry) => entry.approved === true).length;

  return (
    <div className="tool-execution-tracker">
      <div className="tool-tracker-header">
        <span>Run Overview</span>
      </div>
      <div className="tool-summary-line">
        {run.summary || 'Structured run summary available.'}
      </div>
      <div className="tool-call-list">
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Worked for</span>
            <span className="tool-call-state">{formatDuration(run.metrics?.totalMs)}</span>
          </div>
          <div className="tool-call-input">Workspace {run.workspaceSource}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Explored</span>
            <span className="tool-call-state">{run.filesRead.length} file{run.filesRead.length === 1 ? '' : 's'}</span>
          </div>
          <div className="tool-call-input">{run.directoriesRead.length} director{run.directoriesRead.length === 1 ? 'y' : 'ies'} listed</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Searched</span>
            <span className="tool-call-state">{run.searches.length}</span>
          </div>
          <div className="tool-call-input">{run.searches.length > 0 ? run.searches.map((entry) => entry.query).join(', ') : 'none'}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Ran</span>
            <span className="tool-call-state">{run.commands.length} command{run.commands.length === 1 ? '' : 's'}</span>
          </div>
          <div className="tool-call-input">{run.commands[0]?.command || 'none'}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Changed</span>
            <span className="tool-call-state">{changedSummary}</span>
          </div>
          <div className="tool-call-input">
            Writes {run.filesWritten.length} · Deletes {run.filesDeleted.length} · New dirs {run.directoriesCreated.length}
          </div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Approvals</span>
            <span className="tool-call-state">{run.approvals.length}</span>
          </div>
          <div className="tool-call-input">{approvalsApproved} approved · {run.workspaceBound ? 'bound' : 'snapshot only'}</div>
        </div>
        <div className={`tool-call-card ${run.usedManualFallback ? 'tool-call-card-error' : 'tool-call-card-done'}`}>
          <div className="tool-call-card-top">
            <span className="tool-call-name">Fallback</span>
            <span className="tool-call-state">{run.usedManualFallback ? 'used' : 'none'}</span>
          </div>
          <div className="tool-call-input">{run.fallbackReason || 'native path held'}</div>
        </div>
      </div>
    </div>
  );
}
