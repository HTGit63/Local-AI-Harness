import { ModelProfile, AdapterOptions } from './types';
export declare const PROFILES: Record<string, ModelProfile>;
export declare const DEFAULT_CONFIG: Required<Omit<AdapterOptions, 'profile'>> & {
    profile: 'fast' | 'balanced' | 'deep';
};
