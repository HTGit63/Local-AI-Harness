export type ChatRole = 'user' | 'assistant';
export type ExecutionMode = 'chat' | 'agent';

export interface ChatStreamStatusEvent {
  type: 'status';
  phase: string;
  action: string;
  loop: number;
}
