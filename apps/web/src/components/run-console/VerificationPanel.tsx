import type { RunTraceEntry } from '../../types/run';

interface VerificationPanelProps {
  traces: RunTraceEntry[];
}

export function VerificationPanel({ traces }: VerificationPanelProps) {
  const latest = [...traces].reverse().find((trace) => trace.type === 'verification_completed');
  const data = (latest?.data && typeof latest.data === 'object') ? latest.data as Record<string, unknown> : undefined;
  const success = data?.success === true;
  const outputPreview = typeof data?.outputPreview === 'string' ? data.outputPreview : 'Verification finished.';

  return (
    <section className="run-console-section">
      <div className="run-console-section-head">
        <span>Verification</span>
        <span>{data ? (success ? 'passed' : 'failed') : 'waiting'}</span>
      </div>
      {data ? (
        <details className="run-console-advanced-details">
          <summary>Advanced Details · Verification output</summary>
          <pre className={`verification-output ${success ? 'verification-output-ok' : 'verification-output-failed'}`}>
            {outputPreview}
          </pre>
        </details>
      ) : (
        <div className="empty-note">No verification result yet</div>
      )}
    </section>
  );
}
