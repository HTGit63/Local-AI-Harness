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
