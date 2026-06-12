import { useEffect, useState } from 'react';
import { AgentMode } from './agent/AgentMode';
import { AppShell } from './AppShell';
import { ChatMode } from './chat/ChatMode';
import { ModeLanding, type HarnessMode } from './ModeLanding';

function modeFromHash(): HarnessMode | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#\/?/, '');
  return hash === 'chat' || hash === 'agent' ? hash : null;
}

function setModeHash(mode: HarnessMode | null) {
  if (typeof window === 'undefined') return;
  const nextHash = mode ? `#/${mode}` : '#/';
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

function HarnessApp() {
  const [activeMode, setActiveMode] = useState<HarnessMode | null>(() => modeFromHash());

  useEffect(() => {
    const handleHashChange = () => setActiveMode(modeFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const openMode = (mode: HarnessMode) => {
    setActiveMode(mode);
    setModeHash(mode);
  };

  const openLanding = () => {
    setActiveMode(null);
    setModeHash(null);
  };

  return (
    <AppShell>
      {activeMode === null ? (
        <ModeLanding onSelectMode={openMode} />
      ) : (
        <>
          <nav className="mode-switch-rail" aria-label="Mode switcher">
            <button className="mode-switch-rail-button" onClick={openLanding} type="button">
              Modes
            </button>
            <button
              className={`mode-switch-rail-button ${activeMode === 'chat' ? 'mode-switch-rail-button-active' : ''}`}
              onClick={() => openMode('chat')}
              type="button"
            >
              Chat
            </button>
            <button
              className={`mode-switch-rail-button ${activeMode === 'agent' ? 'mode-switch-rail-button-active' : ''}`}
              onClick={() => openMode('agent')}
              type="button"
            >
              Agent
            </button>
          </nav>
          {activeMode === 'chat' ? (
            <ChatMode onBack={openLanding} onOpenAgent={() => openMode('agent')} />
          ) : (
            <AgentMode />
          )}
        </>
      )}
    </AppShell>
  );
}

export default HarnessApp;
