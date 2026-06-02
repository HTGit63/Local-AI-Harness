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
export interface SessionMetadata {
    id: string;
    createdAt: number;
    updatedAt: number;
    model: string;
    mode: PolicyMode;
    cwd: string;
    skillsActive: string[];
    toolsAllowlist: string[];
}
export interface SessionStorageEngine {
    saveSession(session: SessionMetadata): Promise<void>;
    loadSession(id: string): Promise<SessionMetadata | null>;
    deleteSession(id: string): Promise<boolean>;
    listSessions(): Promise<SessionMetadata[]>;
}
