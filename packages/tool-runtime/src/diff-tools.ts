import type { StructuredDiff, StructuredDiffFile, StructuredDiffHunk, StructuredDiffLine } from './types';

function cleanDiffPath(value: string): string {
  let cleaned = value.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  const tabIndex = cleaned.indexOf('\t');
  if (tabIndex !== -1) {
    cleaned = cleaned.slice(0, tabIndex);
  }
  const timestampIndex = cleaned.search(/\s+\d{4}-\d{2}-\d{2}(?:\s|T)/);
  if (timestampIndex !== -1) {
    cleaned = cleaned.slice(0, timestampIndex);
  }
  const labelMatch = cleaned.match(/^(.*) \((?:before|after)\)$/);
  if (labelMatch) {
    cleaned = labelMatch[1];
  }
  return cleaned
    .replace(/^a\//, '')
    .replace(/^b\//, '');
}

function parseDiffGitPaths(line: string): { oldPath?: string; newPath?: string } {
  const input = line.slice('diff --git '.length).trim();
  const tokens: string[] = [];
  let current = '';
  let quoted = false;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return {
    oldPath: tokens[0] ? cleanDiffPath(tokens[0]) : undefined,
    newPath: tokens[1] ? cleanDiffPath(tokens[1]) : undefined,
  };
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
      const paths = parseDiffGitPaths(rawLine);
      currentFile = {
        path: paths.newPath || paths.oldPath || 'changed file',
        oldPath: paths.oldPath,
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
