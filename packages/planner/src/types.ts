export interface PlanState {
  taskSummary: string;
  currentPhase: string;
  activeSkills: string[];
  intendedNextAction: string;
  blockers: string[];
  isComplete: boolean;
  finalOutcome?: string;
  currentRunId?: string;
  currentTool?: string;
  runSteps?: Array<{
    id: string;
    type: string;
    title: string;
    status: 'running' | 'done' | 'error' | 'skipped';
    detail?: string;
    toolName?: string;
  }>;
  runSummary?: {
    id: string;
    summary?: string;
    changedFiles?: number;
    addedLines?: number;
    removedLines?: number;
  };
}

export interface PlannerTraceEvent {
  type: 'plan_update' | 'phase_change' | 'action_intent' | 'blocker_added' | 'task_complete';
  payload: Partial<PlanState>;
}
