import { ModelProfile, AdapterOptions } from './types';

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

export const DEFAULT_CONFIG: Required<Omit<AdapterOptions, 'profile'>> & { profile: 'fast' | 'balanced' | 'deep' } = {
  baseUrl: process.env.OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1',
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  model: process.env.HARNESS_MODEL || 'gemma4:e4b',
  profile: 'fast',
  timeoutMs: 60000,
  retries: 1
};
