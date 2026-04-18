import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ApprovalQueueManager, ApprovalRequestPayload } from '@local-harness/approval-workflow';
import { ModelAdapter, ModelRuntimeState } from '@local-harness/model-adapter';
import { Planner } from '@local-harness/planner';
import { PromptOptimizer, RECIPES, RunMode } from '@local-harness/prompt-recipes';
import { RepoIndexer, ProjectContext } from '@local-harness/repo-indexer';
import { FileSessionStore, SessionMetadata, SessionTurnMetadata } from '@local-harness/session-store';
import { ToolRegistry } from '@local-harness/tool-runtime';
import { TraceBus, TraceEvent } from '@local-harness/trace-bus';
import { ActionType, PolicyCheckResult, PolicyMode, WorkspacePolicy } from '@local-harness/workspace-policy';
// PromptAnalyzer removed — passes messages straight through for lower latency

const SUPPORTED_TOOLS = [
  'glob',
  'readFile',
  'searchText',
  'listDir',
  'writeFile',
  'patchFile',
  'makeDir',
  'deleteFile',
  'runCommand',
  'gitStatus',
  'gitDiff',
] as const;
const AUTO_REPO_CONTEXT_ENABLED = process.env.HARNESS_AUTO_REPO_CONTEXT === '1';

type SupportedTool = (typeof SUPPORTED_TOOLS)[number];
type TurnExecutionMode = 'direct' | 'agentic';
type ReasoningEffort = 'high' | 'medium' | 'low' | 'none';
type ManualToolDecision =
  | { kind: 'tool'; name: SupportedTool; args: Record<string, unknown> }
  | { kind: 'final'; content: string };
type ImmediateChatAnswer = { content: string; action: string; source: string };
type ToolProtocolMode = 'native' | 'manual_preferred' | 'manual_fallback';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatStatusEvent {
  phase: string;
  action: string;
  loop: number;
}

export interface ChatToolEvent {
  id: string;
  name: SupportedTool;
  state: 'start' | 'done';
  inputSummary: string;
  output?: string;
  success?: boolean;
}

export interface ChatStreamHandlers {
  onStatus?: (event: ChatStatusEvent) => void;
  onDelta?: (chunk: string) => void;
  onTool?: (event: ChatToolEvent) => void;
}

export interface EngineConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  profile: 'fast' | 'balanced' | 'deep';
  workspaceRoot: string;
  mode: PolicyMode;
  sessionDataDir: string;
}

export interface PublicEngineConfig {
  baseUrl: string;
  model: string;
  profile: 'fast' | 'balanced' | 'deep';
  workspaceRoot: string;
  mode: PolicyMode;
  sessionDataDir: string;
}

export interface UpdateConfigOptions {
  activateModel?: boolean;
}

const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  baseUrl: process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1',
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  model: 'gemma4:e4b',
  profile: 'fast',
  workspaceRoot: process.cwd(),
  mode: 'workspace-write',
  sessionDataDir: '.gamma-harness/sessions',
};

function resolveSessionDataDir(workspaceRoot: string, sessionDataDir: string): string {
  return path.isAbsolute(sessionDataDir)
    ? sessionDataDir
    : path.resolve(workspaceRoot, sessionDataDir);
}

function createSessionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function toolActionToChangeType(action: string): ApprovalRequestPayload['changeType'] {
  switch (action) {
    case 'writeFile':
    case 'write_file':
    case 'patchFile':
    case 'patch_file':
      return 'modify_file';
    case 'makeDir':
    case 'make_dir':
      return 'create_file';
    case 'deleteFile':
    case 'delete_file':
      return 'delete_file';
    case 'runCommand':
    case 'run_command':
      return 'run_command';
    default:
      return 'modify_file';
  }
}

function toolActionToSeverity(action: string): ApprovalRequestPayload['severity'] {
  switch (action) {
    case 'deleteFile':
    case 'delete_file':
      return 'danger';
    case 'runCommand':
    case 'run_command':
    case 'patchFile':
    case 'patch_file':
    case 'writeFile':
    case 'write_file':
      return 'warning';
    default:
      return 'info';
  }
}

function getRequiredStringArg(args: Record<string, unknown>, key: string, toolName: SupportedTool): string {
  const value = args[key];
  if (typeof value === 'string' && value.trim()) {
    return value;
  }

  throw new Error(`Missing required ${key} argument for ${toolName}.`);
}

function getOptionalStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function looksLikeSimulatedToolCall(content: string): boolean {
  const normalized = content.toLowerCase();
  if (
    normalized.includes('<|tool') ||
    normalized.includes('<\uff5ctool') ||
    normalized.includes('tool_calls_begin') ||
    normalized.includes('tool_call_begin') ||
    normalized.includes('tool▁calls▁begin') ||
    normalized.includes('tool▁call▁begin')
  ) {
    return true;
  }

  const mentionsToolName = /(create_file|write_file|patch_file|read_file|run_command|list_dir|search_text)/.test(normalized);
  if (mentionsToolName && normalized.includes('```python')) {
    return true;
  }

  return mentionsToolName && normalized.includes('"status"') && normalized.includes('"message"');
}

function extractTextSegment(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry === 'object') {
          const chunk = entry as { text?: unknown; type?: unknown };
          if (typeof chunk.text === 'string') {
            return chunk.text;
          }
          if (chunk.type === 'text' && typeof (chunk as { value?: unknown }).value === 'string') {
            return (chunk as { value: string }).value;
          }
        }

        return '';
      })
      .join('');
  }

  if (value && typeof value === 'object') {
    const candidate = value as { text?: unknown; content?: unknown };
    if (typeof candidate.text === 'string') {
      return candidate.text;
    }
    if (typeof candidate.content === 'string') {
      return candidate.content;
    }
  }

  return '';
}

function extractReasoningSegment(delta: Record<string, unknown>): string {
  const directKeys = ['reasoning_content', 'thinking', 'thought'] as const;
  for (const key of directKeys) {
    const chunk = extractTextSegment(delta[key]);
    if (chunk) {
      return chunk;
    }
  }

  const reasoning = delta.reasoning;
  if (reasoning && typeof reasoning === 'object') {
    const candidate = extractTextSegment(reasoning);
    if (candidate) {
      return candidate;
    }
  }

  return '';
}

function composeAssistantContent(message: Record<string, unknown>): string {
  const thinking = extractTextSegment(message.thinking);
  const content = extractTextSegment(message.content);

  if (thinking && content) {
    return `<think>${thinking}</think>${content}`;
  }

  if (thinking) {
    return `<think>${thinking}</think>`;
  }

  return content;
}

function appendToolCallDeltas(target: any[], deltas: any[]) {
  for (const delta of deltas) {
    const index = typeof delta?.index === 'number' ? delta.index : target.length;
    if (!target[index]) {
      target[index] = {
        id: '',
        type: 'function',
        function: {
          name: '',
          arguments: '',
        },
      };
    }

    const toolCall = target[index];
    if (typeof delta?.id === 'string') {
      toolCall.id = delta.id;
    }
    if (typeof delta?.type === 'string') {
      toolCall.type = delta.type;
    }
    if (delta?.function && typeof delta.function === 'object') {
      if (typeof delta.function.name === 'string') {
        toolCall.function.name += delta.function.name;
      }
      if (typeof delta.function.arguments === 'string') {
        toolCall.function.arguments += delta.function.arguments;
      }
    }
  }
}

const STREAM_TOOL_OUTPUT_MAX_LINES = 12;
const STREAM_TOOL_OUTPUT_MAX_CHARS = 900;

function truncateStreamPreview(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  const lines = normalized.split('\n');
  const clippedLines = lines.slice(0, STREAM_TOOL_OUTPUT_MAX_LINES);
  let clipped = clippedLines.join('\n');
  if (clipped.length > STREAM_TOOL_OUTPUT_MAX_CHARS) {
    clipped = `${clipped.slice(0, STREAM_TOOL_OUTPUT_MAX_CHARS)}...`;
  }

  if (lines.length > STREAM_TOOL_OUTPUT_MAX_LINES || clipped.length < normalized.length) {
    return `${clipped}\n... truncated ...`;
  }

  return clipped;
}

function summarizeToolArgs(toolName: SupportedTool, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'readFile':
    case 'writeFile':
    case 'patchFile':
    case 'deleteFile':
      return `Path: ${getRequiredStringArg(args, 'filePath', toolName)}`;
    case 'listDir':
      return `Path: ${getOptionalStringArg(args, 'dirPath') || '.'}`;
    case 'glob':
      return `Pattern: ${getRequiredStringArg(args, 'pattern', toolName)}`;
    case 'searchText':
      return [
        `Query: ${getRequiredStringArg(args, 'query', toolName)}`,
        getOptionalStringArg(args, 'filePattern') ? `Files: ${getOptionalStringArg(args, 'filePattern')}` : null,
      ].filter((entry): entry is string => Boolean(entry)).join(' | ');
    case 'makeDir':
      return `Path: ${getRequiredStringArg(args, 'dirPath', toolName)}`;
    case 'runCommand':
      return `Command: ${getRequiredStringArg(args, 'command', toolName)}`;
    case 'gitStatus':
    case 'gitDiff':
      return 'Workspace command';
    default:
      return truncateStreamPreview(JSON.stringify(args));
  }
}

export class CoreEngine extends EventEmitter {
  public config: EngineConfig;

