export type TaskIntent =
  | 'chat'
  | 'inspect_project'
  | 'inspect_file'
  | 'search_project'
  | 'edit_file'
  | 'run_command'
  | 'summarize_changes'
  | 'full_audit';

export type TaskSizeEstimate = 'none' | 'small' | 'medium' | 'large';
export type TaskPlanMode = 'chat' | 'agent';
export type TaskPlanStatus = 'pending' | 'running' | 'blocked' | 'safe_idle' | 'done' | 'failed';
export type ToolProfileName = 'chat' | 'inspect' | 'edit-basic' | 'verify' | 'advanced';

export const TOOL_PROFILES: Record<ToolProfileName, string[]> = {
  chat: [],
  inspect: ['listDir', 'readFile', 'searchText'],
  'edit-basic': ['listDir', 'readFile', 'searchText', 'writeFile', 'patchFile', 'runCommand', 'gitStatus', 'gitDiff'],
  verify: ['runCommand', 'gitStatus', 'gitDiff'],
  advanced: [
    'glob',
    'webSearch',
    'fetchUrl',
    'findSymbol',
    'findFunction',
    'findComponent',
    'whatDoesThisImport',
    'whoImports',
    'affectedFiles',
    'selectTestsForChangedFiles',
    'detectProjectCommands',
    'buildContextPack',
    'replaceFunction',
    'insertImport',
    'addTypeProperty',
    'renameIdentifier',
    'replaceRange',
    'insertAfter',
    'insertBefore',
    'replaceBlock',
    'applyUnifiedPatch',
    'previewPatch',
    'getStructuredDiff',
    'createCheckpoint',
    'rollbackToCheckpoint',
  ],
};

export type TaskStepType =
  | 'intake'
  | 'inspect'
  | 'plan'
  | 'edit'
  | 'verify'
  | 'summarize'
  | 'approval';

export type TaskStepStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | 'safe_idle';

export interface TaskBudget {
  maxModelCalls: number;
  maxToolCalls: number;
  maxFilesToRead: number;
  maxFilesToWrite: number;
  maxOutputTokens: number;
}

export interface LightweightPlanStep {
  id: string;
  title: string;
  type: TaskStepType;
  status: TaskStepStatus;
  files?: string[];
  toolsAllowed: string[];
  successCriteria: string[];
  budget: TaskBudget;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
  error?: string;
}

export type TaskStep = LightweightPlanStep;

export interface LightweightPlan {
  id: string;
  mode: TaskPlanMode;
  intent: TaskIntent;
  goal: string;
  status: TaskPlanStatus;
  steps: LightweightPlanStep[];
  currentStepId?: string;
  evidence: string[];
  nextAction?: string;
  stopCondition: string;
  revisedAt?: number;
}

export interface TaskPlan extends LightweightPlan {
  userRequest: string;
  title: string;
  summary: string;
  workspaceRoot: string;
  sizeEstimate: TaskSizeEstimate;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  failedAt?: number;
}

export interface LocalModelBudgetProfile {
  contextBudget: number;
  outputBudgetDirect: number;
  outputBudgetInspect: number;
  outputBudgetEdit: number;
  outputBudgetComplexPlan: number;
  outputBudgetFinalReport: number;
  maxModelCallsPerRun: number;
  maxToolCallsPerRun: number;
}

export const LOCAL_MODEL_BUDGET_PROFILES: Record<'lean' | 'balanced' | 'deep', LocalModelBudgetProfile> = {
  lean: {
    contextBudget: 8000,
    outputBudgetDirect: 512,
    outputBudgetInspect: 768,
    outputBudgetEdit: 1024,
    outputBudgetComplexPlan: 1200,
    outputBudgetFinalReport: 1000,
    maxModelCallsPerRun: 6,
    maxToolCallsPerRun: 20,
  },
  balanced: {
    contextBudget: 14000,
    outputBudgetDirect: 768,
    outputBudgetInspect: 1024,
    outputBudgetEdit: 1400,
    outputBudgetComplexPlan: 1600,
    outputBudgetFinalReport: 1200,
    maxModelCallsPerRun: 10,
    maxToolCallsPerRun: 35,
  },
  deep: {
    contextBudget: 22000,
    outputBudgetDirect: 1024,
    outputBudgetInspect: 1400,
    outputBudgetEdit: 1800,
    outputBudgetComplexPlan: 2200,
    outputBudgetFinalReport: 1600,
    maxModelCallsPerRun: 16,
    maxToolCallsPerRun: 60,
  },
};

