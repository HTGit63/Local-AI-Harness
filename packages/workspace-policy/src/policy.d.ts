import { WorkspacePolicyConfig, ActionType, PolicyMode, PolicyCheckResult } from './types';
export declare class WorkspacePolicy {
    private workspaceRoot;
    mode: PolicyMode;
    constructor(config: WorkspacePolicyConfig);
    updateConfig(config: WorkspacePolicyConfig): void;
    isPathWithinWorkspace(targetPath: string): boolean;
    checkAction(action: ActionType, targetPath?: string): PolicyCheckResult;
}
