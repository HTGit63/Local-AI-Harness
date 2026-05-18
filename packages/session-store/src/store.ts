import * as fs from 'fs/promises';
import * as path from 'path';
import {
  CompactRunOutcome,
  CompactRunSummary,
  SessionMetadata,
  SessionStorageEngine,
  SessionTurnMetadata,
  SkillAuditState,
} from './types';

const SESSION_FILE_SUFFIX = '.json';
const SESSION_TURNS_SUFFIX = '-turns.jsonl';
const SESSION_INDEX_FILE = '.session-index.json';
const SESSION_INDEX_VERSION = 2;
const MAX_TURNS_PER_SESSION = 48;
const MAX_SUMMARY_CHARS = 900;
const MAX_RUN_SUMMARY_CHARS = 800;
const MAX_PATHS_PER_RUN = 16;
const MAX_COMMANDS_PER_RUN = 8;
const MAX_COMMAND_CHARS = 220;

interface SessionIndexEntry {
  /** Shallow metadata — turnHistory is NOT stored in the index. */
  session: Omit<SessionMetadata, 'turnHistory'> & { turnHistory?: undefined };
  fileMtimeMs: number;
}

interface SessionIndexPayload {
  version: number;
  entries: Record<string, SessionIndexEntry>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function redactText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=_-]+/gi, '[REDACTED_IMAGE_DATA]')
    .replace(/\b(?:sk|rk|pat|ghp|gho|github_pat|xox[baprs]?)-[a-z0-9_=-]{8,}\b/gi, '[REDACTED_SECRET]')
    .replace(/\b[a-z0-9_-]{20,}\.[a-z0-9_-]{20,}\.[a-z0-9_-]{20,}\b/gi, '[REDACTED_JWT]')
    .replace(
      /\b(api[_-]?key|token|secret|password|authorization)\b\s*[:=]\s*["']?[^"'\s,;}]+/gi,
      '$1=[REDACTED_SECRET]',
    );
}

function clipText(value: unknown, maxChars: number): string | undefined {
  const redacted = redactText(value);
  if (!redacted) {
    return undefined;
  }
  return redacted.length > maxChars ? `${redacted.slice(0, Math.max(0, maxChars - 3))}...` : redacted;
}

function uniqueStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = clipText(item, MAX_COMMAND_CHARS);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    result.push(text);
    if (result.length >= maxItems) {
      break;
    }
  }
  return result;
}

function commandsFromRun(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const commands: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const command = isRecord(item) ? item.command : item;
    const text = clipText(command, MAX_COMMAND_CHARS);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    commands.push(text);
    if (commands.length >= MAX_COMMANDS_PER_RUN) {
      break;
    }
  }
  return commands;
}

function diffFilePaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueStringList(
    value
      .filter(isRecord)
      .flatMap((file) => [file.path, file.oldPath])
      .filter((item): item is string => typeof item === 'string' && item.length > 0),
    MAX_PATHS_PER_RUN,
  );
}

function changedPathsFromRun(run: Record<string, unknown>): string[] {
  const structured = isRecord(run.structuredDiff) ? diffFilePaths(run.structuredDiff.files) : [];
  return uniqueStringList(
    [
      ...(Array.isArray(run.filesWritten) ? run.filesWritten : []),
      ...(Array.isArray(run.filesDeleted) ? run.filesDeleted : []),
      ...(Array.isArray(run.directoriesCreated) ? run.directoriesCreated : []),
      ...(Array.isArray(run.fileChanges) ? diffFilePaths(run.fileChanges) : []),
      ...structured,
    ],
    MAX_PATHS_PER_RUN,
  );
}

function inferOutcome(run: Record<string, unknown>): CompactRunOutcome {
  if (run.error) {
    return 'failed';
  }
  if (run.fallbackPath === 'final_noop_warning') {
    return 'safe_idle';
  }
  if (
    Array.isArray(run.approvals) &&
    run.approvals.some((approval) => isRecord(approval) && approval.approved !== true)
  ) {
    return 'blocked';
  }
  return 'done';
}