type PlanInput = {
  userRequest: string;
  intent: string;
  workspaceRoot: string;
  mode?: TaskPlanMode;
  repoSummary?: string;
  knownFiles?: string[];
};

type ClassifyInput = {
  userRequest: string;
  intent: string;
  knownFiles?: string[];
};

const FILE_PATH_PATTERN = /(?:^|\s)([A-Za-z0-9_.@-]+\/)+(?:[A-Za-z0-9_.@-]+\.[A-Za-z0-9_.@-]+)(?:\s|$)/g;

function createTaskPlanId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractKnownFiles(userRequest: string, knownFiles: string[] = []): string[] {
  const fromText = Array.from(userRequest.matchAll(FILE_PATH_PATTERN))
    .map((match) => match[0].trim())
    .map((entry) => entry.replace(/[.,:;)]$/, ''));
  return Array.from(new Set([...knownFiles, ...fromText])).filter(Boolean);
}

function titleFromRequest(userRequest: string, fallback: string): string {
  const clean = userRequest.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean;
}

function baseBudget(overrides: Partial<TaskBudget> = {}): TaskBudget {
  return {
    maxModelCalls: 1,
    maxToolCalls: 2,
    maxFilesToRead: 1,
    maxFilesToWrite: 0,
    maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetInspect,
    ...overrides,
  };
}

function step(
  id: string,
  title: string,
  type: TaskStepType,
  toolsAllowed: string[],
  successCriteria: string[],
  budget: TaskBudget,
  files?: string[],
): TaskStep {
  return {
    id,
    title,
    type,
    status: 'pending',
    files,
    toolsAllowed,
    successCriteria,
    budget,
  };
}

function isExplicitFullAudit(normalized: string): boolean {
  return /\b(full audit|repo-wide audit|review the whole repo|audit the whole codebase|whole codebase audit|find all bottlenecks|all bottlenecks)\b/.test(normalized);
}

function isProjectInspectionRequest(normalized: string): boolean {
  const projectTarget = /\b(app|application|codebase|project|repo|repository|site|website|workspace)\b/.test(normalized);
  const asksToInspect = /\b(analy[sz]e|check|inspect|look at|review|scan|tell me|explain|summarize)\b/.test(normalized);
  const asksProjectType = /\b(what kind|what type|kind of project|type of project|what is this project|what kind of app)\b/.test(normalized);
  const asksStructure = /\b(stack|structure|structured|entry points?|how .* organized)\b/.test(normalized);
  const asksBugReview = /\b(any bugs?|bugs?|broken|issues?|problems?|working at (its )?best)\b/.test(normalized);

  return projectTarget && (asksProjectType || asksStructure || asksBugReview || (asksToInspect && /\b(files?|source|structure)\b/.test(normalized)));
}

function normalizeExternalIntent(intent: string): TaskIntent {
  switch (intent) {
    case 'inspect_project':
      return 'inspect_project';
    case 'read_file':
    case 'explain_code':
      return 'inspect_file';
    case 'find_file':
    case 'search_text':
      return 'search_project';
    case 'edit_code':
    case 'write_file':
      return 'edit_file';
    case 'run_command':
      return 'run_command';
    case 'review_diff':
      return 'summarize_changes';
    case 'workspace_overview':
      return 'inspect_project';
    case 'status_query':
    case 'model_status':
    case 'general_chat':
    case 'browser_snapshot_only':
    case 'workspace_binding_needed':
    default:
      return 'chat';
  }
}

