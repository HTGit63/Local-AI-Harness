#!/usr/bin/env node

import * as readline from 'readline';
import * as path from 'path';
import { CoreEngine } from '@local-harness/core';
import { runBenchmarks, runDiagnostics, summarizeTraceTelemetry } from '@local-harness/doctor';
import { loadCuratedSkills } from '@local-harness/skills';

const args = process.argv.slice(2);
const command = args[0] || 'chat';
const isJson = args.includes('--json');

const engine = new CoreEngine({
  workspaceRoot: process.cwd(),
  profile: 'fast',
});

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function printOutput(value: unknown) {
  if (isJson) {
    printJson(value);
    return;
  }

  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

function splitThinkingBlocks(content: string): { thinking: string[]; answer: string } {
  const thinking = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi))
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean);
  const answer = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { thinking, answer };
}

function renderAssistantOutput(content: string) {
  const { thinking, answer } = splitThinkingBlocks(content);

  if (thinking.length > 0) {
    console.log('\nThinking:');
    console.log(thinking.join('\n\n'));
  }

  console.log(`\n${answer || content}\n`);
}

function pushStepStatus(stepHistory: string[], nextStatus: string) {
  const step = nextStatus.trim();
  if (!step || stepHistory[stepHistory.length - 1] === step) {
    return;
  }

  stepHistory.push(step);
  console.log(`\n[step ${stepHistory.length}] ${step}`);
}

function renderToolProgress(event: { name: string; state: 'start' | 'done'; inputSummary: string; success?: boolean }) {
  if (event.state === 'start') {
    console.log(`\n[tool] ${event.name} · ${event.inputSummary}`);
    return;
  }

  console.log(`\n[tool ${event.success === false ? 'error' : 'done'}] ${event.name}`);
}

function renderRunSummary(summary: { summary?: string }) {
  if (!summary.summary) {
    return;
  }

  console.log(`\n[run] ${summary.summary}`);
}

function supportsThinking(capabilities: string[] | undefined): boolean {
  return Array.isArray(capabilities) && capabilities.includes('thinking');
}

function getArgValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return undefined;
  }

  const next = args[index + 1];
  return next.startsWith('--') ? undefined : next;
}

function hasArg(flag: string): boolean {
  return args.includes(flag);
}

function normalizeActionName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

interface SmokeRunStartedState {
  agentProtocol: string;
  workflow?: { workflowType?: string };
}

interface SmokeRunSummaryState {
  workflow?: { workflowType?: string; status?: string };
  summary?: string;
  git?: { changedFiles: number; addedLines: number; removedLines: number };
}

function formatAgentSmokeRuntimeError(error: unknown, details: {
  task: string;
  protocol: string;
  model: string;
  agentModel: string;
  summaryModel: string;
}): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lines = [
    'Smoke run failed before completion.',
    `Task: ${details.task}`,
    `Protocol: ${details.protocol}`,
    `Model: ${details.model}`,
    `Agent model: ${details.agentModel}`,
    `Summary model: ${details.summaryModel}`,
    `Error: ${message}`,
  ];

  if (/requires more system memory|out of memory|not enough memory/i.test(message)) {
    lines.push('Likely cause: agent model cannot fit in available RAM right now.');
    lines.push('Try closing other apps, unloading other Ollama models, or set HARNESS_AGENT_MODEL=gemma4:e4b for smoke-only verification.');
  } else if (/not installed/i.test(message)) {
    lines.push('Likely cause: configured agent model is not installed in Ollama.');
  } else if (/lifecycle control is unavailable/i.test(message)) {
    lines.push('Likely cause: current provider cannot list/load/unload Ollama models.');
  }

  return new Error(lines.join('\n'));
}

