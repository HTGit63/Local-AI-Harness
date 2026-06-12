import * as path from 'path';
import {
  LOCAL_MODEL_BUDGET_PROFILES,
  TOOL_PROFILES,
  TaskBudget,
  TaskIntent,
  TaskPlan,
  TaskPlanMode,
  TaskPlanStatus,
  TaskSizeEstimate,
  TaskStep,
  TaskStepStatus,
  TaskStepType,
} from './index';

export type AdaptiveGoalStatus = TaskStepStatus;
export type AdaptiveGoalType = TaskStepType;
export type AdaptivePlanStatus = TaskPlanStatus;
export type AdaptivePlanComplexity = TaskSizeEstimate | 'single_file' | 'multi_file' | 'repo_wide';

export interface AdaptivePlanBudget {
  maxModelCalls: number;
  maxToolCalls: number;
  maxFilesToRead: number;
  maxFilesToWrite: number;
  maxOutputTokens?: number;
}

export interface AdaptiveGoal {
  id: string;
  title: string;
  type: AdaptiveGoalType;
  status: AdaptiveGoalStatus;
  tools: string[];
  files: string[];
  success_check: string;
  budget: AdaptivePlanBudget;
  risk?: 'low' | 'medium' | 'high';
  requiresApproval?: boolean;
  retryCount?: number;
}

export interface AdaptivePlan {
  id: string;
  task: string;
  title?: string;
  summary: string;
  complexity: AdaptivePlanComplexity;
  mode: 'agent';
  status: AdaptivePlanStatus;
  workspaceRoot: string;
  createdAt: number;
  updatedAt: number;
  goals: AdaptiveGoal[];
  planner?: 'ai' | 'fallback' | 'template';
  validationErrors?: string[];
}

export interface AdaptivePlanValidationOptions {
  workspaceRoot: string;
  allowedTools?: string[];
  maxGoalsPerPlan?: number;
  maxWriteGoalsPerPlan?: number;
  requireFinalSummary?: boolean;
}

export interface AdaptivePlanValidationResult {
  valid: boolean;
  plan?: AdaptivePlan;
  errors: string[];
}

export interface AdaptivePlanArtifactPaths {
  json: string;
  markdown: string;
}

const DEFAULT_MAX_GOALS = 12;
const DEFAULT_MAX_WRITE_GOALS = 4;
const VALID_GOAL_TYPES = new Set<AdaptiveGoalType>(['intake', 'inspect', 'plan', 'edit', 'verify', 'summarize', 'approval']);
const VALID_GOAL_STATUSES = new Set<AdaptiveGoalStatus>(['pending', 'running', 'done', 'failed', 'skipped', 'blocked', 'safe_idle']);
const VALID_PLAN_STATUSES = new Set<AdaptivePlanStatus>(['pending', 'running', 'blocked', 'safe_idle', 'done', 'failed']);
const WRITE_TOOLS = new Set(['writeFile', 'patchFile', 'replaceFunction', 'insertImport', 'addTypeProperty', 'renameIdentifier', 'replaceRange', 'insertAfter', 'insertBefore', 'replaceBlock', 'applyUnifiedPatch', 'makeDir', 'deleteFile', 'createCheckpoint', 'rollbackToCheckpoint']);
const COMMAND_TOOLS = new Set(['runCommand']);
const KNOWN_TOOLS = new Set(Object.values(TOOL_PROFILES).flat());
const VAGUE_TITLE = /^(improve|fix|update|change|refactor|work on|handle|do it|make better)(?:\s+(ui|code|app|project|things|stuff))?$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function budgetFrom(value: unknown, fallback: AdaptivePlanBudget): AdaptivePlanBudget {
  const record = isRecord(value) ? value : {};
  return {
    maxModelCalls: Math.max(0, Math.floor(asNumber(record.maxModelCalls, fallback.maxModelCalls))),
    maxToolCalls: Math.max(0, Math.floor(asNumber(record.maxToolCalls, fallback.maxToolCalls))),
    maxFilesToRead: Math.max(0, Math.floor(asNumber(record.maxFilesToRead, fallback.maxFilesToRead))),
    maxFilesToWrite: Math.max(0, Math.floor(asNumber(record.maxFilesToWrite, fallback.maxFilesToWrite))),
    maxOutputTokens: Math.max(256, Math.floor(asNumber(record.maxOutputTokens, fallback.maxOutputTokens ?? LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetInspect))),
  };
}

