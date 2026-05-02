# AGENTS.md — Local AI Harness Agentic Overhaul Contract

> Target branch: `experiment/action-dsl-workflow-26b`
>
> Repository: `HTGit63/Local-AI-Harness`
>
> Purpose: experimental rebuild contract for the agentic runtime without throwing away the existing TypeScript harness.
>
> Primary experiment set:
>
> 1. Action DSL Agent
> 2. Harness-Managed Workflow Runner
> 3. 26B-first model router for `VladimirGav/gemma4-26b-16GB-VRAM:latest`
>
> This file is intentionally operational. It is not a motivational plan. A coding agent should be able to follow it task by task.

---

# 0. Hard truth

The current harness is not failing because TypeScript is inherently bad. It is failing because the agentic path has too many soft contracts. The model is asked to behave like an autonomous coding agent, but the runtime does not force enough structure.

The existing codebase already contains the important pieces:

- web UI
- API
- CLI
- core engine
- model adapter
- planner
- trace bus
- tool runtime
- approval workflow
- session store
- repo indexer
- workspace policy

The experimental branch must therefore avoid a full rewrite and instead replace the weakest contracts in the execution loop.

The previous architecture heavily favors native Ollama chat/tool behavior. That is risky because native tool-calling reliability varies by model, wrapper, prompt, quantization, and runtime behavior.

The working model was not the small default `gemma4:e4b`. The working model was:

```text
VladimirGav/gemma4-26b-16GB-VRAM:latest
```

This changes the design target. The 26B model may reason better, but it can consume most available RAM. The harness must not load multiple large models or create uncontrolled context growth.

This file is the new experimental operating contract. Any coding agent must follow it before making changes.

---

# 1. Experimental goals

Build one branch that tests three linked ideas together.

## Goal 1 — Action DSL Agent

Stop relying on native tool calls as the only serious agentic path. Add a strict JSON action protocol that the model can emit and the runtime can parse, validate, execute, repair, and trace.

## Goal 2 — Harness-Managed Workflow Runner

Stop letting the model freely drive long workflows. The harness should own workflow state and step order. The model should only make bounded decisions inside each step.

## Goal 3 — 26B-first Router

Treat `VladimirGav/gemma4-26b-16GB-VRAM:latest` as the serious agentic model while protecting RAM through model lifecycle control, strict concurrency limits, smaller context windows, and explicit runtime health gates.

The experiment succeeds only if agentic mode becomes more concrete:

```text
inspect files
execute tools
preview diffs
wait for approval
apply changes
verify results
summarize accurately
```

---

# 2. Huge issues that must be fixed

## 2.1 Native tool dependence is too fragile

The current native-first path assumes the model will emit correct runtime-native tool calls. When it emits planning prose, fake tool tags, or malformed tool arguments, the harness can look busy while doing nothing useful.

Native tool calling should remain available, but it must no longer be the only default serious path for agentic work.

## 2.2 The planner plans but does not enforce enough

The current planner and task orchestrator create useful task structures, but the model still has too much freedom.

A plan is not execution.

The harness must enforce:

- step order
- allowed tools
- budgets
- completion criteria
- recovery path
- approval boundaries

## 2.3 Manual fallback is treated like backup instead of a real operating lane

Fallback should not be hidden. If native tools fail or are inappropriate, the system should move into an explicit Action DSL or manual JSON lane with visible trace events and strict validation.

## 2.4 Model routing still carries the old small-model assumption

The repo still treats `gemma4:e4b` as the conceptual default. That is fine for direct chat and fast summaries, but not for serious agentic coding.

The experiment must create model roles and make agentic mode prefer the 26B model when available.

## 2.5 RAM pressure is a first-class design constraint

The 26B model can fill RAM on a 16 GB machine.

The harness must:

- unload other models before serious agentic work
- prevent concurrent heavy requests
- limit context growth
- avoid loading multiple large models
- shorten keep-alive windows
- show current loaded model status clearly
- stop agentic execution if the active model is not actually the selected model

## 2.6 UI visibility is still too much activity log and not enough execution story

The UI must show:

