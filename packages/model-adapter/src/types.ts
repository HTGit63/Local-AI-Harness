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

export type RuntimeProvider = 'llamacpp' | 'ollama-legacy' | 'openai-compatible';
export type RuntimeEndpointHealth = 'connected' | 'unavailable' | 'offline';

export interface AdapterOptions {
  provider?: RuntimeProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  profile?: 'fast' | 'balanced' | 'deep';
  timeoutMs?: number;
  retries?: number;
  primaryProvider?: RuntimeProvider;
  primaryBaseUrl?: string;
  primaryApiKey?: string;
  primaryModel?: string;
  fallbackProvider?: RuntimeProvider;
  fallbackBaseUrl?: string;
  fallbackApiKey?: string;
  fallbackModel?: string;
  fallbackEnabled?: boolean;
  modelPath?: string;
  modelAlias?: string;
  healthCheckTimeoutMs?: number;
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

export interface ModelLifecyclePolicy {
  preloadKeepAlive: string;
  unloadKeepAlive: number;
  chatTimeoutMs: number;
  preloadTimeoutMs: number;
  unloadTimeoutMs: number;
}

export interface RuntimeEndpointStatus {
  provider: RuntimeProvider;
  baseUrl: string;
  model: string;
  availableModels?: AvailableModel[];
  modelPath?: string;
  modelAlias?: string;
  status: RuntimeEndpointHealth;
  isPrimary: boolean;
  isFallback: boolean;
  warning?: string;
  error?: string;
  checkedAt: number;
}

export interface ModelRuntimeState {
  provider: RuntimeProvider;
  baseUrl: string;
  activeProvider: RuntimeProvider;
  activeBaseUrl: string;
  configuredModel: string;
  activeModel: string | null;
  runtimeStatus: 'ready' | 'idle' | 'configured_not_loaded' | 'unavailable';
  statusMessage: string;
  primaryRuntime: RuntimeEndpointStatus;
  fallbackRuntime?: RuntimeEndpointStatus;
  fallbackEnabled: boolean;
  fallbackWarning?: string;
  modelPath?: string;
  modelAlias?: string;
  runningModels: RunningModel[];
  installedModels: string[];
  availableModels: AvailableModel[];
  supportsLifecycle: boolean;
  lifecyclePolicy: ModelLifecyclePolicy;
  reasoningSupported?: boolean;
  nativeToolCallingSupported?: boolean;
  configuredModelCapabilities?: string[];
  lastSwitchResult?: ModelSwitchResult;
}
