export interface ToolDiffStats {
  changedFiles: number;
  addedLines: number;
  removedLines: number;
}

export type StructuredDiffLineType = 'context' | 'added' | 'removed' | 'hunk' | 'file';

export interface StructuredDiffLine {
  type: StructuredDiffLineType;
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface StructuredDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: StructuredDiffLine[];
}

export interface StructuredDiffFile {
  path: string;
  oldPath?: string;
  addedLines: number;
  removedLines: number;
  hunks: StructuredDiffHunk[];
}

export interface StructuredDiff {
  files: StructuredDiffFile[];
}

export interface ToolSearchRecord {
  query: string;
  pattern?: string;
}

export interface ToolCommandRecord {
  command: string;
  success: boolean;
  durationMs?: number;
}

export interface ToolWebSearchRecord {
  query: string;
  engine: string;
  resultCount: number;
}

export interface ToolWebFetchRecord {
  url: string;
  title?: string;
}

export interface ToolResultMetadata {
  durationMs?: number;
  fileReads?: string[];
  directoriesRead?: string[];
  fileWrites?: string[];
  fileDeletes?: string[];
  directoriesCreated?: string[];
  searches?: ToolSearchRecord[];
  webSearches?: ToolWebSearchRecord[];
  webFetches?: ToolWebFetchRecord[];
  command?: ToolCommandRecord;
  lineStats?: ToolDiffStats;
  structuredDiff?: StructuredDiff;
  selectedTests?: string[];
  checkpointId?: string;
  contextBudgetUsed?: number;
  contextBudgetLimit?: number;
  truncated?: boolean;
}

export interface ToolResult {
  success: boolean;
  output: string;
  preview?: string;
  error?: string;
  metadata?: ToolResultMetadata;
}

export type ApprovalDecision = Promise<boolean> & {
  updatePreview?: (preview: string) => void;
};

export interface ToolApprovalRequest {
  action: string;
  target: string;
  preview: string;
  metadata?: Record<string, string>;
}

export interface ToolActionContext {
  cwd: string;
  internetAccessEnabled?: boolean;
  emitTrace: (type: string, data: unknown) => void;
  checkPolicy: (action: 'read' | 'write' | 'delete' | 'execute', target?: string) => {
    allowed: boolean;
    requiresApproval: boolean;
    reason?: string;
  };
  requestApproval: (request: ToolApprovalRequest) => ApprovalDecision;
}
