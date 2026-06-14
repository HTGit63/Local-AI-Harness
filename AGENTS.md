# AGENTS.md — Commit-Aware Final Repair Plan for Gemma 4 Harness

## Read Me First

This file is the active instruction source for the Gemma 4 Harness final repair pass.

The previous Stage 1–5 implementation exists. Do **not** restart it. Do **not** blindly rewrite working code. This pass must verify the latest local commit, preserve the working fixes, find missed gaps, and finish the harness so it is debuggable with real logs and testable with a real lightweight local model.

Current user-reported latest commit subject:

```text
Fix Ollama default runtime and clean sessions
```

This commit is important. It likely contains fixes that must not be reverted.

Primary goal:

```text
Make the harness reliable, debuggable, real-model-testable, and honestly complete against the Stage 1–5 gates plus the new observability/testing gates.
```

Secondary goal:

```text
Preserve the latest working runtime/session fixes. Improve around them. Do not undo them.
```

---

## Hard Commit Anchor

Before any edit, verify the local repo is on or contains the user-reported commit.

Run:

```bash
pwd
git status
git branch --show-current
git log -1 --pretty=format:'%H%n%s%n%an%n%ad'
git log --oneline --decorate -20
git show --stat --oneline --decorate --summary HEAD
git show --name-status --oneline --decorate HEAD
```

Then inspect the latest commit patch before editing:

```bash
git show --patch --find-renames --find-copies --stat HEAD --   package.json   .env.example   README.md   docs   packages/model-adapter   packages/core   packages/session-store   apps/api   apps/web/src/app/agent   apps/web/src/app/chat   tests
```

If the patch is huge, summarize it by file first, then inspect only changed runtime/session/agent/test files in detail.

Expected latest commit subject:

```text
Fix Ollama default runtime and clean sessions
```

### If latest commit subject matches

Continue.

### If latest commit subject does not match

Search local history:

```bash
git log --all --grep="Fix Ollama default runtime and clean sessions" --oneline --decorate
```

If found, report:

```text
Found target commit:
<branch/ref/sha>
Current HEAD:
<sha subject>
```

Then ask no questions unless required by conflict. Checkout/create the repair branch from the branch/ref that contains the target commit.

If not found, stop and report:

```text
Target commit not found locally.
Do not proceed because this repair plan must preserve that commit.
```

Do **not** guess. Do **not** continue from an older commit.

Important: remote GitHub search/index may be stale. Local `git log` and `git show HEAD` are the source of truth for this pass.

---

## Repo

Expected local path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

Existing stage branch may be:

```text
feature/stage-1-to-5-harness-upgrade
```

Create final repair branch from the target commit branch:

```bash
git checkout -b feature/final-harness-logs-tests-runtime-sessions
```

If branch already exists:

```bash
git checkout feature/final-harness-logs-tests-runtime-sessions
git status
```

Never work directly on `main`.

Stop if there are uncommitted changes, merge conflicts, or unknown branch state.

---

## Required Skills

Use global skills where useful.

Core:

```text
caveman
context-driven-development
planner
improve-codebase-architecture
```

Backend / harness:

```text
nodejs-backend-patterns
security-best-practices
```

Frontend / UI:

```text
frontend-skill
ui-ux-pro-max
impeccable
web-design-guidelines
emil-design-eng
```

Testing:

```text
playwright
```

Git:

```text
caveman-commit
caveman-review
```

Skill rules:

- Use `caveman` for concise/token-efficient reporting.
- Do **not** let `caveman` remove evidence, command output, errors, test results, or acceptance details.
- Do **not** use `doc` for Markdown docs. Local `doc` skill is for `.docx`.
- Use `security-best-practices` for log redaction and prompt/tool logging.
- Use `impeccable` only after reading existing UI/CSS context.
- Use `web-design-guidelines` only for UI review/audit.
- Use `context7` only when current library/framework docs are needed.

---

## User Runtime Reality

User has these Ollama models:

```text
qwen3-coder:30b
nemotron-3-nano:4b
VladimirGav/gemma4-26b-16GB-VRAM:latest
gemma4:e4b-it-qat
gemma4:e2b-it-qat
gemma4:12b
```

Primary real-use models:

```text
gemma4:12b
gemma4:e4b-it-qat
gemma4:e2b-it-qat
VladimirGav/gemma4-26b-16GB-VRAM:latest
qwen3-coder:30b
```

Lightweight real-model smoke model:

```text
nemotron-3-nano:4b
```

Use `nemotron-3-nano:4b` for plumbing tests only. Do not expect it to solve complex refactors.

---

## Critical Runtime Decision

Previous Stage 3 may have said "llama.cpp primary, Ollama fallback." The latest user-reported commit says:

```text
Fix Ollama default runtime and clean sessions
```

