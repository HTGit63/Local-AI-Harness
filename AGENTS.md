# AGENTS.md — Gamma Local Harness v2 Build Contract

This file is the controlling build contract for Gamma Local Harness v2. Future implementation must follow this contract before adding runtime behavior.

## 0. Status and Supersession

- Status date: `2026-05-07`.
- This v2 contract supersedes the old v1 everything-platform, web-first, action-DSL experiment posture.
- The v1 audit ledger remains useful only as historical context. It proved that the repo already has CLI, API, web UI, core engine, model adapter, planner, task orchestrator, repo indexer, session store, skills, prompt recipes, tool runtime, approval workflow, trace bus, workspace policy, checkpoints, diffs, and tests.
- Historical v1 task completion notes do not prove v2 runtime behavior.
- Future work must use v2 workflow discipline: CLI first, Chat/Agent split, persistent agent state, one micro-step, phase-scoped tools, checkpoint/diff/verify, and evidence-only DONE.
- `AGENTS_local_harness.md` is historical v1 context unless explicitly updated in a later docs pass.

## 1. Product Identity

Gamma Local Harness v2 is a CLI-first local coding harness for small local models that keeps persistent task state outside the model, executes one bounded micro-step at a time, and only marks work DONE when evidence exists.

Wrong identities:

- Not a Claude Code clone.
- Not an OpenClaw clone.
- Not a web IDE first.
- Not a general personal assistant.
- Not a multi-agent platform yet.
- Not a cloud-model workaround for workflow reliability.
- Not a provider-routing product first.

## 2. Target Machine and Model Budget

- Target machine: Linux laptop with roughly `16 GB RAM`.
- Inference posture: CPU first.
- Model server: local Ollama.
- Model class: Gemma/Qwen-class local models.
- Context policy: tiny context packs only.
- Model-call policy: bounded calls per step.
- Prompt policy: no giant prompt stacks, no giant repo dumps, no always-on large skill prompts.
- Cloud dependency policy: cloud models must not be required to solve workflow reliability.
- Heavy model policy: larger models are optional and must not define the default product identity.

## 3. Core Failure Diagnosis

### Model Limitation

Small local models cannot reliably hold the entire repo, chat history, tool menu, skill library, plan, edits, verification state, and user trust rules in context.

### Workflow Limitation

The current runtime has useful primitives, but the model is asked to coordinate too much. Workflow boundaries must be owned by runtime and state, not by model self-discipline.

### UI Limitation

The old contract made web UI too central. Browser state, API state, tool state, and model state can drift. CLI must become the first stable operating loop. Web becomes observer later.

### Memory/Context Limitation

Session history and run summaries are not enough. Agent mode needs `.gamma-harness/agent_state.md` as the durable task ledger read before every step and updated after every step.

### Tool-Loop Limitation

Exposing all tools at once makes local models hesitate, choose wrong branches, or simulate work. Tools must be exposed by phase only.

### User-Trust Limitation

The model saying "done" is not evidence. Completion must require checkpoints, diffs, command results, inspected files, or other recorded proof.

## 4. Non-Negotiable v2 Principles

- Chat and Agent are separate runtimes.
- CLI is primary.
- Web is dashboard later.
- Agent state is persistent.
- Agent mode reads `.gamma-harness/agent_state.md` before each step.
- Agent mode updates `.gamma-harness/agent_state.md` after each step.
- One active micro-step only.
- Tools are phase-specific.
- Checkpoint before edit.
- Diff after edit.
- Verify before DONE.
- Completion requires evidence.
- Runtime owns boundaries; prompts do not merely request them.
- No giant repo dumps.
- No always-on large skill prompts.
- No multi-agent/subagent complexity until one-agent workflow is stable.
- No web UI expansion before CLI runtime is stable.
- No raw hidden chain-of-thought exposure. Show operational facts only.

## 5. Chat Mode Contract

