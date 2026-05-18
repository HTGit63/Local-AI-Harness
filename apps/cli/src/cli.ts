#!/usr/bin/env node

import * as readline from 'readline';
import * as path from 'path';
import { CoreEngine } from '@local-harness/core';
import { runBenchmarks, runDiagnostics } from '@local-harness/doctor';
import { loadCuratedSkills } from '@local-harness/skills';

const args = process.argv.slice(2);
const command = args[0] || 'chat';
const isJson = args.includes('--json');
const showThinkingOutput = args.includes('--show-thinking');

const engine = new CoreEngine({
  workspaceRoot: process.cwd(),
  profile: 'balanced',
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

function printHelp() {
  printOutput([
    'Gamma Harness CLI',
    '',
    'Commands:',
    '  harness chat [--show-thinking]',
    '  harness agent [--advanced-tools] [--show-thinking]',
    '  harness inspect [--json]',
    '  harness prompt [--agent] [--advanced-tools] <text>',
    '  harness status [--json]',
    '  harness config [show] [--json]',
    '  harness model <status|list|use>',
    '  harness workspace <status|use|list|read|search|git-status|git-diff>',
    '  harness session <list|resume|delete>',
    '  harness doctor [--json]',
    '',
    'Default: Chat Mode. Agent Work only via `agent` or `prompt --agent`.',
  ].join('\n'));
}

function splitThinkingBlocks(content: string): { thinking: string[]; answer: string } {
  const thinking = Array.from(content.matchAll(/<think>([\s\S]*?)<\/think>/gi))
    .map((match) => match[1]?.trim() || '')
    .filter(Boolean);
  const answer = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { thinking, answer };
}

function renderAssistantOutput(content: string, showThinking = false) {
  const { thinking, answer } = splitThinkingBlocks(content);

  if (showThinking && thinking.length > 0) {
    console.log('\nThinking:');
    console.log(thinking.join('\n\n'));
  }

  console.log(`\n${answer || content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()}\n`);
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
    throw new Error('Usage: harness prompt [--agent] [--advanced-tools] [--thinking|--nothinking] [--show-thinking] <text>');
  }

  const useAgent = args.includes('--agent');
  const useAdvancedTools = useAgent && args.includes('--advanced-tools');
  const thinkingEnabled = args.includes('--nothinking') ? false : args.includes('--thinking') ? true : undefined;
  const runtime = thinkingEnabled === true ? await engine.getModelRuntime() : null;
  const thinkingWarning = thinkingEnabled === true && !supportsThinking(runtime?.configuredModelCapabilities)
    ? 'Thinking unavailable on current model; toggle may be ignored.'
    : null;

  if (isJson) {
    const promptMessages = [{ role: 'user' as const, content: promptText }];
    const response = useAgent
      ? await engine.agentWork(promptMessages, { ...(thinkingEnabled === undefined ? {} : { think: thinkingEnabled }), advancedTools: useAdvancedTools })
      : await engine.directChat(promptMessages, thinkingEnabled === undefined ? undefined : { think: thinkingEnabled });
    printOutput({ input: promptText, output: response, executionMode: useAgent ? 'agent' : 'chat', advancedTools: useAdvancedTools, ...(thinkingWarning ? { warning: thinkingWarning } : {}) });
    return;
  }

  const stepHistory: string[] = [];
  const promptMessages = [{ role: 'user' as const, content: promptText }];
  if (useAgent) {
    console.log(`[mode] Agent Work · tools ${useAdvancedTools ? 'advanced' : 'basic'}`);
  } else {
    console.log('[mode] Chat');
  }
  const response = useAgent ? await engine.agentWorkStream(promptMessages, {
    onStatus: (event) => pushStepStatus(stepHistory, event.action || event.phase),
    onTool: (event) => renderToolProgress(event),
    onRunSummary: (event) => renderRunSummary(event.summary),
  }, { ...(thinkingEnabled === undefined ? {} : { think: thinkingEnabled }), advancedTools: useAdvancedTools }) : await engine.directChatStream(promptMessages, {
    onStatus: (event) => pushStepStatus(stepHistory, event.action || event.phase),
  }, thinkingEnabled === undefined ? undefined : { think: thinkingEnabled });

  renderAssistantOutput(response, showThinkingOutput);
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
        turns: session.turnHistory ? session.turnHistory.length : 'not loaded',
        lastTurnMode: session.turnHistory?.length ? session.turnHistory[session.turnHistory.length - 1].executionMode : 'load session to inspect',
        updatedAt: new Date(session.updatedAt).toLocaleString(),
      })));
      return;
    }
    case 'resume': {
      const id = args[2];
      if (!id) {
        throw new Error('Usage: harness session resume <id>');
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
        throw new Error('Usage: harness session delete <id>');
      }

      const deleted = await engine.deleteSession(id);
      printOutput({ deleted });
      return;
    }
    default:
      throw new Error('Usage: harness session <list|resume|delete>');
  }
}