Therefore, do **not** blindly force llama.cpp primary if the latest commit intentionally fixed Ollama as the default working runtime.

Instead, inspect the latest runtime code and docs, then preserve the working intended behavior.

Required outcome:

```text
Runtime defaults must be explicit, visible, documented, and tested.
```

Acceptable final states:

### State A — Ollama default, llama.cpp optional

Use this if the latest commit intentionally made Ollama the default because it works with the user's installed models.

Requirements:

- Default provider is Ollama/OpenAI-compatible or `ollama-legacy`.
- Default model is a user-available model, preferably `gemma4:e4b-it-qat` or configured by env.
- llama.cpp remains supported as optional provider.
- Runtime identity is visible in UI/logs.
- Fallback behavior is visible and never silent.

### State B — llama.cpp default, Ollama fallback

Use this only if current code and commit history confirm this remains intended.

Requirements:

- llama.cpp default is reachable/documented.
- Ollama fallback is visible and never silent.
- User can switch to Ollama models easily.
- Runtime identity is visible in UI/logs.

Do not decide by old AGENTS text alone. Decide by current code, latest commit patch, tests, and user reality.

The current public repo metadata may still describe the harness as Gemma 4 E4B via Ollama. Treat this as additional evidence that Ollama support/defaults are important. The local target commit remains the source of truth.

---

## Known Current Gaps To Recheck

Do not assume these are still true. Recheck each against the target commit.

### Gap 1 — Commit not anchored

Previous instructions did not force checking the latest target commit. This file now does.

### Gap 2 — Runtime default ambiguity

Old Stage 3 may conflict with latest "Fix Ollama default runtime" commit. Resolve by inspecting current code. Preserve the latest working default.

### Gap 3 — Session cleanup not audited

Latest commit mentions "clean sessions." Previous AGENTS did not include session cleanup gates.

Must audit:

- where sessions are stored,
- how sessions are listed,
- how stale sessions are cleaned,
- whether cleanup can delete user-needed data,
- whether cleanup distinguishes temp/test sessions from real sessions,
- whether session cleanup is documented,
- whether tests cover cleanup behavior.

### Gap 4 — Durable logs missing or incomplete

TraceBus/in-memory traces are not enough. Must add durable run logs if still missing.

### Gap 5 — Tests too mock-heavy

Existing mock tests may only prove canned responses. Add behavioral assertions and opt-in real-model smoke test.

### Gap 6 — AgentMode still too large

If `apps/web/src/app/agent/AgentMode.tsx` still owns API helpers, types, session state, config state, streaming, and UI layout, decompose it.

### Gap 7 — UI clutter

Agent Mode side/status panel must be summary-first. Raw traces/logs/full diffs/debug details must stay collapsed.

### Gap 8 — Stage 5 may exist but be untested

If `MinimalDiffTestSummary` exists, harden/test it. Do not recreate from scratch.

### Gap 9 — Docs may say one thing while runtime does another

Docs, `.env.example`, runtime defaults, UI labels, and tests must agree.

### Gap 10 — Log security

Prompt/tool logs can leak secrets. Redaction must be central and tested.

### Gap 11 — Agentic Mode bypasses planner and answers directly

This is a blocking Agent Mode bug.

Current bad behavior:

```text
User asks agentic task
→ Agent answers directly like Chat Mode
→ Agent does not inspect workspace/docs first
→ Agent does not list relevant files/docs
→ Agent does not invoke planner/adaptive plan path
→ Agent starts answering without grounded plan
```

Required behavior:

```text
User asks agentic task
→ classify request
→ inspect workspace and project docs
→ list relevant files/docs/context
→ create or load adaptive plan
→ validate plan
→ show current goal/step
→ execute current step with allowed tools
→ verify/diff/log result
```

Agent Mode must never skip planning for non-trivial work. Direct answer is only allowed for explicitly tiny informational Agent Mode questions that require no workspace, no tools, and no plan. If in doubt, plan first.

### Gap 12 — Latest commit patch not inspected deeply enough

It is not enough to check the commit subject. The agent must inspect what the latest commit changed.

Required local commands:

```bash
git show --stat --oneline --decorate --summary HEAD
git show --name-status --oneline --decorate HEAD
git show --patch --find-renames --find-copies HEAD -- <runtime/session/agent/test paths>
```

The repair must preserve the commit's intent around:

```text
Ollama default runtime
runtime provider selection
session listing/loading/cleanup
stale sessions
clean UI session behavior
```

### Gap 13 — Agent prompt discipline without backend enforcement is weak

Putting planner-first wording in the system prompt is not enough. Local models may ignore it.

Backend/core must enforce planner-first behavior for non-trivial Agent Mode requests.

Required enforcement:

```text
Agent request classified non-trivial
→ final answer blocked until context + plan events exist
→ if model answers directly, convert response into plan-repair request or fallback plan
```

