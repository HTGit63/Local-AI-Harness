import type { RunApprovalItem, RunTraceEntry, StepProgress, StructuredDiff, StructuredDiffLine, TaskPlan } from '../../types/run';
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
  structuredDiff?: StructuredDiff | null;
  checkpointIds?: string[];
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

function explainPlanFile(file: string, plan?: TaskPlan): string {
  const step = plan?.steps.find((entry) => entry.files?.includes(file));
  if (step?.detail) return step.detail;
  if (step?.title) return step.title;
  if (file.includes('RunConsole')) return 'RunConsole renders agent work, tool transparency, and code changes.';
  if (file.includes('types/run')) return 'Shared run types define UI diff, checkpoint, and timeline contracts.';
  if (file.includes('engine.ts')) return 'Core engine routes model calls and executes deterministic tools.';
  if (file.includes('registry.ts')) return 'Tool registry owns file, diff, command, and repo tool behavior.';
  return 'Selected from current task plan or repo relevance ranking.';
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

function structuredLineClass(line: StructuredDiffLine): string {
  if (line.type === 'added') return 'diff-line-added';
  if (line.type === 'removed') return 'diff-line-removed';
  if (line.type === 'hunk') return 'diff-line-hunk';
  if (line.type === 'file') return 'diff-line-file';
  return 'diff-line-context';
}

function lineNumber(label: 'old' | 'new', value?: number): string {
  return typeof value === 'number' ? `${label} ${value}` : '';
}

function traceData(trace: RunTraceEntry): Record<string, unknown> {
  return trace.data && typeof trace.data === 'object' ? trace.data as Record<string, unknown> : {};
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
  structuredDiff,
  checkpointIds = [],
  onResolveApproval,
}: RunConsoleProps) {
  const planFiles = collectPlanFiles(plan);
  const fallbackDiffFiles = parseDiffFileStats(gitDiff);
  const structuredFiles = structuredDiff?.files ?? [];
  const hasStructuredDiff = structuredFiles.length > 0;
  const diffFiles = hasStructuredDiff
    ? structuredFiles.map((file) => ({ file: file.path, added: file.addedLines, removed: file.removedLines }))
    : fallbackDiffFiles;
  const changedCount = diffFiles.length;
  const addedLines = diffFiles.reduce((total, file) => total + file.added, 0);
  const removedLines = diffFiles.reduce((total, file) => total + file.removed, 0);
  const runState = plan?.failedAt ? 'failed' : plan?.completedAt ? 'done' : plan ? 'running' : 'idle';
  const diffPreviewLines = gitDiff.split('\n').slice(0, 520);
  const diffIsTruncated = gitDiff.split('\n').length > diffPreviewLines.length;
  const contextTrace = traces.filter((trace) => trace.type === 'context_pack_built').slice(-1)[0];
  const contextData = contextTrace ? traceData(contextTrace) : null;

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
        {contextData && (
          <section className="run-console-section">
            <div className="run-console-section-head">
              <span>Context budget</span>
              <span>{String(contextData.contextBudgetUsed ?? 0)} / {String(contextData.contextBudgetLimit ?? 0)}</span>
            </div>
            <div className="run-console-metrics">
              <div><span>Files</span><strong>{String(contextData.filesIncluded ?? 0)}</strong></div>
              <div><span>Snippets</span><strong>{String(contextData.snippetsIncluded ?? 0)}</strong></div>
              <div><span>Memory turns</span><strong>{String(contextData.memoryTurns ?? 0)}</strong></div>
            </div>
          </section>
        )}
        <TaskPlanView plan={plan} currentStepId={currentStepId} />
        <ToolCallList traces={traces} currentTool={currentTool} />

        {checkpointIds.length > 0 && (
          <section className="run-console-section">
            <div className="run-console-section-head">
              <span>Safety checkpoint</span>
              <span>Rollback available</span>
            </div>
            <div className="checkpoint-list">
              {checkpointIds.slice(-3).map((checkpointId) => (
                <code key={checkpointId}>{checkpointId}</code>
              ))}
            </div>
          </section>
        )}

        <section className="run-console-section">
          <div className="run-console-section-head">
            <span>Files in plan</span>
            <span>{planFiles.length}</span>
          </div>
          {planFiles.length === 0 ? (
            <div className="empty-note">No files selected yet</div>
          ) : (
            <div className="run-file-list">
              {planFiles.slice(0, 12).map((file) => (
                <div key={file} className="run-file-card">
                  <code>{file}</code>
                  <span>Why selected: {explainPlanFile(file, plan)}</span>
                </div>
              ))}
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
                {diffFiles.slice(0, 8).map((file) => (
                  <div key={file.file} className="diff-file-row">
                    <code>{file.file}</code>
                    <span><span className="diff-added">+{file.added}</span> <span className="diff-removed">-{file.removed}</span></span>
                  </div>
                ))}
              </div>
              {hasStructuredDiff ? (
                <div className="inline-diff-viewer">
                  {structuredFiles.slice(0, 8).map((file) => (
                    <details key={file.path} className="inline-diff-file" open>
                      <summary>
                        <code>{file.path}</code>
                        <span><span className="diff-added">+{file.addedLines}</span> <span className="diff-removed">-{file.removedLines}</span></span>
                      </summary>
                      <div className="inline-diff-hunks">
                        {file.hunks.slice(0, 8).map((hunk, hunkIndex) => (
                          <div key={`${file.path}-${hunk.oldStart}-${hunk.newStart}-${hunkIndex}`} className="inline-diff-hunk">
                            {hunk.lines.slice(0, 260).map((line, lineIndex) => (
                              <div key={`${lineIndex}-${line.type}-${line.content.slice(0, 24)}`} className={`inline-diff-line ${structuredLineClass(line)}`}>
                                <span className="inline-diff-line-no">{lineNumber('old', line.oldLine)}</span>
                                <span className="inline-diff-line-no">{lineNumber('new', line.newLine)}</span>
                                <code>{line.type === 'added' ? '+' : line.type === 'removed' ? '-' : line.type === 'hunk' ? '@' : ' '}{line.content || ' '}</code>
                              </div>
                            ))}
                            {hunk.lines.length > 260 && (
                              <div className="inline-diff-line diff-line-hunk">
                                <span className="inline-diff-line-no" />
                                <span className="inline-diff-line-no" />
                                <code>... hunk truncated in UI preview ...</code>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : null}
              {!hasStructuredDiff && gitDiff.trim() ? (
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
              ) : null}
            </>
          )}
        </section>

        <VerificationPanel traces={traces} />
      </div>
    </aside>
  );
}
