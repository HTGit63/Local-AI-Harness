export interface ModelProfile {
  name: string;
  max_tokens: number;
  temperature: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  thinking?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  images?: string[];
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  reasoning_effort?: 'high' | 'medium' | 'low' | 'none';
  think?: boolean;
  stream?: boolean;
  tools?: any[];
  signal?: AbortSignal;
}

export interface AdapterOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  profile?: 'fast' | 'balanced' | 'deep';
  timeoutMs?: number;
  retries?: number;
}

export interface AvailableModel {
  id: string;
  object?: string;
  owned_by?: string;
  created?: number;
}

export interface RunningModel {
  name: string;
  model: string;
  size?: number;
  digest?: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
  expires_at?: string;
  size_vram?: number;
  context_length?: number;
}

export interface ModelSwitchResult {
  previousModel: string | null;
  requestedModel: string;
  activeModel: string | null;
  runningModels: RunningModel[];
  unloadedModels: string[];
  loadedModel: string | null;
  supportsLifecycle: boolean;
  message: string;
}

export interface ModelActivationOptions {
  keepAlive?: string | number;
  requireActivation?: boolean;
}

export interface HeavyModelLockState {
  held: boolean;
  ownerRunId: string | null;
  queued: number;
}

export interface ModelRouteSelection {
  role: 'fast' | 'agent' | 'coding' | 'review' | 'summary';
  model: string;
  protocol?: 'native_tools' | 'action_dsl' | 'workflow_runner';
  keepAlive?: string | number;
  reason?: string;
}

export interface ModelRuntimeState {
  configuredModel: string;
  activeModel: string | null;
  runningModels: RunningModel[];
  installedModels: string[];
  availableModels: AvailableModel[];
  supportsLifecycle: boolean;
  configuredModelCapabilities?: string[];
  lastSwitchResult?: ModelSwitchResult;
  agentModel?: string;
  summaryModel?: string;
  agentProtocol?: 'native_tools' | 'action_dsl' | 'workflow_runner';
  agentModelActive?: boolean;
  heavyModelLock?: HeavyModelLockState;
  lastRouteSelection?: ModelRouteSelection;
}
