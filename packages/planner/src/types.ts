import type { TaskComplexity, TaskPlan } from '@local-harness/task-orchestrator';

export interface PlanState {
  taskSummary: string;
  currentPhase: string;
  activeSkills: string[];
  intendedNextAction: string;
  blockers: string[];
  isComplete: boolean;
  finalOutcome?: string;
  workspaceRoot?: string;
  workspaceSource?: 'backend' | 'browser_snapshot';
  workspaceBound?: boolean;
  toolProtocol?: 'native' | 'manual';
  internetAccessEnabled?: boolean;
  contextBudget?: number;
  toolRetryMax?: number;
  sessionMemoryEnabled?: boolean;
  sessionMemoryTurns?: number;
  selfCheckEnabled?: boolean;
  lastStatus?: string;
  currentRunId?: string;
  currentTool?: string;
  taskPlan?: TaskPlan;
  currentStepId?: string;
  complexity?: TaskComplexity;
  stepProgress?: {
    total: number;
    completed: number;
    failed: number;
    blocked: number;
  };
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
  type: 'plan_update' | 'phase_change' | 'action_intent' | 'blocker_added' | 'task_complete' | 'task_plan_update';
  payload: Partial<PlanState>;
}
