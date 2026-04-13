import { ChatMessage, ModelAdapter } from './index.js';

export class OllamaAdapter implements ModelAdapter {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://127.0.0.1:11434/v1', model: string = 'gemma4:e4b') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': 'Bearer ollama' }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ollama'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}
