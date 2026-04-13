import { SessionMetadata, SessionStorageEngine } from './types';
export declare class FileSessionStore implements SessionStorageEngine {
    private dataDir;
    constructor(dataDir: string);
    private ensureDir;
    saveSession(session: SessionMetadata): Promise<void>;
    loadSession(id: string): Promise<SessionMetadata | null>;
    deleteSession(id: string): Promise<boolean>;
    listSessions(): Promise<SessionMetadata[]>;
}
