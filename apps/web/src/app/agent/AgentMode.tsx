import { useAgentModeController, type AgentModeProps } from './hooks/useAgentModeController';

export function AgentMode(props: AgentModeProps) {
  return useAgentModeController(props);
}

export default AgentMode;