### Gap 14 — Workspace/doc inventory missing from Agent startup

Agent Mode must build a workspace document inventory before planning.

Required inventory event:

```text
workspace_doc_inventory
```

It should include discovered:

```text
AGENTS.md
README.md
package.json
.env.example
docs/*
apps/*
packages/*
tests/*
conductor/* if present
```

The inventory must be budgeted and targeted. Do not dump whole repo into context.

### Gap 15 — Skill selection is not visible

For non-trivial Agent Mode tasks, the agent should select relevant installed skills before planning.

Expected event:

```text
agent_skill_selection
```

with:

```ts
{
  selectedSkills: string[];
  reason: string;
  skippedSkills?: string[];
}
```

For this harness task, expected skills include:

```text
caveman
context-driven-development
planner
improve-codebase-architecture
nodejs-backend-patterns
security-best-practices
frontend-skill
ui-ux-pro-max
impeccable
web-design-guidelines
playwright
```

The agent does not need to run `npx skills ls -g` every time if skills are already known, but it must make skill choice explicit in logs/trace for major work.

### Gap 16 — Streaming order can make direct answer look final

If the model streams normal prose before plan/context events, the UI may display a direct answer even if backend later creates a plan.

Fix:

```text
Agent Mode UI should show status/progress events first.
Assistant final prose should not be marked final until planner gate passes.
```

For non-trivial Agent Mode tasks, the first visible state should be:

```text
Analyzing request
Inspecting workspace
Selecting skills
Building plan
```

not a final answer paragraph.

---

# Work Order

Do the work in this order:

```text
Phase 0 — Commit-aware audit
Phase 1 — Runtime + session cleanup preservation tests
Phase 2 — Agentic planning discipline
Phase 3 — Durable observability
Phase 4 — Meaningful tests + real local model smoke
Phase 5 — AgentMode decomposition
Phase 6 — Agent UI + Stage 5 hardening
Phase 7 — Docs + final report
```

Do not reorder unless blocked by build failure or dependency issue.

---

# Phase 0 — Commit-Aware Audit

## Required actions

1. Verify target commit subject.
2. Read this file fully.
3. Inspect actual code.
4. Produce a written audit before editing.
5. Identify exact file paths for every planned change.
6. Identify what latest commit changed around Ollama default runtime and session cleanup.
7. Inspect the latest commit patch, not only the subject.
8. Record files changed by the latest commit and which fixes must be preserved.

Create/update:

```text
docs/final-harness-audit.md
```

Minimum audit table:

```text
Area | Status | Evidence | Gaps | Planned fix
Stage 1 | complete/partial/incomplete | files/functions | ... | ...
Stage 2 | complete/partial/incomplete | files/functions | ... | ...
Stage 3/runtime | complete/partial/incomplete | files/functions | ... | ...
Stage 4/UI | complete/partial/incomplete | files/functions | ... | ...
Stage 5/diff-test | complete/partial/incomplete | files/functions | ... | ...
Observability | complete/partial/incomplete | files/functions | ... | ...
Testing | complete/partial/incomplete | files/functions | ... | ...
Session cleanup | complete/partial/incomplete | files/functions | ... | ...
Docs | complete/partial/incomplete | files/functions | ... | ...
Latest commit patch | understood/not understood | files changed | preserved fixes | risks
Agentic planner gate | complete/partial/incomplete | files/functions | direct-answer prevention | tests
Workspace inventory | complete/partial/incomplete | files/functions | docs/files discovered | tests
Skill selection | complete/partial/incomplete | files/functions | selected skills logged | tests
```

Evidence must include file paths and named functions/components.

Do not claim complete without validation.

---

# Phase 1 — Runtime + Session Cleanup Preservation

## Goal

Protect the latest commit's intended behavior.

## Runtime audit

Inspect:

```text
packages/model-adapter/
packages/core/
apps/api/
apps/web/src/app/agent/
.env.example
README.md
docs/runtime.md
```

Find:

- default provider,
- default model,
- default base URL,
- Docker UI host behavior,
- runtime switching behavior,
- fallback behavior,
- warnings,
- health checks,
- UI display of active provider/model/base URL.

## Runtime acceptance

Complete only if:

- default runtime behavior matches latest commit intent,
- user can run with Ollama models without fighting defaults,
- user can configure llama.cpp if desired,
- runtime fallback is visible,
- runtime identity appears in:
  - API config,
  - Agent UI,
  - durable logs,
  - docs,
- tests cover default runtime config and fallback warning.

## Session cleanup audit

Inspect:

```text
packages/session-store/
packages/core/
apps/api/
apps/web/src/app/agent/
.gamma-harness session paths
```

Find:

- where sessions are persisted,
- how sessions are loaded/listed,
- whether cleanup exists,
- whether cleanup runs automatically or manually,
- whether cleanup can delete active sessions,
- whether cleanup can delete real user session history,
- whether cleanup can race with active runs.

