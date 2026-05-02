export interface InspectProjectSummaryPromptInput {
  request: string;
  workspaceContext: string;
  topLevelListing: string[];
  filesRead: string[];
  commandsDetected: string[];
  manifestSummaries: string[];
  readmeSummaries: string[];
  apiEntryFile?: string;
}

function formatList(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : emptyLabel;
}

export function buildInspectProjectSummaryPrompt(input: InspectProjectSummaryPromptInput): string {
  return [
    'You are summarizing a focused repository inspection.',
    'Return concise structured text with these headings exactly:',
    'Summary:',
    'API entry file:',
    'Files read:',
    'Commands detected:',
    'Notes:',
    '',
    `User request: ${input.request}`,
    '',
    '[Workspace context]',
    input.workspaceContext,
    '',
    '[Top-level listing]',
    formatList(input.topLevelListing, '- none'),
    '',
    '[Files read]',
    formatList(input.filesRead, '- none'),
    '',
    '[Commands detected]',
    formatList(input.commandsDetected, '- none'),
    '',
    '[Manifest summaries]',
    formatList(input.manifestSummaries, '- none'),
    '',
    '[README summaries]',
    formatList(input.readmeSummaries, '- none'),
    '',
    `API entry file hint: ${input.apiEntryFile || 'not found'}`,
    '',
    'Do not invent files or commands that are not present in the context.',
    'Keep summary factual and brief.',
  ].join('\n');
}
