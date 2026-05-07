import * as fs from 'fs/promises';
import * as path from 'path';

export type AgentStateStatus = 'IN_PROGRESS' | 'UNVERIFIED' | 'BLOCKED' | 'FAILED' | 'DONE';

export type AgentTaskType =
  | 'read_only_research'
  | 'docs_edit'
  | 'code_edit'
  | 'bug_fix'
  | 'refactor'
  | 'config_change'
  | 'command_task';

export type AgentStatePhase =
  | 'IDLE'
  | 'TASK_INTAKE'
  | 'STATE_REVIEW'
  | 'CONTEXT_SELECTION'
  | 'MICRO_PLAN'
  | 'CHECKPOINT_IF_EDIT'
  | 'TOOL_ACTION'
  | 'DIFF_IF_EDIT'
  | 'VERIFY_IF_REQUIRED'
  | 'STATE_UPDATE'
  | 'REPORT'
  | 'STOP';

export type AgentToolName =
  | 'list_dir'
  | 'glob'
  | 'search_text'
  | 'read_file'
  | 'git_status'
  | 'git_diff'
  | 'patch_file'
  | 'create_checkpoint'
  | 'rollback_checkpoint'
  | 'run_command'
  | 'update_state';

export interface AgentTaskLedgerEntry {
  id: string;
  title: string;
  status: AgentStateStatus;
  proofRequired: string;
  proofCollected: string;
}

export interface AgentState {
  schemaVersion: string;
  taskIdentity: string;
  userObjective: string;
  workspace: string;
  branch: string;
  mode: 'Agent';
  currentStatus: AgentStateStatus;
  definitionOfDone: string[];
  constraints: string[];
  currentPhase: AgentStatePhase;
  currentStep: string;
  nextAction: string;
  assumptions: string[];
  blockers: string[];
  filesRead: string[];
  filesChanged: string[];
  commandsRun: string[];
  checkpoints: string[];
  verificationResults: string[];
  evidenceLedger: string[];
  taskLedger: AgentTaskLedgerEntry[];
  workingMemory: string[];
  compactedHistory: string[];
}

export interface AgentStateSummary {
  statePath: string;
  taskIdentity: string;
  objective: string;
  taskType: AgentTaskType;
  status: AgentStateStatus;
  phase: AgentStatePhase;
  step: string;
  nextAction: string;
  allowedTools: AgentToolName[];
  requiredProof: string[];
  missingProof: string[];
  evidenceCount: number;
  blockerCount: number;
  commandCount: number;
  checkpointCount: number;
  verificationCount: number;
  latestCheckpoint: string;
  latestVerification: string;
  doneReady: boolean;
  filesRead: number;
  filesChanged: number;
}

export interface AgentStepResult {
  statePath: string;
  executedPhase: AgentStatePhase;
  completedStep: string;
  nextPhase: AgentStatePhase;
  status: AgentStateStatus;
  evidence: string;
  nextAction: string;
}

export interface AgentDoneGateResult {
  taskType: AgentTaskType;
  requiredProof: string[];
  missingProof: string[];
  canMarkDone: boolean;
  status: 'DONE' | 'UNVERIFIED';
}

export interface AgentToolPolicyResult {
  phase: AgentStatePhase;
  tool: AgentToolName;
  allowed: boolean;
  allowedTools: AgentToolName[];
  reason?: string;
}

const STATE_FILE_RELATIVE_PATH = path.join('.gamma-harness', 'agent_state.md');
const SCHEMA_VERSION = 'gamma-agent-state/v1';

const SECTION_TITLES = [
  'Schema Version',
  'Task Identity',
  'User Objective',
  'Workspace',
  'Branch',
  'Mode',
  'Current Status',
  'Definition of Done',
  'Constraints',
  'Current Phase',
  'Current Step',
  'Next Action',
  'Assumptions',
  'Blockers',
  'Files Read',
  'Files Changed',
  'Commands Run',
  'Checkpoints',
  'Verification Results',
  'Evidence Ledger',
  'Task Ledger',
  'Working Memory',
  'Compacted History',
] as const;