function inferIntent(input: ClassifyInput): TaskIntent {
  const normalized = normalizeText(input.userRequest);
  const knownFiles = extractKnownFiles(input.userRequest, input.knownFiles);
  const externalIntent = normalizeExternalIntent(input.intent);
  const asksToEdit = /\b(add|change|create|delete|edit|fix|implement|make|patch|refactor|remove|rename|update|write)\b/.test(normalized);
  const asksToRunCommand =
    /\b(npm|pnpm|yarn|bun|node|tsx|tsc|pytest|uv|cargo|go test|gradle|mvn)\b/.test(normalized) ||
    /\b(run|execute)\b[^.?!\n]{0,80}\b(test|tests|lint|build|benchmark|doctor|script|command)\b/.test(normalized) ||
    /\b(test|lint|build|benchmark|doctor)\s+(command|script|target)\b/.test(normalized);

  if (isExplicitFullAudit(normalized)) {
    return 'full_audit';
  }
  if (isProjectInspectionRequest(normalized)) {
    return 'inspect_project';
  }
  if (asksToEdit || externalIntent === 'edit_file') {
    return 'edit_file';
  }
  if (asksToRunCommand || externalIntent === 'run_command') {
    return 'run_command';
  }
  if (/\b(git diff|review changes|summarize changes|what changed|status)\b/.test(normalized) || externalIntent === 'summarize_changes') {
    return 'summarize_changes';
  }
  if (/\b(read file|open file|inspect file|show file|cat file|explain file)\b/.test(normalized) || (knownFiles.length === 1 && /\b(explain|inspect|read|show)\b/.test(normalized))) {
    return 'inspect_file';
  }
  if (/\b(find file|which file|where is|locate file|search|grep|look for|references to|mentions of)\b/.test(normalized) || externalIntent === 'search_project') {
    return 'search_project';
  }
  return externalIntent === 'inspect_project' ? 'inspect_project' : 'chat';
}

function estimateSize(intent: TaskIntent, files: string[], normalized: string): TaskSizeEstimate {
  if (intent === 'chat') return 'none';
  if (intent === 'full_audit') return 'large';
  if (files.length > 3 || /\b(across|multiple files|many files|whole|all)\b/.test(normalized)) return 'medium';
  if (intent === 'edit_file' || intent === 'run_command' || intent === 'search_project') return 'small';
  return 'small';
}

function stopConditionForIntent(intent: TaskIntent): string {
  switch (intent) {
    case 'chat':
      return 'Stop after a concise answer. Do not create tools or checkpoints.';
    case 'inspect_project':
      return 'Stop once manifest, entry points, view/static dirs, and run commands are identified.';
    case 'inspect_file':
      return 'Stop after the requested file evidence is read and explained.';
    case 'search_project':
      return 'Stop when matching files or no-match evidence is enough.';
    case 'edit_file':
      return 'Stop after minimal patch, targeted verification, and summary.';
    case 'run_command':
      return 'Stop after command result or policy denial is visible.';
    case 'summarize_changes':
      return 'Stop after git status/diff summary is complete.';
    case 'full_audit':
      return 'Stop after bounded audit findings and explicit deferred scope.';
  }
}

