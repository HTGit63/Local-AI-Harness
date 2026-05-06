export type TaskComplexity =
  | 'direct_answer'
  | 'single_file'
  | 'small_patch'
  | 'multi_file'
  | 'architecture_change'
  | 'repo_wide_audit'
  | 'unsafe_or_too_broad';

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
  | 'blocked';

export interface TaskBudget {
  maxModelCalls: number;
  maxToolCalls: number;
  maxFilesToRead: number;
  maxFilesToWrite: number;
  maxOutputTokens: number;
}

export interface TaskStep {
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

export interface TaskPlan {
  id: string;
  userRequest: string;
  title: string;
  summary: string;
  complexity: TaskComplexity;
  intent: string;
  workspaceRoot: string;
  steps: TaskStep[];
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
  repoSummary?: string;
  knownFiles?: string[];
};

type ClassifyInput = {
  userRequest: string;
  intent: string;
  knownFiles?: string[];
};

const DIRECT_INTENTS = new Set(['general_chat', 'explain', 'status', 'model_status', 'workspace_overview']);
const WRITE_INTENTS = new Set(['edit_code', 'write_file', 'run_command']);
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

function planStepTemplates(complexity: TaskComplexity, files: string[]): TaskStep[] {
  switch (complexity) {
    case 'direct_answer':
      return [
        step('intake', 'Classify request', 'intake', [], ['Intent and complexity recorded'], baseBudget({ maxModelCalls: 0, maxToolCalls: 0 })),
        step('summarize', 'Answer directly', 'summarize', [], ['Direct answer produced without broad repo context'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetDirect })),
      ];

    case 'single_file':
      return [
        step('inspect_target', 'Inspect target file', 'inspect', ['readFile'], ['Target file read or explained as missing'], baseBudget({ maxToolCalls: 1, maxFilesToRead: 1 }), files.slice(0, 1)),
        step('focused_action', 'Create checkpoint and apply focused action', 'edit', ['createCheckpoint', 'patchFile', 'replaceRange', 'replaceFunction'], ['Checkpoint created before edit and one focused outcome completed'], baseBudget({ maxModelCalls: 1, maxToolCalls: 4, maxFilesToRead: 1, maxFilesToWrite: 1, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetEdit }), files.slice(0, 1)),
        step('verify', 'Verify targeted result', 'verify', ['getStructuredDiff', 'selectTestsForChangedFiles', 'runCommand'], ['Structured diff and selected check confirm result'], baseBudget({ maxModelCalls: 0, maxToolCalls: 3, maxFilesToRead: 1 })),
        step('summarize', 'Summarize result', 'summarize', [], ['Files changed and verification summarized'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];

    case 'small_patch':
      return [
        step('context_pack', 'Build compact context pack', 'inspect', ['buildContextPack', 'findSymbol', 'searchText'], ['Relevant symbols and file candidates identified without broad repo read'], baseBudget({ maxToolCalls: 4, maxFilesToRead: 0 })),
        step('inspect_files', 'Inspect 1-3 likely files', 'inspect', ['readFile'], ['Only top relevant files read'], baseBudget({ maxToolCalls: 3, maxFilesToRead: 3 }), files.slice(0, 3)),
        step('patch', 'Checkpoint and patch necessary files', 'edit', ['createCheckpoint', 'patchFile', 'replaceRange', 'replaceFunction', 'insertImport', 'addTypeProperty'], ['Minimal patch applied through deterministic edit tools'], baseBudget({ maxModelCalls: 1, maxToolCalls: 7, maxFilesToRead: 3, maxFilesToWrite: 2, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetEdit })),
        step('verify', 'Verify patch', 'verify', ['getStructuredDiff', 'selectTestsForChangedFiles', 'detectProjectCommands', 'runCommand'], ['Structured diff and targeted command checked'], baseBudget({ maxToolCalls: 5 })),
        step('summarize', 'Summarize patch', 'summarize', [], ['Outcome, files, and verification summarized'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetFinalReport })),
      ];

    case 'multi_file':
      return [
        step('context_pack', 'Build compact context pack', 'inspect', ['buildContextPack', 'findSymbol'], ['Relevant files and symbols identified without dumping repo'], baseBudget({ maxToolCalls: 4, maxFilesToRead: 0 })),
        step('dependency_map', 'Map affected files', 'inspect', ['affectedFiles', 'whoImports', 'whatDoesThisImport'], ['Import and affected-file surface identified'], baseBudget({ maxToolCalls: 6, maxFilesToRead: 0 }), files.slice(0, 6)),
        step('subtask_plan', 'Create subtask plan', 'plan', [], ['Work decomposed by file group'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetComplexPlan })),
        step('execute_group_1', 'Checkpoint and execute file group 1', 'edit', ['readFile', 'createCheckpoint', 'patchFile', 'replaceRange', 'replaceFunction', 'insertImport', 'addTypeProperty', 'renameIdentifier'], ['First file group complete'], baseBudget({ maxModelCalls: 1, maxToolCalls: 8, maxFilesToRead: 4, maxFilesToWrite: 4, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetEdit })),
        step('verify_group_1', 'Verify file group 1', 'verify', ['getStructuredDiff', 'selectTestsForChangedFiles', 'runCommand'], ['First file group checked'], baseBudget({ maxToolCalls: 3 })),
        step('execute_group_2', 'Execute file group 2', 'edit', ['readFile', 'patchFile', 'replaceRange', 'replaceFunction', 'insertImport', 'addTypeProperty', 'renameIdentifier'], ['Second file group complete'], baseBudget({ maxModelCalls: 1, maxToolCalls: 8, maxFilesToRead: 4, maxFilesToWrite: 4, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetEdit })),
        step('verify_all', 'Run selected build/test check', 'verify', ['getStructuredDiff', 'selectTestsForChangedFiles', 'runCommand'], ['Selected tests or build checked'], baseBudget({ maxToolCalls: 4 })),
        step('summarize', 'Summarize multi-file work', 'summarize', [], ['Final summary includes completed and remaining work'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetFinalReport })),
      ];