function compactRunSummaryValue(
  value: unknown,
  turn: Pick<SessionTurnMetadata, 'timestamp' | 'executionMode' | 'intent' | 'summary' | 'firstTokenMs' | 'totalDurationMs'>,
): CompactRunSummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const runId = typeof value.runId === 'string' ? value.runId : typeof value.id === 'string' ? value.id : undefined;
  if (!runId) {
    return undefined;
  }

  const mode = value.mode === 'agent' || value.mode === 'chat'
    ? value.mode
    : value.executionMode === 'agent' || value.executionMode === 'chat'
      ? value.executionMode
      : turn.executionMode;
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  const summary =
    clipText(value.summary, MAX_RUN_SUMMARY_CHARS) ||
    clipText(value.finalAnswer, MAX_RUN_SUMMARY_CHARS) ||
    clipText(turn.summary, MAX_RUN_SUMMARY_CHARS) ||
    'No compact summary recorded.';

  return {
    runId,
    mode,
    intent: clipText(value.intent, 160) || turn.intent || 'unknown',
    goal: clipText(value.goal, 220),
    outcome:
      value.outcome === 'done' ||
      value.outcome === 'blocked' ||
      value.outcome === 'safe_idle' ||
      value.outcome === 'failed'
        ? value.outcome
        : inferOutcome(value),
    filesRead:
      Array.isArray(value.filesRead) || Array.isArray(value.directoriesRead)
        ? uniqueStringList(
            [
              ...(Array.isArray(value.filesRead) ? value.filesRead : []),
              ...(Array.isArray(value.directoriesRead) ? value.directoriesRead : []),
            ],
            MAX_PATHS_PER_RUN,
          )
        : uniqueStringList(value.filesRead, MAX_PATHS_PER_RUN),
    filesChanged: Array.isArray(value.filesChanged)
      ? uniqueStringList(value.filesChanged, MAX_PATHS_PER_RUN)
      : changedPathsFromRun(value),
    commandsRun: Array.isArray(value.commandsRun)
      ? uniqueStringList(value.commandsRun, MAX_COMMANDS_PER_RUN)
      : commandsFromRun(value.commands),
    approvals: typeof value.approvals === 'number' ? value.approvals : Array.isArray(value.approvals) ? value.approvals.length : 0,
    toolProtocol: value.toolProtocol === 'native' || value.toolProtocol === 'manual' ? value.toolProtocol : undefined,
    fallbackPath: typeof value.fallbackPath === 'string' ? value.fallbackPath as CompactRunSummary['fallbackPath'] : undefined,
    usedManualFallback: typeof value.usedManualFallback === 'boolean' ? value.usedManualFallback : undefined,
    fallbackReason: clipText(value.fallbackReason, MAX_RUN_SUMMARY_CHARS),
    summary,
    error: clipText(value.error, MAX_RUN_SUMMARY_CHARS),
    startedAt: asNumber(value.startedAt, turn.timestamp),
    endedAt: asOptionalNumber(value.endedAt),
    firstTokenMs: asOptionalNumber(value.firstTokenMs) ?? asOptionalNumber(metrics.firstTokenMs) ?? turn.firstTokenMs,
    totalDurationMs: asOptionalNumber(value.totalDurationMs) ?? asOptionalNumber(metrics.totalMs) ?? turn.totalDurationMs,
  };
}

function sanitizeTurn(turn: SessionTurnMetadata): SessionTurnMetadata {
  const executionMode = turn.executionMode === 'agent' ? 'agent' : 'chat';
  const sanitized: SessionTurnMetadata = {
    timestamp: asNumber(turn.timestamp, Date.now()),
    executionMode,
    promptMode: clipText(turn.promptMode, 80),
    messageCount: Math.max(0, Math.floor(asNumber(turn.messageCount, 0))),
    thinkingEnabled: Boolean(turn.thinkingEnabled),
    imageCount: Math.max(0, Math.floor(asNumber(turn.imageCount, 0))),
    intent: clipText(turn.intent, 160),
    summary: clipText(turn.summary, MAX_SUMMARY_CHARS),
    firstTokenMs: asOptionalNumber(turn.firstTokenMs),
    totalDurationMs: asOptionalNumber(turn.totalDurationMs),
  };

  const runSummary = compactRunSummaryValue((turn as any).runSummary, sanitized);
  if (runSummary) {
    sanitized.runSummary = runSummary;
  }

  return sanitized;
}