- workflow type
- current step
- current action
- tool input
- tool result
- diff preview
- approval state
- verification state
- final ledger

The user must never need to guess whether the agent actually changed files.

## 2.7 Tests overfit mocked happy paths

Mocks are useful, but the experiment must add real local Ollama smoke tests.

If the model cannot read a file, produce one valid action, preview a diff, and summarize the result, agentic mode is not ready.

## 2.8 Workspace truth must stay unified

Browser folder snapshots, backend workspace root, and actual tool execution root must be visibly distinguished.

Agentic file writes must only happen against the backend workspace root, never against a fake browser-only assumption.

## 2.9 Prompting alone is not enough

The fix is not just stronger prompts.

The runtime must:

```text
parse
validate
reject
repair
execute
trace
verify
summarize
```

Prompts support the architecture. They do not replace it.

---

# 3. Non-negotiable constraints

- Keep the existing TypeScript monorepo.
- Do not rewrite the whole harness in Python or Rust on this branch.
- Do not remove direct chat.
- Do not remove the existing tool runtime, approval workflow, workspace policy, session store, trace bus, or web UI.
- Do not make `danger` mode the default.
- Do not allow file writes outside the workspace.
- Do not silently load multiple heavy models.
- Do not run full builds automatically unless the workflow explicitly selects that verification level.
- Do not show fake thinking.
- Do not pretend tool execution happened.
- Do not call the experiment successful without real local model smoke tests.

---

# 4. Branch setup workflow

Use this exact branch:

```bash
git checkout main
git pull
git checkout -b experiment/action-dsl-workflow-26b
```

Install and baseline:

```bash
npm install
npm run build
npm test
node apps/cli/dist/cli.js doctor --json
node apps/cli/dist/cli.js model status --json
```

Set the serious agentic model:

```bash
export HARNESS_FAST_MODEL="gemma4:e4b"
export HARNESS_AGENT_MODEL="VladimirGav/gemma4-26b-16GB-VRAM:latest"
export HARNESS_CODING_MODEL="VladimirGav/gemma4-26b-16GB-VRAM:latest"
export HARNESS_REVIEW_MODEL="VladimirGav/gemma4-26b-16GB-VRAM:latest"
export HARNESS_SUMMARY_MODEL="gemma4:e4b"
export HARNESS_MODEL_KEEP_ALIVE="90s"
export HARNESS_AGENT_MAX_CONCURRENCY="1"
export HARNESS_AGENT_PROTOCOL="action_dsl"
```

Before running agentic mode, inspect loaded models:

```bash
ollama ps
```

If the adapter lifecycle control fails, manually unload unrelated heavy models.

Run API and web UI:

```bash
npm run dev --workspace @local-harness/api
npm run dev --workspace web
```

Do not start implementation until baseline build and tests are known.

---

# 5. New architecture target

Add three new layers without duplicating the whole harness.

```text
packages/action-dsl/
  src/schema.ts
  src/parser.ts
  src/validator.ts
  src/repair.ts
  src/executor.ts
  src/index.ts

packages/workflow-runner/
  src/types.ts
  src/runner.ts
  src/workflows/inspect-project.ts
  src/workflows/fix-single-file.ts
  src/workflows/small-patch.ts
  src/workflows/repo-audit.ts
  src/index.ts

packages/model-router/
  src/types.ts
  src/router.ts
  src/ram-governor.ts
  src/index.ts
```

Integrate through:

```text
packages/core/src/engine.ts
packages/model-adapter/src/client.ts
apps/api/src/server.ts
apps/web/src/app/HarnessApp.tsx
packages/session-store/src/types.ts
packages/trace-bus/src/*
tests/unit/*
tests/integration/*
tests/e2e/*
```

---

# 6. Action DSL contract

The Action DSL is the primary experiment. The model must emit exactly one JSON object during action turns.

## 6.1 Allowed action shapes

Tool action:

```json
{
  "kind": "action",
  "action": "read_file",
  "args": {
    "path": "package.json"
  }
}
```

Patch proposal:

