import {
  type WorkflowLifecycleStatus,
  type WorkflowRunnerOptions,
  type WorkflowSnapshot,
  type WorkflowState,
  type WorkflowStep,
  type WorkflowStepInput,
  type WorkflowStepStatus,
} from './types';

const TERMINAL_STATUSES = new Set<WorkflowLifecycleStatus>(['completed', 'failed', 'blocked', 'cancelled']);

const ALLOWED_TRANSITIONS: Record<WorkflowLifecycleStatus, WorkflowLifecycleStatus[]> = {
  created: ['started', 'blocked', 'failed', 'cancelled'],
  started: ['step_running', 'waiting_for_model_action', 'waiting_for_tool', 'waiting_for_approval', 'verifying', 'completed', 'failed', 'blocked', 'cancelled'],
  step_running: ['waiting_for_model_action', 'waiting_for_tool', 'waiting_for_approval', 'verifying', 'completed', 'failed', 'blocked', 'cancelled'],
  waiting_for_model_action: ['step_running', 'waiting_for_tool', 'waiting_for_approval', 'verifying', 'completed', 'failed', 'blocked', 'cancelled'],
  waiting_for_tool: ['step_running', 'waiting_for_model_action', 'waiting_for_approval', 'verifying', 'completed', 'failed', 'blocked', 'cancelled'],
  waiting_for_approval: ['step_running', 'waiting_for_model_action', 'waiting_for_tool', 'verifying', 'completed', 'failed', 'blocked', 'cancelled'],
  verifying: ['step_running', 'waiting_for_model_action', 'waiting_for_tool', 'waiting_for_approval', 'completed', 'failed', 'blocked', 'cancelled'],
  completed: [],
  failed: [],
  blocked: [],
  cancelled: [],
};

function cloneStep(step: WorkflowStep): WorkflowStep {
  return { ...step };
}

function cloneState(state: WorkflowState): WorkflowState {
  return {
    ...state,
    steps: state.steps.map((step) => cloneStep(step)),
    filesRead: [...state.filesRead],
    filesChanged: [...state.filesChanged],
    approvals: [...state.approvals],
    commands: [...state.commands],
    errors: [...state.errors],
  };
}

function now(): number {
  return Date.now();
}

function isTerminal(status: WorkflowLifecycleStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export class WorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowTransitionError';
  }
}

export class WorkflowRunner {
  private state: WorkflowState;
  private readonly emitTrace?: (type: string, data: unknown) => void;

  constructor(options: WorkflowRunnerOptions) {
    this.emitTrace = options.emitTrace;
    this.state = options.initialState
      ? cloneState(options.initialState)
      : {
          workflowId: options.workflowId,
          workflowType: options.workflowType,
          runId: options.runId,
          sessionId: options.sessionId,
          workspaceRoot: options.workspaceRoot,
          modelRole: options.modelRole,
          protocol: options.protocol,
          status: 'created',
          currentStepId: null,
          steps: [],
          filesRead: [],
          filesChanged: [],
          approvals: [],
          commands: [],
          errors: [],
          createdAt: now(),
          updatedAt: now(),
        };

    if (options.initialState) {
      this.trace('workflow_restored', {
        workflowId: this.state.workflowId,
        workflowType: this.state.workflowType,
        status: this.state.status,
        currentStepId: this.state.currentStepId,
      });
    } else {
      this.trace('workflow_created', {
        workflowId: this.state.workflowId,
        workflowType: this.state.workflowType,
        runId: this.state.runId,
        sessionId: this.state.sessionId,
      });
    }
  }

  static fromState(state: WorkflowState, emitTrace?: (type: string, data: unknown) => void): WorkflowRunner {
    return new WorkflowRunner({
      workflowId: state.workflowId,
      workflowType: state.workflowType,
      runId: state.runId,
      sessionId: state.sessionId,
      workspaceRoot: state.workspaceRoot,
      modelRole: state.modelRole,
      protocol: state.protocol,
      emitTrace,
      initialState: state,
    });
  }

  snapshot(): WorkflowSnapshot {
    return cloneState(this.state);
  }

  serialize(): string {
    return JSON.stringify(this.snapshot());
  }

  private trace(type: string, data: unknown) {
    this.emitTrace?.(type, data);
    this.emitTrace?.('workflow_state_changed', {
      workflowId: this.state.workflowId,
      workflowType: this.state.workflowType,
      runId: this.state.runId,
      sessionId: this.state.sessionId,
      status: this.state.status,
      currentStepId: this.state.currentStepId,
      data,
      state: this.snapshot(),
    });
  }

  private setStatus(nextStatus: WorkflowLifecycleStatus) {
    const currentStatus = this.state.status;
    if (currentStatus === nextStatus) {
      return;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new WorkflowTransitionError(`Cannot transition workflow from ${currentStatus} to ${nextStatus}.`);
    }

    this.state.status = nextStatus;
    this.state.updatedAt = now();
  }

