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
export type TaskPlanStatus = 'pending' | 'running' | 'blocked' | 'safe_idle' | 'done' | 'failed';

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
  mode: 'chat' | 'agent';
  intent: TaskIntent;
  goal: string;
  status: TaskPlanStatus;
  userRequest: string;
  title: string;
  summary: string;
  workspaceRoot: string;
  sizeEstimate: TaskSizeEstimate;
  steps: TaskStep[];
  currentStepId?: string;
  evidence: string[];
  nextAction?: string;
  stopCondition: string;
  createdAt: number;
  updatedAt: number;
  revisedAt?: number;
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

export type StructuredDiffLineType = 'context' | 'added' | 'removed' | 'hunk' | 'file';

export interface StructuredDiffLine {
  type: StructuredDiffLineType;
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface StructuredDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: StructuredDiffLine[];
}

export interface StructuredDiffFile {
  path: string;
  oldPath?: string;
  addedLines: number;
  removedLines: number;
  hunks: StructuredDiffHunk[];
}

export interface StructuredDiff {
  files: StructuredDiffFile[];
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
