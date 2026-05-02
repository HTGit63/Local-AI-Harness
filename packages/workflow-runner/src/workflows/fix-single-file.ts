export interface FixSingleFilePatchPromptInput {
  request: string;
  workspaceContext: string;
  targetPath: string;
  fileContent: string;
}

export interface FixSingleFileVerificationPromptInput {
  request: string;
  workspaceContext: string;
  targetPath: string;
  changedFiles: string[];
  diffSummary: string;
}

export interface FixSingleFileSummaryPromptInput {
  request: string;
  targetPath: string;
  changedFiles: string[];
  verificationSummary: string;
  diffSummary: string;
  filesRead: string[];
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : '- none';
}

export function buildFixSingleFilePatchPrompt(input: FixSingleFilePatchPromptInput): string {
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
    '[Current content]',
    input.fileContent,
    '',
    'Rules:',
    '- Use propose_patch only if you can fix the target file directly.',
    '- oldText must be an exact snippet from the current file content.',
    '- Do not ask for extra reads.',
    '- If blocked, return kind blocker with the smallest safe next step.',
  ].join('\n');
}

export function buildFixSingleFileVerificationPrompt(input: FixSingleFileVerificationPromptInput): string {
  return [
    'Action DSL mode.',
    'Return exactly one JSON object and nothing else.',
    'Allowed actions: run_selected_command, final, blocker.',
    '',
    `Task: Select the smallest useful verification command for ${input.targetPath}.`,
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

export function buildFixSingleFileSummaryPrompt(input: FixSingleFileSummaryPromptInput): string {
  return [
    'Write a concise final summary for a one-file workflow.',
    'Return plain text, not JSON.',
    '',
    `User request: ${input.request}`,
    `Target file: ${input.targetPath}`,
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
