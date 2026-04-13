export interface PlanState {
  taskSummary: string;
  currentPhase: string;
  activeSkills: string[];
  intendedNextAction: string;
  blockers: string[];
  isComplete: boolean;
  finalOutcome?: string;
}

export interface PlannerTraceEvent {
  type: 'plan_update' | 'phase_change' | 'action_intent' | 'blocker_added' | 'task_complete';
  payload: Partial<PlanState>;
}
