type TraceLike = {
  type: string;
  data: unknown;
  timestamp: number;
};

type WorkflowStepLike = {
  id: string;
  title: string;
  status: string;
};

type WorkflowLike = {
  workflowType: string;
  status: string;
  currentStepId?: string | null;
  steps?: WorkflowStepLike[];
};

type HeavyModelLockLike = {
  held: boolean;
  ownerRunId: string | null;
  queued: number;
};

type ModelRuntimeLike = {
  configuredModel?: string;
  activeModel?: string | null;
  agentModel?: string;
  agentModelActive?: boolean;
  agentProtocol?: string;
  heavyModelLock?: HeavyModelLockLike;
  lastRouteSelection?: {
    role: string;
    model: string;
    protocol?: string;
    reason?: string;
  };
};

type ActionDslValue = {
  kind?: string;
  action?: string;
  args?: Record<string, unknown>;
  summary?: string;
  verification?: string;
  reason?: string;
  nextSafeStep?: string;
};

export interface ActionDslTraceState {
  currentAction?: string;
  parserState?: string;
  repairAttempts?: number;
  lastError?: string;
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function shortenText(value: string, max = 44): string {
  if (value.length <= max) {
    return value;
  }

  const head = Math.max(10, Math.floor((max - 3) / 2));
  const tail = Math.max(8, max - head - 3);
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function formatActionObject(value: ActionDslValue | Record<string, unknown>): string {
  if (value.kind === 'action' && value.action) {
    const args = value.args && Object.keys(value.args).length > 0
      ? `\nargs:\n${safeJsonStringify(value.args).split('\n').map((line) => `  ${line}`).join('\n')}`
      : '\nargs: {}';
    return `kind: action\naction: ${value.action}${args}`;
  }

  if (value.kind === 'final') {
    const lines = ['kind: final'];
    if (typeof value.summary === 'string' && value.summary.trim()) {
      lines.push(`summary: ${value.summary}`);
    }
    if (typeof value.verification === 'string' && value.verification.trim()) {
      lines.push(`verification: ${value.verification}`);
    }
    return lines.join('\n');
  }

  if (value.kind === 'blocker') {
    const lines = ['kind: blocker'];
    if (typeof value.reason === 'string' && value.reason.trim()) {
      lines.push(`reason: ${value.reason}`);
    }
    if (typeof value.nextSafeStep === 'string' && value.nextSafeStep.trim()) {
      lines.push(`nextSafeStep: ${value.nextSafeStep}`);
    }
    return lines.join('\n');
  }

  return safeJsonStringify(value);
}

export function formatToolInputSummary(inputSummary: string): string {
  const parsed = safeJsonParse(inputSummary);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return formatActionObject(parsed as ActionDslValue);
  }

  return inputSummary;
}

function formatTraceDataObject(data: Record<string, unknown> | undefined): string {
  if (!data) {
    return 'Trace event';
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof data.reason === 'string' && data.reason.trim()) {
    return data.reason;
  }

  if (typeof data.summary === 'string' && data.summary.trim()) {
    return data.summary;
  }

  return 'Trace event';
}

function formatWorkflowProgress(workflow: WorkflowLike): string {
  const steps = workflow.steps || [];
  const current = workflow.currentStepId
    ? steps.find((step) => step.id === workflow.currentStepId)
    : undefined;
  const doneSteps = steps.filter((step) => ['done', 'skipped'].includes(step.status)).length;
  const progress = steps.length > 0 ? `${doneSteps}/${steps.length} steps` : '0 steps';
  return [
    workflow.workflowType,
    workflow.status,
    progress,
    current ? `current ${current.title}` : null,
  ].filter((entry): entry is string => Boolean(entry)).join(' · ');
}

function formatHeavyModelLock(lock: HeavyModelLockLike): string {
  const owner = lock.ownerRunId ? ` · owner ${shortenText(lock.ownerRunId, 12)}` : '';
  return `${lock.held ? 'Held' : 'Free'} · queued ${lock.queued}${owner}`;
}

export function formatModelRuntimeSummary(runtime: ModelRuntimeLike | null | undefined): string {
  if (!runtime) {
    return 'Runtime unavailable';
  }

  const parts: string[] = [];
  if (runtime.configuredModel) {
    parts.push(`Configured ${runtime.configuredModel}`);
  }
  if (runtime.activeModel) {
    parts.push(`Active ${runtime.activeModel}`);
  }
  if (runtime.agentModel) {
    parts.push(`Agent ${runtime.agentModel}${runtime.agentModelActive ? ' (active)' : ''}`);
  }
  if (runtime.heavyModelLock) {
    parts.push(`Heavy ${formatHeavyModelLock(runtime.heavyModelLock)}`);
  }
  if (runtime.lastRouteSelection) {
    parts.push(`Route ${runtime.lastRouteSelection.role} → ${runtime.lastRouteSelection.model}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Runtime unavailable';
}

export function summarizeActionDslTraceState(traces: TraceLike[]): ActionDslTraceState {
  let currentAction: string | undefined;
  let parserState: string | undefined;
  let repairAttempts = 0;
  let lastError: string | undefined;

  for (const trace of traces) {
    const data = trace.data as Record<string, unknown> | undefined;
    switch (trace.type) {
      case 'action_dsl_action_started':
        currentAction = data ? formatActionObject(data as ActionDslValue) : 'Action DSL action';
        break;
      case 'action_dsl_parse_failed':
        parserState = `Parse failed: ${typeof data?.error === 'object' && data?.error && typeof (data.error as { code?: unknown }).code === 'string'
          ? `${(data.error as { code: string }).code}${typeof (data.error as { message?: unknown }).message === 'string' ? ` - ${(data.error as { message: string }).message}` : ''}`
          : formatTraceDataObject(data)}`;
        lastError = parserState;
        break;
      case 'action_dsl_repair_started':
        repairAttempts = Number(typeof data?.attempt === 'number' ? data.attempt : repairAttempts + 1);
        parserState = `Repair attempt ${repairAttempts} started`;
        break;
      case 'action_dsl_repair_succeeded':
        repairAttempts = Number(typeof data?.attempt === 'number' ? data.attempt : repairAttempts || 1);
        parserState = `Repair attempt ${repairAttempts} succeeded`;
        break;
      case 'action_dsl_action_finished':
        if (typeof data?.success === 'boolean') {
          parserState = data.success ? 'Action finished successfully' : `Action failed${typeof data.output === 'string' ? `: ${data.output}` : ''}`;
        }
        break;
      default:
        break;
    }
  }

  return {
    currentAction,
    parserState,
    repairAttempts,
    lastError,
  };
}

export function formatTraceHeadline(trace: TraceLike): string {
  const data = trace.data as Record<string, unknown> | undefined;
  switch (trace.type) {
    case 'planner_trace':
      return typeof data?.state === 'object' && data.state
        ? ((data.state as Record<string, unknown>).intendedNextAction as string) ||
            ((data.state as Record<string, unknown>).currentPhase as string) ||
            'Planner updated'
        : 'Planner updated';
    case 'run_step_started':
    case 'run_step_finished':
      return (typeof data?.step === 'object' && data.step
        ? ((data.step as Record<string, unknown>).title as string) || ((data.step as Record<string, unknown>).toolName as string)
        : undefined) || 'Run step';
    case 'run_summary_ready':
      return typeof data?.summary === 'string' ? data.summary : 'Run summary ready';
    case 'manual_tool_fallback':
      return typeof data?.reason === 'string' ? data.reason : 'Manual fallback active';
    case 'manual_tool_strategy_selected':
      return typeof data?.reason === 'string' ? data.reason : 'Manual tool strategy selected';
    case 'action_dsl_protocol_selected':
      return typeof data?.protocol === 'string' ? data.protocol : 'Action DSL protocol selected';
    case 'action_dsl_action_started':
      return `Action DSL ${formatActionObject(data as ActionDslValue).replace(/\n/g, ' · ')}`;
    case 'action_dsl_action_finished':
      return typeof data?.action === 'string'
        ? `${data.action} ${data.success === false ? 'failed' : 'finished'}`
        : 'Action DSL action finished';
    case 'action_dsl_parse_failed':
      return `Action DSL parse failed${typeof (data?.error as { code?: unknown } | undefined)?.code === 'string' ? `: ${(data?.error as { code: string }).code}` : ''}`;
    case 'action_dsl_repair_started':
      return `Action DSL repair started${typeof data?.attempt === 'number' ? ` (attempt ${data.attempt})` : ''}`;
    case 'action_dsl_repair_succeeded':
      return `Action DSL repair succeeded${typeof data?.attempt === 'number' ? ` (attempt ${data.attempt})` : ''}`;
    case 'heavy_model_lock_acquired':
      return `Heavy model lock acquired${typeof data?.queued === 'number' ? ` · queued ${data.queued}` : ''}`;
    case 'heavy_model_lock_released':
      return 'Heavy model lock released';
    case 'model_route_selected':
      return typeof data?.reason === 'string'
        ? data.reason
        : `${typeof data?.protocol === 'string' ? data.protocol : 'agent'} → ${typeof data?.agentModel === 'string' ? data.agentModel : 'model'}`;
    case 'workflow_created':
      return typeof data?.workflowType === 'string' ? `${data.workflowType} workflow created` : 'Workflow created';
    case 'workflow_started':
      return typeof data?.workflowType === 'string' ? `${data.workflowType} workflow started` : 'Workflow started';
    case 'workflow_step_started':
      return typeof data?.step === 'object' && data.step
        ? ((data.step as Record<string, unknown>).title as string) || 'Workflow step started'
        : 'Workflow step started';
    case 'workflow_step_finished':
      return typeof data?.step === 'object' && data.step
        ? ((data.step as Record<string, unknown>).title as string) || 'Workflow step finished'
        : 'Workflow step finished';
    case 'workflow_waiting_for_model_action':
      return typeof data?.detail === 'string' ? data.detail : 'Workflow waiting for model action';
    case 'workflow_waiting_for_tool':
      return typeof data?.detail === 'string' ? data.detail : 'Workflow waiting for tool';
    case 'workflow_waiting_for_approval':
      return typeof data?.detail === 'string' ? data.detail : 'Workflow waiting for approval';
    case 'workflow_verifying':
      return typeof data?.detail === 'string' ? data.detail : 'Workflow verifying';
    case 'workflow_completed':
      return typeof data?.detail === 'string' ? data.detail : 'Workflow completed';
    case 'workflow_blocked':
      return typeof data?.reason === 'string' ? data.reason : 'Workflow blocked';
    case 'workflow_failed':
      return typeof data?.reason === 'string' ? data.reason : 'Workflow failed';
    case 'workflow_cancelled':
      return typeof data?.reason === 'string' ? data.reason : 'Workflow cancelled';
    case 'chat_execution_plan':
      return `Intent ${typeof data?.intent === 'string' ? data.intent : 'unknown'} · ${typeof data?.agentProtocol === 'string' ? data.agentProtocol : 'native_tools'}`;
    case 'model_switch_completed':
      return typeof data?.message === 'string' ? data.message : 'Model switch completed';
    case 'thinking_unsupported':
      return typeof data?.reason === 'string' ? data.reason : 'Thinking unavailable on current model';
    default:
      return formatTraceDataObject(data) || 'Open for payload';
  }
}

export function summarizeWorkflowProgress(workflow: WorkflowLike | undefined): string {
  if (!workflow) {
    return 'No workflow';
  }

  return formatWorkflowProgress(workflow);
}