```json
{
  "kind": "action",
  "action": "propose_patch",
  "args": {
    "path": "src/index.ts",
    "oldText": "export const x = 1;",
    "newText": "export const x = 2;"
  }
}
```

Final answer:

```json
{
  "kind": "final",
  "summary": "The project uses a Vite web app and a local API server.",
  "filesChanged": [],
  "verification": "No files changed."
}
```

Blocker:

```json
{
  "kind": "blocker",
  "reason": "The target file does not exist and no likely equivalent was found.",
  "nextSafeStep": "Ask the user for the correct file path."
}
```

## 6.2 Allowed actions for v1

```text
list_dir
read_file
search_text
glob
build_context_pack
find_symbol
find_function
get_structured_diff
create_checkpoint
propose_patch
write_file_preview
apply_approved_change
run_command_preview
run_selected_command
final_answer
blocker
```

## 6.3 Parser requirements

The parser must:

- extract JSON even if the model wraps it in markdown once;
- reject multiple actions in one response;
- reject unknown actions;
- reject missing required arguments;
- normalize aliases like `filePath` to `path` only when safe;
- return structured parse errors for repair prompts;
- never execute an unvalidated action.

## 6.4 Repair requirements

If parsing fails:

1. Send one short repair prompt with the exact parse error.
2. Allow one corrected response.
3. If it fails again, stop the workflow step and emit a visible `action_dsl_parse_failed` event.

Do not loop forever.

---

# 7. Harness-managed workflow contract

The workflow runner owns the step order. The model does not free-roam.

## 7.1 Workflow lifecycle

```text
created
started
step_running
waiting_for_model_action
waiting_for_tool
waiting_for_approval
verifying
completed
failed
blocked
cancelled
```

## 7.2 Workflow state fields

Each workflow state must include:

```text
workflowId
workflowType
runId
sessionId
workspaceRoot
modelRole
protocol
currentStepId
steps[]
filesRead[]
filesChanged[]
approvals[]
commands[]
errors[]
createdAt
updatedAt
```

## 7.3 Initial workflows

Implement these four workflows first:

1. `inspect_project`
2. `fix_single_file`
3. `small_patch`
4. `repo_audit`

Do not implement ten workflows before these four are stable.

---

# 8. 26B-first routing and RAM contract

The router must understand model roles.

```text
fastModel       = gemma4:e4b
agentModel      = VladimirGav/gemma4-26b-16GB-VRAM:latest
codingModel     = VladimirGav/gemma4-26b-16GB-VRAM:latest
reviewModel     = VladimirGav/gemma4-26b-16GB-VRAM:latest
summaryModel    = gemma4:e4b
```

## 8.1 RAM governor rules

- Only one agentic model request may run at a time.
- Before agentic workflow starts, check active Ollama models.
- If a different heavy model is loaded, attempt to unload it.
- Do not load 26B and another heavy coding model simultaneously.
- Keep alive should default to short duration such as `90s` or `2m`, not indefinite.
- Context budget must be conservative at first.
- If runtime memory pressure is detected or inferred from repeated stalls, reduce context and stop automatic verification commands.
- UI must show `configuredModel`, `activeModel`, `agentModel`, and `heavyModelLock` status.

## 8.2 Suggested initial budgets

```text
direct chat: 4k-8k context
agent action step: 8k-12k context
patch drafting: 12k-16k context
repo audit: max 16k context with summaries, not raw full repo
max output per action: 1k-2k tokens
max action repair attempts: 1
max concurrent agent runs: 1
```

Do not start with 64k or 128k context just because the model advertises a large context. On a 16 GB machine, that can make the system unusable.

---

# 9. Fifteen implementation tasks

## TASK-01 — Create the experimental configuration surface

### Goal

Add explicit configuration for the combined experiment without breaking existing behavior.

### Files to inspect first

```text
packages/core/src/engine.ts
packages/model-adapter/src/config.ts
packages/model-adapter/src/types.ts
apps/api/src/server.ts
apps/web/src/app/HarnessApp.tsx
```

### Required work

