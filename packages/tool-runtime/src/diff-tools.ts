import type { StructuredDiff, StructuredDiffFile, StructuredDiffHunk, StructuredDiffLine } from './types';

function cleanDiffPath(value: string): string {
  return value.trim()
    .split(/\s+/)[0]
    .replace(/^a\//, '')
    .replace(/^b\//, '');
}

function parseHunkHeader(line: string): { oldStart: number; oldLines: number; newStart: number; newLines: number } | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) {
    return null;
  }
  return {
    oldStart: Number(match[1]),
    oldLines: Number(match[2] ?? 1),
    newStart: Number(match[3]),
    newLines: Number(match[4] ?? 1),
  };
}

function pushLine(hunk: StructuredDiffHunk, line: StructuredDiffLine) {
  hunk.lines.push(line);
}

export function parseStructuredDiff(diff: string): StructuredDiff {
  const files: StructuredDiffFile[] = [];
  let currentFile: StructuredDiffFile | null = null;
  let currentHunk: StructuredDiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of diff.split('\n')) {
    if (rawLine.startsWith('diff --git ')) {
      currentHunk = null;
      const match = rawLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
      currentFile = {
        path: match?.[2] || match?.[1] || 'changed file',
        oldPath: match?.[1],
        addedLines: 0,
        removedLines: 0,
        hunks: [],
      };
      files.push(currentFile);
      continue;
    }

    if (!currentFile && (rawLine.startsWith('--- ') || rawLine.startsWith('+++ '))) {
      currentFile = {
        path: 'changed file',
        addedLines: 0,
        removedLines: 0,
        hunks: [],
      };
      files.push(currentFile);
    }

    if (!currentFile) {
      continue;
    }

    if (rawLine.startsWith('--- ')) {
      const oldPath = cleanDiffPath(rawLine.slice(4));
      if (oldPath !== '/dev/null') {
        currentFile.oldPath = oldPath;
      }
      continue;
    }

    if (rawLine.startsWith('+++ ')) {
      const nextPath = cleanDiffPath(rawLine.slice(4));
      if (nextPath !== '/dev/null') {
        currentFile.path = nextPath;
      }
      continue;
    }

    if (rawLine.startsWith('@@')) {
      const hunkHeader = parseHunkHeader(rawLine);
      if (!hunkHeader) {
        continue;
      }
      currentHunk = {
        ...hunkHeader,
        lines: [],
      };
      oldLine = hunkHeader.oldStart;
      newLine = hunkHeader.newStart;
      currentFile.hunks.push(currentHunk);
      pushLine(currentHunk, { type: 'hunk', content: rawLine });
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (rawLine.startsWith('+')) {
      currentFile.addedLines += 1;
      pushLine(currentHunk, {
        type: 'added',
        newLine,
        content: rawLine.slice(1),
      });
      newLine += 1;
      continue;
    }

    if (rawLine.startsWith('-')) {
      currentFile.removedLines += 1;
      pushLine(currentHunk, {
        type: 'removed',
        oldLine,
        content: rawLine.slice(1),
      });
      oldLine += 1;
      continue;
    }

    if (rawLine.startsWith('\\')) {
      pushLine(currentHunk, { type: 'file', content: rawLine });
      continue;
    }

    pushLine(currentHunk, {
      type: 'context',
      oldLine,
      newLine,
      content: rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine,
    });
    oldLine += 1;
    newLine += 1;
  }

  return { files };
}
