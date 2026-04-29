import {
  AgentRun,
  AgentRunApproval,
  AgentRunCommand,
  AgentRunLineStats,
  AgentRunMetrics,
  AgentRunSearch,
  AgentRunStep,
  AgentRunStepStatus,
  AgentRunStepType,
  AgentRunWebFetch,
  AgentRunWebSearch,
} from '@local-harness/session-store';
import { ToolResultMetadata } from '@local-harness/tool-runtime';

function uniquePush(target: string[], values: string[] | undefined) {
  for (const value of values ?? []) {
    if (value && !target.includes(value)) {
      target.push(value);
    }
  }
}

function mergeSearches(target: AgentRunSearch[], values: AgentRunSearch[] | undefined) {
  for (const value of values ?? []) {
    if (!target.some((entry) => entry.query === value.query && entry.pattern === value.pattern)) {
      target.push(value);
    }
  }
}

function mergeCommands(target: AgentRunCommand[], command?: AgentRunCommand) {
  if (command) {
    target.push(command);
  }
}

function mergeWebSearches(target: AgentRunWebSearch[], values: AgentRunWebSearch[] | undefined) {
  for (const value of values ?? []) {
    if (!target.some((entry) => entry.query === value.query && entry.engine === value.engine)) {
      target.push(value);
    }
  }
}

function mergeWebFetches(target: AgentRunWebFetch[], values: AgentRunWebFetch[] | undefined) {
  for (const value of values ?? []) {
    if (!target.some((entry) => entry.url === value.url)) {
      target.push(value);
    }
  }
}

function mergeLineStats(current: AgentRunLineStats | undefined, incoming?: AgentRunLineStats): AgentRunLineStats | undefined {
  if (!incoming) {
    return current;
  }

  if (!current) {
    return { ...incoming };
  }

  return {
    changedFiles: current.changedFiles + incoming.changedFiles,
    addedLines: current.addedLines + incoming.addedLines,
    removedLines: current.removedLines + incoming.removedLines,
  };
}

export function summarizeRun(run: AgentRun): string {
  const facts: string[] = [];
  if (run.filesRead.length > 0 || run.directoriesRead.length > 0) {
    const pieces: string[] = [];
    if (run.filesRead.length > 0) pieces.push(`${run.filesRead.length} file${run.filesRead.length === 1 ? '' : 's'}`);
    if (run.directoriesRead.length > 0) pieces.push(`${run.directoriesRead.length} director${run.directoriesRead.length === 1 ? 'y' : 'ies'}`);
    facts.push(`inspected ${pieces.join(' and ')}`);
  }
  if (run.searches.length > 0) {
    facts.push(`ran ${run.searches.length} search${run.searches.length === 1 ? '' : 'es'}`);
  }
  if (run.webSearches.length > 0) {
    facts.push(`searched web ${run.webSearches.length} time${run.webSearches.length === 1 ? '' : 's'}`);
  }
  if (run.webFetches.length > 0) {
    facts.push(`fetched ${run.webFetches.length} web page${run.webFetches.length === 1 ? '' : 's'}`);
  }
  if (run.commands.length > 0) {
    facts.push(`ran ${run.commands.length} command${run.commands.length === 1 ? '' : 's'}`);
  }
  if (run.git && run.git.changedFiles > 0) {
    facts.push(`changed ${run.git.changedFiles} file${run.git.changedFiles === 1 ? '' : 's'} (+${run.git.addedLines} / -${run.git.removedLines})`);
  } else if (run.filesWritten.length > 0 || run.filesDeleted.length > 0 || run.directoriesCreated.length > 0) {
    const changedCount = run.filesWritten.length + run.filesDeleted.length + run.directoriesCreated.length;
    facts.push(`changed ${changedCount} workspace item${changedCount === 1 ? '' : 's'}`);
  } else {
    facts.push('made no file changes');
  }
  if (run.usedManualFallback) {
    facts.push(`fallback ${run.fallbackReason ? `used: ${run.fallbackReason}` : 'used'}`);
  }
  return facts.length > 0 ? facts.join('; ') : 'No run activity recorded.';
}