function createSmokeEngine(
  agentProtocol: 'native_tools' | 'action_dsl' | 'workflow_runner',
  options: { shortcutAnswersEnabled?: boolean } = {},
) {
  const baseUrl = process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1';
  return new CoreEngine({
    workspaceRoot: process.cwd(),
    profile: 'fast',
    baseUrl,
    model: process.env.HARNESS_MODEL || process.env.OPENAI_MODEL || 'gemma4:e4b',
    agentModel: process.env.HARNESS_AGENT_MODEL || process.env.OPENAI_MODEL || 'VladimirGav/gemma4-26b-16GB-VRAM:latest',
    summaryModel: process.env.HARNESS_SUMMARY_MODEL || process.env.HARNESS_MODEL || process.env.OPENAI_MODEL || 'gemma4:e4b',
    agentProtocol,
    agentKeepAlive: process.env.HARNESS_AGENT_KEEP_ALIVE || '90s',
    shortcutAnswersEnabled: options.shortcutAnswersEnabled ?? true,
  });
}

async function listSkills() {
  try {
    return await loadCuratedSkills();
  } catch {
    return [];
  }
}

async function handlePrompt() {
  const promptIndex = args.indexOf('prompt');
  const promptText = args.slice(promptIndex + 1).filter((arg) => !arg.startsWith('--')).join(' ');
  if (!promptText) {
    throw new Error('Usage: gamma prompt [--thinking|--nothinking] <text>');
  }

  const thinkingEnabled = args.includes('--nothinking') ? false : args.includes('--thinking') ? true : undefined;
  const runtime = thinkingEnabled === true ? await engine.getModelRuntime() : null;
  const thinkingWarning = thinkingEnabled === true && !supportsThinking(runtime?.configuredModelCapabilities)
    ? 'Thinking unavailable on current model; toggle may be ignored.'
    : null;

  if (isJson) {
    const response = await engine.directChat([
      { role: 'user', content: promptText },
    ], thinkingEnabled === undefined ? undefined : { think: thinkingEnabled });
    printOutput({ input: promptText, output: response, ...(thinkingWarning ? { warning: thinkingWarning } : {}) });
    return;
  }

  const stepHistory: string[] = [];
  const response = await engine.directChatStream([
    { role: 'user', content: promptText },
  ], {
    onStatus: (event) => pushStepStatus(stepHistory, event.action || event.phase),
    onTool: (event) => renderToolProgress(event),
    onRunSummary: (event) => renderRunSummary(event.summary),
  }, thinkingEnabled === undefined ? undefined : { think: thinkingEnabled });

  renderAssistantOutput(response);
}

async function handleChat() {
  const promptText = getArgValue('-p') || getArgValue('--prompt');
  const thinkingEnabled = args.includes('--nothinking') ? false : args.includes('--thinking') ? true : undefined;
  if (!promptText) {
    if (isJson) {
      throw new Error('JSON mode requires gamma chat -p "<text>".');
    }
    startChatRepl();
    return;
  }

  if (isJson) {
    const output = await engine.directChat([
      { role: 'user', content: promptText },
    ], thinkingEnabled === undefined ? undefined : { think: thinkingEnabled });
    printOutput({ mode: 'chat', input: promptText, output });
    return;
  }

  const output = await engine.directChatStream([
    { role: 'user', content: promptText },
  ], {
    onStatus: (event) => console.log(`\n[chat] ${event.action || event.phase}`),
  }, thinkingEnabled === undefined ? undefined : { think: thinkingEnabled });
  renderAssistantOutput(output);
}

async function handleSession() {
  switch (args[1]) {
    case 'list': {
      const sessions = await engine.listSessions();
      printOutput(isJson ? { sessions } : sessions.map((session: { id: string; model: string; mode: string; skillsActive: string[]; updatedAt: number; turnHistory?: Array<{ executionMode: string }> }) => ({
        id: session.id,
        model: session.model,
        mode: session.mode,
        skills: session.skillsActive,
        turns: session.turnHistory?.length || 0,
        lastTurnMode: session.turnHistory?.length ? session.turnHistory[session.turnHistory.length - 1].executionMode : 'none',
        updatedAt: new Date(session.updatedAt).toLocaleString(),
      })));
      return;
    }
    case 'resume': {
      const id = args[2];
      if (!id) {
        throw new Error('Usage: gamma session resume <id>');
      }

      const session = await engine.resumeSession(id);
      if (!session) {
        throw new Error(`Session ${id} not found.`);
      }

      printOutput(session);
      return;
    }
    case 'delete': {
      const id = args[2];
      if (!id) {
        throw new Error('Usage: gamma session delete <id>');
      }

      const deleted = await engine.deleteSession(id);
      printOutput({ deleted });
      return;
    }
    default:
      throw new Error('Usage: gamma session <list|resume|delete>');
  }
}

