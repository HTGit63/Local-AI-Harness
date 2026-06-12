export type ChatRole = 'user' | 'assistant';
export type ConversationMode = 'general' | 'architecture' | 'data-analysis' | 'code-review' | 'implementation';

export interface MessageImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

export interface ComposerImageAttachment extends MessageImageAttachment {
  base64: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  mode: ConversationMode;
  createdAt: number;
  status?: 'sending' | 'streaming' | 'sent' | 'error';
  attachments?: MessageImageAttachment[];
}

export interface ChatSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  mode: string;
  skillsActive: string[];
  turnHistory?: Array<{
    timestamp: number;
    executionMode: 'chat' | 'agent';
    promptMode?: string;
    intent?: string;
    summary?: string;
  }>;
}

export type ChatStreamEvent =
  | { type: 'status'; phase: string; action: string; loop: number }
  | { type: 'delta'; delta: string }
  | { type: 'done'; response: string; executionMode?: 'chat' | 'agent' }
  | { type: 'error'; message: string }
  | { type: string; [key: string]: unknown };