Purpose:

- Read, explain, compare, summarize, and plan.
- Answer repo questions with targeted context.
- Help user decide next safe action.

Allowed capabilities:

- Targeted file read when user names or confirms the file.
- Targeted search/list operations for explanation.
- Small context-pack creation for answer grounding.
- Session-local discussion.
- High-level implementation planning.

Forbidden capabilities:

- Writing files.
- Running shell commands by default.
- Creating checkpoints.
- Managing approvals.
- Applying patches.
- Running verification.
- Multi-step agent loops.
- Updating `.gamma-harness/agent_state.md` except through explicit Agent handoff commands added later.

CLI commands to move toward:

```text
gamma chat
gamma chat -p "Explain this error"
gamma chat --model gemma4:e4b
gamma chat --no-memory
```

Chat REPL commands to keep small:

```text
/status
/model
/read
/search
/compact
/new
/exit
```

Memory behavior:

- Short session history only.
- No durable task ledger.
- No automatic carryover into Agent mode unless user creates an Agent task.

File-read behavior:

- Read only requested or search-selected files.
- Prefer excerpts over whole files for large files.
- Do not read the whole repo.

Model budget:

- One answer after one narrow read/search span by default.
- At most one narrow follow-up retrieval cycle unless user asks.

Success criteria:

- Answer is grounded in inspected files or clearly marked as general advice.
- Workspace remains unchanged.
- No command or file write happens.

## 6. Agent Mode Contract

Purpose:

- Execute one workspace-bound task as a state machine.
- Perform one bounded micro-step at a time.
- Record state, evidence, blockers, and verification.

Allowed capabilities:

- Read `.gamma-harness/agent_state.md`.
- Create or update current task state.
- Select minimal context.
- Create checkpoint before edits.
- Apply one bounded patch path in edit phase.
- Show diff after edits.
- Run selected verification commands.
- Update evidence ledger.
- Stop after one step.

Forbidden capabilities:

- Open-ended autonomy.
- Parallel agents or subagents.
- Background loops.
- Broad writes.
- Running commands without phase permission.
- Using all tools at once.
- Loading giant skills.
- Marking DONE without evidence.
- Expanding web UI to compensate for runtime gaps.

CLI commands to move toward:

```text
gamma agent
gamma agent task "Fix the broken import in src/App.tsx"
gamma agent status
gamma agent state
gamma agent step
gamma agent diff
gamma agent verify
gamma agent rollback
gamma agent compact
```

State-machine phases:

- `IDLE`
- `TASK_INTAKE`
- `STATE_REVIEW`
- `CONTEXT_SELECTION`
- `MICRO_PLAN`
- `CHECKPOINT_IF_EDIT`
- `TOOL_ACTION`
- `DIFF_IF_EDIT`
- `VERIFY_IF_REQUIRED`
- `STATE_UPDATE`
- `REPORT`
- `STOP`

Required state file:

- `.gamma-harness/agent_state.md`

Micro-step execution:

- Exactly one active step.
- One tool action group per step.
- Stop after state update and report.
- No `run --max-steps` until one-step mode is reliable and tested.

Completion rules:

- Step completion requires required evidence for that step type.
- Task completion requires all required steps DONE or explicitly not applicable with evidence.
- Missing verification means `UNVERIFIED`, not `DONE`.

Failure states:

- `BLOCKED`: needs user input or missing dependency.
- `FAILED`: command/tool/edit failed and recovery path exists.
- `UNVERIFIED`: change exists but proof is missing or inconclusive.
- `BUDGET_EXCEEDED`: step exceeded model/tool/context budget.
- `APPROVAL_DENIED`: user rejected write or rollback.

## 7. Agent State File Contract

Path:

```text
.gamma-harness/agent_state.md
```

Exact sections:

```markdown
# Gamma Agent State

## Schema Version

## Task Identity

## User Objective

## Workspace

## Branch

## Mode

## Current Status

## Definition of Done

## Constraints

## Current Phase

## Current Step

## Next Action

## Assumptions

## Blockers

## Files Read

## Files Changed

## Commands Run

## Checkpoints

## Verification Results

## Evidence Ledger

## Task Ledger

## Working Memory

## Compacted History
```

Rules:

- Agent mode reads state first.
- Agent mode updates state last.
- No DONE without evidence.
- Failed commands are recorded.
- Blockers are recorded.
- Context is compacted into the state file.
- The state file is task ledger and flight recorder, not a chat diary.
- Hot context contains only current objective, current step, open blockers, proof obligations, recent decisions, and next action.

## 8. Agent State Machine

Stable v2 state machine:

```text
IDLE
TASK_INTAKE
STATE_REVIEW
CONTEXT_SELECTION
MICRO_PLAN
CHECKPOINT_IF_EDIT
TOOL_ACTION
DIFF_IF_EDIT
VERIFY_IF_REQUIRED
STATE_UPDATE
REPORT
STOP
```

Default behavior:

- One step and stop.
- No open-ended loops.
- No `run --max-steps` until one-step mode is reliable.
- Every transition is visible in CLI status.
- Model never decides to skip checkpoint, diff, verification, or state update when the phase requires them.

Transition rules:

- `IDLE` accepts only task intake or status.
- `TASK_INTAKE` writes task identity and definition of done.
- `STATE_REVIEW` reads existing state and unresolved obligations.
- `CONTEXT_SELECTION` may only use read-only tools.
- `MICRO_PLAN` produces one next action.
- `CHECKPOINT_IF_EDIT` must succeed before any write.
- `TOOL_ACTION` executes only phase-allowed tool.
- `DIFF_IF_EDIT` runs after every write.
- `VERIFY_IF_REQUIRED` runs the smallest relevant check.
- `STATE_UPDATE` records all facts, including failures.
- `REPORT` prints compact operational summary.
- `STOP` returns control to user.

## 9. Tool Policy

Initial minimal tools:

- `list_dir`
- `glob`
- `search_text`
- `read_file`
- `git_status`
- `git_diff`
- `patch_file`
- `create_checkpoint`
- `rollback_checkpoint`
- `run_command`
- `update_state`

Tool exposure by phase:

| Phase | Allowed tools | Write access | Notes |
|---|---|---:|---|
| scope/gather | `list_dir`, `glob`, `search_text`, `read_file`, `git_status` | No | Build tiny context pack only. |
| edit-prep | `update_state`, `create_checkpoint`, `git_status` | No file edit | Checkpoint must precede edit. |
| edit | `patch_file` | One patch path only | No whole-repo writes. |
| diff | `git_diff` | No | Structured diff only. |
| verify | `run_command`, `read_file`, `git_diff` | No | Selected commands only. |
| recover | `rollback_checkpoint`, `update_state` | Rollback only | Record reason and result. |
| state | `update_state` | State only | Always last. |

Why all-tools-at-once is forbidden:

- It increases prompt footprint.
- It creates more wrong branches.
- It encourages tool dithering.
- It makes recovery ambiguous.
- It lets local models simulate progress instead of finishing the current step.
- It hides whether a task is inspect, edit, verify, or recover.

## 10. CLI-First UX Contract

Top-level commands must move toward:

```text
gamma chat
gamma agent
gamma doctor
gamma model
gamma config
gamma bench
```

Agent commands:

```text
gamma agent task "..."
gamma agent status
gamma agent state
gamma agent step
gamma agent diff
gamma agent verify
gamma agent rollback
gamma agent compact
```

Agent REPL commands:

```text
/task "..."
/step
/status
/state
/diff
/verify
/checkpoint
/rollback
/compact
/exit
```

CLI output must stay compact and operational.

Do not expose hidden chain-of-thought. Show operational facts:

- current task
- current phase
- current step
- tools used
- files touched
- checkpoint
- diff summary
- verification result
- blocker
- next action

Status output target:

```text
Task: <short title>
Status: IN_PROGRESS | UNVERIFIED | BLOCKED | FAILED | DONE
Phase: <state-machine phase>
Step: <one active step>
Files: <read/changed counts>
Checkpoint: <id or none required>
Verification: <pass/fail/missing/not required>
Blocker: <short blocker or none>
Next: <one next action>
```

## 11. Web UI Later Contract

- Web UI is not the second agent brain.
- Web UI must become a dashboard over runtime state.
- Web reads the same state, sessions, traces, approvals, diffs, and verification logs.
- Web must not duplicate orchestration logic.
- No web expansion until CLI loop is stable.
- Web may display `.gamma-harness/agent_state.md`, pending approvals, checkpoints, diffs, command log, verification results, and benchmark runs.
- Web must not own divergent memory, task state, or workflow transitions.

## 12. Done Means Proven

Statuses:

- `IN_PROGRESS`: step or task active.
- `UNVERIFIED`: change exists or claim exists but required proof is missing.
- `BLOCKED`: progress needs user input, dependency, or approval.
- `FAILED`: action failed and recovery/retry path is recorded.
- `DONE`: required evidence exists and definition of done is met.

Required proof:

| Task type | Required proof |
|---|---|
| read-only research | files inspected + findings + limitations |
| docs edit | checkpoint + diff + preview/sanity check |
| code edit | checkpoint + diff + targeted verification |
| bug fix | diff + test/build result |
| refactor | diff + typecheck/build |
| config change | parse/build/smoke proof |
| command task | command + exit status + output summary |

Rules:

- No model statement alone can mark a task DONE.
- No skipped verification can become DONE unless verification is explicitly not applicable and why is recorded.
- Failed command output must be recorded.
- Dirty diff must be summarized before report.
- Evidence ledger must contain the proof reference, not only prose.

## 13. Small-Memory Workflow Strategy

Require:

- tiny context packs
- tool-first retrieval
- no full repo dump
- no long chat history in agent loop
- no giant skills
- bounded calls
- context compaction
- state-file continuity

Agent prompt inputs per step:

- user objective
- current step card from `.gamma-harness/agent_state.md`
- relevant tool excerpts
- allowed tools for current phase
- explicit output contract

Forbidden hot-context inputs:

- full prior chat
- full repo tree
- all tool outputs
- all skill prompts
- all prompt recipes
- browser UI state
- inactive plans

## 14. Keep / Remove / Defer Matrix

| Feature/component | Keep/remove/defer | Reason | Priority | Risk |
|---|---|---|---|---|
| core engine | Keep | Shared runtime is useful; constrain workflow around it. | P0 | Medium |
| CLI | Keep | Primary v2 surface. | P0 | Low |
| API | Keep | Needed for shared runtime and future dashboard. | P1 | Medium |
| web UI | Defer | Dashboard later, not agent brain. | P1 | Medium |
| planner | Keep, narrow | One micro-plan only. | P0 | Medium |
| task orchestrator | Keep, narrow | Must become state-machine driver, not broad autonomy. | P0 | Medium |
| repo indexer | Keep, reduce | Targeted context packs only; no heavy RAG. | P1 | Medium |
| session store | Keep | Useful history, but not replacement for agent state. | P0 | Low |
| skills | Defer from hot path | Opt-in narrow overlays only. | P0 | Medium |
| prompt recipes | Keep, shrink | Phase templates, not giant prompt stack. | P0 | Low |
| tool runtime | Keep, restrict | Strong primitive; expose by phase only. | P0 | Medium |
| approval workflow | Keep | Required for trust and safety. | P0 | Low |
| trace bus | Keep | Operational visibility. | P1 | Low |
| workspace policy | Keep | Boundary enforcement. | P0 | Low |
| checkpoints | Keep | Mandatory before edit. | P0 | Low |
| diffs | Keep | Mandatory after edit. | P0 | Low |
| tests | Keep | Proof source. | P0 | Low |
| provider proxy routing | Defer | Compatibility later; not workflow cure. | P2 | Medium |
| multi-agent/subagents | Remove for v2 | Too complex for 16 GB local model loop. | P0 | High |
| web IDE expansion | Defer | Expands wrong surface before CLI is stable. | P0 | High |

