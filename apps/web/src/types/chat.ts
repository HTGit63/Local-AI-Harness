export type ChatRole = 'user' | 'assistant';
export type ExecutionMode = 'direct' | 'agentic';

export interface ChatStreamStatusEvent {
  type: 'status';
  phase: string;
  action: string;
  loop: number;
}
