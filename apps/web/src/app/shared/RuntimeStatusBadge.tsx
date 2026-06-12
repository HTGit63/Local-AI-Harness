export type BackendStatus = 'ok' | 'degraded' | 'offline';

export function RuntimeStatusBadge({
  status,
  model,
}: {
  status: BackendStatus;
  model?: string | null;
}) {
  return (
    <div className="runtime-status-badge">
      <span className={`status-dot status-dot-${status}`} />
      <span>{status === 'ok' ? 'Ready' : status === 'degraded' ? 'Degraded' : 'Offline'}</span>
      {model ? <strong>{model}</strong> : null}
    </div>
  );
}