## Session cleanup rules

- Never delete user sessions silently unless they are clearly temp/test/expired.
- Prefer archive/compact over hard delete when unsure.
- If automatic cleanup exists, make it conservative and documented.
- If manual cleanup exists, UI copy must say what will be deleted.
- Real-model smoke tests must create temp session data and clean only temp data.

## Session cleanup acceptance

Complete only if:

- behavior is documented,
- cleanup cannot delete active run/session,
- cleanup cannot delete outside `.gamma-harness` or configured session dir,
- tests cover stale cleanup and active-session preservation,
- UI/API does not show stale/broken sessions after cleanup.

---

# Phase 2 — Agentic Planning Discipline

## Goal

Fix Agent Mode so it behaves like an agent, not a direct chat responder.

Agent Mode must analyze, inspect, plan, then act.

## Required Agent Mode state machine

Implement or verify a clear Agent Mode state machine:

```text
idle
→ analyzing_request
→ inventory_workspace_docs
→ selecting_skills
→ planning
→ plan_validated
→ executing_step
→ verifying
→ summarizing
→ done / blocked / failed
```

The UI and logs should reflect these states.

## Required Agent Mode pipeline

For every non-trivial Agent Mode request:

```text
1. Receive user request
2. Classify intent and complexity
3. Inspect workspace/docs before final answer
4. Emit workspace document inventory
5. Select relevant skills
6. Build task context from files/docs
7. Create or load adaptive plan
8. Validate plan
9. Persist plan/checkpoint
10. Execute current goal/step
11. Use tools according to step budget
12. Verify/diff/log result
13. Summarize with evidence
```

## Workspace/document inspection

Before planning, Agent Mode must inspect available project context.

Minimum context sources:

```text
AGENTS.md
README.md
package.json
.env.example
docs/
apps/
packages/
tests/
conductor/ if present
.gamma-harness/project-memory.json if present and safe
```

Do not read the whole repo blindly. Use targeted listing/search and context budget.

The agent should emit/log two context events:

```text
workspace_doc_inventory
workspace_context_collected
```

with:

```ts
{
  workspaceRoot: string;
  docsFound: string[];
  filesConsidered: string[];
  filesSelected: string[];
  reason: string;
}
```

## Planner/adaptive plan requirement

For non-trivial Agent Mode tasks, direct final answer is forbidden until a plan exists.

Agent Mode must create or load:

```text
AdaptivePlan
TaskPlan
RunCheckpoint
```

Expected events, in order:

```text
intent_classified
workspace_doc_inventory
agent_skill_selection
workspace_context_collected
adaptive_plan_requested
adaptive_plan_validated
task_plan_created
current_goal_selected
```

If a saved plan/checkpoint exists and the user says:

```text
continue
resume
keep going
act on the plan
run the plan
implement the plan
implement plan.md
```

then Agent Mode must load saved plan state, not create a fresh unrelated answer.

## Direct-answer exception

Agent Mode may answer directly only when all are true:

```text
- request is informational,
- no workspaceRoot needed,
- no file inspection needed,
- no edit/build/test expected,
- no multi-step task,
- no words like fix/build/implement/refactor/test/debug/audit/review/update.
```

Even then, log:

```text
agent_direct_answer_allowed
```

with reason.

If uncertain, inspect and plan.

## Model prompt contract

The Agent Mode system prompt must clearly say, and backend/core must enforce:

```text
You are in Agent Mode, not Chat Mode.
For non-trivial tasks, do not answer directly.
First inventory workspace docs, select relevant skills, inspect workspace context, create or load a plan, validate it, then execute only the current step.
```

The backend must enforce this; do not rely only on frontend wording.

## Backend enforcement

Add a guard in the Agent execution path:

- If `executionMode === "agent"` and task is non-trivial:
  - require workspace doc inventory before plan,
  - require skill selection before plan,
  - require task plan before final answer,
  - require planning/context events before final output,
  - if model attempts final answer without plan, suppress/mark as draft and repair by asking model for plan or using fallback template.

Do not allow the first assistant content to become final output for non-trivial Agent Mode tasks unless planning gate passed.

## UI behavior

Agent UI should show:

```text
Analyzing request
Inventorying workspace docs
Selecting skills
Inspecting workspace
Building plan
Current goal
Executing step
Verifying
```

This prevents the user from thinking the agent is just chatting.

## Tests

Add tests for:

```text
Agent Mode non-trivial request does not direct-answer without plan
Agent Mode emits intent/context/plan events before execution
Agent Mode inventories workspace docs before planning
Agent Mode selects relevant skills before planning
Agent Mode reads/lists relevant workspace docs before planning
Agent Mode continue/resume uses saved plan
Agent Mode direct-answer exception only for trivial informational request
Chat Mode still direct-answers normally
```

