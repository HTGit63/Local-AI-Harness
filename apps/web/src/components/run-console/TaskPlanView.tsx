import type { TaskPlan } from '../../types/run';
import { TaskStepList } from './TaskStepList';

interface TaskPlanViewProps {
  plan?: TaskPlan;
  currentStepId?: string;
}

export function TaskPlanView({ plan, currentStepId }: TaskPlanViewProps) {
  return (
    <section className="run-console-section">
      <div className="run-console-section-head">
        <span>{plan?.adaptivePlan ? 'Adaptive Plan' : 'Step Checklist'}</span>
        <span>{plan ? `${plan.steps.filter((step) => step.status === 'done').length}/${plan.steps.length}` : '0/0'}</span>
      </div>
      {plan?.adaptivePlan && (
        <div className="empty-note">
          {plan.adaptivePlan.planner || 'ai'} · {plan.adaptivePlan.complexity}
          {plan.planArtifactPaths?.json ? ` · ${plan.planArtifactPaths.json}` : ''}
        </div>
      )}
      <TaskStepList plan={plan} currentStepId={currentStepId} />
    </section>
  );
}
