import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ApprovalQueue } from '../components/approvals/ApprovalQueue';
import { ChatMessageRow } from '../components/ChatMessageRow';
import { RunConsole } from '../components/run-console/RunConsole';
import { useStreamingBuffer } from '../hooks/useStreamingBuffer';
import type { RunApprovalItem, TaskComplexity, TaskPlan } from '../types/run';

/* ─────────── API helpers ─────────── */
function getApiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  const { protocol, hostname, port } = window.location;
  if (port === '5173' || port === '4173') return `${protocol}//${hostname}:3001/api`;
  return '/api';
}

const API = getApiBase();
const MAX_PREVIEW_CHARS = 120_000;
const MAX_BROWSER_CONTEXT_CHARS = 48_000;
const MAX_BROWSER_TREE_LINES = 220;
const MAX_IMAGE_ATTACHMENTS = 2;
const MAX_IMAGE_BYTES = 1024 * 1024;
const AGENTIC_STORAGE_KEY = 'gamma-harness.agentic-mode';
const LIVE_REFRESH_MS = 6000;
const ACTIVE_RUN_REFRESH_MS = 1500;
const FULL_REFRESH_MS = 45000;

/* ─────────── Types ─────────── */
type ChatRole = 'user' | 'assistant';
type ConversationMode = 'general' | 'architecture' | 'data-analysis' | 'code-review' | 'implementation';
type BackendStatus = 'ok' | 'degraded' | 'offline';
type SettingsTab = 'connection' | 'workspace' | 'sessions' | 'activity' | 'agent';
type ExecutionMode = 'direct' | 'agentic';

interface ChatToolEvent {
  id: string;
  name: string;
  state: 'start' | 'done';
  inputSummary: string;
  output?: string;
  success?: boolean;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  mode: ConversationMode;
  executionMode: ExecutionMode;
  createdAt: number;
  activity: string[];
  toolEvents: ChatToolEvent[];
  status?: 'sending' | 'streaming' | 'sent' | 'error';
  attachments?: MessageImageAttachment[];
  runSummary?: AgentRunSummary;
  runSteps?: AgentRunStep[];
}

interface MessageImageAttachment {
  id: string;
  name: string;
  dataUrl: string;
}

interface ComposerImageAttachment extends MessageImageAttachment {
  base64: string;
}

interface ConfigState {
  baseUrl: string;
  model: string;
  profile: string;
  mode: string;
  workspaceRoot: string;
  sessionDataDir: string;
  internetAccessEnabled: boolean;
  streamIdleTimeoutMs: number;
  contextBudget: number;
  toolRetryMax: number;
  sessionMemoryEnabled: boolean;
  sessionMemoryTurns: number;
  selfCheckEnabled: boolean;
  localModelBudgetProfile?: 'lean' | 'balanced' | 'deep';
  localModelBudget?: {
    contextBudget: number;
    outputBudgetDirect: number;
    outputBudgetInspect: number;
    outputBudgetEdit: number;
    outputBudgetComplexPlan: number;
    outputBudgetFinalReport: number;
    maxModelCallsPerRun: number;
    maxToolCallsPerRun: number;
  };
}

interface SessionState {
  id: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  mode: string;
  cwd: string;
  skillsActive: string[];
  toolsAllowlist: string[];
  turnHistory?: Array<{
    timestamp: number;
    executionMode: 'direct' | 'agentic';
    promptMode?: string;
    messageCount: number;
    thinkingEnabled?: boolean;
    imageCount?: number;
    intent?: string;
    summary?: string;
    runSummary?: {
      summary?: string;
      workspaceSource?: 'backend' | 'browser_snapshot';
      workspaceBound?: boolean;
    };
  }>;
}

interface TraceEntry {
  id?: string;
  type: string;
  data: unknown;
  timestamp: number;
}

type ApprovalItem = RunApprovalItem;

interface PlanState {
  taskSummary: string;
  currentPhase: string;
  activeSkills: string[];
  intendedNextAction: string;
  blockers: string[];
  isComplete: boolean;
  finalOutcome?: string;
  workspaceRoot?: string;
  workspaceSource?: 'backend' | 'browser_snapshot';
  workspaceBound?: boolean;
  toolProtocol?: 'native' | 'manual';
  internetAccessEnabled?: boolean;
  contextBudget?: number;
  toolRetryMax?: number;
  sessionMemoryEnabled?: boolean;
  sessionMemoryTurns?: number;
  selfCheckEnabled?: boolean;
  lastStatus?: string;
  currentRunId?: string;
  currentTool?: string;
  taskPlan?: TaskPlan;
  currentStepId?: string;
  complexity?: TaskComplexity;
  stepProgress?: {
    total: number;
    completed: number;
    failed: number;
    blocked: number;
  };
  runSteps?: Array<{
    id: string;
    type: string;
    title: string;
    status: 'running' | 'done' | 'error' | 'skipped';
    detail?: string;
    toolName?: string;
  }>;
  runSummary?: {
    id: string;
    summary?: string;
    changedFiles?: number;
    addedLines?: number;
    removedLines?: number;
  };
}

interface TraceHeadlineData {
  state?: { intendedNextAction?: string; currentPhase?: string };
  step?: { title?: string; toolName?: string };
  plan?: { title?: string };
  message?: string;
  reason?: string;
  summary?: string;
  preview?: string;
  timeoutMs?: number;
  fileCount?: number;
  intent?: string;
  toolProtocolMode?: string;
  runId?: string;
  budgetType?: string;
  tool?: string;
  command?: string;
  outputPreview?: string;
  error?: string;
  success?: boolean;
}

interface RunTracePayload {
  runId?: string;
  plan?: TaskPlan;
  step?: TaskPlan['steps'][number];
  error?: string;
  reason?: string;
  budgetType?: string;
  tool?: string;
  inputSummary?: string;
  outputPreview?: string;
  command?: string;
}

interface SkillMetadata {
  slug: string;
  title: string;
  division: string;
  description: string;
  recommendedUse: string;
  riskLevel: string;
}

interface AvailableModel {
  id: string;
  object?: string;
  owned_by?: string;
  created?: number;
}