- Add `HARNESS_AGENT_PROTOCOL` with values `native_tools`, `action_dsl`, and `workflow_runner`.
- Add `HARNESS_AGENT_MODEL` and `HARNESS_SUMMARY_MODEL`.
- Preserve existing `fastModel`, `codingModel`, `reviewModel`, and `apiModel` fields.
- Add public config fields so the UI can show the active protocol and agent model.
- Default experimental branch behavior should prefer `action_dsl` for agentic mode.

### Done means

- `npm run build` passes.
- `/api/config` returns the new protocol/model fields.
- Existing direct chat still works.

### Current status

- TASK-01 done: config/API/UI/CLI expose protocol and agent/summary model fields; direct chat remains separate; `agent-smoke` defaults to `action_dsl` while `native_tools` remains the compatibility baseline.

---

## TASK-02 — Add the model-router package

### Goal

Create a dedicated router for model role selection and RAM-safe routing.

### Files to create

```text
packages/model-router/package.json
packages/model-router/src/types.ts
packages/model-router/src/router.ts
packages/model-router/src/ram-governor.ts
packages/model-router/src/index.ts
```

### Required work

- Define model roles: `fast`, `agent`, `coding`, `review`, `summary`.
- Select model by workflow step purpose.
- Add a heavy-model lock for agentic requests.
- Add trace events for model route selection.
- Add clear fallback when the 26B model is not installed.

### Done means

- Agentic mode can ask router for the correct model.
- The selected route is visible in trace.
- Tests prove no two heavy agentic runs execute concurrently.

### Current status

- TASK-02 done: `packages/model-router` now owns model role selection, unload candidate selection, and serialized heavy-model locking; core uses it for agentic route/lock behavior and unit tests prove lock serialization.

---

## TASK-03 — Add Ollama lifecycle and RAM governor integration

### Goal

Protect the machine from loading too much at once.

### Files to inspect first

```text
packages/model-adapter/src/client.ts
packages/core/src/engine.ts
apps/api/src/server.ts
```

### Required work

- Before agentic run, inspect active Ollama models.
- Try to unload unrelated heavy models.
- Load or warm the agent model only when needed.
- Add a short keep-alive policy for the 26B model.
- Emit events:
  - `model_route_selected`
  - `heavy_model_lock_acquired`
  - `heavy_model_lock_released`
  - `model_unload_attempted`
  - `model_warmup_completed`

### Done means

- UI/API can show whether the 26B model is actually active.
- Agentic mode does not silently run against the wrong model.
- If 26B cannot load, the run fails clearly instead of pretending.

---

## TASK-04 — Create the Action DSL schema and parser

### Goal

Create a strict action protocol independent of native Ollama tool calls.

### Files to create

```text
packages/action-dsl/package.json
packages/action-dsl/src/schema.ts
packages/action-dsl/src/parser.ts
packages/action-dsl/src/validator.ts
packages/action-dsl/src/index.ts
```

### Required work

- Define TypeScript types for all allowed actions.
- Parse exact JSON.
- Extract JSON from markdown only as a repair convenience.
- Reject multiple JSON objects.
- Validate action names and required args.
- Return structured parse errors.

### Done means

- Unit tests cover:
  - valid actions
  - malformed JSON
  - unknown action
  - missing args
  - multiple actions
  - markdown-wrapped JSON

---

## TASK-05 — Create the Action DSL executor

### Goal

Map valid Action DSL objects to the existing tool runtime safely.

### Files to create or modify

```text
packages/action-dsl/src/executor.ts
packages/core/src/engine.ts
packages/tool-runtime/src/registry.ts
```

### Required work

- Map `read_file` to existing `readFile`.
- Map `list_dir` to `listDir`.
- Map `search_text` to `searchText`.
- Map `propose_patch` to diff preview, not immediate write.
- Require approval before applying writes.
- Record every action as trace.

### Done means

- A model action can read a file and receive the real result.
- A patch action produces a visible diff preview.
- No write happens without policy and approval.

---

## TASK-06 — Add Action DSL repair loop

### Current status

