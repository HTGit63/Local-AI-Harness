import { streamNdjson } from '../../lib/streamNdjson';
import { fetchJson, getApiBase } from '../shared/apiBase';
import type { ChatMessage, ChatSession, ChatStreamEvent, ComposerImageAttachment, ConversationMode } from './chatTypes';

const API = getApiBase();

export const CHAT_MODES: Array<{ id: ConversationMode; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'data-analysis', label: 'Data Analysis' },
  { id: 'code-review', label: 'Code Review' },
  { id: 'implementation', label: 'Implementation' },
];

export function makeChatId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export async function fetchChatSessions(): Promise<ChatSession[]> {
  return fetchJson<ChatSession[]>(`${API}/sessions`);
}

export async function createChatSession(): Promise<ChatSession> {
  return fetchJson<ChatSession>(`${API}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills: [] }),
  });
}

export async function resumeChatSession(id: string): Promise<ChatSession> {
  return fetchJson<ChatSession>(`${API}/session/${id}/resume`, { method: 'POST' });
}

export async function fetchChatHealth(): Promise<{ status: 'ok' | 'degraded' | 'offline'; model?: string }> {
  return fetchJson<{ status: 'ok' | 'degraded' | 'offline'; model?: string }>(`${API}/health`);
}

export async function fetchActiveModel(): Promise<string | null> {
  const runtime = await fetchJson<{ activeModel: string | null; configuredModel: string }>(`${API}/model/runtime`);
  return runtime.activeModel || runtime.configuredModel || null;
}

function buildChatSystemPrompt(mode: ConversationMode): string {
  const modeInstr: Record<ConversationMode, string> = {
    general: 'Be concise, useful, and concrete.',
    architecture: 'Focus on system structure, boundaries, migration risks, tradeoffs, and rollout sequencing.',
    'data-analysis': 'Focus on data quality, metrics, trends, assumptions, and validation.',
    'code-review': 'Prioritize correctness, regressions, security, and missing tests. Findings first.',
    implementation: 'Discuss implementation steps and code ideas without accessing local repo tools.',
  };

  return [
    'You are a local-first chat assistant.',
    modeInstr[mode],
    'This is Chat Mode: do not claim to inspect local files, run commands, edit files, create checkpoints, or use repo tools.',
    'Answer from the conversation and any user-attached images only.',
    'If the model emits <think>...</think> blocks, preserve them in the response.',
  ].join(' ');
}

export async function streamChatMessage({
  mode,
  messages,
  content,
  images,
  thinking,
  onEvent,
}: {
  mode: ConversationMode;
  messages: ChatMessage[];
  content: string;
  images: ComposerImageAttachment[];
  thinking: boolean;
  onEvent: (event: ChatStreamEvent) => void;
}) {
  const requestMessages = [
    { role: 'system' as const, content: buildChatSystemPrompt(mode) },
    ...messages.map((message) => ({ role: message.role, content: message.content })),
    { role: 'user' as const, content },
  ];

  await streamNdjson<ChatStreamEvent>(`${API}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'chat',
      agentic: false,
      executionMode: 'direct',
      workspaceRoot: null,
      allowTools: false,
      advancedTools: false,
      messages: requestMessages,
      thinking,
      images: images.map((image) => image.base64),
    }),
  }, onEvent);
}