Mock model test should include a bad model response that tries to answer directly. Harness must reject/repair it and produce a plan.

Real-model smoke must assert:

```text
agent inspect scenario logs workspace_doc_inventory and workspace_context_collected
agent edit scenario logs agent_skill_selection and adaptive_plan_validated before tool write
```

## Acceptance

Complete only if:

- Agent Mode cannot silently bypass planning for non-trivial tasks.
- Agent Mode inventories workspace/docs before planning.
- Agent Mode selects relevant skills before planning.
- Planner/adaptive plan path is used and logged.
- Direct answer exception is narrow and logged.
- Tests cover direct-answer bypass prevention.
- Chat Mode remains direct and uncluttered.

---

# Phase 3 — Durable Observability

## Goal

Every Chat or Agent run must produce durable logs the user can send for diagnosis.

Use:

```text
.gamma-harness/logs/
```

## Required files

```text
.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.jsonl
.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.summary.json
```

## Event schema

Every JSONL event:

```ts
{
  timestamp: number;
  isoTime: string;
  runId?: string;
  sessionId?: string;
  requestId?: string;
  stepId?: string;
  goalId?: string;
  eventType: string;
  source: "api" | "core" | "model-adapter" | "tool-runtime" | "planner" | "web";
  level: "debug" | "info" | "warn" | "error";
  data: Record<string, unknown>;
}
```

## Central module

Do not scatter raw `fs.appendFile`.

Create one deep module, for example:

```text
packages/core/src/harness-log.ts
```

or:

```text
packages/observability/
```

Interface should hide file format and redaction details from callers.

## Required event coverage

Log:

### Request/routing

- endpoint,
- mode,
- executionMode,
- workspaceRoot present/absent,
- allowTools,
- advancedTools,
- runtime provider,
- model.

### Prompt/model

- provider,
- model,
- redacted base URL,
- request start/end,
- stream start/end,
- finish reason,
- token usage,
- error/timeout,
- native tools vs manual tool protocol.

### Prompt inspection

Add:

```text
HARNESS_LOG_PROMPTS=off | summary | full
```

Default:

```text
summary
```

- `off`: no prompt content.
- `summary`: role, length, first/last preview, SHA-256 hash.
- `full`: full redacted messages.

Always redact secrets.

Redact:

```text
OPENAI_API_KEY
ANTHROPIC_API_KEY
GITHUB_TOKEN
NETLIFY_AUTH_TOKEN
SENTRY_AUTH_TOKEN
*_KEY
*_TOKEN
*_SECRET
*_PASSWORD
Bearer ...
private keys
SSH keys
.env values
obvious long tokens
```

### Planning

- intent classification,
- workspace document inventory,
- skill selection,
- workspace context collection,
- adaptive plan request,
- adaptive plan response summary/hash/full-redacted depending mode,
- plan validation result,
- validation errors,
- fallback plan,
- saved plan path,
- current goal/step changes,
- resume/continue events.

### Tools

- tool start/end,
- tool name,
- input summary,
- policy allowed/blocked,
- approval requested/resolved,
- output preview,
- success/failure,
- duration,
- files read/written/deleted,
- command,
- exit code.

### Diff/verification

- diff requested,
- changed files,
- added/removed counts,
- verification command start/end,
- pass/fail/not-run,
- output preview,
- final summary.

## Non-crashing rule

If logging fails:

- do not crash stream/run,
- emit warning trace,
- include logging warning in summary if possible.

## API

Add endpoints:

```text
GET /api/logs/runs
GET /api/logs/runs/:runId
GET /api/logs/runs/:runId/summary
```

Security:

- prevent path traversal,
- only read within `.gamma-harness/logs`,
- redact secrets on read if needed,
- return safe errors.

## UI

Add Agent-only compact log panel:

```text
Run logs
- latest run id
- log status
- copy path
- open/download log
```

Detailed list behind `<details>`.

Never show logs panel in Chat Mode.

## Tests

Add tests for:

- logger writes JSONL,
- summary writes JSON,
- redaction,
- prompt modes,
- logging failure does not throw,
- API list/read/summary,
- path traversal blocked.

---

# Phase 4 — Meaningful Tests + Real Local Model Smoke

## Keep normal tests deterministic

Normal `npm test` must not require Ollama.

## Add root script

```json
{
  "scripts": {
    "test:real-model": "node --import tsx tests/e2e/real-model-smoke.test.ts"
  }
}
```

## Real model env

```bash
HARNESS_REAL_MODEL_TESTS=1 \
HARNESS_RUNTIME_PROVIDER=ollama-legacy \
HARNESS_MODEL=nemotron-3-nano:4b \
OLLAMA_MODEL=nemotron-3-nano:4b \
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 \
npm run test:real-model
```