function compactTurnHistory(turnHistory: SessionTurnMetadata[]): SessionTurnMetadata[] {
  return turnHistory.map(sanitizeTurn).slice(-MAX_TURNS_PER_SESSION);
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
      skillAudit: this.cloneSkillAudit(rest.skillAudit),
      toolsAllowlist: [...rest.toolsAllowlist],
    };
  }

  private cloneSession(session: SessionMetadata): SessionMetadata {
    return {
      ...session,
      skillsActive: [...session.skillsActive],
      skillAudit: this.cloneSkillAudit(session.skillAudit),
      toolsAllowlist: [...session.toolsAllowlist],
      turnHistory: Array.isArray(session.turnHistory)
        ? compactTurnHistory(session.turnHistory)
        : undefined,
    };
  }

  private cloneSkillAudit(skillAudit?: SkillAuditState): SkillAuditState | undefined {
    if (!skillAudit) {
      return undefined;
    }

    return {
      requested: [...skillAudit.requested],
      catalog: [...skillAudit.catalog],
      records: skillAudit.records.map((record) => ({ ...record })),
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
            const skillAudit = shallow.skillAudit as SkillAuditState | undefined;
            return [
              id,
              {
                session: {
                  ...shallow,
                  skillsActive: [...(shallow.skillsActive || [])],
                  skillAudit: this.cloneSkillAudit(skillAudit),
                  toolsAllowlist: [...(shallow.toolsAllowlist || [])],
                },
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
      return compactTurnHistory(
        lines
          .map((line) => {
            try {
              return JSON.parse(line) as SessionTurnMetadata;
            } catch {
              return null;
            }
          })
          .filter((turn): turn is SessionTurnMetadata => Boolean(turn)),
      );
    } catch {
      // Fall back to embedded turnHistory from the main session file (pre-migration)
      if (fallbackSession && Array.isArray(fallbackSession.turnHistory)) {
        return compactTurnHistory(fallbackSession.turnHistory);
      }
      return [];
    }
  }

  private async writeTurns(id: string, turns: SessionTurnMetadata[]): Promise<void> {
    const turnsPath = this.getSessionTurnsPath(id);
    const compactTurns = compactTurnHistory(turns);
    const jsonlContent = compactTurns.map((t) => JSON.stringify(t)).join('\n');
    await fs.writeFile(turnsPath, jsonlContent ? `${jsonlContent}\n` : '');
  }

  private async trimTurnsFile(id: string): Promise<void> {
    const turnsPath = this.getSessionTurnsPath(id);
    try {
      const data = await fs.readFile(turnsPath, 'utf-8');
      const lines = data.trim().split('\n').filter(Boolean);
      if (lines.length <= MAX_TURNS_PER_SESSION) {
        return;
      }
      await fs.writeFile(turnsPath, `${lines.slice(-MAX_TURNS_PER_SESSION).join('\n')}\n`);
    } catch {
      // Best-effort bound enforcement; normal load still sanitizes.
    }
  }

  async saveSession(session: SessionMetadata): Promise<void> {
    await this.ensureDir();
    session.updatedAt = Date.now();

    // Write base metadata without turnHistory to the main file
    const compactTurns = Array.isArray(session.turnHistory) ? compactTurnHistory(session.turnHistory) : undefined;
    session.turnHistory = compactTurns;
    const { turnHistory, ...baseMetadata } = session;
    await fs.writeFile(this.getSessionFilePath(session.id), JSON.stringify(baseMetadata, null, 2));

    // If the session carries embedded turnHistory, migrate it to JSONL sidecar
    if (Array.isArray(turnHistory)) {
      await this.writeTurns(session.id, turnHistory);
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
    const line = JSON.stringify(sanitizeTurn(turn)) + '\n';
    await fs.appendFile(turnsPath, line);
    await this.trimTurnsFile(id);

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
