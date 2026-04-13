export type ActionSeverity = 'info' | 'warning' | 'danger';
export type ChangeType = 'modify_file' | 'create_file' | 'delete_file' | 'run_command' | 'outside_workspace_denial';
export interface ApprovalRequestPayload {
    id: string;
    target: string;
    changeType: ChangeType;
    severity: ActionSeverity;
    diffPreview?: string;
    warningMessage?: string;
    metadata?: Record<string, string>;
}
export interface ReviewResponse {
    approved: boolean;
    editInstruction?: string;
}
