export type AgentProtocol = 'native_tools' | 'action_dsl' | 'workflow_runner';

export type ModelRole = 'fast' | 'agent' | 'coding' | 'review' | 'summary';

export interface ModelRouterConfig {
  fastModel: string;
  agentModel: string;
  codingModel: string;
  reviewModel: string;
  summaryModel: string;
  agentProtocol: AgentProtocol;
  agentKeepAlive: string | number;
}

export interface ModelRouteRequest {
  role: ModelRole;
  runId?: string;
  purpose?: string;
  protocol?: AgentProtocol;
  keepAlive?: string | number;
}

export interface ModelRouteSelection {
  role: ModelRole;
  model: string;
  protocol?: AgentProtocol;
  keepAlive?: string | number;
  reason?: string;
}

export interface HeavyModelLockState {
  held: boolean;
  ownerRunId: string | null;
  queued: number;
}

export type ModelRouterTraceEmitter = (type: string, data: unknown) => void;
