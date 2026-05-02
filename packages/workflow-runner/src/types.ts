export type WorkflowProtocol = 'native_tools' | 'action_dsl' | 'workflow_runner';
export type WorkflowLifecycleStatus =
  | 'created'
  | 'started'
  | 'step_running'
  | 'waiting_for_model_action'
  | 'waiting_for_tool'
  | 'waiting_for_approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';
export type WorkflowStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked' | 'skipped';
export type WorkflowModelRole = 'fast' | 'agent' | 'coding' | 'review' | 'summary';

export interface WorkflowStep {
  id: string;
  type: string;
  title: string;
  status: WorkflowStepStatus;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
  toolName?: string;
  action?: string;
  inputSummary?: string;
  outputPreview?: string;
}

export interface WorkflowState {
  workflowId: string;
  workflowType: string;
  runId: string;
  sessionId: string;
  workspaceRoot: string;
  modelRole: WorkflowModelRole;
  protocol: WorkflowProtocol;
  status: WorkflowLifecycleStatus;
  currentStepId?: string | null;
  steps: WorkflowStep[];
  filesRead: string[];
  filesChanged: string[];
  approvals: string[];
  commands: string[];
  errors: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowRunnerOptions {
  workflowId: string;
  workflowType: string;
  runId: string;
  sessionId: string;
  workspaceRoot: string;
  modelRole: WorkflowModelRole;
  protocol: WorkflowProtocol;
  emitTrace?: (type: string, data: unknown) => void;
  initialState?: WorkflowState;
}

export interface WorkflowStepInput {
  id: string;
  type: string;
  title: string;
  detail?: string;
  action?: string;
  toolName?: string;
  inputSummary?: string;
}

export interface WorkflowSnapshot {
  workflowId: string;
  workflowType: string;
  runId: string;
  sessionId: string;
  workspaceRoot: string;
  modelRole: WorkflowModelRole;
  protocol: WorkflowProtocol;
  status: WorkflowLifecycleStatus;
  currentStepId?: string | null;
  steps: WorkflowStep[];
  filesRead: string[];
  filesChanged: string[];
  approvals: string[];
  commands: string[];
  errors: string[];
  createdAt: number;
  updatedAt: number;
}
