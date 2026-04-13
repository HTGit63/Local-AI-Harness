import { ChatCompletionRequest, ChatMessage, ModelAdapter } from '@local-harness/model-adapter';
import { CoreEngine } from './engine';

export interface PromptAnalyzerResult {
  needsClarification: boolean;
  clarifyingQuestions?: string[];
  refinedPrompt?: string;
  originalPrompt: string;
}

export class PromptAnalyzer {
  private modelAdapter: ModelAdapter;

  constructor(modelAdapter: ModelAdapter) {
    this.modelAdapter = modelAdapter;
  }

  /**
   * Evaluates the latest user message. If it represents a massive task with vague instructions,
   * it returns questions. Otherwise, it rewrites the prompt to make it flawless based on Prompt
   * Engineering Guide best practices.
   */
  async analyzeAndRefine(messages: ChatMessage[], signal?: AbortSignal): Promise<PromptAnalyzerResult> {
    const latestUserMessageIndex = messages.map(m => m.role).lastIndexOf('user');
    if (latestUserMessageIndex === -1) {
      return { needsClarification: false, originalPrompt: '' };
    }

    const latestUserMessage = messages[latestUserMessageIndex].content;

    // Simple heuristic to skip trivial tasks
    if (latestUserMessage.split(/\s+/).length < 5 && !latestUserMessage.toLowerCase().includes('build')) {
      return { needsClarification: false, refinedPrompt: latestUserMessage, originalPrompt: latestUserMessage };
    }

    const evaluationPrompt = `
You are a Prompt Analyzer sub-agent. Your job is to analyze the following user prompt based on best practices from the Prompt Engineering Guide.

User Prompt:
"""
${latestUserMessage}
"""

Rules:
1. If the user is asking for a HUGE task (e.g., "Build a full stack app") and provides very little detail or lacks constraints, YOU MUST RETURN CLARIFYING QUESTIONS. Return EXACTLY a JSON object: {"needsClarification": true, "questions": ["Question 1", "Question 2", ...]} (between 5-10 questions).
2. If the user prompt is reasonably well-defined or is a simple request, do NOT ask questions. Instead, REFINE the prompt into a "flawless", magnificent, and highly detailed prompt without altering the intended goal. Return EXACTLY a JSON object: {"needsClarification": false, "refinedPrompt": "The flawless rewritten prompt..."}.

Only return valid JSON and nothing else.
`;

    try {
      const response = await this.modelAdapter.createChatCompletion({
        model: 'gemma4:e4b', // Fallback, uses the active configured model if available
        messages: [{ role: 'user', content: evaluationPrompt }],
        temperature: 0.2, // Low temperature for consistent JSON output
        stream: false,
        signal,
      } as any);

      // Parse response
      const content = response.choices?.[0]?.message?.content || '';
      const startIdx = content.indexOf('{');
      const endIdx = content.lastIndexOf('}') + 1;
      if (startIdx >= 0 && endIdx > startIdx) {
        const payload = JSON.parse(content.substring(startIdx, endIdx));
        if (payload.needsClarification && Array.isArray(payload.questions)) {
          return {
            needsClarification: true,
            clarifyingQuestions: payload.questions,
            originalPrompt: latestUserMessage,
          };
        } else if (payload.refinedPrompt) {
          return {
            needsClarification: false,
            refinedPrompt: payload.refinedPrompt,
            originalPrompt: latestUserMessage,
          };
        }
      }
    } catch (e) {
      // Provide silent fallback on error so main loop doesn't break
      return { needsClarification: false, refinedPrompt: latestUserMessage, originalPrompt: latestUserMessage };
    }

    return { needsClarification: false, refinedPrompt: latestUserMessage, originalPrompt: latestUserMessage };
  }
}
