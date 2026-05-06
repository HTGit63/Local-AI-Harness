import type { RunCheckpoint } from '../types/run';

export function getCheckpointStepCounts(checkpoint: RunCheckpoint | null) {
  return {
    completed: checkpoint?.completedSteps.length || 0,
    failed: checkpoint?.failedSteps.length || 0,
    blocked: checkpoint?.blockedSteps.length || 0,
  };
}
