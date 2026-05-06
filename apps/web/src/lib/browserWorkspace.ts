export interface BrowserWorkspaceSummary {
  label: string;
  fileCount: number;
  totalBytes: number;
}

export function describeBrowserWorkspace(summary: BrowserWorkspaceSummary | null): string {
  if (!summary) return 'No browser workspace attached';
  return `${summary.label} · ${summary.fileCount} files · ${summary.totalBytes} bytes`;
}
