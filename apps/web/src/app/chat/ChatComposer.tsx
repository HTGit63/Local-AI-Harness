import type { ChangeEvent, KeyboardEvent, RefObject } from 'react';
import { formatBytes, MAX_CHAT_IMAGE_ATTACHMENTS, MAX_CHAT_IMAGE_BYTES } from '../shared/attachments';
import { CHAT_MODES } from './chatApi';
import type { ComposerImageAttachment, ConversationMode } from './chatTypes';

export function ChatComposer({
  draft,
  mode,
  thinkingEnabled,
  attachedImages,
  attachmentNotice,
  isSending,
  imageInputRef,
  onDraftChange,
  onModeChange,
  onThinkingChange,
  onImageInput,
  onRemoveImage,
  onClearImages,
  onSend,
}: {
  draft: string;
  mode: ConversationMode;
  thinkingEnabled: boolean;
  attachedImages: ComposerImageAttachment[];
  attachmentNotice: string;
  isSending: boolean;
  imageInputRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (value: string) => void;
  onModeChange: (value: ConversationMode) => void;
  onThinkingChange: (value: boolean) => void;
  onImageInput: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (id: string) => void;
  onClearImages: () => void;
  onSend: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="composer-wrapper chat-mode-composer">
      <div className="composer">
        <textarea
          className="composer-input"
          placeholder={isSending ? 'Generating response...' : 'Ask, paste notes, or attach an image...'}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        {attachedImages.length > 0 && (
          <div className="composer-attachments">
            <div className="composer-attachments-meta">
              <span>{attachedImages.length} image{attachedImages.length > 1 ? 's' : ''} attached</span>
              <button className="composer-image-clear-all" onClick={onClearImages} type="button">
                Clear all
              </button>
            </div>
            <div className="composer-attachments-list">
              {attachedImages.map((image) => (
                <div key={image.id} className="composer-attachment-item">
                  <img className="composer-attachment-thumb" src={image.dataUrl} alt={image.name} />
                  <button
                    className="composer-attachment-remove"
                    onClick={() => onRemoveImage(image.id)}
                    type="button"
                    aria-label={`Remove ${image.name}`}
                    title={`Remove ${image.name}`}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="composer-actions">
          <div className="composer-actions-left">
            <select
              className="composer-select"
              value={mode}
              onChange={(event) => onModeChange(event.target.value as ConversationMode)}
            >
              {CHAT_MODES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
            </select>
            <button
              className={`composer-toggle composer-toggle-thinking ${thinkingEnabled ? 'composer-toggle-active' : ''}`}
              onClick={() => onThinkingChange(!thinkingEnabled)}
              title={thinkingEnabled ? 'Thinking enabled' : 'Thinking disabled'}
              aria-pressed={thinkingEnabled}
              type="button"
            >
              {thinkingEnabled ? 'Thinking on' : 'Thinking off'}
            </button>
          </div>
          <div className="composer-actions-right">
            <button
              className="composer-secondary-btn composer-attach-btn"
              onClick={() => imageInputRef.current?.click()}
              type="button"
              title={`Attach images (max ${MAX_CHAT_IMAGE_ATTACHMENTS}, ${formatBytes(MAX_CHAT_IMAGE_BYTES)} each)`}
              aria-label="Attach images"
            >
              +
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="visually-hidden"
              onChange={onImageInput}
            />
            <button className="send-btn" disabled={isSending || (!draft.trim() && attachedImages.length === 0)} onClick={onSend} type="button">
              {isSending ? '...' : 'Send'}
            </button>
          </div>
        </div>
        <div className="composer-footer">
          {attachmentNotice ? (
            <span className="composer-note composer-note-warning">{attachmentNotice}</span>
          ) : (
            <span className="composer-note">Enter to send. Shift+Enter for newline.</span>
          )}
        </div>
      </div>
    </div>
  );
}
