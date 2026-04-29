import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CoreEngine } from '@local-harness/core';
import { ModelAdapter } from '@local-harness/model-adapter';
import type { ModelRuntimeState } from '@local-harness/model-adapter';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '127.0.0.1';
const WORKSPACE_ROOT = process.env.HARNESS_WORKSPACE_ROOT || process.cwd();
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SKILLS_PATH = path.resolve(REPO_ROOT, 'packages/skills/dist/curated_pack.json');
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_CHAT_IMAGE_ATTACHMENTS = 2;
const MAX_CHAT_IMAGE_BYTES = 1024 * 1024;
const WORKSPACE_RESOLVE_MAX_DEPTH = 3;
const WORKSPACE_RESOLVE_MAX_VISITS = 2000;
const WORKSPACE_RESOLVE_MAX_CANDIDATES = 64;
const modelRuntimeCacheTtlSetting = Number(process.env.HARNESS_MODEL_RUNTIME_CACHE_MS);
const MODEL_RUNTIME_CACHE_TTL_MS = Number.isFinite(modelRuntimeCacheTtlSetting)
  ? Math.max(5_000, Math.min(15_000, modelRuntimeCacheTtlSetting))
  : 10_000;
const WORKSPACE_RESOLVE_IGNORES = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.cache',
  '.idea',
  '.vscode',
  '.yarn',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

const defaultAllowedOrigins = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://127.0.0.1:8080',
  'http://localhost:8080',
];

