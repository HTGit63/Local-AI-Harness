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
export const DEFAULT_LLAMA_CPP_MODEL = 'gemma-4-gguf';
export const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b-it-qat';

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

function defaultModelForProvider(provider: RuntimeProvider, options: Partial<AdapterOptions>, llamaModelAlias?: string): string {
  if (provider === 'ollama-legacy') {
    return clean(options.primaryModel)
      ?? clean(options.model)
      ?? clean(process.env.HARNESS_MODEL)
      ?? clean(process.env.OLLAMA_MODEL)
      ?? DEFAULT_OLLAMA_MODEL;
  }

  return clean(options.primaryModel)
    ?? clean(options.model)
    ?? clean(process.env.HARNESS_MODEL)
    ?? llamaModelAlias
    ?? DEFAULT_LLAMA_CPP_MODEL;
}

function defaultBaseUrlForProvider(provider: RuntimeProvider, options: Partial<AdapterOptions>): string {
  if (provider === 'ollama-legacy') {
    return clean(options.primaryBaseUrl)
      ?? clean(options.baseUrl)
      ?? clean(process.env.OLLAMA_BASE_URL)
      ?? clean(process.env.OPENAI_BASE_URL)
      ?? DEFAULT_OLLAMA_BASE_URL;
  }

  return clean(options.primaryBaseUrl)
    ?? clean(options.baseUrl)
    ?? clean(process.env.LLAMACPP_BASE_URL)
    ?? clean(process.env.OPENAI_BASE_URL)
    ?? DEFAULT_LLAMA_CPP_BASE_URL;
}

function defaultApiKeyForProvider(provider: RuntimeProvider, options: Partial<AdapterOptions>): string {
  if (provider === 'ollama-legacy') {
    return clean(options.primaryApiKey)
      ?? clean(options.apiKey)
      ?? clean(process.env.OLLAMA_API_KEY)
      ?? clean(process.env.OPENAI_API_KEY)
      ?? 'ollama';
  }

  return clean(options.primaryApiKey)
    ?? clean(options.apiKey)
    ?? clean(process.env.LLAMACPP_API_KEY)
    ?? clean(process.env.OPENAI_API_KEY)
    ?? 'no-key';
}

export function buildRuntimeSelectionConfig(options: Partial<AdapterOptions> = {}): RuntimeSelectionConfig {
  const primaryProvider = normalizeProvider(
    options.primaryProvider ?? options.provider ?? process.env.HARNESS_PRIMARY_RUNTIME ?? process.env.HARNESS_RUNTIME_PROVIDER,
    'ollama-legacy',
  );
  const fallbackProvider = normalizeProvider(
    options.fallbackProvider ?? process.env.HARNESS_FALLBACK_RUNTIME,
    primaryProvider === 'llamacpp' ? 'ollama-legacy' : 'llamacpp',
  );
  const llamaModelAlias = clean(options.modelAlias) ?? clean(process.env.LLAMACPP_MODEL_ALIAS);
  const primaryModel = defaultModelForProvider(primaryProvider, options, llamaModelAlias);
  const fallbackModel = clean(options.fallbackModel)
    ?? (fallbackProvider === 'ollama-legacy'
      ? clean(process.env.OLLAMA_MODEL) ?? DEFAULT_OLLAMA_MODEL
      : llamaModelAlias ?? DEFAULT_LLAMA_CPP_MODEL);
  const primaryBaseUrl = defaultBaseUrlForProvider(primaryProvider, options);
  const fallbackBaseUrl = clean(options.fallbackBaseUrl)
    ?? (fallbackProvider === 'ollama-legacy'
      ? clean(process.env.OLLAMA_BASE_URL) ?? DEFAULT_OLLAMA_BASE_URL
      : clean(process.env.LLAMACPP_BASE_URL) ?? DEFAULT_LLAMA_CPP_BASE_URL);

  const fallbackEnabled = options.fallbackEnabled ?? envFlag('HARNESS_ENABLE_OLLAMA_FALLBACK', true);
  const healthCheckTimeoutMs = Math.max(
    1000,
    Math.min(10_000, Number(options.healthCheckTimeoutMs ?? process.env.HARNESS_RUNTIME_HEALTH_TIMEOUT_MS ?? 5000)),
  );

  return {
    primary: {
      provider: primaryProvider,
      baseUrl: primaryBaseUrl,
      apiKey: defaultApiKeyForProvider(primaryProvider, options),
      model: primaryModel,
      modelPath: primaryProvider === 'llamacpp' ? clean(options.modelPath) ?? clean(process.env.LLAMACPP_MODEL_PATH) : undefined,
      modelAlias: primaryProvider === 'llamacpp' ? llamaModelAlias : undefined,
      isPrimary: true,
      isFallback: false,
    },
    fallback: fallbackEnabled ? {
      provider: fallbackProvider,
      baseUrl: fallbackBaseUrl,
      apiKey: clean(options.fallbackApiKey)
        ?? (fallbackProvider === 'ollama-legacy'
          ? clean(process.env.OLLAMA_API_KEY) ?? 'ollama'
          : clean(process.env.LLAMACPP_API_KEY) ?? clean(process.env.OPENAI_API_KEY) ?? 'no-key'),
      model: fallbackModel,
      modelPath: fallbackProvider === 'llamacpp' ? clean(options.modelPath) ?? clean(process.env.LLAMACPP_MODEL_PATH) : undefined,
      modelAlias: fallbackProvider === 'llamacpp' ? llamaModelAlias : undefined,
      isPrimary: false,
      isFallback: true,
    } : undefined,
    fallbackEnabled,
    healthCheckTimeoutMs,
  };
}