async function handleWorkspace() {
  switch (args[1]) {
    case 'status':
      printOutput(engine.getPublicConfig());
      return;
    case 'use': {
      const nextWorkspace = args.slice(2).join(' ').trim();
      if (!nextWorkspace) {
        throw new Error('Usage: gamma workspace use <path>');
      }
      await engine.updateConfig({ workspaceRoot: path.resolve(nextWorkspace) });
      printOutput(engine.getPublicConfig());
      return;
    }
    case 'list':
      printOutput(await engine.listDir(args[2] || '.'));
      return;
    case 'read':
      if (!args[2]) {
        throw new Error('Usage: gamma workspace read <path>');
      }
      printOutput(await engine.readFile(args[2]));
      return;
    case 'search':
      if (!args[2]) {
        throw new Error('Usage: gamma workspace search <query> [glob]');
      }
      printOutput(await engine.searchText(args[2], args[3]));
      return;
    case 'git-status':
      printOutput(await engine.gitStatus());
      return;
    case 'git-diff':
      printOutput(await engine.gitDiff());
      return;
    default:
      throw new Error('Usage: gamma workspace <status|use|list|read|search|git-status|git-diff>');
  }
}

async function handleSkills() {
  const skills = await listSkills();
  switch (args[1]) {
    case 'list':
      printOutput(isJson ? { skills } : skills);
      return;
    case 'activate': {
      const skillSlug = args[2];
      if (!skillSlug) {
        throw new Error('Usage: gamma skills activate <slug>');
      }

      const session = await engine.updateSessionSkills([skillSlug]);
      printOutput({
        activated: skillSlug,
        sessionId: session.id,
        skills: session.skillsActive,
      });
      return;
    }
    default:
      throw new Error('Usage: gamma skills <list|activate>');
  }
}

async function handleModel() {
  switch (args[1]) {
    case 'list': {
      const models = await engine.listModels();
      const runtime = await engine.getModelRuntime();
      printOutput(isJson ? { models, runtime } : {
        configuredModel: runtime.configuredModel,
        activeModel: runtime.activeModel,
        runningModels: runtime.runningModels.map((entry: { model: string }) => entry.model),
        models,
      });
      return;
    }
    case 'status': {
      printOutput(await engine.getModelRuntime());
      return;
    }
    case 'use': {
      const nextModel = args[2];
      if (!nextModel) {
        throw new Error('Usage: gamma model use <name>');
      }

      await engine.updateConfig({ model: nextModel }, { activateModel: true });
      const runtime = await engine.getModelRuntime();
      printOutput({
        configuredModel: runtime.configuredModel,
        activeModel: runtime.activeModel,
        runningModels: runtime.runningModels.map((entry: { model: string }) => entry.model),
        message: runtime.lastSwitchResult?.message || `Configured ${runtime.configuredModel}.`,
      });
      return;
    }
    default:
      throw new Error('Usage: gamma model <list|status|use>');
  }
}

async function handleConfig() {
  if (args[1] !== 'show') {
    throw new Error('Usage: gamma config show');
  }

  printOutput(engine.getPublicConfig());
}

