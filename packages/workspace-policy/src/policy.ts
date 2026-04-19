import * as path from 'path';
import { WorkspacePolicyConfig, ActionType, PolicyMode, PolicyCheckResult } from './types';

export class WorkspacePolicy {
  private workspaceRoot: string;
  public mode: PolicyMode;

  constructor(config: WorkspacePolicyConfig) {
    this.workspaceRoot = path.resolve(config.workspaceRoot);
    this.mode = config.mode;
  }

  updateConfig(config: WorkspacePolicyConfig) {
    this.workspaceRoot = path.resolve(config.workspaceRoot);
    this.mode = config.mode;
  }

  isPathWithinWorkspace(targetPath: string): boolean {
    const root = path.resolve(this.workspaceRoot);
    const resolvedPath = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(root, targetPath);
    const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return resolvedPath === root || resolvedPath.startsWith(rootPrefix);
  }

  checkAction(action: ActionType, targetPath?: string): PolicyCheckResult {
    if (targetPath && !this.isPathWithinWorkspace(targetPath)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Action outside workspace root is denied, including in danger mode.',
      };
    }

    if (this.mode === 'danger') {
      return { allowed: true, requiresApproval: false };
    }

    if (action === 'read') {
      return { allowed: true, requiresApproval: false };
    }

    if (this.mode === 'read-only') {
      return { allowed: false, requiresApproval: false, reason: 'Workspace is in read-only mode.' };
    }

    // In workspace-write mode
    if (action === 'write' || action === 'delete' || action === 'execute') {
      // Deletions always require approval
      if (action === 'delete') {
        return { allowed: true, requiresApproval: true, reason: 'Delete actions require approval.' };
      }
      
      // Broad execution requires approval
      if (action === 'execute') {
        return { allowed: true, requiresApproval: true, reason: 'Execute actions potentially mutate state and require approval.' };
      }

      // Direct write requires preview & approval
      return { allowed: true, requiresApproval: true, reason: 'Write updates require preview and approval.' };
    }

    return { allowed: false, requiresApproval: false, reason: 'Unknown action type.' };
  }
}