    case 'architecture_change':
      return [
        step('inspect_architecture', 'Inspect core architecture files', 'inspect', ['readFile', 'searchText', 'glob'], ['Core, planner, API, UI entry files inspected'], baseBudget({ maxToolCalls: 8, maxFilesToRead: 8 }), files.slice(0, 8)),
        step('inspect_tests', 'Inspect relevant tests', 'inspect', ['readFile', 'searchText'], ['Existing tests and gaps identified'], baseBudget({ maxToolCalls: 5, maxFilesToRead: 5 })),
        step('design_plan', 'Design phased implementation plan', 'plan', [], ['Architecture plan decomposed into bounded phases'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetComplexPlan })),
        step('create_or_update_module', 'Create or update orchestration module', 'edit', ['writeFile', 'patchFile', 'replaceRange', 'insertAfter', 'insertBefore', 'replaceBlock', 'applyUnifiedPatch', 'previewPatch'], ['New architecture module exists with exports'], baseBudget({ maxModelCalls: 1, maxToolCalls: 8, maxFilesToWrite: 8, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetEdit })),
        step('integrate_core', 'Integrate with core engine', 'edit', ['readFile', 'patchFile', 'replaceRange', 'insertAfter', 'insertBefore', 'replaceBlock'], ['Core uses orchestration without breaking direct chat'], baseBudget({ maxModelCalls: 1, maxToolCalls: 8, maxFilesToRead: 6, maxFilesToWrite: 4, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetEdit })),
        step('integrate_api', 'Integrate API and checkpoints', 'edit', ['readFile', 'patchFile', 'replaceRange', 'insertAfter', 'insertBefore', 'replaceBlock'], ['API exposes run state without breaking existing endpoints'], baseBudget({ maxModelCalls: 1, maxToolCalls: 6, maxFilesToRead: 4, maxFilesToWrite: 3, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetEdit })),
        step('integrate_ui', 'Integrate UI run console', 'edit', ['readFile', 'patchFile', 'replaceRange', 'insertAfter', 'insertBefore', 'replaceBlock'], ['Persistent run console renders plan and activity'], baseBudget({ maxModelCalls: 1, maxToolCalls: 10, maxFilesToRead: 8, maxFilesToWrite: 8, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetEdit })),
        step('add_tests', 'Add regression tests', 'edit', ['readFile', 'writeFile', 'patchFile'], ['Task planning, context, tools, API events, checkpoints covered'], baseBudget({ maxModelCalls: 1, maxToolCalls: 8, maxFilesToWrite: 4, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetEdit })),
        step('run_verification', 'Run build and tests', 'verify', ['runCommand', 'gitDiff'], ['Build and relevant tests pass'], baseBudget({ maxToolCalls: 4 })),
        step('summarize', 'Summarize architecture pass', 'summarize', [], ['Verified summary includes changes, tests, residual risk'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetFinalReport })),
      ];

    case 'repo_wide_audit':
      return [
        step('detect_commands', 'Detect project commands', 'inspect', ['detectProjectCommands'], ['Project commands and manifests detected'], baseBudget({ maxToolCalls: 1, maxFilesToRead: 0 })),
        step('context_pack', 'Build audit context pack', 'inspect', ['buildContextPack', 'glob', 'searchText'], ['Top relevant audit files identified without reading whole repo'], baseBudget({ maxToolCalls: 5, maxFilesToRead: 0 })),
        step('inspect_top_files', 'Inspect top relevant files', 'inspect', ['readFile'], ['Only top relevant files read'], baseBudget({ maxToolCalls: 8, maxFilesToRead: 8 })),
        step('report', 'Produce audit report', 'summarize', [], ['Findings and recommendations reported without edits'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.deep.outputBudgetFinalReport })),
      ];

    case 'unsafe_or_too_broad':
      return [
        step('scope_risk', 'Explain scope risk', 'intake', [], ['Risk is visible and not silently executed'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetDirect })),
        step('safe_first_phase', 'Propose safe first phase', 'plan', [], ['Safe bounded first phase proposed'], baseBudget({ maxModelCalls: 1, maxToolCalls: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport })),
      ];
  }
}

