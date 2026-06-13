import { AdapterOptions, RuntimeProvider } from './types';

export interface RuntimeEndpointConfig {
  provider: RuntimeProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  modelPath?: string;
  modelAlias?: string;
  isPrimary: boolean;
  isFallback: boolean;
}

export interface RuntimeSelectionConfig {
  primary: RuntimeEndpointConfig;
  fallback?: RuntimeEndpointConfig;
  fallbackEnabled: boolean;
  healthCheckTimeoutMs: number;
}

export const DEFAULT_LLAMA_CPP_BASE_URL = 'http://127.0.0.1:8080/v1';
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1';
export const DEFAULT_LLAMA_CPP_MODEL = 'gemma4:e4b';
export const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b';

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

function normalizeProvider(value: unknown, fallback: RuntimeProvider): RuntimeProvider {
  return value === 'llamacpp' || value === 'ollama-legacy' || value === 'openai-compatible'
    ? value
    : fallback;
}

function clean(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function buildRuntimeSelectionConfig(options: Partial<AdapterOptions> = {}): RuntimeSelectionConfig {
  const primaryProvider = normalizeProvider(
    options.primaryProvider ?? options.provider ?? process.env.HARNESS_PRIMARY_RUNTIME ?? process.env.HARNESS_RUNTIME_PROVIDER,
    'llamacpp',
  );
  const fallbackProvider = normalizeProvider(
    options.fallbackProvider ?? process.env.HARNESS_FALLBACK_RUNTIME,
    'ollama-legacy',
  );
  const llamaModelAlias = clean(options.modelAlias) ?? clean(process.env.LLAMACPP_MODEL_ALIAS);
  const primaryModel = clean(options.primaryModel)
    ?? clean(options.model)
    ?? clean(process.env.HARNESS_MODEL)
    ?? llamaModelAlias
    ?? DEFAULT_LLAMA_CPP_MODEL;
  const fallbackModel = clean(options.fallbackModel)
    ?? clean(process.env.OLLAMA_MODEL)
    ?? DEFAULT_OLLAMA_MODEL;
  const primaryBaseUrl = clean(options.primaryBaseUrl)
    ?? clean(options.baseUrl)
    ?? clean(process.env.LLAMACPP_BASE_URL)
    ?? clean(process.env.OPENAI_BASE_URL)
    ?? DEFAULT_LLAMA_CPP_BASE_URL;
  const fallbackBaseUrl = clean(options.fallbackBaseUrl)
    ?? clean(process.env.OLLAMA_BASE_URL)
    ?? DEFAULT_OLLAMA_BASE_URL;

  const fallbackEnabled = options.fallbackEnabled ?? envFlag('HARNESS_ENABLE_OLLAMA_FALLBACK', true);
  const healthCheckTimeoutMs = Math.max(
    1000,
    Math.min(10_000, Number(options.healthCheckTimeoutMs ?? process.env.HARNESS_RUNTIME_HEALTH_TIMEOUT_MS ?? 5000)),
  );

  return {
    primary: {
      provider: primaryProvider,
      baseUrl: primaryBaseUrl,
      apiKey: clean(options.primaryApiKey) ?? clean(options.apiKey) ?? clean(process.env.LLAMACPP_API_KEY) ?? clean(process.env.OPENAI_API_KEY) ?? 'no-key',
      model: primaryModel,
      modelPath: clean(options.modelPath) ?? clean(process.env.LLAMACPP_MODEL_PATH),
      modelAlias: llamaModelAlias,
      isPrimary: true,
      isFallback: false,
    },
    fallback: fallbackEnabled ? {
      provider: fallbackProvider,
      baseUrl: fallbackBaseUrl,
      apiKey: clean(options.fallbackApiKey) ?? clean(process.env.OLLAMA_API_KEY) ?? 'ollama',
      model: fallbackModel,
      isPrimary: false,
      isFallback: true,
    } : undefined,
    fallbackEnabled,
    healthCheckTimeoutMs,
  };
}
