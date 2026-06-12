export type HarnessMode = 'chat' | 'agent';

export function ModeLanding({
  onSelectMode,
}: {
  onSelectMode: (mode: HarnessMode) => void;
}) {
  return (
    <main className="mode-landing">
      <section className="mode-landing-inner">
        <div className="mode-landing-brand">
          <div className="topbar-logo">G4</div>
          <div>
            <span className="topbar-kicker">Gamma 4 Harness</span>
            <h1>Choose mode</h1>
          </div>
        </div>

        <div className="mode-card-grid">
          <button className="mode-card" onClick={() => onSelectMode('chat')} type="button">
            <span className="mode-card-kicker">Chat</span>
            <strong>Normal conversation</strong>
            <span>Markdown answers, image context, and saved chat threads without repo tools.</span>
          </button>
          <button className="mode-card mode-card-agent" onClick={() => onSelectMode('agent')} type="button">
            <span className="mode-card-kicker">Agent</span>
            <strong>Local repo harness</strong>
            <span>Workspace selection, planning, file tools, approvals, diffs, and verification.</span>
          </button>
        </div>
      </section>
    </main>
  );
}
