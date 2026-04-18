export interface TraceBus { emitEvent(event: any): void; }
import { PlanState } from './types';

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

  private emitStateChange(type: 'plan_update' | 'phase_change' | 'action_intent' | 'blocker_added' | 'task_complete', diff: Partial<PlanState>) {
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

  startRun(runId: string) {
    this.emitStateChange('plan_update', {
      currentRunId: runId,
      runSteps: [],
      runSummary: undefined,
      currentTool: undefined,
    });
    this.traceBus.emitEvent({
      type: 'run_started',
      data: { runId },
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
}