function planStepTemplates(intent: TaskIntent, files: string[]): TaskStep[] {
  switch (intent) {
    case 'chat':
      return [
        step('answer', 'Answer directly', 'summarize', [], ['Concise answer produced without tools'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetDirect })),
      ];

    case 'inspect_project':
      return [
        step('inspect_manifest', 'Inspect manifest and obvious project files', 'inspect', TOOL_PROFILES.inspect, ['Project type, scripts, entries, and static/view dirs identified'], baseBudget({ maxModelCalls: 0, maxToolCalls: 4, maxFilesToRead: 6, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetInspect })),
        step('summarize', 'Summarize lightweight project inspection', 'summarize', [], ['No edit, checkpoint, web, or repo-wide audit tools used'], baseBudget({ maxModelCalls: 0, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];

    case 'inspect_file':
      return [
        step('inspect_target', 'Inspect requested file', 'inspect', ['readFile'], ['Target file read or missing state explained'], baseBudget({ maxToolCalls: 1, maxFilesToRead: 1 }), files.slice(0, 1)),
        step('summarize', 'Explain file evidence', 'summarize', [], ['Answer grounded in inspected file'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];

    case 'search_project':
      return [
        step('search', 'Search bounded workspace surface', 'inspect', ['listDir', 'searchText'], ['Search evidence collected without broad repo dump'], baseBudget({ maxToolCalls: 3, maxFilesToRead: 0 })),
        step('summarize', 'Summarize search result', 'summarize', [], ['Matches or no-match evidence reported'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];

    case 'edit_file':
      return [
        step('inspect', 'Inspect minimal target context', 'inspect', ['listDir', 'readFile', 'searchText'], ['Only likely target files inspected'], baseBudget({ maxToolCalls: 4, maxFilesToRead: 3 }), files.slice(0, 3)),
        step('edit', 'Apply minimal edit', 'edit', ['writeFile', 'patchFile'], ['Minimal approved edit applied'], baseBudget({ maxModelCalls: 1, maxToolCalls: 3, maxFilesToRead: 3, maxFilesToWrite: 2, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetEdit }), files.slice(0, 2)),
        step('verify', 'Run targeted verification', 'verify', TOOL_PROFILES.verify, ['Targeted command or diff check completed'], baseBudget({ maxToolCalls: 3 })),
        step('summarize', 'Summarize result', 'summarize', [], ['Files changed and verification summarized'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetFinalReport })),
      ];

    case 'run_command':
      return [
        step('scope_command', 'Scope command and policy mode', 'intake', [], ['Command intent and policy constraints visible'], baseBudget({ maxModelCalls: 0, maxToolCalls: 0 })),
        step('run_command', 'Run or deny command', 'verify', ['runCommand'], ['Command result, denial, or approval state visible'], baseBudget({ maxModelCalls: 0, maxToolCalls: 1 })),
        step('summarize', 'Summarize command result', 'summarize', [], ['Exit result and next safe action summarized'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];

    case 'summarize_changes':
      return [
        step('read_status', 'Read git status and diff', 'inspect', ['gitStatus', 'gitDiff'], ['Changed files and diff summary available'], baseBudget({ maxModelCalls: 0, maxToolCalls: 2 })),
        step('summarize', 'Summarize current changes', 'summarize', [], ['Summary is grounded in git evidence'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];

    case 'full_audit':
      return [
        step('scope', 'Confirm explicit full-audit scope', 'intake', [], ['Request is explicit full audit, not simple inspection'], baseBudget({ maxModelCalls: 0, maxToolCalls: 0 })),
        step('inspect', 'Inspect bounded high-signal surfaces', 'inspect', ['listDir', 'readFile', 'searchText'], ['Top manifests, entry points, and tests inspected'], baseBudget({ maxToolCalls: 8, maxFilesToRead: 8 })),
        step('report', 'Report findings and deferred scope', 'summarize', [], ['Findings and residual risk reported'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetFinalReport })),
      ];
  }
}

export class TaskOrchestrator {
  classifyTaskIntent(input: ClassifyInput): TaskIntent {
    return inferIntent(input);
  }

  classifyComplexity(input: ClassifyInput): TaskIntent {
    return this.classifyTaskIntent(input);
  }

  createPlan(input: PlanInput): TaskPlan {
    const intent = this.classifyTaskIntent({
      userRequest: input.userRequest,
      intent: input.intent,
      knownFiles: input.knownFiles,
    });
    const files = extractKnownFiles(input.userRequest, input.knownFiles);
    const normalized = normalizeText(input.userRequest);
    const sizeEstimate = estimateSize(intent, files, normalized);
    const now = Date.now();
    const title = titleFromRequest(input.userRequest, `Task: ${intent}`);
    const summary = [
      `Intent ${intent}.`,
      `Size ${sizeEstimate}.`,
      input.repoSummary ? `Context: ${input.repoSummary}` : '',
    ].filter(Boolean).join(' ');
    const steps = planStepTemplates(intent, files);

    return {
      id: createTaskPlanId(),
      mode: input.mode ?? 'agent',
      intent,
      goal: title,
      userRequest: input.userRequest,
      title,
      summary,
      status: 'pending',
      workspaceRoot: input.workspaceRoot,
      sizeEstimate,
      steps,
      evidence: [],
      nextAction: steps[0]?.title ?? 'Await input',
      stopCondition: stopConditionForIntent(intent),
      createdAt: now,
      updatedAt: now,
    };
  }

  getNextStep(plan: TaskPlan): TaskStep | null {
    return plan.steps.find((entry) => entry.status === 'pending') ?? null;
  }

  revisePlan(plan: TaskPlan, patch: Partial<Pick<TaskPlan, 'goal' | 'summary' | 'nextAction' | 'stopCondition'>> & { evidence?: string[] }): TaskPlan {
    return {
      ...plan,
      ...patch,
      evidence: patch.evidence ? Array.from(new Set([...plan.evidence, ...patch.evidence])) : plan.evidence,
      revisedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  markStepRunning(plan: TaskPlan, stepId: string): TaskPlan {
    const updated = this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'running',
      startedAt: stepToUpdate.startedAt ?? Date.now(),
      endedAt: undefined,
      error: undefined,
    }));
    const currentStep = updated.steps.find((entry) => entry.id === stepId);
    return {
      ...updated,
      status: 'running',
      currentStepId: currentStep?.id,
      nextAction: currentStep?.title ?? updated.nextAction,
    };
  }

  markStepDone(plan: TaskPlan, stepId: string, detail?: string): TaskPlan {
    const updated = this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'done',
      detail: detail ?? stepToUpdate.detail,
      endedAt: Date.now(),
      error: undefined,
    }));
    const evidence = detail ? Array.from(new Set([...updated.evidence, detail])) : updated.evidence;
    const nextStep = this.getNextStep(updated);
    const complete = this.isComplete(updated);
    return {
      ...updated,
      evidence,
      status: complete ? 'done' : 'running',
      currentStepId: nextStep?.id,
      nextAction: nextStep?.title ?? 'Summarize result',
      completedAt: complete ? updated.completedAt ?? Date.now() : updated.completedAt,
      updatedAt: Date.now(),
    };
  }

  markStepFailed(plan: TaskPlan, stepId: string, error: string): TaskPlan {
    return {
      ...this.updateStep(plan, stepId, (stepToUpdate) => ({
        ...stepToUpdate,
        status: 'failed',
        error,
        endedAt: Date.now(),
      })),
      status: 'failed',
      currentStepId: stepId,
      nextAction: 'Report failure and stop',
      failedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  markStepBlocked(plan: TaskPlan, stepId: string, reason: string): TaskPlan {
    return {
      ...this.updateStep(plan, stepId, (stepToUpdate) => ({
        ...stepToUpdate,
        status: 'blocked',
        error: reason,
        endedAt: Date.now(),
      })),
      status: 'blocked',
      currentStepId: stepId,
      nextAction: 'Wait for approval or narrower scope',
      updatedAt: Date.now(),
    };
  }

  markSafeIdle(plan: TaskPlan, reason: string): TaskPlan {
    return {
      ...plan,
      status: 'safe_idle',
      nextAction: 'Await user input',
      evidence: Array.from(new Set([...plan.evidence, reason])),
      revisedAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  markStepSkipped(plan: TaskPlan, stepId: string, reason?: string): TaskPlan {
    const updated = this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'skipped',
      detail: reason ?? stepToUpdate.detail,
      endedAt: Date.now(),
    }));
    const complete = this.isComplete(updated);
    return {
      ...updated,
      status: complete ? 'done' : updated.status,
      completedAt: complete ? updated.completedAt ?? Date.now() : updated.completedAt,
      updatedAt: Date.now(),
    };
  }

  isComplete(plan: TaskPlan): boolean {
    return plan.steps.length > 0 && plan.steps.every((entry) => ['done', 'skipped'].includes(entry.status));
  }

  summarizeProgress(plan: TaskPlan): string {
    const done = plan.steps.filter((entry) => entry.status === 'done').length;
    const failed = plan.steps.filter((entry) => entry.status === 'failed').length;
    const blocked = plan.steps.filter((entry) => entry.status === 'blocked').length;
    const running = plan.steps.find((entry) => entry.status === 'running');
    return [
      `${done}/${plan.steps.length} steps done`,
      failed ? `${failed} failed` : '',
      blocked ? `${blocked} blocked` : '',
      running ? `running: ${running.title}` : '',
    ].filter(Boolean).join(' · ');
  }

  private updateStep(plan: TaskPlan, stepId: string, update: (step: TaskStep) => TaskStep): TaskPlan {
    let found = false;
    const steps = plan.steps.map((entry) => {
      if (entry.id !== stepId) {
        return entry;
      }
      found = true;
      return update(entry);
    });
    if (!found) {
      return plan;
    }
    return {
      ...plan,
      steps,
      updatedAt: Date.now(),
    };
  }
}
