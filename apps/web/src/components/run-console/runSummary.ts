import type { RunTraceEntry, StructuredDiff } from '../../types/run';

export interface DiffFileStat {
  file: string;
  added: number;
  removed: number;
}

export type VerificationStatus = 'passed' | 'failed' | 'running' | 'skipped' | 'not_run' | 'unknown';

export interface VerificationCheckSummary {
  command: string;
  status: VerificationStatus;
  durationMs?: number;
  summary?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeStatus(value: unknown, success?: unknown): VerificationStatus {
  if (value === 'passed' || value === 'failed' || value === 'running' || value === 'skipped') return value;
  if (value === 'not-run' || value === 'not_run') return 'not_run';
  if (success === true) return 'passed';
  if (success === false) return 'failed';
  return 'unknown';
}

function traceData(trace: RunTraceEntry): Record<string, unknown> {
  return isRecord(trace.data) ? trace.data : {};
}

export function parseDiffFileStats(diff: string): DiffFileStat[] {
  if (!diff.trim()) return [];
  return diff
    .split(/^diff --git /gm)
    .filter(Boolean)
    .map((block) => {
      const firstLine = block.split('\n')[0] || '';
      const match = firstLine.match(/^a\/(.+?) b\/(.+)$/);
      const file = match?.[2] || match?.[1] || firstLine.trim() || 'changed file';
      let added = 0;
      let removed = 0;

      for (const line of block.split('\n')) {
        if (line.startsWith('+++') || line.startsWith('---')) continue;
        if (line.startsWith('+')) added++;
        else if (line.startsWith('-')) removed++;
      }

      return { file, added, removed };
    });
}

export function getDiffLineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'diff-line-file';
  if (line.startsWith('@@')) return 'diff-line-hunk';
  if (line.startsWith('+')) return 'diff-line-added';
  if (line.startsWith('-')) return 'diff-line-removed';
  return '';
}

export function collectDiffFiles(structuredDiff: StructuredDiff | null | undefined, gitDiff: string): DiffFileStat[] {
  const structuredFiles = structuredDiff?.files ?? [];
  if (structuredFiles.length > 0) {
    return structuredFiles.map((file) => ({
      file: file.path,
      added: file.addedLines,
      removed: file.removedLines,
    }));
  }
  return parseDiffFileStats(gitDiff);
}

export function buildVerificationChecks(traces: RunTraceEntry[]): VerificationCheckSummary[] {
  const byCommand = new Map<string, VerificationCheckSummary>();

  for (const trace of traces) {
    if (trace.type !== 'verification_started' && trace.type !== 'verification_completed') continue;
    const data = traceData(trace);
    const command = asText(data.command) || 'Verification';

    if (trace.type === 'verification_started') {
      byCommand.set(command, {
        command,
        status: 'running',
        summary: asText(data.status),
      });
      continue;
    }

    byCommand.set(command, {
      command,
      status: normalizeStatus(data.status, data.success),
      durationMs: asNumber(data.durationMs),
      summary: asText(data.outputPreview) || asText(data.status),
    });
  }

  return Array.from(byCommand.values()).slice(-5);
}

export function formatStructuredDiffPreview(structuredDiff: StructuredDiff): string {
  const lines: string[] = [];
  for (const file of structuredDiff.files.slice(0, 8)) {
    lines.push(`diff -- ${file.path} (+${file.addedLines} -${file.removedLines})`);
    for (const hunk of file.hunks.slice(0, 5)) {
      lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
      for (const line of hunk.lines.slice(0, 80)) {
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : line.type === 'hunk' ? '@' : ' ';
        lines.push(`${prefix}${line.content || ' '}`);
      }
      if (hunk.lines.length > 80) lines.push('... hunk truncated in summary preview ...');
    }
  }
  return lines.join('\n');
}