interface RunningModel {
  name: string;
  model: string;
  expires_at?: string;
  context_length?: number;
  details?: {
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface ModelRuntimeState {
  configuredModel: string;
  activeModel: string | null;
  runningModels: RunningModel[];
  installedModels: string[];
  availableModels: AvailableModel[];
  supportsLifecycle: boolean;
  configuredModelCapabilities?: string[];
  lastSwitchResult?: {
    message: string;
    previousModel: string | null;
    requestedModel: string;
    activeModel: string | null;
    runningModels: RunningModel[];
    unloadedModels: string[];
    loadedModel: string | null;
    supportsLifecycle: boolean;
  };
}

interface RepoContext {
  cwd: string;
  files: string[];
  manifests: Record<string, string>;
  readmes: Record<string, string>;
  entryPoints: string[];
  summary: string;
}

interface AgentRunStep {
  id: string;
  type: string;
  title: string;
  detail?: string;
  status: 'running' | 'done' | 'error' | 'skipped';
  toolName?: string;
  toolInputSummary?: string;
  toolOutputPreview?: string;
  command?: string;
}

interface AgentRunSummary {
  id: string;
  intent: string;
  workspaceSource: 'backend' | 'browser_snapshot';
  workspaceBound: boolean;
  browserContextActive: boolean;
  filesRead: string[];
  directoriesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  directoriesCreated: string[];
  searches: Array<{ query: string; pattern?: string }>;
  webSearches: Array<{ query: string; engine: string; resultCount: number }>;
  webFetches: Array<{ url: string; title?: string }>;
  commands: Array<{ command: string; success: boolean; durationMs?: number }>;
  approvals: Array<{ id: string; target: string; approved: boolean | null }>;
  git?: {
    changedFiles: number;
    addedLines: number;
    removedLines: number;
  };
  metrics?: {
    totalMs?: number;
    firstTokenMs?: number;
  };
  usedManualFallback: boolean;
  fallbackReason?: string;
  summary?: string;
  steps: AgentRunStep[];
}

interface BrowserFileNode {
  kind: 'file';
  name: string;
  path: string;
  file?: File;
  size: number;
}

interface BrowserDirectoryNode {
  kind: 'directory';
  name: string;
  path: string;
  children: BrowserNode[];
}

type BrowserNode = BrowserFileNode | BrowserDirectoryNode;

interface BrowserSelection {
  label: string;
  root: BrowserDirectoryNode;
  fileCount: number;
  totalBytes: number;
  source: 'directory-picker' | 'folder-input' | 'workspace';
}

interface WorkspaceResolveResponse {
  resolved: boolean;
  workspaceRoot: string;
  matchedFiles: number;
  candidateCount: number;
  config: ConfigState;
}

interface BrowserPreview {
  path: string;
  name: string;
  size: number;
  content: string;
  lineCount: number;
  truncated: boolean;
}

type ChatStreamEvent =
  | { type: 'status'; phase: string; action: string; loop: number }
  | ({ type: 'tool' } & ChatToolEvent)
  | { type: 'approval'; state: 'pending' | 'updated' | 'resolved'; approval: ApprovalItem }
  | { type: 'run_started'; runId: string; sessionId: string; intent: string; workspaceBound: boolean; browserContextActive: boolean; workspaceSource: 'backend' | 'browser_snapshot'; executionMode: ExecutionMode }
  | { type: 'run_step'; runId: string; step: AgentRunStep }
  | { type: 'run_metric'; runId: string; metrics: Partial<{ filesRead: number; directoriesRead: number; filesWritten: number; commandsRun: number; searchesRun: number; approvals: number; addedLines: number; removedLines: number; firstTokenMs: number; totalMs: number }> }
  | { type: 'run_summary'; runId: string; summary: AgentRunSummary }
  | { type: 'task_plan_created'; data: { runId: string; plan: TaskPlan }; id?: string; timestamp?: number }
  | { type: 'task_step_started'; data: { runId: string; step: TaskPlan['steps'][number] }; id?: string; timestamp?: number }
  | { type: 'task_step_completed'; data: { runId: string; step: TaskPlan['steps'][number] }; id?: string; timestamp?: number }
  | { type: 'task_step_failed'; data: { runId: string; step: TaskPlan['steps'][number]; error: string }; id?: string; timestamp?: number }
  | { type: 'task_step_blocked'; data: { runId: string; step: TaskPlan['steps'][number]; reason: string }; id?: string; timestamp?: number }
  | { type: 'task_checkpoint_saved'; data: { runId: string; checkpointPath?: string }; id?: string; timestamp?: number }
  | { type: 'task_budget_exceeded'; data: { runId: string; budgetType: string }; id?: string; timestamp?: number }
  | { type: 'task_plan_completed'; data: { runId: string; plan?: TaskPlan }; id?: string; timestamp?: number }
  | { type: 'tool_call_started'; data: { runId?: string; tool: string; inputSummary: string }; id?: string; timestamp?: number }
  | { type: 'tool_call_completed'; data: { runId?: string; tool: string; success: boolean; outputPreview: string }; id?: string; timestamp?: number }
  | { type: 'verification_started'; data: { runId: string; command?: string }; id?: string; timestamp?: number }
  | { type: 'verification_completed'; data: { runId: string; success: boolean; outputPreview: string }; id?: string; timestamp?: number }
  | { type: 'delta'; delta: string }
  | { type: 'done'; response: string }
  | { type: 'error'; message: string };

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>;
}

interface BrowserDirectoryHandle {
  kind: 'directory';
  name: string;
  path?: string;
  values(): AsyncIterable<BrowserHandle>;
}

interface BrowserFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

type BrowserHandle = BrowserDirectoryHandle | BrowserFileHandle;
type BrowserFileLike = File & { webkitRelativePath?: string; path?: string };

/* ─────────── Constants ─────────── */
const CHAT_MODES: Array<{ id: ConversationMode; label: string }> = [
  { id: 'general', label: 'General' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'data-analysis', label: 'Data Analysis' },
  { id: 'code-review', label: 'Code Review' },
  { id: 'implementation', label: 'Implementation' },
];

const SETTINGS_TABS: Array<{ id: SettingsTab; label: string }> = [
  { id: 'connection', label: 'Runtime' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'agent', label: 'Agent' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'activity', label: 'Activity' },
];

const AGENT_PRESETS: Array<{
  id: 'lean' | 'balanced' | 'autonomous';
  title: string;
  note: string;
  values: Pick<ConfigState, 'contextBudget' | 'toolRetryMax' | 'sessionMemoryEnabled' | 'sessionMemoryTurns' | 'selfCheckEnabled' | 'internetAccessEnabled' | 'streamIdleTimeoutMs'>;
}> = [
  {
    id: 'lean',
    title: 'Lean Local',
    note: 'Fast local loop. Tight context. Minimal retries.',
    values: {
      contextBudget: 16000,
      toolRetryMax: 1,
      sessionMemoryEnabled: true,
      sessionMemoryTurns: 2,
      selfCheckEnabled: true,
      internetAccessEnabled: false,
      streamIdleTimeoutMs: 30000,
    },
  },
  {
    id: 'balanced',
    title: 'Balanced Harness',
    note: 'Good default. Memory on. Verifies edits.',
    values: {
      contextBudget: 24000,
      toolRetryMax: 2,
      sessionMemoryEnabled: true,
      sessionMemoryTurns: 3,
      selfCheckEnabled: true,
      internetAccessEnabled: true,
      streamIdleTimeoutMs: 45000,
    },
  },
  {
    id: 'autonomous',
    title: 'Deep Agent',
    note: 'Bigger context and more retries for long task runs.',
    values: {
      contextBudget: 32000,
      toolRetryMax: 4,
      sessionMemoryEnabled: true,
      sessionMemoryTurns: 5,
      selfCheckEnabled: true,
      internetAccessEnabled: true,
      streamIdleTimeoutMs: 60000,
    },
  },
];

/* ─────────── Utility functions ─────────── */
function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, init).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Failed to read file.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function streamNdjson(url: string, init: RequestInit, onEvent: (event: ChatStreamEvent) => void): Promise<void> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (!response.body) {
    const fallback = await response.json() as { response?: string };
    if (typeof fallback.response === 'string') {
      onEvent({ type: 'done', response: fallback.response });
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        onEvent(JSON.parse(trimmed) as ChatStreamEvent);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      onEvent(JSON.parse(buffer.trim()) as ChatStreamEvent);
    }
  } finally {
    reader.releaseLock();
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes, i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(ts: number): string {
  const deltaMs = Math.max(0, Date.now() - ts);
  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatSessionTitle(entry: SessionState): string {
  const latest = entry.turnHistory?.[entry.turnHistory.length - 1];
  const intent = latest?.intent || latest?.promptMode || latest?.summary;
  if (intent) return shortenText(intent, 42);
  return shortenText(entry.id, 18);
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function shortenText(val: string, max = 44): string {
  if (val.length <= max) return val;
  const h = Math.max(10, Math.floor((max - 3) / 2));
  const t = Math.max(8, max - h - 3);
  return `${val.slice(0, h)}...${val.slice(-t)}`;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const TASK_TRACE_EVENT_TYPES = new Set<ChatStreamEvent['type']>([
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

function isRunTraceEvent(event: ChatStreamEvent): event is Extract<ChatStreamEvent, { data: unknown }> {
  return TASK_TRACE_EVENT_TYPES.has(event.type);
}

function calculateStepProgress(taskPlan?: TaskPlan) {
  const steps = taskPlan?.steps || [];
  return {
    total: steps.length,
    completed: steps.filter((step) => step.status === 'done').length,
    failed: steps.filter((step) => step.status === 'failed').length,
    blocked: steps.filter((step) => step.status === 'blocked').length,
  };
}

function patchTaskStep(taskPlan: TaskPlan | undefined, step: TaskPlan['steps'][number]): TaskPlan | undefined {
  if (!taskPlan) return undefined;
  return {
    ...taskPlan,
    updatedAt: Date.now(),
    steps: taskPlan.steps.map((entry) => entry.id === step.id ? step : entry),
  };
}

function getPermissionModeSummary(mode: string | undefined): string {
  switch (mode) {
    case 'read-only':
      return 'Reads only. Writes, deletes, and commands denied.';
    case 'danger':
      return 'No approvals inside workspace. Outside-workspace actions still denied.';
    default:
      return 'Writes preview + approval. Deletes and commands require approval.';
  }
}

function summarizeTurnIntent(turn: NonNullable<SessionState['turnHistory']>[number] | undefined): string {
  if (!turn) return 'No recent turn';
  if (turn.runSummary?.summary) return turn.runSummary.summary;
  if (turn.promptMode) return `${turn.executionMode} · ${turn.promptMode}`;
  return `${turn.executionMode} turn`;
}

function formatTraceHeadline(trace: TraceEntry): string {
  const data = trace.data as TraceHeadlineData | undefined;
  switch (trace.type) {
    case 'planner_trace':
      return data?.state?.intendedNextAction || data?.state?.currentPhase || 'Planner updated';
    case 'run_step_started':
    case 'run_step_finished':
      return data?.step?.title || data?.step?.toolName || 'Run step';
    case 'run_summary_ready':
      return data?.summary || 'Run summary ready';
    case 'manual_tool_fallback':
      return data?.reason || 'Manual fallback active';
    case 'manual_tool_strategy_selected':
      return data?.reason || 'Manual tool strategy selected';
    case 'tool_simulation_detected':
      return data?.preview || 'Tool simulation detected';
    case 'stream_idle_timeout_retry':
      return `Stream stalled after ${data?.timeoutMs ?? 0}ms; retrying non-stream`;
    case 'stream_idle_timeout_partial':
      return `Stream stalled after ${data?.timeoutMs ?? 0}ms with partial output`;
    case 'repo_context_loaded':
      return `${data?.fileCount ?? 0} files indexed`;
    case 'chat_execution_plan':
      return `Intent ${data?.intent || 'unknown'} · ${data?.toolProtocolMode || 'native'} tools`;
    case 'task_plan_created':
      return `Plan created: ${data?.plan?.title || data?.runId || 'task'}`;
    case 'task_step_started':
      return `Step running: ${data?.step?.title || 'task step'}`;
    case 'task_step_completed':
      return `Step done: ${data?.step?.title || 'task step'}`;
    case 'task_step_failed':
      return `Step failed: ${data?.step?.title || data?.error || 'task step'}`;
    case 'task_step_blocked':
      return `Step blocked: ${data?.step?.title || data?.reason || 'task step'}`;
    case 'task_checkpoint_saved':
      return `Checkpoint saved: ${data?.runId || 'run'}`;
    case 'task_budget_exceeded':
      return `Budget exceeded: ${data?.budgetType || 'run'}`;
    case 'task_plan_completed':
      return `Plan completed: ${data?.plan?.title || data?.runId || 'run'}`;
    case 'tool_call_started':
      return `Tool started: ${data?.tool || 'tool'}`;
    case 'tool_call_completed':
      return `Tool ${data?.success === false ? 'failed' : 'completed'}: ${data?.tool || 'tool'}`;
    case 'verification_started':
      return `Verification started: ${data?.command || 'check'}`;
    case 'verification_completed':
      return `Verification ${data?.success ? 'passed' : 'failed'}`;
    case 'model_switch_completed':
      return data?.message || 'Model switch completed';
    default:
      return typeof data?.message === 'string'
        ? data.message
        : typeof data?.reason === 'string'
          ? data.reason
          : typeof data?.summary === 'string'
            ? data.summary
            : 'Open for payload';
  }
}

function truncatePreview(content: string) {
  if (content.length <= MAX_PREVIEW_CHARS) return { content, truncated: false };
  return { content: content.slice(0, MAX_PREVIEW_CHARS) + '\n\n[Truncated]', truncated: true };
}

function getPathBasename(targetPath: string): string {
  const trimmed = targetPath.replace(/[\\/]+$/, '');
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || targetPath;
}

function insertWorkspaceFile(root: BrowserDirectoryNode, relPath: string): void {
  const segs = relPath.split(/[\\/]/).filter(Boolean);
  if (!segs.length) return;

  let cur = root;
  let curPath = '';

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const nextPath = curPath ? `${curPath}/${seg}` : seg;

    if (i === segs.length - 1) {
      cur.children.push({ kind: 'file', name: seg, path: nextPath, size: 0 });
      return;
    }

    let child = cur.children.find((c): c is BrowserDirectoryNode => c.kind === 'directory' && c.name === seg);
    if (!child) {
      child = { kind: 'directory', name: seg, path: nextPath, children: [] };
      cur.children.push(child);
    }
    cur = child;
    curPath = nextPath;
  }
}

function buildWorkspaceSelection(workspaceRoot: string | undefined, files: string[] | undefined): BrowserSelection | null {
  if (!workspaceRoot || !files || files.length === 0) return null;

  const root: BrowserDirectoryNode = { kind: 'directory', name: getPathBasename(workspaceRoot), path: '.', children: [] };
  for (const file of files) insertWorkspaceFile(root, file);
  sortChildren(root);
  return {
    label: workspaceRoot,
    root,
    fileCount: files.length,
    totalBytes: 0,
    source: 'workspace',
  };
}

function collectBrowserTreeLines(root: BrowserDirectoryNode, maxLines = MAX_BROWSER_TREE_LINES): string[] {
  const lines: string[] = [];

  const visit = (node: BrowserNode, depth: number) => {
    if (lines.length >= maxLines) return;
    const indent = '  '.repeat(depth);
    lines.push(node.kind === 'directory' ? `${indent}- ${node.name}/` : `${indent}- ${node.name}`);
    if (node.kind === 'directory') {
      for (const child of node.children) visit(child, depth + 1);
    }
  };

  visit(root, 0);
  if (lines.length >= maxLines) {
    lines.push('... tree truncated ...');
  }
  return lines;
}

function buildBrowserContextMessage(selection: BrowserSelection | null, preview: BrowserPreview | null): string | null {
  if (!selection) return null;

  const parts = [
    '[Browser Folder Context]',
    'Use this browser-picked folder as the primary read-only context for the current request.',
    'Important: this does not change the backend workspace path for tools or commands.',
    `Folder label: ${selection.label}`,
    `File count: ${selection.fileCount}`,
    `Total size: ${formatBytes(selection.totalBytes)}`,
    'Tree:',
    collectBrowserTreeLines(selection.root).join('\n'),
  ];

  if (preview) {
    parts.push(
      '[Selected Browser File]',
      `Path: ${preview.path}`,
      preview.truncated ? 'Preview: truncated' : 'Preview: complete',
      'Content:',
      preview.content,
    );
  }

  const message = parts.join('\n');
  if (message.length <= MAX_BROWSER_CONTEXT_CHARS) return message;
  return `${message.slice(0, MAX_BROWSER_CONTEXT_CHARS)}\n\n[Browser context truncated]`;
}

/* ─────────── Browser folder helpers ─────────── */
function sortChildren(node: BrowserDirectoryNode): void {
  node.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) if (c.kind === 'directory') sortChildren(c);
}

function insertFile(root: BrowserDirectoryNode, relPath: string, file: File): void {
  const segs = relPath.split('/').filter(Boolean);
  if (!segs.length) return;
  if (segs[0] === root.name) segs.shift();
  let cur = root, curPath = root.path;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i], nextPath = `${curPath}/${seg}`;
    if (i === segs.length - 1) {
      cur.children.push({ kind: 'file', name: seg, path: nextPath, file, size: file.size });
      return;
    }
    let child = cur.children.find((c): c is BrowserDirectoryNode => c.kind === 'directory' && c.name === seg);
    if (!child) { child = { kind: 'directory', name: seg, path: nextPath, children: [] }; cur.children.push(child); }
    cur = child; curPath = nextPath;
  }
}

function buildFromFiles(files: File[]): BrowserSelection | null {
  if (!files.length) return null;
  const first = files[0] as BrowserFileLike;
  const label = first.webkitRelativePath?.split('/')[0] || 'Selected folder';
  const root: BrowserDirectoryNode = { kind: 'directory', name: label, path: label, children: [] };
  let count = 0, bytes = 0;
  for (const f of files) {
    const rel = (f as BrowserFileLike).webkitRelativePath || f.name;
    insertFile(root, rel, f);
    count++; bytes += f.size;
  }
  sortChildren(root);
  return { label, root, fileCount: count, totalBytes: bytes, source: 'folder-input' };
}

function collectSelectionRelativeFiles(selection: BrowserSelection, maxFiles = 80): string[] {
  const results: string[] = [];

  const visit = (node: BrowserNode, prefix = '') => {
    if (results.length >= maxFiles) return;
    if (node.kind === 'file') {
      results.push(prefix ? `${prefix}/${node.name}` : node.name);
      return;
    }

    const nextPrefix = prefix ? `${prefix}/${node.name}` : node.name;
    for (const child of node.children) {
      visit(child, nextPrefix);
      if (results.length >= maxFiles) break;
    }
  };

  for (const child of selection.root.children) {
    visit(child);
    if (results.length >= maxFiles) break;
  }

  return results;
}

function stripTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, '');
}

