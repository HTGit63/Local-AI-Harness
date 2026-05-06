import type { TaskPlan } from '../types/run';

export function getPlanProgress(plan?: TaskPlan) {
  const steps = plan?.steps || [];
  return {
    total: steps.length,
    completed: steps.filter((step) => step.status === 'done').length,
    failed: steps.filter((step) => step.status === 'failed').length,
    blocked: steps.filter((step) => step.status === 'blocked').length,
  };
}
