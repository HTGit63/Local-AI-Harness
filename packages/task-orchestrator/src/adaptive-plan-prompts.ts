import { AdaptivePlanValidationOptions } from './adaptive-plan';
import { TaskIntent, TaskSizeEstimate } from './index';

export interface AdaptivePlanningPromptInput {
  userRequest: string;
  intent: TaskIntent | string;
  sizeEstimate: TaskSizeEstimate;
  workspaceRoot: string;
  availableTools: string[];
  policyMode: string;
  repoContext?: string;
  maxGoalsPerPlan?: number;
}

export function buildAdaptivePlanningPrompt(input: AdaptivePlanningPromptInput): string {
  const maxGoals = input.maxGoalsPerPlan ?? 12;
  return [
    '[Adaptive Planning Task]',
    'Create a machine-readable adaptive plan for a local coding harness.',
    'Return strict JSON only. No markdown, no comments, no prose outside JSON.',
    '',
    '[User Request]',
    input.userRequest,
    '',
    '[Runtime]',
    `Intent: ${input.intent}`,
    `Size estimate: ${input.sizeEstimate}`,
    `Workspace root: ${input.workspaceRoot}`,
    `Policy mode: ${input.policyMode}`,
    `Available tools: ${input.availableTools.length ? input.availableTools.join(', ') : 'none'}`,
    '',
    '[Repo Context]',
    input.repoContext || 'No repo context available yet. Start with bounded inspection.',
    '',
    '[Required JSON Shape]',
    JSON.stringify({
      id: 'plan_short_unique_id',
      task: 'Concrete task title',
      summary: 'One sentence task-specific plan summary.',
      complexity: 'small | single_file | multi_file | repo_wide',
      mode: 'agent',
      status: 'pending',
      workspaceRoot: input.workspaceRoot,
      createdAt: 0,
      updatedAt: 0,
      goals: [{
        id: 'G1',
        title: 'Inspect target files',
        type: 'inspect',
        status: 'pending',
        tools: ['listDir', 'searchText', 'readFile'],
        files: [],
        success_check: 'Specific evidence needed before editing is collected.',
        budget: {
          maxModelCalls: 0,
          maxToolCalls: 4,
          maxFilesToRead: 3,
          maxFilesToWrite: 0,
          maxOutputTokens: 768,
        },
      }],
    }, null, 2),
    '',
    '[Rules]',
    `- Max goals: ${maxGoals}.`,
    '- Use only listed available tools.',
    '- Each goal must be executable by the harness one at a time.',
    '- No vague titles such as "fix", "update", "improve", or "refactor".',
    '- Inspect before edit unless target files are already obvious.',
    '- Edit goals must name files or include a file-selection success check before editing.',
    '- Multi-file edits must be split into focused file groups.',
    '- Any edit plan must include verification.',
    '- Include final summarize/report goal.',
    '- Respect budgets; no goal may read whole repo.',
    '- Do not grant dangerous tools unless required by request and policy.',
  ].join('\n');
}

export function buildAdaptivePlanRepairPrompt(params: {
  previousJson: string;
  validationErrors: string[];
  validationOptions: Pick<AdaptivePlanValidationOptions, 'workspaceRoot' | 'allowedTools' | 'maxGoalsPerPlan'>;
}): string {
  return [
    '[Adaptive Plan Repair]',
    'Repair the JSON plan. Return strict JSON only.',
    '',
    '[Validation Errors]',
    ...params.validationErrors.map((error) => `- ${error}`),
    '',
    '[Constraints]',
    `Workspace root must be: ${params.validationOptions.workspaceRoot}`,
    `Allowed tools: ${(params.validationOptions.allowedTools ?? []).join(', ') || 'none'}`,
    `Max goals: ${params.validationOptions.maxGoalsPerPlan ?? 12}`,
    'Keep plan bounded, executable one goal at a time, with final summarize/report goal.',
    '',
    '[Previous JSON]',
    params.previousJson,
  ].join('\n');
}
