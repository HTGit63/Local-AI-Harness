import type { StepProgress, TaskPlan } from '../../types/run';

interface CurrentTaskCardProps {
  plan?: TaskPlan;
  currentStepId?: string;
  progress?: StepProgress;
  phase?: string;
  streamStatus?: string;
  fallbackPath?: string;
  fallbackReason?: string;
}

function formatFallbackPath(path?: string): string {
  switch (path) {
    case 'native_tools':
      return 'native tools';
    case 'native_retry':
      return 'native retry';
    case 'manual_fallback':
      return 'manual fallback';
    case 'manual_repair':
      return 'manual repair';
    case 'final_noop_warning':
      return 'final no-op warning';
    default:
      return 'native tools';
  }
}

export function CurrentTaskCard({ plan, currentStepId, progress, phase, streamStatus, fallbackPath, fallbackReason }: CurrentTaskCardProps) {
  const currentStep = plan?.steps.find((step) => step.id === currentStepId)
    || plan?.steps.find((step) => step.status === 'running')
    || plan?.steps.find((step) => step.status === 'pending');
  const fallbackLabel = formatFallbackPath(fallbackPath);

  return (
    <section className="run-console-section run-console-current">
      <div className="run-console-section-head">
        <span>Current Task</span>
        <span>{plan?.intent || 'idle'}</span>
      </div>
      <h2>{plan?.title || 'No active run'}</h2>
      <p>{plan?.summary || 'Agent Work appears here when a run starts.'}{fallbackReason ? ` · ${fallbackReason}` : ''}</p>
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
        <div>
          <span>Path</span>
          <strong>{fallbackLabel}</strong>
        </div>
      </div>
    </section>
  );
}