## 15. v2 Roadmap

| Phase | Objective | Exact allowed files | Forbidden changes | Implementation notes | Tests/verification | DONE criteria | Failure conditions |
|---|---|---|---|---|---|---|---|
| Phase 0: freeze expansion | Lock v2 contract and stop broad feature growth. | `AGENTS.md`, `docs/decision-records/*`, `docs/v2-roadmap.md` | Runtime code, web expansion, provider routing | Docs only. Mark v1 as historical. | Markdown sanity, `git diff --check` | v2 contract exists and names non-goals. | Contract still says web-first or all-tools hot path. |
| Phase 1: mode split | Separate Chat and Agent at CLI/runtime contract. | `apps/cli/src/cli.ts`, core mode routing tests, docs | Web UI feature work, model internals | Add `gamma chat` and `gamma agent` as distinct command families. | CLI e2e for command routing | Chat cannot write by default; Agent owns tasks. | Chat path can write or run commands by default. |
| Phase 2: persistent state file | Make `.gamma-harness/agent_state.md` mandatory for Agent. | new state module, session-store integration, CLI status tests | DB/vector store, web dashboard | Create/read/update state before/after each step. | Unit + integration state tests | Agent step fails clearly if state cannot update. | DONE possible without state ledger. |
| Phase 3: one-step agent | Execute one micro-step then stop. | task orchestrator/core agent loop/CLI agent command tests | `run --max-steps`, background loops | One active step, one report, stop. | Integration test proves one step only | Step ends in IN_PROGRESS/UNVERIFIED/BLOCKED/FAILED/DONE. | Agent loops without user command. |
| Phase 4: evidence gate | Block DONE unless proof exists. | state/evidence module, CLI verify/status tests | UI polish, broad workflow expansion | Implement status transition rules. | Unit tests for each task type | DONE requires evidence ledger entry. | Model final text can set DONE alone. |
| Phase 5: minimal tool policy | Expose tools by phase only. | tool policy module, core tool exposure tests | New tools, semantic edit expansion | Map phase to tiny tool allowlist. | Tests for read phase no write tools | Wrong phase blocks tool. | All tools remain visible. |
| Phase 6: checkpoint/diff/verify | Enforce edit safety chain. | core edit path, tool-runtime tests, integration workflow tests | Broad engine rewrite | Checkpoint before patch, diff after, verify before DONE. | Integration test for edit path | Missing checkpoint/diff/verify causes UNVERIFIED/FAILED. | Patch applies without checkpoint. |
| Phase 7: CLI polish | Make output compact/truthful. | CLI/status render tests/docs | Web redesign | One-screen status; no hidden reasoning. | CLI snapshots/e2e | Status shows task/phase/step/evidence/next. | Status is huge JSON-only dump. |
| Phase 8: web dashboard | Read runtime state as dashboard. | web dashboard components/API read endpoints | Duplicated orchestration logic | Web displays existing state/traces/diffs only. | API/web tests | Web mirrors CLI state. | Web owns separate workflow brain. |

### Current Implementation Status - 2026-05-07

