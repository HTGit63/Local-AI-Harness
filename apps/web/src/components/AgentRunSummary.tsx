import type { StructuredDiff, StructuredDiffFile } from '../types/run';

interface AgentRunLineStats {
  changedFiles: number;
  addedLines: number;
  removedLines: number;
}

interface AgentRunCommand {
  command: string;
  success: boolean;
  durationMs?: number;
  status?: 'executed' | 'denied' | 'rejected' | 'failed';
  reason?: string;
  policyMode?: string;
  approvalRequired?: boolean;
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
  toolProtocol?: 'native' | 'manual';
  fallbackPath?: string;
  fallbackReason?: string;
  fallbackCount?: number;
  filesRead: string[];
  directoriesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  directoriesCreated: string[];
  searches: Array<{ query: string; pattern?: string }>;
  webSearches: Array<{ query: string; engine: string; resultCount: number }>;
  webFetches: Array<{ url: string; title?: string }>;
  commands: AgentRunCommand[];
  approvals: AgentRunApproval[];
  git?: AgentRunLineStats;
  structuredDiff?: StructuredDiff;
  fileChanges?: StructuredDiffFile[];
  checkpointIds?: string[];
  usedManualFallback: boolean;
  metrics?: AgentRunMetrics;
  summary?: string;
}

function formatFallbackPath(path?: string): string {
  switch (path) {
    case 'native_tools':
      return 'native tools';
    case 'native_retry':
      return 'native retry';
    case 'manual_fallback':
      return 'manual fallback';
    case 'manual_repair':
      return 'manual repair';
    case 'final_noop_warning':
      return 'final no-op warning';
    default:
      return 'native tools';
  }
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

function summarizeList(values: string[], empty = 'none', limit = 3): string {
  if (values.length === 0) return empty;
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')} +${values.length - limit} more`;
}

export function AgentRunSummary({ run }: { run: AgentRunSummaryData }) {
  const changedSummary = run.git && run.git.changedFiles > 0
    ? `${run.git.changedFiles} file${run.git.changedFiles === 1 ? '' : 's'} (+${run.git.addedLines} / -${run.git.removedLines})`
    : 'none';
  const approvalsApproved = run.approvals.filter((entry) => entry.approved === true).length;
  const searchSummary = [
    ...run.searches.map((entry) => entry.query),
    ...run.webSearches.map((entry) => `${entry.query} [web]`),
  ];
  const touchedPaths = [
    ...run.filesWritten,
    ...run.filesDeleted,
    ...run.directoriesCreated,
  ];
  const fileChangesCount = run.fileChanges?.length ?? run.structuredDiff?.files.length ?? 0;
  const fallbackLabel = run.fallbackPath ? formatFallbackPath(run.fallbackPath) : 'native tools';
  const failedCommands = run.commands.filter((entry) => !entry.success).length;
  const commandDetails = run.commands.map((entry) => {
    const status = entry.status || (entry.success ? 'executed' : 'failed');
    const approval = entry.approvalRequired ? 'approval' : 'auto';
    return `${entry.command} (${status}, ${entry.policyMode || 'mode unknown'}, ${approval}${entry.reason ? `: ${entry.reason}` : ''})`;
  });

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
          <div className="tool-call-input">{run.workspaceBound ? `Workspace ${run.workspaceSource}` : 'Browser snapshot only'}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Explored</span>
            <span className="tool-call-state">{run.filesRead.length} file{run.filesRead.length === 1 ? '' : 's'}</span>
          </div>
          <div className="tool-call-input">{summarizeList(run.filesRead)}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Searched</span>
            <span className="tool-call-state">{searchSummary.length}</span>
          </div>
          <div className="tool-call-input">{summarizeList(searchSummary)}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Fetched</span>
            <span className="tool-call-state">{run.webFetches.length}</span>
          </div>
          <div className="tool-call-input">{summarizeList(run.webFetches.map((entry) => entry.title || entry.url))}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Changed</span>
            <span className="tool-call-state">{fileChangesCount > 0 ? `${fileChangesCount} diff file${fileChangesCount === 1 ? '' : 's'}` : changedSummary}</span>
          </div>
          <div className="tool-call-input">{summarizeList(touchedPaths)}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Commands</span>
            <span className="tool-call-state">{run.commands.length}{failedCommands ? ` / ${failedCommands} failed` : ''}</span>
          </div>
          <div className="tool-call-input">{summarizeList(commandDetails)}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Approvals</span>
            <span className="tool-call-state">{run.approvals.length}</span>
          </div>
          <div className="tool-call-input">{approvalsApproved} approved · {run.workspaceBound ? 'bound' : 'snapshot only'}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Checkpoint</span>
            <span className="tool-call-state">{run.checkpointIds?.length ? 'created' : 'none'}</span>
          </div>
          <div className="tool-call-input">{run.checkpointIds?.slice(-1)[0] || 'No rollback checkpoint recorded'}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Tool Path</span>
            <span className="tool-call-state">{run.toolProtocol || 'native'}</span>
          </div>
          <div className="tool-call-input">
            {fallbackLabel}
            {run.fallbackReason ? ` · ${run.fallbackReason}` : ''}
          </div>
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