function isBroadArchitectureRequest(normalized: string): boolean {
  return /\b(architecture|orchestrator|orchestration|planner|agent loop|agentic mode|complex task|task decomposition|checkpoint)\b/.test(normalized);
}

function isUiRefactorRequest(normalized: string): boolean {
  return /\b(ui|web ui|frontend|redesign|layout|component|sidebar|right panel|run console|cockpit)\b/.test(normalized);
}

function isProjectInspectionRequest(normalized: string): boolean {
  const projectTarget = /\b(app|application|codebase|project|repo|repository|site|website|workspace)\b/.test(normalized);
  const asksToInspect = /\b(analy[sz]e|check|inspect|look at|review|scan)\b/.test(normalized);
  const asksProjectType = /\b(what kind|what type|kind of project|type of project|what is this project|what kind of app)\b/.test(normalized);
  const asksBugReview = /\b(any bugs?|bugs?|broken|issues?|problems?|working at (its )?best)\b/.test(normalized);

  return projectTarget && (asksProjectType || asksBugReview || (asksToInspect && /\b(files?|source|structure)\b/.test(normalized)));
}

export class TaskOrchestrator {
  classifyComplexity(input: ClassifyInput): TaskComplexity {
    const normalized = normalizeText(input.userRequest);
    const knownFiles = extractKnownFiles(input.userRequest, input.knownFiles);

    if (/\b(delete everything|rewrite everything|rewrite the whole project|fix everything|nuke|remove all|start over)\b/.test(normalized)) {
      return 'unsafe_or_too_broad';
    }

    if (/\b(audit|review the whole repo|repo-wide|find all bottlenecks|all bottlenecks|whole codebase)\b/.test(normalized)) {
      return 'repo_wide_audit';
    }

    if (isBroadArchitectureRequest(normalized) && /\b(add|build|fix|redesign|integrate|change|create|implement|architecture)\b/.test(normalized)) {
      return 'architecture_change';
    }

    if (isUiRefactorRequest(normalized) && /\b(refactor|redesign|split|reorganize|wire|console|components)\b/.test(normalized)) {
      return 'multi_file';
    }

    if (knownFiles.length === 1 && /\b(fix|explain|inspect|update|edit|change)\b/.test(normalized)) {
      return 'single_file';
    }

    if (knownFiles.length > 1 || /\b(multiple files|multi-file|across|wire|integrate|refactor)\b/.test(normalized)) {
      return 'multi_file';
    }

    if (WRITE_INTENTS.has(input.intent) || /\b(fix|add|patch|route|settings|drawer|missing|broken)\b/.test(normalized)) {
      return 'small_patch';
    }

    if (isProjectInspectionRequest(normalized)) {
      return 'repo_wide_audit';
    }

    if (DIRECT_INTENTS.has(input.intent) || /\b(what is|explain|which|current|active|status)\b/.test(normalized)) {
      return 'direct_answer';
    }

    return 'small_patch';
  }

