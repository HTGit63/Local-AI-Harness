import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ApprovalQueueManager, ApprovalRequestPayload } from '@local-harness/approval-workflow';
import { ModelAdapter, ModelRuntimeState } from '@local-harness/model-adapter';
import { Planner } from '@local-harness/planner';
import { PromptOptimizer, RECIPES, RunMode } from '@local-harness/prompt-recipes';
import { RepoIndexer, ProjectContext, TaskContext } from '@local-harness/repo-indexer';
import { AgentRun, AgentRunLineStats, AgentRunMetrics, AgentRunStep, FileSessionStore, SessionMetadata, SessionTurnMetadata } from '@local-harness/session-store';
import { LOCAL_MODEL_BUDGET_PROFILES, LocalModelBudgetProfile, TaskOrchestrator, TaskPlan, TaskStep } from '@local-harness/task-orchestrator';
import { ToolRegistry, ToolResult, ToolResultMetadata } from '@local-harness/tool-runtime';
import { TraceBus, TraceEvent } from '@local-harness/trace-bus';
import { ActionType, PolicyCheckResult, PolicyMode, WorkspacePolicy } from '@local-harness/workspace-policy';
import { AgentRunBuilder, buildFinalAnswer, summarizeRun } from './agent-run';
import { classifyIntent, IntentDecision, TaskIntent } from './intent-classifier';
// PromptAnalyzer removed — passes messages straight through for lower latency

const SUPPORTED_TOOLS = [
  'glob',
  'readFile',
  'searchText',
  'listDir',
  'webSearch',
  'fetchUrl',
  'writeFile',
  'patchFile',
  'replaceRange',
  'insertAfter',
  'insertBefore',
  'replaceBlock',
  'applyUnifiedPatch',
  'previewPatch',
  'makeDir',
  'deleteFile',
  'runCommand',
  'gitStatus',
  'gitDiff',
] as const;
const AUTO_REPO_CONTEXT_ENABLED = process.env.HARNESS_AUTO_REPO_CONTEXT !== '0';
const execFileAsync = promisify(execFile);
const DISABLED_SKILL_SLUGS = new Set(['caveman']);

type SupportedTool = (typeof SUPPORTED_TOOLS)[number];
type TurnExecutionMode = 'direct' | 'agentic';
type ReasoningEffort = 'high' | 'medium' | 'low' | 'none';
type LocalModelBudgetProfileName = keyof typeof LOCAL_MODEL_BUDGET_PROFILES;
type StreamIdleTimeoutError = Error & {
  code: 'stream_idle_timeout';
  receivedContent: boolean;
};
type ManualToolDecision =
  | { kind: 'tool'; name: SupportedTool; args: Record<string, unknown> }
  | { kind: 'final'; content: string };
type ImmediateChatAnswer = { content: string; action: string; source: string };
type ToolProtocolMode = 'native' | 'manual_preferred' | 'manual_fallback';
type BootstrapPlanStep =
  | { type: 'inventory'; title: string }
  | { type: 'tool'; title: string; toolName: SupportedTool; args: Record<string, unknown> };

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

export interface ChatApprovalEvent {
  type: 'approval';
  state: 'pending' | 'updated' | 'resolved';
  approval: Partial<ApprovalRequestPayload> & {
    id: string;
    approved?: boolean | null;
  };
}

export interface RunStartedEvent {
  type: 'run_started';
  runId: string;
  sessionId: string;
  intent: string;
  workspaceBound: boolean;
  browserContextActive: boolean;
  workspaceSource: 'backend' | 'browser_snapshot';
  executionMode: TurnExecutionMode;
}

export interface RunStepEvent {
  type: 'run_step';
  runId: string;
  step: AgentRunStep;
}

export interface RunMetricEvent {
  type: 'run_metric';
  runId: string;
  metrics: Partial<{
    filesRead: number;
    directoriesRead: number;
    filesWritten: number;
    commandsRun: number;
    searchesRun: number;
    approvals: number;
    addedLines: number;
    removedLines: number;
    firstTokenMs: number;
    totalMs: number;
  }>;
}

export interface RunSummaryEvent {
  type: 'run_summary';
  runId: string;
  summary: AgentRun;
}

