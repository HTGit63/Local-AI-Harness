import { validateActionDslDocument } from './validator';
import type { ActionDslParseFailure, ActionDslParseResult } from './schema';

type ParseSource = 'json' | 'markdown';
type ActionDslParseCandidate = { ok: true; source: ParseSource; text: string } | ActionDslParseFailure;

function makeError(
  code: ActionDslParseFailure['error']['code'],
  message: string,
  source: ParseSource | 'unknown',
  field?: string,
): ActionDslParseFailure {
  return {
    ok: false,
    source,
    error: {
      code,
      message,
      field,
    },
  };
}

function extractCandidate(input: string): ActionDslParseCandidate {
  const trimmed = input.trim();
  if (!trimmed) {
    return makeError('EMPTY_INPUT', 'Empty Action DSL response.', 'unknown');
  }

  const fences = Array.from(trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi));
  if (fences.length > 0) {
    if (fences.length !== 1) {
      return makeError('MULTIPLE_OBJECTS', 'Expected exactly one fenced JSON block.', 'markdown');
    }

    const fenced = fences[0][0];
    const remaining = trimmed.replace(fenced, '').trim();
    if (remaining.length > 0) {
      return makeError('INVALID_MARKDOWN_WRAPPER', 'Markdown wrapper must contain exactly one JSON object.', 'markdown');
    }

    return {
      ok: true,
      source: 'markdown',
      text: fences[0][1].trim(),
    };
  }

  return {
    ok: true,
    source: 'json',
    text: trimmed,
  };
}

export function parseActionDsl(input: string): ActionDslParseResult {
  const candidate = extractCandidate(input);
  if (!candidate.ok) {
    return candidate;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.text);
  } catch (error) {
    return makeError(
      'INVALID_JSON',
      error instanceof Error ? error.message : 'Invalid JSON.',
      candidate.source,
    );
  }

  if (Array.isArray(parsed)) {
    return makeError('MULTIPLE_OBJECTS', 'Expected one JSON object, not an array of actions.', candidate.source);
  }

  return validateActionDslDocument(parsed, candidate.source);
}