export function buildFinalAnswer(baseAnswer: string, run: AgentRun): string {
  const facts = summarizeRun(run);
  const changedLine = run.git && run.git.changedFiles > 0
    ? `Files changed: ${run.git.changedFiles} (+${run.git.addedLines} / -${run.git.removedLines})`
    : 'Files changed: none';
  const summaryBlock = ['What I did: ' + facts, changedLine].join('\n');
  const trimmed = baseAnswer.trim();
  return trimmed ? `${trimmed}\n\n${summaryBlock}` : summaryBlock;
}

export class AgentRunBuilder {
  private run: AgentRun;

  constructor(run: AgentRun) {
    this.run = {
      ...run,
      steps: [...run.steps],
      filesRead: [...run.filesRead],
      directoriesRead: [...run.directoriesRead],
      filesWritten: [...run.filesWritten],
      filesDeleted: [...run.filesDeleted],
      directoriesCreated: [...run.directoriesCreated],
      searches: [...run.searches],
      webSearches: [...run.webSearches],
      webFetches: [...run.webFetches],
      commands: [...run.commands],
      approvals: [...run.approvals],
      metrics: run.metrics ? { ...run.metrics } : undefined,
      git: run.git ? { ...run.git } : undefined,
      structuredDiff: run.structuredDiff ? { files: run.structuredDiff.files.map((file) => ({ ...file, hunks: file.hunks.map((hunk) => ({ ...hunk, lines: hunk.lines.map((line) => ({ ...line })) })) })) } : undefined,
      fileChanges: run.fileChanges ? run.fileChanges.map((file) => ({ ...file, hunks: file.hunks.map((hunk) => ({ ...hunk, lines: hunk.lines.map((line) => ({ ...line })) })) })) : undefined,
      selectedTests: run.selectedTests ? [...run.selectedTests] : undefined,
      checkpointIds: run.checkpointIds ? [...run.checkpointIds] : undefined,
    };
  }

  snapshot(): AgentRun {
    return {
      ...this.run,
      steps: this.run.steps.map((step) => ({ ...step, filePaths: step.filePaths ? [...step.filePaths] : undefined })),
      filesRead: [...this.run.filesRead],
      directoriesRead: [...this.run.directoriesRead],
      filesWritten: [...this.run.filesWritten],
      filesDeleted: [...this.run.filesDeleted],
      directoriesCreated: [...this.run.directoriesCreated],
      searches: this.run.searches.map((entry) => ({ ...entry })),
      webSearches: this.run.webSearches.map((entry) => ({ ...entry })),
      webFetches: this.run.webFetches.map((entry) => ({ ...entry })),
      commands: this.run.commands.map((entry) => ({ ...entry })),
      approvals: this.run.approvals.map((entry) => ({ ...entry })),
      metrics: this.run.metrics ? { ...this.run.metrics } : undefined,
      git: this.run.git ? { ...this.run.git } : undefined,
      structuredDiff: this.run.structuredDiff ? { files: this.run.structuredDiff.files.map((file) => ({ ...file, hunks: file.hunks.map((hunk) => ({ ...hunk, lines: hunk.lines.map((line) => ({ ...line })) })) })) } : undefined,
      fileChanges: this.run.fileChanges ? this.run.fileChanges.map((file) => ({ ...file, hunks: file.hunks.map((hunk) => ({ ...hunk, lines: hunk.lines.map((line) => ({ ...line })) })) })) : undefined,
      selectedTests: this.run.selectedTests ? [...this.run.selectedTests] : undefined,
      checkpointIds: this.run.checkpointIds ? [...this.run.checkpointIds] : undefined,
    };
  }

  setMetric(patch: Partial<AgentRunMetrics>) {
    this.run.metrics = {
      ...(this.run.metrics ?? {}),
      ...patch,
    };
  }

