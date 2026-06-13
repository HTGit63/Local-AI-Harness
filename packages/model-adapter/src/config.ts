import { ModelProfile, AdapterOptions } from './types';
import { buildRuntimeSelectionConfig } from './runtime-config';

export const PROFILES: Record<string, ModelProfile> = {
  fast: {
    name: 'fast',
    max_tokens: 512,
    temperature: 0.1,
  },
  balanced: {
    name: 'balanced',
    max_tokens: 1536,
    temperature: 0.3,
  },
  deep: {
    name: 'deep',
    max_tokens: 2048,
    temperature: 0.6,
  }
};

const defaultRuntimeSelection = buildRuntimeSelectionConfig();

export const DEFAULT_CONFIG: Required<Pick<AdapterOptions, 'provider' | 'baseUrl' | 'apiKey' | 'model' | 'timeoutMs' | 'retries'>> & { profile: 'fast' | 'balanced' | 'deep' } = {
  provider: defaultRuntimeSelection.primary.provider,
  baseUrl: defaultRuntimeSelection.primary.baseUrl,
  apiKey: defaultRuntimeSelection.primary.apiKey,
  model: defaultRuntimeSelection.primary.model,
  profile: 'balanced',
  timeoutMs: 60000,
  retries: 1
};
