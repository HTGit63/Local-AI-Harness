import type { ChatSession } from './chatTypes';

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 14 ? `${days}d` : new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function shortenText(value: string, max = 42): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(8, max - 3))}...`;
}

function formatSessionTitle(session: ChatSession): string {
  const latest = session.turnHistory?.[session.turnHistory.length - 1];
  return shortenText(latest?.summary || latest?.intent || latest?.promptMode || session.id, 42);
}

export function ChatHistory({
  sessions,
  activeSessionId,
  onNewThread,
  onResume,
}: {
  sessions: ChatSession[];
  activeSessionId?: string;
  onNewThread: () => void;
  onResume: (sessionId: string) => void;
}) {
  return (
    <aside className="chat-history-panel">
      <button className="sidebar-action sidebar-action-primary" onClick={onNewThread} type="button">
        <span>+</span>
        New chat
      </button>
      <div className="sidebar-section-title">
        <span>Chat history</span>
        <span>{sessions.length}</span>
      </div>
      <div className="thread-list">
        {sessions.length === 0 ? (
          <div className="sidebar-empty-compact">No saved chats yet.</div>
        ) : (
          sessions.slice(0, 18).map((session) => (
            <button
              key={session.id}
              className={`thread-row ${activeSessionId === session.id ? 'thread-row-active' : ''}`}
              onClick={() => onResume(session.id)}
              type="button"
              title={session.id}
            >
              <span className="thread-dot" />
              <span className="thread-main">
                <strong>{formatSessionTitle(session)}</strong>
                <span>{session.model} · {session.turnHistory?.length || 0} turns</span>
              </span>
              <span className="thread-time">{formatRelativeTime(session.updatedAt)}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