function deriveNativeWorkspaceRootFromFiles(files: File[]): string | null {
  const first = files[0] as BrowserFileLike | undefined;
  if (!first?.path) return null;

  const nativePath = stripTrailingSeparators(first.path);
  const relativePath = ((first.webkitRelativePath || first.name) || '').replace(/\\/g, '/');
  if (!relativePath) return null;

  const normalizedNative = nativePath.replace(/\\/g, '/');
  if (normalizedNative.endsWith(relativePath)) {
    return stripTrailingSeparators(nativePath.slice(0, nativePath.length - relativePath.length));
  }

  const relativeSegments = relativePath.split('/').filter(Boolean).length;
  const nativeSegments = nativePath.split(/[\\/]/).filter(Boolean);
  if (nativeSegments.length <= relativeSegments) return null;

  const prefix = nativeSegments.slice(0, nativeSegments.length - relativeSegments).join('/');
  return stripTrailingSeparators(nativePath.startsWith('/') ? `/${prefix}` : prefix);
}

function pushActivityStep(current: string[], nextStep: string): string[] {
  const step = nextStep.trim();
  if (!step) return current;
  if (current[current.length - 1] === step) return current;
  return [...current, step];
}

function upsertToolEvent(current: ChatToolEvent[], next: ChatToolEvent): ChatToolEvent[] {
  const index = current.findIndex((entry) => entry.id === next.id);
  if (index === -1) return [...current, next];

  const updated = [...current];
  updated[index] = {
    ...updated[index],
    ...next,
    output: next.output ?? updated[index].output,
    success: next.success ?? updated[index].success,
  };
  return updated;
}

function upsertRunStep(current: AgentRunStep[], next: AgentRunStep): AgentRunStep[] {
  const index = current.findIndex((entry) => entry.id === next.id);
  if (index === -1) return [...current, next];

  const updated = [...current];
  updated[index] = {
    ...updated[index],
    ...next,
  };
  return updated;
}

function mergeApprovalEvent(current: ApprovalItem[], event: Extract<ChatStreamEvent, { type: 'approval' }>): ApprovalItem[] {
  if (event.state === 'resolved') {
    return current.filter((entry) => entry.id !== event.approval.id);
  }

  const index = current.findIndex((entry) => entry.id === event.approval.id);
  if (index === -1) {
    if (event.state !== 'pending') {
      return current;
    }
    return [...current, event.approval as ApprovalItem];
  }

  const next = [...current];
  next[index] = {
    ...next[index],
    ...event.approval,
    diffPreview: event.approval.diffPreview ?? next[index].diffPreview,
    warningMessage: event.approval.warningMessage ?? next[index].warningMessage,
  };
  return next;
}

async function buildFromHandle(handle: BrowserDirectoryHandle): Promise<BrowserSelection> {
  async function visit(h: BrowserDirectoryHandle, p: string): Promise<BrowserDirectoryNode> {
    const node: BrowserDirectoryNode = { kind: 'directory', name: h.name, path: p, children: [] };
    for await (const entry of h.values()) {
      if (entry.kind === 'directory') node.children.push(await visit(entry, `${p}/${entry.name}`));
      else { const f = await entry.getFile(); node.children.push({ kind: 'file', name: f.name || entry.name, path: `${p}/${entry.name}`, file: f, size: f.size }); }
    }
    sortChildren(node);
    return node;
  }
  const root = await visit(handle, handle.name);
  let count = 0, bytes = 0;
  const stack: BrowserNode[] = [root];
  while (stack.length) { const n = stack.pop()!; if (n.kind === 'file') { count++; bytes += n.size; } else stack.push(...n.children); }
  return { label: handle.name, root, fileCount: count, totalBytes: bytes, source: 'directory-picker' };
}

function filterTree(node: BrowserNode, q: string): BrowserNode | null {
  const t = q.trim().toLowerCase();
  if (!t) return node;
  if (node.kind === 'file') return node.name.toLowerCase().includes(t) ? node : null;
  const fc = node.children.map(c => filterTree(c, q)).filter(Boolean) as BrowserNode[];
  return (node.name.toLowerCase().includes(t) || fc.length) ? { ...node, children: fc } : null;
}

function ancestorPaths(p: string): string[] {
  const segs = p.split('/').filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join('/'));
  return out;
}

/* ─────────── System prompt builder ─────────── */
function buildSystemPrompt(mode: ConversationMode, opts: {
  workspace?: string;
  sessionId?: string;
  selectedSkills: string[];
  folderLabel?: string;
  selectedFile?: string;
  repoSummary?: string;
  browserContextActive?: boolean;
}): string {
  const modeInstr: Record<ConversationMode, string> = {
    general: 'Be concise and concrete. Use tools when repo inspection or file actions are needed.',
    architecture: 'Focus on system structure, boundaries, migration risks, tradeoffs, and rollout sequencing.',
    'data-analysis': 'Focus on data quality, metrics, trends, assumptions, and validation.',
    'code-review': 'Prioritize correctness, regressions, security, missing tests. Findings first, ordered by severity.',
    implementation: 'Turn requests into concrete implementation steps or patches. Be specific about files and changes.',
  };
  const ctx = [
    opts.workspace && `Workspace: ${opts.workspace}.`,
    opts.sessionId && `Session: ${opts.sessionId}.`,
    opts.folderLabel && `Browser folder: ${opts.folderLabel}.`,
    opts.selectedFile && `Selected file: ${opts.selectedFile}.`,
    opts.repoSummary && `Repo summary: ${opts.repoSummary}`,
  ].filter(Boolean).join(' ');
  const skillsList = opts.selectedSkills.join(', ');
  const skills = opts.selectedSkills.length > 0
    ? `Active skills: ${skillsList}.`
    : '';
  return [
    'You are a local-first agentic coding assistant.',
    modeInstr[mode],
    skills,
    ctx,
    opts.browserContextActive ? 'If browser folder context is attached, treat it as the primary repo snapshot and do not claim workspace tools inspected it unless explicitly stated.' : '',
    'Provide concise reasoning and direct actions.',
    'If the model emits <think>...</think> blocks, preserve them in the response.',
  ].filter(Boolean).join(' ');
}

/* ─────────── Tree component ─────────── */
function TreeView({ node, depth, expanded, onToggle, onSelect, selected }: {
  node: BrowserNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (p: string) => void;
  onSelect: (n: BrowserFileNode) => void;
  selected: string;
}) {
  const isDir = node.kind === 'directory';
  const isOpen = isDir && (depth === 0 || expanded.has(node.path));
  const isActive = selected === node.path;

  return (
    <div className="tree-branch">
      <button
        className={`tree-row ${isActive ? 'tree-row-active' : ''}`}
        onClick={() => isDir ? onToggle(node.path) : onSelect(node)}
        style={{ paddingInlineStart: `${8 + depth * 16}px` }}
        type="button"
      >
        <span className="tree-icon">{isDir ? (isOpen ? '▾' : '▸') : '·'}</span>
        <span className="tree-label">{node.name}</span>
        <span className="tree-meta">{isDir ? `${node.children.length}` : formatBytes(node.size)}</span>
      </button>
      {isDir && isOpen && node.children.map(c => (
        <TreeView key={c.path} node={c} depth={depth + 1} expanded={expanded} onToggle={onToggle} onSelect={onSelect} selected={selected} />
      ))}
    </div>
  );
}