If current config uses different env names, inspect and use the real names. Do not invent unused env vars.

## Availability check

Before real smoke:

```bash
ollama list
```

or API equivalent.

Skip clearly if:

- Ollama unavailable,
- model missing,
- API port unavailable.

## Temp workspace only

Create temp fixture under OS temp or repo ignored temp:

```text
tmp/harness-smoke-xxxx/
```

Never edit actual repo during smoke test.

## Smoke scenarios

### 1. Direct Chat

Prompt:

```text
Reply with exactly: harness-ok
```

Assert:

- response includes `harness-ok`, or log exact model output as failure,
- durable log exists,
- no tool events.

### 2. Agent Inspect

Prompt:

```text
Inspect this temporary workspace and list files relevant to the math function. Do not edit files.
```

Assert:

- read/list/search tool event exists,
- no file changed,
- durable log exists.

### 3. Agent Edit + Verify

Prompt:

```text
Make one tiny safe edit to the math function or test, then run the test command.
```

Assert:

- file changed,
- diff summary exists,
- verification ran or not-run is explicitly logged,
- durable log includes model/plan/tool/diff/verification/final summary.

## Real smoke output

Print:

```text
Real model smoke result:
- passed / failed / skipped
- model
- provider
- base URL
- workspace path
- run id
- log jsonl path
- summary path
```

## Mock tests

Strengthen mock tests:

- Chat run logs no tool calls.
- Chat run can direct-answer normally.
- Agent non-trivial request cannot direct-answer before plan.
- Bad mock model direct-answer is rejected/repaired into plan path.
- Agent run logs workspace_doc_inventory, agent_skill_selection, planning, tool, diff, verification.
- Runtime default test protects latest commit intent.
- Session cleanup test protects latest commit behavior.
- MinimalDiffTestSummary behavior tested.
- Streaming order test proves Agent UI sees analysis/inventory/skill/planning status before final prose.

---

# Phase 5 — AgentMode Decomposition

## Goal

Finish Stage 1/4 architecture cleanup without breaking behavior.

Problem file:

```text
apps/web/src/app/agent/AgentMode.tsx
```

If it still contains API helpers, many local types, config/session/run state, streaming parsing, settings modal, and big UI chunks, split it.

## Required extraction candidates

```text
apps/web/src/app/agent/agentApi.ts
apps/web/src/app/agent/agentTypes.ts
apps/web/src/app/agent/AgentTopBar.tsx
apps/web/src/app/agent/AgentWorkspacePanel.tsx
apps/web/src/app/agent/AgentTaskComposer.tsx
apps/web/src/app/agent/AgentStatusPanel.tsx
apps/web/src/app/agent/AgentSettingsModal.tsx
apps/web/src/app/agent/AgentRunLogPanel.tsx
apps/web/src/app/agent/hooks/useAgentRunState.ts
apps/web/src/app/agent/hooks/useAgentConfig.ts
apps/web/src/app/agent/hooks/useAgentSessions.ts
```

Use names matching repo style.

## Rules

- Extract before redesign.
- Keep behavior.
- Avoid giant new files.
- No component >500 lines unless documented with reason.
- API helpers must not live inside `AgentMode.tsx`.
- Shared/local DTO types must not live inside `AgentMode.tsx` unless tiny and component-private.
- Streaming/approvals/run state must keep working.

## Acceptance

- `AgentMode.tsx` becomes orchestration shell.
- Tests/build pass or failures documented.
- UI still supports:
  - streaming,
  - approvals,
  - workspace selection,
  - runtime settings,
  - image attachments,
  - task plan state,
  - structured diff display,
  - run logs.

---

# Phase 6 — Agent UI + Stage 5 Hardening

## Agent panel hierarchy

Order:

```text
1. Runtime/model/workspace/write-access
2. Current goal/current step
3. Changed + verification summary
4. Run log access
5. Pending approvals
6. Tool activity summary
7. Plan progress
8. Advanced details collapsed
```

Advanced details:

```text
raw trace
full diff
structured diff details
context budget
plan files
checkpoints
session internals
debug metadata
full log list
```

## MinimalDiffTestSummary

If it exists, harden. Do not rewrite unless broken.

Required behavior:

- Agent Mode only.
- Chat Mode never shows it.
- Changed files visible.
- Verification visible.
- Statuses clear:
  - passed
  - failed
  - running
  - not-run
- `View diff` only if diff exists.
- Full diff collapsed by default.
- Long diff preview capped.
- Reuse existing RunConsole diff data.
- No new diff engine.

## Chat Mode

Chat must stay clean:

- no workspace controls,
- no tool controls,
- no approvals,
- no run logs,
- no diff/test panel,
- no repo context injection,
- no session cleanup controls.

## Markdown/KaTeX

Check:

