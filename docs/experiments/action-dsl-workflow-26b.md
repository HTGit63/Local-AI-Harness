# Action DSL, Workflow Runner, and 26B Experiment

Generated: 2026-05-02

## Decision

Keep all three execution paths, but merge them with clear jobs:

- `workflow_runner` should become the default for agentic coding workflows that inspect or change files.
- `action_dsl` should survive as the narrow model-action contract for structured actions and smoke testing.
- `native_tools` should stay as the compatibility baseline and comparison path.

Do not merge this as one vague autonomous loop. The useful architecture is the combination of deterministic workflow state, narrow Action DSL actions, explicit approvals, and serialized 26B model use.

## What Changed

- Config now exposes `HARNESS_AGENT_PROTOCOL`, `HARNESS_AGENT_MODEL`, `HARNESS_SUMMARY_MODEL`, and `HARNESS_AGENT_KEEP_ALIVE`.
- Model routing is isolated in `@local-harness/model-router`, with role-based route selection and a serialized heavy-model lock.
- Agentic runs emit route, lock, model warmup, protocol, Action DSL, workflow, approval, and summary traces.
- `@local-harness/action-dsl` parses one strict JSON action, validates allowed actions, executes through tool runtime, and repairs malformed JSON once.
- `@local-harness/workflow-runner` owns workflow state, step transitions, serialization, blocking, completion, and run summary persistence.
- Workflows now cover `inspect_project`, `fix_single_file`, `small_patch`, and `repo_audit`.
- Web UI and CLI expose protocol, workflow progress, Action DSL state, diff/approval state, runtime model state, and benchmark/smoke telemetry.

## Workflow Architecture

```text
User request
├── direct chat
│   └── fast model, no agent workflow
└── agentic run
    ├── model-router selects role/model
    ├── RAM governor serializes heavy model
    ├── protocol switch
    │   ├── native_tools
    │   ├── action_dsl
    │   └── workflow_runner
    ├── tool runtime enforces policy/approval
    ├── run ledger records files/tools/diffs/tests
    └── UI/CLI surfaces progress and final evidence
```

## Protocol Comparison

| Path | Strength | Weakness | Survives As |
| --- | --- | --- | --- |
| `native_tools` | Fastest compatibility path when Ollama tool calling works. | Model-specific tool behavior can be inconsistent; less deterministic than workflow state. | Baseline and fallback. |
| `action_dsl` | Strict JSON, bounded actions, parse errors visible, one repair attempt. | Raw loop is too narrow for multi-step coding unless wrapped by planning/workflow. | Structured action contract and smoke path. |
| `workflow_runner` | Best user trust: explicit steps, checkpoints, approvals, verification, summaries. | More code and workflow-specific prompts to maintain. | Default for real agentic coding workflows. |

## 26B Behavior and RAM Notes

- Agentic route targets `VladimirGav/gemma4-26b-16GB-VRAM:latest` by default unless overridden.
- Heavy model use is serialized through the model-router RAM governor; concurrent agentic runs queue instead of loading multiple heavy models.
- Before agentic warmup, the harness records unload attempts for other running models and activates the agent model with short keep-alive.
- Default agent keep-alive is `90s`, which avoids indefinite 26B residency.
- If the model is not installed or lifecycle control is unavailable, activation fails clearly instead of pretending the run used 26B.
- Repo audit context stays summarized; it does not dump the whole repo into the 26B context.

## Smoke and Benchmark Evidence

Verified local test suite:

```bash
npm test
```

Live local checks on 2026-05-02:

| Check | Result | Notes |
| --- | --- | --- |
| `doctor --json` | Pass | Ollama reachable, workspace/session/trace/skills/CLI/UI checks pass. |
| `model status --json` | Pass | 26B installed and lifecycle supported; no active model before smoke. |
| 26B read smoke | Blocked by RAM | Ollama reported `model requires more system memory (14.9 GiB) than is available (14.1 GiB)`. Harness failed clearly. |
| `gemma4:e2b` read smoke | Pass | `workflow_runner` completed `inspect_project` and observed `readfile`. |
| `gemma4:e2b` write smoke | Pass | `action_dsl` accepted real-model `write_file` alias, requested approval, produced diff preview, and changed one temp file. |

Covered smoke paths in automated e2e tests:

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

Benchmark output now records protocol, model, first-token time, total time, tool count, parse failures, routing notes, and memory notes.

## Task Completion Check

| Task | Status | Evidence |
| --- | --- | --- |
| TASK-01 | Done | Config/API/UI expose agent protocol and model fields. |
| TASK-02 | Done | `packages/model-router` exists and core uses it for route/lock selection. |
| TASK-03 | Done | Agentic model warmup, unload trace, heavy lock, and runtime state exist. |
| TASK-04 | Done | Action DSL parser/schema/validator package and tests exist. |
| TASK-05 | Done | Action DSL executor routes safe actions through tool runtime. |
| TASK-06 | Done | Repair loop emits parse/repair trace events and blocks after retry. |
| TASK-07 | Done | Agentic protocol switch supports native, Action DSL, and workflow runner. |
| TASK-08 | Done | Workflow-runner package owns state transitions and summaries. |
| TASK-09 | Done | `inspect_project` workflow reads bounded repo evidence. |
| TASK-10 | Done | `fix_single_file` workflow checkpoints, previews, approves, verifies. |
| TASK-11 | Done | `small_patch` workflow handles one to three files with approval and verification. |
| TASK-12 | Done | `repo_audit` inspects broadly without writing by default. |
| TASK-13 | Done | Web run console surfaces runtime, protocol, workflow, Action DSL, approvals. |
| TASK-14 | Done | CLI smoke and benchmark telemetry exist with e2e coverage. |
| TASK-15 | Done | This report and reusable results template produce the experiment decision. |

## Recommendation

Merge gradually:

1. Keep `native_tools` available and stable for fallback.
2. Use `workflow_runner` for coding tasks that need file inspection, edits, diffs, approval, or verification.
3. Use `action_dsl` inside workflows and smoke tests where exact model actions matter.
4. Keep 26B only behind serialized agentic runs with short keep-alive and visible runtime state.
5. Do not merge a broad autonomous agent mode without workflow state, approvals, and run evidence.