  markNativeToolsUsed() {
    this.run.usedNativeTools = true;
  }

  markManualFallback(reason?: string) {
    this.run.usedManualFallback = true;
    this.run.fallbackReason = reason;
    this.setMetric({
      fallbackCount: (this.run.metrics?.fallbackCount ?? 0) + 1,
    });
  }

  setLoopCount(modelLoops: number) {
    this.setMetric({ modelLoops });
  }

  startStep(step: Omit<AgentRunStep, 'startedAt' | 'status'>): AgentRunStep {
    const nextStep: AgentRunStep = {
      ...step,
      startedAt: Date.now(),
      status: 'running',
    };
    this.run.steps.push(nextStep);
    return nextStep;
  }

  finishStep(id: string, patch: Partial<Omit<AgentRunStep, 'id' | 'startedAt'>> = {}, status: AgentRunStepStatus = 'done') {
    const step = this.run.steps.find((entry) => entry.id === id);
    if (!step) {
      return;
    }
    Object.assign(step, patch, {
      endedAt: Date.now(),
      status: patch.status ?? status,
    });
  }

  startNamedStep(type: AgentRunStepType, title: string, detail?: string): AgentRunStep {
    return this.startStep({
      id: `step_${this.run.steps.length + 1}_${type}`,
      type,
      title,
      detail,
    });
  }

  recordApprovalRequested(approval: AgentRunApproval) {
    if (!this.run.approvals.some((entry) => entry.id === approval.id)) {
      this.run.approvals.push(approval);
    }
  }

  recordApprovalResolved(id: string, approved: boolean | null) {
    const approval = this.run.approvals.find((entry) => entry.id === id);
    if (approval) {
      approval.approved = approved;
    }
  }

  recordToolMetadata(metadata?: ToolResultMetadata) {
    if (!metadata) {
      return;
    }
    if (typeof metadata.durationMs === 'number') {
      this.setMetric({
        toolsMs: (this.run.metrics?.toolsMs ?? 0) + metadata.durationMs,
      });
    }
    uniquePush(this.run.filesRead, metadata.fileReads);
    uniquePush(this.run.directoriesRead, metadata.directoriesRead);
    uniquePush(this.run.filesWritten, metadata.fileWrites);
    uniquePush(this.run.filesDeleted, metadata.fileDeletes);
    uniquePush(this.run.directoriesCreated, metadata.directoriesCreated);
    mergeSearches(this.run.searches, metadata.searches);
    mergeWebSearches(this.run.webSearches, metadata.webSearches);
    mergeWebFetches(this.run.webFetches, metadata.webFetches);
    mergeCommands(this.run.commands, metadata.command);
    this.run.git = mergeLineStats(this.run.git, metadata.lineStats);
    if (metadata.structuredDiff) {
      this.run.structuredDiff = metadata.structuredDiff;
      this.run.fileChanges = metadata.structuredDiff.files;
    }
    uniquePush(this.run.selectedTests ??= [], metadata.selectedTests);
    if (metadata.checkpointId) {
      uniquePush(this.run.checkpointIds ??= [], [metadata.checkpointId]);
    }
    if (metadata.contextBudgetUsed || metadata.contextBudgetLimit) {
      this.setMetric({
        contextBudgetUsed: metadata.contextBudgetUsed,
        contextBudgetLimit: metadata.contextBudgetLimit,
      });
    }
  }

  setGitStats(git: AgentRunLineStats | undefined) {
    if (git) {
      this.run.git = git;
    }
  }

  finalize(params: { finalAnswer?: string; summary?: string; error?: string }) {
    this.run.endedAt = Date.now();
    if (params.finalAnswer !== undefined) {
      this.run.finalAnswer = params.finalAnswer;
    }
    if (params.summary !== undefined) {
      this.run.summary = params.summary;
    }
    if (params.error !== undefined) {
      this.run.error = params.error;
    }
    this.setMetric({
      totalMs: this.run.endedAt - this.run.startedAt,
    });
  }
}
