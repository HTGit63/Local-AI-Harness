export type BackendStatus = 'ok' | 'degraded' | 'offline';

export function RuntimeStatusBadge({
  status,
  model,
  provider,
  warning,
}: {
  status: BackendStatus;
  model?: string | null;
  provider?: string | null;
  warning?: string | null;
}) {
  const providerLabel = provider === 'ollama-legacy'
    ? 'Ollama fallback'
    : provider === 'llamacpp'
      ? 'llama.cpp'
      : provider || null;

  return (
    <div className={warning ? 'runtime-status-badge runtime-status-badge-warning' : 'runtime-status-badge'} title={warning || undefined}>
      <span className={`status-dot status-dot-${status}`} />
      <span>{status === 'ok' ? 'Ready' : status === 'degraded' ? 'Degraded' : 'Offline'}</span>
      {providerLabel ? <strong>{providerLabel}</strong> : null}
      {model ? <strong>{model}</strong> : null}
      {warning ? <span className="runtime-warning-pill">Fallback</span> : null}
    </div>
  );
}