  private readonly modelAdapter: ModelAdapter;
  private readonly workspacePolicy: WorkspacePolicy;
  private sessionStore: FileSessionStore;
  private readonly traceBus: TraceBus;
  private readonly approvalQueue: ApprovalQueueManager;
  private readonly planner: Planner;
  private readonly repoIndexer: RepoIndexer;
  private readonly toolRegistry: ToolRegistry;
  private sessionDataDirSetting: string;
  private readonly traceLog: TraceEvent[] = [];
  private currentSession: SessionMetadata | null = null;
  private workspaceChangedNotice: string | null = null;

  constructor(config: Partial<EngineConfig> = {}) {
    super();
    const workspaceRoot = path.resolve(config.workspaceRoot ?? DEFAULT_ENGINE_CONFIG.workspaceRoot);
    this.sessionDataDirSetting = config.sessionDataDir ?? DEFAULT_ENGINE_CONFIG.sessionDataDir;
    const sessionDataDir = resolveSessionDataDir(workspaceRoot, this.sessionDataDirSetting);

    this.config = {
      ...DEFAULT_ENGINE_CONFIG,
      ...config,
      workspaceRoot,
      sessionDataDir,
    };

    this.modelAdapter = new ModelAdapter(this.config);
    this.workspacePolicy = new WorkspacePolicy({
      workspaceRoot: this.config.workspaceRoot,
      mode: this.config.mode,
    });
    this.sessionStore = new FileSessionStore(sessionDataDir);
    this.traceBus = new TraceBus();
    this.approvalQueue = new ApprovalQueueManager(this.traceBus);
    this.planner = new Planner(this.traceBus);
    this.repoIndexer = new RepoIndexer(this.config.workspaceRoot);
    this.toolRegistry = new ToolRegistry({
      cwd: this.config.workspaceRoot,
      emitTrace: (type: string, data: unknown) => this.traceBus.emitEvent({ type, data }),
      checkPolicy: (action: ActionType, target?: string) => this.workspacePolicy.checkAction(action, target),
      requestApproval: (request: { action: string; target: string; preview: string; metadata?: Record<string, string> }) => {
        const approvalHandle = this.approvalQueue.requestApproval({
          target: request.target,
          changeType: toolActionToChangeType(request.action),
          severity: toolActionToSeverity(request.action),
          diffPreview: request.preview,
          metadata: request.metadata,
        });
        const approvalDecision = Object.assign(
          approvalHandle.then((review: { approved: boolean }) => review.approved),
          {
            updatePreview: (preview: string) => {
              approvalHandle.updatePreview(preview);
            },
          },
        );
        return approvalDecision;
      },
    });

    this.traceBus.on('trace', (event: TraceEvent) => {
      this.traceLog.push(event);
      if (this.traceLog.length > 500) {
        this.traceLog.shift();
      }
      this.emit('trace', event);

      if (event.type === 'approval_enqueued') {
        const payload = event.data as ApprovalRequestPayload;
        this.emit('approval_requested', {
          id: payload.id,
          action: payload.changeType,
          target: payload.target,
          preview: payload.diffPreview ?? payload.warningMessage ?? '',
          severity: payload.severity,
        });
      }

      if (event.type === 'approval_resolved') {
        this.emit('approval_resolved', event.data);
      }

      if (event.type === 'planner_trace') {
        this.emit('plan_trace', event.data);
      }
    });
  }

  getPublicConfig(): PublicEngineConfig {
    return {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      profile: this.config.profile,
      workspaceRoot: this.config.workspaceRoot,
      mode: this.config.mode,
      sessionDataDir: this.config.sessionDataDir,
    };
  }

