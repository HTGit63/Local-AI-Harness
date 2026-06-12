import { memo } from 'react';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import type { ChatMessage } from './chatTypes';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function splitAssistantContent(content: string): Array<{ kind: 'content' | 'thought'; value: string }> {
  return content
    .split(/(<think>[\s\S]*?(?:<\/think>|$))/gi)
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase().startsWith('<think>')) {
        let inner = part.slice(7);
        if (inner.toLowerCase().endsWith('</think>')) {
          inner = inner.slice(0, -8);
        }
        return { kind: 'thought' as const, value: inner.trim() };
      }
      return { kind: 'content' as const, value: part };
    })
    .filter((part) => part.value.trim().length > 0);
}

function ChatMessageRowComponent({ message }: { message: ChatMessage }) {
  const isStreaming = message.status === 'sending' || message.status === 'streaming';
  const assistantParts = message.role === 'assistant' ? splitAssistantContent(message.content) : [];
  const hasUserImages = message.role === 'user' && (message.attachments?.length || 0) > 0;
  const showMessageBody = message.status === 'sending' || Boolean(message.content);

  return (
    <div className={`chat-msg ${message.status === 'sending' ? 'chat-msg-pending' : ''} ${message.status === 'error' ? 'chat-msg-error' : ''}`}>
      <div className={`chat-msg-row ${message.role === 'user' ? 'chat-msg-row-user' : ''}`}>
        <div className={`chat-avatar ${message.role === 'user' ? 'chat-avatar-user' : 'chat-avatar-assistant'}`}>
          {message.role === 'user' ? 'U' : 'G4'}
        </div>
        <div className="chat-msg-content">
          <div className="chat-msg-header">
            <span className="chat-msg-name">{message.role === 'user' ? 'You' : 'Assistant'}</span>
            <span className="chat-msg-time">{formatTime(message.createdAt)}</span>
          </div>
          {hasUserImages && (
            <div className="chat-msg-attachments">
              {message.attachments?.map((image) => (
                <a
                  key={image.id}
                  className="chat-msg-attachment"
                  href={image.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={image.name}
                >
                  <img src={image.dataUrl} alt={image.name} loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {showMessageBody && (
            <div className="chat-msg-body">
              {message.status === 'sending' && !message.content ? (
                <div className="chat-typing">
                  <span /><span /><span />
                </div>
              ) : message.role !== 'assistant' ? (
                <MarkdownRenderer content={message.content} />
              ) : (
                assistantParts.map((part, index) => {
                  if (part.kind === 'thought') {
                    return (
                      <details key={index} className="ai-thought-block" open={isStreaming}>
                        <summary className="ai-thought-header">
                          <span className="ai-thought-icon">..</span>
                          <span>Model Thinking</span>
                        </summary>
                        <MarkdownRenderer content={part.value} isStreaming={isStreaming} className="markdown-body ai-thought-content" />
                      </details>
                    );
                  }
                  return <MarkdownRenderer key={index} content={part.value} isStreaming={isStreaming} />;
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ChatMessageRow = memo(ChatMessageRowComponent);
