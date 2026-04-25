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

export interface AgentRunLineStats {
  changedFiles: number;
  addedLines: number;
  removedLines: number;
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
  firstModelCallMs?: number;
  firstTokenMs?: number;
  toolsMs?: number;
  totalMs?: number;
  modelLoops?: number;
  fallbackCount?: number;
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
  metrics?: AgentRunMetrics;
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
