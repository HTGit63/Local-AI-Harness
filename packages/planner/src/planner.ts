export interface TraceBus { emitEvent(event: any): void; }
import { PlanState } from './types';
import type { TaskPlan, TaskStep } from '@local-harness/task-orchestrator';

export class Planner {
  private traceBus: TraceBus;
  private state: PlanState;

  constructor(traceBus: TraceBus) {
    this.traceBus = traceBus;
    this.state = {
      taskSummary: 'Initializing...',
      currentPhase: 'setup',
      activeSkills: [],
      intendedNextAction: 'Awaiting instructions',
      blockers: [],
      isComplete: false
    };
  }

  private emitStateChange(type: 'plan_update' | 'phase_change' | 'action_intent' | 'blocker_added' | 'task_complete' | 'task_plan_update', diff: Partial<PlanState>) {
    this.state = { ...this.state, ...diff };
    this.traceBus.emitEvent({
      type: 'planner_trace' as any, // Mapped to general trace bus event
      data: {
        eventType: type,
        state: this.state
      }
    });
  }

  setTaskSummary(summary: string) {
    this.emitStateChange('plan_update', { taskSummary: summary });
  }

  setPhase(phase: string) {
    this.emitStateChange('phase_change', { currentPhase: phase });
  }

  setActiveSkills(skills: string[]) {
    this.emitStateChange('plan_update', { activeSkills: skills });
  }

  setRuntimeContext(
    patch: Partial<
      Pick<
        PlanState,
        | 'workspaceRoot'
        | 'workspaceSource'
        | 'workspaceBound'
        | 'toolProtocol'
        | 'skillAudit'
        | 'internetAccessEnabled'
        | 'contextBudget'
        | 'toolRetryMax'
        | 'sessionMemoryEnabled'
        | 'sessionMemoryTurns'
        | 'selfCheckEnabled'
        | 'executionProfile'
        | 'promptProfile'
        | 'fallbackPath'
        | 'fallbackReason'
        | 'fallbackCount'
        | 'taskPlan'
        | 'currentStepId'
        | 'complexity'
        | 'stepProgress'
      >
    >,
  ) {
    this.emitStateChange('plan_update', patch);
  }

  setStatusNote(status: string) {
    this.emitStateChange('plan_update', { lastStatus: status });
  }

  startRun(runId: string) {
    this.emitStateChange('plan_update', {
      currentRunId: runId,
      runSteps: [],
      runSummary: undefined,
      currentTool: undefined,
      taskPlan: undefined,
      currentStepId: undefined,
      complexity: undefined,
      stepProgress: undefined,
    });
    this.traceBus.emitEvent({
      type: 'run_started',
      data: { runId },
    });
  }

  setTaskPlan(runId: string, taskPlan: TaskPlan) {
    this.emitStateChange('task_plan_update', {
      taskPlan,
      complexity: taskPlan.complexity,
      currentStepId: taskPlan.steps.find((entry) => entry.status === 'running')?.id,
      stepProgress: this.computeStepProgress(taskPlan),
    });
    this.traceBus.emitEvent({
      type: 'task_plan_created',
      data: { runId, plan: taskPlan },
    });
  }

  updateTaskPlan(runId: string, taskPlan: TaskPlan) {
    this.emitStateChange('task_plan_update', {
      taskPlan,
      complexity: taskPlan.complexity,
      currentStepId: taskPlan.steps.find((entry) => entry.status === 'running')?.id,
      stepProgress: this.computeStepProgress(taskPlan),
    });
    if (taskPlan.completedAt) {
      this.traceBus.emitEvent({
        type: 'task_plan_completed',
        data: { runId, plan: taskPlan },
      });
    }
  }

  markTaskStepStarted(runId: string, taskPlan: TaskPlan, step: TaskStep) {
    this.emitStateChange('task_plan_update', {
      taskPlan,
      currentStepId: step.id,
      complexity: taskPlan.complexity,
      stepProgress: this.computeStepProgress(taskPlan),
      currentPhase: step.type,
      intendedNextAction: step.title,
    });
    this.traceBus.emitEvent({
      type: 'task_step_started',
      data: { runId, step },
    });
  }

