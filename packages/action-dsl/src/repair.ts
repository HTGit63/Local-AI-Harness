import type { ActionDslParseFailure } from './schema';

function formatError(failure: ActionDslParseFailure): string {
  const field = failure.error.field ? ` (field: ${failure.error.field})` : '';
  return `${failure.error.code}: ${failure.error.message}${field}`;
}

function trimPreviousResponse(previousResponse: string, maxChars = 1200): string {
  const normalized = previousResponse.trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}\n[truncated]`;
}

export function buildActionDslRepairPrompt(
  failure: ActionDslParseFailure,
  previousResponse: string,
  allowedActions: string[] = [],
): string {
  const lines = [
    'Action DSL parse failed.',
    `Parser error: ${formatError(failure)}`,
    allowedActions.length > 0 ? `Allowed actions: ${allowedActions.join(', ')}` : null,
    'Return exactly one JSON object and nothing else.',
    'Use one of:',
    '{"kind":"action","action":"read_file","args":{"path":"src/index.ts"}}',
    '{"kind":"final","summary":"short answer","filesChanged":[],"verification":"what you checked"}',
    '{"kind":"blocker","reason":"why blocked","nextSafeStep":"smallest safe next step"}',
    'Previous response:',
    trimPreviousResponse(previousResponse),
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

export function summarizeActionDslFailure(failure: ActionDslParseFailure): string {
  return formatError(failure);
}
