import { summarizeWorkflowProgress } from '../lib/run-console';
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
}

interface AgentRunApproval {
  id: string;
  target: string;
  approved: boolean | null;
}

interface AgentRunMetrics {
  totalMs?: number;
}

interface WorkflowSummaryData {
  workflowId: string;
  workflowType: string;
  status: string;
  currentStepId?: string | null;
  steps: Array<{ id: string; title: string; type: string; status: string }>;
  filesRead: string[];
  filesChanged: string[];
  approvals: string[];
  commands: string[];
  errors: string[];
}

export interface AgentRunSummaryData {
  agentProtocol?: 'native_tools' | 'action_dsl' | 'workflow_runner';
  agentModel?: string;
  summaryModel?: string;
  activeModel?: string | null;
  heavyModelLock?: {
    held: boolean;
    ownerRunId: string | null;
    queued: number;
  };
  lastRouteSelection?: {
    role: string;
    model: string;
    protocol?: string;
    reason?: string;
  };
  modelRoute?: {
    role: string;
    model: string;
    protocol?: string;
    reason?: string;
  };
  workspaceSource: 'backend' | 'browser_snapshot';
  workspaceBound: boolean;
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
  currentAction?: string;
  parseFailureCount?: number;
  routingNotes?: string[];
  memoryNotes?: string[];
  usedManualFallback: boolean;
  fallbackReason?: string;
  metrics?: AgentRunMetrics;
  summary?: string;
  verification?: string;
  workflow?: WorkflowSummaryData;
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

function summarizeNotes(label: string, notes?: string[]): string {
  if (!notes || notes.length === 0) {
    return `${label}: none`;
  }

  return `${label}: ${summarizeList(notes, 'none', 2)}`;
}

function summarizeModelRouting(run: AgentRunSummaryData): string {
  const parts: string[] = [];
  const route = run.modelRoute || run.lastRouteSelection;

  if (run.agentModel) {
    parts.push(`Agent ${run.agentModel}${run.activeModel === run.agentModel ? ' (active)' : ''}`);
  }
  if (run.summaryModel) {
    parts.push(`Summary ${run.summaryModel}`);
  }
  if (run.activeModel && run.activeModel !== run.agentModel) {
    parts.push(`Active ${run.activeModel}`);
  }
  if (run.heavyModelLock) {
    parts.push(`${run.heavyModelLock.held ? 'Held' : 'Free'} · queued ${run.heavyModelLock.queued}${run.heavyModelLock.ownerRunId ? ` · owner ${run.heavyModelLock.ownerRunId}` : ''}`);
  }
  if (route) {
    parts.push(`Route ${route.role} -> ${route.model}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'No model routing data';
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
  const fileChangesCount = run.fileChanges?.length ?? run.structuredDiff?.files.length ?? run.workflow?.filesChanged.length ?? 0;
  const notesSummary = [
    summarizeNotes('Routing', run.routingNotes),
    summarizeNotes('Memory', run.memoryNotes),
  ].join(' · ');
  const verificationSummary = run.verification || run.workflow?.status || 'none';

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
            <span className="tool-call-name">Protocol</span>
            <span className="tool-call-state">{run.agentProtocol || 'native_tools'}</span>
          </div>
          <div className="tool-call-input">Selected protocol for this run.</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Model routing</span>
            <span className="tool-call-state">{run.agentModel || run.activeModel || 'none'}</span>
          </div>
          <div className="tool-call-input">{summarizeModelRouting(run)}</div>
        </div>
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
            <span className="tool-call-name">Files changed</span>
            <span className="tool-call-state">{fileChangesCount > 0 ? `${fileChangesCount} file${fileChangesCount === 1 ? '' : 's'}` : changedSummary}</span>
          </div>
          <div className="tool-call-input">{summarizeList(touchedPaths)}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Commands</span>
            <span className="tool-call-state">{run.commands.length}</span>
          </div>
          <div className="tool-call-input">{summarizeList(run.commands.map((entry) => entry.command))}</div>
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
            <span className="tool-call-name">Action DSL</span>
            <span className="tool-call-state">{run.currentAction || `${run.parseFailureCount ?? 0} failures`}</span>
          </div>
          <div className="tool-call-input">
            {run.currentAction ? `Current action: ${run.currentAction}` : 'No current action'}
            {typeof run.parseFailureCount === 'number' ? ` · Parse failures: ${run.parseFailureCount}` : ''}
          </div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Notes</span>
            <span className="tool-call-state">{(run.routingNotes?.length || 0) + (run.memoryNotes?.length || 0)}</span>
          </div>
          <div className="tool-call-input">{notesSummary}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Verification</span>
            <span className="tool-call-state">{verificationSummary}</span>
          </div>
          <div className="tool-call-input">{run.verification || 'No explicit verification recorded'}</div>
        </div>
        <div className="tool-call-card tool-call-card-done">
          <div className="tool-call-card-top">
            <span className="tool-call-name">Checkpoint</span>
            <span className="tool-call-state">{run.checkpointIds?.length ? 'created' : 'none'}</span>
          </div>
          <div className="tool-call-input">{run.checkpointIds?.slice(-1)[0] || 'No rollback checkpoint recorded'}</div>
        </div>
        <div className={`tool-call-card ${run.usedManualFallback ? 'tool-call-card-error' : 'tool-call-card-done'}`}>
          <div className="tool-call-card-top">
            <span className="tool-call-name">Fallback</span>
            <span className="tool-call-state">{run.usedManualFallback ? 'used' : 'none'}</span>
          </div>
          <div className="tool-call-input">{run.fallbackReason || 'native path held'}</div>
        </div>
        {run.workflow && (
          <div className="tool-call-card tool-call-card-done">
            <div className="tool-call-card-top">
              <span className="tool-call-name">Workflow</span>
              <span className="tool-call-state">{run.workflow.status}</span>
            </div>
            <div className="tool-call-input">
              {summarizeWorkflowProgress(run.workflow)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
