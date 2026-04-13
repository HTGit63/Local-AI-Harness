export interface ToolResult {
    success: boolean;
    output: string;
    preview?: string;
    error?: string;
}
export type ApprovalDecision = Promise<boolean> & {
    updatePreview?: (preview: string) => void;
};
export interface ToolApprovalRequest {
    action: string;
    target: string;
    preview: string;
    metadata?: Record<string, string>;
}
export interface ToolActionContext {
    cwd: string;
    emitTrace: (type: string, data: unknown) => void;
    checkPolicy: (action: 'read' | 'write' | 'delete' | 'execute', target?: string) => {
        allowed: boolean;
        requiresApproval: boolean;
        reason?: string;
    };
    requestApproval: (request: ToolApprovalRequest) => ApprovalDecision;
}