  markTaskStepCompleted(runId: string, taskPlan: TaskPlan, step: TaskStep) {
    this.emitStateChange('task_plan_update', {
      taskPlan,
      currentStepId: taskPlan.steps.find((entry) => entry.status === 'running')?.id,
      complexity: taskPlan.complexity,
      stepProgress: this.computeStepProgress(taskPlan),
      currentPhase: step.type,
      intendedNextAction: step.title,
    });
    this.traceBus.emitEvent({
      type: 'task_step_completed',
      data: { runId, step },
    });
  }

  markTaskStepFailed(runId: string, taskPlan: TaskPlan, step: TaskStep, error: string) {
    this.emitStateChange('task_plan_update', {
      taskPlan,
      currentStepId: step.id,
      complexity: taskPlan.complexity,
      stepProgress: this.computeStepProgress(taskPlan),
      currentPhase: step.type,
      intendedNextAction: step.title,
    });
    this.traceBus.emitEvent({
      type: 'task_step_failed',
      data: { runId, step, error },
    });
  }

  markTaskStepBlocked(runId: string, taskPlan: TaskPlan, step: TaskStep, reason: string) {
    this.emitStateChange('task_plan_update', {
      taskPlan,
      currentStepId: step.id,
      complexity: taskPlan.complexity,
      stepProgress: this.computeStepProgress(taskPlan),
      currentPhase: step.type,
      intendedNextAction: step.title,
    });
    this.traceBus.emitEvent({
      type: 'task_step_blocked',
      data: { runId, step, reason },
    });
  }

  emitTaskCheckpoint(runId: string, checkpointPath?: string) {
    this.traceBus.emitEvent({
      type: 'task_checkpoint_saved',
      data: { runId, checkpointPath },
    });
  }

  emitTaskBudgetExceeded(runId: string, budgetType: string) {
    this.traceBus.emitEvent({
      type: 'task_budget_exceeded',
      data: { runId, budgetType },
    });
  }

  upsertRunStep(step: {
    id: string;
    type: string;
    title: string;
    status: 'running' | 'done' | 'error' | 'skipped';
    detail?: string;
    toolName?: string;
  }) {
    const currentSteps = this.state.runSteps ?? [];
    const nextSteps = currentSteps.filter((entry) => entry.id !== step.id).concat(step);
    this.emitStateChange('plan_update', { runSteps: nextSteps });
    this.traceBus.emitEvent({
      type: step.status === 'running' ? 'run_step_started' : 'run_step_finished',
      data: {
        runId: this.state.currentRunId,
        step,
      },
    });
  }

  setCurrentTool(toolName?: string) {
    this.emitStateChange('plan_update', { currentTool: toolName });
  }

  setRunSummary(summary: {
    id: string;
    summary?: string;
    changedFiles?: number;
    addedLines?: number;
    removedLines?: number;
  }) {
    this.emitStateChange('plan_update', { runSummary: summary, currentTool: undefined });
    this.traceBus.emitEvent({
      type: 'run_summary_ready',
      data: summary,
    });
  }

  failRun(error: string) {
    this.emitStateChange('plan_update', { currentTool: undefined });
    this.traceBus.emitEvent({
      type: 'run_failed',
      data: {
        runId: this.state.currentRunId,
        error,
      },
    });
  }

  setIntendedAction(action: string) {
    this.emitStateChange('action_intent', { intendedNextAction: action });
  }

  addBlocker(blocker: string) {
    this.emitStateChange('blocker_added', { 
      blockers: [...this.state.blockers, blocker] 
    });
  }

  clearBlockers() {
    this.emitStateChange('plan_update', { blockers: [] });
  }

  completeTask(outcome: string) {
    this.emitStateChange('task_complete', { 
      isComplete: true, 
      finalOutcome: outcome,
      intendedNextAction: 'Done'
    });
  }

  getState(): PlanState {
    return { ...this.state };
  }

  private computeStepProgress(taskPlan: TaskPlan) {
    return {
      total: taskPlan.steps.length,
      completed: taskPlan.steps.filter((entry) => entry.status === 'done' || entry.status === 'skipped').length,
      failed: taskPlan.steps.filter((entry) => entry.status === 'failed').length,
      blocked: taskPlan.steps.filter((entry) => entry.status === 'blocked').length,
    };
  }
}