- TASK-03 done: agentic runs warm 26B, unload unrelated heavy models, expose active agent/runtime state in UI/API, and emit lifecycle traces.
- TASK-04 done: `packages/action-dsl` exists with strict JSON parser, validator, and unit coverage for valid, malformed, unknown, missing-arg, multiple-action, and fenced JSON cases.
- TASK-05 done: `ActionDslExecutor` maps reads, list, search, diff preview, patch preview, write/apply, and command actions through the tool runtime with trace events.
- TASK-06 done: malformed Action DSL now repairs once, then stops visibly with parse-failure traces and UI-safe blocker text.

### Goal

Make malformed model actions recover once, then fail visibly.

### Files to create or modify

```text
packages/action-dsl/src/repair.ts
packages/core/src/engine.ts
packages/prompt-recipes/src/recipes.ts
```

### Required work

- Add a short repair prompt containing the parser error.
- Allow one repair attempt.
- If repair fails, stop the step.
- Emit:
  - `action_dsl_repair_started`
  - `action_dsl_repair_succeeded`
  - `action_dsl_parse_failed`

### Done means

- Bad JSON does not crash the run.
- Bad JSON does not cause infinite loops.
- UI shows the parse failure in a useful way.

---

## TASK-07 — Replace default agentic loop with protocol-selected execution

### Goal

Make `agentic` choose between native tools, Action DSL, and workflow runner.

### Files to modify

```text
packages/core/src/engine.ts
apps/api/src/server.ts
apps/web/src/app/HarnessApp.tsx
```

### Required work

- If `HARNESS_AGENT_PROTOCOL=action_dsl`, agentic mode uses Action DSL loop.
- If `native_tools`, preserve current path.
- If `workflow_runner`, use workflow runner.
- Direct chat must not be affected.
- Trace must show selected protocol.

### Done means

- Protocol can be changed from config.
- UI shows protocol for each run.
- Existing native path remains available for comparison.

### Current status

- TASK-07 done: agentic runs now switch by protocol, direct chat stays untouched, traces record the selected protocol, and the UI surfaces the run protocol.

---

## TASK-08 — Create workflow-runner package

### Goal

Introduce harness-owned workflow state.

### Files to create

```text
packages/workflow-runner/package.json
packages/workflow-runner/src/types.ts
packages/workflow-runner/src/runner.ts
packages/workflow-runner/src/index.ts
```

### Required work

- Define workflow state machine.
- Define workflow steps.
- Define transition validation.
- Emit workflow events.
- Store workflow state in session/run summaries.

### Done means

- A workflow can start, advance steps, block, fail, and complete.
- Workflow state can be serialized and resumed.

### Current status

- TASK-08 done: `packages/workflow-runner` now owns workflow state, validates transitions, emits workflow events, and round-trips workflow data through run/session summaries.

---

## TASK-09 — Implement `inspect_project` workflow

### Goal

Create the safest first workflow.

### Required steps

```text
1. detect project commands
2. list top-level workspace
3. read package/manifests
4. read README if present
5. build compact context pack
6. ask model for final structured summary
```

### Done means

- It can summarize a repo without editing files.
- It produces a final answer with files read and commands detected.
- It avoids reading the entire repo.

### Current status

- TASK-09 done: `inspect_project` now detects commands, reads top-level files plus manifests/README, builds the compact context pack, and returns a final structured summary.

---

## TASK-10 — Implement `fix_single_file` workflow

### Goal

Create a reliable edit workflow for one target file.

### Required steps

```text
1. confirm target file exists
2. create checkpoint
3. read target file
4. ask model for Action DSL patch proposal
5. preview diff
6. wait for approval
7. apply approved patch
8. get structured diff
9. run selected verification if available
10. summarize
```

### Done means

- The workflow can modify one file safely.
- The user sees the diff before applying.
- The final summary does not claim unverified work.

### Current status

- TASK-10 done: `fix_single_file` now confirms one target, checkpoints, previews diff, waits for approval, applies the approved patch, runs verification, and summarizes the result.

---

## TASK-11 — Implement `small_patch` workflow

### Goal

Support realistic coding tasks that touch one to three files.

### Required steps

