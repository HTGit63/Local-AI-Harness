export interface WorkspaceFile {
  path: string;
  size?: number;
}

export interface WorkspaceSummary {
  root: string;
  files: WorkspaceFile[];
}
