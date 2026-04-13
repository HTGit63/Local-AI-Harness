import { RECIPES } from './recipes';

export type RunMode = 'quick_inspect' | 'code_review' | 'targeted_edit' | 'doc_generation';

export class PromptOptimizer {
  private mode: RunMode;
  
  constructor(mode: RunMode = 'quick_inspect') {
    this.mode = mode;
  }

  optimizeForTask(task: string, contextLength: number): string {
    const baseline = RECIPES.baselineInstruction();

    // Forced decomposition if the task requests too broad an scope for local Gemma.
    if (contextLength > 4000 || task.toLowerCase().includes('refactor entire') || task.toLowerCase().includes('rewrite')) {
      return [
        baseline,
        `[FALLBACK: TASK TOO BROAD] Decomposition required. Break this into 3 smaller steps and request human confirmation for step 1.`,
        `User request: ${task}`,
      ].join('\n\n');
    }

    switch (this.mode) {
      case 'quick_inspect':
        return [baseline, RECIPES.quickInspect(task)].join('\n\n');
      case 'code_review':
        return [baseline, RECIPES.codeReviewWorkflow(task)].join('\n\n');
      case 'targeted_edit':
        return [baseline, RECIPES.targetedEdit(task)].join('\n\n');
      case 'doc_generation':
        return [baseline, RECIPES.docGeneration(task)].join('\n\n');
      default:
        return [baseline, RECIPES.quickInspect(task)].join('\n\n');
    }
  }

  detectReframing(response: string): boolean {
    // If the model starts summarizing verbosely when it should use tools
    const normalized = response.toLowerCase();
    const genericFallbacks = [
      'the repository is a collection of code, data, and documentation',
      "you didn't provide any specific context",
      'please provide more details about the repository or project',
    ];

    if (genericFallbacks.some((pattern) => normalized.includes(pattern))) {
      return true;
    }

    if (response.split(' ').length > 100 && !response.includes('Call:')) {
      return true; // Indicates harness should interrupt, reframe, narrow, or request tool-first behavior
    }
    return false;
  }
}