function normalizeGoal(raw: unknown, index: number): AdaptiveGoal | null {
  if (!isRecord(raw)) return null;
  const fallbackBudget: AdaptivePlanBudget = {
    maxModelCalls: raw.type === 'summarize' ? 1 : 0,
    maxToolCalls: 2,
    maxFilesToRead: raw.type === 'inspect' ? 3 : 0,
    maxFilesToWrite: raw.type === 'edit' ? 1 : 0,
    maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetInspect,
  };
  const type = asString(raw.type, 'inspect') as AdaptiveGoalType;
  const status = asString(raw.status, 'pending') as AdaptiveGoalStatus;
  return {
    id: asString(raw.id, `G${index + 1}`),
    title: asString(raw.title, `Goal ${index + 1}`),
    type,
    status,
    tools: asStringList(raw.tools ?? raw.toolsAllowed),
    files: asStringList(raw.files),
    success_check: asString(raw.success_check ?? raw.successCheck ?? raw.successCriteria, ''),
    budget: budgetFrom(raw.budget, fallbackBudget),
    risk: ['low', 'medium', 'high'].includes(asString(raw.risk)) ? asString(raw.risk) as AdaptiveGoal['risk'] : undefined,
    requiresApproval: typeof raw.requiresApproval === 'boolean' ? raw.requiresApproval : undefined,
    retryCount: Math.max(0, Math.floor(asNumber(raw.retryCount, 0))),
  };
}

function normalizeAdaptivePlan(raw: unknown, options: AdaptivePlanValidationOptions): AdaptivePlan | null {
  if (!isRecord(raw)) return null;
  const now = Date.now();
  const goals = Array.isArray(raw.goals)
    ? raw.goals.map(normalizeGoal).filter((entry): entry is AdaptiveGoal => entry !== null)
    : [];
  return {
    id: asString(raw.id, `plan_${now}`),
    task: asString(raw.task ?? raw.title, 'Untitled task'),
    title: asString(raw.title, '') || undefined,
    summary: asString(raw.summary, 'Adaptive plan'),
    complexity: asString(raw.complexity, 'small') as AdaptivePlanComplexity,
    mode: 'agent',
    status: asString(raw.status, 'pending') as AdaptivePlanStatus,
    workspaceRoot: asString(raw.workspaceRoot, options.workspaceRoot),
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
    goals,
    planner: ['ai', 'fallback', 'template'].includes(asString(raw.planner)) ? asString(raw.planner) as AdaptivePlan['planner'] : 'ai',
  };
}