| Phase | Status | Evidence |
|---|---|---|
| Phase 0: freeze expansion | DONE | v2 contract, ADR, and roadmap exist; expansion guardrails are explicit. |
| Phase 1: mode split | DONE | CLI has separate `gamma chat` and `gamma agent` command families; Chat Mode uses direct chat path. |
| Phase 2: persistent state file | DONE | Agent Mode persists `.gamma-harness/agent_state.md` and validates required sections before a step. |
| Phase 3: one-step agent | DONE | `gamma agent step` advances one phase and stops with state/evidence update. |
| Phase 4: evidence gate | DONE | Agent verification applies task-type proof gates; missing proof leaves status `UNVERIFIED`, not `DONE`. |
| Phase 5: minimal tool policy | DONE | Agent Mode checks phase-specific tool allowlists before checkpoint, patch, diff, and verify actions. |
| Phase 6: checkpoint/diff/verify | DONE | Agent patch flow creates checkpoint before edit, records diff after edit, then requires verification before DONE. |
| Phase 7: CLI polish | DONE | `gamma agent status` renders compact operational facts: task, phase, step, evidence, checkpoints, verification, blockers, tools, state path, and next action. |
| Phase 8: web dashboard | DONE | Activity tab reads shared Agent state through `/api/agent/dashboard` and mirrors state/traces/approvals/diff without owning orchestration. |

## 16. Production Task Cards

### Task Card 0.1 - v2 Contract Rewrite

- Goal: replace old root `AGENTS.md` with v2 build contract.
- Files to inspect: `AGENTS.md`, `AGENTS_local_harness.md`, v2 research files.
- Files allowed to change: `AGENTS.md`, docs-only ADR/roadmap.
- Forbidden changes: runtime source, web UI, provider routing.
- Implementation boundaries: docs-only.
- Verification command: `git diff --check`.
- DONE evidence: diff shows v2 contract and no runtime files.
- Rollback note: restore previous `AGENTS.md` from git if contract direction is rejected.

### Task Card 1.1 - CLI Mode Command Split

- Goal: add distinct `gamma chat` and `gamma agent` command families.
- Files to inspect: `apps/cli/src/cli.ts`, CLI e2e tests.
- Files allowed to change: CLI command router and tests only.
- Forbidden changes: web UI, model adapter internals, provider routing.
- Implementation boundaries: route separation first; no full Agent behavior rewrite.
- Verification command: CLI e2e command-routing test.
- DONE evidence: chat and agent commands resolve to separate handlers.
- Rollback note: revert CLI router patch.

### Task Card 2.1 - Agent State Schema

- Goal: create `.gamma-harness/agent_state.md` schema handling.
- Files to inspect: `packages/session-store/`, `packages/core/src/engine.ts`.
- Files allowed to change: state module, core integration, tests.
- Forbidden changes: vector DB, web dashboard, model routing.
- Implementation boundaries: markdown state file only.
- Verification command: unit/integration state tests.
- DONE evidence: Agent reads state first and updates state last.
- Rollback note: remove state module and Agent integration patch.

### Task Card 3.1 - One-Step Agent Command

- Goal: implement `gamma agent step` as one micro-step and stop.
- Files to inspect: CLI, core agent loop, task orchestrator.
- Files allowed to change: CLI/core/task orchestrator tests.
- Forbidden changes: multi-step run, subagents.
- Implementation boundaries: one active step only.
- Verification command: integration test with two pending steps proving only one executes.
- DONE evidence: state shows one completed/blocked/failed step and next action.
- Rollback note: revert step handler and tests.

### Task Card 4.1 - Evidence Gate

- Goal: block DONE unless task-type proof exists.
- Files to inspect: state handling, run summary, workflow tests.
- Files allowed to change: state/evidence logic and tests.
- Forbidden changes: UI expansion, new tools.
- Implementation boundaries: status transition rules only.
- Verification command: unit tests for missing proof and valid proof.
- DONE evidence: missing proof results in `UNVERIFIED`.
- Rollback note: revert status transition patch.

### Task Card 5.1 - Phase Tool Allowlist

