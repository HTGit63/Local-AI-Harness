export type PolicyMode = 'read-only' | 'workspace-write' | 'danger';

export type AgentRunExecutionMode = 'direct' | 'agentic';
export type AgentWorkspaceSource = 'backend' | 'browser_snapshot';
export type AgentRunStepStatus = 'running' | 'done' | 'error' | 'skipped';
export type AgentRunStepType =
  | 'classify'
  | 'local_answer'
  | 'inventory'
  | 'tool'
  | 'model'
  | 'fallback'
  | 'approval'
  | 'summary';

export type AgentProtocol = 'native_tools' | 'action_dsl' | 'workflow_runner';
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
  protocol: AgentProtocol;
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

export interface AgentRunLineStats {
  changedFiles: number;
  addedLines: number;
  removedLines: number;
}

export type StructuredDiffLineType = 'context' | 'added' | 'removed' | 'hunk' | 'file';

export interface AgentRunStructuredDiffLine {
  type: StructuredDiffLineType;
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface AgentRunStructuredDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: AgentRunStructuredDiffLine[];
}

export interface AgentRunStructuredDiffFile {
  path: string;
  oldPath?: string;
  addedLines: number;
  removedLines: number;
  hunks: AgentRunStructuredDiffHunk[];
}

export interface AgentRunStructuredDiff {
  files: AgentRunStructuredDiffFile[];
}

export interface AgentRunSearch {
  query: string;
  pattern?: string;
}

export interface AgentRunWebSearch {
  query: string;
  engine: string;
  resultCount: number;
}

export interface AgentRunWebFetch {
  url: string;
  title?: string;
}

export interface AgentRunCommand {
  command: string;
  success: boolean;
  durationMs?: number;
}

export interface AgentRunApproval {
  id: string;
  target: string;
  approved: boolean | null;
}

export interface AgentRunMetrics {
  classificationMs?: number;
  modelLoadMs?: number;
  firstModelCallMs?: number;
  firstTokenMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensPerSecond?: number;
  toolsMs?: number;
  repoIndexingMs?: number;
  diffGenerationMs?: number;
  testMs?: number;
  totalMs?: number;
  modelLoops?: number;
  fallbackCount?: number;
  contextBudgetUsed?: number;
  contextBudgetLimit?: number;
}

export interface AgentRunStep {
  id: string;
  type: AgentRunStepType;
  title: string;
  detail?: string;
  startedAt: number;
  endedAt?: number;
  status: AgentRunStepStatus;
  toolName?: string;
  toolInputSummary?: string;
  toolOutputPreview?: string;
  filePaths?: string[];
  command?: string;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  executionMode: AgentRunExecutionMode;
  workspaceRoot: string;
  workspaceSource: AgentWorkspaceSource;
  model: string;
  agentModel?: string;
  summaryModel?: string;
  activeModel?: string | null;
  agentProtocol?: AgentProtocol;
  promptMode: string;
  intent: string;
  browserContextActive: boolean;
  workspaceBound: boolean;
  usedNativeTools: boolean;
  usedManualFallback: boolean;
  fallbackReason?: string;
  steps: AgentRunStep[];
  filesRead: string[];
  directoriesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  directoriesCreated: string[];
  searches: AgentRunSearch[];
  webSearches: AgentRunWebSearch[];
  webFetches: AgentRunWebFetch[];
  commands: AgentRunCommand[];
  approvals: AgentRunApproval[];
  git?: AgentRunLineStats;
  structuredDiff?: AgentRunStructuredDiff;
  fileChanges?: AgentRunStructuredDiffFile[];
  selectedTests?: string[];
  checkpointIds?: string[];
  modelRoute?: {
    role: WorkflowModelRole;
    model: string;
    protocol?: AgentProtocol;
    keepAlive?: string | number;
    reason?: string;
  };
  heavyModelLock?: {
    held: boolean;
    ownerRunId: string | null;
    queued: number;
  };
  lastRouteSelection?: {
    role: WorkflowModelRole;
    model: string;
    protocol?: AgentProtocol;
    keepAlive?: string | number;
    reason?: string;
  };
  parseFailureCount?: number;
  routingNotes?: string[];
  memoryNotes?: string[];
  metrics?: AgentRunMetrics;
  workflow?: WorkflowState;
  finalAnswer?: string;
  summary?: string;
  error?: string;
}

export interface SessionTurnMetadata {
  timestamp: number;
  executionMode: AgentRunExecutionMode;
  promptMode?: string;
  messageCount: number;
  thinkingEnabled?: boolean;
  imageCount?: number;
  intent?: string;
  summary?: string;
  firstTokenMs?: number;
  totalDurationMs?: number;
  runSummary?: AgentRun;
}

export interface SessionMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  mode: PolicyMode;
  cwd: string;
  skillsActive: string[];
  toolsAllowlist: string[];
  turnHistory?: SessionTurnMetadata[];
}

export interface SessionStorageEngine {
  saveSession(session: SessionMetadata): Promise<void>;
  loadSession(id: string): Promise<SessionMetadata | null>;
  deleteSession(id: string): Promise<boolean>;
  listSessions(): Promise<SessionMetadata[]>;
  appendTurn(id: string, turn: SessionTurnMetadata): Promise<void>;
}
