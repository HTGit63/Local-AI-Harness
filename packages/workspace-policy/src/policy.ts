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

  private isProtectedPath(targetPath: string): boolean {
    const basename = path.basename(targetPath);
    return (
      basename === '.env' ||
      basename === 'id_rsa' ||
      basename === 'id_ed25519' ||
      basename.startsWith('.env.') ||
      /^secrets(?:\.|$)/i.test(basename) ||
      /^credentials(?:\.|$)/i.test(basename) ||
      /\.(pem|key|p12|pfx)$/i.test(basename)
    );
  }

  checkAction(action: ActionType, targetPath?: string): PolicyCheckResult {
    if (targetPath && !this.isPathWithinWorkspace(targetPath)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Action outside workspace root is denied, including in danger mode.',
      };
    }

    if (targetPath && this.isProtectedPath(targetPath)) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: 'Protected credential or secret-like path is denied by default.',
      };
    }

    if (this.mode === 'danger' || this.mode === 'danger-sandbox') {
      return { allowed: true, requiresApproval: false };
    }

    if (action === 'read') {
      return { allowed: true, requiresApproval: false };
    }

    if (this.mode === 'read-only' || this.mode === 'chat' || this.mode === 'inspect' || this.mode === 'plan') {
      return { allowed: false, requiresApproval: false, reason: 'Workspace is in read-only mode.' };
    }

    if (this.mode === 'trusted-edit') {
      if (action === 'write') {
        return { allowed: true, requiresApproval: false };
      }
      if (action === 'delete') {
        return { allowed: true, requiresApproval: true, reason: 'Delete actions require approval.' };
      }
      if (action === 'execute') {
        return { allowed: true, requiresApproval: true, reason: 'Command execution requires approval unless allowlisted by caller.' };
      }
    }

    if (this.mode === 'workspace-write' || this.mode === 'full-agent') {
      if (action === 'write' || action === 'delete' || action === 'execute') {
        if (action === 'delete') {
          return { allowed: true, requiresApproval: true, reason: 'Delete actions require approval.' };
        }
        if (action === 'execute') {
          return { allowed: true, requiresApproval: true, reason: 'Execute actions potentially mutate state and require approval.' };
        }
        return { allowed: true, requiresApproval: true, reason: 'Write updates require preview and approval.' };
      }
    }

    return { allowed: false, requiresApproval: false, reason: 'Unknown action type.' };
  }
}