export function getAgentStatePath(workspaceRoot: string): string {
  return path.resolve(workspaceRoot, STATE_FILE_RELATIVE_PATH);
}

export function createInitialAgentState(input: {
  taskIdentity: string;
  userObjective: string;
  workspace: string;
  branch: string;
}): AgentState {
  return {
    schemaVersion: SCHEMA_VERSION,
    taskIdentity: input.taskIdentity,
    userObjective: input.userObjective,
    workspace: input.workspace,
    branch: input.branch || 'unknown',
    mode: 'Agent',
    currentStatus: 'IN_PROGRESS',
    definitionOfDone: [
      'Task has explicit evidence ledger entries.',
      'Workspace changes, if any, have diff and verification proof.',
      'No DONE status is used without proof.',
    ],
    constraints: [
      'CLI-first v2 workflow.',
      'One active micro-step only.',
      'No web UI expansion in this task.',
      'No multi-agent/subagent execution.',
      'Checkpoint before edit, diff after edit, verify before DONE.',
    ],
    currentPhase: 'TASK_INTAKE',
    currentStep: 'Task accepted into persistent Agent state.',
    nextAction: 'Run gamma agent step.',
    assumptions: [],
    blockers: [],
    filesRead: [],
    filesChanged: [],
    commandsRun: [],
    checkpoints: [],
    verificationResults: [],
    evidenceLedger: [
      `TASK_INTAKE recorded in ${STATE_FILE_RELATIVE_PATH}`,
    ],
    taskLedger: [
      {
        id: 'step-001',
        title: 'TASK_INTAKE',
        status: 'IN_PROGRESS',
        proofRequired: 'Task identity and user objective recorded in persistent state.',
        proofCollected: `State file created at ${STATE_FILE_RELATIVE_PATH}.`,
      },
    ],
    workingMemory: [
      'Agent state is now the continuity source for this task.',
    ],
    compactedHistory: [],
  };
}

export async function readAgentState(workspaceRoot: string): Promise<AgentState | null> {
  try {
    const markdown = await fs.readFile(getAgentStatePath(workspaceRoot), 'utf8');
    return parseAgentStateMarkdown(markdown, workspaceRoot);
  } catch {
    return null;
  }
}

export async function writeAgentState(workspaceRoot: string, state: AgentState): Promise<string> {
  const statePath = getAgentStatePath(workspaceRoot);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, renderAgentStateMarkdown(state), 'utf8');
  return statePath;
}

export function summarizeAgentState(statePath: string, state: AgentState): AgentStateSummary {
  const gate = evaluateAgentDoneGate(state);
  return {
    statePath,
    taskIdentity: state.taskIdentity,
    objective: state.userObjective,
    taskType: gate.taskType,
    status: state.currentStatus,
    phase: state.currentPhase,
    step: state.currentStep,
    nextAction: state.nextAction,
    allowedTools: getAgentAllowedToolsForPhase(state.currentPhase),
    requiredProof: gate.requiredProof,
    missingProof: gate.missingProof,
    evidenceCount: state.evidenceLedger.length,
    blockerCount: state.blockers.length,
    commandCount: state.commandsRun.length,
    checkpointCount: state.checkpoints.length,
    verificationCount: state.verificationResults.length,
    latestCheckpoint: state.checkpoints[state.checkpoints.length - 1] || '',
    latestVerification: state.verificationResults[state.verificationResults.length - 1] || '',
    doneReady: gate.canMarkDone,
    filesRead: state.filesRead.length,
    filesChanged: state.filesChanged.length,
  };
}