- Goal: expose only phase-specific tools to model.
- Files to inspect: core tool allowlist, tool runtime registry, task orchestrator.
- Files allowed to change: tool policy code and tests.
- Forbidden changes: adding new tools.
- Implementation boundaries: allowlist/filter only.
- Verification command: tests that read phase blocks write tools.
- DONE evidence: tool exposure is phase-scoped.
- Rollback note: revert tool policy patch.

### Task Card 6.1 - Edit Proof Chain

- Goal: enforce checkpoint before edit, diff after edit, verify before DONE.
- Files to inspect: core edit path, tool-runtime checkpoint/diff, workflow tests.
- Files allowed to change: edit path and tests.
- Forbidden changes: broad engine rewrite.
- Implementation boundaries: existing checkpoint/diff tools only.
- Verification command: integration edit workflow test.
- DONE evidence: edit without checkpoint fails; edit with chain records evidence.
- Rollback note: revert edit chain enforcement.

### Task Card 7.1 - Compact CLI Status

- Goal: replace huge status dumps with one-screen operational output.
- Files to inspect: `apps/cli/src/cli.ts`.
- Files allowed to change: CLI render code and e2e snapshots.
- Forbidden changes: web UI.
- Implementation boundaries: render only existing state.
- Verification command: CLI e2e.
- DONE evidence: status shows task, phase, step, checkpoint, diff, verification, blocker, next action.
- Rollback note: revert CLI render patch.

### Task Card 8.1 - Read-Only Web Dashboard

- Goal: show Agent state in web without adding a second orchestration brain.
- Files to inspect: `apps/api/src/server.ts`, `apps/web/src/app/HarnessApp.tsx`.
- Files allowed to change: read-only API endpoint, Activity tab dashboard, API/web tests.
- Forbidden changes: web edit controls, agent task execution controls, provider routing, workflow duplication.
- Implementation boundaries: render shared state, traces, approvals, diffs, and verification facts only.
- Verification command: API e2e plus web build.
- DONE evidence: web dashboard mirrors CLI Agent state and does not expose write controls.
- Rollback note: revert endpoint and Activity tab dashboard section.

## 17. Benchmark and Evaluation Contract

Measure:

- direct chat latency
- first-token latency
- agent step reliability
- false-DONE rate
- context-loss rate
- tool-call accuracy
- state update correctness
- checkpoint success
- rollback success
- diff correctness
- verification correctness
- small-patch success rate

Evaluation rules:

- Benchmarks must record model, protocol, workspace, task type, phase, tool count, changed files, verification result, and final status.
- False-DONE rate is a primary stability metric.
- A run with missing evidence is not successful even if the final prose sounds correct.
- Local smoke tests must run on Ollama-compatible local models before claiming local stability.

## 18. Safety and Permissions

Preserve:

- workspace boundaries
- approval workflow
- no silent writes
- no broad edits without explicit approval
- rollback path
- danger mode disabled by default
- no writes outside workspace
- no raw hidden chain-of-thought exposure
- explicit recovery path after failed command/edit/checkpoint

Permission rules:

- Chat mode defaults to read/explain only.
- Agent mode starts read-only until a write phase is reached.
- Write phase requires checkpoint and policy check.
- Risky command requires explicit selected verification context or user approval.
- Rollback is recover-only and must be recorded in state.

## 19. Final v2 Acceptance Gate

The harness is not stable until:

- Chat and Agent are separate.
- Agent state file exists and is mandatory.
- One-step agent works.
- Checkpoint before edit works.
- Diff after edit works.
- Verification gate works.
- Status cannot become DONE without evidence.
- CLI status is compact and truthful.
- Web does not duplicate agent brain.

Minimum proof before claiming v2 stable:

```bash
npm run build
npm test
node apps/cli/dist/cli.js doctor --json
node apps/cli/dist/cli.js model status --json
git diff --check
```

Runtime behavior is not fixed by this document alone. Source code and tests must enforce each rule before the corresponding phase can be marked DONE.