  private async persistCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.updatedAt = Date.now();
    await this.sessionStore.saveSession(this.currentSession);
  }

  async recordTurnExecution(
    executionMode: TurnExecutionMode,
    details: {
      promptMode?: string;
      messageCount: number;
      thinkingEnabled?: boolean;
      imageCount?: number;
    },
  ): Promise<SessionTurnMetadata> {
    if (!this.currentSession) {
      this.startSession();
    }

    const record: SessionTurnMetadata = {
      timestamp: Date.now(),
      executionMode,
      promptMode: details.promptMode,
      messageCount: details.messageCount,
      thinkingEnabled: details.thinkingEnabled,
      imageCount: details.imageCount,
    };

    this.currentSession = {
      ...(this.currentSession as SessionMetadata),
      turnHistory: [...(this.currentSession?.turnHistory ?? []), record],
    };

    this.traceBus.emitEvent({
      type: 'chat_turn_mode',
      data: record,
    });

    // Append turn to JSONL sidecar instead of rewriting the full session
    await this.sessionStore.appendTurn(this.currentSession!.id, record);
    return record;
  }

  private refreshWorkspaceRuntime(workspaceRoot: string) {
    this.repoIndexer.updateWorkspaceRoot(workspaceRoot);
    this.workspacePolicy.updateConfig({
      workspaceRoot,
      mode: this.config.mode,
    });
    this.toolRegistry.updateContext({ cwd: workspaceRoot });
  }

  startSession(skills: string[] = []): SessionMetadata {
    const session: SessionMetadata = {
      id: createSessionId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: this.config.model,
      mode: this.config.mode,
      cwd: this.config.workspaceRoot,
      skillsActive: skills,
      toolsAllowlist: [...SUPPORTED_TOOLS],
      turnHistory: [],
    };

    this.currentSession = session;
    this.planner.setTaskSummary('Interactive coding session');
    this.planner.setPhase('ready');
    this.planner.setActiveSkills(skills);
    this.planner.setIntendedAction('Awaiting user input');
    this.traceBus.emitEvent({ type: 'session_started', data: session });
    void this.persistCurrentSession();

    return session;
  }

  async resumeSession(id: string): Promise<SessionMetadata | null> {
    const session = await this.sessionStore.loadSession(id);
    if (!session) {
      return null;
    }

    this.currentSession = session;
    this.planner.setTaskSummary(`Resumed session ${session.id}`);
    this.planner.setPhase('ready');
    this.planner.setActiveSkills(session.skillsActive);
    this.planner.setIntendedAction('Awaiting user input');
    this.traceBus.emitEvent({ type: 'session_resumed', data: { id: session.id } });
    return session;
  }

  async listSessions(): Promise<SessionMetadata[]> {
    return this.sessionStore.listSessions();
  }

  async deleteSession(id: string): Promise<boolean> {
    if (this.currentSession?.id === id) {
      this.currentSession = null;
    }

    return this.sessionStore.deleteSession(id);
  }

  getSession(): SessionMetadata | null {
    return this.currentSession;
  }

  async updateSessionSkills(skills: string[]): Promise<SessionMetadata> {
    if (!this.currentSession) {
      this.startSession(skills);
    } else {
      this.currentSession.skillsActive = [...skills];
      this.planner.setActiveSkills(skills);
      await this.persistCurrentSession();
    }

    return this.currentSession as SessionMetadata;
  }

  checkPolicy(action: ActionType, targetPath = '.'): PolicyCheckResult {
    return this.workspacePolicy.checkAction(action, targetPath);
  }

  getPendingApprovals(): ApprovalRequestPayload[] {
    return this.approvalQueue.getPendingQueue();
  }

  resolveApproval(id: string, approved: boolean, editInstruction?: string): boolean {
    return this.approvalQueue.resolveApproval(id, { approved, editInstruction });
  }

  getTraceLog(): TraceEvent[] {
    return [...this.traceLog];
  }

  getPlanState() {
    return this.planner.getState();
  }

  async updateConfig(config: Partial<EngineConfig>, options: UpdateConfigOptions = {}) {
    const previousWorkspaceRoot = this.config.workspaceRoot;
    const previousSessionDataDir = this.config.sessionDataDir;
    const previousMode = this.config.mode;
    const previousModel = this.config.model;
    const previousBaseUrl = this.config.baseUrl;

    this.config = {
      ...this.config,
      ...config,
      workspaceRoot: config.workspaceRoot ? path.resolve(config.workspaceRoot) : this.config.workspaceRoot,
    };

    if (config.sessionDataDir) {
      this.sessionDataDirSetting = config.sessionDataDir;
    }

    const workspaceChanged = this.config.workspaceRoot !== previousWorkspaceRoot;
    const modeChanged = this.config.mode !== previousMode;
    this.workspacePolicy.updateConfig({
      workspaceRoot: this.config.workspaceRoot,
      mode: this.config.mode,
    });

    if (workspaceChanged) {
      this.refreshWorkspaceRuntime(this.config.workspaceRoot);
    }

    const nextSessionDataDir = resolveSessionDataDir(this.config.workspaceRoot, this.sessionDataDirSetting);
    const sessionStoreChanged = nextSessionDataDir !== previousSessionDataDir;
    if (sessionStoreChanged) {
      this.sessionStore = new FileSessionStore(nextSessionDataDir);
    }

    this.config.sessionDataDir = nextSessionDataDir;
    this.modelAdapter.updateConfig({
      baseUrl: this.config.baseUrl,
      apiKey: this.config.apiKey,
      model: this.config.model,
      profile: this.config.profile,
    });

    const modelChanged = this.config.model !== previousModel;
    const baseUrlChanged = this.config.baseUrl !== previousBaseUrl;
    if (options.activateModel || modelChanged || baseUrlChanged) {
      this.traceBus.emitEvent({
        type: 'model_switch_requested',
        data: {
          previousModel,
          requestedModel: this.config.model,
          baseUrl: this.config.baseUrl,
        },
      });

      const switchResult = await this.modelAdapter.activateModel(this.config.model, previousModel);
      this.traceBus.emitEvent({
        type: 'model_switch_completed',
        data: switchResult,
      });
    }

    if (workspaceChanged) {
      this.currentSession = null;
      this.workspaceChangedNotice = `WORKSPACE CHANGED: All file operations now target "${this.config.workspaceRoot}". Previous workspace paths are no longer valid. Use listDir with "." to see the new workspace contents.`;
      this.planner.setTaskSummary('Workspace updated');
      this.planner.setPhase('ready');
      this.planner.setActiveSkills([]);
      this.planner.setIntendedAction('Awaiting user input');
      // Force immediate re-index of the new workspace
      void this.indexWorkspace().catch(() => {});
    } else if ((sessionStoreChanged || modeChanged || modelChanged) && this.currentSession) {
      this.currentSession.mode = this.config.mode;
      this.currentSession.model = this.config.model;
      void this.persistCurrentSession();
    }

    if (modeChanged && !workspaceChanged && !sessionStoreChanged) {
      this.planner.setPhase('ready');
    }

    this.traceBus.emitEvent({ type: 'config_updated', data: this.getPublicConfig() });
  }

  async getModelRuntime(): Promise<ModelRuntimeState> {
    return this.modelAdapter.getRuntimeState();
  }

  private getLatestUserMessage(messages: ChatMessage[]): string {
    return [...messages].reverse().find((message) => message.role === 'user')?.content || '';
  }

  private hasBrowserFolderContext(messages: ChatMessage[]): boolean {
    return messages.some((message) =>
      message.role === 'system' && message.content.includes('[Browser Folder Context]'),
    );
  }

  private isWorkspaceQuestion(latestUserMessage: string, promptMode: RunMode): boolean {
    if (promptMode !== 'quick_inspect') {
      return true;
    }

    const normalized = latestUserMessage.toLowerCase();
    return (
      /\b(app|branch|bug|build|class|code|commit|component|config|diff|directory|file|files|fix|folder|function|git|manifest|model|module|package|path|project|readme|repo|repository|runtime|source|src|test|workspace)\b/.test(normalized) ||
      /\b[a-z0-9_\-/]+\.(ts|tsx|js|jsx|json|md|py|rs|toml|css|html)\b/i.test(latestUserMessage)
    );
  }

  private shouldIncludeWriteTools(latestUserMessage: string, promptMode: RunMode): boolean {
    if (promptMode === 'targeted_edit') {
      return true;
    }

    return /\b(add|change|create|delete|edit|fix|implement|make|patch|refactor|remove|rename|update|write)\b/.test(latestUserMessage.toLowerCase());
  }

  private shouldIncludeGitTools(latestUserMessage: string, promptMode: RunMode): boolean {
    if (promptMode === 'code_review') {
      return true;
    }

    return /\b(branch|commit|diff|git|merge|rebase|status)\b/.test(latestUserMessage.toLowerCase());
  }

  private shouldIncludeCommandTool(latestUserMessage: string): boolean {
    return /\b(benchmark|build|cargo|doctor|format|install|lint|npm|pnpm|pytest|run|script|shell|test|uv|yarn)\b/.test(latestUserMessage.toLowerCase());
  }

  private isStatusOnlyWorkspaceQuestion(latestUserMessage: string): boolean {
    const normalized = latestUserMessage.toLowerCase();
    return (
      /\b(active|configured|current|open)\b/.test(normalized) &&
      /\b(cwd|directory|folder|mode|model|path|runtime|workspace)\b/.test(normalized)
    ) || /\bwhich workspace folder is open\b/.test(normalized);
  }

  private isRepoOverviewQuestion(latestUserMessage: string): boolean {
    const normalized = latestUserMessage.toLowerCase();
    return (
      /\bwhat are the main packages\b/.test(normalized) ||
      /\b(list|show|which|what)\b.*\b(apps?|modules?|packages?)\b/.test(normalized) ||
      (/\bpackage\.json\b/.test(normalized) && (/\bpackage name\b/.test(normalized) || /\bname only\b/.test(normalized) || /\broot package\b/.test(normalized))) ||
      ((/\b(repo|repository|workspace|project)\b/.test(normalized) || /\btop level\b/.test(normalized)) &&
        /\b(apps?|areas|contain|layout|main|modules?|overview|packages?|structure|summar(?:ize|y))\b/.test(normalized)) ||
      /\b(claw-code|openclaw|third[_ -]?party|base[_ -]?repos|reference repos?)\b/.test(normalized)
    );
  }

  private selectToolProtocol(
    toolNames: SupportedTool[],
    modelCapabilities: string[] | null,
  ): { manualToolProtocol: boolean; mode: ToolProtocolMode; reason?: string } {
    if (toolNames.length === 0) {
      return { manualToolProtocol: false, mode: 'native' };
    }

    if (!Array.isArray(modelCapabilities)) {
      return { manualToolProtocol: false, mode: 'native' };
    }

    if (!modelCapabilities.includes('tools')) {
      return {
        manualToolProtocol: true,
        mode: 'manual_fallback',
        reason: 'Model capabilities do not include native tools.',
      };
    }

    const nativeToolsForced = process.env.HARNESS_FORCE_NATIVE_TOOLS === '1';
    const normalizedModel = this.config.model.toLowerCase();
    if (!nativeToolsForced && normalizedModel.includes('gemma4')) {
      return {
        manualToolProtocol: true,
        mode: 'manual_preferred',
        reason: 'Gemma 4 native tool selection is much slower than manual JSON tool routing on local Ollama.',
      };
    }

    return { manualToolProtocol: false, mode: 'native' };
  }

  private supportsThinking(modelCapabilities: string[] | null): boolean {
    return Array.isArray(modelCapabilities) && modelCapabilities.includes('thinking');
  }

  private shouldIncludeRepoContext(latestUserMessage: string, promptMode: RunMode): boolean {
    if (!AUTO_REPO_CONTEXT_ENABLED) {
      return false;
    }

    if (!this.isWorkspaceQuestion(latestUserMessage, promptMode)) {
      return false;
    }

    if (promptMode !== 'quick_inspect') {
      return true;
    }

    const normalized = latestUserMessage.toLowerCase();
    return (
      /\b(app|branch|bug|build|class|code|commit|component|diff|file|files|fix|function|git|manifest|module|package|project|readme|repo|repository|source|src|test)\b/.test(normalized) ||
      /\b[a-z0-9_\-/]+\.(ts|tsx|js|jsx|json|md|py|rs|toml|css|html)\b/i.test(latestUserMessage)
    );
  }

  private async tryAnswerFromLocalState(latestUserMessage: string): Promise<ImmediateChatAnswer | null> {
    const normalized = latestUserMessage.toLowerCase();

    if (
      /\b(cwd|directory|folder|path|workspace)\b/.test(normalized) &&
      /\b(active|current|open)\b/.test(normalized)
    ) {
      return {
        content: this.currentSession?.cwd || this.config.workspaceRoot,
        action: 'Reading current workspace path',
        source: 'local_state',
      };
    }

    if (/\bconfigured model\b/.test(normalized) || (/\bmodel\b/.test(normalized) && /\bconfigured\b/.test(normalized))) {
      return {
        content: this.config.model,
        action: 'Reading configured model',
        source: 'local_state',
      };
    }

    if (/\b(active model|loaded model)\b/.test(normalized)) {
      const runtime = await this.getModelRuntime();
      return {
        content: runtime.activeModel || 'None loaded',
        action: 'Reading active model',
        source: 'local_state',
      };
    }

    if (/\b(mode|permission|permissions)\b/.test(normalized) && /\b(current|configured|active)\b/.test(normalized)) {
      return {
        content: this.config.mode,
        action: 'Reading current permission mode',
        source: 'local_state',
      };
    }

    return null;
  }

  private async tryAnswerFromDirectWorkspaceTools(latestUserMessage: string): Promise<ImmediateChatAnswer | null> {
    const normalized = latestUserMessage.toLowerCase();
    const wantsWorkspaceListing =
      /\b(list|show|what are|which)\b/.test(normalized) &&
      /\b(contents|directories|files|folders|items)\b/.test(normalized) &&
      (
        /\b(current|here|open|root|workspace)\b/.test(normalized) ||
        /\b(folder|directory)\b/.test(normalized)
      );

    if (wantsWorkspaceListing) {
      const result = await this.listDir('.');
      return {
        content: result.success ? result.output : `Unable to list the workspace: ${result.output}`,
        action: 'Listing workspace files',
        source: 'direct_workspace_tool',
      };
    }

    if (/\bgit status\b/.test(normalized) || (/\bstatus\b/.test(normalized) && /\bgit\b/.test(normalized))) {
      const result = await this.gitStatus();
      return {
        content: result.success ? result.output : `Unable to get git status: ${result.output}`,
        action: 'Reading git status',
        source: 'direct_workspace_tool',
      };
    }

    if (/\bgit diff\b/.test(normalized) || (/\bdiff\b/.test(normalized) && /\bgit\b/.test(normalized))) {
      const result = await this.gitDiff();
      return {
        content: result.success ? result.output : `Unable to get git diff: ${result.output}`,
        action: 'Reading git diff',
        source: 'direct_workspace_tool',
      };
    }

    return null;
  }

  private async tryAnswerFromLocalRepoOverview(latestUserMessage: string): Promise<ImmediateChatAnswer | null> {
    if (!this.isRepoOverviewQuestion(latestUserMessage)) {
      return null;
    }

    const normalized = latestUserMessage.toLowerCase();
    const writeIntent = /\b(create|write|add|update|modify|change|edit|fix|implement|generate|save|insert|replace|append|remove|delete)\b/.test(normalized);
    if (writeIntent) {
      return null;
    }

    const inventory = await this.repoIndexer.buildWorkspaceInventory();
    const appNames = inventory.apps.map((entry: { name: string }) => entry.name);
    const packageNames = inventory.packages.map((entry: { name: string }) => entry.name.replace(/^@local-harness\//, ''));
    const referenceNames = inventory.references.flatMap((entry: { entries: string[] }) => entry.entries);

    if (
      /\bpackage\.json\b/.test(normalized) &&
      (/\bpackage name\b/.test(normalized) || /\bname only\b/.test(normalized) || /\broot package\b/.test(normalized))
    ) {
      return {
        content: inventory.rootPackageName || 'No root package name detected.',
        action: 'Reading workspace package metadata',
        source: 'local_inventory',
      };
    }

    if (/\b(claw-code|openclaw|third[_ -]?party|base[_ -]?repos|reference repos?)\b/.test(normalized)) {
      return {
        content: referenceNames.length > 0
          ? `Local reference repos: ${referenceNames.join(', ')}. They are kept out of normal prompt context and only used when explicitly inspected.`
          : 'No local reference repos are configured.',
        action: 'Summarizing reference repositories',
        source: 'local_inventory',
      };
    }

    if (/\bapps?\b/.test(normalized) && !/\bpackages?\b/.test(normalized)) {
      return {
        content: appNames.length > 0 ? `Apps: ${appNames.join(', ')}.` : 'No app packages were detected.',
        action: 'Summarizing workspace apps',
        source: 'local_inventory',
      };
    }

    if (/\bpackages?\b/.test(normalized) && !/\bapps?\b/.test(normalized)) {
      return {
        content: packageNames.length > 0 ? `Main packages: ${packageNames.join(', ')}.` : 'No workspace packages were detected.',
        action: 'Summarizing workspace packages',
        source: 'local_inventory',
      };
    }

    const summaryParts = [
      inventory.rootPackageName ? `Root package: ${inventory.rootPackageName}.` : null,
      inventory.workspaceGlobs.length > 0 ? `Workspaces: ${inventory.workspaceGlobs.join(', ')}.` : null,
      appNames.length > 0 ? `Apps: ${appNames.join(', ')}.` : null,
      packageNames.length > 0 ? `Packages: ${packageNames.join(', ')}.` : null,
      referenceNames.length > 0 ? `Reference repos on disk: ${referenceNames.join(', ')}.` : null,
    ].filter((entry): entry is string => Boolean(entry));

    return {
      content: summaryParts.length > 0
        ? summaryParts.join(' ')
        : `Top-level areas: ${inventory.topLevelAreas.join(', ') || 'none detected'}.`,
      action: 'Summarizing workspace inventory',
      source: 'local_inventory',
    };
  }

  private async tryAnswerFromRootManifest(latestUserMessage: string): Promise<ImmediateChatAnswer | null> {
    const normalized = latestUserMessage.toLowerCase();
    const writeIntent = /\b(create|write|add|update|modify|change|edit|fix|implement|generate|save|insert|replace|append|remove|delete)\b/.test(normalized);
    const asksAboutManifest =
      /package\.json/.test(normalized) ||
      /\b(project|package)\s+name\b/.test(normalized) ||
      /\broot package\b/.test(normalized) ||
      /\b(npm|package)\s+scripts?\b/.test(normalized);

    if (!asksAboutManifest || writeIntent) {
      return null;
    }

    try {
      const manifestPath = path.join(this.config.workspaceRoot, 'package.json');
      const raw = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as { name?: unknown; scripts?: unknown };
      const name = typeof manifest.name === 'string' && manifest.name.trim()
        ? manifest.name.trim()
        : null;
      const scripts = manifest.scripts && typeof manifest.scripts === 'object' && !Array.isArray(manifest.scripts)
        ? Object.entries(manifest.scripts)
            .filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
            .map(([scriptName, command]) => [scriptName.trim(), command.trim()] as [string, string])
            .filter(([scriptName, command]) => scriptName.length > 0 && command.length > 0)
        : [];

      if (!name && scripts.length === 0) {
        return null;
      }

      const wantsScripts =
        /\b(npm|package)\s+scripts?\b/.test(normalized) ||
        (/package\.json/.test(normalized) && /\bscripts?\b/.test(normalized));
      const wantsName =
        /\b(name field|project name|package name|root package)\b/.test(normalized) ||
        (/package\.json/.test(normalized) && !wantsScripts);
      const exactNameOnly = wantsName && !wantsScripts && /\b(exactly|just|only)\b/.test(normalized);

      if (exactNameOnly && name) {
        return {
          content: name,
          action: 'Reading root package manifest',
          source: 'root_manifest',
        };
      }

      if (wantsName && wantsScripts) {
        return {
          content: [
            name ? `name: ${name}` : null,
            scripts.length > 0
              ? `scripts:\n${scripts.map(([scriptName, command]) => `- ${scriptName}: ${command}`).join('\n')}`
              : 'scripts: none',
          ].filter(Boolean).join('\n'),
          action: 'Reading root package manifest',
          source: 'root_manifest',
        };
      }

      if (wantsScripts) {
        return {
          content: scripts.length > 0
            ? scripts.map(([scriptName, command]) => `${scriptName}: ${command}`).join('\n')
            : 'No scripts found in root package.json.',
          action: 'Reading root package manifest',
          source: 'root_manifest',
        };
      }

      if (name) {
        return {
          content: name,
          action: 'Reading root package manifest',
          source: 'root_manifest',
        };
      }
    } catch {
      return null;
    }

    return null;
  }

  private selectToolNames(latestUserMessage: string, promptMode: RunMode): SupportedTool[] {
    if (!this.isWorkspaceQuestion(latestUserMessage, promptMode)) {
      return [];
    }

    if (this.isStatusOnlyWorkspaceQuestion(latestUserMessage)) {
      return [];
    }

    const normalized = latestUserMessage.toLowerCase();
    const selected = new Set<SupportedTool>(['readFile', 'listDir']);

    if (/\b(find|glob|list files|which file|where is|files named|pattern|search)\b/.test(normalized)) {
      selected.add('glob');
    }

    if (/\b(find|grep|search|symbol|string|text|where is|references)\b/.test(normalized)) {
      selected.add('searchText');
    }

    if (this.shouldIncludeWriteTools(latestUserMessage, promptMode)) {
      selected.add('writeFile');
      selected.add('patchFile');
      selected.add('makeDir');
      selected.add('deleteFile');
      selected.add('searchText');
    }

    if (this.shouldIncludeGitTools(latestUserMessage, promptMode)) {
      selected.add('gitStatus');
      selected.add('gitDiff');
    }

    if (this.shouldIncludeCommandTool(latestUserMessage)) {
      selected.add('runCommand');
    }

    return SUPPORTED_TOOLS.filter((toolName) => selected.has(toolName));
  }

  private selectMaxTokens(latestUserMessage: string, promptMode: RunMode, usingTools: boolean): number {
    const normalized = latestUserMessage.toLowerCase();
    const terseReplyRequested =
      /\b(exactly|just|only|one line|single sentence|yes or no)\b/.test(normalized) ||
      latestUserMessage.trim().split(/\s+/).filter(Boolean).length <= 10;
    if (terseReplyRequested) {
      return 128;
    }

    switch (promptMode) {
      case 'quick_inspect':
        return usingTools ? 320 : 192;
      case 'code_review':
        return usingTools ? 512 : 320;
      case 'targeted_edit':
        return usingTools ? 640 : 384;
      case 'doc_generation':
        return usingTools ? 768 : 512;
      default:
        return usingTools ? 512 : 256;
    }
  }

  private selectReasoningEffort(
    latestUserMessage: string,
    promptMode: RunMode,
    modelCapabilities: string[] | null,
  ): ReasoningEffort | undefined {
    if (!Array.isArray(modelCapabilities) || !modelCapabilities.includes('thinking')) {
      return undefined;
    }

    const normalized = latestUserMessage.toLowerCase();
    const terseReplyRequested =
      /\b(exactly|just|only|one line|single sentence|yes or no)\b/.test(normalized) ||
      latestUserMessage.trim().split(/\s+/).filter(Boolean).length <= 10;

    switch (promptMode) {
      case 'quick_inspect':
        return 'none';
      case 'targeted_edit':
      case 'doc_generation':
        return 'low';
      case 'code_review':
        return 'medium';
      default:
        return terseReplyRequested ? 'none' : 'low';
    }
  }

  private buildManualToolProtocol(toolNames: SupportedTool[]): string {
    const examples: Record<SupportedTool, string> = {
      glob: '{"action":"glob","args":{"pattern":"src/**/*.ts"}}',
      readFile: '{"action":"readFile","args":{"filePath":"src/index.ts"}}',
      searchText: '{"action":"searchText","args":{"query":"TODO","filePattern":"src/**/*.ts"}}',
      listDir: '{"action":"listDir","args":{"dirPath":"src"}}',
      writeFile: '{"action":"writeFile","args":{"filePath":"README.md","content":"# Title\\n"}}',
      patchFile: '{"action":"patchFile","args":{"filePath":"src/index.ts","oldContent":"before","newContent":"after"}}',
      makeDir: '{"action":"makeDir","args":{"dirPath":"src/new-folder"}}',
      deleteFile: '{"action":"deleteFile","args":{"filePath":"old.txt"}}',
      runCommand: '{"action":"runCommand","args":{"command":"npm test"}}',
      gitStatus: '{"action":"gitStatus","args":{}}',
      gitDiff: '{"action":"gitDiff","args":{}}',
    };

    return RECIPES.manualToolProtocol(toolNames.map((toolName) => examples[toolName]));
  }

  private formatManualToolResult(toolName: SupportedTool, output: string): string {
    return [
      '[Tool Result]',
      `Action: ${toolName}`,
      'Output:',
      output,
      'Reply with exactly one JSON object: either another {"action":"...","args":{...}} or {"final":"..."}',
    ].join('\n');
  }

  private parseManualToolResponse(content: string, toolNames: SupportedTool[]): ManualToolDecision | null {
    const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const withoutFences = withoutThinking
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const tryParse = (value: string): Record<string, unknown> | null => {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
      } catch {
        return null;
      }
    };

    let parsed = tryParse(withoutFences);
    if (!parsed) {
      const start = withoutFences.indexOf('{');
      const end = withoutFences.lastIndexOf('}');
      if (start !== -1 && end > start) {
        parsed = tryParse(withoutFences.slice(start, end + 1));
      }
    }

    if (!parsed) {
      return null;
    }

    const finalAnswer = ['final', 'answer', 'response']
      .map((key) => parsed?.[key])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (finalAnswer) {
      return { kind: 'final', content: finalAnswer.trim() };
    }

    const actionName = ['action', 'tool', 'name']
      .map((key) => parsed?.[key])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (!actionName || !toolNames.includes(actionName as SupportedTool)) {
      return null;
    }

    const argsCandidate = parsed.args ?? parsed.arguments;
    const args = argsCandidate && typeof argsCandidate === 'object' && !Array.isArray(argsCandidate)
      ? argsCandidate as Record<string, unknown>
      : {};
    return { kind: 'tool', name: actionName as SupportedTool, args };
  }

  private async inferManualBootstrapTool(
    latestUserMessage: string,
    promptMode: RunMode,
    toolNames: SupportedTool[],
  ): Promise<{ kind: 'tool'; name: SupportedTool; args: Record<string, unknown> } | null> {
    if (!toolNames.includes('readFile')) {
      return null;
    }

    const normalized = latestUserMessage.toLowerCase();
    const tryReadFile = async (filePath: string): Promise<{ kind: 'tool'; name: SupportedTool; args: Record<string, unknown> } | null> => {
      try {
        await fs.access(path.join(this.config.workspaceRoot, filePath));
        return { kind: 'tool', name: 'readFile', args: { filePath } };
      } catch {
        return null;
      }
    };

    if (
      /\b(project|package)\s+name\b/.test(normalized) ||
      /\b(start|main)\s+(command|file|server file)\b/.test(normalized) ||
      /\b(npm|package)\s+scripts?\b/.test(normalized) ||
      /\b(readme|repo|repository)\b/.test(normalized) ||
      /package\.json/.test(normalized)
    ) {
      const manifestDecision = await tryReadFile('package.json');
      if (manifestDecision) {
        return manifestDecision;
      }
    }

    if (/server\.js/.test(normalized) || /\bmain server file\b/.test(normalized)) {
      const serverDecision = await tryReadFile('server.js');
      if (serverDecision) {
        return serverDecision;
      }
    }

    if (promptMode === 'targeted_edit' && toolNames.includes('listDir')) {
      return { kind: 'tool', name: 'listDir', args: { dirPath: '.' } };
    }

    return null;
  }

  private choosePromptMode(messages: ChatMessage[]): RunMode {
    const latestUserMessage = this.getLatestUserMessage(messages).toLowerCase();

    if (/\b(review|diff|regression|bug|security)\b/.test(latestUserMessage)) {
      return 'code_review';
    }

    if (/\b(create|add|edit|change|write|patch|fix|update|implement|refactor|delete|remove)\b/.test(latestUserMessage)) {
      return 'targeted_edit';
    }

    if (/\b(readme|docs?|document|guide|explain|summarize|overview)\b/.test(latestUserMessage)) {
      return 'doc_generation';
    }

    return 'quick_inspect';
  }

  private applyPromptOptimization(
    messages: ChatMessage[],
    promptMode = this.choosePromptMode(messages),
    includeOptimizationPrompt = true,
  ): ChatMessage[] {
    if (!includeOptimizationPrompt) {
      return messages;
    }

    const latestUserMessage = this.getLatestUserMessage(messages);
    if (!latestUserMessage) {
      return messages;
    }

    const totalContextLength = messages.reduce((sum, message) => sum + message.content.length, 0);
    const optimizer = new PromptOptimizer(promptMode);
    const optimizationPrompt = optimizer.optimizeForTask(latestUserMessage, totalContextLength);

    this.traceBus.emitEvent({
      type: 'prompt_recipe_selected',
      data: {
        mode: promptMode,
        taskPreview: latestUserMessage.slice(0, 120),
      },
    });

    return [
      {
        role: 'system',
        content: `Prompt recipe (${promptMode}):\n${optimizationPrompt}`,
      },
      ...messages,
    ];
  }

  private async buildContextMessages(
    chatMessages: ChatMessage[],
    promptMode = this.choosePromptMode(chatMessages),
    includeWorkspaceContext = this.isWorkspaceQuestion(this.getLatestUserMessage(chatMessages), promptMode),
    includeRepoContext = this.shouldIncludeRepoContext(this.getLatestUserMessage(chatMessages), promptMode),
  ): Promise<ChatMessage[]> {
    if (!includeWorkspaceContext) {
      return [];
    }

    const workspaceNotice = this.workspaceChangedNotice;
    if (workspaceNotice) {
      this.workspaceChangedNotice = null;
    }

    const contextMessages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          '[Workspace Context]',
          `Workspace root: ${this.config.workspaceRoot}`,
          `Session cwd: ${this.currentSession?.cwd || this.config.workspaceRoot}`,
          `Mode: ${this.config.mode}`,
          `Configured model: ${this.config.model}`,
          'If the user asks which folder is open, answer from the workspace root or session cwd above.',
          'All tool paths are relative to the workspace root unless absolute.',
          workspaceNotice ? `\n${workspaceNotice}` : '',
        ].filter(Boolean).join('\n'),
      },
    ];

    if (includeRepoContext) {
      try {
        const repoContext = await this.getRepoContextPrompt();
        contextMessages.push({ role: 'system', content: repoContext });
      } catch (error: any) {
        this.traceBus.emitEvent({
          type: 'repo_context_failed',
          data: {
            message: error?.message || String(error),
          },
        });
      }
    }

    return contextMessages;
  }

  private static readonly WORKSPACE_MUTATING_TOOLS: ReadonlySet<string> = new Set([
    'writeFile', 'patchFile', 'makeDir', 'deleteFile',
  ]);

  private async executeToolCall(toolName: SupportedTool, args: Record<string, unknown>): Promise<any> {
    let result: any;
    switch (toolName) {
      case 'readFile':
        result = await this.readFile(getRequiredStringArg(args, 'filePath', toolName));
        break;
      case 'listDir':
        result = await this.listDir(getOptionalStringArg(args, 'dirPath') || '.');
        break;
      case 'glob':
        result = await this.glob(getRequiredStringArg(args, 'pattern', toolName));
        break;
      case 'searchText':
        result = await this.searchText(
          getRequiredStringArg(args, 'query', toolName),
          getOptionalStringArg(args, 'filePattern'),
        );
        break;
      case 'writeFile':
        result = await this.writeFile(
          getRequiredStringArg(args, 'filePath', toolName),
          getRequiredStringArg(args, 'content', toolName),
        );
        break;
      case 'patchFile':
        result = await this.patchFile(
          getRequiredStringArg(args, 'filePath', toolName),
          getRequiredStringArg(args, 'oldContent', toolName),
          getRequiredStringArg(args, 'newContent', toolName),
        );
        break;
      case 'makeDir':
        result = await this.makeDir(getRequiredStringArg(args, 'dirPath', toolName));
        break;
      case 'deleteFile':
        result = await this.deleteFile(getRequiredStringArg(args, 'filePath', toolName));
        break;
      case 'gitStatus':
        result = await this.gitStatus();
        break;
      case 'gitDiff':
        result = await this.gitDiff();
        break;
      case 'runCommand':
        result = await this.runCommand(getRequiredStringArg(args, 'command', toolName));
        break;
      default:
        throw new Error(`Tool ${toolName} is not supported.`);
    }

    // Invalidate repo context cache after workspace-modifying tools so next turn gets fresh context
    if (CoreEngine.WORKSPACE_MUTATING_TOOLS.has(toolName)) {
      this.invalidateRepoContextCache();
    }

    return result;
  }

  private getToolDefinitions(toolNames: SupportedTool[] = [...SUPPORTED_TOOLS]): any[] {
    return [
      {
        type: 'function',
        function: {
          name: 'readFile',
          description: 'Read the contents of a file',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file to read' }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'listDir',
          description: 'List the contents of a directory',
          parameters: {
            type: 'object',
            properties: {
              dirPath: { type: 'string', description: 'The directory path (defaults to .)' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'glob',
          description: 'Find files matching a glob pattern',
          parameters: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'The glob pattern (e.g. src/**/*.ts)' }
            },
            required: ['pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'searchText',
          description: 'Search for a string in the workspace',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The text to search for' },
              filePattern: { type: 'string', description: 'Optional glob pattern to limit search' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'writeFile',
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file' },
              content: { type: 'string', description: 'The full content for the file' }
            },
            required: ['filePath', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'patchFile',
          description: 'Replace a block of text in a file',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file' },
              oldContent: { type: 'string', description: 'The exact block of text to replace' },
              newContent: { type: 'string', description: 'The replacement text' }
            },
            required: ['filePath', 'oldContent', 'newContent']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'makeDir',
          description: 'Create a directory',
          parameters: {
            type: 'object',
            properties: {
              dirPath: { type: 'string', description: 'The directory path to create' }
            },
            required: ['dirPath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'deleteFile',
          description: 'Delete a file or directory',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to delete' }
            },
            required: ['filePath']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gitStatus',
          description: 'Get the git status of the workspace',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'gitDiff',
          description: 'Get the current git diff',
          parameters: { type: 'object', properties: {} }
        }
      },
      {
        type: 'function',
        function: {
          name: 'runCommand',
          description: 'Run a shell command',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'The shell command to execute' }
            },
            required: ['command']
          }
        }
      }
    ].filter((definition) => toolNames.includes(definition.function.name as SupportedTool));
  }

  emitTrace(type: string, data: unknown) {
    this.traceBus.emitEvent({ type, data });
  }

  async isHealthy(): Promise<boolean> {
    return this.modelAdapter.isHealthy();
  }

  async listModels(): Promise<any[]> {
    return this.modelAdapter.listModels();
  }

  async indexWorkspace(): Promise<ProjectContext> {
    this.planner.setPhase('indexing');
    this.planner.setIntendedAction('Scanning workspace structure');
    const { context, cached } = await this.repoIndexer.buildContext();
    this.traceBus.emitEvent({
      type: 'repo_context_loaded',
      data: {
        cached,
        fileCount: context.files.length,
        entryPoints: context.entryPoints,
      },
    });
    this.planner.setPhase('ready');
    this.planner.setIntendedAction('Awaiting user input');
    return context;
  }

  /** Invalidate repo indexer cache after workspace-modifying tool actions. */
  private invalidateRepoContextCache() {
    this.repoIndexer.clearCaches();
  }

  async getRepoContextPrompt(): Promise<string> {
    const context = await this.indexWorkspace();
    return this.repoIndexer.generatePromptInjection(context);
  }

  async chat(messages: ChatMessage[], options?: { signal?: AbortSignal; think?: boolean }): Promise<string> {
    return this.runChat(messages, undefined, options);
  }

  async chatStream(messages: ChatMessage[], handlers: ChatStreamHandlers, options?: { signal?: AbortSignal; think?: boolean }): Promise<string> {
    return this.runChat(messages, handlers, options);
  }

  async directChatStream(messages: ChatMessage[], handlers: ChatStreamHandlers, options?: { signal?: AbortSignal; think?: boolean }): Promise<string> {
    await this.recordTurnExecution('direct', {
      promptMode: 'general',
      messageCount: messages.length,
      thinkingEnabled: options?.think === true,
    });
    this.emitChatStatus(handlers, 'mode', 'Direct chat mode', 0);
    this.emitChatStatus(handlers, 'model', 'Generating assistant response', 0);

    const message = await this.streamAssistantMessage(
      messages,
      handlers,
      undefined, // tools
      4096, // maxTokens
      undefined, // reasoningEffort
      options?.signal,
      options?.think
    );
    return extractTextSegment(message?.content) || '';
  }

  private emitChatStatus(handlers: ChatStreamHandlers | undefined, phase: string, action: string, loop: number) {
    handlers?.onStatus?.({ phase, action, loop });
  }

  private emitChatToolEvent(
    handlers: ChatStreamHandlers | undefined,
    event: ChatToolEvent,
  ) {
    handlers?.onTool?.(event);
  }

  private completeImmediateResponse(
    handlers: ChatStreamHandlers | undefined,
    answer: ImmediateChatAnswer,
  ) {
    this.planner.setPhase('inspection');
    this.planner.setIntendedAction(answer.action);
    this.emitChatStatus(handlers, 'inspection', answer.action, 0);
    this.planner.setPhase('ready');
    this.planner.setIntendedAction('Awaiting user input');
    this.emitChatStatus(handlers, 'ready', 'Awaiting user input', 0);
    this.traceBus.emitEvent({
      type: 'chat_response',
      data: { length: answer.content.length, source: answer.source },
    });
  }

  private async streamAssistantMessage(
    currentMessages: any[],
    handlers: ChatStreamHandlers,
    tools: any[] | undefined,
    maxTokens: number,
    reasoningEffort: ReasoningEffort | undefined,
    signal?: AbortSignal,
    think?: boolean,
  ): Promise<any> {
    const stream = await this.modelAdapter.createChatCompletion({
      messages: currentMessages,
      stream: true,
      tools,
      max_tokens: maxTokens,
      reasoning_effort: reasoningEffort,
      think,
      signal,
    }) as ReadableStream<Uint8Array> | null;

    if (!stream || typeof (stream as ReadableStream<Uint8Array>).getReader !== 'function') {
      const result = await this.modelAdapter.createChatCompletion({
        messages: currentMessages,
        stream: false,
        tools,
        max_tokens: maxTokens,
        reasoning_effort: reasoningEffort,
        think,
        signal,
      });
      const message = result?.choices?.[0]?.message;
      if (!message) {
        return null;
      }
      return {
        ...message,
        content: composeAssistantContent(message as Record<string, unknown>),
      };
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let thinkingOpen = false;
    const message: any = {
      role: 'assistant',
      content: '',
      tool_calls: [],
    };

    const appendContent = (chunk: string) => {
      if (!chunk) {
        return;
      }
      message.content += chunk;
      handlers.onDelta?.(chunk);
    };

    const ensureThinkingOpen = () => {
      if (!thinkingOpen) {
        appendContent('<think>');
        thinkingOpen = true;
      }
    };

    const closeThinking = () => {
      if (thinkingOpen) {
        appendContent('</think>');
        thinkingOpen = false;
      }
    };

    const processPayload = (payload: any) => {
      const choice = payload?.choices?.[0];
      if (!choice) {
        return;
      }

      const delta = (choice.delta ?? choice.message ?? {}) as Record<string, unknown>;
      if (typeof delta.role === 'string') {
        message.role = delta.role;
      }

      const reasoningChunk = extractReasoningSegment(delta);
      if (reasoningChunk) {
        ensureThinkingOpen();
        appendContent(reasoningChunk);
      }

      const contentChunk = extractTextSegment(delta.content);
      if (contentChunk) {
        closeThinking();
        appendContent(contentChunk);
      }

      if (Array.isArray((delta as { tool_calls?: unknown }).tool_calls)) {
        closeThinking();
        appendToolCallDeltas(message.tool_calls, (delta as { tool_calls: any[] }).tool_calls);
      }

      if (choice.finish_reason) {
        closeThinking();
      }
    };

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }

      const data = trimmed.startsWith('data:') ? trimmed.slice(5).trim() : trimmed;
      if (!data || data === '[DONE]') {
        return;
      }

      const payload = JSON.parse(data);
      processPayload(payload);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          processLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        processLine(buffer);
      }
    } finally {
      closeThinking();
      reader.releaseLock();
    }

    if (!message.tool_calls.length) {
      delete message.tool_calls;
    }

    return message;
  }

  private async runChat(
    messages: ChatMessage[],
    streamHandlers?: ChatStreamHandlers,
    options?: { signal?: AbortSignal; think?: boolean },
  ): Promise<string> {
    if (!this.currentSession) {
      this.startSession();
    }

    const latestUserMessage = this.getLatestUserMessage(messages);
    const browserFolderContextActive = this.hasBrowserFolderContext(messages);
    const promptMode = this.choosePromptMode(messages);

    await this.recordTurnExecution('agentic', {
      promptMode,
      messageCount: messages.length,
      thinkingEnabled: options?.think === true,
    });
    this.emitChatStatus(streamHandlers, 'mode', 'Agentic coding mode', 0);

    if (!browserFolderContextActive && this.isStatusOnlyWorkspaceQuestion(latestUserMessage)) {
      const localAnswer = await this.tryAnswerFromLocalState(latestUserMessage);
      if (localAnswer !== null) {
        this.completeImmediateResponse(streamHandlers, localAnswer);
        await this.persistCurrentSession();
        return localAnswer.content;
      }
    }

    const directWorkspaceAnswer = !browserFolderContextActive
      ? await this.tryAnswerFromDirectWorkspaceTools(latestUserMessage)
      : null;
    if (directWorkspaceAnswer !== null) {
      this.completeImmediateResponse(streamHandlers, directWorkspaceAnswer);
      await this.persistCurrentSession();
      return directWorkspaceAnswer.content;
    }

    const includeWorkspaceContext = !browserFolderContextActive && this.isWorkspaceQuestion(latestUserMessage, promptMode);
    const includeRepoContext = !browserFolderContextActive && this.shouldIncludeRepoContext(latestUserMessage, promptMode);
    const selectedToolNames = browserFolderContextActive ? [] : this.selectToolNames(latestUserMessage, promptMode);
    const modelCapabilities = await this.modelAdapter.getModelCapabilities(this.config.model);
    const toolProtocol = this.selectToolProtocol(selectedToolNames, modelCapabilities);
    const rootManifestAnswer = !browserFolderContextActive
      ? await this.tryAnswerFromRootManifest(latestUserMessage)
      : null;
    if (rootManifestAnswer !== null) {
      this.completeImmediateResponse(streamHandlers, rootManifestAnswer);
      await this.persistCurrentSession();
      return rootManifestAnswer.content;
    }
    const localRepoOverview = !browserFolderContextActive
      ? await this.tryAnswerFromLocalRepoOverview(latestUserMessage)
      : null;
    if (localRepoOverview !== null) {
      this.completeImmediateResponse(streamHandlers, localRepoOverview);
      await this.persistCurrentSession();
      return localRepoOverview.content;
    }

    let manualToolProtocol = toolProtocol.manualToolProtocol;
    let manualProtocolPromptInjected = manualToolProtocol;
    let nativeToolDefinitions = selectedToolNames.length > 0 && !manualToolProtocol
      ? this.getToolDefinitions(selectedToolNames)
      : undefined;
    const maxTokens = manualToolProtocol
      ? Math.min(256, this.selectMaxTokens(latestUserMessage, promptMode, selectedToolNames.length > 0))
      : this.selectMaxTokens(latestUserMessage, promptMode, selectedToolNames.length > 0);
    const reasoningEffort = manualToolProtocol
      ? 'none'
      : this.selectReasoningEffort(latestUserMessage, promptMode, modelCapabilities);

    if (toolProtocol.mode === 'manual_fallback') {
      this.traceBus.emitEvent({
        type: 'manual_tool_fallback',
        data: {
          model: this.config.model,
          reason: toolProtocol.reason,
          manualToolProtocol: true,
          selectedTools: selectedToolNames,
        },
      });
      this.emitChatStatus(streamHandlers, 'warning', 'Native tools unavailable; manual fallback active', 0);
    } else if (toolProtocol.mode === 'manual_preferred') {
      this.traceBus.emitEvent({
        type: 'manual_tool_strategy_selected',
        data: {
          model: this.config.model,
          reason: toolProtocol.reason,
          manualToolProtocol: true,
          selectedTools: selectedToolNames,
        },
      });
      this.emitChatStatus(streamHandlers, 'mode', 'Low-latency manual tool protocol active', 0);
    }

    if (options?.think === true && !this.supportsThinking(modelCapabilities)) {
      this.traceBus.emitEvent({
        type: 'thinking_unsupported',
        data: {
          model: this.config.model,
          reason: 'Current model does not report thinking capability.',
          requestedThink: true,
          modelCapabilities: modelCapabilities ?? [],
        },
      });
      this.emitChatStatus(streamHandlers, 'warning', 'Thinking unavailable on current model', 0);
    }

    this.traceBus.emitEvent({
      type: 'chat_execution_plan',
      data: {
        executionMode: 'agentic',
        promptMode,
        toolNames: selectedToolNames,
        nativeTools: Boolean(nativeToolDefinitions),
        manualToolProtocol,
        toolProtocolMode: toolProtocol.mode,
        includeRepoContext,
        browserFolderContextActive,
        maxTokens,
        reasoningEffort,
        modelCapabilities: modelCapabilities ?? [],
      },
    });

    if (manualToolProtocol) {
      this.traceBus.emitEvent({
        type: 'prompt_recipe_selected',
        data: {
          mode: promptMode,
          taskPreview: latestUserMessage.slice(0, 120),
          manualToolProtocol: true,
          recipe: 'manual_tool_plan',
        },
      });
    }

    const promptMessages = manualToolProtocol
      ? [
          {
            role: 'system' as const,
            content: [
              `Manual tool plan (${promptMode}):`,
              'Inspect only the minimum files needed before editing.',
              'Use exactly one JSON tool action at a time, then wait for the next tool result.',
              'When the task is complete, reply with {"final":"..."} and keep it brief.',
            ].join('\n'),
          },
          ...messages,
        ]
      : this.applyPromptOptimization(
          messages,
          promptMode,
          includeRepoContext || promptMode !== 'quick_inspect' || (selectedToolNames.length > 0 && !manualToolProtocol),
        );

    const currentMessages: any[] = [
      ...(await this.buildContextMessages(messages, promptMode, includeWorkspaceContext, includeRepoContext)),
      ...(manualToolProtocol ? [{ role: 'system', content: this.buildManualToolProtocol(selectedToolNames) }] : []),
      ...promptMessages,
    ];
    let streamedToolEventCounter = 0;
    const nextStreamToolEventId = () => `tool-${++streamedToolEventCounter}`;
    let manualBootstrapTool = manualToolProtocol
      ? await this.inferManualBootstrapTool(latestUserMessage, promptMode, selectedToolNames)
      : null;
    let loopCount = 0;
    const MAX_LOOPS = 10;
    let manualProtocolCorrectionCount = 0;
    let simulatedToolReplyCount = 0;

    while (loopCount < MAX_LOOPS) {
      if (manualToolProtocol && manualBootstrapTool) {
        const bootstrapDecision = manualBootstrapTool;
        manualBootstrapTool = null;
        loopCount += 1;
        this.planner.setPhase('execution');
        this.planner.setIntendedAction(`Executing ${bootstrapDecision.name}`);
        this.emitChatStatus(streamHandlers, 'execution', `Executing ${bootstrapDecision.name}`, loopCount);
        this.traceBus.emitEvent({
          type: 'manual_tool_bootstrap_selected',
          data: {
            model: this.config.model,
            promptMode,
            action: bootstrapDecision.name,
            args: bootstrapDecision.args,
          },
        });

        const toolEventId = nextStreamToolEventId();
        this.emitChatToolEvent(streamHandlers, {
          id: toolEventId,
          name: bootstrapDecision.name,
          state: 'start',
          inputSummary: summarizeToolArgs(bootstrapDecision.name, bootstrapDecision.args),
        });
        try {
          const toolResult = await this.executeToolCall(bootstrapDecision.name, bootstrapDecision.args);
          const streamedOutput = toolResult.preview
            ? `${toolResult.output}\n\n${toolResult.preview}`
            : toolResult.output;
          this.emitChatToolEvent(streamHandlers, {
            id: toolEventId,
            name: bootstrapDecision.name,
            state: 'done',
            inputSummary: summarizeToolArgs(bootstrapDecision.name, bootstrapDecision.args),
            output: truncateStreamPreview(streamedOutput),
            success: toolResult.success,
          });
          currentMessages.push({
            role: 'user',
            content: this.formatManualToolResult(bootstrapDecision.name, toolResult.output),
          });
        } catch (error: any) {
          this.emitChatToolEvent(streamHandlers, {
            id: toolEventId,
            name: bootstrapDecision.name,
            state: 'done',
            inputSummary: summarizeToolArgs(bootstrapDecision.name, bootstrapDecision.args),
            output: truncateStreamPreview(`Error: ${error.message}`),
            success: false,
          });
          currentMessages.push({
            role: 'user',
            content: this.formatManualToolResult(bootstrapDecision.name, `Error: ${error.message}`),
          });
        }
        continue;
      }

      this.planner.setPhase('model');
      this.planner.setIntendedAction(loopCount === 0 ? 'Generating assistant response' : 'Processing tool results');
      this.emitChatStatus(
        streamHandlers,
        'model',
        loopCount === 0 ? 'Generating assistant response' : 'Processing tool results',
        loopCount,
      );
      this.traceBus.emitEvent({
        type: 'chat_request',
        data: {
          messageCount: currentMessages.length,
          loop: loopCount,
          profile: this.config.profile,
        },
      });

      let result: any;
      let message: any;
      try {
        if (streamHandlers) {
          message = await this.streamAssistantMessage(
            currentMessages,
            streamHandlers,
            nativeToolDefinitions,
            maxTokens,
            reasoningEffort,
            options?.signal,
            options?.think,
          );
        } else {
          result = await this.modelAdapter.createChatCompletion({
            messages: currentMessages,
            stream: false,
            tools: nativeToolDefinitions,
            max_tokens: maxTokens,
            reasoning_effort: reasoningEffort,
            think: options?.think,
            signal: options?.signal,
          });
          message = result?.choices?.[0]?.message;
        }
      } catch (error: any) {
        const errorMessage = error?.message || '';
        // If the model does not support tools, retry without them
        if (errorMessage.includes('does not support tools') || errorMessage.includes('tools is not supported')) {
          nativeToolDefinitions = undefined;
          manualToolProtocol = selectedToolNames.length > 0;
          this.traceBus.emitEvent({
            type: 'tools_unsupported',
            data: { model: this.config.model, reason: errorMessage },
          });
          this.traceBus.emitEvent({
            type: 'manual_tool_fallback',
            data: {
              model: this.config.model,
              reason: errorMessage,
              manualToolProtocol: manualToolProtocol,
              selectedTools: selectedToolNames,
            },
          });
          this.emitChatStatus(streamHandlers, 'warning', 'Native tools unavailable; manual fallback active', loopCount);
          if (manualToolProtocol && !manualProtocolPromptInjected) {
            currentMessages.push({
              role: 'system',
              content: this.buildManualToolProtocol(selectedToolNames),
            });
            manualProtocolPromptInjected = true;
          }
          if (streamHandlers) {
            message = await this.streamAssistantMessage(
              currentMessages,
              streamHandlers,
              undefined,
              maxTokens,
              reasoningEffort,
              options?.signal,
              options?.think,
            );
          } else {
            result = await this.modelAdapter.createChatCompletion({
              messages: currentMessages,
              stream: false,
              max_tokens: maxTokens,
              reasoning_effort: reasoningEffort,
              think: options?.think,
              signal: options?.signal,
            });
            message = result?.choices?.[0]?.message;
          }
        } else {
          throw error;
        }
      }

      if (!message) {
        break;
      }

      message.content = composeAssistantContent(message as Record<string, unknown>);

      currentMessages.push(message);

      if (nativeToolDefinitions && message.tool_calls && message.tool_calls.length > 0) {
        loopCount += 1;
        this.planner.setPhase('execution');
        this.emitChatStatus(streamHandlers, 'execution', 'Executing tool calls', loopCount);

        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name as SupportedTool;
          const toolEventId = nextStreamToolEventId();
          let args: Record<string, unknown> = {};
          try {
            args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          } catch (error: any) {
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name,
              state: 'done',
              inputSummary: truncateStreamPreview(toolCall.function.arguments || '{}'),
              output: truncateStreamPreview(`Error: Invalid tool arguments - ${error.message}`),
              success: false,
            });
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name,
              content: `Error: Invalid tool arguments - ${error.message}`,
            });
            continue;
          }
          this.planner.setIntendedAction(`Executing ${name}`);
          this.emitChatStatus(streamHandlers, 'execution', `Executing ${name}`, loopCount);
          this.emitChatToolEvent(streamHandlers, {
            id: toolEventId,
            name,
            state: 'start',
            inputSummary: summarizeToolArgs(name, args),
          });

          try {
            const toolResult = await this.executeToolCall(name, args);
            const streamedOutput = toolResult.preview
              ? `${toolResult.output}\n\n${toolResult.preview}`
              : toolResult.output;
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name,
              state: 'done',
              inputSummary: summarizeToolArgs(name, args),
              output: truncateStreamPreview(streamedOutput),
              success: toolResult.success,
            });
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name,
              content: toolResult.output,
            });
          } catch (error: any) {
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name,
              state: 'done',
              inputSummary: summarizeToolArgs(name, args),
              output: truncateStreamPreview(`Error: ${error.message}`),
              success: false,
            });
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name,
              content: `Error: ${error.message}`,
            });
          }
        }
        continue;
      }

      const response = extractTextSegment(message.content);
      if (manualToolProtocol) {
        if (looksLikeSimulatedToolCall(response)) {
          simulatedToolReplyCount += 1;
          this.traceBus.emitEvent({
            type: 'tool_simulation_detected',
            data: {
              model: this.config.model,
              attempt: simulatedToolReplyCount,
              preview: response.slice(0, 240),
              manualToolProtocol: true,
            },
          });

          if (simulatedToolReplyCount < 2) {
            currentMessages.push({
              role: 'system',
              content: RECIPES.manualToolCorrection(),
            });
            loopCount += 1;
            continue;
          }

          const warning = 'Model attempted to simulate tool usage in plain text. No tools were executed.';
          this.planner.setPhase('ready');
          this.planner.setIntendedAction('Awaiting user input');
          this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
          this.traceBus.emitEvent({
            type: 'chat_response',
            data: { length: warning.length, simulatedTools: true, manualToolProtocol: true },
          });
          await this.persistCurrentSession();
          return `${warning} Retry the request or switch models.`;
        }

        const manualDecision = this.parseManualToolResponse(response, selectedToolNames);
        if (manualDecision?.kind === 'tool') {
          loopCount += 1;
          this.planner.setPhase('execution');
          this.planner.setIntendedAction(`Executing ${manualDecision.name}`);
          this.emitChatStatus(streamHandlers, 'execution', `Executing ${manualDecision.name}`, loopCount);

          const toolEventId = nextStreamToolEventId();
          this.emitChatToolEvent(streamHandlers, {
            id: toolEventId,
            name: manualDecision.name,
            state: 'start',
            inputSummary: summarizeToolArgs(manualDecision.name, manualDecision.args),
          });
          try {
            const toolResult = await this.executeToolCall(manualDecision.name, manualDecision.args);
            const streamedOutput = toolResult.preview
              ? `${toolResult.output}\n\n${toolResult.preview}`
              : toolResult.output;
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name: manualDecision.name,
              state: 'done',
              inputSummary: summarizeToolArgs(manualDecision.name, manualDecision.args),
              output: truncateStreamPreview(streamedOutput),
              success: toolResult.success,
            });
            currentMessages.push({
              role: 'user',
              content: this.formatManualToolResult(manualDecision.name, toolResult.output),
            });
          } catch (error: any) {
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name: manualDecision.name,
              state: 'done',
              inputSummary: summarizeToolArgs(manualDecision.name, manualDecision.args),
              output: truncateStreamPreview(`Error: ${error.message}`),
              success: false,
            });
            currentMessages.push({
              role: 'user',
              content: this.formatManualToolResult(manualDecision.name, `Error: ${error.message}`),
            });
          }
          continue;
        }

        if (manualDecision?.kind === 'final') {
          this.planner.setPhase('ready');
          this.planner.setIntendedAction('Awaiting user input');
          this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
          this.traceBus.emitEvent({
            type: 'chat_response',
            data: { length: manualDecision.content.length, manualToolProtocol: true },
          });
          await this.persistCurrentSession();
          return manualDecision.content;
        }

        if (selectedToolNames.length > 0 && manualProtocolCorrectionCount < 2) {
          manualProtocolCorrectionCount += 1;
          currentMessages.push({
            role: 'system',
            content: RECIPES.manualToolCorrection(),
          });
          loopCount += 1;
          continue;
        }
      }

      if (nativeToolDefinitions && looksLikeSimulatedToolCall(response)) {
        simulatedToolReplyCount += 1;
        this.traceBus.emitEvent({
          type: 'tool_simulation_detected',
          data: {
            model: this.config.model,
            attempt: simulatedToolReplyCount,
            preview: response.slice(0, 240),
          },
        });

        if (simulatedToolReplyCount < 2) {
          currentMessages.push({
            role: 'system',
            content: RECIPES.toolCorrection(),
          });
          loopCount += 1;
          continue;
        }

        const warning = 'Model attempted to simulate tool usage in plain text. No tools were executed.';
        this.planner.setPhase('ready');
        this.planner.setIntendedAction('Awaiting user input');
        this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
        this.traceBus.emitEvent({
          type: 'chat_response',
          data: { length: warning.length, simulatedTools: true },
        });
        await this.persistCurrentSession();
        return `${warning} Retry the request or switch models.`;
      }

      const optimizer = new PromptOptimizer(promptMode);
      if (optimizer.detectReframing(response)) {
        this.traceBus.emitEvent({
          type: 'prompt_reframe_suggested',
          data: {
            reason: 'Model response appears too broad for a tool-driven workflow.',
          },
        });
      }

      this.planner.setPhase('ready');
      this.planner.setIntendedAction('Awaiting user input');
      this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
      this.traceBus.emitEvent({
        type: 'chat_response',
        data: { length: response.length },
      });
      await this.persistCurrentSession();

      return response;
    }

    return 'Maximum tool execution loops reached or no response from model.';
  }

  private ensureToolAllowed(toolName: SupportedTool) {
    if (!this.currentSession) {
      this.startSession();
    }

    if (!this.currentSession?.toolsAllowlist.includes(toolName)) {
      throw new Error(`Tool ${toolName} is not allowed in this session.`);
    }
  }

  async runTool(toolName: SupportedTool, ...args: string[]): Promise<ReturnType<ToolRegistry[SupportedTool]>> {
    this.ensureToolAllowed(toolName);
    const tool = this.toolRegistry[toolName].bind(this.toolRegistry) as (...toolArgs: string[]) => ReturnType<ToolRegistry[SupportedTool]>;
    const result = await tool(...args);
    await this.persistCurrentSession();
    return result;
  }

  async readFile(filePath: string) {
    return this.runTool('readFile', filePath);
  }

  async listDir(dirPath: string) {
    return this.runTool('listDir', dirPath);
  }

  async glob(pattern: string) {
    return this.runTool('glob', pattern);
  }

  async searchText(query: string, filePattern?: string) {
    return this.runTool('searchText', query, filePattern || '');
  }

  async writeFile(filePath: string, content: string) {
    return this.runTool('writeFile', filePath, content);
  }

  async patchFile(filePath: string, oldContent: string, newContent: string) {
    return this.runTool('patchFile', filePath, oldContent, newContent);
  }

  async makeDir(dirPath: string) {
    return this.runTool('makeDir', dirPath);
  }

  async deleteFile(filePath: string) {
    return this.runTool('deleteFile', filePath);
  }

  async gitStatus() {
    return this.runTool('gitStatus');
  }

  async gitDiff() {
    return this.runTool('gitDiff');
  }

  async runCommand(command: string) {
    return this.runTool('runCommand', command);
  }
}
