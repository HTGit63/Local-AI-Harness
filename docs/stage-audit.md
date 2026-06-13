# Stage 1-5 Audit

Status date: `2026-06-13`

Branch: `feature/stage-1-to-5-harness-upgrade`

## Current Verdict

The `AGENTS.md` Stage 1 through Stage 5 implementation is complete in code and passes the root build/test gate.

Live runtime note: llama.cpp is configured as primary, but the local server at `http://127.0.0.1:8080/v1` was offline during verification. Ollama fallback at `http://127.0.0.1:11434/v1` was reachable and listed installed models.

## Stage Gate Status

| Stage | Gate | Status | Evidence |
|---|---|---|---|
| Stage 1 | Chat/Agent separation | Done | `apps/web/src/app/HarnessApp.tsx` is a thin shell; Chat and Agent live under separate mode folders; Chat requests send `mode: chat`, `agentic: false`, `workspaceRoot: null`, `allowTools: false`. |
| Stage 2 | Adaptive self-planning | Done | `packages/task-orchestrator/src/adaptive-plan.ts` owns adaptive contracts, validation, markdown/json rendering, fallback plans, and normalization into existing `TaskPlan` steps. |
| Stage 3 | llama.cpp/GGUF primary | Done | `packages/model-adapter/src/runtime-config.ts` defaults to llama.cpp primary; `.env.example`, `README.md`, and local-model docs define llama.cpp primary plus visible Ollama fallback. |
| Stage 4 | UI clarity redesign | Done | Landing, Chat, Agent, settings modal, runtime badge, workspace/status panels, markdown/KaTeX styling, and collapsed advanced details are implemented in the web app. |
| Stage 5 | Minimal diff/test visibility | Done | `MinimalDiffTestSummary` reuses existing `gitDiff`, `structuredDiff`, and verification traces; full diff/verification details are collapsed by default. |

## Additional Fixes Completed

- Chat and Agent now use lazy session creation: opening a mode or pressing New chat/New thread no longer creates empty saved threads.
- Chat thread titles now use a dedicated `SessionTurnMetadata.title` generated from the first words of the user message.
- Agent Mode blocks task submission until a real workspace is selected or confirmed; the default API package cwd is treated as unselected.
- Current saved session/thread files were cleared from `apps/api/.gamma-harness/sessions`.
- Runtime selection now keeps `gemma-4-gguf` as the llama.cpp alias and `gemma4:e4b` as the Ollama tag.
- Fallback runtime routing now uses the active endpoint model. If the configured fallback tag is missing, the adapter selects a listed installed model and reports a warning.

## Architecture Notes

- Main remaining size hotspot is `apps/web/src/app/agent/AgentMode.tsx`. It is functionally split by mode, but the Agent surface still owns many UI concerns in one file.
- `packages/core/src/engine.ts` remains the largest backend implementation file. The adaptive planning and runtime changes are integrated, but future work should extract chat session naming, runtime routing policy, and agent execution loop helpers.
- The Stage 5 panel is intentionally a view-only summary; it does not control agent execution.

## Verification Run

- `npm run build --workspace @local-harness/model-adapter` passed.
- `npm run build --workspace @local-harness/session-store` passed.
- `npm run build --workspace @local-harness/core` passed.
- `npm run build --workspace @local-harness/api` passed.
- `npm run build --workspace web` passed.
- `npm run lint --workspace web` passed.
- `npm run build` passed.
- `npm test` passed.
- Browser check: Agent workspace gate visible and Send disabled when workspace is unselected.
- Browser check: Chat history is empty after clearing sessions; New chat does not create an empty saved thread.
- API check: `/api/sessions` returned `[]` after cleanup.
- API check: `/api/model/runtime` reported llama.cpp primary offline and Ollama fallback connected.
- API check: `/api/models` listed available Ollama models.

## Known Limitations

- llama.cpp live generation was not proven because no llama.cpp server was running at `http://127.0.0.1:8080/v1`.
- A real model chat turn was not run during this audit to avoid triggering a long local-model load.
- `AgentMode.tsx` should be decomposed further in a future maintenance pass.
