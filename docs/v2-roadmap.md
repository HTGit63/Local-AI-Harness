# Gamma Local Harness v2 Roadmap

This roadmap supports the root `AGENTS.md` v2 contract. It is not proof that runtime behavior is implemented.

## Product Direction

Gamma Local Harness v2 is CLI-first, local-model-first, offline-capable, and proof-driven. It keeps task continuity in `.gamma-harness/agent_state.md`, executes one micro-step at a time, and refuses DONE without evidence.

## Phases

| Phase | Goal | DONE evidence |
|---|---|---|
| Phase 0: freeze expansion | Stop broad feature work and lock v2 docs contract. | `AGENTS.md` and ADR define v2 scope; no runtime files changed. |
| Phase 1: mode split | Separate Chat Mode and Agent Mode in CLI/runtime. | `gamma chat` cannot write by default; `gamma agent` owns task state. |
| Phase 2: persistent state file | Add mandatory `.gamma-harness/agent_state.md`. | Agent reads state first and updates it last. |
| Phase 3: one-step agent | Run exactly one micro-step and stop. | Integration test proves no open-ended loop. |
| Phase 4: evidence gate | Prevent DONE without task-type proof. | Missing proof returns `UNVERIFIED`. |
| Phase 5: minimal tool policy | Expose tools by phase only. | Read phases cannot see write tools. |
| Phase 6: checkpoint/diff/verify | Enforce edit safety chain. | Edit requires checkpoint, diff, and verification evidence. |
| Phase 7: CLI polish | Show compact operational status. | One-screen status includes phase, step, evidence, blocker, next action. |
| Phase 8: web dashboard | Display runtime state without owning orchestration. | Web mirrors state/traces/diffs/verification from shared runtime. |

## Implementation Status

Status as of 2026-05-07:

| Phase | Status | Evidence |
|---|---|---|
| Phase 0: freeze expansion | DONE | Root `AGENTS.md`, this roadmap, and ADR `0002-gamma-v2-workflow-reset` define v2 scope and forbid broad expansion. |
| Phase 1: mode split | DONE | `gamma chat` routes to direct Chat Mode; `gamma agent` owns task/status/state/step commands. Covered by CLI e2e tests. |
| Phase 2: persistent state file | DONE | Agent Mode creates, reads, validates, and updates `.gamma-harness/agent_state.md`. Covered by core unit and CLI e2e tests. |
| Phase 3: one-step agent | DONE | `gamma agent step` advances exactly one state-machine phase and stops. Covered by core unit and CLI e2e tests. |
| Phase 4: evidence gate | DONE | `gamma agent verify` applies task-type proof gates and blocks `DONE` as `UNVERIFIED` when proof is missing. Covered by core unit and CLI e2e tests. |
| Phase 5: minimal tool policy | DONE | Agent Mode exposes allowed tools by phase and blocks wrong-phase tool use. Covered by core unit and CLI e2e tests. |
| Phase 6: checkpoint/diff/verify | DONE | `gamma agent patch` creates checkpoint, applies one file patch, records diff, and requires verification before DONE. Covered by core unit and CLI e2e tests. |
| Phase 7: CLI polish | DONE | `gamma agent status` renders compact task, phase, step, evidence, checkpoint, verification, blocker, tool, state, and next-action facts. Covered by CLI e2e tests. |
| Phase 8: web dashboard | DONE | Activity tab reads `/api/agent/dashboard` plus existing traces, approvals, and diff state without owning orchestration. Covered by API e2e and web build. |

## Guardrails

- No provider-routing expansion before workflow reliability.
- No web UI expansion before CLI loop stability.
- No multi-agent/subagent behavior before one-agent workflow is stable.
- No vector DB or heavy RAG in v2 foundation.
- No all-skills hot path.
- No broad runtime rewrite in one pass.

## First Safe Implementation Sequence

1. Implement CLI command split.
2. Add Agent state file schema and persistence.
3. Add one-step Agent execution.
4. Add evidence-gated status transitions.
5. Add phase tool allowlist.
6. Enforce checkpoint/diff/verify around edits.
7. Polish CLI status.
8. Build web dashboard only after CLI proof exists.
