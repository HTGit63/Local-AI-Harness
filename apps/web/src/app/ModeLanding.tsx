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
            <span className="topbar-kicker">Gemma 4 Harness</span>
            <h1>Choose work surface</h1>
          </div>
        </div>

        <div className="mode-card-grid">
          <button className="mode-card" onClick={() => onSelectMode('chat')} type="button">
            <span className="mode-card-kicker">Chat</span>
            <strong>Ask without repo access</strong>
            <span>Clean conversation, markdown, math, image context, and saved threads.</span>
          </button>
          <button className="mode-card mode-card-agent" onClick={() => onSelectMode('agent')} type="button">
            <span className="mode-card-kicker">Agent</span>
            <strong>Work inside a workspace</strong>
            <span>Plan, inspect, edit, approve, diff, and verify with local repo boundaries visible.</span>
          </button>
        </div>
      </section>
    </main>
  );
}
