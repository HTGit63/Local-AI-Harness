import type { RunTraceEntry } from '../../types/run';

interface VerificationPanelProps {
  traces: RunTraceEntry[];
}

export function VerificationPanel({ traces }: VerificationPanelProps) {
  const latest = [...traces].reverse().find((trace) => trace.type === 'verification_completed');
  const running = [...traces].reverse().find((trace) => trace.type === 'verification_started');
  const data = (latest?.data && typeof latest.data === 'object') ? latest.data as Record<string, unknown> : undefined;
  const status = data
    ? typeof data.status === 'string'
      ? data.status
      : data.success === true
        ? 'passed'
        : 'failed'
    : running
      ? 'running'
      : 'not-run';
  const success = status === 'passed';
  const outputPreview = typeof data?.outputPreview === 'string' ? data.outputPreview : 'Verification finished.';

  return (
    <section className="run-console-section">
      <div className="run-console-section-head">
        <span>Verification</span>
        <span>{status}</span>
      </div>
      {data ? (
        <details className="run-console-advanced-details">
          <summary>Advanced Details · Verification output</summary>
          <pre className={`verification-output ${success ? 'verification-output-ok' : 'verification-output-failed'}`}>
            {outputPreview}
          </pre>
        </details>
      ) : running ? (
        <div className="empty-note">Verification running</div>
      ) : (
        <div className="empty-note">Verification not run yet</div>
      )}
    </section>
  );
}