  createPlan(input: PlanInput): TaskPlan {
    const complexity = this.classifyComplexity({
      userRequest: input.userRequest,
      intent: input.intent,
      knownFiles: input.knownFiles,
    });
    const files = extractKnownFiles(input.userRequest, input.knownFiles);
    const now = Date.now();
    const title = titleFromRequest(input.userRequest, `Task: ${input.intent}`);
    const summary = [
      `Intent ${input.intent}.`,
      `Complexity ${complexity}.`,
      input.repoSummary ? `Context: ${input.repoSummary}` : '',
    ].filter(Boolean).join(' ');

    return {
      id: createTaskPlanId(),
      userRequest: input.userRequest,
      title,
      summary,
      complexity,
      intent: input.intent,
      workspaceRoot: input.workspaceRoot,
      steps: planStepTemplates(complexity, files),
      createdAt: now,
      updatedAt: now,
    };
  }

  getNextStep(plan: TaskPlan): TaskStep | null {
    return plan.steps.find((entry) => entry.status === 'pending') ?? null;
  }

  markStepRunning(plan: TaskPlan, stepId: string): TaskPlan {
    return this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'running',
      startedAt: stepToUpdate.startedAt ?? Date.now(),
      endedAt: undefined,
      error: undefined,
    }));
  }

  markStepDone(plan: TaskPlan, stepId: string, detail?: string): TaskPlan {
    const updated = this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'done',
      detail: detail ?? stepToUpdate.detail,
      endedAt: Date.now(),
      error: undefined,
    }));
    return this.isComplete(updated)
      ? { ...updated, completedAt: updated.completedAt ?? Date.now(), updatedAt: Date.now() }
      : updated;
  }

  markStepFailed(plan: TaskPlan, stepId: string, error: string): TaskPlan {
    return {
      ...this.updateStep(plan, stepId, (stepToUpdate) => ({
        ...stepToUpdate,
        status: 'failed',
        error,
        endedAt: Date.now(),
      })),
      failedAt: Date.now(),
    };
  }

  markStepBlocked(plan: TaskPlan, stepId: string, reason: string): TaskPlan {
    return this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'blocked',
      error: reason,
      endedAt: Date.now(),
    }));
  }

  markStepSkipped(plan: TaskPlan, stepId: string, reason?: string): TaskPlan {
    const updated = this.updateStep(plan, stepId, (stepToUpdate) => ({
      ...stepToUpdate,
      status: 'skipped',
      detail: reason ?? stepToUpdate.detail,
      endedAt: Date.now(),
    }));
    return this.isComplete(updated)
      ? { ...updated, completedAt: updated.completedAt ?? Date.now(), updatedAt: Date.now() }
      : updated;
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
