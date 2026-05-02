# Plan: TASK-01 and TASK-02 for the action DSL experiment

**Generated**: 2026-04-30
**Estimated Complexity**: High

## Overview
Build the first two experiment layers from `Gemma 4 Harness/AGENTS.md`:

1. Expose the new experimental config surface so the harness can select `native_tools`, `action_dsl`, or `workflow_runner` and show the active protocol/model in public config.
2. Add a dedicated `model-router` package that chooses model roles, enforces a heavy-model lock, and makes routing decisions visible in trace output.

The order matters. Task 1 makes the experiment configurable and observable. Task 2 uses that config to route model selection safely. Direct chat must keep working throughout.

## Prerequisites
- Work on branch `experiment/action-dsl-workflow-26b`.
- Baseline repository state should still build before edits.
- Existing Ollama/model lifecycle behavior should be left intact unless Task 2 needs a narrow hook.
- The web UI config shape and API config payload must stay aligned.

## Sprint 1: Experimental Config Surface
**Goal**: Add protocol and model fields without breaking current direct-chat behavior.

**Demo/Validation**:
- `npm run build` passes.
- `GET /api/config` returns the new protocol/model fields.
- Web settings surface can show the active protocol and agent model.
- Existing direct chat still sends and returns messages normally.

### Task 1.1: Extend config types and defaults
- **Location**: `packages/model-adapter/src/config.ts`, `packages/model-adapter/src/types.ts`, `packages/core/src/engine.ts`
- **Description**: add `HARNESS_AGENT_PROTOCOL`, `HARNESS_AGENT_MODEL`, and `HARNESS_SUMMARY_MODEL`; preserve existing `fastModel`, `codingModel`, `reviewModel`, and `apiModel` behavior; default agentic mode to `action_dsl` for the experimental branch.
- **Dependencies**: none
- **Acceptance Criteria**:
  - Public config includes protocol, agent model, and summary model fields.
  - Existing model fields remain available and unchanged for current callers.
  - Config updates keep backward compatibility with current POST payloads.
- **Validation**:
  - Update `tests/unit/core.test.ts` to assert default values and config round-trip behavior.

### Task 1.2: Surface config through API and UI
- **Location**: `apps/api/src/server.ts`, `apps/web/src/HarnessApp.tsx`, optionally `apps/cli/src/cli.ts` if the CLI prints config state
- **Description**: accept the new config fields in the POST handler, return them from `/api/config`, and show the active protocol and agent model in the web settings/status surface.
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - `/api/config` GET/POST includes the new fields.
  - UI types match the backend response shape.
  - The user can see which protocol is active without opening raw JSON.
- **Validation**:
  - Update `tests/e2e/api.test.ts` for the new config shape.
  - Run a typecheck/build to catch stale frontend config types.

### Task 1.3: Confirm direct mode remains stable
- **Location**: `tests/unit/core.test.ts`, `tests/e2e/api.test.ts`
- **Description**: add regression coverage that exercises config updates while keeping direct chat behavior unchanged.
- **Dependencies**: Tasks 1.1-1.2
- **Acceptance Criteria**:
  - Direct chat still completes after the config changes.
  - Existing model switching behavior is not broken by the new fields.
- **Validation**:
  - `npm test`

## Sprint 2: Model Router Package
**Goal**: Add a separate routing layer that selects models by role and prevents concurrent heavy-agent runs.

**Demo/Validation**:
- `npm run build` passes with the new package in the workspace.
- Router tests show the selected role and fallback path.
- Two heavy agentic runs cannot execute at the same time.
- Trace output records routing decisions.

### Task 2.1: Scaffold the package and public interfaces
- **Location**: `packages/model-router/package.json`, `packages/model-router/src/types.ts`, `packages/model-router/src/router.ts`, `packages/model-router/src/ram-governor.ts`, `packages/model-router/src/index.ts`
- **Description**: create the workspace package, define model roles (`fast`, `agent`, `coding`, `review`, `summary`), and export the routing API the core engine can call.
- **Dependencies**: Sprint 1 config names should be stable
- **Acceptance Criteria**:
  - Package builds as a workspace dependency.
  - Router inputs/outputs are typed and importable from `@local-harness/model-router`.
- **Validation**:
  - Package-level TypeScript build succeeds.

### Task 2.2: Implement role selection and RAM governor
- **Location**: `packages/model-router/src/router.ts`, `packages/model-router/src/ram-governor.ts`
- **Description**: choose a model by workflow step purpose, add a heavy-model lock for agentic requests, and make the router fail clearly when the 26B agent model is not installed or cannot be activated.
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - Router can return a model for each role.
  - A second heavy agentic request is blocked, queued, or rejected according to the governor design.
  - Missing-model fallback is explicit instead of silent.
- **Validation**:
  - Unit test the role map, lock behavior, and fallback path.

### Task 2.3: Wire routing decisions into runtime traces
- **Location**: `packages/core/src/engine.ts`, `packages/model-adapter/src/client.ts`, `apps/api/src/server.ts`
- **Description**: ask the router before agentic execution, emit `model_route_selected` and heavy-lock trace events, and expose the selected route in runtime state so the UI can show it.
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - Agentic mode uses the router result instead of only the raw configured model.
  - Trace log shows the selected role, model, and fallback reason when relevant.
  - The UI/API can tell whether the 26B model is actually active.
- **Validation**:
  - Add trace assertions in tests and a smoke run that inspects runtime state.

### Task 2.4: Add concurrency and fallback regression coverage
- **Location**: `tests/unit/core.test.ts`, new router test file under `tests/unit/`, and `package.json` test script if the new test file must be added explicitly
- **Description**: prove that two heavy agentic runs do not proceed concurrently and that fallback behavior is visible when the preferred model is unavailable.
- **Dependencies**: Tasks 2.2-2.3
- **Acceptance Criteria**:
  - Tests fail if the governor allows overlapping heavy runs.
  - Tests fail if the router hides fallback or route-selection details.
- **Validation**:
  - `npm test`

## Testing Strategy
- Run `npm run build` after Task 1 and again after Task 2.
- Run `npm test` after config work and after router integration.
- Verify `/api/config` directly with a curl or browser request before trusting the UI.
- Verify trace output for route selection, fallback, and lock acquisition/release.

## Potential Risks & Gotchas
- The web app has its own `ConfigState` type, so backend config changes can compile in the server but still break the UI if the frontend shape is not updated.
- `npm test` is hard-coded to specific test files, so any new router test file must be added to the runner or it will never execute.
- Task 2 depends on the config names from Task 1. If those names drift, the router will be wired against stale assumptions.
- The actual web entrypoint is `apps/web/src/HarnessApp.tsx`, not the older path shown in the docs, so edits need to hit the real file.

## Rollback Plan
- Revert the config additions in `packages/model-adapter/src/*`, `packages/core/src/engine.ts`, `apps/api/src/server.ts`, and `apps/web/src/HarnessApp.tsx` if Task 1 causes regressions.
- Remove the `packages/model-router/` workspace and any core wiring to it if Task 2 destabilizes routing or concurrency.
- Leave direct chat and the existing native-tools path intact as the fallback baseline.
