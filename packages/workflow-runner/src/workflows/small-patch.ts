export interface SmallPatchPromptInput {
  request: string;
  workspaceContext: string;
  targetPath: string;
  fileContent: string;
  relatedFiles: string[];
}

export interface SmallPatchVerificationPromptInput {
  request: string;
  workspaceContext: string;
  changedFiles: string[];
  diffSummary: string;
}

export interface SmallPatchSummaryPromptInput {
  request: string;
  changedFiles: string[];
  verificationSummary: string;
  diffSummary: string;
  filesRead: string[];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '- none';
}

export function buildSmallPatchPatchPrompt(input: SmallPatchPromptInput): string {
  return [
    'Action DSL mode.',
    'Return exactly one JSON object and nothing else.',
    'Allowed actions: propose_patch, final, blocker.',
    '',
    `Task: Propose one patch for ${input.targetPath}.`,
    `User request: ${input.request}`,
    '',
    '[Workspace context]',
    input.workspaceContext,
    '',
    '[Target file]',
    input.targetPath,
    '',
    '[Related files]',
    formatList(input.relatedFiles),
    '',
    '[Current content]',
    input.fileContent,
    '',
    'Rules:',
    '- Keep this patch scoped to the listed file.',
    '- oldText must be an exact snippet from the current file content.',
    '- Do not ask for extra reads.',
    '- If blocked, return kind blocker with the smallest safe next step.',
  ].join('\n');
}

export function buildSmallPatchVerificationPrompt(input: SmallPatchVerificationPromptInput): string {
  return [
    'Action DSL mode.',
    'Return exactly one JSON object and nothing else.',
    'Allowed actions: run_selected_command, final, blocker.',
    '',
    `Task: Select the smallest useful verification command for these changes.`,
    `User request: ${input.request}`,
    '',
    '[Workspace context]',
    input.workspaceContext,
    '',
    '[Changed files]',
    formatList(input.changedFiles),
    '',
    '[Diff summary]',
    input.diffSummary || 'No diff summary available.',
    '',
    'Rules:',
    '- Prefer a targeted check over a full build when possible.',
    '- Use a single safe command inside workspace root.',
    '- If no verification is useful, return kind final with a short verification note.',
  ].join('\n');
}

export function buildSmallPatchSummaryPrompt(input: SmallPatchSummaryPromptInput): string {
  return [
    'Write a concise final summary for a small multi-file workflow.',
    'Return plain text, not JSON.',
    '',
    `User request: ${input.request}`,
    '',
    '[Files read]',
    formatList(input.filesRead),
    '',
    '[Changed files]',
    formatList(input.changedFiles),
    '',
    '[Diff summary]',
    input.diffSummary || 'No diff summary available.',
    '',
    '[Verification]',
    input.verificationSummary || 'No verification run.',
    '',
    'Include what changed and whether verification passed.',
  ].join('\n');
}
