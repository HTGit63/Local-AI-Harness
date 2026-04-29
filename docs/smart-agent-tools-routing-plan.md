# Plan: Smart Agent Tools And Routing

**Generated**: 2026-04-28
**Estimated Complexity**: High
**Status**: Implemented and verified

## Overview

Add deterministic repo intelligence around the local model so Gemma/Qwen spend less context on blind searching and whole-file rewrites. The work lands in four slices: precise tools, visible diffs/checkpoints, routing/context controls, and UI trust surfaces.

## Sprint 1: Make Edits Visible

**Goal**: show real file changes and rollback posture.
**Validation**:
- `getStructuredDiff()` returns file/hunk/line objects.
- Run console renders inline diff with old/new line numbers.
- `createCheckpoint()` and `rollbackToCheckpoint()` work through tool policy.

## Sprint 2: Make Agent Faster

**Goal**: reduce guessing and command churn.
**Validation**:
- `detectProjectCommands()` returns deterministic npm/pnpm/yarn/bun commands.
- `selectTestsForChangedFiles()` maps touched paths to targeted tests.
- Context budget telemetry appears in traces and UI.

## Sprint 3: Make Agent Smarter

**Goal**: let tools answer code-structure questions.
**Validation**:
- `findSymbol`, `findFunction`, and `findComponent` jump to definitions.
- `whoImports`, `whatDoesThisImport`, and `affectedFiles` expose dependency impact.
- AST edit tools patch only specific declarations.

## Sprint 4: Make It Frontier-Like

**Goal**: route work by purpose and model strength.
**Validation**:
- Execution/prompt/provider profiles are public config.
- Direct/code/summarize calls select route-specific models.
- Prompt profiles specialize instructions for Gemma, Qwen, DeepSeek, Kimi, and frontier-mini style use.

## Testing Strategy

- `npm run build:packages`
- `npm run build:apps`
- `node --import tsx tests/unit/core.test.ts`
- `node --import tsx tests/integration/workflow.test.ts`
- `node --import tsx tests/e2e/api.test.ts`
- `node --import tsx tests/e2e/cli.test.ts`
- `npm test`

## Potential Risks & Gotchas

- TypeScript AST edits are intentionally scoped to one file and exact identifier/function names; broader project-wide refactors still need review.
- Checkpoints snapshot workspace files while excluding heavy generated/reference folders; they are for harness edits, not full backup replacement.
- Provider abstraction is config-level and OpenAI-compatible through existing `baseUrl`/`apiKey`; provider-specific auth setup remains operator-side.

## Rollback Plan

Use `rollbackToCheckpoint(checkpointId)` for runtime edits made after a checkpoint. For this implementation branch, use git revert/reset only if explicitly requested by the operator.