/* ═══════════ MAIN APP ═══════════ */
function HarnessApp() {
  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('connection');
  const [filePreviewOpen, setFilePreviewOpen] = useState(false);

  // Backend state
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('offline');
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [modelRuntime, setModelRuntime] = useState<ModelRuntimeState | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessions, setSessions] = useState<SessionState[]>([]);
  const [skills, setSkills] = useState<SkillMetadata[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [repoContext, setRepoContext] = useState<RepoContext | null>(null);
  const [gitDiff, setGitDiff] = useState('');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode] = useState<ConversationMode>('general');
  const [isAgentic, setIsAgentic] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem(AGENTIC_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [thinkingEnabled, setThinkingEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem('gamma-harness.thinking-mode');
    return stored === null ? false : stored === 'true';
  });
  const [attachedImages, setAttachedImages] = useState<ComposerImageAttachment[]>([]);
  const [attachmentNotice, setAttachmentNotice] = useState('');
  const [streamStatus, setStreamStatus] = useState('');

  // Browser file state
  const [browserSelection, setBrowserSelection] = useState<BrowserSelection | null>(null);
  const [browserPreview, setBrowserPreview] = useState<BrowserPreview | null>(null);
  const [workspacePreview, setWorkspacePreview] = useState<BrowserPreview | null>(null);
  const [browserFilter, setBrowserFilter] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set());
  const [browserLoading, setBrowserLoading] = useState(false);

  // Settings drafts
  const [baseUrlDraft, setBaseUrlDraft] = useState('');
  const [modelDraft, setModelDraft] = useState('');
  const [profileDraft, setProfileDraft] = useState('balanced');
  const [modeDraft, setModeDraft] = useState('workspace-write');
  const [workspaceRootDraft, setWorkspaceRootDraft] = useState('');
  const [internetAccessDraft, setInternetAccessDraft] = useState(true);
  const [streamIdleTimeoutDraft, setStreamIdleTimeoutDraft] = useState('45');
  const [contextBudgetDraft, setContextBudgetDraft] = useState('24000');
  const [localModelBudgetProfileDraft, setLocalModelBudgetProfileDraft] = useState<'lean' | 'balanced' | 'deep'>('balanced');
  const [toolRetryMaxDraft, setToolRetryMaxDraft] = useState('2');
  const [sessionMemoryEnabledDraft, setSessionMemoryEnabledDraft] = useState(true);
  const [sessionMemoryTurnsDraft, setSessionMemoryTurnsDraft] = useState('3');
  const [selfCheckEnabledDraft, setSelfCheckEnabledDraft] = useState(true);
  const [settingsStatus, setSettingsStatus] = useState('');

  // Refs
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastConfigSigRef = useRef('');
  const lastTraceTimestampRef = useRef(0);
  const streamBuffer = useStreamingBuffer((messageId, text) => {
    setMessages((current) => current.map((message) => (
      message.id === messageId
        ? { ...message, content: message.content + text, status: 'streaming' }
        : message
    )));
  }, 45);

  // Derived
  const modelOptions = useMemo(() => {
    const opts = new Set((modelRuntime?.availableModels || []).map(m => m.id));
    if (modelDraft.trim()) opts.add(modelDraft.trim());
    return Array.from(opts);
  }, [modelDraft, modelRuntime]);
  const thinkingSupported = useMemo(() => modelRuntime?.configuredModelCapabilities?.includes('thinking') ?? false, [modelRuntime]);
  const thinkingWarning = thinkingEnabled && modelRuntime && !thinkingSupported
    ? 'Thinking unavailable on current model; toggle may be ignored.'
    : '';

  const workspaceSelection = useMemo(() => buildWorkspaceSelection(config?.workspaceRoot, repoContext?.files), [config?.workspaceRoot, repoContext?.files]);
  const sidebarSelection = workspaceSelection || browserSelection;

  const filteredTree = useMemo(() => {
    if (!sidebarSelection) return null;
    return filterTree(sidebarSelection.root, browserFilter);
  }, [browserFilter, sidebarSelection]);

  const activeModelLabel = modelRuntime?.activeModel || config?.model || 'No model';
  const recentTurns = useMemo(
    () => (session?.turnHistory ? [...session.turnHistory].slice(-4).reverse() : []),
    [session?.turnHistory],
  );
  const latestSessionTurn = useMemo(
    () => (session?.turnHistory && session.turnHistory.length > 0 ? session.turnHistory[session.turnHistory.length - 1] : undefined),
    [session?.turnHistory],
  );
  const activeAgentPreset = useMemo(
    () => AGENT_PRESETS.find((preset) =>
      preset.values.contextBudget === Number(contextBudgetDraft || 0) &&
      preset.values.toolRetryMax === Number(toolRetryMaxDraft || 0) &&
      preset.values.sessionMemoryEnabled === sessionMemoryEnabledDraft &&
      preset.values.sessionMemoryTurns === Number(sessionMemoryTurnsDraft || 0) &&
      preset.values.selfCheckEnabled === selfCheckEnabledDraft &&
      preset.values.internetAccessEnabled === internetAccessDraft &&
      preset.values.streamIdleTimeoutMs === Number(streamIdleTimeoutDraft || 0) * 1000,
    )?.id || null,
    [
      contextBudgetDraft,
      internetAccessDraft,
      selfCheckEnabledDraft,
      sessionMemoryEnabledDraft,
      sessionMemoryTurnsDraft,
      streamIdleTimeoutDraft,
      toolRetryMaxDraft,
    ],
  );
  const livePlanSteps = useMemo(
    () => {
      if (plan?.runSteps?.length) return [...plan.runSteps].slice(-6).reverse();
      if (!plan?.taskPlan?.steps.length) return [];
      return plan.taskPlan.steps.slice(0, 6).map((step): AgentRunStep => ({
        id: step.id,
        type: step.type,
        title: step.title,
        detail: step.detail || step.error,
        status: step.status === 'failed' || step.status === 'blocked'
          ? 'error'
          : step.status === 'pending'
            ? 'skipped'
            : step.status,
      }));
    },
    [plan?.runSteps, plan?.taskPlan?.steps],
  );
  const liveTraceEntries = useMemo(
    () => [...traces].slice(-6).reverse(),
    [traces],
  );
  const liveActivityBadge = streamStatus || plan?.lastStatus || plan?.currentPhase || 'Ready';

  /* ─── Refresh dashboard data ─── */
  const refreshDashboard = useCallback(async (
    mode: 'full' | 'live' = 'full',
    options?: { includeHeavy?: boolean },
  ) => {
    const safe = async <T,>(url: string, fallback: T): Promise<T> => {
      try { return await fetchJson<T>(url); } catch { return fallback; }
    };
    try {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && mode !== 'full') {
        return;
      }

      const traceUrl = mode === 'full' || lastTraceTimestampRef.current === 0
        ? `${API}/trace?limit=240`
        : `${API}/trace?since=${lastTraceTimestampRef.current}`;
      const includeHeavy = options?.includeHeavy ?? (mode === 'full' && (!repoContext || (settingsOpen && settingsTab === 'activity')));

      const applyCoreState = (
        health: { status: BackendStatus },
        cfg: ConfigState | null,
        traceEntries: TraceEntry[],
        approvalItems: ApprovalItem[],
        planState: PlanState | null,
        runtimeState: ModelRuntimeState | null,
        sessionState: SessionState | null,
      ) => {
        setBackendStatus(health.status);
        setConfig(cfg);
        setApprovals(approvalItems);
        setPlan(planState);
        setModelRuntime(runtimeState);
        setSession(sessionState);
        setTraces((current) => {
          if (traceEntries.length > 0) {
            lastTraceTimestampRef.current = traceEntries[traceEntries.length - 1].timestamp;
          }

          return mode === 'full'
            ? traceEntries.slice(-240)
            : [...current, ...traceEntries].slice(-240);
        });

        if (sessionState?.skillsActive?.length) {
          setSelectedSkills((cur) => cur.length > 0 ? cur : sessionState.skillsActive);
        }

        if (cfg) {
          const sig = JSON.stringify({
            workspaceRoot: cfg.workspaceRoot,
            baseUrl: cfg.baseUrl,
            model: cfg.model,
            profile: cfg.profile,
            mode: cfg.mode,
            internetAccessEnabled: cfg.internetAccessEnabled,
            streamIdleTimeoutMs: cfg.streamIdleTimeoutMs,
            contextBudget: cfg.contextBudget,
            toolRetryMax: cfg.toolRetryMax,
            sessionMemoryEnabled: cfg.sessionMemoryEnabled,
            sessionMemoryTurns: cfg.sessionMemoryTurns,
            selfCheckEnabled: cfg.selfCheckEnabled,
            localModelBudgetProfile: cfg.localModelBudgetProfile,
          });

          if (sig !== lastConfigSigRef.current) {
            lastConfigSigRef.current = sig;
            setWorkspaceRootDraft(cfg.workspaceRoot);
            setBaseUrlDraft(cfg.baseUrl);
            setModelDraft(cfg.model);
            setProfileDraft(cfg.profile);
            setModeDraft(cfg.mode);
            setInternetAccessDraft(cfg.internetAccessEnabled);
            setStreamIdleTimeoutDraft(String(Math.round(cfg.streamIdleTimeoutMs / 1000)));
            setContextBudgetDraft(String(cfg.contextBudget));
            setToolRetryMaxDraft(String(cfg.toolRetryMax));
            setSessionMemoryEnabledDraft(cfg.sessionMemoryEnabled);
            setSessionMemoryTurnsDraft(String(cfg.sessionMemoryTurns));
            setSelfCheckEnabledDraft(cfg.selfCheckEnabled);
            setLocalModelBudgetProfileDraft(cfg.localModelBudgetProfile || 'balanced');
          }
        }
      };

      if (mode === 'live') {
        const [health, cfg, tr, ap, pl, mrt, sess] = await Promise.all([
          safe<{ status: BackendStatus }>(`${API}/health`, { status: 'offline' }),
          safe<ConfigState | null>(`${API}/config`, null),
          safe<TraceEntry[]>(traceUrl, []),
          safe<ApprovalItem[]>(`${API}/approvals`, []),
          safe<PlanState | null>(`${API}/plan`, null),
          safe<ModelRuntimeState | null>(`${API}/model/runtime`, null),
          safe<SessionState | null>(`${API}/session`, null),
        ]);

        applyCoreState(health, cfg, tr, ap, pl, mrt, sess);
        return;
      }

      const [health, cfg, tr, ap, pl, mrt, sess, sessList, sk] = await Promise.all([
        safe<{ status: BackendStatus }>(`${API}/health`, { status: 'offline' }),
        safe<ConfigState | null>(`${API}/config`, null),
        safe<TraceEntry[]>(traceUrl, []),
        safe<ApprovalItem[]>(`${API}/approvals`, []),
        safe<PlanState | null>(`${API}/plan`, null),
        safe<ModelRuntimeState | null>(`${API}/model/runtime`, null),
        safe<SessionState | null>(`${API}/session`, null),
        safe<SessionState[]>(`${API}/sessions`, []),
        safe<SkillMetadata[]>(`${API}/skills`, []),
      ]);

      applyCoreState(health, cfg, tr, ap, pl, mrt, sess);
      setSessions(sessList);
      setSkills(sk);

      if (includeHeavy) {
        const [repo, diff] = await Promise.all([
          safe<RepoContext | null>(`${API}/workspace/index`, null),
          safe<{ output: string }>(`${API}/workspace/git/diff`, { output: '' }),
        ]);
        setRepoContext(repo);
        setGitDiff(diff.output);
      }
    } catch { setBackendStatus('offline'); }
  }, [repoContext, settingsOpen, settingsTab]);

  useEffect(() => {
    void refreshDashboard(isSending ? 'live' : 'full', { includeHeavy: !isSending });
    const liveId = setInterval(
      () => void refreshDashboard('live'),
      isSending ? ACTIVE_RUN_REFRESH_MS : LIVE_REFRESH_MS,
    );
    const fullId = !isSending
      ? setInterval(() => void refreshDashboard('full'), FULL_REFRESH_MS)
      : undefined;
    return () => {
      clearInterval(liveId);
      if (fullId) {
        clearInterval(fullId);
      }
    };
  }, [isSending, refreshDashboard]);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node) return;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 140;
    if (!nearBottom && !isSending) {
      return;
    }
    node.scrollTo({ top: node.scrollHeight, behavior: isSending ? 'auto' : 'smooth' });
  }, [isSending, messages]);

  useEffect(() => {
    if (!workspaceSelection) return;
    setExpandedPaths(new Set(['.']));
    setWorkspacePreview(null);
  }, [workspaceSelection]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AGENTIC_STORAGE_KEY, String(isAgentic));
    } catch {
      // ignore storage errors
    }
  }, [isAgentic]);

  useEffect(() => {
    try {
      window.localStorage.setItem('gamma-harness.thinking-mode', String(thinkingEnabled));
    } catch {
      // ignore storage errors
    }
  }, [thinkingEnabled]);

  /* ─── Session management ─── */
  async function ensureSession(): Promise<SessionState> {
    if (session) return session;
    const created = await fetchJson<SessionState>(`${API}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: selectedSkills }),
    });
    setSession(created);
    setSelectedSkills(created.skillsActive);
    await refreshDashboard('full', { includeHeavy: true });
    return created;
  }

  async function startNewSession() {
    const created = await fetchJson<SessionState>(`${API}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: selectedSkills }),
    });
    setSession(created);
    setSelectedSkills(created.skillsActive);
    setMessages([]);
    await refreshDashboard('full', { includeHeavy: true });
  }

  async function resumeSession(id: string) {
    const resumed = await fetchJson<SessionState>(`${API}/session/${id}/resume`, { method: 'POST' });
    setSession(resumed);
    setSelectedSkills(resumed.skillsActive);
    setMessages([]);
    await refreshDashboard('full', { includeHeavy: true });
  }

  async function bindWorkspaceSelection(selection: BrowserSelection, nativeWorkspaceRoot?: string | null): Promise<boolean> {
    try {
      if (nativeWorkspaceRoot?.trim()) {
        await fetchJson<ConfigState>(`${API}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceRoot: nativeWorkspaceRoot.trim() }),
        });
      } else {
        await fetchJson<WorkspaceResolveResponse>(`${API}/workspace/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderLabel: selection.label,
            relativeFiles: collectSelectionRelativeFiles(selection),
          }),
        });
      }

      await refreshDashboard('full', { includeHeavy: true });
      setBrowserSelection(null);
      setBrowserPreview(null);
      setWorkspacePreview(null);
      setExpandedPaths(new Set(['.']));
      setSettingsStatus(`Workspace set to ${selection.label}.`);
      return true;
    } catch {
      setBrowserSelection(selection);
      setSettingsStatus('Could not map picked folder to host path. Using browser-only read context.');
      return false;
    }
  }

  async function applyPickedSelection(selection: BrowserSelection, nativeWorkspaceRoot?: string | null) {
    setBrowserSelection(selection);
    setBrowserPreview(null);
    setExpandedPaths(new Set([selection.root.path]));
    await bindWorkspaceSelection(selection, nativeWorkspaceRoot);
  }

  function applyAgentPreset(presetId: 'lean' | 'balanced' | 'autonomous') {
    const preset = AGENT_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) return;
    setContextBudgetDraft(String(preset.values.contextBudget));
    setToolRetryMaxDraft(String(preset.values.toolRetryMax));
    setSessionMemoryEnabledDraft(preset.values.sessionMemoryEnabled);
    setSessionMemoryTurnsDraft(String(preset.values.sessionMemoryTurns));
    setSelfCheckEnabledDraft(preset.values.selfCheckEnabled);
    setInternetAccessDraft(preset.values.internetAccessEnabled);
    setStreamIdleTimeoutDraft(String(Math.round(preset.values.streamIdleTimeoutMs / 1000)));
    setSettingsStatus(`${preset.title} preset loaded. Save to apply.`);
  }

  /* ─── Chat ─── */
  async function sendChat() {
    const content = draft.trim();
    if (isSending) return;
    if (!content && attachedImages.length === 0) return;
    setIsSending(true);
    setStreamStatus('Preparing request');
    let placeholderId = '';
    try {
      const activeSession = await ensureSession();
      const now = Date.now();
      const userAttachments = attachedImages.map(({ id, name, dataUrl }) => ({ id, name, dataUrl }));
      const userMsg: ChatMessage = {
        id: makeId('msg'),
        role: 'user',
        content,
        mode: chatMode,
        executionMode: isAgentic ? 'agentic' : 'direct',
        createdAt: now,
        activity: [],
        toolEvents: [],
        status: 'sent',
        attachments: userAttachments,
      };
      const placeholder: ChatMessage = {
        id: makeId('msg'),
        role: 'assistant',
        content: '',
        mode: chatMode,
        executionMode: isAgentic ? 'agentic' : 'direct',
        createdAt: now + 1,
        activity: [],
        toolEvents: [],
        status: 'sending',
      };
      placeholderId = placeholder.id;
      const browserContext = buildBrowserContextMessage(browserSelection, browserPreview);
      const prompt = buildSystemPrompt(chatMode, {
        workspace: config?.workspaceRoot,
        sessionId: activeSession.id,
        selectedSkills,
        folderLabel: browserSelection?.label,
        selectedFile: workspacePreview?.path || browserPreview?.path,
        repoSummary: repoContext?.summary,
        browserContextActive: Boolean(browserContext),
      });
      const convMsgs = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content },
      ];
      setMessages(cur => [...cur, userMsg, placeholder]);
      setDraft('');
      const requestMessages = [
        { role: 'system' as const, content: prompt },
        ...(browserContext ? [{ role: 'system' as const, content: browserContext }] : []),
        ...convMsgs,
      ];
      await streamNdjson(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: requestMessages,
          agentic: isAgentic,
          thinking: thinkingEnabled,
          images: attachedImages.map(image => image.base64),
        }),
      }, (event) => {
        if (event.type === 'status') {
          const nextStep = event.action || event.phase;
          setStreamStatus(nextStep);
          setMessages(cur => cur.map(m => (
            m.id === placeholderId
              ? { ...m, activity: pushActivityStep(m.activity, nextStep), status: m.content ? 'streaming' : m.status }
              : m
          )));
          return;
        }

        if (event.type === 'tool') {
          setMessages(cur => cur.map(m => (
            m.id === placeholderId
              ? { ...m, toolEvents: upsertToolEvent(m.toolEvents, event), status: m.status === 'sending' ? 'streaming' : m.status }
              : m
          )));
          return;
        }

        if (event.type === 'approval') {
          setApprovals(cur => mergeApprovalEvent(cur, event));
          return;
        }

        if (event.type === 'run_started') {
          setMessages(cur => cur.map(m => (
            m.id === placeholderId
              ? {
                  ...m,
                  runSummary: {
                    id: event.runId,
                    intent: event.intent,
                    workspaceSource: event.workspaceSource,
                    workspaceBound: event.workspaceBound,
                    browserContextActive: event.browserContextActive,
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
                    usedManualFallback: false,
                    steps: [],
                  },
                  runSteps: [],
                }
              : m
          )));
          return;
        }

        if (event.type === 'run_step') {
          setMessages(cur => cur.map(m => (
            m.id === placeholderId
              ? { ...m, runSteps: upsertRunStep(m.runSteps || [], event.step) }
              : m
          )));
          return;
        }

        if (event.type === 'run_metric') {
          setMessages(cur => cur.map(m => (
            m.id === placeholderId && m.runSummary
              ? {
                  ...m,
                  runSummary: {
                    ...m.runSummary,
                    metrics: {
                      ...m.runSummary.metrics,
                      totalMs: event.metrics.totalMs ?? m.runSummary.metrics?.totalMs,
                      firstTokenMs: event.metrics.firstTokenMs ?? m.runSummary.metrics?.firstTokenMs,
                    },
                    git: m.runSummary.git
                      ? {
                          ...m.runSummary.git,
                          addedLines: event.metrics.addedLines ?? m.runSummary.git.addedLines,
                          removedLines: event.metrics.removedLines ?? m.runSummary.git.removedLines,
                        }
                      : event.metrics.addedLines !== undefined || event.metrics.removedLines !== undefined
                        ? {
                            changedFiles: 0,
                            addedLines: event.metrics.addedLines ?? 0,
                            removedLines: event.metrics.removedLines ?? 0,
                          }
                        : undefined,
                  },
                }
              : m
          )));
          return;
        }

        if (event.type === 'run_summary') {
          setMessages(cur => cur.map(m => (
            m.id === placeholderId
              ? {
                  ...m,
                  runSummary: event.summary,
                  runSteps: event.summary.steps || m.runSteps || [],
                }
              : m
          )));
          return;
        }

        if (isRunTraceEvent(event)) {
          const timestamp = typeof event.timestamp === 'number' ? event.timestamp : Date.now();
          setTraces(cur => [...cur, { id: event.id, type: event.type, data: event.data, timestamp }].slice(-240));
          setPlan(cur => {
            const base: PlanState = cur || {
              taskSummary: '',
              currentPhase: 'Task run',
              activeSkills: [],
              intendedNextAction: '',
              blockers: [],
              isComplete: false,
            };
            let taskPlan = base.taskPlan;
            let currentStepId = base.currentStepId;
            let currentTool = base.currentTool;
            let currentPhase = base.currentPhase;
            let intendedNextAction = base.intendedNextAction;
            let lastStatus = base.lastStatus;
            let currentRunId = base.currentRunId;
            const data = event.data as RunTracePayload;

            if (typeof data.runId === 'string') currentRunId = data.runId;

            if (event.type === 'task_plan_created') {
              if (data.plan) {
                taskPlan = data.plan;
                currentPhase = 'Plan created';
                intendedNextAction = taskPlan.steps.find((step) => step.status === 'pending')?.title || 'Execute plan';
                lastStatus = 'Task plan created';
              }
            } else if (event.type === 'task_plan_completed') {
              taskPlan = data.plan || taskPlan;
              currentPhase = 'Complete';
              intendedNextAction = 'Summarize result';
              lastStatus = 'Task plan completed';
            } else if (event.type.startsWith('task_step_') && data.step) {
              const step = data.step;
              taskPlan = patchTaskStep(taskPlan, step);
              currentStepId = step.id;
              currentPhase = step.type;
              intendedNextAction = step.title;
              lastStatus = step.detail || step.error || step.status;
            } else if (event.type === 'task_checkpoint_saved') {
              lastStatus = 'Checkpoint saved';
            } else if (event.type === 'task_budget_exceeded') {
              lastStatus = `Budget exceeded: ${data.budgetType || 'run'}`;
            } else if (event.type === 'tool_call_started') {
              currentTool = typeof data.tool === 'string' ? data.tool : currentTool;
              lastStatus = data.inputSummary || 'Tool call started';
            } else if (event.type === 'tool_call_completed') {
              currentTool = typeof data.tool === 'string' ? data.tool : currentTool;
              lastStatus = data.outputPreview || 'Tool call completed';
            } else if (event.type === 'verification_started' || event.type === 'verification_completed') {
              currentPhase = 'verify';
              lastStatus = data.outputPreview || data.command || event.type;
            }

            return {
              ...base,
              taskSummary: taskPlan?.summary || base.taskSummary,
              currentPhase,
              intendedNextAction,
              currentRunId,
              currentTool,
              taskPlan,
              currentStepId,
              complexity: taskPlan?.complexity || base.complexity,
              stepProgress: calculateStepProgress(taskPlan),
              lastStatus,
              isComplete: Boolean(taskPlan?.completedAt) || base.isComplete,
            };
          });
          return;
        }

        if (event.type === 'delta') {
          streamBuffer.push(placeholderId, event.delta);
          return;
        }

        if (event.type === 'done') {
          streamBuffer.flush(placeholderId);
          setMessages(cur => cur.map(m => (
            m.id === placeholderId
              ? { ...m, content: event.response || m.content, status: 'sent' }
              : m
          )));
          setStreamStatus('');
          return;
        }

        streamBuffer.flush(placeholderId);
        setMessages(cur => cur.map(m => (
          m.id === placeholderId
            ? { ...m, content: `Error: ${event.message}`, activity: pushActivityStep(m.activity, 'Error'), status: 'error' }
            : m
        )));
        setStreamStatus('');
      });
    } catch (err) {
      streamBuffer.flush(placeholderId);
      const errMsg = err instanceof Error ? err.message : 'Failed to get response.';
      setMessages(cur => cur.map(m => (
        m.id === placeholderId || m.status === 'sending' || m.status === 'streaming'
          ? { ...m, content: `Error: ${errMsg}`, status: 'error' }
          : m
      )));
      setStreamStatus('');
    } finally {
      streamBuffer.flushAll();
      if (placeholderId) {
        streamBuffer.clear(placeholderId);
      }
      setIsSending(false);
      setStreamStatus('');
      setAttachedImages([]);
      setAttachmentNotice('');
      await refreshDashboard('full', { includeHeavy: true });
    }
  }

  /* ─── Settings actions ─── */
  async function saveConfig() {
    if (!workspaceRootDraft.trim() || !baseUrlDraft.trim() || !modelDraft.trim()) {
      setSettingsStatus('All fields are required.');
      return;
    }
    const contextBudget = Number(contextBudgetDraft);
    const toolRetryMax = Number(toolRetryMaxDraft);
    const sessionMemoryTurns = Number(sessionMemoryTurnsDraft);
    const streamIdleTimeoutSeconds = Number(streamIdleTimeoutDraft);
    if (!Number.isFinite(contextBudget) || contextBudget < 4000) {
      setSettingsStatus('Context budget must be at least 4000.');
      return;
    }
    if (!Number.isFinite(toolRetryMax) || toolRetryMax < 0) {
      setSettingsStatus('Tool retry max must be 0 or greater.');
      return;
    }
    if (!Number.isFinite(sessionMemoryTurns) || sessionMemoryTurns < 1) {
      setSettingsStatus('Session memory turns must be at least 1.');
      return;
    }
    if (!Number.isFinite(streamIdleTimeoutSeconds) || streamIdleTimeoutSeconds < 0) {
      setSettingsStatus('Stream stall limit must be 0 seconds or greater.');
      return;
    }
    const changingModel = config?.model !== modelDraft.trim();
    const changingWorkspace = config?.workspaceRoot !== workspaceRootDraft.trim();
    const shouldActivate = changingModel || modelRuntime?.activeModel !== modelDraft.trim();
    setSettingsStatus(changingModel ? `Switching to ${modelDraft.trim()}...` : 'Updating...');
    try {
      await fetchJson(`${API}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceRoot: workspaceRootDraft.trim(),
          baseUrl: baseUrlDraft.trim(),
          model: modelDraft.trim(),
          profile: profileDraft,
          mode: modeDraft,
          internetAccessEnabled: internetAccessDraft,
          streamIdleTimeoutMs: Math.round(streamIdleTimeoutSeconds * 1000),
          contextBudget,
          toolRetryMax,
          sessionMemoryEnabled: sessionMemoryEnabledDraft,
          sessionMemoryTurns,
          selfCheckEnabled: selfCheckEnabledDraft,
          localModelBudgetProfile: localModelBudgetProfileDraft,
          activateModel: shouldActivate,
        }),
      });
      
      if (changingWorkspace) {
        setMessages([]);
      }

      const rt = await fetchJson<ModelRuntimeState>(`${API}/model/runtime`);
      setModelRuntime(rt);
      setSettingsStatus(rt.lastSwitchResult?.message || 'Configuration saved.');
      await refreshDashboard('full', { includeHeavy: true });
    } catch (err) {
      setSettingsStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function resolveApproval(id: string, approved: boolean) {
    await fetchJson<{ resolved: boolean }>(`${API}/approvals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    await refreshDashboard('full', { includeHeavy: true });
  }

  /* ─── Folder picker ─── */
  async function pickFolder() {
    const w = window as WindowWithDirectoryPicker;
    if (w.showDirectoryPicker) {
      setBrowserLoading(true);
      try {
        const handle = await w.showDirectoryPicker();
        const sel = await buildFromHandle(handle);
        await applyPickedSelection(sel, handle.path || null);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      } finally {
        setBrowserLoading(false);
      }
      return;
    }
    folderInputRef.current?.click();
  }

  function handleFolderInput(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setBrowserLoading(true);
    const sel = buildFromFiles(files);
    void (async () => {
      try {
        if (sel) {
          await applyPickedSelection(sel, deriveNativeWorkspaceRootFromFiles(files));
        }
      } finally {
        setBrowserLoading(false);
      }
    })();
  }

  async function handleImageInput(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    const rejectedTypeCount = files.length - imageFiles.length;
    const validSizeFiles = imageFiles.filter(file => file.size <= MAX_IMAGE_BYTES);
    const rejectedSizeCount = imageFiles.length - validSizeFiles.length;
    const remainingSlots = Math.max(0, MAX_IMAGE_ATTACHMENTS - attachedImages.length);
    const acceptedFiles = validSizeFiles.slice(0, remainingSlots);
    const rejectedCount = validSizeFiles.length - acceptedFiles.length;
    const notices: string[] = [];

    if (rejectedTypeCount > 0) {
      notices.push('Only image files are supported; audio/video stay future work.');
    }
    if (rejectedSizeCount > 0) {
      notices.push(`Images must be ${formatBytes(MAX_IMAGE_BYTES)} or smaller.`);
    }
    if (rejectedCount > 0) {
      notices.push(`Only ${MAX_IMAGE_ATTACHMENTS} image${MAX_IMAGE_ATTACHMENTS > 1 ? 's' : ''} can be attached per turn.`);
    }

    const encoded = await Promise.all(acceptedFiles.map(async (file) => {
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const base64 = dataUrl.split(',')[1] || '';
        if (!base64) return null;
        return {
          id: makeId('img'),
          name: file.name,
          dataUrl,
          base64,
        } satisfies ComposerImageAttachment;
      } catch {
        return null;
      }
    }));

    const next = encoded.filter((image): image is ComposerImageAttachment => image !== null);
    if (next.length > 0) {
      setAttachedImages(cur => [...cur, ...next]);
    }
    setAttachmentNotice(notices.join(' '));
  }

  async function previewFile(node: BrowserFileNode) {
    setExpandedPaths(cur => {
      const next = new Set(cur);
      for (const a of ancestorPaths(node.path)) next.add(a);
      return next;
    });
    try {
      const raw = node.file
        ? await node.file.text()
        : (await fetchJson<{ output: string }>(`${API}/workspace/file?path=${encodeURIComponent(node.path)}`)).output;
      const preview = truncatePreview(raw);
      const nextPreview = {
        path: node.path,
        name: node.name,
        size: node.size,
        content: preview.content,
        lineCount: preview.content.split('\n').length,
        truncated: preview.truncated,
      };
      if (node.file) {
        setBrowserPreview(nextPreview);
      } else {
        setWorkspacePreview(nextPreview);
      }
      setFilePreviewOpen(true);
    } catch { /* ignore */ }
  }

  function togglePath(p: string) {
    setExpandedPaths(cur => {
      const next = new Set(cur);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="app-shell">
      {/* ── Top Bar ── */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">G4</div>
          <div className="topbar-brand">
            <span className="topbar-kicker">Local workspace</span>
            <span className="topbar-title">Gamma 4 Harness</span>
          </div>
        </div>

        <div className="topbar-center">
          <div className="topbar-badge">
            <span className={`status-dot status-dot-${backendStatus}`} />
            <span>{backendStatus === 'ok' ? 'Ready' : backendStatus === 'degraded' ? 'Degraded' : 'Offline'}</span>
          </div>
          <div className="topbar-badge">
            <span>Model</span>
            <strong>{shortenText(activeModelLabel, 28)}</strong>
          </div>
          <div className="topbar-badge">
            <span>{isAgentic ? 'Agent' : 'Direct'}</span>
          </div>
          {session && (
            <div className="topbar-badge">
              <span>Thread</span>
              <strong>{shortenText(session.id, 12)}</strong>
            </div>
          )}
        </div>

        <div className="topbar-right">
          <button className="icon-btn" onClick={() => void startNewSession()} type="button" title="New thread">＋</button>
          <button className="icon-btn" onClick={() => void refreshDashboard('full', { includeHeavy: true })} type="button" title="Refresh">↻</button>
          <button
            className={`icon-btn ${settingsOpen ? 'icon-btn-active' : ''}`}
            onClick={() => setSettingsOpen(o => !o)}
            type="button"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className={`main-layout ${settingsOpen ? 'settings-open' : ''}`}>

        {/* ── Sidebar: thread history + workspace ── */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-window-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <button className="sidebar-action sidebar-action-primary" onClick={() => void startNewSession()} type="button">
              <span>＋</span>
              New thread
            </button>
            <button
              className="sidebar-action"
              onClick={() => {
                setSettingsOpen(true);
                setSettingsTab('agent');
              }}
              type="button"
            >
              <span>⌘</span>
              Agent settings
            </button>
            <button className="sidebar-action" onClick={() => void pickFolder()} type="button">
              <span>▣</span>
              Open workspace
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">
              <span>Threads</span>
              <span>{sessions.length}</span>
            </div>
            <div className="thread-list">
              {sessions.length === 0 ? (
                <div className="sidebar-empty-compact">No saved threads yet.</div>
              ) : (
                sessions.slice(0, 14).map((entry) => (
                  <button
                    key={entry.id}
                    className={`thread-row ${session?.id === entry.id ? 'thread-row-active' : ''}`}
                    onClick={() => void resumeSession(entry.id)}
                    type="button"
                    title={entry.id}
                  >
                    <span className="thread-dot" />
                    <span className="thread-main">
                      <strong>{formatSessionTitle(entry)}</strong>
                      <span>{entry.model} · {entry.turnHistory?.length || 0} turns</span>
                    </span>
                    <span className="thread-time">{formatRelativeTime(entry.updatedAt)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-section sidebar-section-project">
            <div className="sidebar-section-title">
              <span>Project</span>
              <span>{sidebarSelection?.fileCount || repoContext?.files.length || 0}</span>
            </div>
            <div className="workspace-card">
              <span className="workspace-card-label">Workspace</span>
              <strong title={config?.workspaceRoot || sidebarSelection?.label || ''}>
                {config?.workspaceRoot ? getPathBasename(config.workspaceRoot) : sidebarSelection?.label || 'Not bound'}
              </strong>
              <span>{plan?.workspaceBound === false ? 'Browser snapshot only' : config?.workspaceRoot ? 'Backend bound' : 'Pick folder'}</span>
            </div>
            <div className="sidebar-tree">
              {browserLoading && <div className="tree-loading">Reading local directory...</div>}
              {!sidebarSelection && !browserLoading && (
                <div className="tree-empty">
                  <button className="btn-sm" onClick={() => void pickFolder()} type="button">Mount directory</button>
                  <div className="sidebar-empty-compact">Folder tree appears here after workspace binds.</div>
                </div>
              )}
              {sidebarSelection && (
                <div className="tree-active">
                  <div className="tree-active-header">
                    <span className="tree-active-label" title={sidebarSelection.label}>
                      {shortenText(sidebarSelection.label, 24)}
                    </span>
                    {browserSelection && (
                      <button className="icon-btn" onClick={() => { setBrowserSelection(null); setBrowserFilter(''); }} type="button" title="Unmount">✕</button>
                    )}
                  </div>
                  <div className="tree-search">
                    <input
                      type="text"
                      placeholder="Filter files..."
                      value={browserFilter}
                      onChange={e => setBrowserFilter(e.target.value)}
                    />
                  </div>
                  <div className="tree-nodes">
                    {filteredTree ? (
                      <TreeView
                        node={filteredTree}
                        depth={0}
                        expanded={expandedPaths}
                        onToggle={togglePath}
                        onSelect={(n) => void previewFile(n)}
                        selected={(workspacePreview || browserPreview)?.path || ''}
                      />
                    ) : (
                      <div className="tree-loading">No files match filter.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {browserSelection && (
            <div className="sidebar-stats">
              Attached browser context: {shortenText(browserSelection.label, 42)} · {browserSelection.fileCount} files
            </div>
          )}
        </aside>

        {/* ── Chat Panel ── */}
        <main className="chat-panel">
          <section className="command-center">
            <div className="command-center-hero">
              <div className="command-center-copy">
                <span className="command-center-kicker">Harness posture</span>
                <h1>{isAgentic ? 'Agent loop armed for real work' : 'Direct pair mode for low-friction help'}</h1>
                <p>
                  Borrowed carefully from Osaurus and qwe-qwe: visible runtime state, compact memory, retry budget, and verification posture
                  should stay visible while you work, not buried in logs.
                </p>
              </div>
              <div className="command-center-meta">
                <div className="command-center-meta-card">
                  <span className="command-center-meta-label">Workspace</span>
                  <strong>{config?.workspaceRoot ? shortenText(getPathBasename(config.workspaceRoot), 28) : 'Not bound'}</strong>
                  <span>{plan?.workspaceBound === false ? 'Snapshot only' : 'Backend bound'}</span>
                </div>
                <div className="command-center-meta-card">
                  <span className="command-center-meta-label">Current phase</span>
                  <strong>{streamStatus || plan?.currentPhase || 'ready'}</strong>
                  <span>{plan?.intendedNextAction || 'Awaiting input'}</span>
                </div>
              </div>
            </div>

            <div className="command-center-grid">
              <div className="command-center-card command-center-card-primary">
                <span className="command-center-card-label">Agent</span>
                <strong>{isAgentic ? 'Agent loop' : 'Direct chat'}</strong>
                <p>{isAgentic ? 'Inspect → act → verify → summarize.' : 'Lean answers without heavy orchestration.'}</p>
                <div className="command-center-chip-row">
                  <span className="command-center-chip">{thinkingEnabled ? 'Thinking on' : 'Thinking off'}</span>
                  <span className="command-center-chip">{config?.selfCheckEnabled ? 'Self-check on' : 'Self-check off'}</span>
                </div>
              </div>
              <div className="command-center-card">
                <span className="command-center-card-label">Memory</span>
                <strong>{config?.sessionMemoryEnabled ? `${config.sessionMemoryTurns} recent turns` : 'Disabled'}</strong>
                <p>{config?.sessionMemoryEnabled ? 'Keeps the agent anchored to the last completed work.' : 'Each turn starts cold.'}</p>
              </div>
              <div className="command-center-card">
                <span className="command-center-card-label">Context</span>
                <strong>{config?.contextBudget ? `${Math.round(config.contextBudget / 1000)}k chars` : 'Unknown'}</strong>
                <p>{repoContext?.summary ? shortenText(repoContext.summary, 90) : 'Repo summary loads when indexing completes.'}</p>
              </div>
              <div className="command-center-card">
                <span className="command-center-card-label">Recovery</span>
                <strong>{config?.toolRetryMax ?? 0} correction retries</strong>
                <p>{config?.internetAccessEnabled ? 'Internet tools available when needed.' : 'Offline-first local execution.'}</p>
              </div>
            </div>

            {recentTurns.length > 0 && (
              <div className="command-center-timeline">
                <div className="command-center-section-head">
                  <span>Recent continuity memory</span>
                  <span>{recentTurns.length}</span>
                </div>
                <div className="command-center-timeline-list">
                  {recentTurns.map((turn) => (
                    <div key={turn.timestamp} className="command-center-timeline-item">
                      <span className="command-center-timeline-time">{formatTime(turn.timestamp)}</span>
                      <div>
                        <strong>{turn.intent || `${turn.executionMode} turn`}</strong>
                        <p>{summarizeTurnIntent(turn)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {(isAgentic || isSending || Boolean(plan?.currentRunId) || livePlanSteps.length > 0) && (
            <section className="activity-deck">
              <div className="activity-card activity-card-primary">
                <div className="command-center-section-head">
                  <span>Live Activity</span>
                  <span>{liveActivityBadge}</span>
                </div>
                <div className="activity-summary-grid">
                  <div className="activity-summary-item">
                    <span>Phase</span>
                    <strong>{plan?.currentPhase || streamStatus || 'ready'}</strong>
                  </div>
                  <div className="activity-summary-item">
                    <span>Next</span>
                    <strong>{plan?.intendedNextAction || 'Awaiting input'}</strong>
                  </div>
                  <div className="activity-summary-item">
                    <span>Current Tool</span>
                    <strong>{plan?.currentTool || 'None'}</strong>
                  </div>
                  <div className="activity-summary-item">
                    <span>Tool Path</span>
                    <strong>{plan?.toolProtocol || 'native'}</strong>
                  </div>
                  <div className="activity-summary-item">
                    <span>Workspace</span>
                    <strong>{plan?.workspaceBound === false ? 'Snapshot only' : 'Backend bound'}</strong>
                  </div>
                  <div className="activity-summary-item">
                    <span>Approvals</span>
                    <strong>{approvals.length > 0 ? `${approvals.length} pending` : 'Clear'}</strong>
                  </div>
                </div>
              </div>

              <div className="activity-card">
                <div className="command-center-section-head">
                  <span>Run Steps</span>
                  <span>{livePlanSteps.length}</span>
                </div>
                {livePlanSteps.length === 0 ? (
                  <div className="empty-note">No live run steps yet</div>
                ) : (
                  <div className="activity-step-list">
                    {livePlanSteps.map((step) => (
                      <div key={step.id} className={`activity-step-card activity-step-card-${step.status}`}>
                        <div className="activity-step-meta">
                          <span>{step.type}</span>
                          <span>{step.status}</span>
                        </div>
                        <strong>{step.title}</strong>
                        <p>{step.detail || step.toolName || 'Running.'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="activity-card">
                <div className="command-center-section-head">
                  <span>Recent Trace</span>
                  <span>{liveTraceEntries.length}</span>
                </div>
                {liveTraceEntries.length === 0 ? (
                  <div className="empty-note">No trace events yet</div>
                ) : (
                  <div className="activity-trace-list">
                    {liveTraceEntries.map((trace, index) => (
                      <div key={`${trace.timestamp}-${trace.type}-${index}`} className="activity-trace-row">
                        <div className="activity-trace-meta">
                          <span>{formatTime(trace.timestamp)}</span>
                          <span>{trace.type}</span>
                        </div>
                        <strong>{formatTraceHeadline(trace)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="chat-messages" ref={chatScrollRef}>
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="chat-welcome-logo">G4</div>
                <h2>Let's build</h2>
                <p>{config?.workspaceRoot ? getPathBasename(config.workspaceRoot) : 'Pick a workspace or start a thread.'}</p>
                <div className="chat-welcome-hints">
                  <button className="hint-chip" onClick={() => { setDraft('Review the codebase and summarize the architecture'); }} type="button">
                    Review architecture
                  </button>
                  <button className="hint-chip" onClick={() => { setDraft('Find and fix potential bugs'); }} type="button">
                    Find bugs
                  </button>
                  <button className="hint-chip" onClick={() => { setDraft('Explain the project structure'); }} type="button">
                    Explain project
                  </button>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <ChatMessageRow key={msg.id} message={msg} />
              ))
            )}
          </div>

          {/* Composer */}
          {browserSelection && !workspaceSelection && (
            <div className="tool-execution-tracker" style={{ margin: '0 20px 12px' }}>
              <div className="tool-tracker-header">
                <span>Workspace Binding</span>
              </div>
              <div className="tool-summary-line">
                Browser snapshot active. Assistant can inspect attached folder, but backend writes and commands stay disabled until workspace binds.
              </div>
            </div>
          )}
          {approvals.length > 0 && (
            <div className="tool-execution-tracker approval-inline-panel">
              <div className="tool-tracker-header">
                <span>Approval Needed</span>
                <span>{approvals.length}</span>
              </div>
              <div className="tool-summary-line">
                Run paused on real approval. Approve or reject here without opening side panels.
              </div>
              <ApprovalQueue approvals={approvals} onResolve={resolveApproval} />
            </div>
          )}
          <div className="composer-wrapper">
            <div className="composer">
              <div className="composer-meta">
                <span className="composer-meta-pill" title={config?.workspaceRoot || ''}>
                  Workspace {config?.workspaceRoot ? shortenText(getPathBasename(config.workspaceRoot), 24) : 'none'}
                </span>
                <span className="composer-meta-pill" title={activeModelLabel}>
                  Model {shortenText(activeModelLabel, 20)}
                </span>
                <span className="composer-meta-pill">
                  Memory {config?.sessionMemoryEnabled ? `${config.sessionMemoryTurns}` : 'off'}
                </span>
                <span className="composer-meta-pill">
                  Retry {config?.toolRetryMax ?? 0}
                </span>
                <span className="composer-meta-status">{streamStatus || plan?.currentPhase || 'Ready'}</span>
              </div>
              <textarea
                className="composer-input"
                placeholder={isSending ? 'Generating response...' : 'Ask anything... (Enter to send, Shift+Enter for new line)'}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); }
                }}
                disabled={isSending}
              />
              {attachedImages.length > 0 && (
                <div className="composer-attachments">
                  <div className="composer-attachments-meta">
                    <span>{attachedImages.length} image{attachedImages.length > 1 ? 's' : ''} attached</span>
                    <button
                      className="composer-image-clear-all"
                      onClick={() => {
                        setAttachedImages([]);
                        setAttachmentNotice('');
                      }}
                      type="button"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="composer-attachments-list">
                    {attachedImages.map(image => (
                      <div key={image.id} className="composer-attachment-item">
                        <img className="composer-attachment-thumb" src={image.dataUrl} alt={image.name} />
                        <button
                          className="composer-attachment-remove"
                          onClick={() => {
                            setAttachedImages(cur => cur.filter(item => item.id !== image.id));
                            setAttachmentNotice('');
                          }}
                          type="button"
                          aria-label={`Remove ${image.name}`}
                          title={`Remove ${image.name}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="composer-actions">
                <div className="composer-actions-left">
                  {isAgentic && (
                    <select className="composer-select" value={chatMode} onChange={e => setChatMode(e.target.value as ConversationMode)}>
                      {CHAT_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  )}
                  <button
                    className={`composer-toggle ${isAgentic ? 'composer-toggle-active' : ''}`}
                    onClick={() => setIsAgentic(v => !v)}
                    title={isAgentic ? 'Agentic mode enabled' : 'Direct chat mode enabled'}
                    aria-pressed={isAgentic}
                    type="button"
                  >
                    {isAgentic ? 'Agentic' : 'Direct'}
                  </button>
                  <button
                    className={`composer-toggle composer-toggle-thinking ${thinkingEnabled ? 'composer-toggle-active' : ''}`}
                    onClick={() => setThinkingEnabled(v => !v)}
                    title={thinkingEnabled ? 'Thinking enabled' : 'Thinking disabled'}
                    aria-pressed={thinkingEnabled}
                    type="button"
                  >
                    {thinkingEnabled ? 'Thinking on' : 'Thinking off'}
                  </button>
                  <button
                    className="composer-toggle"
                    onClick={() => {
                      setSettingsOpen(true);
                      setSettingsTab('agent');
                    }}
                    type="button"
                    title="Open agent controls"
                  >
                    Agent controls
                  </button>
                </div>
                <div className="composer-actions-right">
                  <button
                    className="composer-secondary-btn composer-attach-btn"
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                    title={`Attach images (max ${MAX_IMAGE_ATTACHMENTS}, ${formatBytes(MAX_IMAGE_BYTES)} each)`}
                    aria-label="Attach images"
                  >
                    Attach
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="visually-hidden"
                    onChange={e => { void handleImageInput(e); }}
                  />
                  <button className="send-btn" disabled={isSending || (!draft.trim() && attachedImages.length === 0)} onClick={() => void sendChat()} type="button">
                    {isSending ? '…' : 'Send'}
                  </button>
                </div>
              </div>
              <div className="composer-footer">
                {thinkingWarning ? (
                  <span className="composer-note composer-note-warning">{thinkingWarning}</span>
                ) : attachmentNotice ? (
                  <span className="composer-note composer-note-warning">{attachmentNotice}</span>
                ) : (
                  <span className="composer-note">Enter to send. Shift+Enter for newline.</span>
                )}
              </div>
            </div>
          </div>
        </main>

        <RunConsole
          plan={plan?.taskPlan}
          currentStepId={plan?.currentStepId}
          progress={plan?.stepProgress}
          phase={plan?.currentPhase}
          currentTool={plan?.currentTool}
          streamStatus={streamStatus}
          traces={traces}
          approvals={approvals}
          gitDiff={gitDiff}
          onResolveApproval={resolveApproval}
        />

        {/* ── Settings Drawer ── */}
        {settingsOpen && (
          <aside className="settings-drawer">
            <div className="settings-header">
              <span className="settings-header-title">Settings</span>
              <button className="icon-btn" onClick={() => setSettingsOpen(false)} type="button">✕</button>
            </div>

            <div className="settings-tabs">
              {SETTINGS_TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`settings-tab ${settingsTab === tab.id ? 'settings-tab-active' : ''}`}
                  onClick={() => setSettingsTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="settings-body">
              {/* Connection Tab */}
              {settingsTab === 'connection' && (
                <>
                  <div className="settings-section">
                    <div className="settings-section-title">Model Provider</div>
                    <div className="settings-field">
                      <label>Base URL (Ollama endpoint)</label>
                      <input className="settings-input" value={baseUrlDraft} onChange={e => setBaseUrlDraft(e.target.value)} placeholder="http://127.0.0.1:11434/v1" />
                    </div>
                    <div className="settings-field">
                      <label>Model</label>
                      {modelOptions.length > 0 ? (
                        <select className="settings-select" value={modelDraft} onChange={e => setModelDraft(e.target.value)}>
                          {modelOptions.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                      ) : (
                        <input className="settings-input" value={modelDraft} onChange={e => setModelDraft(e.target.value)} placeholder="gemma4:e4b" />
                      )}
                    </div>
                    <div className="settings-row">
                      <div className="settings-field">
                        <label>Profile</label>
                        <select className="settings-select" value={profileDraft} onChange={e => setProfileDraft(e.target.value)}>
                          <option value="fast">Fast (512 tokens)</option>
                          <option value="balanced">Balanced (1536 tokens)</option>
                          <option value="deep">Deep (8192 tokens)</option>
                        </select>
                      </div>
                      <div className="settings-field">
                        <label>Permission Mode</label>
                        <select className="settings-select" value={modeDraft} onChange={e => setModeDraft(e.target.value)}>
                          <option value="read-only">Read Only</option>
                          <option value="workspace-write">Workspace Write</option>
                          <option value="danger">Danger (Full Access)</option>
                        </select>
                      </div>
                    </div>
                    <button className="settings-btn" onClick={() => void saveConfig()} type="button">
                      Save & Apply
                    </button>
                    {settingsStatus && <div className="settings-status">{settingsStatus}</div>}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Runtime Status</div>
                    <div className="settings-info">
                      <div className="settings-info-row">
                        <span>Status</span>
                        <span>{backendStatus}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Configured</span>
                        <span>{modelRuntime?.configuredModel || 'N/A'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Active</span>
                        <span>{modelRuntime?.activeModel || 'None loaded'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Lifecycle</span>
                        <span>{modelRuntime?.supportsLifecycle ? 'Available' : 'Unavailable'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Installed</span>
                        <span>{modelRuntime?.installedModels.join(', ') || 'Loading...'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Capabilities</span>
                        <span>{modelRuntime?.configuredModelCapabilities?.join(', ') || 'Unknown'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Internet</span>
                        <span>{config?.internetAccessEnabled ? 'Enabled' : 'Disabled'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Stream Stall Limit</span>
                        <span>{config?.streamIdleTimeoutMs ? `${Math.round(config.streamIdleTimeoutMs / 1000)}s` : 'Off'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Context Budget</span>
                        <span>{config?.contextBudget ? `${config.contextBudget.toLocaleString()} chars` : 'Unknown'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Local Budget Profile</span>
                        <span>{config?.localModelBudgetProfile || 'balanced'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Run Budget</span>
                        <span>{config?.localModelBudget ? `${config.localModelBudget.maxModelCallsPerRun} model / ${config.localModelBudget.maxToolCallsPerRun} tool` : 'Unknown'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Retry Budget</span>
                        <span>{config?.toolRetryMax ?? 0}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Session Memory</span>
                        <span>{config?.sessionMemoryEnabled ? `${config.sessionMemoryTurns} turns` : 'Off'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Self-check</span>
                        <span>{config?.selfCheckEnabled ? 'Required' : 'Disabled'}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Command Policy</span>
                        <span>{getPermissionModeSummary(config?.mode)}</span>
                      </div>
                      <div className="settings-info-row">
                        <span>Running</span>
                        <span>{modelRuntime?.runningModels.map(m => m.model).join(', ') || 'None'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Skills</div>
                    {skills.length === 0 ? (
                      <div className="empty-note">No skills available</div>
                    ) : (
                      <div className="skill-grid">
                        {skills.map(s => (
                          <button
                            key={s.slug}
                            className={`skill-chip ${selectedSkills.includes(s.slug) ? 'skill-chip-active' : ''}`}
                            onClick={() => setSelectedSkills(cur => cur.includes(s.slug) ? cur.filter(x => x !== s.slug) : [...cur, s.slug])}
                            type="button"
                            title={s.description}
                          >
                            {s.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Workspace Tab */}
              {settingsTab === 'workspace' && (
                <>
                  <div className="settings-section">
                    <div className="settings-section-title">Workspace Path</div>
                    <div className="settings-field">
                      <label>Root directory (host filesystem path)</label>
                      <input className="settings-input" value={workspaceRootDraft} onChange={e => setWorkspaceRootDraft(e.target.value)} placeholder="/path/to/workspace" />
                      <div className="empty-note" style={{ marginTop: '8px' }}>
                        Open Folder now tries to bind picked folder as real workspace. Use this field when auto-binding misses or you want exact manual control.
                      </div>
                    </div>
                    <div className="settings-field">
                      <label>Session Storage</label>
                      <input className="settings-input" value={config?.sessionDataDir || ''} disabled />
                    </div>
                    <button className="settings-btn" onClick={() => void saveConfig()} type="button">
                      Update Workspace
                    </button>
                    {settingsStatus && <div className="settings-status">{settingsStatus}</div>}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Workspace Summary</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                      {repoContext?.summary || 'Workspace not yet indexed. Send a message to trigger indexing.'}
                    </div>
                    {repoContext?.entryPoints?.length ? (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Entry Points</div>
                        {repoContext.entryPoints.slice(0, 8).map(ep => (
                          <div key={ep} style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '2px 0' }}>{ep}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Runtime Snapshot</div>
                    <div className="diff-view">
                      {JSON.stringify(config, null, 2)}
                    </div>
                  </div>
                </>
              )}

              {/* Agent Tab */}
              {settingsTab === 'agent' && (
                <>
                  <div className="settings-section">
                    <div className="settings-section-title">Agent Presets</div>
                    <div className="agent-preset-grid">
                      {AGENT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          className={`agent-preset-card ${activeAgentPreset === preset.id ? 'agent-preset-card-active' : ''}`}
                          onClick={() => applyAgentPreset(preset.id)}
                          type="button"
                        >
                          <strong>{preset.title}</strong>
                          <span>{preset.note}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Agent Controls</div>
                    <div className="settings-row">
                      <div className="settings-field">
                        <label>Context Budget</label>
                        <input
                          className="settings-input"
                          value={contextBudgetDraft}
                          onChange={e => setContextBudgetDraft(e.target.value)}
                          inputMode="numeric"
                          placeholder="24000"
                        />
                      </div>
                      <div className="settings-field">
                        <label>Tool Retry Max</label>
                        <input
                          className="settings-input"
                          value={toolRetryMaxDraft}
                          onChange={e => setToolRetryMaxDraft(e.target.value)}
                          inputMode="numeric"
                          placeholder="2"
                        />
                      </div>
                    </div>
                    <div className="settings-field">
                      <label>Local Model Budget Profile</label>
                      <select
                        className="settings-select"
                        value={localModelBudgetProfileDraft}
                        onChange={e => setLocalModelBudgetProfileDraft(e.target.value as 'lean' | 'balanced' | 'deep')}
                      >
                        <option value="lean">Lean · 6 model calls / 20 tools</option>
                        <option value="balanced">Balanced · 10 model calls / 35 tools</option>
                        <option value="deep">Deep · 16 model calls / 60 tools</option>
                      </select>
                    </div>
                    <div className="settings-row">
                      <div className="settings-field">
                        <label>Session Memory Turns</label>
                        <input
                          className="settings-input"
                          value={sessionMemoryTurnsDraft}
                          onChange={e => setSessionMemoryTurnsDraft(e.target.value)}
                          inputMode="numeric"
                          placeholder="3"
                        />
                      </div>
                      <div className="settings-field">
                        <label>Stream Stall Limit (seconds)</label>
                        <input
                          className="settings-input"
                          value={streamIdleTimeoutDraft}
                          onChange={e => setStreamIdleTimeoutDraft(e.target.value)}
                          inputMode="numeric"
                          placeholder="45"
                        />
                      </div>
                    </div>
                    <div className="agent-toggle-list">
                      <label className="agent-toggle-row">
                        <input
                          type="checkbox"
                          checked={sessionMemoryEnabledDraft}
                          onChange={e => setSessionMemoryEnabledDraft(e.target.checked)}
                        />
                        <span>Enable session memory continuity</span>
                      </label>
                      <label className="agent-toggle-row">
                        <input
                          type="checkbox"
                          checked={selfCheckEnabledDraft}
                          onChange={e => setSelfCheckEnabledDraft(e.target.checked)}
                        />
                        <span>Require self-check after edits or commands</span>
                      </label>
                      <label className="agent-toggle-row">
                        <input
                          type="checkbox"
                          checked={internetAccessDraft}
                          onChange={e => setInternetAccessDraft(e.target.checked)}
                        />
                        <span>Allow internet tools during agent runs</span>
                      </label>
                    </div>
                    <button className="settings-btn" onClick={() => void saveConfig()} type="button">
                      Save Agent Controls
                    </button>
                    {settingsStatus && <div className="settings-status">{settingsStatus}</div>}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Stay-on-task Memory</div>
                    {recentTurns.length === 0 ? (
                      <div className="empty-note">No prior turns stored yet.</div>
                    ) : (
                      <div className="agent-memory-list">
                        {recentTurns.map((turn) => (
                          <div key={turn.timestamp} className="agent-memory-item">
                            <strong>{turn.intent || `${turn.executionMode} turn`}</strong>
                            <span>{summarizeTurnIntent(turn)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Sessions Tab */}
              {settingsTab === 'sessions' && (
                <>
                  <div className="settings-section">
                    <div className="settings-section-title">Current Session</div>
                    {session ? (
                      <div className="settings-info">
                        <div className="settings-info-row"><span>ID</span><span>{shortenText(session.id, 20)}</span></div>
                        <div className="settings-info-row"><span>Model</span><span>{session.model}</span></div>
                        <div className="settings-info-row"><span>Mode</span><span>{session.mode}</span></div>
                        <div className="settings-info-row"><span>Last Turn</span><span>{session.turnHistory && session.turnHistory.length > 0 ? session.turnHistory[session.turnHistory.length - 1].executionMode : 'None'}</span></div>
                        <div className="settings-info-row"><span>Turns</span><span>{session.turnHistory?.length || 0}</span></div>
                        <div className="settings-info-row"><span>Skills</span><span>{session.skillsActive.length || 'None'}</span></div>
                        <div className="settings-info-row"><span>Last Summary</span><span>{summarizeTurnIntent(latestSessionTurn)}</span></div>
                      </div>
                    ) : (
                      <div className="empty-note">No active session</div>
                    )}
                    <button className="settings-btn" onClick={() => void startNewSession()} type="button">
                      New Session
                    </button>
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Saved Sessions ({sessions.length})</div>
                    {sessions.length === 0 ? (
                      <div className="empty-note">No saved sessions</div>
                    ) : (
                      sessions.map(s => (
                        <div key={s.id} className="session-card" onClick={() => void resumeSession(s.id)}>
                          <div className="session-card-top">
                            <span className="session-card-id">{shortenText(s.id, 16)}</span>
                            <span className="session-card-date">{new Date(s.updatedAt).toLocaleString()}</span>
                          </div>
                          <div className="session-card-info">{s.model} · {s.mode}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

              {/* Activity Tab */}
              {settingsTab === 'activity' && (
                <>
                  <div className="settings-section">
                    <div className="settings-section-title">Live Plan</div>
                    {plan ? (
                      <div className="settings-info">
                        <div className="settings-info-row"><span>Task</span><span>{plan.taskSummary}</span></div>
                        <div className="settings-info-row"><span>Phase</span><span>{plan.currentPhase}</span></div>
                        <div className="settings-info-row"><span>Next</span><span>{plan.intendedNextAction}</span></div>
                        <div className="settings-info-row"><span>Complexity</span><span>{plan.complexity || plan.taskPlan?.complexity || 'Unknown'}</span></div>
                        <div className="settings-info-row"><span>Task Steps</span><span>{plan.stepProgress ? `${plan.stepProgress.completed}/${plan.stepProgress.total}` : plan.taskPlan ? `${plan.taskPlan.steps.filter(step => step.status === 'done').length}/${plan.taskPlan.steps.length}` : 'None'}</span></div>
                        <div className="settings-info-row"><span>Status</span><span>{plan.lastStatus || 'None'}</span></div>
                        <div className="settings-info-row"><span>Workspace</span><span>{plan.workspaceRoot || config?.workspaceRoot || 'Unknown'}</span></div>
                        <div className="settings-info-row"><span>Source</span><span>{plan.workspaceSource || 'backend'}</span></div>
                        <div className="settings-info-row"><span>Bound</span><span>{plan.workspaceBound === false ? 'No' : 'Yes'}</span></div>
                        <div className="settings-info-row"><span>Tool Path</span><span>{plan.toolProtocol || 'native'}</span></div>
                        <div className="settings-info-row"><span>Internet</span><span>{plan.internetAccessEnabled ?? config?.internetAccessEnabled ? 'Enabled' : 'Disabled'}</span></div>
                        <div className="settings-info-row"><span>Context Budget</span><span>{plan.contextBudget ?? config?.contextBudget ?? 'Unknown'}</span></div>
                        <div className="settings-info-row"><span>Retry Budget</span><span>{plan.toolRetryMax ?? config?.toolRetryMax ?? 0}</span></div>
                        <div className="settings-info-row"><span>Session Memory</span><span>{plan.sessionMemoryEnabled ?? config?.sessionMemoryEnabled ? `${plan.sessionMemoryTurns ?? config?.sessionMemoryTurns ?? 0} turns` : 'Off'}</span></div>
                        <div className="settings-info-row"><span>Self-check</span><span>{plan.selfCheckEnabled ?? config?.selfCheckEnabled ? 'On' : 'Off'}</span></div>
                        <div className="settings-info-row"><span>Current Tool</span><span>{plan.currentTool || 'None'}</span></div>
                        <div className="settings-info-row"><span>Blockers</span><span>{plan.blockers.length > 0 ? plan.blockers.join(', ') : 'None'}</span></div>
                        {plan.runSummary?.summary ? (
                          <div className="settings-info-row"><span>Run Summary</span><span>{plan.runSummary.summary}</span></div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="empty-note">No live planner state yet</div>
                    )}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Pending Approvals ({approvals.length})</div>
                    {approvals.length === 0 ? (
                      <div className="empty-note">No pending approvals</div>
                    ) : (
                      <ApprovalQueue approvals={approvals} onResolve={resolveApproval} />
                    )}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Trace Log ({traces.slice(-30).length})</div>
                    {traces.slice(-30).length === 0 ? (
                      <div className="empty-note">No trace events yet</div>
                    ) : (
                      traces.slice(-30).map((t, i) => (
                        <details key={`${t.timestamp}-${t.type}-${i}`} className="trace-row">
                          <summary className="trace-row-summary">
                            <span className="trace-row-time">{formatTime(t.timestamp)}</span>
                            <span className="trace-row-type">{t.type}</span>
                            <span className="trace-row-headline">{formatTraceHeadline(t)}</span>
                          </summary>
                          <pre className="trace-row-detail">{safeJsonStringify(t.data)}</pre>
                        </details>
                      ))
                    )}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Git Diff</div>
                    <div className="diff-view">
                      {gitDiff || 'No diff available'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Status Bar ── */}
      <footer className="statusbar">
        <div className="statusbar-left">
          <span className="statusbar-item">
            <span className={`status-dot status-dot-${backendStatus}`} />
            {backendStatus === 'ok' ? 'Connected' : backendStatus}
          </span>
          <span className="statusbar-item">{config?.mode || 'Loading...'}</span>
          {plan?.currentPhase && <span className="statusbar-item">Phase: {plan.currentPhase}</span>}
        </div>
        <div className="statusbar-right">
          <span className="statusbar-item">{approvals.length > 0 ? `${approvals.length} pending approvals` : ''}</span>
          <span className="statusbar-item">Gamma 4 Harness v0.1</span>
        </div>
      </footer>

      {/* ── File Preview Modal ── */}
      {filePreviewOpen && (workspacePreview || browserPreview) && (
        <div className="file-preview-overlay" onClick={() => setFilePreviewOpen(false)}>
          <div className="file-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="file-preview-header">
              <div>
                <div className="file-preview-title">{(workspacePreview || browserPreview)?.name}</div>
                <div className="file-preview-meta">{(workspacePreview || browserPreview)?.path} · {(workspacePreview || browserPreview)?.lineCount} lines · {formatBytes((workspacePreview || browserPreview)?.size || 0)}</div>
              </div>
              <button className="icon-btn" onClick={() => setFilePreviewOpen(false)} type="button">✕</button>
            </div>
            <div className="file-preview-body">
              <pre>{(workspacePreview || browserPreview)?.content}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Hidden folder input for fallback */}
      <input
        className="visually-hidden"
        onChange={e => handleFolderInput(e)}
        ref={folderInputRef}
        type="file"
        multiple
      />
    </div>
  );
}

export default HarnessApp;
