export type RunMode = 'quick_inspect' | 'code_review' | 'targeted_edit' | 'doc_generation';
export declare class PromptOptimizer {
    private mode;
    constructor(mode?: RunMode);
    optimizeForTask(task: string, contextLength: number): string;
    detectReframing(response: string): boolean;
}