export function renderAgentStateMarkdown(state: AgentState): string {
  const sections: Array<[string, string]> = [
    ['Schema Version', state.schemaVersion],
    ['Task Identity', state.taskIdentity],
    ['User Objective', state.userObjective],
    ['Workspace', state.workspace],
    ['Branch', state.branch],
    ['Mode', state.mode],
    ['Current Status', state.currentStatus],
    ['Definition of Done', renderList(state.definitionOfDone)],
    ['Constraints', renderList(state.constraints)],
    ['Current Phase', state.currentPhase],
    ['Current Step', state.currentStep],
    ['Next Action', state.nextAction],
    ['Assumptions', renderList(state.assumptions)],
    ['Blockers', renderList(state.blockers)],
    ['Files Read', renderList(state.filesRead)],
    ['Files Changed', renderList(state.filesChanged)],
    ['Commands Run', renderList(state.commandsRun)],
    ['Checkpoints', renderList(state.checkpoints)],
    ['Verification Results', renderList(state.verificationResults)],
    ['Evidence Ledger', renderList(state.evidenceLedger)],
    ['Task Ledger', renderTaskLedger(state.taskLedger)],
    ['Working Memory', renderList(state.workingMemory)],
    ['Compacted History', renderList(state.compactedHistory)],
  ];

  return [
    '# Gamma Agent State',
    '',
    ...sections.flatMap(([title, content]) => [`## ${title}`, '', content || '- none', '']),
  ].join('\n').replace(/\n+$/, '\n');
}

export function parseAgentStateMarkdown(markdown: string, workspaceRoot: string): AgentState {
  const sections = splitSections(markdown);
  const currentPhase = normalizePhase(firstLine(sections['Current Phase']), 'IDLE');
  const currentStatus = normalizeStatus(firstLine(sections['Current Status']), 'IN_PROGRESS');

  return {
    schemaVersion: firstLine(sections['Schema Version']) || SCHEMA_VERSION,
    taskIdentity: firstLine(sections['Task Identity']) || createTaskIdentity(),
    userObjective: firstLine(sections['User Objective']) || '',
    workspace: firstLine(sections['Workspace']) || workspaceRoot,
    branch: firstLine(sections['Branch']) || 'unknown',
    mode: 'Agent',
    currentStatus,
    definitionOfDone: parseList(sections['Definition of Done']),
    constraints: parseList(sections['Constraints']),
    currentPhase,
    currentStep: firstLine(sections['Current Step']) || 'No current step recorded.',
    nextAction: firstLine(sections['Next Action']) || 'Run gamma agent status.',
    assumptions: parseList(sections['Assumptions']),
    blockers: parseList(sections['Blockers']),
    filesRead: parseList(sections['Files Read']),
    filesChanged: parseList(sections['Files Changed']),
    commandsRun: parseList(sections['Commands Run']),
    checkpoints: parseList(sections['Checkpoints']),
    verificationResults: parseList(sections['Verification Results']),
    evidenceLedger: parseList(sections['Evidence Ledger']),
    taskLedger: parseTaskLedger(sections['Task Ledger']),
    workingMemory: parseList(sections['Working Memory']),
    compactedHistory: parseList(sections['Compacted History']),
  };
}

