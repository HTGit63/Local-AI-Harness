import { useMemo, useState } from 'react';
import type { RunTraceEntry, StructuredDiff } from '../../types/run';
import {
  buildVerificationChecks,
  collectDiffFiles,
  formatStructuredDiffPreview,
  getDiffLineClass,
} from './runSummary';

interface MinimalDiffTestSummaryProps {
  gitDiff: string;
  structuredDiff?: StructuredDiff | null;
  traces: RunTraceEntry[];
}

function statusLabel(status: string): string {
  return status.replace(/_/g, '-');
}

export function MinimalDiffTestSummary({ gitDiff, structuredDiff, traces }: MinimalDiffTestSummaryProps) {
  const [diffOpen, setDiffOpen] = useState(false);
  const changedFiles = useMemo(() => collectDiffFiles(structuredDiff, gitDiff), [structuredDiff, gitDiff]);
  const checks = useMemo(() => buildVerificationChecks(traces), [traces]);
  const diffText = gitDiff.trim() || (structuredDiff?.files.length ? formatStructuredDiffPreview(structuredDiff) : '');
  const diffLines = diffText.split('\n').slice(0, 360);
  const diffIsTruncated = diffText.split('\n').length > diffLines.length;
  const diffAvailable = diffText.trim().length > 0;

  return (
    <section className="run-console-section minimal-run-summary" data-testid="minimal-diff-test-summary">
      <div className="run-console-section-head">
        <span>Changed / Verification</span>
        <span>{changedFiles.length} file{changedFiles.length === 1 ? '' : 's'}</span>
      </div>

      <div className="minimal-run-summary-grid">
        <div className="minimal-run-summary-block">
          <div className="minimal-run-summary-label">Changed</div>
          {changedFiles.length === 0 ? (
            <div className="empty-note">No files changed.</div>
          ) : (
            <div className="minimal-run-file-list">
              {changedFiles.slice(0, 6).map((file) => (
                <div className="minimal-run-file-row" key={file.file}>
                  <code title={file.file}>{file.file}</code>
                  <span><span className="diff-added">+{file.added}</span> <span className="diff-removed">-{file.removed}</span></span>
                </div>
              ))}
              {changedFiles.length > 6 && (
                <div className="minimal-run-more">+{changedFiles.length - 6} more</div>
              )}
            </div>
          )}
        </div>

        <div className="minimal-run-summary-block">
          <div className="minimal-run-summary-label">Verification</div>
          {checks.length === 0 ? (
            <div className="empty-note">No verification checks were run.</div>
          ) : (
            <div className="minimal-run-check-list">
              {checks.map((check) => (
                <div className="minimal-run-check-row" key={`${check.command}-${check.status}`}>
                  <code title={check.command}>{check.command}</code>
                  <span className={`minimal-run-status minimal-run-status-${check.status}`}>
                    {statusLabel(check.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="minimal-run-summary-actions">
        {diffAvailable ? (
          <button className="btn-sm" onClick={() => setDiffOpen((open) => !open)} type="button">
            {diffOpen ? 'Hide diff' : 'View diff'}
          </button>
        ) : (
          <span className="minimal-run-diff-unavailable">Diff unavailable.</span>
        )}
      </div>

      {diffOpen && diffAvailable ? (
        <pre className="minimal-run-diff-preview diff-code" aria-label="Diff preview">
          {diffLines.map((line, index) => (
            <span key={`${index}-${line.slice(0, 20)}`} className={getDiffLineClass(line)}>
              {line || ' '}
            </span>
          ))}
          {diffIsTruncated && <span className="diff-line-hunk">... diff truncated in summary preview ...</span>}
        </pre>
      ) : null}
    </section>
  );
}
