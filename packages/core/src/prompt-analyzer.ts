import { ChatMessage, ModelAdapter } from '@local-harness/model-adapter';

export interface PromptAnalyzerResult {
  needsClarification: boolean;
  clarifyingQuestions?: string[];
  refinedPrompt?: string;
  originalPrompt: string;
}

export class PromptAnalyzer {
  constructor(_modelAdapter: ModelAdapter) {}

  /**
   * Previously evaluated user messages and optionally asked clarifying questions.
   * Now disabled for performance — passes messages straight through without an
   * extra LLM round-trip that added significant latency.
   */
  async analyzeAndRefine(messages: ChatMessage[], _signal?: AbortSignal): Promise<PromptAnalyzerResult> {
    const latestUserMessageIndex = messages.map(m => m.role).lastIndexOf('user');
    if (latestUserMessageIndex === -1) {
      return { needsClarification: false, originalPrompt: '' };
    }

    const latestUserMessage = messages[latestUserMessageIndex].content;

    // Pass-through: no LLM call, no clarification, no rewriting.
    return { needsClarification: false, refinedPrompt: latestUserMessage, originalPrompt: latestUserMessage };
  }
}
