import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { ChatMessageRow } from './components/ChatMessageRow';
import { useStreamingBuffer } from './hooks/useStreamingBuffer';

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

/* ─────────── Types ─────────── */
type ChatRole = 'user' | 'assistant';
type ConversationMode = 'general' | 'architecture' | 'data-analysis' | 'code-review' | 'implementation';
type BackendStatus = 'ok' | 'degraded' | 'offline';
type SettingsTab = 'connection' | 'workspace' | 'sessions' | 'activity';
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
  }>;
}

interface TraceEntry {
  id?: string;
  type: string;
  data: unknown;
  timestamp: number;
}

interface ApprovalItem {
  id: string;
  target: string;
  changeType: string;
  severity: string;
  diffPreview?: string;
  warningMessage?: string;
}

interface PlanState {
  taskSummary: string;
  currentPhase: string;
  activeSkills: string[];
  intendedNextAction: string;
  blockers: string[];
  isComplete: boolean;
  finalOutcome?: string;
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
  | { type: 'run_started'; runId: string; sessionId: string; intent: string; workspaceBound: boolean; browserContextActive: boolean; workspaceSource: 'backend' | 'browser_snapshot'; executionMode: ExecutionMode }
  | { type: 'run_step'; runId: string; step: AgentRunStep }
  | { type: 'run_metric'; runId: string; metrics: Partial<{ filesRead: number; directoriesRead: number; filesWritten: number; commandsRun: number; searchesRun: number; approvals: number; addedLines: number; removedLines: number; firstTokenMs: number; totalMs: number }> }
  | { type: 'run_summary'; runId: string; summary: AgentRunSummary }
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
  { id: 'connection', label: 'Connection' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'activity', label: 'Activity' },
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

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function shortenText(val: string, max = 44): string {
  if (val.length <= max) return val;
  const h = Math.max(10, Math.floor((max - 3) / 2));
  const t = Math.max(8, max - h - 3);
  return `${val.slice(0, h)}...${val.slice(-t)}`;
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
    ? `Active skills: ${skillsList}. ${opts.selectedSkills.includes('caveman') ? 'Guardrail: Never compress structured JSON, code blocks, shell commands, safety warnings, or approval prompts.' : ''}`
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
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['caveman']);
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