function formatAgentStatus(summary: {
  statePath: string;
  taskIdentity: string;
  objective: string;
  taskType?: string;
  status: string;
  phase: string;
  step: string;
  nextAction: string;
  allowedTools?: string[];
  missingProof?: string[];
  evidenceCount: number;
  blockerCount: number;
  commandCount?: number;
  checkpointCount?: number;
  verificationCount?: number;
  latestCheckpoint?: string;
  latestVerification?: string;
  doneReady?: boolean;
  filesRead: number;
  filesChanged: number;
}): string {
  const missingProof = summary.missingProof?.length ? summary.missingProof.join('; ') : 'none';
  const latestCheckpoint = summary.latestCheckpoint || 'none';
  const latestVerification = summary.latestVerification || 'none';
  return [
    `Task: ${summary.taskIdentity}`,
    `Status: ${summary.status}${summary.doneReady ? ' (proof ready)' : ''}`,
    `Phase: ${summary.phase}`,
    `Step: ${summary.step}`,
    `Objective: ${summary.objective}`,
    summary.taskType ? `Type: ${summary.taskType}` : null,
    `Files: read ${summary.filesRead}, changed ${summary.filesChanged}`,
    `Evidence: ${summary.evidenceCount}`,
    `Checkpoints: ${summary.checkpointCount ?? 0} (${latestCheckpoint})`,
    `Verification: ${summary.verificationCount ?? 0} (${latestVerification})`,
    `Commands: ${summary.commandCount ?? 0}`,
    `Blockers: ${summary.blockerCount}`,
    summary.allowedTools ? `Tools: ${summary.allowedTools.join(', ')}` : null,
    `Missing proof: ${missingProof}`,
    `State: ${summary.statePath}`,
    `Next: ${summary.nextAction}`,
  ].filter((line): line is string => Boolean(line)).join('\n');
}

async function handleAgent() {
  const subcommand = args[1] || 'status';
  switch (subcommand) {
    case 'task': {
      const taskText = args.slice(2).filter((arg) => !arg.startsWith('--')).join(' ').trim();
      if (!taskText) {
        throw new Error('Usage: gamma agent task "<objective>"');
      }
      const result = await engine.startAgentTask(taskText);
      printOutput(isJson ? result.summary : formatAgentStatus(result.summary));
      return;
    }
    case 'status': {
      const summary = await engine.getAgentStatus();
      if (!summary) {
        const missing = {
          status: 'IDLE',
          statePath: engine.getAgentStatePath(),
          nextAction: 'Run gamma agent task "..."',
        };
        printOutput(isJson ? missing : [
          'Task: none',
          'Status: IDLE',
          `State: ${missing.statePath}`,
          `Next: ${missing.nextAction}`,
        ].join('\n'));
        return;
      }
      printOutput(isJson ? summary : formatAgentStatus(summary));
      return;
    }
    case 'state': {
      const markdown = await engine.readAgentStateMarkdown();
      if (!markdown) {
        throw new Error('Agent state file is missing. Run gamma agent task "..." first.');
      }
      printOutput(isJson ? { statePath: engine.getAgentStatePath(), markdown } : markdown);
      return;
    }
    case 'step': {
      const result = await engine.runAgentStep();
      printOutput(isJson ? result : [
        `Executed: ${result.executedPhase}`,
        `Completed: ${result.completedStep}`,
        `Status: ${result.status}`,
        `Next phase: ${result.nextPhase}`,
        `Evidence: ${result.evidence}`,
        `Next: ${result.nextAction}`,
      ].join('\n'));
      return;
    }
    case 'tools': {
      const checks = args.slice(2).filter((arg) => !arg.startsWith('--'));
      const result = await engine.getAgentToolPolicy(checks as any);
      printOutput(result);
      return;
    }
    case 'checkpoint': {
      const label = args.slice(2).filter((arg) => !arg.startsWith('--')).join(' ').trim() || undefined;
      const summary = await engine.createAgentCheckpoint(label);
      printOutput(isJson ? summary : formatAgentStatus(summary));
      return;
    }
    case 'patch': {
      const filePath = getArgValue('--file') || args[2];
      const oldContent = getArgValue('--old');
      const newContent = getArgValue('--new');
      if (!filePath || oldContent === undefined || newContent === undefined) {
        throw new Error('Usage: gamma agent patch --file <path> --old <text> --new <text>');
      }
      const result = await engine.runAgentPatch({ filePath, oldContent, newContent });
      printOutput(isJson ? result : [
        `Patched: ${result.filePath}`,
        `Checkpoint: ${result.checkpointId}`,
        `Status: ${result.status}`,
        `Phase: ${result.phase}`,
        `Diff: ${result.diffSummary}`,
        `Next: ${result.summary.nextAction}`,
      ].join('\n'));
      return;
    }
    case 'verify': {
      const taskType = getArgValue('--type')?.replace(/-/g, '_') as any;
      const commandText = getArgValue('--command');
      const result = await engine.runAgentVerification({ taskType, command: commandText });
      printOutput(isJson ? result : [
        `Type: ${result.taskType}`,
        result.command ? `Command: ${result.command}` : null,
        result.commandSuccess !== undefined ? `Command success: ${result.commandSuccess}` : null,
        `Status: ${result.summary.status}`,
        result.gate.missingProof.length ? `Missing proof: ${result.gate.missingProof.join('; ')}` : 'Missing proof: none',
        `Next: ${result.summary.nextAction}`,
      ].filter((line): line is string => Boolean(line)).join('\n'));
      return;
    }
    case 'rollback': {
      const checkpointId = args[2];
      if (!checkpointId) {
        throw new Error('Usage: gamma agent rollback <checkpointId>');
      }
      const result = await engine.rollbackAgentCheckpoint(checkpointId);
      printOutput(isJson ? result : [
        `Rolled back: ${result.checkpointId}`,
        `Affected files: ${result.affectedFiles.length}`,
        `Status: ${result.summary.status}`,
        `Next: ${result.summary.nextAction}`,
      ].join('\n'));
      return;
    }
    case 'compact': {
      const summary = await engine.compactAgentState();
      printOutput(isJson ? summary : formatAgentStatus(summary));
      return;
    }
    case 'diff': {
      printOutput(await engine.gitDiff());
      return;
    }
    default:
      throw new Error('Usage: gamma agent <task|status|state|step|tools|checkpoint|patch|verify|rollback|compact|diff>');
  }
}