function pathInsideWorkspace(filePath: string, workspaceRoot: string): boolean {
  if (!filePath || filePath.includes('\0')) return false;
  const root = path.resolve(workspaceRoot);
  const resolved = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(root, filePath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

function isFinalSummaryGoal(goal: AdaptiveGoal): boolean {
  return goal.type === 'summarize' || /\b(summary|summarize|report|final)\b/i.test(goal.title);
}

function goalHasWriteTool(goal: AdaptiveGoal): boolean {
  return goal.tools.some((tool) => WRITE_TOOLS.has(tool));
}

function goalHasCommandTool(goal: AdaptiveGoal): boolean {
  return goal.tools.some((tool) => COMMAND_TOOLS.has(tool));
}

function goalHasVerificationSignal(goal: AdaptiveGoal): boolean {
  return goal.type === 'verify' || /\b(verify|test|build|lint|typecheck|diff|check)\b/i.test(`${goal.title} ${goal.success_check}`);
}

export function validateAdaptivePlan(raw: unknown, options: AdaptivePlanValidationOptions): AdaptivePlanValidationResult {
  const plan = normalizeAdaptivePlan(raw, options);
  const errors: string[] = [];
  const allowedTools = new Set(options.allowedTools ?? Array.from(KNOWN_TOOLS));
  const maxGoals = options.maxGoalsPerPlan ?? DEFAULT_MAX_GOALS;
  const maxWriteGoals = options.maxWriteGoalsPerPlan ?? DEFAULT_MAX_WRITE_GOALS;

  if (!plan) {
    return { valid: false, errors: ['Plan must be a JSON object.'] };
  }
  if (!plan.id) errors.push('Plan id is required.');
  if (!plan.task) errors.push('Plan task is required.');
  if (!plan.summary) errors.push('Plan summary is required.');
  if (!VALID_PLAN_STATUSES.has(plan.status)) errors.push(`Invalid plan status: ${plan.status}.`);
  if (plan.mode !== 'agent') errors.push('Adaptive plan mode must be agent.');
  if (path.resolve(plan.workspaceRoot) !== path.resolve(options.workspaceRoot)) errors.push('Plan workspaceRoot must match active workspace.');
  if (plan.goals.length === 0) errors.push('Plan must include goals.');
  if (plan.goals.length > maxGoals) errors.push(`Plan has too many goals: ${plan.goals.length}/${maxGoals}.`);

  const ids = new Set<string>();
  let writeGoalCount = 0;
  let hasEditGoal = false;
  let hasVerification = false;

  for (const goal of plan.goals) {
    if (!goal.id) errors.push('Goal id is required.');
    if (ids.has(goal.id)) errors.push(`Duplicate goal id: ${goal.id}.`);
    ids.add(goal.id);
    if (!goal.title || goal.title.length < 6 || VAGUE_TITLE.test(goal.title)) {
      errors.push(`Goal ${goal.id} has vague title.`);
    }
    if (!VALID_GOAL_TYPES.has(goal.type)) errors.push(`Goal ${goal.id} has invalid type: ${goal.type}.`);
    if (!VALID_GOAL_STATUSES.has(goal.status)) errors.push(`Goal ${goal.id} has invalid status: ${goal.status}.`);
    if (!goal.success_check || goal.success_check.length < 8) errors.push(`Goal ${goal.id} needs non-empty success_check.`);
    if (goal.budget.maxToolCalls > 0 && goal.tools.length === 0 && goal.type !== 'plan' && goal.type !== 'summarize') {
      errors.push(`Goal ${goal.id} has tool budget but no tools.`);
    }
    if (goal.budget.maxToolCalls > 12) errors.push(`Goal ${goal.id} exceeds max tool-call budget.`);
    if (goal.budget.maxFilesToWrite > 2) errors.push(`Goal ${goal.id} writes too many files.`);

    for (const tool of goal.tools) {
      if (!KNOWN_TOOLS.has(tool)) errors.push(`Goal ${goal.id} uses unknown tool: ${tool}.`);
      if (!allowedTools.has(tool)) errors.push(`Goal ${goal.id} uses disallowed tool: ${tool}.`);
    }

    if (goal.type === 'inspect' && (goalHasWriteTool(goal) || goalHasCommandTool(goal))) {
      errors.push(`Goal ${goal.id} is inspect-only but includes write/command tools.`);
    }
    if (goal.type === 'plan' && goalHasWriteTool(goal)) {
      errors.push(`Goal ${goal.id} is planning but includes write tools.`);
    }
    if (goalHasCommandTool(goal) && !['verify', 'approval'].includes(goal.type)) {
      errors.push(`Goal ${goal.id} uses runCommand outside verify/approval.`);
    }
    if (goalHasWriteTool(goal) && goal.type !== 'edit' && goal.type !== 'approval') {
      errors.push(`Goal ${goal.id} uses write tools outside edit/approval.`);
    }

    for (const file of goal.files) {
      if (!pathInsideWorkspace(file, options.workspaceRoot)) {
        errors.push(`Goal ${goal.id} has file outside workspace: ${file}.`);
      }
    }

    if (goal.type === 'edit' || goalHasWriteTool(goal)) {
      hasEditGoal = true;
      writeGoalCount += 1;
      if (goal.files.length === 0 && !/\b(find|select|target|identify)\b/i.test(goal.success_check)) {
        errors.push(`Goal ${goal.id} edits without files or file-selection success check.`);
      }
    }
    if (goalHasVerificationSignal(goal)) {
      hasVerification = true;
    }
  }

  if (writeGoalCount > maxWriteGoals) errors.push(`Plan has too many write goals: ${writeGoalCount}/${maxWriteGoals}.`);
  if (hasEditGoal && !hasVerification) errors.push('Edit plan must include verification goal.');
  if ((options.requireFinalSummary ?? true) && !plan.goals.some(isFinalSummaryGoal)) {
    errors.push('Plan must include final summary/report goal.');
  }

  return {
    valid: errors.length === 0,
    plan: errors.length === 0 ? plan : { ...plan, validationErrors: errors },
    errors,
  };
}

export function parseAdaptivePlanJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Adaptive plan response was empty.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    if (fenced) return JSON.parse(fenced);
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Adaptive plan response was not valid JSON.');
  }
}

function mapComplexity(complexity: AdaptivePlanComplexity): TaskSizeEstimate {
  switch (complexity) {
    case 'repo_wide':
      return 'large';
    case 'multi_file':
      return 'medium';
    case 'single_file':
      return 'small';
    default:
      return complexity;
  }
}

