import { memo } from 'react';
import { AgentRunSteps, type AgentRunStepData } from './AgentRunSteps';
import { type AgentRunSummaryData } from './AgentRunSummary';
import { StreamingMarkdown } from './StreamingMarkdown';
import { formatToolInputSummary } from '../lib/run-console';

interface ChatToolEvent {
  id: string;
  name: string;
  state: 'start' | 'done';
  inputSummary: string;
  output?: string;
  success?: boolean;
}

interface MessageImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

export interface ChatMessageRowData {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  executionMode: 'direct' | 'agentic';
  createdAt: number;
  toolEvents: ChatToolEvent[];
  status?: 'sending' | 'streaming' | 'sent' | 'error';
  attachments?: MessageImageAttachment[];
  runSummary?: AgentRunSummaryData;
  runSteps?: AgentRunStepData[];
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

function hasRenderableContent(content: string): boolean {
  return splitAssistantContent(content).some((part) => part.kind === 'content' && part.value.trim().length > 0);
}

function buildHonestFallback(message: ChatMessageRowData): string {
  if (message.runSummary?.summary) {
    return message.runSummary.summary;
  }

  const finishedTools = message.toolEvents.filter((event) => event.state === 'done');
  if (finishedTools.length === 0) {
    return '';
  }

  return `Inspected tool activity only. Completed ${finishedTools.length} tool step${finishedTools.length === 1 ? '' : 's'}, but model did not return final narrative answer.`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ChatMessageRowComponent({ message }: { message: ChatMessageRowData }) {
  const hasUserImages = message.role === 'user' && (message.attachments?.length || 0) > 0;
  const fallbackAssistantContent = message.role === 'assistant' && message.executionMode === 'agentic' && !hasRenderableContent(message.content)
    ? buildHonestFallback(message)
    : '';
  const renderedMessageContent = message.role === 'assistant' && fallbackAssistantContent
    ? fallbackAssistantContent
    : message.content;
  const showMessageBody = message.status === 'sending' || Boolean(renderedMessageContent);
  const assistantParts = message.role === 'assistant' ? splitAssistantContent(renderedMessageContent) : [];
  const isStreaming = message.status === 'sending' || message.status === 'streaming';

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
          {message.role === 'assistant' && message.executionMode === 'agentic' && (message.runSteps?.length || 0) > 0 && (
            <AgentRunSteps steps={message.runSteps || []} />
          )}
          {message.role === 'assistant' && message.executionMode === 'agentic' && message.toolEvents.length > 0 && (
            <div className="tool-call-list">
              {message.toolEvents.map((event) => {
                const stateClass = event.state === 'start'
                  ? 'tool-call-card-running'
                  : event.success === false
                    ? 'tool-call-card-error'
                    : 'tool-call-card-done';
                const stateLabel = event.state === 'start'
                  ? 'Running'
                  : event.success === false
                    ? 'Failed'
                    : 'Done';
                return (
                  <div key={event.id} className={`tool-call-card ${stateClass}`}>
                    <div className="tool-call-card-top">
                      <span className="tool-call-name">{event.name}</span>
                      <span className="tool-call-state">{stateLabel}</span>
                    </div>
                    <pre className="tool-call-input tool-call-input-json">{formatToolInputSummary(event.inputSummary)}</pre>
                    {event.output && (
                      <pre className="tool-call-output">{event.output}</pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
              {message.status === 'sending' && !renderedMessageContent ? (
                <div className="chat-typing">
                  <span /><span /><span />
                </div>
              ) : message.role !== 'assistant' ? (
                <StreamingMarkdown content={renderedMessageContent} isStreaming={false} />
              ) : (
                assistantParts.map((part, index) => {
                  if (part.kind === 'thought') {
                    return (
                      <details key={index} className="ai-thought-block" open={isStreaming}>
                        <summary className="ai-thought-header">
                          <span className="ai-thought-icon">..</span>
                          <span>Model Thinking</span>
                        </summary>
                        <StreamingMarkdown content={part.value} isStreaming={isStreaming} className="markdown-body ai-thought-content" />
                      </details>
                    );
                  }
                  return <StreamingMarkdown key={index} content={part.value} isStreaming={isStreaming} />;
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
