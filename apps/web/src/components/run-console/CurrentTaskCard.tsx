import type { StepProgress, TaskPlan } from '../../types/run';

interface CurrentTaskCardProps {
  plan?: TaskPlan;
  currentStepId?: string;
  progress?: StepProgress;
  phase?: string;
  streamStatus?: string;
}

export function CurrentTaskCard({ plan, currentStepId, progress, phase, streamStatus }: CurrentTaskCardProps) {
  const currentStep = plan?.steps.find((step) => step.id === currentStepId)
    || plan?.steps.find((step) => step.status === 'running')
    || plan?.steps.find((step) => step.status === 'pending');

  return (
    <section className="run-console-section run-console-current">
      <div className="run-console-section-head">
        <span>Current Task</span>
        <span>{plan?.complexity || 'idle'}</span>
      </div>
      <h2>{plan?.title || 'No active run'}</h2>
      <p>{plan?.summary || 'Agentic work appears here when a run starts.'}</p>
      <div className="run-console-metric-strip">
        <div>
          <span>Phase</span>
          <strong>{streamStatus || phase || 'ready'}</strong>
        </div>
        <div>
          <span>Step</span>
          <strong>{currentStep?.title || 'None'}</strong>
        </div>
        <div>
          <span>Done</span>
          <strong>{progress ? `${progress.completed}/${progress.total}` : '0/0'}</strong>
        </div>
      </div>
    </section>
  );
}
