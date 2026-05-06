import type { ToolResult, ToolResultMetadata } from '@local-harness/tool-runtime';
import type {
  ActionDslAction,
  ActionDslBlocker,
  ActionDslDocument,
  ActionDslFinalAnswer,
  ActionDslToolName,
} from './schema';

export interface ActionDslExecutionTrace {
  emitTrace: (type: string, data: unknown) => void;
}

export interface ActionDslRuntime {
  readFile(filePath: string): Promise<ToolResult>;
  listDir(dirPath: string): Promise<ToolResult>;
  searchText(query: string, filePattern?: string): Promise<ToolResult>;
  glob(pattern: string): Promise<ToolResult>;
  previewPatch(filePath: string, oldContent: string, newContent: string): Promise<ToolResult>;
  patchFile(filePath: string, oldContent: string, newContent: string): Promise<ToolResult>;
  writeFile(filePath: string, content: string): Promise<ToolResult>;
  runCommand(command: string): Promise<ToolResult>;
}

export type ActionDslExecutionResult =
  | {
      kind: 'tool';
      action: ActionDslToolName;
      result: ToolResult;
    }
  | {
      kind: 'final';
      summary: string;
      filesChanged: string[];
      verification: string;
    }
  | {
      kind: 'blocker';
      reason: string;
      nextSafeStep: string;
    };

function emptyToolResult(output: string): ToolResult {
  return {
    success: true,
    output,
  };
}

function outputWithPreview(result: ToolResult, preview: string): ToolResult {
  return {
    ...result,
    preview,
    metadata: {
      ...(result.metadata ?? {}),
    } as ToolResultMetadata,
  };
}

export class ActionDslExecutor {
  constructor(
    private readonly runtime: ActionDslRuntime,
    private readonly trace: ActionDslExecutionTrace,
  ) {}

  async execute(document: ActionDslDocument): Promise<ActionDslExecutionResult> {
    this.trace.emitTrace('action_dsl_action_started', document);

    if (document.kind === 'final') {
      const finalResult: ActionDslFinalAnswer = document;
      this.trace.emitTrace('action_dsl_action_finished', finalResult);
      return finalResult;
    }

    if (document.kind === 'blocker') {
      const blockerResult: ActionDslBlocker = document;
      this.trace.emitTrace('action_dsl_action_finished', blockerResult);
      return blockerResult;
    }

    const result = await this.executeToolAction(document);
    this.trace.emitTrace('action_dsl_action_finished', {
      action: document.action,
      success: result.success,
      output: result.output,
      preview: result.preview,
    });
    return {
      kind: 'tool',
      action: document.action,
      result,
    };
  }

  private async executeToolAction(document: ActionDslAction): Promise<ToolResult> {
    const args = document.args as unknown as Record<string, unknown>;

    switch (document.action) {
      case 'read_file':
        return this.runtime.readFile(String(args.path));
      case 'list_dir':
        return this.runtime.listDir(String(args.path));
      case 'search_text':
        return this.runtime.searchText(String(args.query), typeof args.path === 'string' ? args.path : undefined);
      case 'glob':
        return this.runtime.glob(String(args.pattern));
      case 'propose_patch':
        return this.runtime.previewPatch(String(args.path), String(args.oldText), String(args.newText));
      case 'write_file_preview': {
        const current = await this.runtime.readFile(String(args.path));
        return this.runtime.previewPatch(String(args.path), current.output, String(args.content));
      }
      case 'apply_approved_change':
        if (typeof args.content === 'string' && args.content.length > 0) {
          return this.runtime.writeFile(String(args.path), args.content);
        }
        return this.runtime.patchFile(String(args.path), String(args.oldText), String(args.newText));
      case 'run_command_preview':
        return outputWithPreview(
          emptyToolResult(`Preview only: ${String(args.command)}`),
          `Preview only: ${String(args.command)}`,
        );
      case 'run_selected_command':
        return this.runtime.runCommand(String(args.command));
      default:
        return {
          success: false,
          output: `Action ${document.action} is not supported by the executor.`,
        };
    }
  }
}
