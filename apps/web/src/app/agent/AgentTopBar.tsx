type BackendStatus = 'ok' | 'degraded' | 'offline';

interface AgentTopBarProps {
  backendStatus: BackendStatus;
  runtimeFallbackWarning: string;
  activeRuntimeLabel: string;
  activeModelLabel: string;
  workspaceReady: boolean;
  configuredWorkspaceRoot: string;
  writeAccessLabel: string;
  currentGoalLabel: string;
  settingsOpen: boolean;
  onBack: () => void;
  onOpenChat: () => void;
  onNewThread: () => void;
  onRefresh: () => void;
  onToggleSettings: () => void;
  shortenText: (value: string, max?: number) => string;
  getPathBasename: (value: string) => string;
}

export function AgentTopBar({
  backendStatus,
  runtimeFallbackWarning,
  activeRuntimeLabel,
  activeModelLabel,
  workspaceReady,
  configuredWorkspaceRoot,
  writeAccessLabel,
  currentGoalLabel,
  settingsOpen,
  onBack,
  onOpenChat,
  onNewThread,
  onRefresh,
  onToggleSettings,
  shortenText,
  getPathBasename,
}: AgentTopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">G4</div>
        <div className="topbar-brand">
          <span className="topbar-kicker">Agent Mode</span>
          <span className="topbar-title">Agent</span>
        </div>
      </div>

      <div className="topbar-center agent-status-ledger">
        <div className="topbar-badge">
          <span className={`status-dot status-dot-${backendStatus}`} />
          <span>{backendStatus === 'ok' ? 'Ready' : backendStatus === 'degraded' ? 'Degraded' : 'Offline'}</span>
        </div>
        <div className={runtimeFallbackWarning ? 'topbar-badge topbar-badge-warning' : 'topbar-badge'} title={runtimeFallbackWarning || undefined}>
          <span>Runtime</span>
          <strong>{activeRuntimeLabel}</strong>
        </div>
        <div className="topbar-badge">
          <span>Model</span>
          <strong>{shortenText(activeModelLabel, 28)}</strong>
        </div>
        <div className="topbar-badge">
          <span>Workspace</span>
          <strong>{workspaceReady ? shortenText(getPathBasename(configuredWorkspaceRoot), 18) : 'Select'}</strong>
        </div>
        <div className="topbar-badge">
          <span>Write</span>
          <strong>{writeAccessLabel}</strong>
        </div>
        <div className="topbar-badge topbar-badge-wide" title={currentGoalLabel}>
          <span>Goal</span>
          <strong>{shortenText(currentGoalLabel, 36)}</strong>
        </div>
      </div>

      <div className="topbar-right">
        <button className="topbar-nav-button" onClick={onBack} type="button">Modes</button>
        <button className="topbar-nav-button" onClick={onOpenChat} type="button">Chat</button>
        <button className="icon-btn" onClick={onNewThread} type="button" title="New thread">＋</button>
        <button className="icon-btn" onClick={onRefresh} type="button" title="Refresh">↻</button>
        <button
          className={`icon-btn ${settingsOpen ? 'icon-btn-active' : ''}`}
          onClick={onToggleSettings}
          type="button"
          title="Settings"
        >
          ⚙
        </button>
      </div>
    </header>
  );
}
