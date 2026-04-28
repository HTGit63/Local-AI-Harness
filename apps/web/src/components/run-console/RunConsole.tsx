import type { RunApprovalItem, RunTraceEntry, StepProgress, TaskPlan } from '../../types/run';
import { ApprovalQueue } from '../approvals/ApprovalQueue';
import { CurrentTaskCard } from './CurrentTaskCard';
import { TaskPlanView } from './TaskPlanView';
import { ToolCallList } from './ToolCallList';
import { VerificationPanel } from './VerificationPanel';

interface RunConsoleProps {
  plan?: TaskPlan;
  currentStepId?: string;
  progress?: StepProgress;
  phase?: string;
  currentTool?: string;
  streamStatus?: string;
  traces: RunTraceEntry[];
  approvals: RunApprovalItem[];
  gitDiff: string;
  onResolveApproval: (id: string, approved: boolean) => void;
}

function collectPlanFiles(plan?: TaskPlan): string[] {
  if (!plan) return [];
  const files = new Set<string>();
  for (const step of plan.steps) {
    for (const file of step.files || []) files.add(file);
  }
  return Array.from(files);
}

interface DiffFileStat {
  file: string;
  added: number;
  removed: number;
}

function parseDiffFileStats(diff: string): DiffFileStat[] {
  if (!diff.trim()) return [];
  return diff
    .split(/^diff --git /gm)
    .filter(Boolean)
    .map((block) => {
      const firstLine = block.split('\n')[0] || '';
      const match = firstLine.match(/^a\/(.+?) b\/(.+)$/);
      const file = match?.[2] || match?.[1] || firstLine.trim() || 'changed file';
      let added = 0;
      let removed = 0;

      for (const line of block.split('\n')) {
        if (line.startsWith('+++') || line.startsWith('---')) continue;
        if (line.startsWith('+')) added++;
        else if (line.startsWith('-')) removed++;
      }

      return { file, added, removed };
    });
}

function getDiffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-line-file';
  if (line.startsWith('@@')) return 'diff-line-hunk';
  if (line.startsWith('+')) return 'diff-line-added';
  if (line.startsWith('-')) return 'diff-line-removed';
  return '';
}

export function RunConsole({
  plan,
  currentStepId,
  progress,
  phase,
  currentTool,
  streamStatus,
  traces,
  approvals,
  gitDiff,
  onResolveApproval,
}: RunConsoleProps) {
  const planFiles = collectPlanFiles(plan);
  const diffFiles = parseDiffFileStats(gitDiff);
  const changedCount = diffFiles.length;
  const addedLines = diffFiles.reduce((total, file) => total + file.added, 0);
  const removedLines = diffFiles.reduce((total, file) => total + file.removed, 0);
  const runState = plan?.failedAt ? 'failed' : plan?.completedAt ? 'done' : plan ? 'running' : 'idle';
  const diffPreviewLines = gitDiff.split('\n').slice(0, 520);
  const diffIsTruncated = gitDiff.split('\n').length > diffPreviewLines.length;

  return (
    <aside className="run-console" data-testid="run-console">
      <div className="run-console-header">
        <div>
          <span>Agent work</span>
          <strong>{streamStatus || phase || plan?.title || 'idle'}</strong>
        </div>
        <div className="run-console-header-stats">
          <span className="diff-added">+{addedLines}</span>
          <span className="diff-removed">-{removedLines}</span>
          <span className={`run-console-state run-console-state-${runState}`}>{runState}</span>
        </div>
      </div>

      <div className="run-console-body">
        <CurrentTaskCard plan={plan} currentStepId={currentStepId} progress={progress} phase={phase} streamStatus={streamStatus} />
        <TaskPlanView plan={plan} currentStepId={currentStepId} />
        <ToolCallList traces={traces} currentTool={currentTool} />

        <section className="run-console-section">
          <div className="run-console-section-head">
            <span>Files in plan</span>
            <span>{planFiles.length}</span>
          </div>
          {planFiles.length === 0 ? (
            <div className="empty-note">No files selected yet</div>
          ) : (
            <div className="run-file-list">
              {planFiles.slice(0, 12).map((file) => <code key={file}>{file}</code>)}
            </div>
          )}
        </section>

        {approvals.length > 0 && (
          <section className="run-console-section">
            <div className="run-console-section-head">
              <span>Pending approvals</span>
              <span>{approvals.length}</span>
            </div>
            <ApprovalQueue approvals={approvals} onResolve={onResolveApproval} compact />
          </section>
        )}

        <section className="run-console-section run-console-diff-section">
          <div className="run-console-section-head">
            <span>Code changes</span>
            <span><span className="diff-added">+{addedLines}</span> <span className="diff-removed">-{removedLines}</span></span>
          </div>
          {changedCount === 0 ? (
            <div className="empty-note">No diff available</div>
          ) : (
            <>
              <div className="diff-file-list">
                {diffFiles.slice(0, 10).map((file) => (
                  <div key={file.file} className="diff-file-row">
                    <code>{file.file}</code>
                    <span><span className="diff-added">+{file.added}</span> <span className="diff-removed">-{file.removed}</span></span>
                  </div>
                ))}
              </div>
              <details className="diff-raw-details" open>
                <summary>Raw diff</summary>
                <pre className="run-diff-preview diff-code">
                  {diffPreviewLines.map((line, index) => (
                    <span key={`${index}-${line.slice(0, 20)}`} className={getDiffLineClass(line)}>
                      {line || ' '}
                    </span>
                  ))}
                  {diffIsTruncated && <span className="diff-line-hunk">... diff truncated in UI preview ...</span>}
                </pre>
              </details>
            </>
          )}
        </section>

        <VerificationPanel traces={traces} />
      </div>
    </aside>
  );
}
