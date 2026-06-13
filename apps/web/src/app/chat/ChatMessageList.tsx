import { ChatMessageRow } from './ChatMessageRow';
import type { ChatMessage } from './chatTypes';

export function ChatMessageList({
  messages,
  isSending,
  onPrompt,
}: {
  messages: ChatMessage[];
  isSending: boolean;
  onPrompt: (prompt: string) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="chat-welcome">
        <div className="chat-welcome-logo">G4</div>
        <h2>Start a chat</h2>
        <p>Ask a question, paste notes, or attach an image for context.</p>
        <div className="chat-welcome-hints">
          <button className="hint-chip" onClick={() => onPrompt('Explain this concept simply.')} type="button">
            Explain concept
          </button>
          <button className="hint-chip" onClick={() => onPrompt('Turn these notes into a concise summary.')} type="button">
            Summarize notes
          </button>
          <button className="hint-chip" onClick={() => onPrompt('Draft a careful answer with examples.')} type="button">
            Draft answer
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((message) => (
        <ChatMessageRow key={message.id} message={message} />
      ))}
      {isSending ? null : <div className="chat-scroll-spacer" />}
    </>
  );
}