```text
1. build context pack
2. find relevant symbols/files
3. read up to three files
4. create checkpoint
5. ask model for patch actions
6. preview all diffs
7. require approval
8. apply approved patches
9. get structured diff
10. select tests or commands
11. run targeted verification
12. summarize
```

### Done means

- Multi-file chaos is avoided.
- The model cannot rewrite the repo.
- All changed files appear in the run ledger.

### Current status

- TASK-11 done: `small_patch` now handles one to three files, builds per-file patch actions, previews combined diffs, gates approval, runs verification, and summarizes the change set.

---

## TASK-12 — Implement `repo_audit` workflow

### Goal

Support broad inspection without accidental broad editing.

### Required steps

```text
1. detect commands
2. build context pack
3. inspect architecture files
4. inspect tests/config
5. identify risks
6. produce report
```

### Done means

- Repo audit never writes files by default.
- It reports evidence and file paths.
- It can suggest follow-up workflows instead of editing immediately.
- Status: done.

---

## TASK-13 — Upgrade UI run console for workflows and Action DSL

### Goal

Make the user see exactly what is happening.

### Files to inspect first

```text
apps/web/src/app/HarnessApp.tsx
apps/web/src/components/run-console/*
apps/web/src/components/ChatMessageRow.tsx
apps/web/src/types/run.ts
```

### Required work

- Show protocol: `native_tools`, `action_dsl`, or `workflow_runner`.
- Show workflow type and step progress.
- Show current action object in readable form.
- Show parser repair failures.
- Show approval and diff previews inline.
- Show loaded model and heavy-model lock state.

### Done means

- User can tell whether the model is thinking, acting, waiting, blocked, or done.
- User can tell whether 26B is active.
- User can tell what files changed.
- Status: done.

---

## TASK-14 — Add real local smoke tests and benchmarks

### Goal

Stop relying only on mocks.

### Files to create or modify

```text
packages/doctor/src/benchmark.ts
apps/cli/src/cli.ts
tests/e2e/*
scripts/smoke-agentic.sh
```

### Required smoke tests

```bash
node apps/cli/dist/cli.js agent-smoke \
  --task "Read package.json and tell me the package name" \
  --require-action read_file

node apps/cli/dist/cli.js agent-smoke \
  --task "Create hello.txt with the word hello" \
  --require-approval \
  --require-diff

node apps/cli/dist/cli.js agent-smoke \
  --task "Inspect this repo and identify the API entry file" \
  --workflow inspect_project
```

### Done means

- Smoke tests can run against real Ollama.
- Failing smoke tests give useful error messages.
- Benchmark reports:
  - protocol
  - model
  - first-token time
  - total time
  - tool count
  - parse failures
  - memory/routing notes when available
- Status: done.

---

## TASK-15 — Document, compare, and decide what survives

### Goal

Make the experiment reviewable.

### Files to create

```text
docs/experiments/action-dsl-workflow-26b.md
docs/experiments/results-template.md
```

### Required work

- Document what changed.
- Compare native tools vs Action DSL vs workflow runner.
- Record 26B behavior and RAM issues.
- Record smoke test results.
- Recommend which path becomes default.

### Done means

- The branch produces a decision, not just code.
- The user can choose whether to merge the whole experiment or only part of it.

### Current status

- Status: done.
- TASK-15 done: `docs/experiments/action-dsl-workflow-26b.md` documents what changed, compares `native_tools` vs `action_dsl` vs `workflow_runner`, records 26B RAM behavior, records smoke results, and recommends the merge/default path.
- TASK-15 template done: `docs/experiments/results-template.md` gives a repeatable evidence format for future protocol/model runs.
- Live 26B smoke status: blocked by current RAM, with Ollama reporting `model requires more system memory (14.9 GiB) than is available (14.1 GiB)`; smaller-model live smoke verified workflow/read and approval/write paths.

---

# 10. Prompt rules for the coding agent

When working in this branch, the coding agent must obey these rules:

- Inspect before editing.
- Prefer small patches over rewrites.
- Never claim a file changed unless a tool actually changed it.
- Never claim a test passed unless it ran or was explicitly skipped with reason.
- Keep the Action DSL narrow.
- Keep workflows deterministic.
- Keep 26B usage serialized.
- Keep UI state honest.
- Keep direct chat fast.
- Add tests with every runtime change.
- Update docs after changing behavior.

