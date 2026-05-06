import {
  ACTION_DSL_TOOL_NAMES,
  type ActionDslAction,
  type ActionDslBlocker,
  type ActionDslDocument,
  type ActionDslFinalAnswer,
  type ActionDslParseFailure,
  type ActionDslParseResult,
  type ActionDslToolName,
} from './schema';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function makeError(
  code: ActionDslParseFailure['error']['code'],
  message: string,
  source: ActionDslParseFailure['source'],
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

function toTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value
    .map((entry) => toTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return values;
}

function coerceField(args: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = toTrimmedString(args[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeToolName(actionName: string): ActionDslToolName | null {
  if (ACTION_DSL_TOOL_NAMES.includes(actionName as ActionDslToolName)) {
    return actionName as ActionDslToolName;
  }

  const normalized = actionName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const aliases: Record<string, ActionDslToolName> = {
    created_file: 'apply_approved_change',
    create_file: 'apply_approved_change',
    createfile: 'apply_approved_change',
    write_file: 'apply_approved_change',
    writefile: 'apply_approved_change',
    readfile: 'read_file',
    listdir: 'list_dir',
    searchtext: 'search_text',
    runcommand: 'run_selected_command',
  };

  return aliases[normalized] ?? null;
}

function coerceToolArgs(action: ActionDslToolName, args: Record<string, unknown>, source: 'json' | 'markdown'): ActionDslParseResult<ActionDslAction> {
  switch (action) {
    case 'list_dir': {
      const path = coerceField(args, ['path', 'dirPath', 'filePath']);
      if (!path) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "path" for list_dir.', source, 'path');
      }
      return { ok: true, source, value: { kind: 'action', action, args: { path } } };
    }
    case 'read_file': {
      const path = coerceField(args, ['path', 'filePath']);
      if (!path) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "path" for read_file.', source, 'path');
      }
      return { ok: true, source, value: { kind: 'action', action, args: { path } } };
    }
    case 'search_text': {
      const query = coerceField(args, ['query', 'text', 'needle']);
      if (!query) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "query" for search_text.', source, 'query');
      }
      const path = coerceField(args, ['path', 'filePattern', 'pattern', 'filePath']);
      return { ok: true, source, value: { kind: 'action', action, args: path ? { query, path } : { query } } };
    }
    case 'glob': {
      const pattern = coerceField(args, ['pattern', 'path', 'filePattern']);
      if (!pattern) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "pattern" for glob.', source, 'pattern');
      }
      return { ok: true, source, value: { kind: 'action', action, args: { pattern } } };
    }
    case 'propose_patch': {
      const path = coerceField(args, ['path', 'filePath']);
      const oldText = toTrimmedString(args.oldText) ?? toTrimmedString(args.old_content);
      const newText = toTrimmedString(args.newText) ?? toTrimmedString(args.new_content);
      if (!path) {
        return makeError('MISSING_REQUIRED_ARGUMENT', `Missing required argument "path" for ${action}.`, source, 'path');
      }
      if (!oldText) {
        return makeError('MISSING_REQUIRED_ARGUMENT', `Missing required argument "oldText" for ${action}.`, source, 'oldText');
      }
      if (!newText) {
        return makeError('MISSING_REQUIRED_ARGUMENT', `Missing required argument "newText" for ${action}.`, source, 'newText');
      }
      return { ok: true, source, value: { kind: 'action', action, args: { path, oldText, newText } } };
    }
    case 'write_file_preview': {
      const path = coerceField(args, ['path', 'filePath']);
      const content = toTrimmedString(args.content);
      if (!path) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "path" for write_file_preview.', source, 'path');
      }
      if (!content) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "content" for write_file_preview.', source, 'content');
      }
      return { ok: true, source, value: { kind: 'action', action, args: { path, content } } };
    }
    case 'apply_approved_change': {
      const path = coerceField(args, ['path', 'filePath']);
      if (!path) {
        return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "path" for apply_approved_change.', source, 'path');
      }
      const content = toTrimmedString(args.content);
      const oldText = toTrimmedString(args.oldText) ?? toTrimmedString(args.old_content);
      const newText = toTrimmedString(args.newText) ?? toTrimmedString(args.new_content);
      if (!content && (!oldText || !newText)) {
        return makeError(
          'MISSING_REQUIRED_ARGUMENT',
          'apply_approved_change needs either "content" or both "oldText" and "newText".',
          source,
          'content',
        );
      }
      const normalized: Record<string, unknown> = { path };
      if (content) {
        normalized.content = content;
      }
      if (oldText) {
        normalized.oldText = oldText;
      }
      if (newText) {
        normalized.newText = newText;
      }
      return { ok: true, source, value: { kind: 'action', action, args: normalized as unknown as ActionDslAction['args'] } };
    }
    case 'run_command_preview':
    case 'run_selected_command': {
      const command = coerceField(args, ['command']);
      if (!command) {
        return makeError('MISSING_REQUIRED_ARGUMENT', `Missing required argument "command" for ${action}.`, source, 'command');
      }
      return { ok: true, source, value: { kind: 'action', action, args: { command } } };
    }
    default:
      return makeError('UNKNOWN_ACTION', `Unknown action "${String(action)}".`, source);
  }
}

