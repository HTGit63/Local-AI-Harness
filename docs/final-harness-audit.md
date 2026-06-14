# Final Harness Audit

Date: 2026-06-14

Scope: AGENTS.md Phase 0 plus requested Phase 1 through Phase 7 work.

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

- `apps/web/src/app/agent/hooks/useAgentModeController.tsx` remains large after Phase 5. `AgentMode.tsx` is now a 7-line shell, and new extracted modules create stable extraction points, but the controller still needs future decomposition.
- `packages/core/src/engine.ts` is large and stateful. Phase 2/3 changes should use small helper functions and a dedicated log module instead of spreading durable logging logic through unrelated code.
- Build artifacts must not be treated as source success. Final status must separate code changes, tests, and live runtime proof.

## Phase 4 Result

Real-model smoke is implemented as opt-in script `npm run test:real-model`.

Coverage:

- Direct Chat with real local `nemotron-3-nano:4b`, asserting `harness-ok` and no tool events.
- Agent Inspect with real local runtime, asserting workspace inventory/context events and read/list/search tool execution without file changes.
- Agent Edit + Verify in `trusted-edit`, using a temp workspace, exact `patchFile`, `npm test`, verification events, durable JSONL, and summary JSON.

Latest real-model evidence:

```text
HARNESS_REAL_MODEL_TESTS=1 HARNESS_RUNTIME_PROVIDER=ollama-legacy HARNESS_MODEL=nemotron-3-nano:4b OLLAMA_MODEL=nemotron-3-nano:4b OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 npm run test:real-model
Real model smoke result:
- passed
- model: nemotron-3-nano:4b
- provider: ollama-legacy
- base URL: http://127.0.0.1:11434/v1
- run id: run_mqdq9ojirtqexe
```

Normal `npm test` still skips real-model work unless `HARNESS_REAL_MODEL_TESTS=1`.

## Phase 5 Result

Agent Mode shell and API/UI pieces are split:

- `apps/web/src/app/agent/AgentMode.tsx`: 7-line shell.
- `apps/web/src/app/agent/hooks/useAgentModeController.tsx`: existing controller moved behind hook.
- `apps/web/src/app/agent/agentApi.ts`: shared Agent Mode API helpers.
- `apps/web/src/app/agent/AgentTopBar.tsx`: runtime/workspace/write-mode top band.
- `apps/web/src/app/agent/AgentRunLogPanel.tsx`: durable run log list panel.

Residual debt: controller hook is still large. The Phase 5 requirement to make
`AgentMode.tsx` an orchestration shell is complete; deeper controller splitting
is intentionally left for a later focused pass.

## Phase 6 Result

UI hardening:

- Compact diff/test summary keeps changed files and verification visible first.
- Verification entries now show explicit `not-run` state.
- Full diff, raw trace, checkpoints, and log details remain collapsed.
- Unit helper coverage was added for diff-file stats and verification status mapping.

Stage 5 behavior hardening:

- Adaptive planning now has a bounded timeout via `HARNESS_ADAPTIVE_PLAN_TIMEOUT_MS`.
- Invalid or slow adaptive plans fall back to a validated template plan.
- Exact replacement prompts of the form ``in file change `old` to `new` `` route through deterministic `patchFile`.
- Backticked verification commands route through `runCommand` only when the current step allows verification tools.
- Deterministic final summaries are allowed only after write or command evidence, so read-only inspect flows still use model summaries.

## Phase 7 Result

Docs added or updated:

- `docs/runtime.md`
- `docs/real-model-testing.md`
- `docs/observability.md`
- `docs/final-harness-phases-4-7-plan.md`
- `conductor/index.md`
- `conductor/product.md`
- `conductor/tech-stack.md`
- `conductor/workflow.md`
- `conductor/tracks.md`
- `README.md`
- `.env.example`

## Phase 4-7 Validation Snapshot

Passed after final Phase 4-7 edits:

- `npm run build:packages`
- `npm run build:apps`
- `npm run build`
- `node --import tsx tests/unit/core.test.ts`
- `node --import tsx tests/e2e/api.test.ts`
- `npm test`
- `npm run build --workspace web`
- `npm run lint --workspace web`
- `HARNESS_REAL_MODEL_TESTS=1 HARNESS_RUNTIME_PROVIDER=ollama-legacy HARNESS_MODEL=nemotron-3-nano:4b OLLAMA_MODEL=nemotron-3-nano:4b OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 npm run test:real-model`
