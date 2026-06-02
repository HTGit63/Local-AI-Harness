export type PolicyMode =
    | 'chat'
    | 'inspect'
    | 'plan'
    | 'trusted-edit'
    | 'full-agent'
    | 'danger-sandbox'
    | 'read-only'
    | 'workspace-write'
    | 'danger';
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