function validateControlEnvelope(
  kind: 'final' | 'blocker',
  raw: Record<string, unknown>,
  source: 'json' | 'markdown',
): ActionDslParseResult<ActionDslFinalAnswer | ActionDslBlocker> {
  if (kind === 'final') {
    const summary = coerceField(raw, ['summary', 'final', 'answer', 'response']);
    const verification = coerceField(raw, ['verification', 'verify']);
    const filesChanged = toStringArray(raw.filesChanged ?? raw.files_changed) ?? [];
    if (!summary) {
      return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "summary" for final answer.', source, 'summary');
    }
    if (!verification) {
      return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "verification" for final answer.', source, 'verification');
    }
    return { ok: true, source, value: { kind: 'final', summary, filesChanged, verification } };
  }

  const reason = coerceField(raw, ['reason']);
  const nextSafeStep = coerceField(raw, ['nextSafeStep', 'next_safe_step']);
  if (!reason) {
    return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "reason" for blocker.', source, 'reason');
  }
  if (!nextSafeStep) {
    return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "nextSafeStep" for blocker.', source, 'nextSafeStep');
  }
  return { ok: true, source, value: { kind: 'blocker', reason, nextSafeStep } };
}

export function validateActionDslDocument(raw: unknown, source: 'json' | 'markdown' = 'json'): ActionDslParseResult {
  if (!isRecord(raw)) {
    return makeError('NOT_AN_OBJECT', 'Expected one JSON object.', source);
  }

  const kind = toTrimmedString(raw.kind);
  const actionName = toTrimmedString(raw.action);

  if (!kind && !actionName) {
    return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required "kind" or "action" field.', source, 'kind');
  }

  if (kind === 'final' || actionName === 'final_answer') {
    return validateControlEnvelope('final', raw, source);
  }

  if (kind === 'blocker' || actionName === 'blocker') {
    return validateControlEnvelope('blocker', raw, source);
  }

  if (kind !== 'action') {
    return makeError('INVALID_ARGUMENT_TYPE', `Unsupported kind "${kind || 'missing'}".`, source, 'kind');
  }

  if (!actionName) {
    return makeError('MISSING_REQUIRED_ARGUMENT', 'Missing required argument "action" for action envelope.', source, 'action');
  }

  const normalizedAction = normalizeToolName(actionName);
  if (!normalizedAction) {
    return makeError('UNKNOWN_ACTION', `Unknown action "${actionName}".`, source, 'action');
  }

  const args = isRecord(raw.args) ? raw.args : raw;
  if (!isRecord(args)) {
    return makeError('MISSING_REQUIRED_ARGUMENT', `Missing required "args" object for ${actionName}.`, source, 'args');
  }

  return coerceToolArgs(normalizedAction, args, source);
}