  private getStep(stepId: string): WorkflowStep {
    const step = this.state.steps.find((entry) => entry.id === stepId);
    if (!step) {
      throw new WorkflowTransitionError(`Workflow step ${stepId} does not exist.`);
    }
    return step;
  }

  start(detail?: string) {
    this.setStatus('started');
    this.trace('workflow_started', {
      workflowId: this.state.workflowId,
      workflowType: this.state.workflowType,
      runId: this.state.runId,
      sessionId: this.state.sessionId,
      detail,
    });
    return this.snapshot();
  }

  startStep(step: WorkflowStepInput) {
    if (this.state.currentStepId) {
      const currentStep = this.getStep(this.state.currentStepId);
      if (currentStep.status === 'running') {
        throw new WorkflowTransitionError(`Workflow already running step ${currentStep.id}. Finish it before starting another.`);
      }
    }

    this.setStatus('step_running');
    const nextStep: WorkflowStep = {
      id: step.id,
      type: step.type,
      title: step.title,
      status: 'running',
      detail: step.detail,
      toolName: step.toolName,
      action: step.action,
      inputSummary: step.inputSummary,
      startedAt: now(),
    };
    this.state.steps.push(nextStep);
    this.state.currentStepId = nextStep.id;
    this.state.updatedAt = now();
    this.trace('workflow_step_started', {
      workflowId: this.state.workflowId,
      step: cloneStep(nextStep),
    });
    return cloneStep(nextStep);
  }

  finishStep(stepId: string, nextStatus: WorkflowStepStatus = 'done', detail?: string, workflowStatus: WorkflowLifecycleStatus = 'waiting_for_model_action') {
    const step = this.getStep(stepId);
    if (step.status !== 'running' && step.status !== 'pending') {
      throw new WorkflowTransitionError(`Workflow step ${stepId} is already ${step.status}.`);
    }

    step.status = nextStatus;
    step.detail = detail ?? step.detail;
    step.endedAt = now();
    this.state.currentStepId = this.state.currentStepId === stepId ? null : this.state.currentStepId;
    this.setStatus(workflowStatus);
    this.trace('workflow_step_finished', {
      workflowId: this.state.workflowId,
      step: cloneStep(step),
      workflowStatus: this.state.status,
    });
    return cloneStep(step);
  }

  waitForModelAction(detail?: string) {
    this.setStatus('waiting_for_model_action');
    this.trace('workflow_waiting_for_model_action', {
      workflowId: this.state.workflowId,
      detail,
    });
    return this.snapshot();
  }

  waitForTool(detail?: string) {
    this.setStatus('waiting_for_tool');
    this.trace('workflow_waiting_for_tool', {
      workflowId: this.state.workflowId,
      detail,
    });
    return this.snapshot();
  }

  waitForApproval(detail?: string) {
    this.setStatus('waiting_for_approval');
    this.trace('workflow_waiting_for_approval', {
      workflowId: this.state.workflowId,
      detail,
    });
    return this.snapshot();
  }

  verify(detail?: string) {
    this.setStatus('verifying');
    this.trace('workflow_verifying', {
      workflowId: this.state.workflowId,
      detail,
    });
    return this.snapshot();
  }

  recordFileRead(filePath: string) {
    if (!this.state.filesRead.includes(filePath)) {
      this.state.filesRead.push(filePath);
    }
    this.state.updatedAt = now();
    return this.snapshot();
  }

  recordFileChanged(filePath: string) {
    if (!this.state.filesChanged.includes(filePath)) {
      this.state.filesChanged.push(filePath);
    }
    this.state.updatedAt = now();
    return this.snapshot();
  }

  recordApproval(approvalId: string) {
    if (!this.state.approvals.includes(approvalId)) {
      this.state.approvals.push(approvalId);
    }
    this.state.updatedAt = now();
    return this.snapshot();
  }

  recordCommand(command: string) {
    if (!this.state.commands.includes(command)) {
      this.state.commands.push(command);
    }
    this.state.updatedAt = now();
    return this.snapshot();
  }

  recordError(error: string) {
    if (!this.state.errors.includes(error)) {
      this.state.errors.push(error);
    }
    this.state.updatedAt = now();
    return this.snapshot();
  }

  complete(detail?: string) {
    this.setStatus('completed');
    this.trace('workflow_completed', {
      workflowId: this.state.workflowId,
      detail,
    });
    return this.snapshot();
  }

  block(reason: string) {
    this.recordError(reason);
    this.setStatus('blocked');
    this.trace('workflow_blocked', {
      workflowId: this.state.workflowId,
      reason,
    });
    return this.snapshot();
  }

  fail(reason: string) {
    this.recordError(reason);
    this.setStatus('failed');
    this.trace('workflow_failed', {
      workflowId: this.state.workflowId,
      reason,
    });
    return this.snapshot();
  }

  cancel(reason?: string) {
    if (reason) {
      this.recordError(reason);
    }
    this.setStatus('cancelled');
    this.trace('workflow_cancelled', {
      workflowId: this.state.workflowId,
      reason,
    });
    return this.snapshot();
  }

  isTerminal(): boolean {
    return isTerminal(this.state.status);
  }
}