export function createTaskIdentity(): string {
  return `task-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

export function advanceAgentOneStep(input: {
  state: AgentState;
  statePath: string;
}): { state: AgentState; result: AgentStepResult } {
  const state = cloneState(input.state);
  const executedPhase = state.currentPhase === 'IDLE' ? 'TASK_INTAKE' : state.currentPhase;
  const plan = getMicroStepPlan(executedPhase);
  const stepId = `step-${String(state.taskLedger.length + 1).padStart(3, '0')}`;
  const evidence = `${executedPhase} completed at ${new Date().toISOString()}`;

  state.taskLedger = state.taskLedger.map((entry) =>
    entry.status === 'IN_PROGRESS'
      ? { ...entry, status: 'DONE', proofCollected: entry.proofCollected || evidence }
      : entry,
  );
  state.taskLedger.push({
    id: stepId,
    title: plan.title,
    status: 'DONE',
    proofRequired: plan.proofRequired,
    proofCollected: evidence,
  });
  state.currentStatus = state.currentStatus === 'DONE' ? 'IN_PROGRESS' : state.currentStatus;
  state.currentPhase = plan.nextPhase;
  state.currentStep = plan.completedStep;
  state.nextAction = plan.nextAction;
  state.evidenceLedger = addUnique(state.evidenceLedger, evidence);
  state.filesRead = addUnique(state.filesRead, STATE_FILE_RELATIVE_PATH);
  state.workingMemory = compactList([
    `Last completed phase: ${executedPhase}`,
    `Current phase: ${plan.nextPhase}`,
    ...state.workingMemory,
  ], 8);

  return {
    state,
    result: {
      statePath: input.statePath,
      executedPhase,
      completedStep: plan.completedStep,
      nextPhase: plan.nextPhase,
      status: state.currentStatus,
      evidence,
      nextAction: state.nextAction,
    },
  };
}

function getMicroStepPlan(phase: AgentStatePhase): {
  title: string;
  completedStep: string;
  nextPhase: AgentStatePhase;
  proofRequired: string;
  nextAction: string;
} {
  switch (phase) {
    case 'TASK_INTAKE':
      return {
        title: 'TASK_INTAKE',
        completedStep: 'Recorded task identity, objective, constraints, and proof rules.',
        nextPhase: 'STATE_REVIEW',
        proofRequired: 'State file contains objective and definition of done.',
        nextAction: 'Run gamma agent step to review existing state.',
      };
    case 'STATE_REVIEW':
      return {
        title: 'STATE_REVIEW',
        completedStep: 'Read persistent state and checked open blockers/evidence obligations.',
        nextPhase: 'CONTEXT_SELECTION',
        proofRequired: 'State file was read before step execution.',
        nextAction: 'Run gamma agent step to select minimal context.',
      };
    case 'CONTEXT_SELECTION':
      return {
        title: 'CONTEXT_SELECTION',
        completedStep: 'Selected state file as the only required context for this micro-step.',
        nextPhase: 'MICRO_PLAN',
        proofRequired: 'Context selection recorded without repo dump.',
        nextAction: 'Run gamma agent step to produce one micro-plan.',
      };
    case 'MICRO_PLAN':
      return {
        title: 'MICRO_PLAN',
        completedStep: 'Prepared one-step execution plan and stopped before any broad loop.',
        nextPhase: 'CHECKPOINT_IF_EDIT',
        proofRequired: 'One next action recorded.',
        nextAction: 'Run gamma agent patch for an edit task, or gamma agent verify for a read-only task.',
      };
    case 'CHECKPOINT_IF_EDIT':
      return {
        title: 'CHECKPOINT_IF_EDIT',
        completedStep: 'Stopped at edit-prep boundary. Edit command must create checkpoint before patch.',
        nextPhase: 'STOP',
        proofRequired: 'Checkpoint is required before any edit tool runs.',
        nextAction: 'Run gamma agent patch with one file, or stop if no edit is needed.',
      };
    case 'STOP':
      return {
        title: 'STOP',
        completedStep: 'Agent was already stopped; no extra loop executed.',
        nextPhase: 'STOP',
        proofRequired: 'No new phase loop started.',
        nextAction: 'Start a new task or continue later phases.',
      };
    default:
      return {
        title: phase,
        completedStep: `${phase} recorded as current micro-step without executing future phase behavior.`,
        nextPhase: 'STOP',
        proofRequired: `${phase} must be implemented in a later phase before automation.`,
        nextAction: 'Stop. Implement later roadmap phase before continuing.',
      };
  }
}

function splitSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = markdown.split(/\r?\n/);
  let current: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current) {
      sections[current] = buffer.join('\n').trim();
    }
  };

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      current = match[1];
      buffer = [];
      continue;
    }
    if (current) {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

function firstLine(value = ''): string {
  return value.split(/\r?\n/).map((line) => line.trim()).find((line) => line && line !== '- none') || '';
}

function renderList(values: string[]): string {
  return values.length > 0 ? values.map((entry) => `- ${entry}`).join('\n') : '- none';
}

function parseList(value = ''): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter((line) => line && line !== 'none');
}

function renderTaskLedger(entries: AgentTaskLedgerEntry[]): string {
  return entries.length > 0
    ? entries.map((entry) =>
        `- [${entry.status}] ${entry.id}: ${entry.title} | proof required: ${entry.proofRequired} | proof collected: ${entry.proofCollected}`,
      ).join('\n')
    : '- none';
}

function parseTaskLedger(value = ''): AgentTaskLedgerEntry[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ['))
    .map((line) => {
      const match = /^- \[([^\]]+)\]\s+([^:]+):\s+(.+?)(?:\s+\|\s+proof required:\s+(.+?))?(?:\s+\|\s+proof collected:\s+(.+))?$/.exec(line);
      return {
        id: match?.[2]?.trim() || createTaskIdentity(),
        title: match?.[3]?.trim() || line,
        status: normalizeStatus(match?.[1] || '', 'IN_PROGRESS'),
        proofRequired: match?.[4]?.trim() || 'Proof required.',
        proofCollected: match?.[5]?.trim() || '',
      };
    });
}

function normalizeStatus(value: string, fallback: AgentStateStatus): AgentStateStatus {
  return ['IN_PROGRESS', 'UNVERIFIED', 'BLOCKED', 'FAILED', 'DONE'].includes(value)
    ? value as AgentStateStatus
    : fallback;
}

function normalizePhase(value: string, fallback: AgentStatePhase): AgentStatePhase {
  return SECTION_PHASES.has(value as AgentStatePhase) ? value as AgentStatePhase : fallback;
}

const SECTION_PHASES = new Set<AgentStatePhase>([
  'IDLE',
  'TASK_INTAKE',
  'STATE_REVIEW',
  'CONTEXT_SELECTION',
  'MICRO_PLAN',
  'CHECKPOINT_IF_EDIT',
  'TOOL_ACTION',
  'DIFF_IF_EDIT',
  'VERIFY_IF_REQUIRED',
  'STATE_UPDATE',
  'REPORT',
  'STOP',
]);

function cloneState(state: AgentState): AgentState {
  return {
    ...state,
    definitionOfDone: [...state.definitionOfDone],
    constraints: [...state.constraints],
    assumptions: [...state.assumptions],
    blockers: [...state.blockers],
    filesRead: [...state.filesRead],
    filesChanged: [...state.filesChanged],
    commandsRun: [...state.commandsRun],
    checkpoints: [...state.checkpoints],
    verificationResults: [...state.verificationResults],
    evidenceLedger: [...state.evidenceLedger],
    taskLedger: state.taskLedger.map((entry) => ({ ...entry })),
    workingMemory: [...state.workingMemory],
    compactedHistory: [...state.compactedHistory],
  };
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function compactList(values: string[], maxEntries: number): string[] {
  const compacted: string[] = [];
  for (const value of values) {
    if (value && !compacted.includes(value)) {
      compacted.push(value);
    }
    if (compacted.length >= maxEntries) {
      break;
    }
  }
  return compacted;
}

export function validateAgentStateSections(markdown: string): string[] {
  const sections = splitSections(markdown);
  return SECTION_TITLES.filter((title) => !sections[title]);
}

export function classifyAgentTaskType(objective: string): AgentTaskType {
  const text = objective.toLowerCase();
  if (/\b(refactor|rename|restructure|cleanup|clean up)\b/.test(text)) {
    return 'refactor';
  }
  if (/\b(bug|fix|broken|regression|error|failing|failure)\b/.test(text)) {
    return 'bug_fix';
  }
  if (/\b(config|configuration|package\.json|tsconfig|env|eslint|vite|docker|compose)\b/.test(text)) {
    return 'config_change';
  }
  if (/\b(readme|docs?|documentation|agents\.md|roadmap|adr|markdown)\b/.test(text)) {
    return 'docs_edit';
  }
  if (/\b(run|execute|command|test|build|typecheck|lint|smoke)\b/.test(text)) {
    return 'command_task';
  }
  if (/\b(code|implement|add|create|edit|update|patch|change)\b/.test(text)) {
    return 'code_edit';
  }
  return 'read_only_research';
}

export function getAgentAllowedToolsForPhase(phase: AgentStatePhase): AgentToolName[] {
  switch (phase) {
    case 'IDLE':
    case 'TASK_INTAKE':
    case 'STATE_REVIEW':
    case 'CONTEXT_SELECTION':
    case 'MICRO_PLAN':
      return ['list_dir', 'glob', 'search_text', 'read_file', 'git_status', 'update_state'];
    case 'CHECKPOINT_IF_EDIT':
      return ['create_checkpoint', 'git_status', 'update_state'];
    case 'TOOL_ACTION':
      return ['patch_file', 'update_state'];
    case 'DIFF_IF_EDIT':
      return ['git_diff', 'update_state'];
    case 'VERIFY_IF_REQUIRED':
      return ['run_command', 'git_status', 'git_diff', 'read_file', 'rollback_checkpoint', 'update_state'];
    case 'STATE_UPDATE':
    case 'REPORT':
      return ['update_state', 'git_status'];
    case 'STOP':
      return ['update_state', 'git_status', 'git_diff', 'rollback_checkpoint'];
    default:
      return ['update_state'];
  }
}

export function checkAgentToolPolicy(phase: AgentStatePhase, tool: AgentToolName): AgentToolPolicyResult {
  const allowedTools = getAgentAllowedToolsForPhase(phase);
  const allowed = allowedTools.includes(tool);
  return {
    phase,
    tool,
    allowed,
    allowedTools,
    reason: allowed
      ? undefined
      : `${tool} is not allowed during ${phase}. Allowed tools: ${allowedTools.join(', ') || 'none'}.`,
  };
}

export function evaluateAgentDoneGate(state: AgentState, taskType = classifyAgentTaskType(state.userObjective)): AgentDoneGateResult {
  const requiredProof = getRequiredProof(taskType);
  const missingProof = requiredProof.filter((proof) => !hasProof(state, proof));
  return {
    taskType,
    requiredProof,
    missingProof,
    canMarkDone: missingProof.length === 0,
    status: missingProof.length === 0 ? 'DONE' : 'UNVERIFIED',
  };
}

export function applyAgentDoneGate(state: AgentState, taskType = classifyAgentTaskType(state.userObjective)): {
  state: AgentState;
  gate: AgentDoneGateResult;
} {
  const nextState = cloneState(state);
  const gate = evaluateAgentDoneGate(nextState, taskType);
  nextState.currentStatus = gate.status;
  if (gate.canMarkDone) {
    nextState.currentPhase = 'REPORT';
    nextState.currentStep = `DONE gate passed for ${gate.taskType}.`;
    nextState.nextAction = 'Report result with evidence ledger.';
    nextState.evidenceLedger = addUnique(
      nextState.evidenceLedger,
      `DONE gate passed for ${gate.taskType}: ${gate.requiredProof.join('; ')}`,
    );
  } else {
    nextState.currentPhase = 'VERIFY_IF_REQUIRED';
    nextState.currentStep = `DONE gate blocked for ${gate.taskType}.`;
    nextState.nextAction = `Collect missing proof: ${gate.missingProof.join('; ')}`;
    nextState.evidenceLedger = addUnique(
      nextState.evidenceLedger,
      `DONE gate blocked for ${gate.taskType}: missing ${gate.missingProof.join('; ')}`,
    );
  }
  return { state: nextState, gate };
}

function getRequiredProof(taskType: AgentTaskType): string[] {
  switch (taskType) {
    case 'read_only_research':
      return ['files_read', 'findings_evidence'];
    case 'docs_edit':
      return ['checkpoint', 'diff', 'files_changed', 'verification'];
    case 'code_edit':
      return ['checkpoint', 'diff', 'files_changed', 'verification'];
    case 'bug_fix':
      return ['checkpoint', 'diff', 'files_changed', 'verification'];
    case 'refactor':
      return ['checkpoint', 'diff', 'files_changed', 'verification'];
    case 'config_change':
      return ['checkpoint', 'diff', 'files_changed', 'verification'];
    case 'command_task':
      return ['command', 'verification'];
    default:
      return ['findings_evidence'];
  }
}

function hasProof(state: AgentState, proof: string): boolean {
  switch (proof) {
    case 'files_read':
      return state.filesRead.length > 0;
    case 'findings_evidence':
      return state.evidenceLedger.length > 0 || state.workingMemory.length > 0;
    case 'checkpoint':
      return state.checkpoints.length > 0;
    case 'diff':
      return [...state.evidenceLedger, ...state.verificationResults].some((entry) => /\bdiff\b/i.test(entry));
    case 'files_changed':
      return state.filesChanged.length > 0;
    case 'verification':
      return state.verificationResults.some((entry) => /^PASS\b/.test(entry));
    case 'command':
      return state.commandsRun.length > 0;
    default:
      return false;
  }
}
