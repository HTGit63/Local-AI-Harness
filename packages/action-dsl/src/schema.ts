export const ACTION_DSL_TOOL_NAMES = [
  'list_dir',
  'read_file',
  'search_text',
  'glob',
  'build_context_pack',
  'find_symbol',
  'find_function',
  'get_structured_diff',
  'create_checkpoint',
  'propose_patch',
  'write_file_preview',
  'apply_approved_change',
  'run_command_preview',
  'run_selected_command',
] as const;

export type ActionDslToolName = (typeof ACTION_DSL_TOOL_NAMES)[number];

export const ACTION_DSL_ALLOWED_NAMES = [
  ...ACTION_DSL_TOOL_NAMES,
  'final_answer',
  'blocker',
] as const;

export type ActionDslAllowedName = (typeof ACTION_DSL_ALLOWED_NAMES)[number];

export interface ActionDslListDirArgs {
  path: string;
}

export interface ActionDslReadFileArgs {
  path: string;
}

export interface ActionDslSearchTextArgs {
  query: string;
  path?: string;
}

export interface ActionDslGlobArgs {
  pattern: string;
}

export interface ActionDslBuildContextPackArgs {
  root?: string;
}

export interface ActionDslFindSymbolArgs {
  name: string;
  path?: string;
}

export interface ActionDslFindFunctionArgs {
  name: string;
  path?: string;
}

export interface ActionDslStructuredDiffArgs {
  path: string;
  oldText: string;
  newText: string;
}

export interface ActionDslCreateCheckpointArgs {
  label?: string;
}

export interface ActionDslProposePatchArgs {
  path: string;
  oldText: string;
  newText: string;
}

export interface ActionDslWriteFilePreviewArgs {
  path: string;
  content: string;
}

export interface ActionDslApplyApprovedChangeArgs {
  path: string;
  content?: string;
  oldText?: string;
  newText?: string;
}

export interface ActionDslRunCommandArgs {
  command: string;
}

export interface ActionDslFinalAnswer {
  kind: 'final';
  summary: string;
  filesChanged: string[];
  verification: string;
}

export interface ActionDslBlocker {
  kind: 'blocker';
  reason: string;
  nextSafeStep: string;
}

export interface ActionDslToolArgsMap {
  list_dir: ActionDslListDirArgs;
  read_file: ActionDslReadFileArgs;
  search_text: ActionDslSearchTextArgs;
  glob: ActionDslGlobArgs;
  build_context_pack: ActionDslBuildContextPackArgs;
  find_symbol: ActionDslFindSymbolArgs;
  find_function: ActionDslFindFunctionArgs;
  get_structured_diff: ActionDslStructuredDiffArgs;
  create_checkpoint: ActionDslCreateCheckpointArgs;
  propose_patch: ActionDslProposePatchArgs;
  write_file_preview: ActionDslWriteFilePreviewArgs;
  apply_approved_change: ActionDslApplyApprovedChangeArgs;
  run_command_preview: ActionDslRunCommandArgs;
  run_selected_command: ActionDslRunCommandArgs;
}

export interface ActionDslAction<T extends ActionDslToolName = ActionDslToolName> {
  kind: 'action';
  action: T;
  args: ActionDslToolArgsMap[T];
}

export type ActionDslDocument = ActionDslAction | ActionDslFinalAnswer | ActionDslBlocker;

export interface ActionDslParseError {
  code:
    | 'EMPTY_INPUT'
    | 'INVALID_MARKDOWN_WRAPPER'
    | 'INVALID_JSON'
    | 'MULTIPLE_OBJECTS'
    | 'NOT_AN_OBJECT'
    | 'UNKNOWN_ACTION'
    | 'MISSING_REQUIRED_ARGUMENT'
    | 'INVALID_ARGUMENT_TYPE';
  message: string;
  field?: string;
}

export interface ActionDslParseSuccess<T extends ActionDslDocument = ActionDslDocument> {
  ok: true;
  source: 'json' | 'markdown';
  value: T;
}

export interface ActionDslParseFailure {
  ok: false;
  source: 'json' | 'markdown' | 'unknown';
  error: ActionDslParseError;
}

export type ActionDslParseResult<T extends ActionDslDocument = ActionDslDocument> =
  | ActionDslParseSuccess<T>
  | ActionDslParseFailure;