export interface RunCheckpoint {
  runId: string;
  sessionId: string;
  taskPlan: TaskPlan;
  currentStepId?: string;
  completedSteps: string[];
  failedSteps: string[];
  blockedSteps: string[];
  filesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  commandsRun: string[];
  approvals: Array<{
    id: string;
    target: string;
    approved: boolean | null;
  }>;
  summarySoFar: string;
  lastToolResults: Array<{
    tool: string;
    success: boolean;
    outputPreview: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface ChatStreamHandlers {
  onStatus?: (event: ChatStatusEvent) => void;
  onDelta?: (chunk: string) => void;
  onTool?: (event: ChatToolEvent) => void;
  onApproval?: (event: ChatApprovalEvent) => void;
  onRunStarted?: (event: RunStartedEvent) => void;
  onRunStep?: (event: RunStepEvent) => void;
  onRunMetric?: (event: RunMetricEvent) => void;
  onRunSummary?: (event: RunSummaryEvent) => void;
  onTrace?: (event: TraceEvent) => void;
}

export interface EngineConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  profile: 'fast' | 'balanced' | 'deep';
  workspaceRoot: string;
  mode: PolicyMode;
  sessionDataDir: string;
  internetAccessEnabled: boolean;
  streamIdleTimeoutMs: number;
  contextBudget: number;
  toolRetryMax: number;
  sessionMemoryEnabled: boolean;
  sessionMemoryTurns: number;
  selfCheckEnabled: boolean;
  localModelBudgetProfile: LocalModelBudgetProfileName;
}

export interface PublicEngineConfig {
  baseUrl: string;
  model: string;
  profile: 'fast' | 'balanced' | 'deep';
  workspaceRoot: string;
  mode: PolicyMode;
  sessionDataDir: string;
  internetAccessEnabled: boolean;
  streamIdleTimeoutMs: number;
  contextBudget: number;
  toolRetryMax: number;
  sessionMemoryEnabled: boolean;
  sessionMemoryTurns: number;
  selfCheckEnabled: boolean;
  localModelBudgetProfile: LocalModelBudgetProfileName;
  localModelBudget: LocalModelBudgetProfile;
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
  internetAccessEnabled: process.env.HARNESS_INTERNET_ACCESS !== '0',
  streamIdleTimeoutMs: Number(process.env.HARNESS_STREAM_IDLE_TIMEOUT_MS || 45000),
  contextBudget: Number(process.env.HARNESS_CONTEXT_BUDGET || 24000),
  toolRetryMax: Number(process.env.HARNESS_TOOL_RETRY_MAX || 2),
  sessionMemoryEnabled: process.env.HARNESS_SESSION_MEMORY !== '0',
  sessionMemoryTurns: Number(process.env.HARNESS_SESSION_MEMORY_TURNS || 3),
  selfCheckEnabled: process.env.HARNESS_SELF_CHECK !== '0',
  localModelBudgetProfile: (process.env.HARNESS_LOCAL_MODEL_BUDGET_PROFILE as LocalModelBudgetProfileName) || 'balanced',
};

function resolveSessionDataDir(workspaceRoot: string, sessionDataDir: string): string {
  return path.isAbsolute(sessionDataDir)
    ? sessionDataDir
    : path.resolve(workspaceRoot, sessionDataDir);
}

function createSessionId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function createRunId(): string {
  return `run_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIntegerSetting(value: number, fallback: number, min: number, max?: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const normalized = Math.floor(numeric);
  if (normalized < min) {
    return min;
  }
  if (max !== undefined && normalized > max) {
    return max;
  }
  return normalized;
}

function trimPromptBlock(content: string, maxChars: number, truncationNotice = '[Context truncated to fit budget]'): string {
  if (!Number.isFinite(maxChars) || maxChars <= 0 || content.length <= maxChars) {
    return content;
  }

  const safeBudget = Math.max(96, Math.floor(maxChars));
  if (safeBudget <= truncationNotice.length + 2) {
    return content.slice(0, safeBudget);
  }

  return `${content.slice(0, safeBudget - truncationNotice.length - 2)}\n${truncationNotice}`;
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

function summarizeInventoryForPrompt(inventory: Awaited<ReturnType<RepoIndexer['buildWorkspaceInventory']>>): string {
  const appPreview = inventory.apps.slice(0, 6).map((entry) => entry.path).join(', ') || 'none';
  const packagePreview = inventory.packages.slice(0, 8).map((entry) => entry.path).join(', ') || 'none';
  return [
    '[Workspace Inventory]',
    `Root package: ${inventory.rootPackageName || 'unknown'}`,
    `Apps: ${appPreview}`,
    `Packages: ${packagePreview}`,
    `Top-level areas: ${inventory.topLevelAreas.join(', ') || 'none'}`,
  ].join('\n');
}

function mergeSkills(base: string[], additional: string[]): string[] {
  return Array.from(new Set([...base, ...additional]));
}

function sanitizeActiveSkills(skills: string[]): string[] {
  return Array.from(new Set(
    skills
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 0 && !DISABLED_SKILL_SLUGS.has(skill)),
  ));
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

function getRequiredNumberArg(args: Record<string, unknown>, key: string, toolName: SupportedTool): number {
  const value = args[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }

  throw new Error(`Missing required ${key} numeric argument for ${toolName}.`);
}

function extractFirstUrl(value: string): string | undefined {
  return value.match(/https?:\/\/[^\s)>\]]+/i)?.[0];
}

function isStreamIdleTimeoutError(error: unknown): error is StreamIdleTimeoutError {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'stream_idle_timeout');
}

function createStreamIdleTimeoutError(receivedContent: boolean): StreamIdleTimeoutError {
  const error = new Error('Model stream stalled before completing the response.') as StreamIdleTimeoutError;
  error.code = 'stream_idle_timeout';
  error.receivedContent = receivedContent;
  return error;
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
const DIRECT_HISTORY_COMPACTION_TAIL = 10;
const AGENT_HISTORY_COMPACTION_TAIL = 8;
const LOOP_CONTEXT_COMPACTION_TAIL = 12;
const MESSAGE_COMPACTION_LINE_CHARS = 220;
const MAX_RESPONSE_CONTINUATIONS = 2;
const STREAM_TASK_TRACE_TYPES = new Set([
  'task_plan_created',
  'task_step_started',
  'task_step_completed',
  'task_step_failed',
  'task_step_blocked',
  'task_checkpoint_saved',
  'task_budget_exceeded',
  'task_plan_completed',
  'tool_call_started',
  'tool_call_completed',
  'verification_started',
  'verification_completed',
]);

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

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function compactContextLine(value: string, maxChars = MESSAGE_COMPACTION_LINE_CHARS): string {
  const normalized = normalizeInlineWhitespace(value);
  if (!normalized) {
    return '[empty]';
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}...`;
}

type EngineChatMessage = ChatMessage & {
  name?: string;
  thinking?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  finish_reason?: string | null;
};

function summarizeCompactedMessage(message: EngineChatMessage): string {
  const role =
    message.role === 'tool'
      ? `tool:${message.name || 'unknown'}`
      : message.role;
  const content = compactContextLine(message.content || composeAssistantContent(message as unknown as Record<string, unknown>));
  return `- ${role}: ${content}`;
}

function summarizeToolArgs(toolName: SupportedTool, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'readFile':
    case 'writeFile':
    case 'patchFile':
    case 'replaceRange':
    case 'insertAfter':
    case 'insertBefore':
    case 'replaceBlock':
    case 'deleteFile':
      return `Path: ${getRequiredStringArg(args, 'filePath', toolName)}`;
    case 'applyUnifiedPatch':
      return 'Unified patch';
    case 'previewPatch':
      return `Preview: ${getRequiredStringArg(args, 'filePath', toolName)}`;
    case 'listDir':
      return `Path: ${getOptionalStringArg(args, 'dirPath') || '.'}`;
    case 'glob':
      return `Pattern: ${getRequiredStringArg(args, 'pattern', toolName)}`;
    case 'searchText':
      return [
        `Query: ${getRequiredStringArg(args, 'query', toolName)}`,
        getOptionalStringArg(args, 'filePattern') ? `Files: ${getOptionalStringArg(args, 'filePattern')}` : null,
      ].filter((entry): entry is string => Boolean(entry)).join(' | ');
    case 'webSearch':
      return `Query: ${getRequiredStringArg(args, 'query', toolName)}`;
    case 'fetchUrl':
      return `URL: ${getRequiredStringArg(args, 'url', toolName)}`;
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

function buildTaskContextPrompt(taskContext: TaskContext | null): string {
  if (!taskContext) {
    return '[Task Relevant Context]\nUnavailable. Use targeted tools only.';
  }
  return [
    '[Task Relevant Context]',
    `Area: ${taskContext.taskArea}`,
    `Reason: ${taskContext.reason}`,
    `Relevant files: ${taskContext.relevantFiles.length > 0 ? taskContext.relevantFiles.join(', ') : 'none detected'}`,
    `Entry points: ${taskContext.likelyEntryPoints.length > 0 ? taskContext.likelyEntryPoints.join(', ') : 'none detected'}`,
    `Likely tests: ${taskContext.likelyTests.length > 0 ? taskContext.likelyTests.join(', ') : 'none detected'}`,
    taskContext.ignoredFiles.length > 0 ? `Expected but missing: ${taskContext.ignoredFiles.slice(0, 8).join(', ')}` : '',
  ].filter(Boolean).join('\n');
}

function buildStepScopedPrompt(taskPlan: TaskPlan, currentStep: TaskStep | null, taskContext: TaskContext | null): string {
  return [
    '[Current Task Plan]',
    `Plan: ${taskPlan.title}`,
    `Complexity: ${taskPlan.complexity}`,
    `Progress: ${taskPlan.steps.map((stepEntry) => `[${stepEntry.status}] ${stepEntry.title}`).join(' | ')}`,
    currentStep ? [
      '[Current Step]',
      `ID: ${currentStep.id}`,
      `Type: ${currentStep.type}`,
      `Title: ${currentStep.title}`,
      `Allowed tools: ${currentStep.toolsAllowed.length > 0 ? currentStep.toolsAllowed.join(', ') : 'none'}`,
      `Success: ${currentStep.successCriteria.join('; ')}`,
      `Budget: model=${currentStep.budget.maxModelCalls}, tools=${currentStep.budget.maxToolCalls}, read=${currentStep.budget.maxFilesToRead}, write=${currentStep.budget.maxFilesToWrite}, output=${currentStep.budget.maxOutputTokens}`,
    ].join('\n') : '[Current Step]\nNone.',
    buildTaskContextPrompt(taskContext),
    'Rule: execute only the current step. Use one tool call at a time. Do not solve later steps in this model call.',
  ].join('\n\n');
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
  private readonly taskOrchestrator: TaskOrchestrator;
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
    if (!Number.isFinite(this.config.streamIdleTimeoutMs) || this.config.streamIdleTimeoutMs < 0) {
      this.config.streamIdleTimeoutMs = DEFAULT_ENGINE_CONFIG.streamIdleTimeoutMs;
    }
    this.config.contextBudget = normalizeIntegerSetting(this.config.contextBudget, DEFAULT_ENGINE_CONFIG.contextBudget, 4000);
    this.config.toolRetryMax = normalizeIntegerSetting(this.config.toolRetryMax, DEFAULT_ENGINE_CONFIG.toolRetryMax, 0, 8);
    this.config.sessionMemoryTurns = normalizeIntegerSetting(this.config.sessionMemoryTurns, DEFAULT_ENGINE_CONFIG.sessionMemoryTurns, 1, 12);
    this.config.sessionMemoryEnabled = this.config.sessionMemoryEnabled !== false;
    this.config.selfCheckEnabled = this.config.selfCheckEnabled !== false;
    if (!LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile]) {
      this.config.localModelBudgetProfile = DEFAULT_ENGINE_CONFIG.localModelBudgetProfile;
    }
    if (!LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile]) {
      this.config.localModelBudgetProfile = DEFAULT_ENGINE_CONFIG.localModelBudgetProfile;
    }

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
    this.taskOrchestrator = new TaskOrchestrator();
    this.toolRegistry = new ToolRegistry({
      cwd: this.config.workspaceRoot,
      internetAccessEnabled: this.config.internetAccessEnabled,
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
        const resolved = event.data as { id: string; response?: { approved?: boolean; editInstruction?: string } };
        this.emit('approval_resolved', {
          id: resolved.id,
          approved: resolved.response?.approved ?? null,
          editInstruction: resolved.response?.editInstruction,
        });
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
      internetAccessEnabled: this.config.internetAccessEnabled,
      streamIdleTimeoutMs: this.config.streamIdleTimeoutMs,
      contextBudget: this.config.contextBudget,
      toolRetryMax: this.config.toolRetryMax,
      sessionMemoryEnabled: this.config.sessionMemoryEnabled,
      sessionMemoryTurns: this.config.sessionMemoryTurns,
      selfCheckEnabled: this.config.selfCheckEnabled,
      localModelBudgetProfile: this.config.localModelBudgetProfile,
      localModelBudget: LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile],
    };
  }

  private async persistCurrentSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    this.currentSession.updatedAt = Date.now();
    await this.sessionStore.saveSession(this.currentSession);
  }

  private getRunDataDir(): string {
    return path.resolve(this.config.workspaceRoot, '.gamma-harness', 'runs');
  }

  private getRunCheckpointPath(runId: string): string {
    return path.join(this.getRunDataDir(), `${runId}.json`);
  }

  private async readRunCheckpointFile(runId: string): Promise<RunCheckpoint | null> {
    try {
      return JSON.parse(await fs.readFile(this.getRunCheckpointPath(runId), 'utf8')) as RunCheckpoint;
    } catch {
      return null;
    }
  }

  private async saveRunCheckpoint(checkpoint: RunCheckpoint): Promise<string> {
    const checkpointPath = this.getRunCheckpointPath(checkpoint.runId);
    await fs.mkdir(path.dirname(checkpointPath), { recursive: true });
    const previous = await this.readRunCheckpointFile(checkpoint.runId);
    const createdAt = previous?.createdAt ?? checkpoint.createdAt;
    const nextCheckpoint = {
      ...checkpoint,
      createdAt,
      updatedAt: Date.now(),
    };
    await fs.writeFile(checkpointPath, `${JSON.stringify(nextCheckpoint, null, 2)}\n`, 'utf8');
    return checkpointPath;
  }

  async listRuns(): Promise<RunCheckpoint[]> {
    const runDataDir = this.getRunDataDir();
    try {
      const entries = await fs.readdir(runDataDir, { withFileTypes: true });
      const checkpoints = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map(async (entry) => {
            try {
              return JSON.parse(await fs.readFile(path.join(runDataDir, entry.name), 'utf8')) as RunCheckpoint;
            } catch {
              return null;
            }
          }),
      );
      return checkpoints
        .filter((entry): entry is RunCheckpoint => entry !== null)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    } catch {
      return [];
    }
  }

  async getRun(runId: string): Promise<RunCheckpoint | null> {
    return this.readRunCheckpointFile(runId);
  }

  async getRunCheckpoint(runId: string): Promise<RunCheckpoint | null> {
    return this.readRunCheckpointFile(runId);
  }

  async resumeRun(runId: string): Promise<RunCheckpoint | null> {
    const checkpoint = await this.readRunCheckpointFile(runId);
    if (!checkpoint) {
      return null;
    }
    this.planner.setTaskPlan(runId, checkpoint.taskPlan);
    this.traceBus.emitEvent({
      type: 'task_run_resumed',
      data: { runId, checkpoint },
    });
    return checkpoint;
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
    this.toolRegistry.updateContext({
      cwd: workspaceRoot,
      internetAccessEnabled: this.config.internetAccessEnabled,
    });
  }

  private buildPlannerRuntimeContext() {
    return {
      workspaceRoot: this.config.workspaceRoot,
      internetAccessEnabled: this.config.internetAccessEnabled,
      contextBudget: this.config.contextBudget,
      toolRetryMax: this.config.toolRetryMax,
      sessionMemoryEnabled: this.config.sessionMemoryEnabled,
      sessionMemoryTurns: this.config.sessionMemoryTurns,
      selfCheckEnabled: this.config.selfCheckEnabled,
    };
  }

  startSession(skills: string[] = []): SessionMetadata {
    const sanitizedSkills = sanitizeActiveSkills(skills);
    const session: SessionMetadata = {
      id: createSessionId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: this.config.model,
      mode: this.config.mode,
      cwd: this.config.workspaceRoot,
      skillsActive: sanitizedSkills,
      toolsAllowlist: [...SUPPORTED_TOOLS],
      turnHistory: [],
    };

    this.currentSession = session;
    this.planner.setTaskSummary('Interactive coding session');
    this.planner.setPhase('ready');
    this.planner.setActiveSkills(sanitizedSkills);
    this.planner.setIntendedAction('Awaiting user input');
    this.planner.setRuntimeContext(this.buildPlannerRuntimeContext());
    this.traceBus.emitEvent({ type: 'session_started', data: session });
    void this.persistCurrentSession();

    return session;
  }

  async resumeSession(id: string): Promise<SessionMetadata | null> {
    const session = await this.sessionStore.loadSession(id);
    if (!session) {
      return null;
    }

    const sanitizedSkills = sanitizeActiveSkills(session.skillsActive || []);
    this.currentSession = {
      ...session,
      skillsActive: sanitizedSkills,
    };
    this.planner.setTaskSummary(`Resumed session ${session.id}`);
    this.planner.setPhase('ready');
    this.planner.setActiveSkills(sanitizedSkills);
    this.planner.setIntendedAction('Awaiting user input');
    this.planner.setRuntimeContext(this.buildPlannerRuntimeContext());
    this.traceBus.emitEvent({ type: 'session_resumed', data: { id: session.id } });
    if (sanitizedSkills.length !== (session.skillsActive || []).length) {
      await this.persistCurrentSession();
    }
    return this.currentSession;
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
    const sanitizedSkills = sanitizeActiveSkills(skills);
    if (!this.currentSession) {
      this.startSession(sanitizedSkills);
    } else {
      this.currentSession.skillsActive = [...sanitizedSkills];
      this.planner.setActiveSkills(sanitizedSkills);
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
    const previousInternetAccess = this.config.internetAccessEnabled;

    this.config = {
      ...this.config,
      ...config,
      workspaceRoot: config.workspaceRoot ? path.resolve(config.workspaceRoot) : this.config.workspaceRoot,
    };
    this.config.contextBudget = normalizeIntegerSetting(this.config.contextBudget, DEFAULT_ENGINE_CONFIG.contextBudget, 4000);
    this.config.toolRetryMax = normalizeIntegerSetting(this.config.toolRetryMax, DEFAULT_ENGINE_CONFIG.toolRetryMax, 0, 8);
    this.config.sessionMemoryTurns = normalizeIntegerSetting(this.config.sessionMemoryTurns, DEFAULT_ENGINE_CONFIG.sessionMemoryTurns, 1, 12);
    this.config.sessionMemoryEnabled = this.config.sessionMemoryEnabled !== false;
    this.config.selfCheckEnabled = this.config.selfCheckEnabled !== false;

    if (config.sessionDataDir) {
      this.sessionDataDirSetting = config.sessionDataDir;
    }

    const workspaceChanged = this.config.workspaceRoot !== previousWorkspaceRoot;
    const modeChanged = this.config.mode !== previousMode;
    const internetAccessChanged = this.config.internetAccessEnabled !== previousInternetAccess;
    this.workspacePolicy.updateConfig({
      workspaceRoot: this.config.workspaceRoot,
      mode: this.config.mode,
    });
    this.planner.setRuntimeContext(this.buildPlannerRuntimeContext());

    if (workspaceChanged || internetAccessChanged) {
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

  private shouldIncludeInternetTools(latestUserMessage: string): boolean {
    if (!this.config.internetAccessEnabled) {
      return false;
    }

    const normalized = latestUserMessage.toLowerCase();
    return (
      Boolean(extractFirstUrl(latestUserMessage)) ||
      /\b(current|docs?|documentation|fetch|internet|latest|look up|lookup|news|online|release notes|search web|site|url|website|web)\b/.test(normalized)
    );
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

  private async selectToolProtocol(
    toolNames: SupportedTool[],
    modelCapabilities: string[] | null,
  ): Promise<{ manualToolProtocol: boolean; mode: ToolProtocolMode; reason?: string }> {
    if (toolNames.length === 0) {
      return { manualToolProtocol: false, mode: 'native' };
    }

    const manualToolsForced = process.env.HARNESS_FORCE_MANUAL_TOOLS === '1';
    if (manualToolsForced) {
      return {
        manualToolProtocol: true,
        mode: 'manual_preferred',
        reason: 'Manual tool protocol forced by HARNESS_FORCE_MANUAL_TOOLS=1.',
      };
    }

    const canAttemptNativeTools = await this.modelAdapter.canAttemptNativeToolCalling(this.config.model, modelCapabilities);
    if (canAttemptNativeTools || !Array.isArray(modelCapabilities)) {
      return { manualToolProtocol: false, mode: 'native' };
    }

    if (!modelCapabilities.includes('tools')) {
      return {
        manualToolProtocol: true,
        mode: 'manual_fallback',
        reason: 'Model capabilities do not include native tools.',
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

    if (promptMode === 'targeted_edit') {
      return false;
    }

    if (promptMode === 'doc_generation') {
      return this.isRepoOverviewQuestion(latestUserMessage);
    }

    if (promptMode === 'code_review') {
      return false;
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
      selected.add('replaceRange');
      selected.add('insertAfter');
      selected.add('insertBefore');
      selected.add('replaceBlock');
      selected.add('applyUnifiedPatch');
      selected.add('previewPatch');
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

    if (this.shouldIncludeInternetTools(latestUserMessage)) {
      selected.add('webSearch');
      if (extractFirstUrl(latestUserMessage)) {
        selected.add('fetchUrl');
      }
    }

    return SUPPORTED_TOOLS.filter((toolName) => selected.has(toolName));
  }

  private selectOperationalSkills(intent: TaskIntent, promptMode: RunMode): string[] {
    const selected = ['session-continuity', 'local-safety-operator'];

    switch (intent) {
      case 'workspace_overview':
        selected.push('repo-cartographer');
        break;
      case 'read_file':
      case 'explain_code':
        selected.push('file-explainer');
        break;
      case 'edit_code':
        selected.push('tool-router', 'patch-surgeon', 'diff-summarizer');
        break;
      case 'review_diff':
        selected.push('diff-summarizer');
        break;
      case 'workspace_binding_needed':
      case 'browser_snapshot_only':
        selected.push('workspace-binder');
        break;
      case 'run_command':
        selected.push('command-runner', 'test-runner');
        break;
      default:
        break;
    }

    if (promptMode === 'code_review') {
      selected.push('diff-summarizer');
    }

    return selected;
  }

  private buildBootstrapPlan(
    intentDecision: IntentDecision,
    promptMode: RunMode,
    toolNames: SupportedTool[],
  ): BootstrapPlanStep[] {
    switch (intentDecision.intent) {
      case 'workspace_overview':
        return [
          { type: 'inventory', title: 'Build workspace inventory' },
          { type: 'tool', title: 'List workspace root', toolName: 'listDir', args: { dirPath: '.' } },
        ];
      case 'find_file':
        if (!intentDecision.targetPath) return [];
        return [
          {
            type: 'tool',
            title: `Find ${intentDecision.targetPath}`,
            toolName: 'glob',
            args: { pattern: `**/*${path.basename(intentDecision.targetPath)}*` },
          },
        ];
      case 'read_file':
        if (!intentDecision.targetPath) return [];
        return [
          {
            type: 'tool',
            title: `Read ${intentDecision.targetPath}`,
            toolName: 'readFile',
            args: { filePath: intentDecision.targetPath },
          },
        ];
      case 'search_text':
        if (!intentDecision.searchQuery) return [];
        return [
          {
            type: 'tool',
            title: `Search for ${intentDecision.searchQuery}`,
            toolName: 'searchText',
            args: { query: intentDecision.searchQuery },
          },
        ];
      case 'review_diff':
        return [
          { type: 'tool', title: 'Read git diff', toolName: 'gitDiff', args: {} },
        ];
      default:
        break;
    }

    if (!toolNames.includes('listDir')) {
      return [];
    }

    if (
      promptMode === 'targeted_edit' ||
      intentDecision.intent === 'general_chat' ||
      intentDecision.intent === 'explain_code' ||
      intentDecision.intent === 'run_command'
    ) {
      const steps: BootstrapPlanStep[] = [
        { type: 'tool', title: 'List workspace root', toolName: 'listDir', args: { dirPath: '.' } },
      ];
      if (promptMode === 'targeted_edit' || intentDecision.intent === 'general_chat') {
        steps.unshift({ type: 'inventory', title: 'Build workspace inventory' });
      }
      return steps;
    }

    return [];
  }

  private emitRunStarted(handlers: ChatStreamHandlers | undefined, event: RunStartedEvent) {
    handlers?.onRunStarted?.(event);
  }

  private emitRunStep(handlers: ChatStreamHandlers | undefined, runId: string, step: AgentRunStep) {
    handlers?.onRunStep?.({
      type: 'run_step',
      runId,
      step,
    });
  }

  private emitRunMetric(handlers: ChatStreamHandlers | undefined, runId: string, run: AgentRun) {
    handlers?.onRunMetric?.({
      type: 'run_metric',
      runId,
      metrics: {
        filesRead: run.filesRead.length,
        directoriesRead: run.directoriesRead.length,
        filesWritten: run.filesWritten.length,
        commandsRun: run.commands.length,
        searchesRun: run.searches.length,
        approvals: run.approvals.length,
        addedLines: run.git?.addedLines ?? 0,
        removedLines: run.git?.removedLines ?? 0,
        firstTokenMs: run.metrics?.firstTokenMs,
        totalMs: run.metrics?.totalMs,
      },
    });
  }

  private emitRunSummary(handlers: ChatStreamHandlers | undefined, runId: string, summary: AgentRun) {
    handlers?.onRunSummary?.({
      type: 'run_summary',
      runId,
      summary,
    });
  }

  private selectMaxTokens(latestUserMessage: string, promptMode: RunMode, usingTools: boolean): number {
    const budget = LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile] ?? LOCAL_MODEL_BUDGET_PROFILES.lean;
    const normalized = latestUserMessage.toLowerCase();
    const terseReplyRequested =
      /\b(exactly|just|only|one line|single sentence|yes or no)\b/.test(normalized) ||
      latestUserMessage.trim().split(/\s+/).filter(Boolean).length <= 10;
    if (terseReplyRequested) {
      return 128;
    }

    switch (promptMode) {
      case 'quick_inspect':
        return usingTools ? Math.min(768, budget.outputBudgetInspect) : Math.min(384, budget.outputBudgetDirect);
      case 'code_review':
        return usingTools ? Math.min(1024, budget.outputBudgetInspect) : Math.min(640, budget.outputBudgetDirect);
      case 'targeted_edit':
        return usingTools ? budget.outputBudgetEdit : Math.min(768, budget.outputBudgetDirect);
      case 'doc_generation':
        return usingTools ? budget.outputBudgetFinalReport : Math.min(900, budget.outputBudgetFinalReport);
      default:
        return usingTools ? Math.min(1024, budget.outputBudgetInspect) : budget.outputBudgetDirect;
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
      webSearch: '{"action":"webSearch","args":{"query":"latest ollama gemma4 tool calling docs"}}',
      fetchUrl: '{"action":"fetchUrl","args":{"url":"https://example.com/docs"}}',
      writeFile: '{"action":"writeFile","args":{"filePath":"README.md","content":"# Title\\n"}}',
      patchFile: '{"action":"patchFile","args":{"filePath":"src/index.ts","oldContent":"before","newContent":"after"}}',
      replaceRange: '{"action":"replaceRange","args":{"filePath":"src/index.ts","startLine":10,"endLine":12,"newContent":"replacement\\n"}}',
      insertAfter: '{"action":"insertAfter","args":{"filePath":"src/index.ts","anchorText":"export {};","newContent":"\\nconst x = 1;\\n"}}',
      insertBefore: '{"action":"insertBefore","args":{"filePath":"src/index.ts","anchorText":"export {};","newContent":"const x = 1;\\n"}}',
      replaceBlock: '{"action":"replaceBlock","args":{"filePath":"src/index.ts","anchorStart":"// start","anchorEnd":"// end","newContent":"// start\\nupdated\\n// end"}}',
      applyUnifiedPatch: '{"action":"applyUnifiedPatch","args":{"patchText":"--- a/file.txt\\n+++ b/file.txt\\n@@ -1 +1 @@\\n-old\\n+new\\n"}}',
      previewPatch: '{"action":"previewPatch","args":{"filePath":"src/index.ts","before":"old","after":"new"}}',
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
    const explicitUrl = extractFirstUrl(latestUserMessage);
    if (explicitUrl && toolNames.includes('fetchUrl')) {
      return { kind: 'tool', name: 'fetchUrl', args: { url: explicitUrl } };
    }

    if (this.shouldIncludeInternetTools(latestUserMessage) && toolNames.includes('webSearch')) {
      return { kind: 'tool', name: 'webSearch', args: { query: latestUserMessage.trim() } };
    }

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

    const latestUserMessage = this.getLatestUserMessage(chatMessages);
    const workspaceNotice = this.workspaceChangedNotice;
    if (workspaceNotice) {
      this.workspaceChangedNotice = null;
    }

    const workspaceContextMessage: ChatMessage = {
      role: 'system',
      content: [
        '[Workspace Context]',
        `Workspace root: ${this.config.workspaceRoot}`,
        `Session cwd: ${this.currentSession?.cwd || this.config.workspaceRoot}`,
        `Mode: ${this.config.mode}`,
        `Configured model: ${this.config.model}`,
        'If the user asks which folder is open, answer from the workspace root or session cwd above.',
        'All file and command-path targets must stay inside the workspace root, including in danger mode.',
        workspaceNotice ? `\n${workspaceNotice}` : '',
      ].filter(Boolean).join('\n'),
    };
    const contextMessages: ChatMessage[] = [workspaceContextMessage];
    const totalContextBudget = normalizeIntegerSetting(this.config.contextBudget, DEFAULT_ENGINE_CONFIG.contextBudget, 4000);
    let remainingBudget = Math.max(1200, totalContextBudget - workspaceContextMessage.content.length);

    const sessionMemoryBudget = includeRepoContext
      ? Math.max(1000, Math.floor(remainingBudget * 0.35))
      : remainingBudget;
    const sessionMemoryMessage = this.buildSessionMemoryMessage(latestUserMessage, sessionMemoryBudget);
    if (sessionMemoryMessage) {
      contextMessages.push(sessionMemoryMessage);
      remainingBudget = Math.max(1200, remainingBudget - sessionMemoryMessage.content.length);
    }

    if (includeRepoContext) {
      try {
        const repoContext = trimPromptBlock(
          await this.getRepoContextPrompt(),
          remainingBudget,
          '[Repo context trimmed to fit context budget]',
        );
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
    'writeFile', 'patchFile', 'replaceRange', 'insertAfter', 'insertBefore', 'replaceBlock', 'applyUnifiedPatch', 'makeDir', 'deleteFile',
  ]);

  private async executeToolCall(toolName: SupportedTool, args: Record<string, unknown>, runId?: string): Promise<any> {
    const inputSummary = summarizeToolArgs(toolName, args);
    this.traceBus.emitEvent({
      type: 'tool_call_started',
      data: { runId, tool: toolName, inputSummary },
    });
    let result: any;
    try {
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
        case 'webSearch':
          result = await this.webSearch(getRequiredStringArg(args, 'query', toolName));
          break;
        case 'fetchUrl':
          result = await this.fetchUrl(getRequiredStringArg(args, 'url', toolName));
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
        case 'replaceRange':
          result = await this.replaceRange(
            getRequiredStringArg(args, 'filePath', toolName),
            getRequiredNumberArg(args, 'startLine', toolName),
            getRequiredNumberArg(args, 'endLine', toolName),
            getRequiredStringArg(args, 'newContent', toolName),
          );
          break;
        case 'insertAfter':
          result = await this.insertAfter(
            getRequiredStringArg(args, 'filePath', toolName),
            getRequiredStringArg(args, 'anchorText', toolName),
            getRequiredStringArg(args, 'newContent', toolName),
          );
          break;
        case 'insertBefore':
          result = await this.insertBefore(
            getRequiredStringArg(args, 'filePath', toolName),
            getRequiredStringArg(args, 'anchorText', toolName),
            getRequiredStringArg(args, 'newContent', toolName),
          );
          break;
        case 'replaceBlock':
          result = await this.replaceBlock(
            getRequiredStringArg(args, 'filePath', toolName),
            getRequiredStringArg(args, 'anchorStart', toolName),
            getRequiredStringArg(args, 'anchorEnd', toolName),
            getRequiredStringArg(args, 'newContent', toolName),
          );
          break;
        case 'applyUnifiedPatch':
          result = await this.applyUnifiedPatch(getRequiredStringArg(args, 'patchText', toolName));
          break;
        case 'previewPatch':
          result = await this.previewPatch(
            getRequiredStringArg(args, 'filePath', toolName),
            getRequiredStringArg(args, 'before', toolName),
            getRequiredStringArg(args, 'after', toolName),
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
    } catch (error: any) {
      this.traceBus.emitEvent({
        type: 'tool_call_completed',
        data: {
          runId,
          tool: toolName,
          success: false,
          outputPreview: error?.message || 'Tool failed.',
        },
      });
      throw error;
    }

    // Invalidate repo context cache after workspace-modifying tools so next turn gets fresh context
    if (CoreEngine.WORKSPACE_MUTATING_TOOLS.has(toolName)) {
      this.invalidateRepoContextCache();
    }

    this.traceBus.emitEvent({
      type: 'tool_call_completed',
      data: {
        runId,
        tool: toolName,
        success: result?.success === true,
        outputPreview: truncateStreamPreview(result?.output || ''),
      },
    });

    return result;
  }

  private recordRunToolMetadata(builder: AgentRunBuilder, metadata?: ToolResultMetadata) {
    builder.recordToolMetadata(metadata);
  }

  private async executeBootstrapPlan(
    plan: BootstrapPlanStep[],
    currentMessages: ChatMessage[],
    handlers: ChatStreamHandlers | undefined,
    builder: AgentRunBuilder,
  ): Promise<void> {
    for (const stepPlan of plan) {
      const step = builder.startNamedStep(
        stepPlan.type === 'inventory' ? 'inventory' : 'tool',
        stepPlan.title,
      );
      this.planner.upsertRunStep({
        id: step.id,
        type: step.type,
        title: step.title,
        status: step.status,
        detail: step.detail,
      });
      this.emitRunStep(handlers, builder.snapshot().id, step);

      if (stepPlan.type === 'inventory') {
        const inventory = await this.repoIndexer.buildWorkspaceInventory();
        currentMessages.push({
          role: 'system',
          content: summarizeInventoryForPrompt(inventory),
        });
        builder.finishStep(step.id, {
          detail: `Indexed ${inventory.apps.length} apps and ${inventory.packages.length} packages.`,
        });
        const finished = builder.snapshot().steps.find((entry) => entry.id === step.id);
        if (finished) {
          this.planner.upsertRunStep({
            id: finished.id,
            type: finished.type,
            title: finished.title,
            status: finished.status,
            detail: finished.detail,
          });
          this.emitRunStep(handlers, builder.snapshot().id, finished);
        }
        continue;
      }

      const toolEventId = `${builder.snapshot().id}_${step.id}`;
      this.emitChatToolEvent(handlers, {
        id: toolEventId,
        name: stepPlan.toolName,
        state: 'start',
        inputSummary: summarizeToolArgs(stepPlan.toolName, stepPlan.args),
      });
      this.planner.setCurrentTool(stepPlan.toolName);

      const toolResult = await this.executeToolCall(stepPlan.toolName, stepPlan.args, builder.snapshot().id);
      const toolOutput = toolResult.preview ? `${toolResult.output}\n\n${toolResult.preview}` : toolResult.output;
      this.emitChatToolEvent(handlers, {
        id: toolEventId,
        name: stepPlan.toolName,
        state: 'done',
        inputSummary: summarizeToolArgs(stepPlan.toolName, stepPlan.args),
        output: truncateStreamPreview(toolOutput),
        success: toolResult.success,
      });
      this.recordRunToolMetadata(builder, toolResult.metadata);
      currentMessages.push({
        role: 'system',
        content: `[Bootstrap ${stepPlan.toolName}]\n${this.buildToolResultForModel(stepPlan.toolName, toolResult)}`,
      });
      builder.finishStep(step.id, {
        detail: toolResult.success ? toolResult.output.slice(0, 240) : `Error: ${toolResult.output.slice(0, 240)}`,
        toolName: stepPlan.toolName,
        toolInputSummary: summarizeToolArgs(stepPlan.toolName, stepPlan.args),
        toolOutputPreview: truncateStreamPreview(toolOutput),
        filePaths: [
          ...(toolResult.metadata?.fileReads ?? []),
          ...(toolResult.metadata?.fileWrites ?? []),
          ...(toolResult.metadata?.fileDeletes ?? []),
        ],
        command: toolResult.metadata?.command?.command,
      }, toolResult.success ? 'done' : 'error');
      const finished = builder.snapshot().steps.find((entry) => entry.id === step.id);
      if (finished) {
        this.planner.upsertRunStep({
          id: finished.id,
          type: finished.type,
          title: finished.title,
          status: finished.status,
          detail: finished.detail,
          toolName: finished.toolName,
        });
        this.emitRunStep(handlers, builder.snapshot().id, finished);
      }
      this.emitRunMetric(handlers, builder.snapshot().id, builder.snapshot());
    }
    this.planner.setCurrentTool(undefined);
  }

  private async computeGitDiffStats(fallback: AgentRunLineStats | undefined): Promise<AgentRunLineStats | undefined> {
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--numstat', '--'], {
        cwd: this.config.workspaceRoot,
        maxBuffer: 1024 * 1024,
      });
      if (!stdout.trim()) {
        return fallback ?? { changedFiles: 0, addedLines: 0, removedLines: 0 };
      }

      const stats = stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .reduce((acc, line) => {
          const [added, removed] = line.split('\t');
          const addedValue = added === '-' ? 0 : Number(added) || 0;
          const removedValue = removed === '-' ? 0 : Number(removed) || 0;
          acc.changedFiles += 1;
          acc.addedLines += addedValue;
          acc.removedLines += removedValue;
          return acc;
        }, { changedFiles: 0, addedLines: 0, removedLines: 0 });

      return stats;
    } catch (error: any) {
      const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      if (message.includes('not a git repository')) {
        return fallback;
      }
      return fallback;
    }
  }

  private updateLatestTurnRunSummary(intent: TaskIntent, run: AgentRun) {
    if (!this.currentSession?.turnHistory?.length) {
      return;
    }

    const turnHistory = [...this.currentSession.turnHistory];
    const lastTurn = {
      ...turnHistory[turnHistory.length - 1],
      intent,
      summary: run.summary,
      firstTokenMs: run.metrics?.firstTokenMs,
      totalDurationMs: run.metrics?.totalMs,
      runSummary: run,
    };
    turnHistory[turnHistory.length - 1] = lastTurn;
    this.currentSession = {
      ...this.currentSession,
      turnHistory,
    };
  }

  private buildSessionMemoryMessage(latestUserMessage: string, maxChars: number): ChatMessage | null {
    if (!this.config.sessionMemoryEnabled || !this.currentSession?.turnHistory?.length) {
      return null;
    }

    const recentTurns = this.currentSession.turnHistory
      .filter((turn) => Boolean(turn.intent || turn.summary || turn.runSummary?.summary))
      .slice(-this.config.sessionMemoryTurns);

    if (recentTurns.length === 0) {
      return null;
    }

    const content = [
      '[Session Continuity]',
      'Use this only to stay on task and avoid repeating finished work.',
      `Latest user request: ${latestUserMessage.slice(0, 200)}`,
      ...recentTurns.map((turn) => {
        const stamp = new Date(turn.timestamp).toISOString().slice(0, 16).replace('T', ' ');
        const intent = turn.intent || turn.executionMode;
        const summary = turn.summary || turn.runSummary?.summary || 'Completed previous work.';
        return `- ${stamp} · ${intent} · ${summary}`;
      }),
    ].join('\n');

    const trimmed = trimPromptBlock(content, maxChars, '[Session continuity trimmed]');
    this.traceBus.emitEvent({
      type: 'session_memory_loaded',
      data: {
        turns: recentTurns.length,
        maxChars,
        latestIntent: recentTurns[recentTurns.length - 1]?.intent || null,
      },
    });
    return { role: 'system', content: trimmed };
  }

  private needsPostActionSelfCheck(run: AgentRun): boolean {
    if (!this.config.selfCheckEnabled) {
      return false;
    }

    const mutatingTools = new Set<SupportedTool>(['writeFile', 'patchFile', 'deleteFile', 'makeDir', 'runCommand']);
    const verificationTools = new Set<SupportedTool>(['readFile', 'gitDiff', 'gitStatus', 'listDir', 'searchText', 'runCommand']);
    let lastMutationIndex = -1;

    run.steps.forEach((step, index) => {
      if (step.type === 'tool' && step.toolName && mutatingTools.has(step.toolName as SupportedTool)) {
        lastMutationIndex = index;
      }
    });

    if (lastMutationIndex === -1) {
      return false;
    }

    return !run.steps.slice(lastMutationIndex + 1).some((step) =>
      step.type === 'tool' &&
      step.toolName !== undefined &&
      verificationTools.has(step.toolName as SupportedTool),
    );
  }

  private buildSelfCheckPrompt(run: AgentRun, manualToolProtocol: boolean): string {
    const touchedPaths = [
      ...run.filesWritten,
      ...run.filesDeleted,
      ...run.directoriesCreated,
    ].slice(-6);
    const recentCommands = run.commands.slice(-2).map((entry) => entry.command);

    return [
      '[Self Check]',
      'You changed workspace state or ran commands. Verify the result before final answer.',
      touchedPaths.length > 0 ? `Touched paths: ${touchedPaths.join(', ')}` : null,
      recentCommands.length > 0 ? `Recent commands: ${recentCommands.join(' | ')}` : null,
      manualToolProtocol
        ? 'Return exactly one JSON tool action to verify the result, then return {"final":"..."} when verification is complete.'
        : 'Use one verification tool call now (readFile, gitDiff, gitStatus, listDir, searchText, or runCommand) before the final answer.',
    ].filter(Boolean).join('\n');
  }

  private compactConversationMessages(
    messages: EngineChatMessage[],
    maxChars: number,
    executionMode: TurnExecutionMode,
  ): EngineChatMessage[] {
    const preserveTail = executionMode === 'direct' ? DIRECT_HISTORY_COMPACTION_TAIL : AGENT_HISTORY_COMPACTION_TAIL;
    return this.compactMessageList(
      messages,
      maxChars,
      preserveTail,
      '[Conversation Memory]',
      'conversation_context_compacted',
    );
  }

  private compactLoopMessages(messages: EngineChatMessage[], maxChars: number): EngineChatMessage[] {
    return this.compactMessageList(
      messages,
      maxChars,
      LOOP_CONTEXT_COMPACTION_TAIL,
      '[Loop Memory]',
      'loop_context_compacted',
    );
  }

  private compactMessageList(
    messages: EngineChatMessage[],
    maxChars: number,
    preserveTail: number,
    header: '[Conversation Memory]' | '[Loop Memory]',
    traceType: 'conversation_context_compacted' | 'loop_context_compacted',
  ): EngineChatMessage[] {
    const totalChars = messages.reduce((sum, message) => sum + (message.content?.length || 0), 0);
    if (!Number.isFinite(maxChars) || maxChars <= 0 || totalChars <= maxChars || messages.length <= preserveTail + 2) {
      return messages;
    }

    let prefixEnd = 0;
    while (prefixEnd < messages.length && messages[prefixEnd].role === 'system') {
      prefixEnd += 1;
    }

    const tailStart = Math.max(prefixEnd, messages.length - preserveTail);
    const prefix = messages.slice(0, prefixEnd);
    const compactable = messages
      .slice(prefixEnd, tailStart)
      .filter((message) => !(message.role === 'system' && (message.content || '').startsWith(header)));
    if (compactable.length === 0) {
      return messages;
    }

    const targetSummaryChars = Math.max(900, Math.floor(maxChars * 0.35));
    const summary = trimPromptBlock(
      [
        header,
        'Earlier context compacted to keep local-model runs stable.',
        ...compactable.map((message) => summarizeCompactedMessage(message)),
      ].join('\n'),
      targetSummaryChars,
      `${header} trimmed`,
    );
    const nextMessages: EngineChatMessage[] = [
      ...prefix,
      { role: 'system', content: summary },
      ...messages.slice(tailStart),
    ];

    this.traceBus.emitEvent({
      type: traceType,
      data: {
        header,
        originalMessages: messages.length,
        compactedMessages: nextMessages.length,
        originalChars: totalChars,
        compactedChars: nextMessages.reduce((sum, message) => sum + (message.content?.length || 0), 0),
      },
    });
    return nextMessages;
  }

  private replaceMessageBuffer(target: EngineChatMessage[], replacement: EngineChatMessage[]) {
    target.splice(0, target.length, ...replacement);
  }

  private toolContextBudget(toolName: SupportedTool): number {
    const budget = normalizeIntegerSetting(this.config.contextBudget, DEFAULT_ENGINE_CONFIG.contextBudget, 4000);
    switch (toolName) {
      case 'readFile':
        return Math.min(12_000, Math.max(4_500, Math.floor(budget * 0.55)));
      case 'gitDiff':
      case 'searchText':
      case 'fetchUrl':
      case 'webSearch':
      case 'runCommand':
        return Math.min(9_000, Math.max(3_500, Math.floor(budget * 0.4)));
      default:
        return Math.min(6_000, Math.max(2_500, Math.floor(budget * 0.28)));
    }
  }

  private buildToolResultForModel(toolName: SupportedTool, result: ToolResult): string {
    const output = result.output || 'No output';
    const preview = result.preview ? compactContextLine(result.preview, 280) : null;
    const body = trimPromptBlock(output, this.toolContextBudget(toolName), `[${toolName} output truncated for model context]`);
    return [
      `[Tool ${toolName} result]`,
      preview ? `Preview: ${preview}` : null,
      body,
    ].filter((entry): entry is string => Boolean(entry)).join('\n');
  }

  private shouldContinueTruncatedResponse(
    finishReason: string | undefined,
    content: string,
    continuationCount: number,
  ): boolean {
    return finishReason === 'length' && continuationCount < MAX_RESPONSE_CONTINUATIONS && content.trim().length > 0;
  }

  private buildContinuationPrompt(executionMode: TurnExecutionMode): string {
    return [
      '[Continuation]',
      `Previous ${executionMode} reply hit output limit.`,
      'Continue exactly from the last unfinished point.',
      'Do not restart, reframe, or repeat earlier text unless needed for one incomplete sentence.',
    ].join('\n');
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
          name: 'webSearch',
          description: 'Search the web for current information or external documentation',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'The web search query' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'fetchUrl',
          description: 'Fetch readable text from a specific http or https URL',
          parameters: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'The URL to fetch' }
            },
            required: ['url']
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
          name: 'replaceRange',
          description: 'Replace inclusive 1-based line range in a file. Prefer this when exact oldContent replacement is fragile.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file' },
              startLine: { type: 'number', description: '1-based start line' },
              endLine: { type: 'number', description: '1-based inclusive end line' },
              newContent: { type: 'string', description: 'Replacement text for the line range' }
            },
            required: ['filePath', 'startLine', 'endLine', 'newContent']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'insertAfter',
          description: 'Insert text after the first matching anchor text in a file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file' },
              anchorText: { type: 'string', description: 'Anchor text to insert after' },
              newContent: { type: 'string', description: 'Text to insert' }
            },
            required: ['filePath', 'anchorText', 'newContent']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'insertBefore',
          description: 'Insert text before the first matching anchor text in a file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file' },
              anchorText: { type: 'string', description: 'Anchor text to insert before' },
              newContent: { type: 'string', description: 'Text to insert' }
            },
            required: ['filePath', 'anchorText', 'newContent']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'replaceBlock',
          description: 'Replace text from anchorStart through anchorEnd in a file.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path to the file' },
              anchorStart: { type: 'string', description: 'Start anchor included in replacement' },
              anchorEnd: { type: 'string', description: 'End anchor included in replacement' },
              newContent: { type: 'string', description: 'Replacement text' }
            },
            required: ['filePath', 'anchorStart', 'anchorEnd', 'newContent']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'applyUnifiedPatch',
          description: 'Apply a unified diff patch after approval. Prefer small patches.',
          parameters: {
            type: 'object',
            properties: {
              patchText: { type: 'string', description: 'Unified diff text' }
            },
            required: ['patchText']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'previewPatch',
          description: 'Preview a diff from before/after text without writing.',
          parameters: {
            type: 'object',
            properties: {
              filePath: { type: 'string', description: 'The path used in the diff label' },
              before: { type: 'string', description: 'Original content' },
              after: { type: 'string', description: 'Proposed content' }
            },
            required: ['filePath', 'before', 'after']
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

  async directChat(messages: ChatMessage[], options?: { signal?: AbortSignal; think?: boolean }): Promise<string> {
    return this.runDirectChat(messages, undefined, options);
  }

  async directChatStream(messages: ChatMessage[], handlers: ChatStreamHandlers, options?: { signal?: AbortSignal; think?: boolean }): Promise<string> {
    return this.runDirectChat(messages, handlers, options);
  }

  private async runDirectChat(
    messages: ChatMessage[],
    handlers?: ChatStreamHandlers,
    options?: { signal?: AbortSignal; think?: boolean },
  ): Promise<string> {
    const currentMessages = this.compactConversationMessages(
      messages as EngineChatMessage[],
      Math.max(6_000, Math.floor(this.config.contextBudget * 0.65)),
      'direct',
    );
    await this.recordTurnExecution('direct', {
      promptMode: 'general',
      messageCount: messages.length,
      thinkingEnabled: options?.think === true,
    });
    this.planner.setTaskSummary('Intent: direct chat');
    this.planner.setPhase('direct');
    this.planner.setRuntimeContext({
      ...this.buildPlannerRuntimeContext(),
      workspaceSource: 'backend',
      workspaceBound: true,
      toolProtocol: 'native',
    });
    this.planner.setCurrentTool(undefined);
    this.planner.setIntendedAction('Generating assistant response');
    this.emitChatStatus(handlers, 'mode', 'Direct chat mode', 0);
    this.emitChatStatus(handlers, 'model', 'Generating assistant response', 0);
    let response = '';
    let continuationCount = 0;
    const directOutputBudget = LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile]?.outputBudgetDirect
      ?? LOCAL_MODEL_BUDGET_PROFILES.lean.outputBudgetDirect;

    while (true) {
      let message: EngineChatMessage | undefined;
      let finishReason: string | undefined;

      if (handlers) {
        message = await this.streamAssistantMessage(
          currentMessages,
          handlers,
          undefined,
          directOutputBudget,
          undefined,
          options?.signal,
          options?.think,
        ) as EngineChatMessage | undefined;
        finishReason = typeof message?.finish_reason === 'string' ? message.finish_reason : undefined;
      } else {
        const result = await this.modelAdapter.createChatCompletion({
          messages: currentMessages,
          stream: false,
          max_tokens: directOutputBudget,
          think: options?.think,
          signal: options?.signal,
        });
        message = {
          ...(result?.choices?.[0]?.message ?? {}),
          finish_reason: result?.choices?.[0]?.finish_reason,
        } as EngineChatMessage;
        finishReason = typeof result?.choices?.[0]?.finish_reason === 'string' ? result.choices[0].finish_reason : undefined;
      }

      const content = composeAssistantContent((message ?? {}) as Record<string, unknown>);
      response += content;

      if (!content) {
        break;
      }

      currentMessages.push({ role: 'assistant', content });
      if (!this.shouldContinueTruncatedResponse(finishReason, content, continuationCount)) {
        break;
      }

      continuationCount += 1;
      this.traceBus.emitEvent({
        type: 'response_continuation_requested',
        data: {
          executionMode: 'direct',
          attempt: continuationCount,
          finishReason,
        },
      });
      this.planner.setPhase('continuation');
      this.planner.setIntendedAction('Continuing truncated response');
      this.emitChatStatus(handlers, 'continuation', 'Continuing truncated response', continuationCount);
      currentMessages.push({ role: 'system', content: this.buildContinuationPrompt('direct') });
      this.replaceMessageBuffer(
        currentMessages,
        this.compactLoopMessages(currentMessages, Math.max(this.config.contextBudget, 12_000)),
      );
    }

    this.planner.setPhase('ready');
    this.planner.setIntendedAction('Awaiting user input');
    this.emitChatStatus(handlers, 'ready', 'Awaiting user input', continuationCount);
    return response;
  }

  private emitChatStatus(handlers: ChatStreamHandlers | undefined, phase: string, action: string, loop: number) {
    this.planner.setStatusNote(action);
    handlers?.onStatus?.({ phase, action, loop });
  }

  private emitChatToolEvent(
    handlers: ChatStreamHandlers | undefined,
    event: ChatToolEvent,
  ) {
    handlers?.onTool?.(event);
  }

  private emitChatApprovalEvent(
    handlers: ChatStreamHandlers | undefined,
    event: ChatApprovalEvent,
  ) {
    handlers?.onApproval?.(event);
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
    onFirstToken?: () => void,
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
        finish_reason: result?.choices?.[0]?.finish_reason,
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
      if (!message.content) {
        onFirstToken?.();
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
        message.finish_reason = choice.finish_reason;
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

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };
    const refreshIdleTimer = () => {
      clearIdleTimer();
      if (!Number.isFinite(this.config.streamIdleTimeoutMs) || this.config.streamIdleTimeoutMs <= 0) {
        return;
      }
      idleTimer = setTimeout(() => {
        reader.cancel(createStreamIdleTimeoutError(Boolean(message.content))).catch(() => {});
      }, this.config.streamIdleTimeoutMs);
    };

    try {
      refreshIdleTimer();
      while (true) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch (error) {
          if (!isStreamIdleTimeoutError(error)) {
            throw error;
          }

          if (!error.receivedContent) {
            this.traceBus.emitEvent({
              type: 'stream_idle_timeout_retry',
              data: {
                timeoutMs: this.config.streamIdleTimeoutMs,
                receivedContent: false,
              },
            });
            const result = await this.modelAdapter.createChatCompletion({
              messages: currentMessages,
              stream: false,
              tools,
              max_tokens: maxTokens,
              reasoning_effort: reasoningEffort,
              think,
              signal,
            });
            const fallbackMessage = result?.choices?.[0]?.message;
            if (!fallbackMessage) {
              throw error;
            }
            const composed = composeAssistantContent(fallbackMessage as Record<string, unknown>);
            if (composed) {
              handlers.onDelta?.(composed);
            }
            return {
              ...fallbackMessage,
              content: composed,
            };
          }

          this.traceBus.emitEvent({
            type: 'stream_idle_timeout_partial',
            data: {
              timeoutMs: this.config.streamIdleTimeoutMs,
              receivedContent: true,
            },
          });
          break;
        }
        const { done, value } = chunk;
        if (done) {
          break;
        }

        refreshIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          processLine(line);
        }
      }

      clearIdleTimer();
      buffer += decoder.decode();
      if (buffer.trim()) {
        processLine(buffer);
      }
    } finally {
      clearIdleTimer();
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
    const workspaceBound = !browserFolderContextActive;
    const workspaceSource = workspaceBound ? 'backend' as const : 'browser_snapshot' as const;
    const promptMode = this.choosePromptMode(messages);
    const requestMessages = this.compactConversationMessages(
      messages as EngineChatMessage[],
      Math.max(5_000, Math.floor(this.config.contextBudget * 0.55)),
      'agentic',
    );
    const intentStartedAt = Date.now();
    const intentDecision = classifyIntent({
      latestUserMessage,
      browserContextActive: browserFolderContextActive,
      workspaceBound,
    });
    const classificationMs = Date.now() - intentStartedAt;

    await this.recordTurnExecution('agentic', {
      promptMode,
      messageCount: messages.length,
      thinkingEnabled: options?.think === true,
    });
    const runBuilder = new AgentRunBuilder({
      id: createRunId(),
      sessionId: this.currentSession!.id,
      startedAt: Date.now(),
      executionMode: 'agentic',
      workspaceRoot: this.config.workspaceRoot,
      workspaceSource,
      model: this.config.model,
      promptMode,
      intent: intentDecision.intent,
      browserContextActive: browserFolderContextActive,
      workspaceBound,
      usedNativeTools: false,
      usedManualFallback: false,
      steps: [],
      filesRead: [],
      directoriesRead: [],
      filesWritten: [],
      filesDeleted: [],
      directoriesCreated: [],
      searches: [],
      webSearches: [],
      webFetches: [],
      commands: [],
      approvals: [],
      metrics: {
        classificationMs,
      },
    });
    const runId = runBuilder.snapshot().id;
    this.planner.startRun(runId);
    this.planner.setTaskSummary(`Intent: ${intentDecision.intent}`);
    this.planner.setPhase('planning');
    this.planner.setRuntimeContext({
      ...this.buildPlannerRuntimeContext(),
      workspaceSource,
      workspaceBound,
    });
    this.planner.setActiveSkills(mergeSkills(this.currentSession?.skillsActive ?? [], this.selectOperationalSkills(intentDecision.intent, promptMode)));
    this.planner.setIntendedAction('Classifying request');

    this.emitChatStatus(
      streamHandlers,
      'mode',
      workspaceBound ? 'Agentic coding mode' : 'Snapshot-only analysis mode',
      0,
    );
    this.emitRunStarted(streamHandlers, {
      type: 'run_started',
      runId,
      sessionId: this.currentSession!.id,
      intent: intentDecision.intent,
      workspaceBound,
      browserContextActive: browserFolderContextActive,
      workspaceSource,
      executionMode: 'agentic',
    });

    const classifyStep = runBuilder.startNamedStep('classify', 'Classify request', intentDecision.reasons.join(' '));
    runBuilder.finishStep(classifyStep.id, {
      detail: `${intentDecision.intent} (${intentDecision.confidence})`,
    });
    const classified = runBuilder.snapshot().steps.find((entry) => entry.id === classifyStep.id);
    if (classified) {
      this.planner.upsertRunStep({
        id: classified.id,
        type: classified.type,
        title: classified.title,
        status: classified.status,
        detail: classified.detail,
      });
      this.emitRunStep(streamHandlers, runId, classified);
    }

    let loopCount = 0;
    const traceListener = (event: TraceEvent) => {
      if (event.type === 'approval_enqueued') {
        const approval = event.data as ApprovalRequestPayload;
        runBuilder.recordApprovalRequested({
          id: approval.id,
          target: approval.target,
          approved: null,
        });
        this.emitChatApprovalEvent(streamHandlers, {
          type: 'approval',
          state: 'pending',
          approval: {
            ...approval,
            approved: null,
          },
        });
        this.emitChatStatus(streamHandlers, 'approval', `Approval required for ${approval.target}`, loopCount);
        this.emitRunMetric(streamHandlers, runId, runBuilder.snapshot());
      } else if (event.type === 'approval_preview_updated') {
        const approval = event.data as { id: string; preview?: string };
        this.emitChatApprovalEvent(streamHandlers, {
          type: 'approval',
          state: 'updated',
          approval: {
            id: approval.id,
            diffPreview: approval.preview,
          },
        });
	      } else if (event.type === 'approval_resolved') {
	        const approval = event.data as { id: string; response?: { approved?: boolean } };
	        const approved = approval.response?.approved ?? null;
        runBuilder.recordApprovalResolved(approval.id, approved);
        this.emitChatApprovalEvent(streamHandlers, {
          type: 'approval',
          state: 'resolved',
          approval: {
            id: approval.id,
            approved,
          },
        });
        this.emitChatStatus(
          streamHandlers,
          'approval',
          approved === true ? `Approval granted for ${approval.id}` : `Approval rejected for ${approval.id}`,
          loopCount,
	        );
	        this.emitRunMetric(streamHandlers, runId, runBuilder.snapshot());
	      }
	      if (STREAM_TASK_TRACE_TYPES.has(event.type)) {
	        streamHandlers?.onTrace?.(event);
	      }
	    };
	    this.traceBus.on('trace', traceListener);

	    let taskContext: TaskContext | null = null;
	    let taskPlan = this.taskOrchestrator.createPlan({
	      userRequest: latestUserMessage,
	      intent: intentDecision.intent,
	      workspaceRoot: this.config.workspaceRoot,
	      knownFiles: [],
	    });
	    let currentTaskStep: TaskStep | null = null;
	    const lastToolResults: RunCheckpoint['lastToolResults'] = [];

	    const rememberToolResult = (tool: string, result: ToolResult) => {
	      lastToolResults.push({
	        tool,
	        success: result.success,
	        outputPreview: truncateStreamPreview(result.output || ''),
	      });
	      while (lastToolResults.length > 8) {
	        lastToolResults.shift();
	      }
	    };

	    const buildCheckpoint = (): RunCheckpoint => {
	      const run = runBuilder.snapshot();
	      return {
	        runId,
	        sessionId: this.currentSession!.id,
	        taskPlan,
	        currentStepId: currentTaskStep?.id,
	        completedSteps: taskPlan.steps.filter((entry) => entry.status === 'done' || entry.status === 'skipped').map((entry) => entry.id),
	        failedSteps: taskPlan.steps.filter((entry) => entry.status === 'failed').map((entry) => entry.id),
	        blockedSteps: taskPlan.steps.filter((entry) => entry.status === 'blocked').map((entry) => entry.id),
	        filesRead: run.filesRead,
	        filesWritten: run.filesWritten,
	        filesDeleted: run.filesDeleted,
	        commandsRun: run.commands.map((entry) => entry.command),
	        approvals: run.approvals,
	        summarySoFar: this.taskOrchestrator.summarizeProgress(taskPlan),
	        lastToolResults: [...lastToolResults],
	        createdAt: run.startedAt,
	        updatedAt: Date.now(),
	      };
	    };

	    const persistCheckpoint = async () => {
	      const checkpointPath = await this.saveRunCheckpoint(buildCheckpoint());
	      this.planner.emitTaskCheckpoint(runId, checkpointPath);
	    };

	    const startTaskStep = async (preferredStep?: TaskStep | null): Promise<TaskStep | null> => {
	      const nextStep = preferredStep ?? this.taskOrchestrator.getNextStep(taskPlan);
	      if (!nextStep || nextStep.status !== 'pending') {
	        return currentTaskStep;
	      }
	      taskPlan = this.taskOrchestrator.markStepRunning(taskPlan, nextStep.id);
	      currentTaskStep = taskPlan.steps.find((entry) => entry.id === nextStep.id) ?? null;
	      if (currentTaskStep) {
	        this.planner.markTaskStepStarted(runId, taskPlan, currentTaskStep);
	        this.emitChatStatus(streamHandlers, currentTaskStep.type, currentTaskStep.title, loopCount);
	        await persistCheckpoint();
	      }
	      return currentTaskStep;
	    };

	    const completeCurrentTaskStep = async (detail?: string) => {
	      if (!currentTaskStep) {
	        return;
	      }
	      const stepId = currentTaskStep.id;
	      taskPlan = this.taskOrchestrator.markStepDone(taskPlan, stepId, detail);
	      const completedStep = taskPlan.steps.find((entry) => entry.id === stepId);
	      if (completedStep) {
	        this.planner.markTaskStepCompleted(runId, taskPlan, completedStep);
	      }
	      currentTaskStep = null;
	      await persistCheckpoint();
	    };

	    const failCurrentTaskStep = async (error: string) => {
	      if (!currentTaskStep) {
	        return;
	      }
	      const stepId = currentTaskStep.id;
	      taskPlan = this.taskOrchestrator.markStepFailed(taskPlan, stepId, error);
	      const failedStep = taskPlan.steps.find((entry) => entry.id === stepId);
	      if (failedStep) {
	        this.planner.markTaskStepFailed(runId, taskPlan, failedStep, error);
	      }
	      await persistCheckpoint();
	    };

	    const finishTaskPlan = async (reason: string) => {
	      if (currentTaskStep) {
	        await completeCurrentTaskStep(reason);
	      }
	      for (const pendingStep of taskPlan.steps.filter((entry) => entry.status === 'pending')) {
	        taskPlan = this.taskOrchestrator.markStepSkipped(taskPlan, pendingStep.id, `Skipped: ${reason}`);
	      }
	      this.planner.updateTaskPlan(runId, taskPlan);
	      await persistCheckpoint();
	    };

	    this.planner.setTaskPlan(runId, taskPlan);
	    taskContext = workspaceBound
	      ? await this.repoIndexer.buildTaskContext({
	          userRequest: latestUserMessage,
	          intent: intentDecision.intent,
	          complexity: taskPlan.complexity,
	        }).catch(() => null)
	      : null;
		    await persistCheckpoint();
	    const initialTaskStep = await startTaskStep();
	    if (initialTaskStep && (initialTaskStep.type === 'intake' || initialTaskStep.type === 'inspect')) {
	      await completeCurrentTaskStep(taskContext ? `Task context selected: ${taskContext.taskArea}` : 'No backend task context available');
	    }

	    const finalizeRun = async (baseAnswer: string, error?: string): Promise<string> => {
	      await finishTaskPlan(error ? `Run ended with error: ${error}` : 'Run finalized');
	      const gitStats = await this.computeGitDiffStats(runBuilder.snapshot().git);
      runBuilder.setGitStats(gitStats);
      const summary = summarizeRun(runBuilder.snapshot());
      runBuilder.finalize({
        finalAnswer: baseAnswer,
        summary,
        error,
      });
      const completedRun = runBuilder.snapshot();
      this.updateLatestTurnRunSummary(intentDecision.intent, completedRun);
      this.planner.setRunSummary({
        id: completedRun.id,
        summary: completedRun.summary,
        changedFiles: completedRun.git?.changedFiles,
        addedLines: completedRun.git?.addedLines,
        removedLines: completedRun.git?.removedLines,
      });
      this.emitRunMetric(streamHandlers, runId, completedRun);
      this.emitRunSummary(streamHandlers, runId, completedRun);
      await this.persistCurrentSession();
      return buildFinalAnswer(baseAnswer, completedRun);
    };

    try {
      if (!browserFolderContextActive && this.isStatusOnlyWorkspaceQuestion(latestUserMessage)) {
        const localAnswer = await this.tryAnswerFromLocalState(latestUserMessage);
        if (localAnswer !== null) {
          this.completeImmediateResponse(streamHandlers, localAnswer);
          return await finalizeRun(localAnswer.content);
        }
      }

      if (intentDecision.intent === 'workspace_binding_needed') {
        const bindingAnswer = [
          'Workspace is browser snapshot only.',
          'I can inspect snapshot and suggest edits.',
          'To write files or run commands, bind real backend workspace first.',
        ].join(' ');
        this.completeImmediateResponse(streamHandlers, {
          content: bindingAnswer,
          action: 'Explaining workspace binding requirement',
          source: 'workspace_binding',
        });
        return await finalizeRun(bindingAnswer);
      }

      const directWorkspaceAnswer = workspaceBound
        ? await this.tryAnswerFromDirectWorkspaceTools(latestUserMessage)
        : null;
      if (directWorkspaceAnswer !== null) {
        this.completeImmediateResponse(streamHandlers, directWorkspaceAnswer);
        return await finalizeRun(directWorkspaceAnswer.content);
      }

      const localRepoOverviewAnswer = workspaceBound
        ? await this.tryAnswerFromLocalRepoOverview(latestUserMessage)
        : null;
      if (localRepoOverviewAnswer !== null) {
        this.completeImmediateResponse(streamHandlers, localRepoOverviewAnswer);
        return await finalizeRun(localRepoOverviewAnswer.content);
      }

      const useStepScopedContext = ['multi_file', 'architecture_change', 'repo_wide_audit'].includes(taskPlan.complexity);
      const includeWorkspaceContext = workspaceBound && this.isWorkspaceQuestion(latestUserMessage, promptMode);
      const includeRepoContext = workspaceBound && !useStepScopedContext && this.shouldIncludeRepoContext(latestUserMessage, promptMode);
      const selectedToolNames = workspaceBound ? this.selectToolNames(latestUserMessage, promptMode) : [];
      const modelCapabilities = await this.modelAdapter.getModelCapabilities(this.config.model);
      const toolProtocol = await this.selectToolProtocol(selectedToolNames, modelCapabilities);
      const rootManifestAnswer = workspaceBound && !['workspace_overview', 'review_diff', 'find_file', 'read_file', 'search_text'].includes(intentDecision.intent)
        ? await this.tryAnswerFromRootManifest(latestUserMessage)
        : null;
      if (rootManifestAnswer !== null) {
        this.completeImmediateResponse(streamHandlers, rootManifestAnswer);
        return await finalizeRun(rootManifestAnswer.content);
      }

      let manualToolProtocol = toolProtocol.manualToolProtocol;
      let manualProtocolPromptInjected = manualToolProtocol;
      this.planner.setRuntimeContext({
        toolProtocol: manualToolProtocol ? 'manual' : 'native',
      });
      let nativeToolDefinitions = selectedToolNames.length > 0 && !manualToolProtocol
        ? this.getToolDefinitions(selectedToolNames)
        : undefined;
      const activeTaskStepForModel = await startTaskStep();
      const stepOutputBudget = activeTaskStepForModel?.budget.maxOutputTokens;
      const maxTokens = manualToolProtocol
        ? Math.min(256, stepOutputBudget ?? this.selectMaxTokens(latestUserMessage, promptMode, selectedToolNames.length > 0))
        : Math.min(stepOutputBudget ?? Number.MAX_SAFE_INTEGER, this.selectMaxTokens(latestUserMessage, promptMode, selectedToolNames.length > 0));
      const reasoningEffort = manualToolProtocol
        ? 'none'
        : this.selectReasoningEffort(latestUserMessage, promptMode, modelCapabilities);

      if (toolProtocol.mode !== 'native') {
        runBuilder.markManualFallback(toolProtocol.reason);
      }

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
        this.emitChatStatus(streamHandlers, 'mode', 'Manual tool protocol forced', 0);
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
          workspaceBound,
          workspaceSource,
          intent: intentDecision.intent,
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
                'Inspect minimum files needed before editing.',
                'Use exactly one JSON tool action at a time.',
                'After tool results, decide next single action or return {"final":"..."} .',
              ].join('\n'),
            },
            ...requestMessages,
          ]
        : this.applyPromptOptimization(
            requestMessages,
            promptMode,
            includeRepoContext || promptMode !== 'quick_inspect' || (selectedToolNames.length > 0 && !manualToolProtocol),
          );

      const runtimeContract: ChatMessage = {
        role: 'system',
        content: [
          '[Harness Runtime]',
          `Intent: ${intentDecision.intent}`,
          `Workspace source: ${workspaceSource}`,
          `Workspace bound: ${workspaceBound ? 'yes' : 'no'}`,
          `Available tools: ${selectedToolNames.length > 0 ? selectedToolNames.join(', ') : 'none'}`,
          `Tool protocol: ${manualToolProtocol ? 'manual' : 'native'}`,
          `Task complexity: ${taskPlan.complexity}`,
          `Local budget profile: ${this.config.localModelBudgetProfile}`,
          `Context budget: ${LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile].contextBudget} tokens target`,
          `Output budget for this step: ${maxTokens}`,
          `Retry budget: ${this.config.toolRetryMax}`,
          `Session memory: ${this.config.sessionMemoryEnabled ? `${this.config.sessionMemoryTurns} recent turns` : 'off'}`,
          `Self-check: ${this.config.selfCheckEnabled ? 'required after edits or commands' : 'off'}`,
          'If workspace tools are available and the request is about repo behavior, inspect workspace facts before asking the user for more detail.',
          'For complex tasks, do not solve the whole project in one response. Work only the current task step.',
          'Never simulate tool execution or file changes.',
          'Finish with concise answer, What I did, and Files changed.',
        ].join('\n'),
      };

      const currentMessages: EngineChatMessage[] = [
        ...(await this.buildContextMessages(requestMessages, promptMode, includeWorkspaceContext, includeRepoContext)) as EngineChatMessage[],
        runtimeContract,
        { role: 'system' as const, content: buildStepScopedPrompt(taskPlan, currentTaskStep, taskContext) },
        ...(manualToolProtocol ? [{ role: 'system' as const, content: this.buildManualToolProtocol(selectedToolNames) }] : []),
        ...promptMessages,
      ];

      if (workspaceBound) {
        await this.executeBootstrapPlan(
          this.buildBootstrapPlan(intentDecision, promptMode, selectedToolNames),
          currentMessages,
          streamHandlers,
          runBuilder,
        );
      }

      let streamedToolEventCounter = 0;
      const nextStreamToolEventId = () => `tool-${++streamedToolEventCounter}`;
      let manualBootstrapTool = manualToolProtocol && workspaceBound
        ? await this.inferManualBootstrapTool(latestUserMessage, promptMode, selectedToolNames)
        : null;
      const budgetProfile = LOCAL_MODEL_BUDGET_PROFILES[this.config.localModelBudgetProfile] ?? LOCAL_MODEL_BUDGET_PROFILES.lean;
      const maxLoopTarget = intentDecision.intent === 'edit_code'
        ? 5
        : intentDecision.intent === 'run_command'
          ? 4
          : 3;
      const MAX_LOOPS = Math.min(budgetProfile.maxModelCallsPerRun, taskPlan.complexity === 'architecture_change' ? Math.max(maxLoopTarget, 6) : maxLoopTarget);
      let manualProtocolCorrectionCount = 0;
      let planningOnlyNativeRetryCount = 0;
      let simulatedToolReplyCount = 0;
      let selfCheckPromptCount = 0;
      let responseContinuationCount = 0;
      let firstModelCallRecorded = false;
      let firstTokenRecorded = false;
      const toolRetryMax = Math.max(1, this.config.toolRetryMax);

      while (loopCount < MAX_LOOPS) {
        if (manualToolProtocol && manualBootstrapTool) {
          const bootstrapDecision = manualBootstrapTool;
          manualBootstrapTool = null;
          loopCount += 1;
          runBuilder.setLoopCount(loopCount);
          await startTaskStep();
          const toolStep = runBuilder.startNamedStep('tool', `Bootstrap ${bootstrapDecision.name}`);
          this.planner.upsertRunStep({
            id: toolStep.id,
            type: toolStep.type,
            title: toolStep.title,
            status: toolStep.status,
            toolName: bootstrapDecision.name,
          });
          this.emitRunStep(streamHandlers, runId, toolStep);
          this.planner.setPhase('execution');
          this.planner.setCurrentTool(bootstrapDecision.name);
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
            const toolResult = await this.executeToolCall(bootstrapDecision.name, bootstrapDecision.args, runId);
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
            this.recordRunToolMetadata(runBuilder, toolResult.metadata);
            rememberToolResult(bootstrapDecision.name, toolResult);
            currentMessages.push({
              role: 'user',
              content: this.formatManualToolResult(
                bootstrapDecision.name,
                this.buildToolResultForModel(bootstrapDecision.name, toolResult),
              ),
            });
            runBuilder.finishStep(toolStep.id, {
              toolName: bootstrapDecision.name,
              toolInputSummary: summarizeToolArgs(bootstrapDecision.name, bootstrapDecision.args),
              toolOutputPreview: truncateStreamPreview(streamedOutput),
              command: toolResult.metadata?.command?.command,
            }, toolResult.success ? 'done' : 'error');
            if (toolResult.success) {
              await completeCurrentTaskStep(`${bootstrapDecision.name} completed`);
            }
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
            runBuilder.finishStep(toolStep.id, {
              detail: error.message,
              toolName: bootstrapDecision.name,
              toolInputSummary: summarizeToolArgs(bootstrapDecision.name, bootstrapDecision.args),
            }, 'error');
          }
          const finishedBootstrap = runBuilder.snapshot().steps.find((entry) => entry.id === toolStep.id);
          if (finishedBootstrap) {
            this.planner.upsertRunStep({
              id: finishedBootstrap.id,
              type: finishedBootstrap.type,
              title: finishedBootstrap.title,
              status: finishedBootstrap.status,
              detail: finishedBootstrap.detail,
              toolName: finishedBootstrap.toolName,
            });
            this.emitRunStep(streamHandlers, runId, finishedBootstrap);
          }
          this.emitRunMetric(streamHandlers, runId, runBuilder.snapshot());
          continue;
        }

        loopCount += 1;
        runBuilder.setLoopCount(loopCount);
        await startTaskStep();
        currentMessages.push({
          role: 'system',
          content: buildStepScopedPrompt(taskPlan, currentTaskStep, taskContext),
        });
        this.planner.setPhase('model');
        this.planner.setCurrentTool(undefined);
        this.planner.setIntendedAction(loopCount === 1 ? 'Generating assistant response' : 'Processing tool results');
        this.emitChatStatus(
          streamHandlers,
          'model',
          loopCount === 1 ? 'Generating assistant response' : 'Processing tool results',
          loopCount,
        );
        this.replaceMessageBuffer(
          currentMessages,
          this.compactLoopMessages(currentMessages, Math.max(this.config.contextBudget, 12_000)),
        );
        this.traceBus.emitEvent({
          type: 'chat_request',
          data: {
            messageCount: currentMessages.length,
            loop: loopCount,
            profile: this.config.profile,
            intent: intentDecision.intent,
          },
        });
        const modelStep = runBuilder.startNamedStep('model', loopCount === 1 ? 'Generate response' : 'Continue response');
        this.planner.upsertRunStep({
          id: modelStep.id,
          type: modelStep.type,
          title: modelStep.title,
          status: modelStep.status,
        });
        this.emitRunStep(streamHandlers, runId, modelStep);
        if (!firstModelCallRecorded) {
          firstModelCallRecorded = true;
          runBuilder.setMetric({
            firstModelCallMs: Date.now() - runBuilder.snapshot().startedAt,
          });
        }

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
              () => {
                if (!firstTokenRecorded) {
                  firstTokenRecorded = true;
                  runBuilder.setMetric({
                    firstTokenMs: Date.now() - runBuilder.snapshot().startedAt,
                  });
                  this.emitRunMetric(streamHandlers, runId, runBuilder.snapshot());
                }
              },
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
          if (errorMessage.includes('does not support tools') || errorMessage.includes('tools is not supported')) {
            nativeToolDefinitions = undefined;
            manualToolProtocol = selectedToolNames.length > 0;
            if (manualToolProtocol) {
              runBuilder.markManualFallback(errorMessage);
            }
            this.traceBus.emitEvent({
              type: 'tools_unsupported',
              data: { model: this.config.model, reason: errorMessage },
            });
            this.traceBus.emitEvent({
              type: 'manual_tool_fallback',
              data: {
                model: this.config.model,
                reason: errorMessage,
                manualToolProtocol,
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
            runBuilder.finishStep(modelStep.id, { detail: errorMessage }, 'skipped');
            const fallbackStep = runBuilder.startNamedStep('fallback', 'Switch to manual fallback', errorMessage);
            runBuilder.finishStep(fallbackStep.id, { detail: errorMessage }, 'done');
            const finishedFallback = runBuilder.snapshot().steps.find((entry) => entry.id === fallbackStep.id);
            if (finishedFallback) {
              this.planner.upsertRunStep({
                id: finishedFallback.id,
                type: finishedFallback.type,
                title: finishedFallback.title,
                status: finishedFallback.status,
                detail: finishedFallback.detail,
              });
              this.emitRunStep(streamHandlers, runId, finishedFallback);
            }
            continue;
          }
          runBuilder.finishStep(modelStep.id, { detail: errorMessage }, 'error');
          throw error;
        }

        if (!message) {
          runBuilder.finishStep(modelStep.id, { detail: 'Model returned no message.' }, 'error');
          break;
        }

        message.content = composeAssistantContent(message as Record<string, unknown>);
        const finishReason = typeof (message as { finish_reason?: unknown }).finish_reason === 'string'
          ? (message as { finish_reason: string }).finish_reason
          : typeof result?.choices?.[0]?.finish_reason === 'string'
            ? result.choices[0].finish_reason
            : undefined;
        currentMessages.push(message);

        if (nativeToolDefinitions && message.tool_calls && message.tool_calls.length > 0) {
          responseContinuationCount = 0;
          runBuilder.markNativeToolsUsed();
          runBuilder.finishStep(modelStep.id, { detail: `Requested ${message.tool_calls.length} tool call(s).` }, 'done');
          const finishedModelStep = runBuilder.snapshot().steps.find((entry) => entry.id === modelStep.id);
          if (finishedModelStep) {
            this.planner.upsertRunStep({
              id: finishedModelStep.id,
              type: finishedModelStep.type,
              title: finishedModelStep.title,
              status: finishedModelStep.status,
              detail: finishedModelStep.detail,
            });
            this.emitRunStep(streamHandlers, runId, finishedModelStep);
          }
          this.planner.setPhase('execution');
          this.emitChatStatus(streamHandlers, 'execution', 'Executing tool calls', loopCount);

          for (const toolCall of message.tool_calls) {
            await startTaskStep();
            const name = toolCall.function.name as SupportedTool;
            const toolStep = runBuilder.startNamedStep('tool', `Execute ${name}`);
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
              runBuilder.finishStep(toolStep.id, {
                detail: error.message,
                toolName: name,
              }, 'error');
              continue;
            }
            this.planner.setCurrentTool(name);
            this.planner.setIntendedAction(`Executing ${name}`);
            this.planner.upsertRunStep({
              id: toolStep.id,
              type: toolStep.type,
              title: toolStep.title,
              status: toolStep.status,
              toolName: name,
            });
            this.emitRunStep(streamHandlers, runId, toolStep);
            this.emitChatStatus(streamHandlers, 'execution', `Executing ${name}`, loopCount);
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name,
              state: 'start',
              inputSummary: summarizeToolArgs(name, args),
            });

            try {
              const toolResult = await this.executeToolCall(name, args, runId);
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
              this.recordRunToolMetadata(runBuilder, toolResult.metadata);
              rememberToolResult(name, toolResult);
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name,
                content: this.buildToolResultForModel(name, toolResult),
              });
              runBuilder.finishStep(toolStep.id, {
                toolName: name,
                toolInputSummary: summarizeToolArgs(name, args),
                toolOutputPreview: truncateStreamPreview(streamedOutput),
                filePaths: [
                  ...(toolResult.metadata?.fileReads ?? []),
                  ...(toolResult.metadata?.fileWrites ?? []),
                  ...(toolResult.metadata?.fileDeletes ?? []),
                ],
                command: toolResult.metadata?.command?.command,
              }, toolResult.success ? 'done' : 'error');
              if (toolResult.success) {
                await completeCurrentTaskStep(`${name} completed`);
              }
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
              runBuilder.finishStep(toolStep.id, {
                detail: error.message,
                toolName: name,
                toolInputSummary: summarizeToolArgs(name, args),
              }, 'error');
            }
            const finishedToolStep = runBuilder.snapshot().steps.find((entry) => entry.id === toolStep.id);
            if (finishedToolStep) {
              this.planner.upsertRunStep({
                id: finishedToolStep.id,
                type: finishedToolStep.type,
                title: finishedToolStep.title,
                status: finishedToolStep.status,
                detail: finishedToolStep.detail,
                toolName: finishedToolStep.toolName,
              });
              this.emitRunStep(streamHandlers, runId, finishedToolStep);
            }
            this.emitRunMetric(streamHandlers, runId, runBuilder.snapshot());
          }
          continue;
        }

        const response = extractTextSegment(message.content);
        const visibleResponse = response.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        const planningOnlyResponse = Boolean(
          nativeToolDefinitions &&
          selectedToolNames.length > 0 &&
          response.includes('<think>') &&
          visibleResponse.length === 0,
        );
        if (planningOnlyResponse) {
          const retryReason = 'Model returned planning-only text without executing tools.';
          runBuilder.finishStep(modelStep.id, { detail: retryReason }, 'skipped');
          const finishedPlanningOnlyStep = runBuilder.snapshot().steps.find((entry) => entry.id === modelStep.id);
          if (finishedPlanningOnlyStep) {
            this.planner.upsertRunStep({
              id: finishedPlanningOnlyStep.id,
              type: finishedPlanningOnlyStep.type,
              title: finishedPlanningOnlyStep.title,
              status: finishedPlanningOnlyStep.status,
              detail: finishedPlanningOnlyStep.detail,
            });
            this.emitRunStep(streamHandlers, runId, finishedPlanningOnlyStep);
          }

          if (planningOnlyNativeRetryCount < toolRetryMax) {
            planningOnlyNativeRetryCount += 1;
            this.traceBus.emitEvent({
              type: 'native_tool_retry_requested',
              data: {
                model: this.config.model,
                reason: retryReason,
                promptMode,
                selectedTools: selectedToolNames,
              },
            });
            currentMessages.push({
              role: 'system',
              content: RECIPES.nativeToolNudge(),
            });
            continue;
          }

          nativeToolDefinitions = undefined;
          manualToolProtocol = selectedToolNames.length > 0;
          if (manualToolProtocol) {
            runBuilder.markManualFallback(retryReason);
            this.traceBus.emitEvent({
              type: 'manual_tool_fallback',
              data: {
                model: this.config.model,
                reason: retryReason,
                manualToolProtocol: true,
                selectedTools: selectedToolNames,
              },
            });
            this.emitChatStatus(streamHandlers, 'warning', 'Native tool retry failed; manual fallback active', loopCount);
            if (!manualProtocolPromptInjected) {
              currentMessages.push({
                role: 'system',
                content: this.buildManualToolProtocol(selectedToolNames),
              });
              manualProtocolPromptInjected = true;
            }
            continue;
          }
        }

        runBuilder.finishStep(modelStep.id, {
          detail: response.slice(0, 240) || 'No natural-language response.',
        }, 'done');
        const finishedModelStep = runBuilder.snapshot().steps.find((entry) => entry.id === modelStep.id);
        if (finishedModelStep) {
          this.planner.upsertRunStep({
            id: finishedModelStep.id,
            type: finishedModelStep.type,
            title: finishedModelStep.title,
            status: finishedModelStep.status,
            detail: finishedModelStep.detail,
          });
          this.emitRunStep(streamHandlers, runId, finishedModelStep);
        }
        await completeCurrentTaskStep('Model step completed');

        if (this.shouldContinueTruncatedResponse(finishReason, response, responseContinuationCount)) {
          responseContinuationCount += 1;
          this.traceBus.emitEvent({
            type: 'response_continuation_requested',
            data: {
              runId,
              executionMode: 'agentic',
              attempt: responseContinuationCount,
              finishReason,
            },
          });
          this.planner.setPhase('continuation');
          this.planner.setCurrentTool(undefined);
          this.planner.setIntendedAction('Continuing truncated response');
          this.emitChatStatus(streamHandlers, 'continuation', 'Continuing truncated response', loopCount);
          currentMessages.push({
            role: 'system',
            content: this.buildContinuationPrompt('agentic'),
          });
          continue;
        }
        responseContinuationCount = 0;

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

            if (simulatedToolReplyCount < toolRetryMax) {
              currentMessages.push({
                role: 'system',
                content: RECIPES.manualToolCorrection(),
              });
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
            return await finalizeRun(`${warning} Retry request or switch models.`, warning);
          }

          const manualDecision = this.parseManualToolResponse(response, selectedToolNames);
          if (manualDecision?.kind === 'tool') {
            await startTaskStep();
            const toolStep = runBuilder.startNamedStep('tool', `Execute ${manualDecision.name}`);
            this.planner.setPhase('execution');
            this.planner.setCurrentTool(manualDecision.name);
            this.planner.setIntendedAction(`Executing ${manualDecision.name}`);
            this.planner.upsertRunStep({
              id: toolStep.id,
              type: toolStep.type,
              title: toolStep.title,
              status: toolStep.status,
              toolName: manualDecision.name,
            });
            this.emitRunStep(streamHandlers, runId, toolStep);
            this.emitChatStatus(streamHandlers, 'execution', `Executing ${manualDecision.name}`, loopCount);

            const toolEventId = nextStreamToolEventId();
            this.emitChatToolEvent(streamHandlers, {
              id: toolEventId,
              name: manualDecision.name,
              state: 'start',
              inputSummary: summarizeToolArgs(manualDecision.name, manualDecision.args),
            });
            try {
              const toolResult = await this.executeToolCall(manualDecision.name, manualDecision.args, runId);
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
              this.recordRunToolMetadata(runBuilder, toolResult.metadata);
              rememberToolResult(manualDecision.name, toolResult);
              currentMessages.push({
                role: 'user',
                content: this.formatManualToolResult(
                  manualDecision.name,
                  this.buildToolResultForModel(manualDecision.name, toolResult),
                ),
              });
              runBuilder.finishStep(toolStep.id, {
                toolName: manualDecision.name,
                toolInputSummary: summarizeToolArgs(manualDecision.name, manualDecision.args),
                toolOutputPreview: truncateStreamPreview(streamedOutput),
                command: toolResult.metadata?.command?.command,
              }, toolResult.success ? 'done' : 'error');
              if (toolResult.success) {
                await completeCurrentTaskStep(`${manualDecision.name} completed`);
              }
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
              runBuilder.finishStep(toolStep.id, {
                detail: error.message,
                toolName: manualDecision.name,
              }, 'error');
            }
            const finishedManualToolStep = runBuilder.snapshot().steps.find((entry) => entry.id === toolStep.id);
            if (finishedManualToolStep) {
              this.planner.upsertRunStep({
                id: finishedManualToolStep.id,
                type: finishedManualToolStep.type,
                title: finishedManualToolStep.title,
                status: finishedManualToolStep.status,
                detail: finishedManualToolStep.detail,
                toolName: finishedManualToolStep.toolName,
              });
              this.emitRunStep(streamHandlers, runId, finishedManualToolStep);
            }
            this.emitRunMetric(streamHandlers, runId, runBuilder.snapshot());
            continue;
          }

          if (manualDecision?.kind === 'final') {
            if (selfCheckPromptCount < toolRetryMax && this.needsPostActionSelfCheck(runBuilder.snapshot())) {
              selfCheckPromptCount += 1;
              this.traceBus.emitEvent({
                type: 'self_check_requested',
                data: {
                  runId,
                  manualToolProtocol: true,
                  touchedPaths: [...runBuilder.snapshot().filesWritten, ...runBuilder.snapshot().filesDeleted, ...runBuilder.snapshot().directoriesCreated],
                },
              });
              this.planner.setPhase('verification');
              this.planner.setIntendedAction('Verifying changes before final answer');
              this.emitChatStatus(streamHandlers, 'verification', 'Verifying changes before final answer', loopCount);
              currentMessages.push({
                role: 'system',
                content: this.buildSelfCheckPrompt(runBuilder.snapshot(), true),
              });
              continue;
            }

            this.planner.setPhase('ready');
            this.planner.setCurrentTool(undefined);
            this.planner.setIntendedAction('Awaiting user input');
            this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
            this.traceBus.emitEvent({
              type: 'chat_response',
              data: { length: manualDecision.content.length, manualToolProtocol: true },
            });
            return await finalizeRun(manualDecision.content);
          }

          if (selectedToolNames.length > 0 && manualProtocolCorrectionCount < toolRetryMax) {
            manualProtocolCorrectionCount += 1;
            currentMessages.push({
              role: 'system',
              content: RECIPES.manualToolCorrection(),
            });
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

          if (simulatedToolReplyCount < toolRetryMax) {
            currentMessages.push({
              role: 'system',
              content: RECIPES.toolCorrection(),
            });
            continue;
          }

          const warning = 'Model attempted to simulate tool usage in plain text. No tools were executed.';
          this.planner.setPhase('ready');
          this.planner.setCurrentTool(undefined);
          this.planner.setIntendedAction('Awaiting user input');
          this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
          this.traceBus.emitEvent({
            type: 'chat_response',
            data: { length: warning.length, simulatedTools: true },
          });
          return await finalizeRun(`${warning} Retry request or switch models.`, warning);
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

        if (selfCheckPromptCount < toolRetryMax && this.needsPostActionSelfCheck(runBuilder.snapshot())) {
          selfCheckPromptCount += 1;
          this.traceBus.emitEvent({
            type: 'self_check_requested',
            data: {
              runId,
              manualToolProtocol: false,
              touchedPaths: [...runBuilder.snapshot().filesWritten, ...runBuilder.snapshot().filesDeleted, ...runBuilder.snapshot().directoriesCreated],
            },
          });
          this.planner.setPhase('verification');
          this.planner.setCurrentTool(undefined);
          this.planner.setIntendedAction('Verifying changes before final answer');
          this.emitChatStatus(streamHandlers, 'verification', 'Verifying changes before final answer', loopCount);
          currentMessages.push({
            role: 'system',
            content: this.buildSelfCheckPrompt(runBuilder.snapshot(), false),
          });
          continue;
        }

        this.planner.setPhase('ready');
        this.planner.setCurrentTool(undefined);
        this.planner.setIntendedAction('Awaiting user input');
        this.emitChatStatus(streamHandlers, 'ready', 'Awaiting user input', loopCount);
        this.traceBus.emitEvent({
          type: 'chat_response',
          data: { length: response.length, intent: intentDecision.intent },
        });

        return await finalizeRun(response);
      }

      const limitWarning = 'Maximum tool execution loops reached or no response from model.';
      this.planner.emitTaskBudgetExceeded(runId, 'maxModelCallsPerRun');
      this.planner.failRun(limitWarning);
      return await finalizeRun(limitWarning, limitWarning);
    } catch (error: any) {
      await failCurrentTaskStep(error?.message || 'Agentic run failed.');
      this.planner.failRun(error?.message || 'Agentic run failed.');
      throw error;
    } finally {
      this.traceBus.off('trace', traceListener);
    }
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

  async webSearch(query: string) {
    return this.runTool('webSearch', query);
  }

  async fetchUrl(url: string) {
    return this.runTool('fetchUrl', url);
  }

  async writeFile(filePath: string, content: string) {
    return this.runTool('writeFile', filePath, content);
  }

  async patchFile(filePath: string, oldContent: string, newContent: string) {
    return this.runTool('patchFile', filePath, oldContent, newContent);
  }

  async replaceRange(filePath: string, startLine: number, endLine: number, newContent: string) {
    this.ensureToolAllowed('replaceRange');
    const result = await this.toolRegistry.replaceRange(filePath, startLine, endLine, newContent);
    await this.persistCurrentSession();
    return result;
  }

  async insertAfter(filePath: string, anchorText: string, newContent: string) {
    return this.runTool('insertAfter', filePath, anchorText, newContent);
  }

  async insertBefore(filePath: string, anchorText: string, newContent: string) {
    return this.runTool('insertBefore', filePath, anchorText, newContent);
  }

  async replaceBlock(filePath: string, anchorStart: string, anchorEnd: string, newContent: string) {
    return this.runTool('replaceBlock', filePath, anchorStart, anchorEnd, newContent);
  }

  async applyUnifiedPatch(patchText: string) {
    return this.runTool('applyUnifiedPatch', patchText);
  }

  async previewPatch(filePath: string, before: string, after: string) {
    return this.runTool('previewPatch', filePath, before, after);
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