function taskBudgetFrom(goal: AdaptiveGoal): TaskBudget {
  return {
    maxModelCalls: goal.budget.maxModelCalls,
    maxToolCalls: goal.budget.maxToolCalls,
    maxFilesToRead: goal.budget.maxFilesToRead,
    maxFilesToWrite: goal.budget.maxFilesToWrite,
    maxOutputTokens: goal.budget.maxOutputTokens ?? LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetInspect,
  };
}

export function normalizeAdaptivePlanToTaskPlan(params: {
  adaptivePlan: AdaptivePlan;
  intent: TaskIntent;
  userRequest: string;
  mode?: TaskPlanMode;
  artifactPaths?: AdaptivePlanArtifactPaths;
}): TaskPlan {
  const { adaptivePlan, intent, userRequest, artifactPaths } = params;
  const steps: TaskStep[] = adaptivePlan.goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    type: goal.type,
    status: goal.status,
    files: goal.files,
    toolsAllowed: goal.tools,
    successCriteria: [goal.success_check],
    budget: taskBudgetFrom(goal),
    detail: goal.requiresApproval ? 'Approval may be required by current policy.' : undefined,
  }));
  return {
    id: adaptivePlan.id,
    mode: params.mode ?? 'agent',
    intent,
    goal: adaptivePlan.task,
    userRequest,
    title: adaptivePlan.title ?? adaptivePlan.task,
    summary: adaptivePlan.summary,
    status: adaptivePlan.status,
    workspaceRoot: adaptivePlan.workspaceRoot,
    sizeEstimate: mapComplexity(adaptivePlan.complexity),
    steps,
    currentStepId: steps.find((entry) => entry.status === 'running')?.id,
    evidence: [],
    nextAction: steps.find((entry) => entry.status === 'pending')?.title ?? 'Summarize result',
    stopCondition: 'Execute validated adaptive goals one at a time; stop on invalid tool, budget, approval denial, or failed verification.',
    createdAt: adaptivePlan.createdAt,
    updatedAt: adaptivePlan.updatedAt,
    adaptivePlan,
    planArtifactPaths: artifactPaths,
  };
}

export function renderAdaptivePlanMarkdown(plan: AdaptivePlan): string {
  const lines = [
    `# ${plan.title ?? plan.task}`,
    '',
    plan.summary,
    '',
    `- Status: ${plan.status}`,
    `- Complexity: ${plan.complexity}`,
    `- Workspace: ${plan.workspaceRoot}`,
    '',
    '## Goals',
    '',
  ];
  for (const goal of plan.goals) {
    lines.push(
      `### ${goal.id}: ${goal.title}`,
      '',
      `- Type: ${goal.type}`,
      `- Status: ${goal.status}`,
      `- Tools: ${goal.tools.length ? goal.tools.join(', ') : 'none'}`,
      `- Files: ${goal.files.length ? goal.files.join(', ') : 'none selected yet'}`,
      `- Success check: ${goal.success_check}`,
      `- Budget: tools ${goal.budget.maxToolCalls}, read ${goal.budget.maxFilesToRead}, write ${goal.budget.maxFilesToWrite}, model ${goal.budget.maxModelCalls}`,
      '',
    );
  }
  return `${lines.join('\n').trim()}\n`;
}

export function createSafeFallbackAdaptivePlan(params: {
  task: string;
  intent: TaskIntent;
  workspaceRoot: string;
  reason: string;
  allowedTools: string[];
}): AdaptivePlan {
  const now = Date.now();
  const inspectTools = params.allowedTools.filter((tool) => ['listDir', 'glob', 'searchText', 'readFile', 'gitStatus', 'gitDiff'].includes(tool)).slice(0, 3);
  return {
    id: `plan_${now}_fallback`,
    task: params.task,
    title: 'Safe fallback plan',
    summary: `Adaptive planning failed: ${params.reason}. Use bounded inspection, produce a concrete plan, then stop before edits.`,
    complexity: params.intent === 'full_audit' ? 'repo_wide' : 'small',
    mode: 'agent',
    status: 'pending',
    workspaceRoot: params.workspaceRoot,
    createdAt: now,
    updatedAt: now,
    planner: 'fallback',
    goals: [
      {
        id: 'G1',
        title: 'Inspect minimal relevant workspace evidence',
        type: 'inspect',
        status: 'pending',
        tools: inspectTools.length ? inspectTools : ['listDir'],
        files: [],
        success_check: 'Relevant folders, likely files, or missing evidence are identified without edits.',
        budget: { maxModelCalls: 0, maxToolCalls: 4, maxFilesToRead: 3, maxFilesToWrite: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetInspect },
      },
      {
        id: 'G2',
        title: 'Create bounded implementation plan',
        type: 'plan',
        status: 'pending',
        tools: [],
        files: [],
        success_check: 'Concrete next edit or verification steps are stated for user approval.',
        budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.balanced.outputBudgetComplexPlan },
      },
      {
        id: 'G3',
        title: 'Report fallback planning result',
        type: 'summarize',
        status: 'pending',
        tools: [],
        files: [],
        success_check: 'User sees why adaptive planning fell back and what can safely happen next.',
        budget: { maxModelCalls: 1, maxToolCalls: 0, maxFilesToRead: 0, maxFilesToWrite: 0, maxOutputTokens: LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetFinalReport },
      },
    ],
  };
}

