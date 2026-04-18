import type { SkillMetadata } from './indexer';

export const HARNESS_NATIVE_SKILLS: SkillMetadata[] = [
  ['repo-cartographer', 'Repo Cartographer', 'Map app, package, and module structure quickly.', 'Use for fast repo overviews, manifests, and entry-point discovery.'],
  ['tool-router', 'Tool Router', 'Choose deterministic tool-first actions for common workspace tasks.', 'Use for file lookup, read, search, and routing before model synthesis.'],
  ['file-explainer', 'File Explainer', 'Explain a file after inspecting it with minimal context.', 'Use after reading one or more files and turning facts into concise explanation.'],
  ['patch-surgeon', 'Patch Surgeon', 'Make focused edits with minimal file churn and explicit summaries.', 'Use for narrow code edits where line delta and scope control matter.'],
  ['diff-summarizer', 'Diff Summarizer', 'Summarize changes, risks, and line-delta facts from actual edits.', 'Use after file changes or git diff review.'],
  ['approval-explainer', 'Approval Explainer', 'Translate approval prompts into plain language without hiding risk.', 'Use when approvals are requested or rejected.'],
  ['workspace-binder', 'Workspace Binder', 'Explain backend-bound vs browser-snapshot workspace limits clearly.', 'Use when folder binding fails or snapshot-only mode is active.'],
  ['performance-profiler', 'Performance Profiler', 'Spot slow render, polling, and streaming paths in harness runtime.', 'Use for UI lag, markdown cost, polling contention, and latency work.'],
  ['local-safety-operator', 'Local Safety Operator', 'Keep CPU, RAM, and approval constraints explicit for local runs.', 'Use for all local harness runs on constrained machines.'],
  ['command-runner', 'Command Runner', 'Run safe local commands with exact command reporting.', 'Use for build, test, lint, benchmark, and doctor tasks.'],
  ['test-runner', 'Test Runner', 'Choose which tests, lint, or build checks to run next.', 'Use before and after edits to validate the right scope.'],
  ['session-continuity', 'Session Continuity', 'Reuse prior session facts without bloating prompts.', 'Use to preserve continuity while keeping context tight.'],
].map(([slug, title, description, recommendedUse]) => ({
  slug,
  title,
  division: 'harness',
  description,
  sourceFile: `packages/skills/native/${slug}/SKILL.md`,
  sourceRepo: 'local-harness',
  tags: ['harness', 'agent', slug],
  recommendedUse,
  riskLevel: slug.includes('approval') || slug.includes('command') ? 'Medium' : 'Low',
}));