const configuredAllowedOrigins = (process.env.HARNESS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = new Set([
  ...defaultAllowedOrigins,
  ...configuredAllowedOrigins,
]);

const engine = new CoreEngine({
  workspaceRoot: WORKSPACE_ROOT,
});
let modelRuntimeCache: { value: ModelRuntimeState; expiresAt: number } | null = null;

async function getCachedModelRuntime(force = false): Promise<ModelRuntimeState> {
  const now = Date.now();
  if (!force && modelRuntimeCache && modelRuntimeCache.expiresAt > now) {
    return modelRuntimeCache.value;
  }

  const value = await engine.getModelRuntime();
  modelRuntimeCache = {
    value,
    expiresAt: Date.now() + MODEL_RUNTIME_CACHE_TTL_MS,
  };
  return value;
}

function clearModelRuntimeCache() {
  modelRuntimeCache = null;
}

function getApiGuide() {
  const localHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  return {
    name: 'Gamma 4 Harness API',
    status: 'ok',
    apiBaseUrl: `http://${localHost}:${PORT}/api`,
    healthUrl: `http://${localHost}:${PORT}/api/health`,
    modelRuntimeUrl: `http://${localHost}:${PORT}/api/model/runtime`,
    webUrl: 'http://localhost:8080',
    note: 'Use localhost or 127.0.0.1 in your browser. 0.0.0.0 is a bind address, not a browser address.',
  };
}

function applyCors(req: http.IncomingMessage, res: http.ServerResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(req: http.IncomingMessage, res: http.ServerResponse, status: number, data: unknown) {
  applyCors(req, res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function startNdjson(req: http.IncomingMessage, res: http.ServerResponse) {
  applyCors(req, res);
  res.writeHead(200, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

function writeNdjson(res: http.ServerResponse, event: unknown) {
  if (!res.writableEnded) {
    res.write(`${JSON.stringify(event)}\n`);
  }
}

function writeTraceNdjson(res: http.ServerResponse, event: { type: string; id?: string; timestamp?: number; data?: unknown }) {
  writeNdjson(res, {
    type: event.type,
    id: event.id,
    timestamp: event.timestamp,
    data: event.data,
  });
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body) as Record<string, unknown>);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

async function loadSkills() {
  try {
    const raw = await fs.readFile(SKILLS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getQueryValue(url: URL, key: string, fallback = ''): string {
  return url.searchParams.get(key) || fallback;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getThinkingWarning(capabilities: string[] | undefined, thinkingEnabled: boolean | undefined): string | null {
  if (thinkingEnabled !== true) {
    return null;
  }

  if (Array.isArray(capabilities) && capabilities.includes('thinking')) {
    return null;
  }

  return 'Thinking unavailable on current model; toggle may be ignored.';
}

function estimateBase64Bytes(value: string): number {
  const normalized = value.replace(/^data:[^,]+,/, '').trim();
  if (!normalized) {
    return 0;
  }

  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function validateChatImages(images: string[]): string | null {
  if (images.length > MAX_CHAT_IMAGE_ATTACHMENTS) {
    return `At most ${MAX_CHAT_IMAGE_ATTACHMENTS} images can be attached per turn.`;
  }

  for (const image of images) {
    if (estimateBase64Bytes(image) > MAX_CHAT_IMAGE_BYTES) {
      return `Each image must be ${formatBytes(MAX_CHAT_IMAGE_BYTES)} or smaller.`;
    }
  }

  return null;
}

function sendBadRequest(req: http.IncomingMessage, res: http.ServerResponse, message: string) {
  sendJson(req, res, 400, { error: message });
}

function normalizeFolderLabel(value: string): string {
  return value.trim().replace(/[\\/]+$/, '');
}

function normalizeRelativeFiles(relativeFiles: string[]): string[] {
  return Array.from(new Set(
    relativeFiles
      .map((entry) => entry.replace(/\\/g, '/').replace(/^\.?\//, '').trim())
      .filter((entry) => Boolean(entry) && !entry.startsWith('../') && !path.isAbsolute(entry)),
  )).slice(0, 120);
}

function pickVerificationFiles(relativeFiles: string[]): string[] {
  const commonFiles = new Set([
    '.gitignore',
    'README.md',
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'index.ts',
    'index.tsx',
    'index.js',
    'index.jsx',
  ]);

  return [...relativeFiles]
    .sort((left, right) => {
      const leftDepth = left.split('/').length;
      const rightDepth = right.split('/').length;
      const leftPenalty = commonFiles.has(path.basename(left)) ? 0 : 2;
      const rightPenalty = commonFiles.has(path.basename(right)) ? 0 : 2;
      return (rightDepth + rightPenalty) - (leftDepth + leftPenalty) || right.length - left.length;
    })
    .slice(0, 12);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildWorkspaceResolveRoots(currentWorkspaceRoot: string): string[] {
  const envRoots = (process.env.HARNESS_WORKSPACE_SEARCH_ROOTS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const roots = [currentWorkspaceRoot];
  let cursor = currentWorkspaceRoot;
  for (let i = 0; i < 2; i++) {
    const parent = path.dirname(cursor);
    if (!parent || parent === cursor) break;
    roots.push(parent);
    cursor = parent;
  }

  return Array.from(new Set(
    [...roots, ...envRoots.map((entry) => path.resolve(entry))]
      .map((entry) => path.resolve(entry)),
  ));
}

async function collectWorkspaceCandidates(
  rootPath: string,
  folderLabel: string,
  depthRemaining: number,
  rootPriority: number,
  discoveryDepth: number,
  visited: { count: number },
  candidates: Map<string, { candidatePath: string; rootPriority: number; discoveryDepth: number }>,
): Promise<void> {
  if (candidates.size >= WORKSPACE_RESOLVE_MAX_CANDIDATES || visited.count >= WORKSPACE_RESOLVE_MAX_VISITS) {
    return;
  }

  let stat;
  try {
    stat = await fs.stat(rootPath);
  } catch {
    return;
  }

  if (!stat.isDirectory()) {
    return;
  }

  if (path.basename(rootPath) === folderLabel) {
    const existing = candidates.get(rootPath);
    if (
      !existing ||
      rootPriority < existing.rootPriority ||
      (rootPriority === existing.rootPriority && discoveryDepth < existing.discoveryDepth)
    ) {
      candidates.set(rootPath, {
        candidatePath: rootPath,
        rootPriority,
        discoveryDepth,
      });
    }
  }

  if (depthRemaining <= 0) {
    return;
  }

  let entries: Array<{ isDirectory(): boolean; name: string }>;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true }) as Array<{ isDirectory(): boolean; name: string }>;
  } catch {
    return;
  }

  for (const entry of entries) {
    if (candidates.size >= WORKSPACE_RESOLVE_MAX_CANDIDATES || visited.count >= WORKSPACE_RESOLVE_MAX_VISITS) {
      break;
    }
    if (!entry.isDirectory() || WORKSPACE_RESOLVE_IGNORES.has(entry.name)) {
      continue;
    }

    const nextPath = path.join(rootPath, entry.name);
    visited.count += 1;

    if (entry.name === folderLabel) {
      const existing = candidates.get(nextPath);
      if (
        !existing ||
        rootPriority < existing.rootPriority ||
        (rootPriority === existing.rootPriority && discoveryDepth + 1 < existing.discoveryDepth)
      ) {
        candidates.set(nextPath, {
          candidatePath: nextPath,
          rootPriority,
          discoveryDepth: discoveryDepth + 1,
        });
      }
      continue;
    }

    await collectWorkspaceCandidates(nextPath, folderLabel, depthRemaining - 1, rootPriority, discoveryDepth + 1, visited, candidates);
  }
}

async function scoreWorkspaceCandidate(candidatePath: string, verificationFiles: string[]): Promise<number> {
  if (verificationFiles.length === 0) {
    return 0;
  }

  let matches = 0;
  for (const relPath of verificationFiles) {
    if (await pathExists(path.join(candidatePath, relPath))) {
      matches += 1;
    }
  }
  return matches;
}

async function resolveWorkspaceFromFolderSelection(
  currentWorkspaceRoot: string,
  folderLabel: string,
  relativeFiles: string[],
): Promise<{ workspaceRoot: string; matchedFiles: number; candidateCount: number } | null> {
  const normalizedLabel = normalizeFolderLabel(folderLabel);
  if (!normalizedLabel) {
    return null;
  }

  const normalizedFiles = normalizeRelativeFiles(relativeFiles);
  const verificationFiles = pickVerificationFiles(normalizedFiles);
  const candidates = new Map<string, { candidatePath: string; rootPriority: number; discoveryDepth: number }>();
  const visited = { count: 0 };

  for (const [rootPriority, rootPath] of buildWorkspaceResolveRoots(currentWorkspaceRoot).entries()) {
    await collectWorkspaceCandidates(rootPath, normalizedLabel, WORKSPACE_RESOLVE_MAX_DEPTH, rootPriority, 0, visited, candidates);
  }

  if (candidates.size === 0) {
    return null;
  }

  const scoredCandidates = await Promise.all(
    [...candidates.values()].map(async ({ candidatePath, rootPriority, discoveryDepth }) => ({
      candidatePath,
      matchedFiles: await scoreWorkspaceCandidate(candidatePath, verificationFiles),
      rootPriority,
      discoveryDepth,
    })),
  );

  scoredCandidates.sort((left, right) =>
    right.matchedFiles - left.matchedFiles ||
    left.rootPriority - right.rootPriority ||
    left.discoveryDepth - right.discoveryDepth ||
    left.candidatePath.length - right.candidatePath.length,
  );

  const bestCandidate = scoredCandidates[0];
  if (!bestCandidate) {
    return null;
  }

  if (verificationFiles.length > 0 && bestCandidate.matchedFiles === 0) {
    return null;
  }

  return {
    workspaceRoot: bestCandidate.candidatePath,
    matchedFiles: bestCandidate.matchedFiles,
    candidateCount: scoredCandidates.length,
  };
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET';
  const requestUrl = new URL(req.url || '/', `http://${HOST}:${PORT}`);

  if (method === 'OPTIONS') {
    applyCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if ((requestUrl.pathname === '/' || requestUrl.pathname === '/api') && method === 'GET') {
      sendJson(req, res, 200, getApiGuide());
      return;
    }

    if (requestUrl.pathname === '/api/health' && method === 'GET') {
      const healthy = await engine.isHealthy();
      sendJson(req, res, 200, {
        status: healthy ? 'ok' : 'degraded',
        model: engine.getPublicConfig().model,
      });
      return;
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      sendJson(req, res, 200, engine.getPublicConfig());
      return;
    }

    if (requestUrl.pathname === '/api/config' && method === 'POST') {
      const body = await readBody(req);
      const validModes = new Set(['read-only', 'workspace-write', 'danger']);
      const validProfiles = new Set(['fast', 'balanced', 'deep']);
      const validBudgetProfiles = new Set(['lean', 'balanced', 'deep']);
      const validExecutionProfiles = new Set(['fast_local', 'balanced_local', 'deep_review', 'api_frontier']);
      const validProviderProfiles = new Set(['ollama_local', 'openai_compatible', 'openrouter', 'together', 'groq', 'qwen_api', 'kimi_api']);
      const validPromptProfiles = new Set(['gemma-local-fast', 'qwen-coder-local', 'deepseek-coder-local', 'kimi-api-long-context', 'frontier-mini-api']);
      if (body.baseUrl !== undefined && typeof body.baseUrl !== 'string') {
        sendBadRequest(req, res, 'baseUrl must be a string.');
        return;
      }
      if (body.model !== undefined && typeof body.model !== 'string') {
        sendBadRequest(req, res, 'model must be a string.');
        return;
      }
      if (body.workspaceRoot !== undefined && typeof body.workspaceRoot !== 'string') {
        sendBadRequest(req, res, 'workspaceRoot must be a string.');
        return;
      }
      if (body.sessionDataDir !== undefined && typeof body.sessionDataDir !== 'string') {
        sendBadRequest(req, res, 'sessionDataDir must be a string.');
        return;
      }
      if (body.mode !== undefined && (typeof body.mode !== 'string' || !validModes.has(body.mode))) {
        sendBadRequest(req, res, 'mode must be one of read-only, workspace-write, or danger.');
        return;
      }
      if (body.profile !== undefined && (typeof body.profile !== 'string' || !validProfiles.has(body.profile))) {
        sendBadRequest(req, res, 'profile must be one of fast, balanced, or deep.');
        return;
      }
      if (body.localModelBudgetProfile !== undefined && (typeof body.localModelBudgetProfile !== 'string' || !validBudgetProfiles.has(body.localModelBudgetProfile))) {
        sendBadRequest(req, res, 'localModelBudgetProfile must be one of lean, balanced, or deep.');
        return;
      }
      if (body.executionProfile !== undefined && (typeof body.executionProfile !== 'string' || !validExecutionProfiles.has(body.executionProfile))) {
        sendBadRequest(req, res, 'executionProfile must be one of fast_local, balanced_local, deep_review, or api_frontier.');
        return;
      }
      if (body.providerProfile !== undefined && (typeof body.providerProfile !== 'string' || !validProviderProfiles.has(body.providerProfile))) {
        sendBadRequest(req, res, 'providerProfile is not supported.');
        return;
      }
      if (body.promptProfile !== undefined && (typeof body.promptProfile !== 'string' || !validPromptProfiles.has(body.promptProfile))) {
        sendBadRequest(req, res, 'promptProfile is not supported.');
        return;
      }
      for (const key of ['fastModel', 'codingModel', 'reviewModel', 'apiModel']) {
        if (body[key] !== undefined && typeof body[key] !== 'string') {
          sendBadRequest(req, res, `${key} must be a string.`);
          return;
        }
      }
      if (body.internetAccessEnabled !== undefined && typeof body.internetAccessEnabled !== 'boolean') {
        sendBadRequest(req, res, 'internetAccessEnabled must be a boolean.');
        return;
      }
      if (
        body.contextBudget !== undefined &&
        (typeof body.contextBudget !== 'number' || !Number.isFinite(body.contextBudget) || body.contextBudget < 4000)
      ) {
        sendBadRequest(req, res, 'contextBudget must be a number greater than or equal to 4000.');
        return;
      }
      if (
        body.toolRetryMax !== undefined &&
        (typeof body.toolRetryMax !== 'number' || !Number.isFinite(body.toolRetryMax) || body.toolRetryMax < 0)
      ) {
        sendBadRequest(req, res, 'toolRetryMax must be a non-negative number.');
        return;
      }
      if (body.sessionMemoryEnabled !== undefined && typeof body.sessionMemoryEnabled !== 'boolean') {
        sendBadRequest(req, res, 'sessionMemoryEnabled must be a boolean.');
        return;
      }
      if (
        body.sessionMemoryTurns !== undefined &&
        (typeof body.sessionMemoryTurns !== 'number' || !Number.isFinite(body.sessionMemoryTurns) || body.sessionMemoryTurns < 1)
      ) {
        sendBadRequest(req, res, 'sessionMemoryTurns must be a number greater than or equal to 1.');
        return;
      }
      if (body.selfCheckEnabled !== undefined && typeof body.selfCheckEnabled !== 'boolean') {
        sendBadRequest(req, res, 'selfCheckEnabled must be a boolean.');
        return;
      }
      const streamIdleTimeoutMs = body.streamIdleTimeoutMs;
      if (
        streamIdleTimeoutMs !== undefined &&
        (typeof streamIdleTimeoutMs !== 'number' || !Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs < 0)
      ) {
        sendBadRequest(req, res, 'streamIdleTimeoutMs must be a non-negative number.');
        return;
      }
      await engine.updateConfig(body as any, {
        activateModel: body.activateModel === true,
      });
      clearModelRuntimeCache();
      sendJson(req, res, 200, engine.getPublicConfig());
      return;
    }

    if (requestUrl.pathname === '/api/trace' && method === 'GET') {
      const sinceRaw = Number(getQueryValue(requestUrl, 'since'));
      const limitRaw = Number(getQueryValue(requestUrl, 'limit'));
      let trace = engine.getTraceLog();

      if (Number.isFinite(sinceRaw) && sinceRaw > 0) {
        trace = trace.filter((entry) => entry.timestamp > sinceRaw);
      }

      if (Number.isFinite(limitRaw) && limitRaw > 0) {
        trace = trace.slice(-Math.floor(limitRaw));
      }

      sendJson(req, res, 200, trace);
      return;
    }

    if (requestUrl.pathname === '/api/plan' && method === 'GET') {
      sendJson(req, res, 200, engine.getPlanState());
      return;
    }

    if (requestUrl.pathname === '/api/session' && method === 'POST') {
      const body = await readBody(req);
      const skills = Array.isArray(body.skills) ? body.skills.filter((skill): skill is string => typeof skill === 'string') : [];
      const session = engine.startSession(skills);
      sendJson(req, res, 201, session);
      return;
    }

    if (requestUrl.pathname === '/api/session' && method === 'GET') {
      sendJson(req, res, 200, engine.getSession());
      return;
    }

    if (requestUrl.pathname === '/api/sessions' && method === 'GET') {
      sendJson(req, res, 200, await engine.listSessions());
      return;
    }

    if (requestUrl.pathname.startsWith('/api/session/') && requestUrl.pathname.endsWith('/resume') && method === 'POST') {
      const sessionId = requestUrl.pathname.split('/')[3];
      const session = await engine.resumeSession(sessionId);
      sendJson(req, res, session ? 200 : 404, session || { error: 'Session not found.' });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/session/') && method === 'DELETE') {
      const sessionId = requestUrl.pathname.split('/')[3];
      const deleted = await engine.deleteSession(sessionId);
      sendJson(req, res, deleted ? 200 : 404, { deleted });
      return;
    }

    if (requestUrl.pathname === '/api/skills' && method === 'GET') {
      sendJson(req, res, 200, await loadSkills());
      return;
    }

    if (requestUrl.pathname === '/api/models' && method === 'GET') {
      sendJson(req, res, 200, await engine.listModels());
      return;
    }

    if (requestUrl.pathname === '/api/model/runtime' && method === 'GET') {
      sendJson(req, res, 200, await getCachedModelRuntime());
      return;
    }

    if (requestUrl.pathname === '/api/chat' && method === 'POST') {
      const abortController = new AbortController();
      const onAborted = () => abortController.abort();
      req.on('aborted', onAborted);

      try {
        const body = await readBody(req);
        let messages = Array.isArray(body.messages) ? body.messages : [];
        const isAgentic = body.agentic !== false;
        const thinkingEnabled = typeof body.thinking === 'boolean' ? body.thinking : undefined;
        const images = Array.isArray(body.images) ? body.images.filter((img): img is string => typeof img === 'string') : [];
        const imageValidationError = validateChatImages(images);
        if (imageValidationError) {
          sendBadRequest(req, res, imageValidationError);
          return;
        }
        const runtime = await getCachedModelRuntime();
        const thinkingWarning = getThinkingWarning(runtime.configuredModelCapabilities, thinkingEnabled);

        // Attach images to the last user message if provided
        if (images.length > 0 && messages.length > 0) {
          const lastUserIdx = messages.map((m: any) => m.role).lastIndexOf('user');
          if (lastUserIdx >= 0) {
            messages[lastUserIdx] = { ...messages[lastUserIdx], images };
          }
        }

        if (!isAgentic) {
          const content = await engine.directChat(
            messages as { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[],
            { signal: abortController.signal, think: thinkingEnabled },
          );
          sendJson(req, res, 200, { response: content, executionMode: 'direct', ...(thinkingWarning ? { warning: thinkingWarning } : {}) });
          return;
        }

        const response = await engine.chat(messages as { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[], { signal: abortController.signal, think: thinkingEnabled });
        sendJson(req, res, 200, { response, executionMode: 'agentic', ...(thinkingWarning ? { warning: thinkingWarning } : {}) });
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        throw error;
      } finally {
        req.off('aborted', onAborted);
      }
      return;
    }

    if (requestUrl.pathname === '/api/chat/stream' && method === 'POST') {
      const abortController = new AbortController();
      const onAbort = () => abortController.abort();
      req.on('aborted', onAbort);
      res.on('close', onAbort);

      try {
        const body = await readBody(req);
        let messages = Array.isArray(body.messages) ? body.messages : [];
        const isAgentic = body.agentic !== false;
        const thinkingEnabled = typeof body.thinking === 'boolean' ? body.thinking : undefined;
        const images = Array.isArray(body.images) ? body.images.filter((img): img is string => typeof img === 'string') : [];
        const imageValidationError = validateChatImages(images);
        if (imageValidationError) {
          startNdjson(req, res);
          writeNdjson(res, { type: 'error', message: imageValidationError });
          res.end();
          return;
        }
        const runtime = await getCachedModelRuntime();
        const thinkingWarning = getThinkingWarning(runtime.configuredModelCapabilities, thinkingEnabled);

        // Attach images to the last user message if provided
        if (images.length > 0 && messages.length > 0) {
          const lastUserIdx = messages.map((m: any) => m.role).lastIndexOf('user');
          if (lastUserIdx >= 0) {
            messages[lastUserIdx] = { ...messages[lastUserIdx], images };
          }
        }

        startNdjson(req, res);

        if (!isAgentic) {
          if (thinkingWarning) {
            writeNdjson(res, { type: 'status', phase: 'warning', action: thinkingWarning, loop: 0 });
          }

          const response = await engine.directChatStream(
            messages as any,
            {
              onStatus: (event: { phase: string; action: string; loop: number }) => writeNdjson(res, { type: 'status', ...event }),
              onDelta: (delta: string) => writeNdjson(res, { type: 'delta', delta }),
              onTool: (event) => writeNdjson(res, { type: 'tool', ...event }),
              onApproval: (event) => writeNdjson(res, event),
              onRunStarted: (event) => writeNdjson(res, event),
              onRunStep: (event) => writeNdjson(res, event),
              onRunMetric: (event) => writeNdjson(res, event),
              onRunSummary: (event) => writeNdjson(res, event),
              onTrace: (event) => writeTraceNdjson(res, event),
            },
            { signal: abortController.signal, think: thinkingEnabled }
          );

          writeNdjson(res, { type: 'done', response });
          res.end();
          return;
        }

        const response = await engine.chatStream(
          messages as { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[],
          {
            onStatus: (event: { phase: string; action: string; loop: number }) => writeNdjson(res, { type: 'status', ...event }),
            onDelta: (delta: string) => writeNdjson(res, { type: 'delta', delta }),
            onTool: (event) => writeNdjson(res, { type: 'tool', ...event }),
            onApproval: (event) => writeNdjson(res, event),
            onRunStarted: (event) => writeNdjson(res, event),
            onRunStep: (event) => writeNdjson(res, event),
            onRunMetric: (event) => writeNdjson(res, event),
            onRunSummary: (event) => writeNdjson(res, event),
            onTrace: (event) => writeTraceNdjson(res, event),
          },
          { signal: abortController.signal, think: thinkingEnabled },
        );
        writeNdjson(res, { type: 'done', response });
        res.end();
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          return;
        }
        if (res.headersSent) {
          writeNdjson(res, { type: 'error', message: error?.message || 'Stream failed.' });
          res.end();
          return;
        }
        throw error;
      } finally {
        req.off('aborted', onAbort);
        res.off('close', onAbort);
      }
      return;
    }

    if (requestUrl.pathname === '/api/runs' && method === 'GET') {
      sendJson(req, res, 200, await engine.listRuns());
      return;
    }

    if (requestUrl.pathname.startsWith('/api/runs/') && requestUrl.pathname.endsWith('/checkpoint') && method === 'GET') {
      const runId = requestUrl.pathname.split('/')[3];
      const checkpoint = await engine.getRunCheckpoint(runId);
      sendJson(req, res, checkpoint ? 200 : 404, checkpoint || { error: 'Run checkpoint not found.' });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/runs/') && requestUrl.pathname.endsWith('/resume') && method === 'POST') {
      const runId = requestUrl.pathname.split('/')[3];
      const checkpoint = await engine.resumeRun(runId);
      sendJson(req, res, checkpoint ? 200 : 404, checkpoint || { error: 'Run checkpoint not found.' });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/runs/') && method === 'GET') {
      const runId = requestUrl.pathname.split('/')[3];
      const checkpoint = await engine.getRun(runId);
      sendJson(req, res, checkpoint ? 200 : 404, checkpoint || { error: 'Run not found.' });
      return;
    }

    if (requestUrl.pathname === '/api/approvals' && method === 'GET') {
      sendJson(req, res, 200, engine.getPendingApprovals());
      return;
    }

    if (requestUrl.pathname.startsWith('/api/approvals/') && method === 'POST') {
      const approvalId = requestUrl.pathname.split('/')[3];
      const body = await readBody(req);
      const approved = Boolean(body.approved);
      const editInstruction = typeof body.editInstruction === 'string' ? body.editInstruction : undefined;
      const resolved = engine.resolveApproval(approvalId, approved, editInstruction);
      sendJson(req, res, resolved ? 200 : 404, { resolved });
      return;
    }

    if (requestUrl.pathname === '/api/workspace/index' && method === 'GET') {
      sendJson(req, res, 200, await engine.indexWorkspace());
      return;
    }

    if (requestUrl.pathname === '/api/workspace/resolve' && method === 'POST') {
      const body = await readBody(req);
      const folderLabel = typeof body.folderLabel === 'string' ? body.folderLabel : '';
      const relativeFiles = Array.isArray(body.relativeFiles)
        ? body.relativeFiles.filter((entry): entry is string => typeof entry === 'string')
        : [];

      if (!folderLabel.trim()) {
        sendBadRequest(req, res, 'folderLabel is required.');
        return;
      }

      const resolution = await resolveWorkspaceFromFolderSelection(
        engine.getPublicConfig().workspaceRoot,
        folderLabel,
        relativeFiles,
      );

      if (!resolution) {
        sendJson(req, res, 404, {
          error: 'Unable to map picked folder to a unique on-disk workspace path.',
        });
        return;
      }

      await engine.updateConfig({ workspaceRoot: resolution.workspaceRoot });
      sendJson(req, res, 200, {
        resolved: true,
        workspaceRoot: resolution.workspaceRoot,
        matchedFiles: resolution.matchedFiles,
        candidateCount: resolution.candidateCount,
        config: engine.getPublicConfig(),
      });
      return;
    }

    if (requestUrl.pathname === '/api/workspace/list' && method === 'GET') {
      const targetPath = getQueryValue(requestUrl, 'path', '.');
      sendJson(req, res, 200, await engine.listDir(targetPath));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/file' && method === 'GET') {
      const targetPath = getQueryValue(requestUrl, 'path');
      if (!targetPath) {
        sendBadRequest(req, res, 'path query parameter is required.');
        return;
      }
      sendJson(req, res, 200, await engine.readFile(targetPath));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/search' && method === 'GET') {
      const query = getQueryValue(requestUrl, 'q');
      const pattern = getQueryValue(requestUrl, 'pattern');
      if (!query) {
        sendBadRequest(req, res, 'q query parameter is required.');
        return;
      }
      sendJson(req, res, 200, await engine.searchText(query, pattern || undefined));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/write' && method === 'POST') {
      const body = await readBody(req);
      const targetPath = typeof body.path === 'string' ? body.path : '';
      const content = typeof body.content === 'string' ? body.content : '';
      if (!targetPath) {
        sendBadRequest(req, res, 'path is required.');
        return;
      }
      sendJson(req, res, 200, await engine.writeFile(targetPath, content));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/patch' && method === 'POST') {
      const body = await readBody(req);
      const targetPath = typeof body.path === 'string' ? body.path : '';
      const oldContent = typeof body.oldContent === 'string' ? body.oldContent : '';
      const newContent = typeof body.newContent === 'string' ? body.newContent : '';
      if (!targetPath) {
        sendBadRequest(req, res, 'path is required.');
        return;
      }
      if (!oldContent) {
        sendBadRequest(req, res, 'oldContent is required.');
        return;
      }
      sendJson(req, res, 200, await engine.patchFile(targetPath, oldContent, newContent));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/delete' && method === 'POST') {
      const body = await readBody(req);
      const targetPath = typeof body.path === 'string' ? body.path : '';
      if (!targetPath) {
        sendBadRequest(req, res, 'path is required.');
        return;
      }
      sendJson(req, res, 200, await engine.deleteFile(targetPath));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/git/status' && method === 'GET') {
      sendJson(req, res, 200, await engine.gitStatus());
      return;
    }

    if (requestUrl.pathname === '/api/workspace/git/diff' && method === 'GET') {
      sendJson(req, res, 200, await engine.gitDiff());
      return;
    }

    if (requestUrl.pathname === '/api/workspace/git/diff/structured' && method === 'GET') {
      sendJson(req, res, 200, await engine.getStructuredDiff());
      return;
    }

    if (requestUrl.pathname === '/api/workspace/project/commands' && method === 'GET') {
      sendJson(req, res, 200, await engine.detectProjectCommands());
      return;
    }

    if (requestUrl.pathname === '/api/workspace/symbol' && method === 'GET') {
      const name = getQueryValue(requestUrl, 'name');
      const kind = getQueryValue(requestUrl, 'kind');
      if (!name) {
        sendBadRequest(req, res, 'name query parameter is required.');
        return;
      }
      if (kind === 'function') {
        sendJson(req, res, 200, await engine.findFunction(name));
        return;
      }
      if (kind === 'component') {
        sendJson(req, res, 200, await engine.findComponent(name));
        return;
      }
      sendJson(req, res, 200, await engine.findSymbol(name));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/imports' && method === 'GET') {
      const targetPath = getQueryValue(requestUrl, 'path');
      const direction = getQueryValue(requestUrl, 'direction');
      if (!targetPath) {
        sendBadRequest(req, res, 'path query parameter is required.');
        return;
      }
      if (direction === 'reverse') {
        sendJson(req, res, 200, await engine.whoImports(targetPath));
        return;
      }
      if (direction === 'affected') {
        sendJson(req, res, 200, await engine.affectedFiles(targetPath));
        return;
      }
      sendJson(req, res, 200, await engine.whatDoesThisImport(targetPath));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/tests/select' && method === 'POST') {
      const body = await readBody(req);
      sendJson(req, res, 200, await engine.selectTestsForChangedFiles(body.changedFiles));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/checkpoint' && method === 'POST') {
      const body = await readBody(req);
      const label = typeof body.label === 'string' ? body.label : undefined;
      sendJson(req, res, 200, await engine.createCheckpoint(label));
      return;
    }

    if (requestUrl.pathname === '/api/workspace/checkpoint/rollback' && method === 'POST') {
      const body = await readBody(req);
      const checkpointId = typeof body.checkpointId === 'string' ? body.checkpointId : '';
      if (!checkpointId) {
        sendBadRequest(req, res, 'checkpointId is required.');
        return;
      }
      sendJson(req, res, 200, await engine.rollbackToCheckpoint(checkpointId));
      return;
    }

    sendJson(req, res, 404, { error: 'Not found' });
  } catch (error: any) {
    if (error?.message === 'Request body too large.') {
      sendJson(req, res, 413, { error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(req, res, 400, { error: 'Invalid JSON body.' });
      return;
    }
    sendJson(req, res, 500, { error: error?.message || 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Gamma 4 Harness API running at http://${HOST}:${PORT}`);
  console.log(`Open the web UI at http://localhost:8080`);
  console.log(`API health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`Workspace: ${WORKSPACE_ROOT}`);
  console.log(`Model: ${engine.getPublicConfig().model} | Mode: ${engine.getPublicConfig().mode}`);
});
server.setTimeout(3600000);
server.keepAliveTimeout = 3600000;
server.headersTimeout = 3605000;
