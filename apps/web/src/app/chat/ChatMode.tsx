import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { readFileAsDataUrl, formatBytes, MAX_CHAT_IMAGE_ATTACHMENTS, MAX_CHAT_IMAGE_BYTES } from '../shared/attachments';
import { RuntimeStatusBadge, type BackendStatus } from '../shared/RuntimeStatusBadge';
import { ChatComposer } from './ChatComposer';
import { ChatHistory } from './ChatHistory';
import { ChatMessageList } from './ChatMessageList';
import {
  createChatSession,
  fetchActiveRuntime,
  fetchChatHealth,
  fetchChatSessions,
  makeChatId,
  resumeChatSession,
  streamChatMessage,
} from './chatApi';
import type { ChatMessage, ChatSession, ComposerImageAttachment, ConversationMode } from './chatTypes';

export function ChatMode({
  onBack,
  onOpenAgent,
}: {
  onBack: () => void;
  onOpenAgent: () => void;
}) {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('offline');
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [runtimeWarning, setRuntimeWarning] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<ConversationMode>('general');
  const [isSending, setIsSending] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [attachedImages, setAttachedImages] = useState<ComposerImageAttachment[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [streamStatus, setStreamStatus] = useState('Ready');
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const refreshChatState = useCallback(async () => {
    const [health, runtime, sessionList] = await Promise.all([
      fetchChatHealth().catch(() => ({ status: 'offline' as const })),
      fetchActiveRuntime().catch(() => ({ model: null, provider: null, fallbackWarning: undefined })),
      fetchChatSessions().catch(() => []),
    ]);
    setBackendStatus(health.status);
    setActiveModel(runtime.model || ('model' in health ? health.model || null : null));
    setActiveProvider(runtime.provider || ('provider' in health ? health.provider || null : null));
    setRuntimeWarning(runtime.fallbackWarning || ('fallbackWarning' in health ? health.fallbackWarning || '' : ''));
    setSessions(sessionList);
  }, []);

  useEffect(() => {
    void refreshChatState();
  }, [refreshChatState]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: isSending ? 'auto' : 'smooth' });
  }, [isSending, messages]);

  async function ensureSession(): Promise<ChatSession> {
    if (session) return session;
    const created = await createChatSession();
    setSession(created);
    await refreshChatState();
    return created;
  }

  async function startNewThread() {
    const created = await createChatSession();
    setSession(created);
    setMessages([]);
    await refreshChatState();
  }

  async function resumeThread(sessionId: string) {
    const resumed = await resumeChatSession(sessionId);
    setSession(resumed);
    setMessages([]);
    await refreshChatState();
  }

  async function handleImageInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const rejectedTypeCount = files.length - imageFiles.length;
    const validSizeFiles = imageFiles.filter((file) => file.size <= MAX_CHAT_IMAGE_BYTES);
    const rejectedSizeCount = imageFiles.length - validSizeFiles.length;
    const remainingSlots = Math.max(0, MAX_CHAT_IMAGE_ATTACHMENTS - attachedImages.length);
    const acceptedFiles = validSizeFiles.slice(0, remainingSlots);
    const rejectedCount = validSizeFiles.length - acceptedFiles.length;
    const notices: string[] = [];

    if (rejectedTypeCount > 0) notices.push('Only image files are supported.');
    if (rejectedSizeCount > 0) notices.push(`Images must be ${formatBytes(MAX_CHAT_IMAGE_BYTES)} or smaller.`);
    if (rejectedCount > 0) notices.push(`Only ${MAX_CHAT_IMAGE_ATTACHMENTS} images can be attached per turn.`);

    const encoded = await Promise.all(acceptedFiles.map(async (file) => {
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(',')[1] || '';
      if (!base64) return null;
      return {
        id: makeChatId('img'),
        name: file.name,
        dataUrl,
        base64,
      } satisfies ComposerImageAttachment;
    }));

    setAttachedImages((current) => [...current, ...encoded.filter((image): image is ComposerImageAttachment => image !== null)]);
    setAttachmentNotice(notices.join(' '));
  }

  async function sendMessage() {
    const content = draft.trim();
    if (isSending || (!content && attachedImages.length === 0)) return;

    setIsSending(true);
    setStreamStatus('Preparing response');
    let placeholderId = '';

    try {
      await ensureSession();
      const now = Date.now();
      const userAttachments = attachedImages.map(({ id, name, dataUrl }) => ({ id, name, dataUrl }));
      const userMessage: ChatMessage = {
        id: makeChatId('msg'),
        role: 'user',
        content,
        mode,
        createdAt: now,
        status: 'sent',
        attachments: userAttachments,
      };
      const placeholder: ChatMessage = {
        id: makeChatId('msg'),
        role: 'assistant',
        content: '',
        mode,
        createdAt: now + 1,
        status: 'sending',
      };

      placeholderId = placeholder.id;
      const priorMessages = messages;
      setMessages((current) => [...current, userMessage, placeholder]);
      setDraft('');

      await streamChatMessage({
        mode,
        messages: priorMessages,
        content,
        images: attachedImages,
        thinking: thinkingEnabled,
        onEvent: (event) => {
          if (event.type === 'status') {
            setStreamStatus(String(event.action || event.phase));
            setMessages((current) => current.map((message) => (
              message.id === placeholderId
                ? { ...message, status: message.content ? 'streaming' : message.status }
                : message
            )));
            return;
          }

          if (event.type === 'delta') {
            setMessages((current) => current.map((message) => (
              message.id === placeholderId
                ? { ...message, content: message.content + event.delta, status: 'streaming' }
                : message
            )));
            return;
          }

          if (event.type === 'done') {
            setMessages((current) => current.map((message) => (
              message.id === placeholderId
                ? { ...message, content: typeof event.response === 'string' ? event.response || message.content : message.content, status: 'sent' }
                : message
            )));
            setStreamStatus('Ready');
            return;
          }

          if (event.type === 'error') {
            setMessages((current) => current.map((message) => (
              message.id === placeholderId
                ? { ...message, content: `Error: ${event.message}`, status: 'error' }
                : message
            )));
            setStreamStatus('Error');
          }
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get response.';
      setMessages((current) => current.map((entry) => (
        entry.id === placeholderId || entry.status === 'sending' || entry.status === 'streaming'
          ? { ...entry, content: `Error: ${message}`, status: 'error' }
          : entry
      )));
      setStreamStatus('Error');
    } finally {
      setIsSending(false);
      setAttachedImages([]);
      setAttachmentNotice('');
      await refreshChatState();
    }
  }

  return (
    <div className="chat-mode-shell">
      <header className="chat-mode-topbar">
        <div className="topbar-left">
          <button className="icon-btn" onClick={onBack} type="button" title="Mode landing">←</button>
          <div className="topbar-logo">G4</div>
          <div className="topbar-brand">
            <span className="topbar-kicker">Chat Mode</span>
            <span className="topbar-title">Chat</span>
          </div>
        </div>
        <RuntimeStatusBadge status={backendStatus} model={activeModel} provider={activeProvider} warning={runtimeWarning} />
        <div className="topbar-right">
          <button className="sidebar-action" onClick={onOpenAgent} type="button">Agent</button>
        </div>
      </header>

      <div className="chat-mode-layout">
        <ChatHistory
          sessions={sessions}
          activeSessionId={session?.id}
          onNewThread={() => { void startNewThread(); }}
          onResume={(sessionId) => { void resumeThread(sessionId); }}
        />
        <main className="chat-mode-main">
          <div className="visually-hidden" aria-live="polite">{streamStatus}</div>
          <div className="chat-messages chat-mode-messages" ref={scrollRef}>
            <ChatMessageList messages={messages} isSending={isSending} onPrompt={setDraft} />
          </div>
          <ChatComposer
            draft={draft}
            mode={mode}
            thinkingEnabled={thinkingEnabled}
            attachedImages={attachedImages}
            attachmentNotice={attachmentNotice}
            isSending={isSending}
            imageInputRef={imageInputRef}
            onDraftChange={setDraft}
            onModeChange={setMode}
            onThinkingChange={setThinkingEnabled}
            onImageInput={(event) => { void handleImageInput(event); }}
            onRemoveImage={(id) => {
              setAttachedImages((current) => current.filter((image) => image.id !== id));
              setAttachmentNotice('');
            }}
            onClearImages={() => {
              setAttachedImages([]);
              setAttachmentNotice('');
            }}
            onSend={() => { void sendMessage(); }}
          />
        </main>
      </div>
    </div>
  );
}
