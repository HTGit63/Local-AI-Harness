import { RunConsole } from '../../components/run-console/RunConsole';
import type { RunApprovalItem, RunTraceEntry, StepProgress, StructuredDiff, TaskPlan } from '../../types/run';

type RunConsoleProps = {
  plan?: TaskPlan;
  currentStepId?: string;
  progress?: StepProgress;
  phase?: string;
  currentTool?: string;
  streamStatus?: string;
  fallbackPath?: string;
  fallbackReason?: string;
  traces: RunTraceEntry[];
  approvals: RunApprovalItem[];
  gitDiff: string;
  structuredDiff?: StructuredDiff | null;
  checkpointIds: string[];
  onResolveApproval: (id: string, approved: boolean) => void;
};

export function AgentRunConsole(props: RunConsoleProps) {
  return <RunConsole {...props} />;
}