---

# 11. Acceptance gate for the whole branch

The branch is not successful until all of these pass:

```bash
npm run build
npm test
node apps/cli/dist/cli.js doctor --json
node apps/cli/dist/cli.js model status --json
```

And at least these real local smoke tests pass with Ollama:

```bash
node apps/cli/dist/cli.js agent-smoke \
  --task "Read package.json and tell me the package name" \
  --require-action read_file

node apps/cli/dist/cli.js agent-smoke \
  --task "Inspect this repo and identify the API entry file" \
  --workflow inspect_project
```

A write smoke test should pass only after approval workflow is confirmed:

```bash
node apps/cli/dist/cli.js agent-smoke \
  --task "Create hello.txt with the word hello" \
  --require-approval \
  --require-diff
```

---

# 12. Final judgment standard

This branch should answer three questions:

1. Does Action DSL make the 26B model act more reliably than native tool calls?
2. Does a harness-managed workflow runner make agentic mode feel real instead of fake-autonomous?
3. Can the harness use `VladimirGav/gemma4-26b-16GB-VRAM:latest` without destroying the machine through RAM pressure?

If the answer is yes, merge the architecture gradually.

If the answer is no, keep the UI and tool runtime, but consider a smaller Python backend experiment later.

Do not jump to Rust or a full rewrite until these three questions are answered.

---

# 13. Implementation order

Use this sequence:

```text
TASK-01 [done] config
TASK-02 [done] model-router
TASK-03 [done] RAM governor
TASK-04 [done] Action DSL schema/parser
TASK-05 [done] Action DSL executor
TASK-06 [done] Action DSL repair
TASK-07 [done] protocol-selected agentic loop
TASK-08 [done] workflow-runner base
TASK-09 [done] inspect_project workflow
TASK-10 [done] fix_single_file workflow
TASK-11 [done] small_patch workflow
TASK-12 [done] repo_audit workflow
TASK-13 [done] UI run console
TASK-14 [done] smoke tests
TASK-15 [done] experiment report
```

Do not build UI first. Do not build workflows before the Action DSL parser/executor works.

---

# 14. Minimal first milestone

The first milestone is intentionally small:

```text
User asks: "Read package.json and tell me the package name."

Expected:
1. agentic protocol = action_dsl
2. model emits read_file action
3. runtime validates action
4. runtime executes readFile
5. model receives result
6. model emits final answer
7. UI shows action and result
```

If this does not work, nothing else matters.

---

# 15. Second milestone

```text
User asks: "Create hello.txt with the word hello."

Expected:
1. model emits write_file_preview action
2. runtime creates diff/preview
3. approval is required
4. after approval, file is written
5. structured diff is shown
6. final summary names the changed file
```

If this does not work, do not continue to multi-file workflows.

---

# 16. Third milestone

```text
User asks: "Inspect this repo and identify the API entry file."

Expected:
1. workflow = inspect_project
2. harness detects commands
3. harness lists top-level files
4. harness reads package manifests
5. harness identifies API entry file
6. final summary cites the files inspected
```

This proves the workflow runner can manage deterministic inspection.

---

# 17. Things to remove or demote

Remove or demote these from the default path:

- Native tool calling as the default agentic assumption.
- Freeform agentic loop for long tasks.
- Unlimited planning text.
- Hidden fallback behavior.
- Full repo reads.
- Long keep-alive for 26B.
- Concurrent agentic runs.
- UI states that say “thinking” without showing active workflow/action.

Keep them available only for debugging or comparison.

---

# 18. What not to overbuild

Do not add:

- vector database
- multi-agent swarm
- browser automation
- autonomous internet research
- cloud provider dependency
- desktop packaging
- full Rust sandbox
- full Python backend
- plugin marketplace

This branch is about fixing the core agentic execution contract.

---

# 19. Success definition

The user should be able to say:

> “Agentic mode now actually does things. I can see what it is doing, what file it touched, what model it used, and why it stopped.”

That is the standard.
