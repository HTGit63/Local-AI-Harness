import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionMetadata, SessionStorageEngine, SessionTurnMetadata } from './types';

const SESSION_FILE_SUFFIX = '.json';
const SESSION_TURNS_SUFFIX = '-turns.jsonl';
const SESSION_INDEX_FILE = '.session-index.json';
const SESSION_INDEX_VERSION = 2;

interface SessionIndexEntry {
  /** Shallow metadata — turnHistory is NOT stored in the index. */
  session: Omit<SessionMetadata, 'turnHistory'> & { turnHistory?: undefined };
  fileMtimeMs: number;
}

interface SessionIndexPayload {
  version: number;
  entries: Record<string, SessionIndexEntry>;
}

export class FileSessionStore implements SessionStorageEngine {
  private dataDir: string;
  private indexCache: Map<string, SessionIndexEntry> | null = null;

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
  }

  private async ensureDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  private getSessionFilePath(id: string): string {
    return path.join(this.dataDir, `${id}${SESSION_FILE_SUFFIX}`);
  }

  private getSessionTurnsPath(id: string): string {
    return path.join(this.dataDir, `${id}${SESSION_TURNS_SUFFIX}`);
  }

  private getSessionIndexPath(): string {
    return path.join(this.dataDir, SESSION_INDEX_FILE);
  }

  private cloneSessionShallow(session: SessionMetadata): Omit<SessionMetadata, 'turnHistory'> {
    const { turnHistory: _, ...rest } = session;
    return {
      ...rest,
      skillsActive: [...rest.skillsActive],
      toolsAllowlist: [...rest.toolsAllowlist],
    };
  }

  private cloneSession(session: SessionMetadata): SessionMetadata {
    return {
      ...session,
      skillsActive: [...session.skillsActive],
      toolsAllowlist: [...session.toolsAllowlist],
      turnHistory: Array.isArray(session.turnHistory)
        ? session.turnHistory.map((turn) => ({
            ...turn,
            runSummary: turn.runSummary
              ? {
                  ...turn.runSummary,
                  steps: turn.runSummary.steps.map((step) => ({ ...step })),
                  filesRead: [...turn.runSummary.filesRead],
                  directoriesRead: [...turn.runSummary.directoriesRead],
                  filesWritten: [...turn.runSummary.filesWritten],
                  filesDeleted: [...turn.runSummary.filesDeleted],
                  directoriesCreated: [...turn.runSummary.directoriesCreated],
                  searches: turn.runSummary.searches.map((entry) => ({ ...entry })),
                  webSearches: turn.runSummary.webSearches.map((entry) => ({ ...entry })),
                  webFetches: turn.runSummary.webFetches.map((entry) => ({ ...entry })),
                  commands: turn.runSummary.commands.map((entry) => ({ ...entry })),
                  approvals: turn.runSummary.approvals.map((entry) => ({ ...entry })),
                  git: turn.runSummary.git ? { ...turn.runSummary.git } : undefined,
                  metrics: turn.runSummary.metrics ? { ...turn.runSummary.metrics } : undefined,
                  workflow: turn.runSummary.workflow
                    ? {
                        ...turn.runSummary.workflow,
                        steps: turn.runSummary.workflow.steps.map((step) => ({ ...step })),
                        filesRead: [...turn.runSummary.workflow.filesRead],
                        filesChanged: [...turn.runSummary.workflow.filesChanged],
                        approvals: [...turn.runSummary.workflow.approvals],
                        commands: [...turn.runSummary.workflow.commands],
                        errors: [...turn.runSummary.workflow.errors],
                      }
                    : undefined,
                }
              : undefined,
          }))
        : undefined,
    };
  }

  private isSessionFile(fileName: string): boolean {
    return fileName.endsWith(SESSION_FILE_SUFFIX) && fileName !== SESSION_INDEX_FILE;
  }

  private async readSessionFile(id: string): Promise<SessionMetadata | null> {
    try {
      const data = await fs.readFile(this.getSessionFilePath(id), 'utf-8');
      return JSON.parse(data) as SessionMetadata;
    } catch {
      return null;
    }
  }

  private async getSessionFileMtimeMs(id: string): Promise<number> {
    try {
      const stat = await fs.stat(this.getSessionFilePath(id));
      return stat.mtimeMs;
    } catch {
      return 0;
    }
  }

  private async readIndexFile(): Promise<Map<string, SessionIndexEntry>> {
    try {
      const data = await fs.readFile(this.getSessionIndexPath(), 'utf-8');
      const parsed = JSON.parse(data) as SessionIndexPayload;
      if (!parsed || (parsed.version !== SESSION_INDEX_VERSION && parsed.version !== 1) || !parsed.entries || typeof parsed.entries !== 'object') {
        return new Map();
      }

      return new Map(
        Object.entries(parsed.entries)
          .filter(([, entry]) => Boolean(entry?.session?.id))
          .map(([id, entry]) => {
            // Strip turnHistory from index entries (v1 → v2 migration)
            const { turnHistory: _, ...shallow } = entry.session as any;
            return [
              id,
              {
                session: { ...shallow, skillsActive: [...(shallow.skillsActive || [])], toolsAllowlist: [...(shallow.toolsAllowlist || [])] },
                fileMtimeMs: Number(entry.fileMtimeMs) || 0,
              },
            ];
          }),
      );
    } catch {
      return new Map();
    }
  }

  private async writeIndexFile(index: Map<string, SessionIndexEntry>): Promise<void> {
    const entries = Object.fromEntries(
      Array.from(index.entries()).map(([id, entry]) => [
        id,
        {
          session: this.cloneSessionShallow(entry.session as SessionMetadata),
          fileMtimeMs: entry.fileMtimeMs,
        },
      ]),
    );

    const payload: SessionIndexPayload = {
      version: SESSION_INDEX_VERSION,
      entries,
    };

    await fs.writeFile(this.getSessionIndexPath(), JSON.stringify(payload, null, 2));
  }

  private async ensureIndex(): Promise<Map<string, SessionIndexEntry>> {
    await this.ensureDir();
    if (!this.indexCache) {
      this.indexCache = await this.readIndexFile();
    }
    return this.indexCache;
  }

  private async reconcileIndex(index: Map<string, SessionIndexEntry>): Promise<void> {
    await this.ensureDir();
    const files = await fs.readdir(this.dataDir);
    const sessionFiles = files.filter((fileName) => this.isSessionFile(fileName));
    const fileIds = new Set(sessionFiles.map((fileName) => fileName.slice(0, -SESSION_FILE_SUFFIX.length)));
    let changed = false;

    for (const indexedId of Array.from(index.keys())) {
      if (!fileIds.has(indexedId)) {
        index.delete(indexedId);
        changed = true;
      }
    }

    for (const fileName of sessionFiles) {
      const id = fileName.slice(0, -SESSION_FILE_SUFFIX.length);
      const mtimeMs = await this.getSessionFileMtimeMs(id);
      const indexed = index.get(id);

      if (indexed && indexed.fileMtimeMs >= mtimeMs) {
        continue;
      }

      const session = await this.readSessionFile(id);
      if (!session) {
        if (indexed) {
          index.delete(id);
          changed = true;
        }
        continue;
      }

      index.set(id, {
        session: this.cloneSessionShallow(session),
        fileMtimeMs: mtimeMs,
      });
      changed = true;
    }

    if (changed) {
      await this.writeIndexFile(index);
    }
  }

  /** Load turn history from the JSONL sidecar, falling back to embedded turnHistory in session JSON. */
  private async loadTurns(id: string, fallbackSession?: SessionMetadata | null): Promise<SessionTurnMetadata[]> {
    const turnsPath = this.getSessionTurnsPath(id);
    try {
      const data = await fs.readFile(turnsPath, 'utf-8');
      const lines = data.trim().split('\n').filter(Boolean);
      return lines.map((line) => JSON.parse(line) as SessionTurnMetadata);
    } catch {
      // Fall back to embedded turnHistory from the main session file (pre-migration)
      if (fallbackSession && Array.isArray(fallbackSession.turnHistory)) {
        return fallbackSession.turnHistory.map((t) => ({ ...t }));
      }
      return [];
    }
  }

  async saveSession(session: SessionMetadata): Promise<void> {
    await this.ensureDir();
    session.updatedAt = Date.now();

    // Write base metadata without turnHistory to the main file
    const { turnHistory, ...baseMetadata } = session;
    await fs.writeFile(this.getSessionFilePath(session.id), JSON.stringify(baseMetadata, null, 2));

    // If the session carries embedded turnHistory, migrate it to JSONL sidecar
    if (Array.isArray(turnHistory) && turnHistory.length > 0) {
      const turnsPath = this.getSessionTurnsPath(session.id);
      const jsonlContent = turnHistory.map((t) => JSON.stringify(t)).join('\n') + '\n';
      await fs.writeFile(turnsPath, jsonlContent);
    }

    const index = await this.ensureIndex();
    index.set(session.id, {
      session: this.cloneSessionShallow(session),
      fileMtimeMs: await this.getSessionFileMtimeMs(session.id),
    });
    await this.writeIndexFile(index);
  }

  async appendTurn(id: string, turn: SessionTurnMetadata): Promise<void> {
    await this.ensureDir();
    const turnsPath = this.getSessionTurnsPath(id);
    const line = JSON.stringify(turn) + '\n';
    await fs.appendFile(turnsPath, line);

    // Touch updatedAt in index without rewriting full session file
    const index = await this.ensureIndex();
    const indexed = index.get(id);
    if (indexed) {
      indexed.session.updatedAt = Date.now();
      await this.writeIndexFile(index);
    }
  }

  async loadSession(id: string): Promise<SessionMetadata | null> {
    const index = await this.ensureIndex();
    const indexed = index.get(id);

    // Try loading from file directly
    const session = await this.readSessionFile(id);
    if (!session) {
      if (indexed) {
        index.delete(id);
        await this.writeIndexFile(index);
      }
      return null;
    }

    // Load turns from JSONL sidecar (or embedded fallback)
    session.turnHistory = await this.loadTurns(id, session);

    // Update index
    index.set(id, {
      session: this.cloneSessionShallow(session),
      fileMtimeMs: await this.getSessionFileMtimeMs(id),
    });
    await this.writeIndexFile(index);

    return this.cloneSession(session);
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.getSessionFilePath(id));
    } catch {
      return false;
    }

    // Also remove the JSONL sidecar if it exists
    try {
      await fs.unlink(this.getSessionTurnsPath(id));
    } catch {
      // Sidecar may not exist — that's fine
    }

    const index = await this.ensureIndex();
    if (index.delete(id)) {
      await this.writeIndexFile(index);
    }
    return true;
  }

  async listSessions(): Promise<SessionMetadata[]> {
    const index = await this.ensureIndex();
    await this.reconcileIndex(index);

    return Array.from(index.values())
      .map((entry) => ({
        ...entry.session,
        skillsActive: [...entry.session.skillsActive],
        toolsAllowlist: [...entry.session.toolsAllowlist],
        turnHistory: undefined, // Not loaded in listing — load individually via loadSession
      } as SessionMetadata))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
