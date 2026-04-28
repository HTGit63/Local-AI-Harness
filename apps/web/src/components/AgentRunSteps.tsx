export interface AgentRunStepData {
  id: string;
  type: string;
  title: string;
  detail?: string;
  status: 'running' | 'done' | 'error' | 'skipped';
  toolName?: string;
  toolInputSummary?: string;
  toolOutputPreview?: string;
  command?: string;
}

export function AgentRunSteps({ steps }: { steps: AgentRunStepData[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="tool-execution-tracker">
      <div className="tool-tracker-header">
        <span>Run Steps</span>
      </div>
      <div className="tool-tracker-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`tool-tracker-step tool-tracker-step-${step.status} ${step.status === 'running' ? 'active' : ''} ${step.status === 'done' ? 'done' : ''}`}
          >
            <span className={`tool-badge ${
              step.status === 'error'
                ? 'tool-badge-danger'
                : step.type === 'tool'
                  ? 'tool-badge-read'
                  : 'tool-badge-system'
            }`}>
              {step.type.toUpperCase()}
            </span>
            <span>
              {step.title}
              {step.toolInputSummary ? ` · ${step.toolInputSummary}` : ''}
              {step.command ? ` · ${step.command}` : ''}
              {step.detail ? ` · ${step.detail}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