async function handleAgentSmoke() {
  const task = getArgValue('--task');
  if (!task) {
    throw new Error('Usage: gamma agent-smoke --task "<prompt>" [--require-action <name>] [--require-approval] [--require-diff] [--workflow <name>]');
  }

  const requireAction = getArgValue('--require-action');
  const requireWorkflow = getArgValue('--workflow');
  const requireApproval = hasArg('--require-approval');
  const requireDiff = hasArg('--require-diff');
  const agentProtocol: 'native_tools' | 'action_dsl' | 'workflow_runner' = requireWorkflow
    ? 'workflow_runner'
    : (process.env.HARNESS_AGENT_PROTOCOL as 'native_tools' | 'action_dsl' | 'workflow_runner' | undefined) || 'action_dsl';
  const smokeEngine = createSmokeEngine(agentProtocol, {
    shortcutAnswersEnabled: !requireAction,
  });
  const startedAt = Date.now();
  const toolEvents: Array<{ id: string; name: string; state: 'start' | 'done'; inputSummary: string; output?: string; success?: boolean }> = [];
  const approvalEvents: Array<{ id: string; target: string; preview: string }> = [];
  const approvalIds = new Set<string>();
  let firstApprovalPreview = '';
  let firstTokenMs = 0;
  let sawToken = false;
  let responseText = '';
  let runStarted: SmokeRunStartedState | null = null;
  let runSummary: SmokeRunSummaryState | null = null;

  smokeEngine.on('approval_requested', (event: { id: string; target: string; preview: string }) => {
    if (!approvalIds.has(event.id)) {
      approvalIds.add(event.id);
      approvalEvents.push(event);
    }
    if (!firstApprovalPreview && event.preview) {
      firstApprovalPreview = event.preview;
    }
    smokeEngine.resolveApproval(event.id, true);
  });

  try {
    await smokeEngine.chatStream([
      { role: 'user', content: task },
    ], {
      onDelta: (delta: string) => {
        if (!sawToken) {
          sawToken = true;
          firstTokenMs = Date.now() - startedAt;
        }
        responseText += delta;
      },
      onTool: (event) => {
        toolEvents.push(event);
      },
      onApproval: (event) => {
        const id = event.approval.id;
        if (!approvalIds.has(id)) {
          approvalIds.add(id);
          approvalEvents.push({
            id,
            target: event.approval.target || '',
            preview: event.approval.diffPreview || '',
          });
        }
        if (event.approval.diffPreview?.trim()) {
          firstApprovalPreview = event.approval.diffPreview;
        }
      },
      onRunStarted: (event) => {
        runStarted = {
          agentProtocol: event.agentProtocol,
          workflow: event.workflow ? { workflowType: event.workflow.workflowType } : undefined,
        };
      },
      onRunSummary: (event) => {
        runSummary = {
          workflow: event.summary.workflow ? {
            workflowType: event.summary.workflow.workflowType,
            status: event.summary.workflow.status,
          } : undefined,
          summary: event.summary.summary,
          git: event.summary.git,
        };
      },
    }, { think: false });
  } catch (error) {
    throw formatAgentSmokeRuntimeError(error, {
      task,
      protocol: agentProtocol,
      model: smokeEngine.getPublicConfig().model,
      agentModel: smokeEngine.getPublicConfig().agentModel,
      summaryModel: smokeEngine.getPublicConfig().summaryModel,
    });
  }

  if (!sawToken) {
    firstTokenMs = Date.now() - startedAt;
  }

  const session = smokeEngine.getSession();
  const latestRun = session?.turnHistory?.[session.turnHistory.length - 1]?.runSummary;
  const traceTelemetry = summarizeTraceTelemetry(smokeEngine.getTraceLog());
  const normalizedExpectedAction = requireAction ? normalizeActionName(requireAction) : '';
  const observedActionNames = new Set([
    ...toolEvents.map((event) => normalizeActionName(event.name)),
    ...(latestRun?.steps || []).map((step) => normalizeActionName(step.toolName || step.title || '')),
  ].filter((entry) => entry.length > 0));
  const startedSnapshot = runStarted as SmokeRunStartedState | null;
  const summarySnapshot = runSummary as SmokeRunSummaryState | null;
  const actualWorkflow = latestRun?.workflow?.workflowType
    || startedSnapshot?.workflow?.workflowType
    || summarySnapshot?.workflow?.workflowType;
  const actualWorkflowStatus = latestRun?.workflow?.status
    || summarySnapshot?.workflow?.status;
  const failures: string[] = [];

  if (requireAction && !observedActionNames.has(normalizedExpectedAction)) {
    failures.push(`Expected action ${requireAction}, saw ${Array.from(observedActionNames).join(', ') || 'none'}.`);
  }
  if (requireApproval && approvalEvents.length === 0) {
    failures.push('Expected approval, but none was requested.');
  }
  if (requireDiff && !firstApprovalPreview.trim()) {
    failures.push('Expected diff preview, but approval preview was empty.');
  }
  if (requireWorkflow && actualWorkflow !== requireWorkflow) {
    failures.push(`Expected workflow ${requireWorkflow}, got ${actualWorkflow || 'none'}.`);
  }
  if (!latestRun) {
    failures.push('No run summary was recorded.');
  }

  const result = {
    ok: failures.length === 0,
    task,
    protocol: agentProtocol,
    model: smokeEngine.getPublicConfig().model,
    agentModel: smokeEngine.getPublicConfig().agentModel,
    summaryModel: smokeEngine.getPublicConfig().summaryModel,
    firstTokenMs,
    totalMs: Date.now() - startedAt,
    toolCount: toolEvents.length,
    approvals: approvalEvents.length,
    diffPreview: firstApprovalPreview || null,
    responsePreview: responseText.slice(0, 240),
    workflow: actualWorkflow || null,
    workflowStatus: actualWorkflowStatus || null,
    summary: latestRun?.summary || summarySnapshot?.summary || null,
    parseFailureCount: traceTelemetry.parseFailureCount,
    routingNotes: traceTelemetry.routingNotes,
    memoryNotes: traceTelemetry.memoryNotes,
    observedActions: Array.from(observedActionNames),
  };

  if (failures.length > 0) {
    throw new Error([
      'Smoke test failed.',
      ...failures,
      `Observed actions: ${result.observedActions.join(', ') || 'none'}`,
      `Approvals: ${result.approvals}`,
      `Diff preview: ${result.diffPreview ? 'present' : 'missing'}`,
      `Workflow: ${result.workflow || 'none'}${result.workflowStatus ? ` (${result.workflowStatus})` : ''}`,
      `Parse failures: ${result.parseFailureCount}`,
      ...(result.routingNotes.length > 0 ? [`Routing notes: ${result.routingNotes.join(' | ')}`] : []),
      ...(result.memoryNotes.length > 0 ? [`Memory notes: ${result.memoryNotes.join(' | ')}`] : []),
    ].join('\n'));
  }

  printOutput(result);
}