- headings,
- lists,
- tables,
- inline code,
- code blocks,
- inline math,
- block math.

Add CSS only if needed.

---

# Phase 7 — Docs + Final Report

Create/update docs:

```text
docs/final-harness-audit.md
docs/observability.md
docs/real-model-testing.md
docs/runtime.md
docs/session-cleanup.md
.env.example
README.md
```

Do not duplicate if docs already exist. Update instead.

## Observability docs

Must explain:

- log directory,
- JSONL format,
- summary JSON,
- event schema,
- prompt logging modes,
- redaction,
- API endpoints,
- UI access,
- what file to send for debugging.

## Runtime docs

Must explain current truth:

- actual default provider,
- Ollama setup,
- llama.cpp setup if supported,
- model env vars,
- default ports,
- fallback behavior,
- runtime identity.

## Session cleanup docs

Must explain:

- where sessions live,
- what cleanup means,
- what is safe to delete,
- what is preserved,
- how to troubleshoot stale sessions.

## Real model docs

Must explain:

- why mock tests are not enough,
- how to run `test:real-model`,
- how to use `nemotron-3-nano:4b`,
- what smoke test proves,
- what smoke test does not prove,
- expected log paths.

---

# Final Gates

## Stage 1 — Chat/Agent Separation

Complete only if:

- Chat and Agent top-level surfaces separate.
- `HarnessApp.tsx` thin.
- `AgentMode.tsx` no longer giant mixed implementation.
- Chat sends explicit direct/chat requests.
- Agent sends explicit agentic requests.
- Backend defaults to chat/direct if mode missing.
- Chat cannot trigger workspace/tools/approvals/checkpoints.
- Agent preserves workspace/tools/run console/progress.

## Stage 2 — Adaptive Planning

Complete only if:

- Adaptive contracts exist.
- Validation exists.
- Non-trivial Agent tasks use adaptive planning first.
- Fixed templates are fallback only.
- Adaptive goals normalize into RunConsole-compatible steps.
- Plan state persists in checkpoint/run state.
- Continue/resume uses saved plan.
- Invalid/vague plans rejected/repaired safely.

## Stage 3 — Runtime

Complete only if:

- Current default runtime matches latest commit intent.
- Ollama models work with explicit config.
- llama.cpp support/fallback is documented if present.
- Fallback is visible.
- Runtime identity visible in API/UI/logs.
- Health checks bounded.
- `.env.example`, README/docs, and tests agree.

## Stage 4 — UI Clarity

Complete only if:

- dark theme preserved,
- landing clean,
- Chat clean and agent-free,
- Agent summary-first,
- runtime/workspace/current goal visible,
- settings centered modal,
- advanced details collapsed,
- markdown/KaTeX readable,
- responsive acceptable.

## Stage 5 — Diff/Test Visibility

Complete only if:

- compact changed-files summary visible in Agent,
- compact verification summary visible in Agent,
- statuses clear,
- `View diff` only with diff,
- full diff collapsed,
- existing diff data reused,
- Chat has no diff/test UI,
- tests/manual verification exist.

## Agentic Planning Discipline

Complete only if:

- non-trivial Agent Mode requests cannot direct-answer before planning,
- Agent Mode inventories workspace/docs before creating plan,
- Agent Mode selects relevant skills before creating plan,
- context collection is logged,
- adaptive plan is requested/validated before execution,
- saved plan/checkpoint used for continue/resume,
- direct-answer exception is narrow and logged,
- tests cover bad model direct-answer repair,
- tests cover streaming order/status before final prose,
- Chat Mode direct behavior unchanged.

## Observability

Complete only if:

- chat and agent runs get durable JSONL,
- summary JSON written,
- routing/model/plan/tool/diff/verification logged,
- prompt modes work,
- secrets redacted,
- logging failure non-fatal,
- API exposes logs safely,
- Agent UI exposes current/latest log compactly,
- tests cover logger/redaction/API.

## Testing

Complete only if:

- `npm test` deterministic,
- mock tests assert behavior, not just canned output,
- real model smoke script opt-in,
- `nemotron-3-nano:4b` smoke can skip clearly,
- temp workspace only,
- smoke prints log path,
- runtime default/session cleanup regression tested.

## Session Cleanup

Complete only if:

- session storage documented,
- cleanup behavior documented,
- active sessions preserved,
- cleanup scoped to safe directories,
- no silent destructive deletion of user-needed sessions,
- tests cover stale cleanup and active preservation.

---

# Validation Commands

Run before final report:

```bash
npm run build:packages
npm run build:apps
npm run build
npm test
```

For UI:

```bash
npm run build --workspace web
npm run lint --workspace web
```

If lint missing, document.

For real model smoke:

```bash
HARNESS_REAL_MODEL_TESTS=1 \
HARNESS_RUNTIME_PROVIDER=ollama-legacy \
HARNESS_MODEL=nemotron-3-nano:4b \
OLLAMA_MODEL=nemotron-3-nano:4b \
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 \
npm run test:real-model
```

Do not include real model smoke in normal `npm test`.

Do not claim any pass unless command ran.

---

# Commit Policy

Commit meaningful chunks.

Recommended commits:

```bash
git add .
git commit -m "test(runtime): protect Ollama defaults"

git add .
git commit -m "fix(sessions): harden cleanup behavior"

git add .
git commit -m "feat(logs): add durable harness run logs"

git add .
git commit -m "test(agent): add real local model smoke"

git add .
git commit -m "refactor(agent): split mode shell modules"

git add .
git commit -m "fix(ui): reduce agent panel clutter"

git add .
git commit -m "docs: document runtime logs and smoke tests"
```

Use `caveman-commit` if helpful.

---

# Final Report Format

At completion, report:

```text
Branch:
Base commit:
Target commit found: yes/no
Latest commit patch inspected: yes/no
Files changed by target commit:
Preserved target commit fixes:
Commits made:
Files changed:

Audit:
- Stage 1:
- Stage 2:
- Stage 3/runtime:
- Stage 4/UI:
- Stage 5/diff-test:
- Observability:
- Testing:
- Session cleanup:
- Docs:
- Agentic planner gate:
- Workspace inventory:
- Skill selection:
- Latest commit preservation:

Runtime:
- default provider:
- default model:
- Ollama status:
- llama.cpp status:
- fallback behavior:
- tests:

Session cleanup:
- storage path:
- cleanup rule:
- active-session protection:
- tests:

Agentic behavior:
- direct-answer prevention:
- workspace_doc_inventory event:
- agent_skill_selection event:
- adaptive plan event:
- tests:

Logging:
- module:
- log path:
- schema:
- prompt mode:
- redaction:
- API:
- UI:

Real smoke:
- ran/skipped:
- model:
- result:
- log path:

Validation:
- command | pass/fail/not run | output summary

Known limitations:
- remaining risks
- manual checks needed
```

Evidence only. No vague "done".

---

# Anti-Regressions

Do not break:

- latest `Fix Ollama default runtime and clean sessions` behavior,
- direct Chat Mode,
- streaming,
- image attachments,
- Agent approvals,
- trusted edit,
- full-agent mode,
- runtime config UI,
- Ollama model support,
- llama.cpp support if present,
- adaptive plan persistence,
- rollback/checkpoints,
- existing mock tests,
- MinimalDiffTestSummary,
- Agent Mode planner-first behavior,
- Chat Mode direct-answer behavior,
- workspace_doc_inventory before Agent planning,
- agent_skill_selection before Agent planning,
- latest commit runtime/session fixes.

If a change threatens any item, stop and document the tradeoff.

---

# Specific Traps

1. Do not proceed from wrong commit.
2. Do not blindly force old llama.cpp-primary rule over latest Ollama default fix.
3. Do not delete real user sessions.
4. Do not redo Stage 1–5 from scratch.
5. Do not delete working `MinimalDiffTestSummary`.
6. Do not create second planning system.
7. Do not create second diff engine.
8. Do not make logging block streaming.
9. Do not log secrets.
10. Do not include real model smoke in normal `npm test`.
11. Do not use real repo as smoke edit workspace.
12. Do not claim Stage 4 complete without UI clutter check.
13. Do not claim tests pass without running.
14. Do not use `doc` skill for Markdown.
15. Do not let `caveman` compress away evidence.
16. Do not let Agent Mode answer non-trivial tasks directly without workspace inspection and plan.
17. Do not skip `git show HEAD`; commit subject alone is not enough.
18. Do not hide early direct prose in Agent Mode as if it were planned output.
19. Do not skip skill selection for non-trivial Agent tasks.

---

# Definition of Done

Done only when:

```text
1. Target commit verified or missing status reported.
2. Latest Ollama default/session cleanup fixes preserved.
3. Stage 1–5 gates complete or honestly documented.
4. Latest commit patch was inspected and runtime/session fixes were preserved.
5. Agent Mode inventories workspace docs and selects skills before planning.
6. Agent Mode is planner-first for non-trivial tasks and cannot silently direct-answer.
7. Durable logs exist for Chat and Agent runs.
8. Logs show prompt/model/tool/plan/diff/verification flow.
9. Logs are safe to share after redaction.
10. Real local smoke test exists for nemotron-3-nano:4b.
11. Mock tests assert meaningful harness behavior.
12. Session cleanup safe and tested.
13. AgentMode maintainable enough after extraction.
14. Agent UI summary-first and less cluttered.
15. Chat UI remains clean.
16. Docs explain runtime, logs, sessions, smoke tests.
17. Build/tests ran or failures documented exactly.
```