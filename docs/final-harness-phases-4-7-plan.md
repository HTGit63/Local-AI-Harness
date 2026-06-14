# Plan: Final Harness Phases 4-7

Generated: 2026-06-14
Complexity: High

## Overview

Finish AGENTS.md Phase 4 through Phase 7 without reverting the target Ollama
runtime/session fixes. Keep normal tests deterministic. Add opt-in real-model
smoke. Make Agent Mode easier to maintain. Keep Agent UI summary-first and Chat
Mode clean.

## Sprint 1: Real Smoke + Test Depth

Goal: prove local runtime plumbing separately from mock tests.

Validation:

- `npm run test:real-model` skips without `HARNESS_REAL_MODEL_TESTS=1`.
- Opt-in command uses `nemotron-3-nano:4b`.
- Temp workspace only.

Tasks:

- Add `test:real-model` root script.
- Add `tests/e2e/real-model-smoke.test.ts`.
- Assert direct chat, agent inspect, agent edit/verify, durable log paths.
- Add helper coverage for diff/test summary state.

## Sprint 2: AgentMode Decomposition

Goal: make `AgentMode.tsx` an orchestration shell.

Validation:

- `npm run build --workspace web`.
- No component over 500 lines except existing lower-level run console modules.

Tasks:

- Move large controller behavior behind `hooks/useAgentModeController.tsx`.
- Extract `agentApi.ts`.
- Extract `AgentTopBar.tsx`.
- Extract `AgentRunLogPanel.tsx`.
- Preserve streaming, approvals, settings, workspace selection, image
  attachments, runtime display, task plan, diff display, and logs.

## Sprint 3: UI + Stage 5 Hardening

Goal: Agent UI is summary-first; debug detail remains collapsed.

Validation:

- `npm run build --workspace web`.
- `npm run lint --workspace web`.

Tasks:

- Keep runtime/model/workspace/write/goal in first visual band.
- Keep changed files and verification compact.
- Show explicit `not-run` verification state.
- Keep full diff, raw trace, checkpoints, and context budget behind details.

## Sprint 4: Docs + Final Gates

Goal: docs match runtime, logs, session cleanup, and smoke behavior.

Validation:

- README links runtime, observability, session cleanup, and real smoke docs.
- `.env.example` includes log and real-smoke controls.

Tasks:

- Add `docs/runtime.md`.
- Add `docs/real-model-testing.md`.
- Update `docs/observability.md`.
- Update `docs/final-harness-audit.md`.

## Risks

- Real model may be missing or too weak. Mitigation: skip clearly when missing,
  fail with exact output when model is present but behavior fails.
- AgentMode controller remains large. Mitigation: shell is now small and new UI
  modules create stable seams for future extraction.
- UI regressions. Mitigation: build, lint, browser smoke, and keep changes scoped.
