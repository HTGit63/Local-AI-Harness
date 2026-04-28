export interface ApiErrorPayload {
  error: string;
}

export interface HealthPayload {
  status: 'ok' | 'degraded' | 'offline';
}
