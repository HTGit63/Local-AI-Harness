export type PolicyMode = 'read-only' | 'workspace-write' | 'danger';

export interface WorkspacePolicyConfig {
  workspaceRoot: string;
  mode: PolicyMode;
}

export type ActionType = 'read' | 'write' | 'delete' | 'execute';

export interface PolicyCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}