  /* ─── Refresh dashboard data ─── */
  const refreshDashboard = useCallback(async (mode: 'full' | 'live' = 'full') => {
    const safe = async <T,>(url: string, fallback: T): Promise<T> => {
      try { return await fetchJson<T>(url); } catch { return fallback; }
    };
    try {
      const traceUrl = mode === 'full' || lastTraceTimestampRef.current === 0
        ? `${API}/trace?limit=240`
        : `${API}/trace?since=${lastTraceTimestampRef.current}`;

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
          });

          if (sig !== lastConfigSigRef.current) {
            lastConfigSigRef.current = sig;
            setWorkspaceRootDraft(cfg.workspaceRoot);
            setBaseUrlDraft(cfg.baseUrl);
            setModelDraft(cfg.model);
            setProfileDraft(cfg.profile);
            setModeDraft(cfg.mode);
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

      const [health, cfg, tr, ap, pl, mrt, sess, sessList, sk, repo, diff] = await Promise.all([
        safe<{ status: BackendStatus }>(`${API}/health`, { status: 'offline' }),
        safe<ConfigState | null>(`${API}/config`, null),
        safe<TraceEntry[]>(traceUrl, []),
        safe<ApprovalItem[]>(`${API}/approvals`, []),
        safe<PlanState | null>(`${API}/plan`, null),
        safe<ModelRuntimeState | null>(`${API}/model/runtime`, null),
        safe<SessionState | null>(`${API}/session`, null),
        safe<SessionState[]>(`${API}/sessions`, []),
        safe<SkillMetadata[]>(`${API}/skills`, []),
        safe<RepoContext | null>(`${API}/workspace/index`, null),
        safe<{ output: string }>(`${API}/workspace/git/diff`, { output: '' }),
      ]);

      applyCoreState(health, cfg, tr, ap, pl, mrt, sess);
      setSessions(sessList);
      setSkills(sk);
      setRepoContext(repo);
      setGitDiff(diff.output);
    } catch { setBackendStatus('offline'); }
  }, []);

  useEffect(() => {
    void refreshDashboard('full');
    if (isSending) {
      return;
    }
    const liveId = setInterval(() => void refreshDashboard('live'), 3000);
    const fullId = setInterval(() => void refreshDashboard('full'), 15000);
    return () => {
      clearInterval(liveId);
      clearInterval(fullId);
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
    await refreshDashboard();
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
    await refreshDashboard();
  }

  async function resumeSession(id: string) {
    const resumed = await fetchJson<SessionState>(`${API}/session/${id}/resume`, { method: 'POST' });
    setSession(resumed);
    setSelectedSkills(resumed.skillsActive);
    setMessages([]);
    await refreshDashboard();
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

      await refreshDashboard();
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
      const activeSkillsForPrompt = isAgentic ? selectedSkills : selectedSkills.filter(s => s !== 'caveman');
      const prompt = buildSystemPrompt(chatMode, {
        workspace: config?.workspaceRoot,
        sessionId: activeSession.id,
        selectedSkills: activeSkillsForPrompt,
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
      await refreshDashboard();
    }
  }

  /* ─── Settings actions ─── */
  async function saveConfig() {
    if (!workspaceRootDraft.trim() || !baseUrlDraft.trim() || !modelDraft.trim()) {
      setSettingsStatus('All fields are required.');
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
          activateModel: shouldActivate,
        }),
      });
      
      if (changingWorkspace) {
        setMessages([]);
      }

      const rt = await fetchJson<ModelRuntimeState>(`${API}/model/runtime`);
      setModelRuntime(rt);
      setSettingsStatus(rt.lastSwitchResult?.message || 'Configuration saved.');
      await refreshDashboard();
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
    await refreshDashboard();
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
          <span className="topbar-title">Gamma 4 Harness</span>
        </div>

        <div className="topbar-center">
          <div className="topbar-badge">
            <span className={`status-dot status-dot-${backendStatus}`} />
            <span>{backendStatus === 'ok' ? 'Online' : backendStatus === 'degraded' ? 'Degraded' : 'Offline'}</span>
          </div>
          <div className="topbar-badge">
            <strong>{activeModelLabel}</strong>
          </div>
          {session && (
            <div className="topbar-badge">
              Session: {shortenText(session.id, 12)}
            </div>
          )}
        </div>

        <div className="topbar-right">
          <button className="icon-btn" onClick={() => void startNewSession()} type="button" title="New Session">＋</button>
          <button className="icon-btn" onClick={() => void refreshDashboard()} type="button" title="Refresh">↻</button>
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

        {/* ── Sidebar: File Tree ── */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-header-title">Explorer</span>
            <button className="btn-sm" onClick={() => void pickFolder()} type="button">
              {browserLoading ? 'Loading...' : 'Open Folder'}
            </button>
          </div>

          {sidebarSelection && (
            <div className="sidebar-search">
              <input
                className="search-input"
                placeholder={workspaceSelection ? 'Search AI workspace...' : 'Search attached folder...'}
                value={browserFilter}
                onChange={e => setBrowserFilter(e.target.value)}
              />
            </div>
          )}

          <div className="sidebar-tree">
            {filteredTree ? (
              <TreeView
                node={filteredTree}
                depth={0}
                expanded={expandedPaths}
                onToggle={togglePath}
                onSelect={n => void previewFile(n)}
                selected={workspaceSelection ? (workspacePreview?.path || '') : (browserPreview?.path || '')}
              />
            ) : (
              <div className="sidebar-empty">
                <div className="sidebar-empty-icon">📁</div>
                <div>Open folder to bind AI workspace.<br/>If browser cannot reveal disk path, app falls back to read-only browser context.</div>
              </div>
            )}
          </div>

          {workspaceSelection && (
            <div className="sidebar-stats">
              AI workspace: {shortenText(workspaceSelection.label, 52)} · {workspaceSelection.fileCount} files
            </div>
          )}

          {browserSelection && (
            <div className="sidebar-stats">
              Attached browser context: {shortenText(browserSelection.label, 42)} · {browserSelection.fileCount} files
            </div>
          )}
        </aside>

        {/* ── Chat Panel ── */}
        <main className="chat-panel">
          <div className="chat-messages" ref={chatScrollRef}>
            {messages.length === 0 ? (
              <div className="chat-welcome">
                <div className="chat-welcome-logo">G4</div>
                <h2>Gamma 4 Harness</h2>
                <p>Open folder to move real AI workspace. If path binding fails, harness keeps picked folder as read-only browser context and avoids faking tool access.</p>
                <div className="chat-welcome-hints">
                  <button className="hint-chip" onClick={() => { setDraft('Review the codebase and summarize the architecture'); }} type="button">
                    Review architecture
                  </button>
                  <button className="hint-chip" onClick={() => { setDraft('List all files in the workspace'); }} type="button">
                    List workspace files
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
          <div className="composer-wrapper">
            <div className="composer">
              <div className="composer-meta">
                <span className="composer-meta-pill" title={config?.workspaceRoot || ''}>
                  Workspace {config?.workspaceRoot ? shortenText(getPathBasename(config.workspaceRoot), 24) : 'none'}
                </span>
                <span className="composer-meta-pill" title={activeModelLabel}>
                  Model {shortenText(activeModelLabel, 20)}
                </span>
                {selectedSkills.includes('caveman') && isAgentic && (
                  <span className="composer-meta-pill composer-meta-pill-accent" title="Caveman style applied to agentic output">
                    Caveman
                  </span>
                )}
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
                    <div className="settings-section-title">Pending Approvals ({approvals.length})</div>
                    {approvals.length === 0 ? (
                      <div className="empty-note">No pending approvals</div>
                    ) : (
                      approvals.map(a => (
                        <div key={a.id} className="approval-card">
                          <div className="approval-card-head">
                            <span className="approval-card-title">{a.changeType}</span>
                            <span className={`approval-severity ${a.severity === 'danger' ? 'approval-severity-danger' : a.severity === 'info' ? 'approval-severity-info' : ''}`}>
                              {a.severity}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>{a.target}</div>
                          {(a.diffPreview || a.warningMessage) && (
                            <div className="approval-preview">{a.diffPreview || a.warningMessage}</div>
                          )}
                          <div className="approval-actions">
                            <button className="approval-btn approval-btn-approve" onClick={() => void resolveApproval(a.id, true)} type="button">Approve</button>
                            <button className="approval-btn approval-btn-reject" onClick={() => void resolveApproval(a.id, false)} type="button">Reject</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="settings-section">
                    <div className="settings-section-title">Trace Log ({traces.slice(-30).length})</div>
                    {traces.slice(-30).length === 0 ? (
                      <div className="empty-note">No trace events yet</div>
                    ) : (
                      traces.slice(-30).map((t, i) => (
                        <div key={`${t.timestamp}-${t.type}-${i}`} className="trace-row">
                          <span className="trace-row-time">{formatTime(t.timestamp)}</span>
                          <span className="trace-row-type">{t.type}</span>
                        </div>
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
