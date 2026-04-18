export type TaskIntent =
  | 'status_query'
  | 'workspace_overview'
  | 'find_file'
  | 'read_file'
  | 'search_text'
  | 'explain_code'
  | 'review_diff'
  | 'edit_code'
  | 'run_command'
  | 'workspace_binding_needed'
  | 'browser_snapshot_only'
  | 'general_chat';

export interface IntentDecision {
  intent: TaskIntent;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  targetPath?: string;
  searchQuery?: string;
  commandHint?: string;
}

function extractQuotedValue(text: string): string | undefined {
  const match = text.match(/["'`](.+?)["'`]/);
  return match?.[1]?.trim();
}

function extractPathHint(text: string): string | undefined {
  const quoted = extractQuotedValue(text);
  if (quoted && /[/.\\]/.test(quoted)) {
    return quoted;
  }

  const pathMatch = text.match(/\b([A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|json|md|py|rs|toml|css|html|yml|yaml))\b/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  const bareName = text.match(/\b([A-Za-z0-9_.-]+)\b/);
  return bareName?.[1];
}

function extractSearchQuery(text: string): string | undefined {
  const quoted = extractQuotedValue(text);
  if (quoted) {
    return quoted;
  }

  const match = text.match(/\b(?:search|find text|grep|look for|references to|mentions of)\b\s+(.+)$/i);
  return match?.[1]?.trim();
}

function extractCommandHint(text: string): string | undefined {
  const quoted = extractQuotedValue(text);
  if (quoted && /\s/.test(quoted)) {
    return quoted;
  }

  const match = text.match(/\b(?:run|execute|test|lint|build|benchmark|doctor)\b\s+(.+)$/i);
  return match?.[1]?.trim();
}

function isMutatingRequest(text: string): boolean {
  return /\b(add|change|create|delete|edit|fix|implement|make|patch|refactor|remove|rename|update|write)\b/i.test(text);
}

export function classifyIntent(input: {
  latestUserMessage: string;
  browserContextActive: boolean;
  workspaceBound: boolean;
}): IntentDecision {
  const rawText = input.latestUserMessage.trim();
  const text = rawText.toLowerCase();

  if (input.browserContextActive && !input.workspaceBound) {
    if (isMutatingRequest(text)) {
      return {
        intent: 'workspace_binding_needed',
        confidence: 'high',
        reasons: ['Mutating request requires bound backend workspace.'],
      };
    }
    return {
      intent: 'browser_snapshot_only',
      confidence: 'high',
      reasons: ['Browser snapshot available without backend workspace binding.'],
    };
  }

  if (
    (/\b(active|configured|current|open)\b/.test(text) && /\b(cwd|directory|folder|mode|model|path|runtime|workspace)\b/.test(text)) ||
    /\bwhich workspace folder is open\b/.test(text)
  ) {
    return { intent: 'status_query', confidence: 'high', reasons: ['Status query.'] };
  }

  if (/\b(architecture|project structure|repo overview|explain project|workspace overview|main packages|main apps)\b/.test(text)) {
    return { intent: 'workspace_overview', confidence: 'high', reasons: ['Workspace overview request.'] };
  }

  if (/\b(review diff|git diff|review changes|code review)\b/.test(text)) {
    return { intent: 'review_diff', confidence: 'high', reasons: ['Diff review request.'] };
  }

  if (/\b(run|execute|test|lint|build|benchmark|doctor)\b/.test(text)) {
    return {
      intent: 'run_command',
      confidence: 'medium',
      reasons: ['Command execution request.'],
      commandHint: extractCommandHint(rawText),
    };
  }

  if (/\b(read file|open file|inspect file|show file|cat file)\b/.test(text)) {
    return {
      intent: 'read_file',
      confidence: 'high',
      reasons: ['Direct file read request.'],
      targetPath: extractPathHint(rawText),
    };
  }

  if (/\b(find file|which file|where is|locate file)\b/.test(text)) {
    return {
      intent: 'find_file',
      confidence: 'high',
      reasons: ['File lookup request.'],
      targetPath: extractPathHint(rawText),
    };
  }

  if (/\b(search|grep|look for|find text|references to|mentions of)\b/.test(text)) {
    return {
      intent: 'search_text',
      confidence: 'high',
      reasons: ['Workspace text search request.'],
      searchQuery: extractSearchQuery(rawText),
    };
  }

  if (isMutatingRequest(text)) {
    return { intent: 'edit_code', confidence: 'high', reasons: ['Edit request.'] };
  }

  if (/\b(explain|summarize|teach me|what does this do)\b/.test(text)) {
    return { intent: 'explain_code', confidence: 'medium', reasons: ['Explanation request.'] };
  }

  return { intent: 'general_chat', confidence: 'low', reasons: ['Fallback intent.'] };
}
