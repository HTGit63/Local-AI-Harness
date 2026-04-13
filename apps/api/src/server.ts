import * as http from 'http';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CoreEngine, PromptAnalyzer } from '@local-harness/core';
import { ModelAdapter } from '@local-harness/model-adapter';

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const HOST = process.env.API_HOST || '127.0.0.1';
const WORKSPACE_ROOT = process.env.HARNESS_WORKSPACE_ROOT || process.cwd();
const SKILLS_PATH = path.resolve(WORKSPACE_ROOT, 'packages/skills/dist/curated_pack.json');
const MAX_BODY_BYTES = 512 * 1024;
const WORKSPACE_RESOLVE_MAX_DEPTH = 3;
const WORKSPACE_RESOLVE_MAX_VISITS = 2000;
const WORKSPACE_RESOLVE_MAX_CANDIDATES = 64;
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

function writeNdjson(res: http.ServerResponse, event: Record<string, unknown>) {
  if (!res.writableEnded) {
    res.write(`${JSON.stringify(event)}\n`);
  }
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
  visited: { count: number },
  candidates: Set<string>,
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
    candidates.add(rootPath);
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
      candidates.add(nextPath);
      continue;
    }

    await collectWorkspaceCandidates(nextPath, folderLabel, depthRemaining - 1, visited, candidates);
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
  const candidates = new Set<string>();
  const visited = { count: 0 };

  for (const rootPath of buildWorkspaceResolveRoots(currentWorkspaceRoot)) {
    await collectWorkspaceCandidates(rootPath, normalizedLabel, WORKSPACE_RESOLVE_MAX_DEPTH, visited, candidates);
  }

  if (candidates.size === 0) {
    return null;
  }

  const scoredCandidates = await Promise.all(
    [...candidates].map(async (candidatePath) => ({
      candidatePath,
      matchedFiles: await scoreWorkspaceCandidate(candidatePath, verificationFiles),
    })),
  );

  scoredCandidates.sort((left, right) =>
    right.matchedFiles - left.matchedFiles ||
    left.candidatePath.length - right.candidatePath.length,
  );

  const bestCandidate = scoredCandidates[0];
  if (!bestCandidate) {
    return null;
  }

  if (verificationFiles.length > 0 && bestCandidate.matchedFiles === 0) {
    return null;
  }

  const equallyGoodCandidates = scoredCandidates.filter((entry) => entry.matchedFiles === bestCandidate.matchedFiles);
  if (equallyGoodCandidates.length > 1) {
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
      await engine.updateConfig(body as any, {
        activateModel: body.activateModel === true,
      });
      sendJson(req, res, 200, engine.getPublicConfig());
      return;
    }

    if (requestUrl.pathname === '/api/trace' && method === 'GET') {
      sendJson(req, res, 200, engine.getTraceLog());
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
      sendJson(req, res, 200, await engine.getModelRuntime());
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
        
        if (!isAgentic) {
          const adapter = new ModelAdapter(engine.getPublicConfig() as any);
          const response = await adapter.createChatCompletion({
            messages: messages as any,
            stream: false,
            signal: abortController.signal,
          }) as any;
          
          let content = response?.choices?.[0]?.message?.content || '';
          const thinking = response?.choices?.[0]?.message?.thinking;
          if (thinking) content = `<think>${thinking}</think>${content}`;
          sendJson(req, res, 200, { response: content });
          return;
        }

        // --- Prompt Analyzer Hook ---
        const analyzerAdapter = new ModelAdapter(engine.getPublicConfig() as any);
        const analyzer = new PromptAnalyzer(analyzerAdapter);
        const analysis = await analyzer.analyzeAndRefine(messages as any, abortController.signal);
        
        if (analysis.needsClarification && analysis.clarifyingQuestions && analysis.clarifyingQuestions.length > 0) {
          const questionsContent = "I noticed this is a very broad request. To proceed effectively, I need a bit more detail. Could you clarify the following before I get to work?\n\n- " + analysis.clarifyingQuestions.join('\n- ');
          sendJson(req, res, 200, { response: questionsContent });
          return;
        } else if (analysis.refinedPrompt && messages.length > 0) {
          const lastIndex = messages.map(m => (m as any).role).lastIndexOf('user');
          if (lastIndex >= 0) {
            messages[lastIndex] = { ...messages[lastIndex], content: analysis.refinedPrompt };
          }
        }
        // --- End Prompt Analyzer Hook ---

        const response = await engine.chat(messages as { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[], { signal: abortController.signal });
        sendJson(req, res, 200, { response });
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
        
        startNdjson(req, res);

        if (!isAgentic) {
          writeNdjson(res, { type: 'status', phase: 'Generating', action: 'Normal Chat Mode', loop: 0 });
          
          const adapter = new ModelAdapter(engine.getPublicConfig() as any);
          const stream = await adapter.createChatCompletion({
            messages: messages as any,
            stream: true,
            signal: abortController.signal,
          }) as ReadableStream<Uint8Array> | null;

          if (!stream || typeof stream.getReader !== 'function') {
            const result = await adapter.createChatCompletion({
              messages: messages as any,
              stream: false,
              signal: abortController.signal,
            }) as any;
            
            let content = result?.choices?.[0]?.message?.content || '';
            const thinking = result?.choices?.[0]?.message?.thinking;
            if (thinking) content = `<think>${thinking}</think>${content}`;
            
            writeNdjson(res, { type: 'done', response: content });
            res.end();
            return;
          }

          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split(/\r?\n/);
            
            for (const line of lines) {
               if (line.startsWith('data: ')) {
                 if (line === 'data: [DONE]') continue;
                 try {
                   const data = JSON.parse(line.slice(6));
                   const deltaObj = data.choices?.[0]?.delta || {};
                   let deltaStr = '';
                   if (deltaObj.thinking) deltaStr += `<think>${deltaObj.thinking}</think>`;
                   if (deltaObj.content) deltaStr += deltaObj.content;
                   
                   if (deltaStr) {
                     fullContent += deltaStr;
                     writeNdjson(res, { type: 'delta', delta: deltaStr });
                   }
                 } catch (e) { /* ignore parse error */ }
               }
            }
          }
          
          const finalChunk = decoder.decode();
          const finalLines = finalChunk.split(/\r?\n/);
          for (const line of finalLines) {
             if (line.startsWith('data: ')) {
               if (line === 'data: [DONE]') continue;
               try {
                 const data = JSON.parse(line.slice(6));
                 const deltaObj = data.choices?.[0]?.delta || {};
                 let deltaStr = '';
                 if (deltaObj.thinking) deltaStr += `<think>${deltaObj.thinking}</think>`;
                 if (deltaObj.content) deltaStr += deltaObj.content;
                 
                 if (deltaStr) {
                   fullContent += deltaStr;
                   writeNdjson(res, { type: 'delta', delta: deltaStr });
                 }
               } catch (e) { /* ignore parse error */ }
             }
          }

          writeNdjson(res, { type: 'done', response: fullContent });
          res.end();
          return;
        }
        
        // --- Prompt Analyzer Hook ---
        const analyzerAdapter = new ModelAdapter(engine.getPublicConfig() as any);
        const analyzer = new PromptAnalyzer(analyzerAdapter);
        
        writeNdjson(res, { type: 'status', phase: 'Analyzing Prompt', action: 'Evaluating clarity', loop: 0 });
        const analysis = await analyzer.analyzeAndRefine(messages as any, abortController.signal);
        
        if (analysis.needsClarification && analysis.clarifyingQuestions && analysis.clarifyingQuestions.length > 0) {
          const questionsContent = "I noticed this is a very broad request. To proceed effectively, I need a bit more detail. Could you clarify the following before I get to work?\n\n- " + analysis.clarifyingQuestions.join('\n- ');
          writeNdjson(res, { type: 'status', phase: 'Awaiting Clarification', action: 'Yielded to user', loop: 0 });
          writeNdjson(res, { type: 'delta', delta: questionsContent });
          writeNdjson(res, { type: 'done', response: questionsContent });
          res.end();
          return;
        } else if (analysis.refinedPrompt && messages.length > 0) {
          const lastIndex = messages.map(m => (m as any).role).lastIndexOf('user');
          if (lastIndex >= 0) {
            messages[lastIndex] = { ...messages[lastIndex], content: analysis.refinedPrompt };
          }
        }
        // --- End Prompt Analyzer Hook ---

        const response = await engine.chatStream(
          messages as { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[],
          {
            onStatus: (event: { phase: string; action: string; loop: number }) => writeNdjson(res, { type: 'status', ...event }),
            onDelta: (delta: string) => writeNdjson(res, { type: 'delta', delta }),
          },
          { signal: abortController.signal },
        );
        writeNdjson(res, { type: 'done', response });
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
