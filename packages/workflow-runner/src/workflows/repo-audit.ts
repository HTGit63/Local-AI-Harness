export interface RepoAuditSummaryPromptInput {
  request: string;
  workspaceContext: string;
  commandsDetected: string[];
  architectureFiles: string[];
  architectureSummaries: string[];
  testConfigFiles: string[];
  testConfigSummaries: string[];
}

function formatList(values: string[], emptyLabel: string): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join('\n') : emptyLabel;
}

export function buildRepoAuditSummaryPrompt(input: RepoAuditSummaryPromptInput): string {
  return [
    'You are producing a repository audit report.',
    'Return concise structured text with these headings exactly:',
    'Summary:',
    'Commands detected:',
    'Architecture evidence:',
    'Tests/config evidence:',
    'Risks:',
    'Follow-up workflows:',
    '',
    `User request: ${input.request}`,
    '',
    '[Workspace context]',
    input.workspaceContext,
    '',
    '[Commands detected]',
    formatList(input.commandsDetected, '- none'),
    '',
    '[Architecture files]',
    formatList(input.architectureFiles, '- none'),
    '',
    '[Architecture summaries]',
    formatList(input.architectureSummaries, '- none'),
    '',
    '[Tests/config files]',
    formatList(input.testConfigFiles, '- none'),
    '',
    '[Tests/config summaries]',
    formatList(input.testConfigSummaries, '- none'),
    '',
    'Rules:',
    '- Do not suggest file writes as the first response.',
    '- Report evidence with file paths.',
    '- Call out risks that affect reliability, test coverage, configuration, or repo structure.',
    '- Suggest follow-up workflows such as inspect_project, fix_single_file, or small_patch only when relevant.',
  ].join('\n');
}
