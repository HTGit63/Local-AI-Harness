import type { TaskPlan } from '../../types/run';

interface TaskStepListProps {
  plan?: TaskPlan;
  currentStepId?: string;
}

export function TaskStepList({ plan, currentStepId }: TaskStepListProps) {
  if (!plan) {
    return <div className="empty-note">No task plan yet</div>;
  }

  return (
    <div className="task-step-list">
      {plan.steps.map((step) => (
        <div key={step.id} className={`task-step-row task-step-row-${step.status} ${step.id === currentStepId ? 'task-step-row-active' : ''}`}>
          <span className="task-step-status">{step.status}</span>
          <div className="task-step-body">
            <strong>{step.title}</strong>
            <span>{step.detail || step.error || step.successCriteria[0] || step.type}</span>
            {step.files?.length ? (
              <code>{step.files.slice(0, 3).join(', ')}{step.files.length > 3 ? ` +${step.files.length - 3}` : ''}</code>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
