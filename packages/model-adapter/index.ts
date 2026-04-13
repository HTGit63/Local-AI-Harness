export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ModelAdapter {
  chat(messages: ChatMessage[]): Promise<string>;
}