function startChatRepl() {
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  const session = engine.startSession();
  let thinkingEnabled = false;
  const initialConfig = engine.getPublicConfig();

  console.log('Gamma Harness Chat CLI');
  console.log(
    `Session: ${session.id}  Model: ${session.model}  Mode: chat  Execution: direct  Thinking: ${thinkingEnabled ? 'on' : 'off'}  Memory: ${initialConfig.sessionMemoryEnabled ? `${initialConfig.sessionMemoryTurns} turns` : 'off'}`,
  );
  console.log("Commands: /help /exit /status /thinking /nothinking /model /model list /model use <name> /workspace /workspace use <path> /read <path> /search <query> [glob] /sessions /skills /activate <slug>");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'gamma> ',
  });

  engine.on('approval_requested', (event: { id: string; action: string; target: string; preview: string }) => {
    console.log(`\nApproval required for ${event.action} -> ${event.target}`);
    console.log(event.preview);
    rl.prompt();
  });

  rl.prompt();
  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    try {
      if (input === '/exit' || input === '/quit' || input === '/bye') {
        rl.close();
        return;
      }

      if (input === '/clear') {
        history.length = 0;
        console.clear();
        rl.prompt();
        return;
      }

      if (input === '/help') {
        console.log('Slash commands: /exit /quit /bye /clear /help /status /thinking /nothinking /model /model list /model use <name> /workspace /workspace use <path> /read <path> /search <query> [glob] /sessions /skills /activate <slug>');
        rl.prompt();
        return;
      }

      if (input === '/thinking') {
        thinkingEnabled = true;
        {
          const runtime = await engine.getModelRuntime();
          if (!supportsThinking(runtime.configuredModelCapabilities)) {
            console.log('Warning: current model does not report thinking support. Toggle may be ignored.');
          }
        }
        console.log('Thinking enabled');
        rl.prompt();
        return;
      }

      if (input === '/nothinking') {
        thinkingEnabled = false;
        console.log('Thinking disabled');
        rl.prompt();
        return;
      }

      if (input === '/status') {
        console.log(JSON.stringify({
          session: engine.getSession(),
          config: engine.getPublicConfig(),
          executionMode: 'direct',
          thinkingEnabled,
        }, null, 2));
        rl.prompt();
        return;
      }

      if (input === '/model') {
        console.log(JSON.stringify(await engine.getModelRuntime(), null, 2));
        rl.prompt();
        return;
      }

      if (input === '/model list') {
        console.log(JSON.stringify(await engine.listModels(), null, 2));
        rl.prompt();
        return;
      }

      if (input === '/workspace') {
        console.log(JSON.stringify({
          workspaceRoot: engine.getPublicConfig().workspaceRoot,
          mode: engine.getPublicConfig().mode,
        }, null, 2));
        rl.prompt();
        return;
      }

      if (input.startsWith('/model use ')) {
        const nextModel = input.substring(11).trim();
        if (!nextModel) {
          console.log('Usage: /model use <name>');
          rl.prompt();
          return;
        }

        await engine.updateConfig({ model: nextModel }, { activateModel: true });
        console.log(JSON.stringify(await engine.getModelRuntime(), null, 2));
        rl.prompt();
        return;
      }

      if (input.startsWith('/workspace use ')) {
        const nextWorkspace = input.substring('/workspace use '.length).trim();
        if (!nextWorkspace) {
          console.log('Usage: /workspace use <path>');
          rl.prompt();
          return;
        }

        await engine.updateConfig({ workspaceRoot: path.resolve(nextWorkspace) });
        history.length = 0;
        console.log(JSON.stringify(engine.getPublicConfig(), null, 2));
        rl.prompt();
        return;
      }

      if (input.startsWith('/read ')) {
        const filePath = input.substring('/read '.length).trim();
        const result = await engine.readFile(filePath);
        console.log(result.output);
        rl.prompt();
        return;
      }

      if (input.startsWith('/search ')) {
        const parts = input.substring('/search '.length).trim().split(/\s+/);
        const query = parts.shift();
        const filePattern = parts.join(' ') || undefined;
        if (!query) {
          console.log('Usage: /search <query> [glob]');
          rl.prompt();
          return;
        }
        const result = await engine.searchText(query, filePattern);
        console.log(result.output);
        rl.prompt();
        return;
      }

      if (input === '/sessions') {
        console.log(JSON.stringify(await engine.listSessions(), null, 2));
        rl.prompt();
        return;
      }

      if (input === '/skills') {
        console.log(JSON.stringify(await listSkills(), null, 2));
        rl.prompt();
        return;
      }

      if (input.startsWith('/activate ')) {
        const skillSlug = input.split(' ').slice(1).join(' ').trim();
        const updatedSession = await engine.updateSessionSkills([skillSlug]);
        console.log(`Active skills: ${updatedSession.skillsActive.join(', ')}`);
        rl.prompt();
        return;
      }

      history.push({ role: 'user', content: input });
      const stepHistory: string[] = [];
      const response = await engine.directChatStream([
        { role: 'system', content: 'You are in Chat Mode. Read, explain, and plan only. Do not write files or run commands.' },
        ...history,
      ], {
        onStatus: (event: { action: string; phase: string }) => {
          pushStepStatus(stepHistory, event.action || event.phase);
        },
        onTool: (event: { name: string; state: 'start' | 'done'; inputSummary: string; success?: boolean }) => {
          renderToolProgress(event);
        },
        onRunSummary: (event: { summary: { summary?: string } }) => {
          renderRunSummary(event.summary);
        },
      }, {
        think: thinkingEnabled,
      });
      history.push({ role: 'assistant', content: response });
      renderAssistantOutput(response);
    } catch (error: any) {
      console.error(error?.message || error);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

async function main() {
  switch (command) {
    case 'doctor':
      printOutput(await runDiagnostics({ repoRoot: process.cwd(), quiet: isJson }));
      return;
    case 'benchmark':
      printOutput(await runBenchmarks({ quiet: isJson }));
      return;
    case 'agent-smoke':
      await handleAgentSmoke();
      return;
    case 'prompt':
      await handlePrompt();
      return;
    case 'chat':
      if (isJson) {
        await handleChat();
        return;
      }
      await handleChat();
      return;
    case 'agent':
      await handleAgent();
      return;
    case 'session':
      await handleSession();
      return;
    case 'workspace':
      await handleWorkspace();
      return;
    case 'skills':
      await handleSkills();
      return;
    case 'model':
      await handleModel();
      return;
    case 'config':
      await handleConfig();
      return;
    default:
      throw new Error('Available commands: doctor | benchmark | agent-smoke | prompt | chat | agent | session | workspace | skills | model | config');
  }
}

main().catch((error: any) => {
  console.error(error?.message || error);
  process.exit(1);
});
