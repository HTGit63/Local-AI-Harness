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

export interface StepProgress {
  total: number;
  completed: number;
  failed: number;
  blocked: number;
}

export interface RunApprovalItem {
  id: string;
  target: string;
  changeType: string;
  severity: string;
  diffPreview?: string;
  warningMessage?: string;
  approved?: boolean | null;
}

export interface RunTraceEntry {
  id?: string;
  type: string;
  data: unknown;
  timestamp: number;
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

export interface RunCheckpoint {
  runId: string;
  sessionId: string;
  taskPlan: TaskPlan;
  currentStepId?: string;
  completedSteps: string[];
  failedSteps: string[];
  blockedSteps: string[];
  filesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  commandsRun: string[];
  approvals: Array<{
    id: string;
    target: string;
    approved: boolean | null;
  }>;
  summarySoFar: string;
  lastToolResults: Array<{
    tool: string;
    success: boolean;
    outputPreview: string;
  }>;
  createdAt: number;
  updatedAt: number;
}
