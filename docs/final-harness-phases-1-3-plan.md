# Final Harness Phases 1-3 Plan

## Phase 1: Runtime And Session Cleanup

1. Lock Ollama-first runtime defaults with explicit regression tests.
2. Update stale docs/package text that still implies llama.cpp is the primary runtime.
3. Add conservative session cleanup types and implementation in `packages/session-store`.
4. Expose cleanup through `CoreEngine` and API only as an explicit operation.
5. Test cleanup preserves active sessions and only deletes stale sessions that satisfy explicit criteria.
6. Document cleanup guarantees and limitations.

## Phase 2: Agentic Planning Discipline

1. Add a bounded workspace document inventory helper.
2. Emit `intent_classified` immediately after intent classification.
3. Emit `workspace_doc_inventory` before planning.
4. Emit `agent_skill_selection` with selected active and operational skills.
5. Emit `workspace_context_collected` after bounded repo context is collected.
6. Emit `adaptive_plan_requested` before adaptive plan generation and keep validation logging.
7. Emit `current_goal_selected` when the first task step starts.
8. Add a direct-answer exception event only for trivial/direct cases.
9. Repair/block non-trivial direct model answers before required context/tool work.
10. Add unit and API tests for event ordering and the guard.

## Phase 3: Durable Observability

1. Add `packages/core/src/harness-log.ts` for log schema, redaction, prompt logging mode, safe paths, JSONL writes, summary writes, and read/list helpers.
2. Integrate durable logging into chat and agent runs without making log write failure fatal.
3. Add API endpoints:
   - `GET /api/logs/runs`
   - `GET /api/logs/runs/:runId`
   - `GET /api/logs/runs/:runId/summary`
4. Add an Agent-only compact run log panel in the web UI.
5. Add redaction and path traversal tests.
6. Update `.env.example`, README, and observability docs.

## Verification

Required local gates after implementation:

- `npm run build:packages`
- `npm run build:apps`
- `npm run build`
- `npm test`
- `npm run build --workspace web`
- `npm run lint --workspace web`

Optional live proof if time/environment allows:

- API smoke for `/api/logs/runs`.
- Agent stream smoke with the required planning events.
- Session cleanup smoke in a temp session directory.
