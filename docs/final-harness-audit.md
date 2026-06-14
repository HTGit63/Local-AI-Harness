# Final Harness Audit

Date: 2026-06-14

Scope: AGENTS.md Phase 0 plus the requested Phase 1, Phase 2, and Phase 3 work.

## Commit Anchor

- Current branch: `feature/final-harness-logs-tests-runtime-sessions`
- Current HEAD: `188b4448b76b3123dbbdfbacee6d137eecfe361b` (`AGENTS.md file update`)
- Required anchor commit found in local history: `2b76f3a Fix Ollama default runtime and clean sessions`
- Branch decision: the current branch contains `2b76f3a`, so the final branch was created from current HEAD to preserve the updated AGENTS instructions and the required runtime/session cleanup anchor.

## Baseline Commands

- `git status --short`: clean before source edits.
- `npm run build:packages`: passed before source edits.
- `npm run build --workspace @local-harness/api`: passed before source edits.
- `npm test`: passed before source edits.

## Target Commit Preservation

The target commit changed the runtime baseline from llama.cpp-first to Ollama-first and corrected Docker port assumptions.

Preserve these invariants:

- Default provider remains `ollama-legacy`.
- Default model remains `gemma4:e4b-it-qat`.
- Default Ollama base URL remains `http://127.0.0.1:11434/v1` locally.
- Docker UI host port remains `8080`.
- Optional llama.cpp fallback remains separate from the UI port and uses `8081` in Docker docs/config.
- Runtime fallback warnings stay provider-neutral.
- Chat Mode stays non-agentic and does not receive workspace/tool callbacks.

## Phase 1 Audit

Runtime surfaces checked:

- `packages/model-adapter/src/runtime-config.ts`
- `packages/model-adapter/src/client.ts`
- `apps/api/src/server.ts`
- `apps/web/src/app/agent/AgentMode.tsx`
- `.env.example`
- `Dockerfile.api`
- `docker-compose.yml`
- `README.md`
- `docs/local-models.md`

Findings:

- Runtime defaults currently match the target commit's Ollama-first intent.
- llama.cpp remains configured as fallback/optional runtime.
- `package.json` root description still says "llama.cpp or another OpenAI-compatible local runtime"; this is stale against the Ollama default.
- Existing tests cover parts of runtime selection, but Phase 1 needs explicit regression tests that guard the target defaults.

Session surfaces checked:

- `packages/session-store/src/store.ts`
- `packages/session-store/src/types.ts`
- `packages/core/src/engine.ts`
- `apps/api/src/server.ts`
- `.gamma-harness/sessions`
- `apps/api/.gamma-harness/sessions`

Findings:

- Session data is stored under `.gamma-harness/sessions` by default with JSON session files, turn sidecars, and an index.
- `deleteSession(id)` hard-deletes one selected session and sidecar.
- `listSessions()` reconciles stale index entries.
- There is no explicit conservative cleanup API for stale/temp sessions, no active-session protection result, and no test proving cleanup leaves normal sessions alone.

Phase 1 required fixes:

- Add scoped session cleanup that only operates inside the configured session store directory.
- Preserve the active session.
- Require explicit age criteria before deleting stale normal sessions.
- Return an auditable cleanup result.
- Add tests for runtime defaults and cleanup behavior.
- Document session cleanup behavior and runtime defaults.

## Phase 2 Audit

Agent pipeline surfaces checked:

- `packages/core/src/engine.ts`
- `packages/planner/src/index.ts`
- `packages/repo-indexer/src/index.ts`
- `packages/trace-bus/src/index.ts`
- `tests/unit/core.test.ts`
- `tests/e2e/api.test.ts`

Findings:

- Agent Mode already creates a task plan and can create adaptive plan artifacts.
- The required event order is incomplete. Missing or incomplete events include `intent_classified`, `workspace_doc_inventory`, `agent_skill_selection`, `workspace_context_collected`, `adaptive_plan_requested`, and `current_goal_selected`.
- Direct local answer paths exist for repo/workspace questions and need a clear logged exception path.
- Non-trivial agent requests need a stronger gate so the model cannot jump to a final answer before inventory/context/plan discipline is satisfied.

Phase 2 required fixes:

- Emit the full required planning/context event sequence.
- Add bounded workspace document inventory before planning.
- Log skill selection explicitly.
- Log workspace context collection explicitly.
- Emit `adaptive_plan_requested` before adaptive planning and keep `adaptive_plan_validated`.
- Emit `current_goal_selected` when work begins.
- Add a narrow `agent_direct_answer_allowed` exception for trivial/direct answers.
- Repair or block non-trivial direct final answers before tool/context execution.
- Add tests for event order and guard behavior.

## Phase 3 Audit

Observability surfaces checked:

- `packages/core/src/engine.ts`
- `packages/trace-bus/src/index.ts`
- `apps/api/src/server.ts`
- `apps/web/src/app/agent/AgentMode.tsx`

Findings:

- Current trace data is in-memory and exposed through `/api/trace`.
- There is no durable `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.jsonl` log.
- There is no durable summary JSON file.
- There are no `/api/logs/runs` endpoints.
- Prompt logging mode is not centrally controlled.
- Redaction is not centralized for durable logs.
- Agent UI has no compact durable-run log panel.

Phase 3 required fixes:

- Add a core durable log module.
- Write JSONL run logs and summary JSON files under `.gamma-harness/logs`.
- Support `HARNESS_LOG_PROMPTS=off|summary|full`, default `summary`.
- Redact secrets and credentials before writing or returning logs.
- Keep log write failures non-fatal and visible as warnings.
- Add safe read/list helpers that reject path traversal.
- Add API endpoints for log run list, run JSONL, and summary.
- Add an Agent-only compact log panel.
- Add tests for log write/read/redaction/API behavior.

## Risk Notes

- `apps/web/src/app/agent/AgentMode.tsx` is still a large file. Phase 3 UI work should stay scoped and avoid broad extraction unless needed.
- `packages/core/src/engine.ts` is large and stateful. Phase 2/3 changes should use small helper functions and a dedicated log module instead of spreading durable logging logic through unrelated code.
- Build artifacts must not be treated as source success. Final status must separate code changes, tests, and live runtime proof.