export function createFallbackAdaptivePlanFromTaskPlan(params: {
  taskPlan: TaskPlan;
  reason: string;
  allowedTools: string[];
}): AdaptivePlan {
  const now = Date.now();
  const allowed = new Set(params.allowedTools);
  return {
    id: `plan_${params.taskPlan.id}_fallback`,
    task: params.taskPlan.goal,
    title: params.taskPlan.title,
    summary: `Fallback adaptive plan after planner failure: ${params.reason}. Goals are bounded and harness-validated.`,
    complexity: params.taskPlan.sizeEstimate,
    mode: 'agent',
    status: 'pending',
    workspaceRoot: params.taskPlan.workspaceRoot,
    createdAt: now,
    updatedAt: now,
    planner: 'fallback',
    goals: params.taskPlan.steps.map((stepEntry, index) => ({
      id: /^G\d+$/i.test(stepEntry.id) ? stepEntry.id : `G${index + 1}`,
      title: stepEntry.title,
      type: stepEntry.type,
      status: 'pending',
      tools: stepEntry.toolsAllowed.filter((tool) => allowed.has(tool)),
      files: stepEntry.files ?? [],
      success_check: stepEntry.successCriteria[0] ?? stepEntry.title,
      budget: {
        maxModelCalls: stepEntry.budget.maxModelCalls,
        maxToolCalls: stepEntry.budget.maxToolCalls,
        maxFilesToRead: stepEntry.budget.maxFilesToRead,
        maxFilesToWrite: stepEntry.budget.maxFilesToWrite,
        maxOutputTokens: stepEntry.budget.maxOutputTokens,
      },
    })),
  };
}

export function prepareTaskPlanForResume(plan: TaskPlan): TaskPlan {
  const steps = plan.steps.map((stepEntry) => stepEntry.status === 'running'
    ? { ...stepEntry, status: 'pending' as TaskStepStatus, startedAt: undefined, endedAt: undefined }
    : stepEntry);
  const nextStep = steps.find((entry) => entry.status === 'pending') ?? steps.find((entry) => entry.status === 'failed');
  return {
    ...plan,
    status: nextStep ? 'running' : plan.status,
    steps,
    currentStepId: undefined,
    nextAction: nextStep?.title ?? plan.nextAction,
    updatedAt: Date.now(),
  };
}

export function syncAdaptivePlanFromTaskPlan(plan: TaskPlan): AdaptivePlan | undefined {
  if (!plan.adaptivePlan) {
    return undefined;
  }
  const stepsById = new Map(plan.steps.map((stepEntry) => [stepEntry.id, stepEntry]));
  return {
    ...plan.adaptivePlan,
    status: plan.status,
    updatedAt: plan.updatedAt,
    goals: plan.adaptivePlan.goals.map((goal) => {
      const stepEntry = stepsById.get(goal.id);
      if (!stepEntry) return goal;
      return {
        ...goal,
        title: stepEntry.title,
        type: stepEntry.type,
        status: stepEntry.status,
        tools: stepEntry.toolsAllowed,
        files: stepEntry.files ?? [],
        success_check: stepEntry.successCriteria[0] ?? goal.success_check,
        budget: {
          maxModelCalls: stepEntry.budget.maxModelCalls,
          maxToolCalls: stepEntry.budget.maxToolCalls,
          maxFilesToRead: stepEntry.budget.maxFilesToRead,
          maxFilesToWrite: stepEntry.budget.maxFilesToWrite,
          maxOutputTokens: stepEntry.budget.maxOutputTokens,
        },
      };
    }),
  };
}