async function handleWorkspace() {
  switch (args[1]) {
    case undefined:
    case 'status':
      printOutput(engine.getPublicConfig());
      return;
    case 'use': {
      const nextWorkspace = args.slice(2).join(' ').trim();
      if (!nextWorkspace) {
        throw new Error('Usage: harness workspace use <path>');
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
        throw new Error('Usage: harness workspace read <path>');
      }
      printOutput(await engine.readFile(args[2]));
      return;
    case 'search':
      if (!args[2]) {
        throw new Error('Usage: harness workspace search <query> [glob]');
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
      throw new Error('Usage: harness workspace <status|use|list|read|search|git-status|git-diff>');
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
        throw new Error('Usage: harness skills activate <slug>');
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
      throw new Error('Usage: harness skills <list|activate>');
  }
}

async function handleModel() {
  switch (args[1]) {
    case undefined:
    case 'status': {
      printOutput(await engine.getModelRuntime());
      return;
    }
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
    case 'use': {
      const nextModel = args[2];
      if (!nextModel) {
        throw new Error('Usage: harness model use <name>');
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
      throw new Error('Usage: harness model <list|status|use>');
  }
}

async function handleConfig() {
  if (args[1] && args[1] !== 'show') {
    throw new Error('Usage: harness config [show]');
  }

  printOutput(engine.getPublicConfig());
}

function startRepl(executionMode: 'chat' | 'agent' = 'chat') {
  const history: { role: 'user' | 'assistant'; content: string }[] = [];
  const session = engine.startSession();
  let thinkingEnabled = false;
  let advancedTools = executionMode === 'agent' && args.includes('--advanced-tools');
  const initialConfig = engine.getPublicConfig();

  console.log('Gamma Harness CLI');
  console.log(
    `Session: ${session.id}  Model: ${session.model}  Mode: ${session.mode}  Execution: ${executionMode === 'agent' ? 'Agent Work' : 'Chat'}  Tools: ${advancedTools ? 'advanced' : 'basic'}  Thinking: ${thinkingEnabled ? 'on' : 'off'}  Memory: ${initialConfig.sessionMemoryEnabled ? `${initialConfig.sessionMemoryTurns} turns` : 'off'}  Retries: ${initialConfig.toolRetryMax}`,
  );
  console.log('Commands: /help /status /runtime /plan /exit');
  console.log('Agent-only: /advanced /basic /approvals /approve <id> /reject <id>');
  console.log('Config: /model /model list /model use <name> /workspace /workspace use <path> /mode [value] /sessions /doctor /skills');

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
        console.log('Slash commands: /help /status /runtime /plan /clear /exit');
        console.log('Agent-only: /advanced /basic /approvals /approve <id> /reject <id>');
        console.log('Config: /thinking /nothinking /model /model list /model use <name> /workspace /workspace use <path> /mode [value] /sessions /doctor /skills /activate <slug>');
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

      if (input === '/advanced') {
        if (executionMode !== 'agent') {
          console.log('Advanced tools only apply in Agent Work.');
          rl.prompt();
          return;
        }
        advancedTools = true;
        console.log('Advanced Agent tools enabled for this CLI session');
        rl.prompt();
        return;
      }

      if (input === '/basic') {
        advancedTools = false;
        console.log('Basic Agent tools enabled');
        rl.prompt();
        return;
      }

      if (input === '/status') {
        console.log(JSON.stringify({
          session: engine.getSession(),
          config: engine.getPublicConfig(),
          executionMode,
          thinkingEnabled,
          advancedTools,
        }, null, 2));
        rl.prompt();
        return;
      }

      if (input === '/runtime') {
        const config = engine.getPublicConfig();
        console.log(JSON.stringify({
          contextBudget: config.contextBudget,
          toolRetryMax: config.toolRetryMax,
          sessionMemoryEnabled: config.sessionMemoryEnabled,
          sessionMemoryTurns: config.sessionMemoryTurns,
          selfCheckEnabled: config.selfCheckEnabled,
          advancedAgentToolsEnabled: config.advancedAgentToolsEnabled,
          currentSessionAdvancedTools: advancedTools,
          internetAccessEnabled: config.internetAccessEnabled,
          streamIdleTimeoutMs: config.streamIdleTimeoutMs,
        }, null, 2));
        rl.prompt();
        return;
      }

      if (input === '/plan') {
        console.log(JSON.stringify(engine.getPlanState(), null, 2));
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

      if (input === '/sessions') {
        console.log(JSON.stringify(await engine.listSessions(), null, 2));
        rl.prompt();
        return;
      }

      if (input === '/doctor') {
        console.log(JSON.stringify(await runDiagnostics({ repoRoot: process.cwd(), quiet: true }), null, 2));
        rl.prompt();
        return;
      }

      if (input === '/mode' || input === '/permissions') {
        console.log(JSON.stringify({ mode: engine.getPublicConfig().mode }, null, 2));
        rl.prompt();
        return;
      }

      if (input.startsWith('/mode ') || input.startsWith('/permissions ')) {
        const nextMode = input.split(' ').slice(1).join(' ').trim();
        if (!['read-only', 'workspace-write', 'danger'].includes(nextMode)) {
          console.log('Mode must be one of read-only, workspace-write, or danger');
          rl.prompt();
          return;
        }

        await engine.updateConfig({ mode: nextMode as 'read-only' | 'workspace-write' | 'danger' });
        console.log(JSON.stringify({ mode: engine.getPublicConfig().mode }, null, 2));
        rl.prompt();
        return;
      }

      if (input === '/approvals') {
        console.log(JSON.stringify(engine.getPendingApprovals(), null, 2));
        rl.prompt();
        return;
      }

      if (input.startsWith('/approve ')) {
        const approvalId = input.split(' ')[1];
        console.log(engine.resolveApproval(approvalId, true) ? `Approved ${approvalId}` : `Approval ${approvalId} not found`);
        rl.prompt();
        return;
      }

      if (input.startsWith('/reject ')) {
        const approvalId = input.split(' ')[1];
        console.log(engine.resolveApproval(approvalId, false) ? `Rejected ${approvalId}` : `Approval ${approvalId} not found`);
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
      const replMessages = [
        { role: 'system' as const, content: executionMode === 'agent' ? 'You are a helpful coding assistant. Be concise. Use tools when file actions are needed.' : 'You are a helpful local chat assistant. Be concise.' },
        ...history,
      ];
      const response = executionMode === 'agent'
        ? await engine.agentWorkStream(replMessages, {
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
            advancedTools,
          })
        : await engine.directChatStream(replMessages, {
            onStatus: (event: { action: string; phase: string }) => {
              pushStepStatus(stepHistory, event.action || event.phase);
            },
          }, {
            think: thinkingEnabled,
          });
      history.push({ role: 'assistant', content: response });
      renderAssistantOutput(response, showThinkingOutput);
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
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;
    case 'doctor':
      printOutput(await runDiagnostics({ repoRoot: process.cwd(), quiet: isJson }));
      return;
    case 'benchmark':
      printOutput(await runBenchmarks({ quiet: isJson }));
      return;
    case 'status':
      printOutput(engine.getPublicConfig());
      return;
    case 'prompt':
      await handlePrompt();
      return;
    case 'chat':
      if (isJson) {
        throw new Error('JSON mode is not supported for interactive chat.');
      }
      startRepl('chat');
      return;
    case 'agent':
      if (isJson) {
        throw new Error('JSON mode is not supported for interactive agent.');
      }
      startRepl('agent');
      return;
    case 'inspect': {
      const inspection = await engine.inspectProject();
      printOutput(isJson ? { inspection } : inspection.summary);
      return;
    }
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
      throw new Error('Unknown command. Run `harness help` for commands.');
  }
}

main().catch((error: any) => {
  console.error(error?.message || error);
  process.exit(1);
});
