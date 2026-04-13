export declare const RECIPES: {
    zeroShot: (task: string, constraints: string) => string;
    fewShotPatch: (instruction: string, existing: string) => string;
    toolReAct: (tools: string[], goal: string) => string;
    evaluation: (output: string) => string;
    fileSummary: (content: string) => string;
    codeReview: (diff: string) => string;
    baselineInstruction: () => string;
    factualityGuard: (text: string) => string;
    selfCheck: (output: string) => string;
    fileSynthesis: (files: string[]) => string;
    quickInspect: (task: string) => string;
    targetedEdit: (task: string) => string;
    docGeneration: (task: string) => string;
    codeReviewWorkflow: (task: string) => string;
    toolCorrection: () => string;
    manualToolProtocol: (examples: string[]) => string;
    manualToolCorrection: () => string;
};
