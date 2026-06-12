# AGENTS.md — FINAL REVIEWED Master Plan for Gemma 4 Harness

## What This File Is

This is the reviewed and finalized master `AGENTS.md` for applying Stage 1 through Stage 5 to the Gemma 4 Harness.

It contains:

1. a **binding reviewed master workflow**,
2. a **gap audit based on the combined stage file and the current codebase**,
3. **required corrections and safeguards** that fill the gaps,
4. the **original Stage 1–5 source instructions preserved below**.

The original stage text is still included below.  
However, where the reviewed master instructions conflict with the preserved source stage text, the reviewed master instructions at the top of this file are the active source of truth.

---

## Binding Master Workflow — Must Be Done First

Before any stage work, perform the branch setup.

The expected current local branch is:

```text
rescue/lightweight-harness-reset
```

The user wants the rescue branch merged into `main` first, then all Stage 1–5 work applied on a new branch.

Run:

```bash
pwd
git status
git branch
git log --oneline --decorate -8
```

Expected local path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

If the current branch is `rescue/lightweight-harness-reset`, merge it into `main`:

```bash
git checkout main
git pull
git merge rescue/lightweight-harness-reset
```

If and only if that merge is clean, create one new branch for the full Stage 1–5 sequence:

```bash
git checkout -b feature/stage-1-to-5-harness-upgrade
```

All stages in this combined implementation must happen on:

```text
feature/stage-1-to-5-harness-upgrade
```

Do not create separate stage branches while applying this combined file unless the user explicitly changes the plan.

The original per-stage files below mention separate stage branches. For this combined master file, those stage-level branch instructions are overridden by this master workflow.

If there are uncommitted changes, stop and report.  
If there are merge conflicts, stop and report conflict files.  
Do not silently continue through conflicts.

---

## Binding Stage Order

Apply stages in this exact order:

```text
Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5
```

Do not reorder.

Use one commit per stage if possible:

```bash
git add .
git commit -m "Stage 1: separate chat and agent modes"

git add .
git commit -m "Stage 2: add adaptive self-planning"

git add .
git commit -m "Stage 3: make llama.cpp GGUF primary"

git add .
git commit -m "Stage 4: redesign UI around clarity"

git add .
git commit -m "Stage 5: add minimal diff and verification summary"
```

After each stage, run the required checks for that stage and report whether it is safe to continue.

---

## Codebase Findings That Must Shape the Implementation

The current codebase has several concrete issues that the stage instructions must account for.

### Finding 1 — The web app still has a massive mixed `HarnessApp`

Current entry flow:

```text
apps/web/src/App.tsx
↓
apps/web/src/HarnessApp.tsx
↓
apps/web/src/app/HarnessApp.tsx
```

`apps/web/src/App.tsx` only imports and exports `HarnessApp`.  
`apps/web/src/HarnessApp.tsx` only re-exports `./app/HarnessApp`.

The real mixed component is:

```text
apps/web/src/app/HarnessApp.tsx
```

That file currently owns too much:

- API helpers,
- chat message types,
- config state,
- workspace state,
- session state,
- model runtime state,
- browser folder context,
- agent run summaries,
- task plan state,
- trace handling,
- approvals,
- streaming events,
- UI layout.

Stage 1 and Stage 4 must therefore prioritize decomposing this file. Do not leave a huge mixed `HarnessApp.tsx` as the permanent architecture.

### Required Fix

Stage 1 must extract from `apps/web/src/app/HarnessApp.tsx` into clear modules:

```text
apps/web/src/app/AppShell.tsx
apps/web/src/app/ModeLanding.tsx

apps/web/src/app/chat/
  ChatMode.tsx
  ChatComposer.tsx
  ChatMessageList.tsx
  ChatMessageRow.tsx
  ChatHistory.tsx
  chatTypes.ts
  chatApi.ts

apps/web/src/app/agent/
  AgentMode.tsx
  AgentWorkspacePanel.tsx
  AgentTaskComposer.tsx
  AgentRunConsole.tsx
  AgentStatusPanel.tsx
  agentTypes.ts
  agentApi.ts

apps/web/src/app/shared/
  apiBase.ts
  RuntimeStatusBadge.tsx
  SettingsModal.tsx
  MarkdownRenderer.tsx
  attachments.ts
```

Do not force exact names if the codebase suggests better names, but the final architecture must remove the current mixed product surface.

### New Component Size Rule

After Stage 1 and Stage 4:

```text
apps/web/src/app/HarnessApp.tsx
```

should become a thin shell, not the main product.

Target:

```text
HarnessApp.tsx <= 250 lines if possible
No single new component > 500 lines unless justified
Move shared types out of component files
Move API helpers out of component files
Move CSS into organized mode/component sections
```

---

### Finding 2 — Chat and Agent are currently separated only by `agentic`, and the backend defaults to Agent behavior

The API currently treats a request as agentic unless `body.agentic !== false` evaluates false.

That means the default behavior is dangerous for Chat Mode:

```ts
const isAgentic = body.agentic !== false;
```

If Chat Mode forgets to send `agentic: false`, a normal chat can accidentally become an agentic request.

### Required Fix

Stage 1 must introduce explicit request modes.

Chat Mode requests must send something equivalent to:

```json
{
  "mode": "chat",
  "agentic": false,
  "executionMode": "direct",
  "workspaceRoot": null,
  "allowTools": false
}
```

Agent Mode requests must send something equivalent to:

```json
{
  "mode": "agent",
  "agentic": true,
  "executionMode": "agentic",
  "workspaceRoot": "<selected workspace>",
  "allowTools": true
}
```

Backend behavior must be made safer:

```text
Default should be direct/chat if mode is missing.
Agentic execution should require explicit mode: agent or agentic: true from Agent Mode.
```

Do not rely on hidden frontend assumptions.

### Backend Boundary Rule

Direct Chat Mode must not be allowed to trigger:

- file reads,
- file writes,
- patching,
- deletes,
- command execution,
- approvals,
- checkpoints,
- rollback,
- workspace indexing,
- repo context injection.

If existing `directChatStream` still accepts callbacks for tool/run events, ensure that Chat Mode does not expose them and that direct chat cannot call repo tools.

---

### Finding 3 — `TaskPlan` and run types are duplicated between backend packages and web types

The repo has task/run plan shapes in:

```text
packages/task-orchestrator/src/index.ts
apps/web/src/types/run.ts
```

They define parallel versions of:

- `TaskComplexity`,
- `TaskStepType`,
- `TaskStepStatus`,
- `TaskBudget`,
- `TaskStep`,
- `TaskPlan`.

This can drift.

### Required Fix

Stage 2 should avoid creating yet another disconnected plan type.

Preferred direction:

```text
packages/task-orchestrator
  owns canonical TaskPlan / AdaptivePlan types

apps/web
  imports generated/shared types where practical
  or mirrors only stable DTOs with explicit conversion
```

If direct cross-package type import causes build issues, create a dedicated shared DTO contract:

```text
packages/task-orchestrator/src/adaptive-types.ts
apps/web/src/types/run.ts must match it intentionally
```

Add comments in duplicated frontend DTOs if duplication remains:

```ts
// Mirrors @local-harness/task-orchestrator AdaptivePlan DTO.
// Keep in sync with packages/task-orchestrator/src/adaptive-types.ts.
```

Do not create untracked type drift.

---

### Finding 4 — The current planner already has fixed templates and budget profiles

`packages/task-orchestrator/src/index.ts` already defines task complexity types, task step types, statuses, budgets, local model budget profiles, and a `planStepTemplates(...)` function.

The Stage 2 implementation should not throw away the whole orchestrator.

### Required Fix

Stage 2 must refactor in this order:

1. Preserve existing `TaskPlan` and `TaskStep` enough not to break the Run Console.
2. Add `AdaptivePlan` / `AdaptiveGoal` contracts.
3. Add plan validation.
4. Add AI-generated plan creation as the preferred path for non-trivial Agent Mode tasks.
5. Normalize `AdaptiveGoal[]` into existing `TaskStep[]` for UI/execution compatibility.
6. Keep fixed templates only as safe fallback, not as the main planner path.

Do not replace deterministic execution with free-form model behavior.

---

### Finding 5 — Existing Run Checkpoint fields already cover much of Stage 2 resume behavior

The web run types already include a `RunCheckpoint` shape with:

- `runId`,
- `sessionId`,
- `taskPlan`,
- `currentStepId`,
- `completedSteps`,
- `failedSteps`,
- `blockedSteps`,
- `filesRead`,
- `filesWritten`,
- `filesDeleted`,
- `commandsRun`,
- `approvals`,
- `summarySoFar`,
- `lastToolResults`,
- timestamps.

### Required Fix

Stage 2 must reuse the existing checkpoint/run-state idea instead of inventing an unrelated persistence system.

Add adaptive plan state into the existing run/checkpoint path.

Do not create parallel persistence unless required.

---

### Finding 6 — The model adapter currently defaults to Ollama

`packages/model-adapter/src/config.ts` currently uses:

```text
OPENAI_BASE_URL || http://127.0.0.1:11434/v1
OPENAI_API_KEY || ollama
HARNESS_FAST_MODEL || HARNESS_MODEL || gemma4:e4b
```

That means Stage 3 must explicitly replace the default provider behavior.

### Required Fix

Stage 3 must add runtime identity and priority, not just change one URL.

Required concepts:

```text
primary provider: llamacpp
fallback provider: ollama
active provider
primary status
fallback status
fallback warning
model path/alias for GGUF
```

Do not keep runtime identity implicit inside `OPENAI_BASE_URL`.

---

### Finding 7 — `.gitignore` currently does not protect `models/`

The current `.gitignore` protects many folders, but the reviewed codebase did not show `models/` or `*.gguf` rules.

### Required Fix

Stage 3 must add:

```gitignore
# Local GGUF models
models/
*.gguf
*.gguf.*
```

If the app needs the folder present:

```gitignore
models/*
!models/.gitkeep
*.gguf
*.gguf.*
```

Before completing Stage 3, run:

```bash
git status --ignored --short models
git check-ignore -v models/* || true
```

The 9.6 GB GGUF model must not appear as a normal untracked file.

---

### Finding 8 — The current UI layout uses a side settings panel that widens the grid

`apps/web/src/index.css` currently has a layout pattern where settings open by changing the grid columns, for example:

```css
.main-layout.settings-open {
  grid-template-columns: 240px minmax(0, 1fr) 360px 380px;
}
```

This is exactly the layout problem Stage 4 is meant to fix.

### Required Fix

Stage 4 must remove settings as a layout-expanding side panel.

Settings must become a centered modal/popover overlay:

```text
Settings button
↓
Centered modal
↓
Dim background
↓
Tabs/sections inside modal
↓
Close with X
↓
Close with Escape
↓
No main layout squeeze
```

The main Chat and Agent layouts must not change width when settings open.

---

### Finding 9 — The existing Run Console already has diff parsing and structured diff display

`apps/web/src/components/run-console/RunConsole.tsx` already accepts:

```text
gitDiff
structuredDiff
```

It already computes changed files from structured diff or raw git diff.

It also already renders code changes and raw/inline diffs.

### Required Fix

Stage 5 must not invent a new diff backend.

Stage 5 should extract a minimal summary from existing `RunConsole` data:

```text
changed files
added/removed count
verification trace results
View diff
```

Important: the current diff details appear to render open by default in the existing code.

Stage 5 must make the detailed diff collapsed by default and present the compact summary first.

Required behavior:

```text
Summary visible by default
Full diff hidden/collapsed by default
View diff reveals existing diff view or scrolls to it
No new heavy diff engine
```

---

### Finding 10 — Root validation commands must match the repo scripts

The root `package.json` has these scripts:

```text
npm run build:packages
npm run build:apps
npm run build
npm test
```

The web package has:

```text
npm run build --workspace web
npm run lint --workspace web
```

### Required Fix

Each stage should prefer the smallest relevant check first, then root checks when appropriate.

Recommended validation strategy:

```bash
# After frontend-only stages
npm run build --workspace web
npm run lint --workspace web

# After model/core/API stages
npm run build:packages
npm run build:apps

# Before final completion
npm run build
npm test
```

Do not claim `npm test` passed unless it actually ran.

---

## Final Reviewed Stage Gates

Use these gates in addition to the original stage definitions below.

### Stage 1 Gate — Chat/Agent Separation

Stage 1 is not done until:

- Chat Mode and Agent Mode are separate top-level surfaces.
- `apps/web/src/app/HarnessApp.tsx` is no longer the giant mixed product component.
- Chat Mode sends explicit direct/chat requests.
- Agent Mode sends explicit agentic requests.
- Backend defaults are safe if mode is missing.
- Chat Mode cannot expose repo/workspace/tool/write/approval controls.
- Agent Mode preserves current run console/tool/progress behavior.
- Build passes or failure is documented.

### Stage 2 Gate — Adaptive Self-Planning

Stage 2 is not done until:

- adaptive plan contracts exist,
- plan validation exists,
- adaptive planning is the primary path for non-trivial Agent Mode tasks,
- fixed templates are fallback only,
- generated plans normalize into existing Run Console-compatible task steps,
- plan state persists through the existing run/checkpoint path,
- `continue`, `resume`, and `act on the plan` use saved plan state,
- invalid or vague plans are rejected or repaired safely,
- build/tests pass or failures are documented.

### Stage 3 Gate — llama.cpp/GGUF Primary

Stage 3 is not done until:

- `models/` and `*.gguf` are ignored,
- llama.cpp is primary,
- Ollama is fallback only,
- fallback is never silent,
- runtime identity is visible,
- runtime health checks are bounded,
- model adapter types/config expose provider identity,
- docs or `.env.example` explain llama.cpp startup,
- build passes or failure is documented.

### Stage 4 Gate — UI Clarity Redesign

Stage 4 is not done until:

- dark theme is preserved,
- landing screen is clean,
- Chat screen is clean and free of agent clutter,
- Agent screen clearly shows runtime/model/workspace/write-access/current-goal,
- settings are a centered modal, not a side panel,
- Chat LaTeX/KaTeX and markdown are readable,
- long logs and full diffs are collapsed by default,
- responsive behavior is acceptable,
- build passes or failure is documented.

### Stage 5 Gate — Minimal Diff/Test Visibility

Stage 5 is not done until:

- Agent Mode shows a compact changed-files summary,
- Agent Mode shows compact verification summary,
- pass/fail/not-run statuses are clear,
- `View diff` exists only when diff is available,
- full diff is collapsed by default,
- existing Run Console diff data is reused,
- Chat Mode does not show diff/test UI,
- panel does not control or block agent execution,
- build passes or failure is documented.

---

## Additional Implementation Rules Added by Review

### Rule 1 — Do not let preserved stage branch instructions override the master branch plan

The preserved stage files below still mention per-stage feature branches.

Ignore those branch instructions for this combined implementation.

Use only:

```text
feature/stage-1-to-5-harness-upgrade
```

unless the user changes the plan.

### Rule 2 — Keep stage commits separate

Even though all work happens on one branch, commit after each stage.

This makes rollback and review easier.

### Rule 3 — Avoid one giant final PR-style refactor

Do not attempt to do all five stages in one chaotic edit.

Complete and verify one stage at a time.

### Rule 4 — Prefer extraction before redesign

For Stage 1 and Stage 4, first extract existing working logic into mode-specific components. Then clean design.

Do not rewrite working streaming, approvals, run state, or markdown behavior from scratch unless necessary.

### Rule 5 — Add safety tests where behavior is dangerous

At minimum, add targeted tests or validation checks for:

- Chat request cannot become agentic by default.
- Chat request does not carry workspace context.
- Agent request can still use workspace/tool path.
- Adaptive plan validator rejects vague goals.
- Runtime fallback emits warning.
- Minimal diff summary hides full diff by default.

If test infrastructure makes this hard, document manual verification clearly.

### Rule 6 — Update docs as part of implementation

Update or create docs for:

```text
docs/stage-1-to-5-upgrade.md
docs/runtime.md
.env.example
README.md
```

Only add documents that fit the repo’s current pattern.

At minimum, Stage 3 needs runtime setup docs.

### Rule 7 — Keep generated plan artifacts out of git unless intentionally requested

If Stage 2 writes plan artifacts, use:

```text
.gamma-harness/plans/<run-id>/plan.json
.gamma-harness/plans/<run-id>/plan.md
```

The `.gamma-harness/` folder is already intended as harness state and should remain ignored.

Do not scatter generated `plan.md` files into the repo root unless the user explicitly asks.

### Rule 8 — Make UI debug data opt-in

After Stage 4, debug traces, raw payloads, huge diffs, and long command outputs should be collapsed under details or advanced sections.

The user should see clear summary first.

### Rule 9 — Treat current codebase as the source of truth

The preserved instructions below contain suggested file paths. Before editing, inspect the real files.

Do not create duplicate systems because a suggested filename exists.

### Rule 10 — Report honestly after each stage

Required report after each stage:

```text
Stage completed
Files changed
What changed
Checks run
Check results
Known limitations
Safe to continue: yes/no
```

---

## Reviewed Gap Summary

The original combined file was strong, but these gaps needed to be filled:

1. **Branch workflow conflict** — master said one branch; stage sources still said stage branches.
2. **Huge mixed component risk** — current `HarnessApp.tsx` must be explicitly decomposed.
3. **Unsafe backend default** — `/api/chat` currently defaults to agentic unless `agentic: false`.
4. **Duplicated task plan types** — frontend and package types can drift.
5. **Stage 2 plan UI wording issue** — `plan.md` should be human-readable UI, while `plan.json` is executable source of truth.
6. **Existing checkpoint system not emphasized enough** — Stage 2 should reuse it.
7. **Ollama default hardcoding** — model adapter currently defaults to Ollama.
8. **Missing model ignore rule** — `models/` and `*.gguf` must be gitignored.
9. **Settings side panel known source** — current CSS expands grid for settings; Stage 4 must replace it with a modal.
10. **Stage 5 could duplicate existing diff logic** — it must reuse current Run Console diff data and collapse details by default.
11. **Validation commands needed repo-specific correction** — root scripts include `build:packages`, `build:apps`, `build`, and `test`.
12. **Debug/log overload risk** — raw traces/logs/diffs must become opt-in details.
13. **Tests/gates needed sharper pass criteria** — each stage now has explicit gates.

---

# Preserved Original Combined Stage Plan

The original combined stage plan is preserved below. Apply it together with the reviewed master corrections above.



---

# AGENTS.md — Master Implementation Plan for Gemma 4 Harness

## Master Instruction

This file combines **Stage 1 through Stage 5** into one ordered implementation plan.

Apply the stages in this exact order:

1. Stage 1 — Separate Chat Mode and Agent Mode
2. Stage 2 — Replace Rigid Planner with Adaptive Self-Planning
3. Stage 3 — Make llama.cpp/GGUF the Primary Runtime
4. Stage 4 — Redesign UI Around Clarity
5. Stage 5 — Add Minimal Diff/Test Visibility Without Hindering the Agent

Do not skip stages.  
Do not reorder stages.  
Do not start Stage 2 before Stage 1 is complete.  
Do not start Stage 3 before Stage 2 is complete.  
Do not start Stage 4 before Stage 3 is complete.  
Do not start Stage 5 before Stage 4 is complete.

The stage sections below preserve the original stage instructions, goals, explanations, requirements, scope boundaries, implementation principles, suggested file directions, and definitions of done.

---

## Master Repository and Branch Workflow

Before doing any stage work, handle the current branch state exactly as described here.

The user reported the current branch state as:

```text
experiment/action-dsl-workflow-26b
main
* rescue/lightweight-harness-reset
```

The current branch is expected to be:

```text
rescue/lightweight-harness-reset
```

### Required First Step — Merge Rescue Branch into Main

Before starting Stage 1, inspect the repo:

```bash
pwd
git status
git branch
git log --oneline --decorate -8
```

Expected local repository path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

If the current branch is `rescue/lightweight-harness-reset`, merge it into `main` first:

```bash
git checkout main
git pull
git merge rescue/lightweight-harness-reset
```

If the merge is clean, create one new branch for the full Stage 1–5 process:

```bash
git checkout -b feature/stage-1-to-5-harness-upgrade
```

All Stage 1–5 work in this combined plan should happen on:

```text
feature/stage-1-to-5-harness-upgrade
```

If there are merge conflicts, stop and report the conflict files clearly. Do not guess through conflicts silently.

If there are uncommitted changes, stop and report them before continuing.

### Required Stage Order on the New Branch

After creating the new branch, apply the stages in this order:

```text
Stage 1 → Stage 2 → Stage 3 → Stage 4 → Stage 5
```

Each stage must be completed, checked, and reported before moving to the next stage.

### Required Reporting Between Stages

At the end of each stage, report:

```text
Stage completed
Files changed
Checks run
Check results
Known limitations
Whether it is safe to continue to the next stage
```

Do not continue to the next stage if the current stage breaks the build or leaves unresolved conflicts unless the user explicitly tells you to continue.

---

## Master Scope Rule

This combined file does not authorize unrelated work.

Only complete the work described in Stage 1 through Stage 5.

Do not add unrelated features.  
Do not perform broad refactors outside the stated goals.  
Do not hide failures.  
Do not claim checks passed unless they actually passed.

---



---

# Combined Stage 1 Source — Stage 1 — Separate Chat Mode and Agent Mode

# AGENTS.md — Stage 1: Separate Chat Mode and Agent Mode

## Mission

Refactor the Local AI Harness so **Chat Mode** and **Agent Mode** become two clearly separated product areas in both the user interface and the codebase.

The current harness is already useful, but the web app mixes normal chat, agent controls, runtime settings, workspace settings, planner controls, tool activity, approvals, diffs, and verification output into one confusing surface. This task fixes that foundation first.

This stage is **only** about separating Chat Mode and Agent Mode. Everything else comes later.

Do **not** redesign the full agent system in this task.  
Do **not** migrate the runtime to GGUF/llama.cpp in this task.  
Do **not** rebuild the planner in this task.  
Do **not** build the advanced diff/test panel in this task.  
Do **not** add broad web search in this task.  
Do **not** add new dangerous tools in this task.

The goal is to create a clean architecture where Chat Mode and Agent Mode can be developed independently in later tasks.

---

## Repository and Branch Rules

Before changing code, confirm the local repository and branch.

Expected local repository path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

Expected project:

```text
Local-AI-Harness / Gemma 4 Harness
```

The user reported the current branches as:

```text
experiment/action-dsl-workflow-26b
main
* rescue/lightweight-harness-reset
```

The expected current branch before starting is:

```text
rescue/lightweight-harness-reset
```

### Required Git Workflow

Do not start this feature directly on `rescue/lightweight-harness-reset`.

First inspect the current state:

```bash
git status
git branch
git log --oneline --decorate -5
```

If the current branch is `rescue/lightweight-harness-reset`, merge it into `main` first:

```bash
git checkout main
git pull
git merge rescue/lightweight-harness-reset
```

If the merge is clean, create a new task branch:

```bash
git checkout -b feature/separate-chat-agent-modes
```

All implementation work for this task should happen on:

```text
feature/separate-chat-agent-modes
```

If merge conflicts occur, stop and report the conflict files clearly. Do not silently guess through conflicts.

---

## Product Outcome

When the user opens the web UI, the first experience should be a clear mode choice:

```text
Chat
Agent
```

The user should not have to understand runtime internals, workspace paths, tools, approvals, or agent settings before choosing what they want to do.

The product should feel like one app with two clean areas:

```text
Chat Mode = normal AI conversation
Agent Mode = local repo/workspace coding harness
```

The user should always know which mode they are in.

---

## Target Architecture

Move the app toward this structure:

```text
App
├── Chat Mode
│   ├── chat UI
│   ├── message history
│   ├── file upload for conversation context
│   ├── markdown rendering
│   ├── optional web-search seam for later
│   └── no repo tools
│
├── Agent Mode
│   ├── workspace selector
│   ├── adaptive-planner seam for later
│   ├── goal-runner seam for later
│   ├── tool layer
│   ├── state manager
│   ├── basic diff/check output if already present
│   └── repo tools
│
└── Runtime Layer
    ├── current model adapter behavior preserved
    ├── llama.cpp/GGUF seam for later
    └── Ollama fallback behavior preserved for now
```

For this stage, the runtime layer should mostly be left alone. The important work is separating the two surfaces and their state/API boundaries.

---

## Core Separation Rule

Chat Mode is for conversation.  
Agent Mode is for working on a local repository.

Shared utilities are allowed. Mixed product surfaces are not.

Allowed shared areas may include:

- API base helper,
- markdown renderer,
- attachment helpers,
- basic model display utilities,
- general layout helpers,
- shared TypeScript types that are genuinely common.

Not allowed:

- Chat Mode showing workspace controls,
- Chat Mode exposing repo tools,
- Chat Mode sending workspace context,
- Agent Mode depending on Chat Mode message rows for core tool/progress display,
- one large component continuing to own both full products.

---

## Chat Mode Requirements

Chat Mode should be optimized for:

- normal conversation,
- fast answer streaming,
- clean markdown rendering,
- beautiful readable assistant responses,
- simple file upload for conversation context where already supported,
- image attachment support if already supported safely,
- chat history,
- useful thread titles instead of meaningless thread numbers,
- clean thinking display if already implemented,
- no local repo access,
- no dangerous tools,
- no visible agent settings.

### Chat Mode Must Not Show

Chat Mode must not show or expose:

- workspace path,
- repo path,
- local filesystem selector,
- terminal controls,
- command execution controls,
- file write permissions,
- planner settings,
- goal runner controls,
- tool configuration,
- approval mode,
- Docker internals,
- runtime debugging panels,
- agent checkpoints,
- git diff panels,
- verification panels,
- tool activity logs,
- repo indexing controls.

### Chat Mode Behavior

When the user sends a message in Chat Mode:

1. Treat the message as normal conversation.
2. Do not include workspace context.
3. Do not include repo files.
4. Do not allow local file tools.
5. Do not allow write, patch, delete, checkpoint, rollback, or command tools.
6. Stream the answer quickly if streaming is already supported.
7. Render markdown cleanly.
8. Preserve supported attachment behavior.
9. Save chat history if history already exists or can be cleanly isolated.
10. Generate or update a useful thread title if that can be done without expanding scope too much.

Chat Mode should feel like a clean local ChatGPT-style interface, not a coding-agent dashboard.

---

## Agent Mode Requirements

Agent Mode should be optimized for:

- selecting a repo/workspace,
- showing the active workspace clearly,
- reading files,
- making implementation plans,
- editing files,
- running commands,
- showing progress,
- showing tool activity,
- showing approvals,
- saving run/session state,
- continuing work,
- verifying changes.

For this stage, Agent Mode should not be overbuilt. Strengthen and isolate what already works.

### Agent Mode May Show

Agent Mode may show:

- workspace root,
- repo selector,
- execution mode,
- current task,
- current plan,
- current step,
- run console,
- tool calls,
- approvals,
- changed files,
- basic diff/check output,
- command output,
- checkpoints,
- verification status,
- agent settings.

### Agent Mode Behavior

When the user sends a task in Agent Mode:

1. The app should know this is a repo/agent task.
2. The selected workspace should be included only from Agent Mode.
3. The agent may inspect files according to the existing tool and policy system.
4. The agent may use repo tools according to existing policy.
5. The agent may ask for approval where the current system requires it.
6. The run console should show progress and tool activity.
7. Existing diff/check/verification output should remain available if already implemented.
8. The final answer should summarize what happened.

Agent Mode should feel like a focused coding harness, not a general chat page with random tools attached.

---

## Three Required Implementation Goals

Complete this task in exactly three implementation goals:

1. **Inspect current architecture and create the top-level mode split.**
2. **Separate Chat UI/state from Agent UI/state.**
3. **Separate API boundaries, validate, and report.**

If an unavoidable small extra cleanup is needed, explain it clearly in the final report. Do not silently expand scope.

---

# Goal 1 — Inspect Current Architecture and Create the Top-Level Mode Split

## Purpose

Understand the current codebase first, then introduce a clear top-level split between Chat Mode and Agent Mode.

This goal combines inspection, routing/surface separation, and initial Chat/Agent landing behavior.

## Required Inspection

Before editing, inspect the project structure.

Run:

```bash
pwd
git status
git branch
ls
find . -maxdepth 3 -type f | sort | sed 's#^\./##' | head -200
```

Inspect workspace/package structure:

```bash
cat package.json
find apps -maxdepth 3 -type f | sort
find packages -maxdepth 3 -type f | sort | head -200
```

Identify:

- React web entry point,
- current main app component,
- current chat components,
- current agent/run-console components,
- current API client calls,
- current session/history logic,
- current attachment logic,
- current settings panels,
- current workspace selector logic,
- current runtime/model config UI,
- current approval/tool/diff/check UI,
- current backend chat/agent endpoint behavior.

Likely important areas to inspect include:

```text
apps/web/src/App.tsx
apps/web/src/HarnessApp.tsx
apps/web/src/app/
apps/web/src/components/
apps/web/src/components/run-console/
apps/web/src/components/approvals/
apps/web/src/types/
apps/api/src/
packages/core/src/
packages/tool-runtime/
packages/session-store/
packages/workspace-policy/
```

Do not assume the exact structure. Inspect first.

## Required Product Change

Create a top-level mode choice.

The first app screen should clearly offer:

```text
Chat
Agent
```

The landing surface should be simple and should not show:

- runtime settings,
- workspace settings,
- agent controls,
- tool logs,
- approval queues,
- diff panels,
- command output,
- advanced configuration.

## Expected Landing Flow

The user opens the app and sees something like:

```text
Choose mode

[ Chat ]
Normal conversation, file context, markdown answers, and history.

[ Agent ]
Work on a local repo, inspect files, plan, edit, run commands, and verify changes.
```

When the user clicks Chat, they enter Chat Mode.  
When the user clicks Agent, they enter Agent Mode.

There should be a simple way to return to the mode landing or switch modes without making the app confusing.

## Routing Options

Use the simplest routing approach that fits the current app:

- internal React state,
- hash routing,
- browser history routing,
- or an existing router if already present.

Do not add a major routing dependency unless the project already uses one or there is a strong reason.

## Code Organization Direction

Move toward explicit separation names.

Preferred direction:

```text
apps/web/src/app/
  AppShell.tsx
  ModeLanding.tsx
  chat/
  agent/
  shared/
```

Do not force this exact structure if the current codebase suggests a cleaner path. The required outcome is separation, not a specific folder layout.

## Completion Criteria for Goal 1

Goal 1 is complete when:

- the current architecture has been inspected,
- the app has a visible Chat/Agent mode choice,
- Chat and Agent have separate top-level surfaces,
- the existing app still starts,
- no major behavior has been removed,
- no unrelated runtime/model/planner changes have been made.

---

# Goal 2 — Separate Chat UI/State from Agent UI/State

## Purpose

Move normal conversation behavior into Chat Mode and local-repo behavior into Agent Mode.

This goal combines UI extraction, state separation, and responsibility cleanup.

## Chat Mode Implementation

Extract or create a dedicated Chat Mode surface.

Suggested files may include:

```text
apps/web/src/app/chat/ChatMode.tsx
apps/web/src/app/chat/ChatComposer.tsx
apps/web/src/app/chat/ChatMessageList.tsx
apps/web/src/app/chat/ChatMessageRow.tsx
apps/web/src/app/chat/ChatHistory.tsx
apps/web/src/app/chat/chatTypes.ts
```

Use existing code where possible. Do not rewrite everything from scratch if extraction is enough.

Chat Mode should contain only Chat-relevant UI:

- message list,
- user/assistant message rows,
- composer/input,
- plus/file attachment UI if already supported,
- image preview if already supported,
- clean markdown rendering,
- normal thinking display if already implemented,
- chat/thread history if already present or easy to isolate.

### Important Chat Component Rule

If the existing message row component renders agent run steps, tool calls, approvals, run summaries, diffs, or verification output, split it.

A clean Chat message row should render only:

- role,
- timestamp if desired,
- attachments,
- markdown content,
- thinking block if appropriate.

Agent run details should move to Agent Mode components.

The Chat message renderer should not be the primary place where agent plans, tools, approvals, diffs, or verification are displayed.

## Agent Mode Implementation

Extract or create a dedicated Agent Mode surface.

Suggested files may include:

```text
apps/web/src/app/agent/AgentMode.tsx
apps/web/src/app/agent/AgentWorkspacePanel.tsx
apps/web/src/app/agent/AgentTaskComposer.tsx
apps/web/src/app/agent/AgentRunConsole.tsx
apps/web/src/app/agent/AgentSettingsPanel.tsx
apps/web/src/app/agent/agentTypes.ts
```

Agent Mode should contain the existing agent capabilities:

- workspace selector,
- active workspace display,
- task prompt,
- execution mode controls if already present,
- current plan,
- current step,
- tool activity,
- approvals,
- basic changed-file/diff display if already present,
- verification output if already present,
- run/session state if already present,
- agent settings if already present.

Do not remove existing working agent features. Move them into the correct mode.

## State Separation

Chat Mode state may include:

```text
chat messages
active chat/thread/session
message attachments
chat input
chat history list
basic model display if needed
```

Agent Mode state may include:

```text
workspace root
execution mode
agent prompt/task
active run id
task plan
current step
run traces
tool events
approvals
git diff
structured diff
checkpoints
command output
verification output
policy/write mode
agent settings
```

Shared state is allowed only when it is truly shared, such as:

```text
API base URL
basic model name display
markdown renderer
attachment utilities
general layout utilities
```

Do not let Chat Mode carry Agent Mode state just because it used to live in the same large component.

## UI Separation

Chat Mode should not have a side panel full of agent settings.

Agent Mode may have panels because it needs operational visibility.

The visual difference should be obvious:

```text
Chat Mode = clean conversation interface
Agent Mode = workspace + task + tool/progress interface
```

## Expected User Flow for Chat Mode

1. User chooses Chat.
2. User sees a clean chat interface.
3. User sends a normal message.
4. The assistant responds normally.
5. Markdown renders correctly.
6. Existing attachment behavior still works if previously supported.
7. No workspace path is shown.
8. No repo tools are visible.
9. No approval or command controls are visible.
10. No agent runtime/debug panel is shown.

## Expected User Flow for Agent Mode

1. User chooses Agent.
2. User sees workspace/repo controls.
3. User selects or confirms workspace.
4. User enters a task.
5. Existing agent execution behavior runs.
6. Tool activity/progress is visible.
7. Approvals still work where already implemented.
8. Diff/check output remains available if already implemented.
9. Run/session state remains available if already implemented.

## Completion Criteria for Goal 2

Goal 2 is complete when:

- Chat UI is isolated into Chat Mode,
- Agent UI is isolated into Agent Mode,
- Chat Mode no longer renders agent run details,
- Agent Mode still renders run/tool/progress details,
- Chat state and Agent state are separated enough for future independent work,
- existing behavior is preserved as much as possible,
- no unrelated planner/runtime overhaul has been introduced.

---

# Goal 3 — Separate API Boundaries, Validate, and Report

## Purpose

Make frontend/backend usage mode-aware, prevent Chat Mode from accidentally triggering repo tools, then validate the implementation.

This goal combines API boundary cleanup, safety checks, build/test validation, and final reporting.

## API Boundary Requirements

If the frontend currently uses one shared chat/stream endpoint for both normal chat and agentic execution, keep it working but make the request boundary explicit.

Chat Mode requests must not include:

- workspace root,
- browser workspace snapshot,
- repo file list,
- repo context pack,
- execution mode set to agentic,
- approval/write policy,
- tool permission requests,
- command execution requests,
- checkpoint requests,
- rollback requests.

Agent Mode requests may include these only when required by existing behavior.

## Chat Mode API Behavior

Chat Mode should call only conversation/chat behavior.

A Chat Mode request should clearly communicate the equivalent of:

```text
mode: chat
executionMode: direct
workspace: none
tools: none or chat-safe only
```

Use the current backend shape if different, but preserve the boundary.

Chat Mode must not be able to accidentally perform:

- file writes,
- patching,
- deleting files,
- running commands,
- reading arbitrary local repo files,
- creating checkpoints,
- rolling back checkpoints.

## Agent Mode API Behavior

Agent Mode may use the existing agent-capable endpoint behavior.

An Agent Mode request may include the equivalent of:

```text
mode: agent
executionMode: agentic
workspaceRoot
browser workspace context if supported
tool traces
approval flow
run metadata
```

Do not redesign the backend deeply in this stage unless required to enforce the separation.

## Backend Safety Check

Inspect backend request handling and identify where mode/execution behavior is interpreted.

Likely areas include:

```text
apps/api/src/server.ts
packages/core/src/engine.ts
packages/core/src/intent-classifier.ts
packages/tool-runtime/
packages/workspace-policy/
```

Ensure there is a clear path where normal chat cannot become a repo-editing run just because the prompt mentions code.

If the backend already has direct versus agentic execution modes, use that distinction more clearly from the frontend.

## Validation Commands

Run the most relevant commands available in the repo.

Start with:

```bash
npm run build
```

If reasonable, also run:

```bash
npm test
```

If the full test suite is too slow or fails for unrelated environment reasons, run targeted checks:

```bash
npm run build --workspace web
npm run build --workspace @local-harness/api
npm run build --workspace @local-harness/core
```

For the web app specifically:

```bash
npm run build --workspace web
```

If lint exists and is reasonable:

```bash
npm run lint --workspace web
```

Do not claim tests passed unless they actually passed.

## Manual Verification Checklist

### Chat Mode

Verify:

- App opens to a clear Chat/Agent mode choice.
- Chat Mode opens from the landing screen.
- Chat Mode shows no workspace path.
- Chat Mode shows no repo selector.
- Chat Mode shows no terminal/command controls.
- Chat Mode shows no planner settings.
- Chat Mode shows no approval mode.
- Chat Mode shows no agent tool panel.
- Chat Mode sends a normal message.
- Chat Mode renders markdown correctly.
- Chat Mode supports existing attachment behavior if previously supported.
- Chat Mode does not include workspace context in requests.
- Chat Mode cannot trigger local repo tools.

### Agent Mode

Verify:

- Agent Mode opens from the landing screen.
- Agent Mode shows workspace/repo controls.
- Agent Mode preserves existing task prompt behavior.
- Agent Mode preserves existing run console/progress behavior.
- Agent Mode preserves approvals if already implemented.
- Agent Mode preserves existing diff/check display if already implemented.
- Agent Mode can still call agent tools according to existing policy.
- Agent Mode can still save or display run/session state if already implemented.

### Cross-Mode

Verify:

- Switching modes does not expose Agent controls inside Chat.
- Switching modes does not remove Agent functionality.
- Shared markdown rendering still works.
- Shared API helpers still work.
- TypeScript builds.
- No unrelated runtime/model/planner behavior was changed.

## Final Report Requirements

At the end, report clearly:

```text
Completed changes
Files changed
Checks run
Check results
Known limitations
Next recommended goals
```

Do not overhype. Be honest.

If something could not be completed, explain:

```text
what failed
where it failed
what was attempted
what should be done next
```

## Completion Criteria for Goal 3

Goal 3 is complete when:

- Chat Mode cannot accidentally access repo tools,
- Agent Mode still has repo/tool functionality,
- mode-aware frontend requests exist,
- the project has been built or build failure is documented,
- the final report is clear and actionable.

---

## Strict Scope Boundaries

Do not work on these in this task:

- GGUF/llama.cpp primary runtime migration,
- Ollama fallback redesign,
- planner replacement,
- adaptive self-planning system,
- goal runner redesign,
- action DSL redesign,
- advanced diff/test panel,
- full UI visual redesign,
- broad web search,
- new audio/document parsing features,
- new dangerous tools,
- major backend rewrite,
- database migration,
- authentication system.

This task is the foundation step only:

```text
Separate Chat Mode and Agent Mode.
```

Everything else comes later.

---

## Implementation Principles

Use these principles while coding:

1. **Inspect before editing.**
   - Do not guess file locations.
   - Read the relevant files first.

2. **Separate surfaces before polishing visuals.**
   - The priority is architecture and clarity, not fancy design.

3. **Preserve working behavior.**
   - The current harness is already useful. Do not break the existing agent while extracting it.

4. **Move code before rewriting code.**
   - If existing code works, extract it into proper mode-specific files first.

5. **Avoid giant components.**
   - Break up any huge mixed app component into mode-specific components.

6. **Keep shared utilities shared.**
   - Markdown rendering, API base helpers, attachment utilities, and common layout helpers can be shared.

7. **Keep dangerous capabilities out of Chat Mode.**
   - Chat Mode must not expose local repo tools or write operations.

8. **Make the user’s choice obvious.**
   - The user should always know whether they are in Chat or Agent.

9. **Do not silently expand the task.**
   - If something extra is necessary, explain why.

10. **Build and report honestly.**
    - Do not claim success without running checks.

---

## Suggested File Direction

The exact final file structure depends on inspection, but the preferred direction is:

```text
apps/web/src/app/
  AppShell.tsx
  ModeLanding.tsx

  chat/
    ChatMode.tsx
    ChatComposer.tsx
    ChatMessageList.tsx
    ChatMessageRow.tsx
    ChatHistory.tsx
    chatTypes.ts

  agent/
    AgentMode.tsx
    AgentWorkspacePanel.tsx
    AgentTaskComposer.tsx
    AgentRunConsole.tsx
    AgentSettingsPanel.tsx
    agentTypes.ts

  shared/
    api.ts
    markdown/
    attachments/
    layout/
    modelStatus/
```

If the current codebase already has better names, use the existing pattern.

The required outcome is not the exact folder names.  
The required outcome is clean separation.

---

## Definition of Done

This task is done only when all of the following are true:

1. The app opens with a clear choice between Chat and Agent.
2. Chat Mode is a clean conversation interface.
3. Chat Mode does not show repo, workspace, tools, approvals, diffs, commands, or planner settings.
4. Agent Mode contains the repo/workspace/tool/run functionality.
5. Existing agent behavior is preserved as much as possible.
6. Chat and Agent code are separated enough for future independent development.
7. Frontend requests are mode-aware.
8. Chat requests cannot accidentally trigger repo editing or command execution.
9. Build/check commands have been run or failure is documented.
10. The final report clearly explains what changed and what remains.


---

# Combined Stage 2 Source — Stage 2 — Replace Rigid Planner with Adaptive Self-Planning

# AGENTS.md — Stage 2: Replace Rigid Planner with Adaptive Self-Planning

## Mission

Refactor the Local AI Harness planning system so the harness no longer depends on a rigid, fixed step-template planner for complex agent work.

Do **not** remove planning completely.

Replace the rigid old planner behavior with an **adaptive self-planning system**:

```text
User prompt
↓
AI creates an adaptive task plan
↓
Harness validates and normalizes the plan
↓
Harness converts the plan into executable goals
↓
Agent works one goal at a time
↓
Harness checks each goal
↓
Harness continues, retries, blocks, or reports
```

The AI should create the plan.  
The harness should control execution.

The goal is to give the local model more focus without letting it spiral out of control.

---

## Stage Dependency

This is **Stage 2**.

Start this only after **Stage 1: Separate Chat Mode and Agent Mode** is complete or merged into the working base.

Stage 2 should improve Agent Mode planning/execution behavior.  
It should not undo Chat/Agent separation.

---

## Repository and Branch Rules

Before changing code, confirm repository and branch.

Expected local repository path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

Expected project:

```text
Local-AI-Harness / Gemma 4 Harness
```

Run:

```bash
pwd
git status
git branch
git log --oneline --decorate -8
```

Stage 2 should be implemented on a new branch where stage 1 is set 


```bash
git checkout main
git pull
git checkout -b feature/adaptive-self-planning
```


```bash
git checkout feature/separate-chat-agent-modes
git checkout -b feature/adaptive-self-planning
```

Do not work directly on:

```text
main
rescue/lightweight-harness-reset
experiment/action-dsl-workflow-26b
```

unless the user explicitly instructs you to.

If there are merge conflicts or uncommitted changes, stop and report clearly.

---

## Current Codebase Context to Inspect

Before editing, inspect the current planning and execution architecture.

Likely important files and packages:

```text
packages/task-orchestrator/src/index.ts
packages/planner/src/planner.ts
packages/planner/src/types.ts
packages/core/src/engine.ts
packages/core/src/agent-run.ts
packages/core/src/intent-classifier.ts
packages/tool-runtime/
packages/workspace-policy/
packages/session-store/
apps/api/src/server.ts
apps/web/src/app/agent/
apps/web/src/components/run-console/
apps/web/src/types/run.ts
```

Do not assume these are the only files. Inspect first.

### Important Existing Concepts

The codebase already has useful concepts that should be preserved and improved:

- `TaskPlan`
- `TaskStep`
- `TaskComplexity`
- step statuses such as `pending`, `running`, `done`, `failed`, `skipped`, `blocked`
- step types such as `intake`, `inspect`, `plan`, `edit`, `verify`, `summarize`, `approval`
- local model budget profiles
- planner trace events
- run console UI
- tool runtime
- workspace policy
- checkpoints / run state where already implemented
- structured diff / verification where already implemented

Do not throw these away. Build on them.

### Current Weakness to Fix

The current planner appears to rely too much on fixed task templates based on broad complexity classes.

That can produce plans that are too generic, too rigid, or not properly adapted to the actual user task.

The Stage 2 goal is to move from:

```text
complexity class → fixed template steps
```

to:

```text
user task + repo context + constraints → AI-generated adaptive goals → harness-validated executable plan
```

---

## Core Product Rule

The local AI may decide the plan, but the harness must control the process.

Do not create a system where the model freely edits, runs tools, or continues without structure.

Correct relationship:

```text
AI = planner/reasoner
Harness = controller/executor/validator
Tools = deterministic actions
```

The model should not be the operating system.  
The harness should be the operating system.

---

## What “Adaptive Self-Planning” Means

Adaptive self-planning means the agent creates a task-specific plan based on:

- the user request,
- task complexity,
- current workspace,
- relevant repo files,
- available tools,
- risk level,
- write permissions,
- verification commands,
- current run budget,
- known project structure.

The plan should be specific enough that the harness can execute it step by step.

Bad plan:

```text
I will improve the UI.
```

Good plan:

```text
G1: Inspect repository structure using listDir and glob.
G2: Find frontend page, component, CSS, and layout files using searchText/glob.
G3: Read the top relevant UI files one by one.
G4: Create a per-file change map.
G5: Patch the landing page component.
G6: Verify the changed landing page compiles.
G7: Patch the related stylesheet.
G8: Run web build.
G9: Summarize changed files, checks, and remaining work.
```

The plan must be decomposed into executable goals, not vague intentions.

---

## Required Plan Artifacts

The adaptive planner should produce two plan artifacts:

```text
plan.md
plan.json
```

### `plan ui on the side bar wehre the old planner existed `

Human-readable plan.

Purpose:

- show the user what the agent intends to do,
- explain task breakdown clearly,
- make approvals understandable,
- make continuation easier.

### `plan.json`

Machine-readable executable plan.

Purpose:

- let the harness execute one goal at a time,
- let the harness validate allowed tools,
- let the harness track status,
- let the harness resume after interruption,
- let the harness avoid vague/unbounded work.

If only one internal artifact is practical in this pass, prioritize `plan.json` as the source of truth and generate `plan.md` from it. Do not make `plan.md` the only source of execution truth.

---

## Required `plan.json` Shape

The exact TypeScript interface may adapt to existing `TaskPlan` / `TaskStep` types, but the plan must capture at least this information:

```json
{
  "id": "plan_...",
  "task": "Update website UI",
  "summary": "Make the website UI clearer and less confusing.",
  "complexity": "multi_file",
  "mode": "agent",
  "status": "pending",
  "workspaceRoot": "/path/to/repo",
  "createdAt": 0,
  "updatedAt": 0,
  "goals": [
    {
      "id": "G1",
      "title": "Inspect repository structure",
      "type": "inspect",
      "status": "pending",
      "tools": ["listDir", "glob"],
      "files": [],
      "success_check": "Repo folders, package structure, and likely app areas identified.",
      "budget": {
        "maxToolCalls": 4,
        "maxFilesToRead": 0,
        "maxFilesToWrite": 0
      }
    },
    {
      "id": "G2",
      "title": "Find UI, CSS, layout, and component files",
      "type": "inspect",
      "status": "pending",
      "tools": ["glob", "searchText", "readFile"],
      "files": [],
      "success_check": "Relevant frontend files listed and ranked.",
      "budget": {
        "maxToolCalls": 6,
        "maxFilesToRead": 4,
        "maxFilesToWrite": 0
      }
    },
    {
      "id": "G3",
      "title": "Create per-file change map",
      "type": "plan",
      "status": "pending",
      "tools": [],
      "files": [],
      "success_check": "Each planned file change has a clear reason and expected outcome.",
      "budget": {
        "maxToolCalls": 0,
        "maxFilesToRead": 0,
        "maxFilesToWrite": 0
      }
    },
    {
      "id": "G4",
      "title": "Apply first focused UI patch",
      "type": "edit",
      "status": "pending",
      "tools": ["readFile", "createCheckpoint", "patchFile", "getStructuredDiff"],
      "files": ["apps/web/src/..."],
      "success_check": "Patch is applied, diff is focused, and no unrelated files changed.",
      "budget": {
        "maxToolCalls": 5,
        "maxFilesToRead": 2,
        "maxFilesToWrite": 1
      }
    }
  ]
}
```

The implementation may map `goals` to existing `TaskStep[]` if that is cleaner. The important thing is that the AI-generated plan becomes a validated executable queue.

---

## Plan Quality Rules

Every adaptive plan must obey these rules:

1. Each goal must have a clear `id`.
2. Each goal must have a specific `title`.
3. Each goal must have a valid `type`.
4. Each goal must have a bounded `status`.
5. Each goal must list allowed tools.
6. Each goal must include success criteria.
7. Each edit goal must identify target files or explain how files will be selected before editing.
8. Each verify goal must define what command/check/diff will prove success.
9. Goals must be small enough to execute one at a time.
10. No goal may say only “improve”, “fix”, “update”, or “refactor” without a concrete target and check.
11. Multi-file edits must be broken into file groups or per-file goals.
12. The plan must include a final summarize/report goal.
13. The plan must respect tool budgets.
14. The plan must respect workspace policy.
15. The plan must not grant itself dangerous tools unless required and policy-approved.

---

## Anti-Spiral Rules

The adaptive planner must not spiral into endless planning, endless inspection, or endless repair.

Implement guardrails.

### Required Guardrails

Use hard caps such as:

```text
maxPlannerRetries: 2
maxGoalsPerPlan: 12
maxSubgoalsPerGoal: 6
maxConsecutiveInspectGoals: 4
maxRepairAttemptsPerGoal: 2
maxToolCallsPerGoal: goal budget
maxModelCallsPerGoal: goal budget
```

The exact values may use existing local model budget profiles, but the concept must exist.

### Stop Conditions

The agent must stop and report when:

- the plan is invalid after allowed repair attempts,
- a goal fails more than the allowed repair attempts,
- required files cannot be found,
- a required approval is denied,
- the run budget is exceeded,
- verification fails and the agent cannot identify a safe repair,
- the user request is too broad to execute safely,
- the plan tries to use disallowed tools.

### No Infinite Loops

The agent must not repeatedly:

- inspect the same files without new reason,
- regenerate the same plan without improvement,
- patch the same file blindly,
- rerun the same failing command without a changed repair,
- keep expanding scope after each goal.

---

## Harness Validation Layer

Before executing any AI-generated plan, the harness must validate it.

Validation should check:

- JSON parses correctly,
- required fields exist,
- goal IDs are unique,
- statuses are valid,
- goal types are valid,
- tools are known and allowed,
- write tools appear only in edit/approval-safe goals,
- command tools appear only where policy allows,
- file paths are inside the workspace,
- dangerous paths are rejected,
- budgets are present or defaulted,
- success checks are non-empty,
- plan size is within limits,
- final summary/report goal exists.

If validation fails, the harness may ask the model to repair the plan once or twice. If still invalid, stop and report.

---

## Execution Model

The harness should execute exactly one goal at a time.

Required loop:

```text
Load validated plan
↓
Select first pending goal
↓
Mark goal running
↓
Execute only allowed tools for that goal
↓
Check goal success criteria
↓
Mark done / failed / blocked
↓
Persist state
↓
Move to next pending goal
```

The model may help decide specific patches inside a goal, but the harness controls:

- which goal is active,
- which tools are allowed,
- which files are in scope,
- whether approval is needed,
- when a goal is complete,
- when to stop.

---

## Persistence and Resume

The plan state must be saved so a run can continue later.

Use the existing session/checkpoint/state system where possible.

Persist at least:

```text
activePlanId
plan path or serialized plan
currentGoalId
completedGoals
failedGoals
blockedGoals
filesRead
filesWritten
commandsRun
approvals
lastToolResults
lastVerificationResults
summarySoFar
createdAt
updatedAt
```

When the user says:

```text
continue
resume
keep going
act on the plan
run the plan
implement the plan
```

Agent Mode should use the saved plan state instead of treating the plan as normal chat text.

---

## Stage 2 Required Goals

Complete this implementation in three goals.

---

# Goal 1 — Inspect Current Planner and Add Adaptive Plan Contracts

## Purpose

Understand the current rigid planner and introduce the new adaptive plan contract without breaking existing behavior.

## Required Inspection

Inspect:

```text
packages/task-orchestrator/src/index.ts
packages/planner/src/planner.ts
packages/planner/src/types.ts
packages/core/src/engine.ts
packages/core/src/agent-run.ts
packages/core/src/intent-classifier.ts
apps/web/src/types/run.ts
apps/web/src/components/run-console/
```

Identify:

- where `TaskPlan` is created,
- where fixed templates are selected,
- how complexity is classified,
- how run steps are executed,
- where plan progress is emitted,
- where run state/checkpoints are stored,
- how the Run Console renders task plans,
- how direct chat differs from agentic execution after Stage 1.

## Required Changes

Add or update types for adaptive planning.

Possible names:

```text
AdaptivePlan
AdaptiveGoal
AdaptiveGoalStatus
AdaptiveGoalType
AdaptivePlanValidationResult
AdaptivePlanBudget
```

You may also extend the existing `TaskPlan` / `TaskStep` types if that is cleaner.

The new contract must support:

- human-readable title,
- task summary,
- plan status,
- goal list,
- goal type,
- goal status,
- allowed tools per goal,
- success checks,
- budgets,
- file scope,
- risk/approval metadata if already supported,
- timestamps,
- validation errors,
- final report goal.

## Compatibility Requirement

Do not delete the existing `TaskPlan` system immediately if other parts of the app depend on it.

Preferred approach:

```text
AdaptivePlan/AdaptiveGoal
↓ normalized into or compatible with
TaskPlan/TaskStep
↓ rendered by existing Run Console
```

This keeps the UI and execution path stable while improving planning.

## Completion Criteria for Goal 1

Goal 1 is complete when:

- current planner/orchestrator behavior is understood,
- adaptive plan/goal types exist,
- validation requirements are represented in code,
- old plan rendering is not broken,
- existing tests/build do not regress at this stage.

---

# Goal 2 — Replace Fixed Template Planning with AI-Generated Adaptive Planning plus Harness Validation

## Purpose

Move from rigid fixed templates to AI-generated adaptive goals, while keeping the harness in control.

## Required Behavior

When Agent Mode receives a non-trivial task:

1. Classify the task.
2. Gather a compact initial context only if needed.
3. Ask the model to produce an adaptive plan as strict JSON.
4. Validate the returned plan.
5. Repair the plan if validation fails, within retry limits.
6. Normalize the valid plan into executable goals/steps.
7. Generate or persist a human-readable `plan.md`.
8. Persist a machine-readable `plan.json`.
9. Show the plan in Agent Mode / Run Console.
10. Execute only after the plan is valid and policy allows execution.

## Model Planning Prompt Requirements

The planning prompt must tell the model:

- create executable goals,
- avoid vague goals,
- use only available tools,
- respect budgets,
- avoid reading the whole repo,
- break multi-file work into small steps,
- include verification,
- include final summary,
- output strict JSON only for the machine plan.

The model must not be asked to free-form plan in a way that the harness cannot parse.

## Validation Requirements

Implement a validator that rejects:

- invalid JSON,
- missing goals,
- duplicate IDs,
- vague titles,
- empty success checks,
- unknown tools,
- disallowed tools,
- edit tools in inspect-only goals,
- command tools in unsafe goals,
- paths outside workspace,
- too many goals,
- too many write goals,
- no verification goal for edit tasks,
- no final summary goal.

## Fallback Behavior

If adaptive planning fails after retries:

- do not silently fall back to uncontrolled agent behavior,
- either use a small safe fallback plan or stop and report,
- the fallback plan must also be validated,
- report why adaptive planning failed.

A safe fallback can be simple:

```text
G1: Inspect relevant files
G2: Create bounded implementation plan
G3: Stop and ask user to approve next step
```

## Efficiency Requirements

The adaptive planner should be efficient for local models.

Do not make every task use a deep planning loop.

Suggested behavior:

```text
direct answer → no adaptive plan
single-file simple edit → compact adaptive plan
multi-file or architecture task → full adaptive plan
repo-wide audit → inspect/report plan, no edits unless explicitly requested
unsafe/broad task → scope report, no execution
```

Use existing budget profiles where possible.

## Completion Criteria for Goal 2

Goal 2 is complete when:

- rigid fixed template planning is no longer the main path for non-trivial Agent Mode tasks,
- AI-generated adaptive plans are created as strict structured data,
- plans are validated before execution,
- invalid plans are repaired or blocked safely,
- `plan.md` and `plan.json` are created or persisted where appropriate,
- existing Run Console can display the adaptive plan,
- direct chat is not affected.

---

# Goal 3 — Execute Adaptive Goals One by One, Persist State, Verify, and Report

## Purpose

Ensure adaptive plans are actually executable and resumable.

The current failure mode to fix is:

```text
Agent creates plan.md
User says act on the plan
Agent cannot reliably execute it
```

After this stage, the harness must treat the plan as an executable queue, not just text.

## Required Execution Loop

Implement or update the Agent Mode execution loop:

```text
read active plan
select first pending goal
mark goal running
execute allowed tool actions
check success criteria
mark goal done/failed/blocked
persist state
continue or stop based on policy
```

## Goal Execution Rules

For every goal:

- use only tools allowed by the goal,
- stay within budget,
- read only relevant files,
- edit only files in scope,
- create checkpoint before write actions if checkpoint support exists,
- request approval where current policy requires it,
- collect diff/check output where already supported,
- update progress events,
- persist state after completion/failure.

## Verification Rules

Every edit plan must include verification.

Verification may include:

- structured diff,
- selected tests,
- build command,
- lint command,
- typecheck command,
- targeted command chosen by existing project command detection.

The agent must not claim success without verification or a clear explanation of why verification was not possible.

## Resume Rules

When the user says:

```text
continue
resume
run the plan
act on the plan
implement plan.md
continue implementation
```

Agent Mode should:

1. find the active saved plan,
2. load the plan state,
3. identify the next pending/failed recoverable goal,
4. continue from there,
5. not recreate a new unrelated plan unless the old one is invalid or obsolete.

## Plan File Rules

If writing plan files to disk:

```text
.gamma-harness/plans/<run-id>/plan.json
.gamma-harness/plans/<run-id>/plan.md
```

or use the existing session data directory if more appropriate.

Do not scatter plan files randomly in the project root unless the user explicitly asks for root `plan.md`.

If the user asks for a visible repo-level implementation plan, then root `plan.md` is acceptable, but the machine plan should still live in harness state.

## UI / API Requirements

Agent Mode should expose enough information for the user to understand:

- current plan title,
- current goal,
- completed goals,
- blocked/failed goals,
- next action,
- files touched,
- checks run.

Do not build a polished new diff panel in this stage. Use existing Run Console/diff/check UI if available.

## Final Validation Commands

Run relevant checks:

```bash
npm run build
```

If full build is too much, run targeted builds:

```bash
npm run build --workspace @local-harness/task-orchestrator
npm run build --workspace @local-harness/planner
npm run build --workspace @local-harness/core
npm run build --workspace @local-harness/api
npm run build --workspace web
```

If tests are available and reasonable:

```bash
npm test
```

If full tests are too heavy, add/run targeted tests for:

- adaptive plan validation,
- invalid plan rejection,
- vague goal rejection,
- allowed/disallowed tools,
- plan normalization,
- one-goal-at-a-time execution,
- resume behavior.

## Final Report Requirements

At the end, report:

```text
Completed changes
Files changed
Planner behavior before
Planner behavior after
Plan artifacts produced
Checks run
Check results
Known limitations
Next recommended goals
```

Do not overhype. Be honest.

## Completion Criteria for Goal 3

Goal 3 is complete when:

- adaptive plans execute one goal at a time,
- plan state persists,
- `continue` / `act on the plan` can resume the active plan,
- verification is attached to edit plans,
- invalid/vague plans are blocked or repaired safely,
- direct Chat Mode is unaffected,
- build/test status is reported accurately.

---

## Strict Scope Boundaries

Do not work on these in this stage:

- Chat/Agent separation unless Stage 1 left a small integration issue,
- GGUF/llama.cpp primary runtime migration,
- Ollama fallback redesign,
- full UI visual redesign,
- advanced diff/test panel redesign,
- broad web search,
- new dangerous tools,
- authentication,
- database migrations,
- unrelated refactors,
- complete agent rewrite.

This stage is specifically:

```text
Replace rigid planning with adaptive self-planning controlled by the harness.
```

---

## Implementation Principles

1. **Do not remove planning.**
   - Replace rigid fixed planning with adaptive structured planning.

2. **AI plans, harness controls.**
   - The model creates the plan; the harness validates and executes it.

3. **Structured plans only.**
   - The machine plan must be parseable and validated.

4. **Small goals beat big goals.**
   - Break work into focused executable goals.

5. **No vague steps.**
   - Reject vague goals like “improve UI” without target files and success checks.

6. **One goal at a time.**
   - Never let the agent loosely execute the whole plan in one uncontrolled jump.

7. **Persist after each goal.**
   - A run should be resumable after interruption.

8. **Use budgets.**
   - Local models need bounded context, bounded tools, and bounded retries.

9. **Verify edit work.**
   - Every edit plan must include verification or explain why verification is unavailable.

10. **Do not break Chat Mode.**
    - Stage 2 belongs to Agent Mode.

11. **Preserve existing useful systems.**
    - Keep trace events, run console, tool runtime, workspace policy, checkpoints, and existing build scripts working.

12. **Stop safely.**
    - If the plan is invalid, too broad, unsafe, or repeatedly failing, stop and report instead of guessing.

---

## Suggested File Direction

The exact files depend on inspection, but the likely direction is:

```text
packages/task-orchestrator/src/
  adaptive-plan.ts
  adaptive-plan-validator.ts
  adaptive-plan-normalizer.ts
  adaptive-plan-prompts.ts
  adaptive-plan-runner.ts
  index.ts

packages/planner/src/
  planner.ts
  types.ts

packages/core/src/
  engine.ts
  agent-run.ts

apps/api/src/
  server.ts

apps/web/src/app/agent/
  AgentMode.tsx
  AgentRunConsole.tsx

apps/web/src/types/
  run.ts
```

Do not force these exact names if the current architecture suggests a cleaner path.

The required outcome is adaptive, validated, executable planning.

---

## Definition of Done

This task is complete only when all of the following are true:

1. The rigid fixed template planner is no longer the main planning path for non-trivial Agent Mode tasks.
2. The AI can generate a task-specific adaptive plan.
3. The harness validates the adaptive plan before execution.
4. The harness converts the plan into executable goals/steps.
5. The agent executes one goal at a time.
6. Vague or invalid goals are rejected or repaired safely.
7. `plan.json` exists as the machine-readable source of truth or equivalent persisted structured plan state exists.
8. `plan.md` exists as the human-readable plan or can be generated from the structured plan.
9. The run can resume when the user says `continue`, `resume`, `act on the plan`, or `implement the plan`.
10. Edit plans include verification.
11. Agent Mode shows current plan/goal/progress using existing UI where possible.
12. Chat Mode remains unaffected.
13. Build/test checks have been run or failures are documented.
14. The final report explains what changed, what passed, what failed, and what should come next.


---

# Combined Stage 3 Source — Stage 3 — Make llama.cpp/GGUF the Primary Runtime

# AGENTS.md — Stage 3: Make llama.cpp/GGUF the Primary Runtime

## Mission

Refactor the Local AI Harness runtime setup so **llama.cpp using the local GGUF model is the primary runtime** and **Ollama is only a fallback**.

The user has already copied the GGUF model out of the Ollama model storage and placed it inside the Gemma 4 Harness project under a local folder named:

```text
models/
```

The model file is large, about 9.6 GB, and must **never** be committed to git.

This stage is about runtime priority, runtime detection, fallback behavior, configuration clarity, and UI visibility.

Do **not** work on Chat/Agent separation in this stage unless a tiny integration fix is required.  
Do **not** redesign the planner in this stage.  
Do **not** add the adaptive self-planning system in this stage.  
Do **not** redesign the full UI in this stage.  
Do **not** build the advanced diff/test panel in this stage.  
Do **not** remove Ollama completely.

The goal is simple and serious:

```text
Primary runtime: llama.cpp server using local GGUF
Fallback runtime: Ollama
```

---

## Stage Dependency

This is **Stage 3**.

It should be applied on a new branch, like the other stages.

Stages 1–5 should each be handled on their own feature branch or on the correct stacked feature branch chosen by the user. Do not assume all stages are already merged into `main`.

Before starting, confirm which branch the user wants this stage based on:

- current local branch,
- whether Stage 1 and Stage 2 have already been merged,
- whether this stage should branch from `main` or from the latest stage branch.

If there is uncertainty, inspect the branch state and report before editing.

---

## Repository and Branch Rules

Expected local repository path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

Expected project:

```text
Local-AI-Harness / Gemma 4 Harness
```

Run first:

```bash
pwd
git status
git branch
git log --oneline --decorate -8
```

Do not work directly on:

```text
main
rescue/lightweight-harness-reset
experiment/action-dsl-workflow-26b
```

unless the user explicitly tells you to.

Create a new branch for this stage.

Recommended branch name:

```bash
git checkout -b feature/llamacpp-gguf-primary
```

If this stage should be stacked on a previous stage branch, first check out that branch, then create the new branch:

```bash
git checkout <previous-stage-branch>
git checkout -b feature/llamacpp-gguf-primary
```

If there are uncommitted changes, stop and report them before continuing.

---

## Current Runtime Problem

The harness currently behaves as if Ollama is the default runtime.

That is not the desired final behavior.

The desired behavior is:

```text
1. Try llama.cpp/GGUF first.
2. If llama.cpp is available, use it.
3. If llama.cpp is unavailable, warn the user.
4. Offer Ollama fallback.
5. Clearly show the active runtime in the UI.
```

The user wants control. That is why GGUF/llama.cpp must be prioritized.

Do not hide runtime selection. Runtime confusion is a major trust problem.

---

## Required Runtime Priority

The runtime priority must be:

```text
Primary: llama.cpp server using local GGUF
Fallback: Ollama
```

Correct runtime behavior:

```text
Try llama.cpp/GGUF
↓
If connected, use llama.cpp
↓
If unavailable, show warning
↓
If fallback is enabled, use Ollama
↓
If fallback is disabled or unavailable, show actionable error
```

Incorrect behavior:

```text
Use Ollama first
Maybe use GGUF later
Hide which runtime is active
Silently fallback without warning
Commit the GGUF model to git
```

---

## Local Model Folder Rule

The local model folder must be excluded from git.

The folder is:

```text
models/
```

Because the model is about 9.6 GB, `.gitignore` must protect it.

Before editing, inspect:

```bash
cat .gitignore
ls -lah models || true
find models -maxdepth 2 -type f | sort || true
```

If `.gitignore` does not already protect the model folder, add rules such as:

```gitignore
# Local GGUF models
models/
*.gguf
*.gguf.*
```

If the project needs to keep the folder structure without committing the model, use:

```gitignore
# Local GGUF models
models/*
!models/.gitkeep
*.gguf
*.gguf.*
```

Only use the `.gitkeep` option if the repo actually needs an empty `models/` folder tracked.

Never commit:

```text
models/*.gguf
models/**/*.gguf
```

Before finalizing, verify:

```bash
git status --ignored --short models
git check-ignore -v models/* || true
```

The GGUF file must show as ignored.

---

## Required Configuration Outcome

The harness should support explicit runtime configuration.

Required concepts:

```text
HARNESS_RUNTIME_PROVIDER=llamacpp
HARNESS_PRIMARY_RUNTIME=llamacpp
HARNESS_FALLBACK_RUNTIME=ollama
LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
LLAMACPP_MODEL_PATH=models/<local-model-file>.gguf
LLAMACPP_MODEL_ALIAS=gemma-4-gguf
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=gemma4:e4b
```

Use names that fit the existing codebase, but the behavior must be clear.

The default should become:

```text
llama.cpp / GGUF first
Ollama fallback second
```

Do not rely only on `OPENAI_BASE_URL` for user-facing runtime identity. The app must know whether it is using llama.cpp or Ollama.

---

## Required llama.cpp Server Behavior

The harness should expect llama.cpp to run as an OpenAI-compatible server.

Typical llama.cpp server shape:

```text
http://127.0.0.1:8080/v1
```

The exact start command depends on how llama.cpp is installed locally. Support or document a command shaped like:

```bash
llama-server \
  -m models/<local-model-file>.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192
```

If the local binary is named differently, such as `llama.cpp/build/bin/llama-server`, support configuration rather than hardcoding one path.

The harness does not need to bundle llama.cpp. It should integrate with an existing local llama.cpp server or provide a helper script if reasonable.

---

## Required Fallback Behavior

Ollama must remain available as fallback.

Fallback behavior must be visible.

If llama.cpp is unavailable and Ollama is used, the UI and API status should show:

```text
Runtime: Ollama fallback
Model: gemma4:e4b
Status: connected
Warning: not using GGUF primary runtime
```

Do not silently fallback.

If both runtimes fail, show an actionable error:

```text
Runtime unavailable.
Tried llama.cpp at http://127.0.0.1:8080/v1.
Tried Ollama at http://127.0.0.1:11434/v1.
Start llama.cpp with the configured GGUF model or enable Ollama fallback.
```

---

## Required UI Visibility

The user should always see which runtime is active.

When llama.cpp is active, display something like:

```text
Runtime: llama.cpp
Model: gemma-4.gguf
Status: connected
```

When fallback is active, display something like:

```text
Runtime: Ollama fallback
Model: gemma4:e4b
Status: connected
Warning: not using GGUF primary runtime
```

When llama.cpp is missing, display something like:

```text
Primary runtime unavailable
llama.cpp server not connected
Expected: http://127.0.0.1:8080/v1
Fallback: available / unavailable
```

This status should appear in Agent Mode and any runtime/settings area. If Chat Mode has a minimal model display, it may show active runtime, but it must not expose agent settings.

---

## Required Backend/Adapter Behavior

Inspect and update the runtime/model adapter layer.

Likely files:

```text
packages/model-adapter/src/config.ts
packages/model-adapter/src/client.ts
packages/model-adapter/src/types.ts
packages/core/src/engine.ts
apps/api/src/server.ts
apps/web/src/app/
apps/web/src/app/agent/
apps/web/src/components/
```

The adapter should support runtime identity, not just a generic base URL.

Required runtime identities:

```text
llamacpp
ollama
unknown/offline
```

Preferred internal status shape:

```ts
type RuntimeProvider = 'llamacpp' | 'ollama';

interface RuntimeEndpointStatus {
  provider: RuntimeProvider;
  baseUrl: string;
  model: string;
  modelPath?: string;
  status: 'connected' | 'unavailable' | 'offline';
  isPrimary: boolean;
  isFallback: boolean;
  warning?: string;
  error?: string;
}
```

Use existing types if they already exist. The exact type names can change, but the app must distinguish llama.cpp from Ollama.

---

## Required Health Checks

Implement or update runtime health checks.

For llama.cpp:

- check the OpenAI-compatible endpoint,
- prefer `/v1/models` if available,
- optionally check `/health` or root endpoint if the local server exposes it,
- avoid crashing if the server is offline.

For Ollama fallback:

- check existing Ollama lifecycle endpoints if already supported,
- or check OpenAI-compatible `/v1/models`,
- preserve current behavior where possible.

Runtime detection should not hang for a long time. Use bounded timeouts.

Suggested timeout:

```text
3–10 seconds for runtime health check
```

---

## Required One-Goal Implementation Plan

Complete this stage as one focused implementation goal.

---

# Goal 1 — Make llama.cpp/GGUF Primary with Visible Ollama Fallback

## Purpose

Change the runtime architecture so the harness prioritizes a local GGUF model served by llama.cpp, while preserving Ollama as a visible fallback.

## Required Inspection

Before editing, inspect:

```bash
pwd
git status
git branch
cat package.json
cat .gitignore
ls -lah models || true
find models -maxdepth 2 -type f | sort || true
```

Inspect runtime code:

```text
packages/model-adapter/src/config.ts
packages/model-adapter/src/client.ts
packages/model-adapter/src/types.ts
packages/core/src/engine.ts
apps/api/src/server.ts
apps/web/src/app/
apps/web/src/components/
```

Identify:

- current default base URL,
- current default model,
- current provider/runtime profile logic,
- current model runtime status endpoint,
- current UI model/runtime display,
- current Ollama-specific behavior,
- whether OpenAI-compatible runtime calls are already supported,
- where fallback should be implemented.

## Required Changes

Implement all of the following:

### 1. Protect the Local Model Folder

Ensure `.gitignore` ignores:

```text
models/
*.gguf
*.gguf.*
```

or equivalent rules.

Verify the local model is ignored.

### 2. Add Explicit Runtime Provider Configuration

Add config support for:

```text
llamacpp primary
ollama fallback
```

Use existing config patterns where possible.

The default should prefer:

```text
LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
```

over:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
```

Do not make Ollama the default primary runtime.

### 3. Add llama.cpp Runtime Detection

The harness should try llama.cpp first.

Detection should be bounded and safe.

If llama.cpp is connected, use it as the active model runtime.

If llama.cpp is unavailable, mark it as unavailable and check Ollama fallback.

### 4. Preserve Ollama Fallback

Do not remove Ollama.

If llama.cpp fails and Ollama is available, use Ollama only as fallback.

Show a warning that fallback is active.

### 5. Make Runtime Status Visible

Update API/UI status so the user can see:

```text
active runtime
primary runtime status
fallback runtime status
active model
model path or alias where appropriate
warning if fallback is active
```

At minimum, show:

```text
Runtime: llama.cpp / Ollama fallback
Model: <model>
Status: connected / unavailable
Warning: <if fallback is active>
```

### 6. Add Helpful Setup Instructions

Add or update documentation/config examples showing how to start llama.cpp with the local GGUF model.

A good place may be:

```text
README.md
.env.example
docs/runtime.md
```

Use whichever documentation pattern exists.

Include a command shaped like:

```bash
llama-server -m models/<local-model-file>.gguf --host 127.0.0.1 --port 8080 --ctx-size 8192
```

Do not hardcode the user’s exact model filename unless the code detects it or the user confirms it.

### 7. Validate Runtime Selection

Run checks to confirm:

- the app builds,
- `.gitignore` protects the model file,
- llama.cpp is attempted first,
- Ollama fallback still works,
- UI/status clearly shows the active runtime.

## Expected User Experience

### llama.cpp Available

The app should show:

```text
Runtime: llama.cpp
Model: gemma-4.gguf or configured alias
Status: connected
```

The harness should send model requests to:

```text
http://127.0.0.1:8080/v1
```

### llama.cpp Unavailable, Ollama Available

The app should show:

```text
Runtime: Ollama fallback
Model: gemma4:e4b
Status: connected
Warning: not using GGUF primary runtime
```

The harness should send model requests to:

```text
http://127.0.0.1:11434/v1
```

### Both Unavailable

The app should show an actionable error:

```text
No runtime connected.
Tried llama.cpp primary at http://127.0.0.1:8080/v1.
Tried Ollama fallback at http://127.0.0.1:11434/v1.
Start llama.cpp with the configured GGUF model or start Ollama fallback.
```

## Validation Commands

Run the relevant checks.

Start with:

```bash
npm run build
```

If the full build is too heavy, run targeted builds:

```bash
npm run build --workspace @local-harness/model-adapter
npm run build --workspace @local-harness/core
npm run build --workspace @local-harness/api
npm run build --workspace web
```

Check ignore behavior:

```bash
git status --ignored --short models
git check-ignore -v models/* || true
```

If llama.cpp is running locally, check:

```bash
curl http://127.0.0.1:8080/v1/models
```

If Ollama fallback is running locally, check:

```bash
curl http://127.0.0.1:11434/v1/models
```

Do not claim runtime tests passed unless they actually passed.

## Final Report Requirements

At the end, report:

```text
Completed changes
Files changed
Runtime priority before
Runtime priority after
Active config variables
Model folder gitignore status
Checks run
Check results
Known limitations
Next recommended goals
```

Be honest.

If llama.cpp could not be tested because the server was not running, say that clearly.

If Ollama fallback could not be tested, say that clearly.

## Completion Criteria

This stage is complete only when:

1. `models/` and GGUF files are ignored by git.
2. llama.cpp/GGUF is the primary configured runtime.
3. Ollama remains available only as fallback.
4. The app tries llama.cpp before Ollama.
5. Fallback is visible, not silent.
6. Runtime status clearly shows llama.cpp vs Ollama fallback.
7. The app has setup instructions for starting llama.cpp with the GGUF model.
8. The app builds or build failure is documented.
9. Runtime tests are run if servers are available.
10. The final report clearly explains what changed and what remains.

---

## Strict Scope Boundaries

Do not work on these in this stage:

- Chat/Agent separation except tiny integration fixes,
- adaptive self-planning,
- goal runner redesign,
- action DSL redesign,
- advanced diff/test panel,
- full UI redesign,
- broad web search,
- new repo tools,
- new dangerous tools,
- authentication,
- database work,
- unrelated refactors.

This stage is only:

```text
Make llama.cpp/GGUF primary and Ollama fallback.
```

---

## Implementation Principles

1. **GGUF first.**
   - The primary path must be llama.cpp using the local GGUF model.

2. **Ollama fallback only.**
   - Keep Ollama for debugging and recovery, not as the default primary runtime.

3. **Never commit the model.**
   - Protect `models/` and `*.gguf`.

4. **Show runtime identity clearly.**
   - The user must always know whether the app is using llama.cpp or Ollama.

5. **Do not silently fallback.**
   - Fallback must show a warning.

6. **Keep OpenAI-compatible calls where possible.**
   - llama.cpp and Ollama can both be treated through OpenAI-compatible endpoints where supported.

7. **Use bounded health checks.**
   - Offline runtimes should not freeze the app.

8. **Preserve current working behavior.**
   - Do not break current Ollama support while adding llama.cpp priority.

9. **Document setup clearly.**
   - The user should know how to start llama.cpp with the local model.

10. **Build and report honestly.**
    - Do not claim success without running checks.

---

## Suggested File Direction

The exact structure depends on inspection, but likely files include:

```text
.gitignore
.env.example
README.md
docs/runtime.md

packages/model-adapter/src/
  config.ts
  client.ts
  types.ts
  runtime-status.ts

packages/core/src/
  engine.ts

apps/api/src/
  server.ts

apps/web/src/app/agent/
  runtime status display components

apps/web/src/components/
  model/runtime status components
```

Do not force these exact filenames if the repo already has a better pattern.

The required outcome is runtime priority and visibility.

---

## Definition of Done

This task is done only when all of the following are true:

1. The local `models/` folder is gitignored.
2. GGUF files are gitignored.
3. llama.cpp is configured as the primary runtime.
4. Ollama is configured as fallback only.
5. The harness checks llama.cpp first.
6. The harness falls back to Ollama only with a visible warning.
7. The active runtime is visible in the UI or runtime/status panel.
8. The active model is visible.
9. llama.cpp setup instructions exist.
10. The app builds or the build failure is documented.
11. Runtime health checks are safe and bounded.
12. The final report clearly states whether llama.cpp and Ollama were actually tested.


---

# Combined Stage 4 Source — Stage 4 — Redesign UI Around Clarity

# AGENTS.md — Stage 4: Redesign UI Around Clarity

## Mission

Redesign the Local AI Harness web UI around clarity, separation, and trust.

The current UI is too crowded. It places too many controls, settings, runtime details, workspace details, agent traces, and chat elements into one dense surface. This makes the harness feel confusing even when the underlying agent works.

This stage is a focused UI/UX redesign stage.

Keep the existing dark theme direction.  
Do not make the app light theme.  
Do not remove useful agent functionality.  
Do not hide important runtime/tool status.  
Do not redesign the planner/runtime architecture in this stage.  
Do not build new agent capabilities in this stage.

The goal is to make the app obvious:

```text
Home = choose Chat or Agent
Chat = clean conversation
Agent = repo work with clear progress and status
Settings = centered modal, not side clutter
Runtime = always visible but not overwhelming
```

UI/UX is not cosmetic here. It directly affects whether the harness feels usable and trustworthy.

---

## Stage Dependency

This is **Stage 4**.

It should be applied on a new branch like the other stages.

Expected previous stages:

1. Stage 1 — Chat Mode / Agent Mode separation
2. Stage 2 — Adaptive self-planning
3. Stage 3 — llama.cpp/GGUF primary runtime

If some previous stages are not merged yet, confirm the correct base branch before starting.

Do not assume everything is already on `main`.

---

## Repository and Branch Rules

Expected local repository path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

Expected project:

```text
Local-AI-Harness / Gemma 4 Harness
```

Run first:

```bash
pwd
git status
git branch
git log --oneline --decorate -8
```

Do not work directly on:

```text
main
rescue/lightweight-harness-reset
experiment/action-dsl-workflow-26b
```

unless the user explicitly tells you to.

Create a new branch for this stage.

Recommended branch name:

```bash
git checkout -b feature/ui-clarity-redesign
```

If this stage should be stacked on a previous stage branch, first check out that branch, then create the new branch:

```bash
git checkout <previous-stage-branch>
git checkout -b feature/ui-clarity-redesign
```

If there are uncommitted changes, stop and report them before continuing.

---

## Current UI Problem

The app currently feels confusing because too many concerns appear together.

Problems to fix:

- Chat and Agent visual surfaces are not clear enough.
- Settings appear as side clutter instead of an intentional modal/popup.
- Runtime/model/workspace/tool details compete with the main task.
- Chat mode should feel like a clean conversation app, but it currently inherits agent/dashboard complexity.
- Agent mode should show status and progress clearly, but without forcing the user to decode internal implementation details.
- The dark theme exists, but spacing, grouping, hierarchy, and layout need serious cleanup.
- LaTeX/math rendering in Chat Mode is too small and should be made more readable.
- Markdown notes and formulas should look polished, readable, and properly spaced.
- Some information should be always visible; other information should move into settings/details panels.
- Settings should open in the center as a modal/popover and be closable.
- The UI should not make the user wonder: “Am I in Chat? Agent? Runtime setup? Settings? Tool mode?”

---

## Core Design Rule

Design the UI around user intent:

```text
I want to chat.
I want the agent to work on a repo.
I want to see what runtime/model is active.
I want to change settings.
I want to know what the agent is doing.
```

Every visible panel should answer one of those needs.

If a UI element does not help the current mode, remove it from that mode or move it behind settings/details.

---

## Keep the Dark Theme

Preserve the dark visual identity.

Do not switch to light mode.

Improve the existing dark theme by making it cleaner:

- stronger spacing scale,
- clearer panels,
- fewer competing borders,
- clearer typography,
- better message width,
- stronger section hierarchy,
- readable code blocks,
- readable math blocks,
- cleaner buttons,
- less visual noise,
- better empty states,
- better responsive behavior.

Current dark theme tokens may already exist in `apps/web/src/index.css`. Reuse and refine them instead of starting from scratch.

---

## Target Product Shape

The final UI should have three major user-facing surfaces:

```text
Mode Landing
Chat Mode
Agent Mode
```

Settings should be a modal overlay accessible from relevant places.

Runtime status should be visible but compact.

---

# Surface 1 — Mode Landing

## Purpose

The landing page should make the app immediately understandable.

It should not show internal settings, workspace selectors, tool logs, approvals, or diffs.

## Required Layout

Landing screen:

```text
Gemma 4 Harness

What do you want to do?

[ Chat ]
Ask questions, upload files, and get normal answers.

[ Agent ]
Work on a local repo, inspect files, make plans, and apply code changes.
```

Optional compact status row:

```text
Runtime: llama.cpp / Ollama fallback / offline
Model: <active model>
```

Do not show detailed runtime config on landing. Use a compact badge only.

## Required Behavior

- Clicking Chat opens Chat Mode.
- Clicking Agent opens Agent Mode.
- The selected mode should be obvious.
- The user should have a way to return to this landing screen or switch mode.
- The landing screen should look polished, centered, and calm.

## Visual Requirements

- Dark background.
- Two large cards/buttons.
- Clear icon or simple label for Chat and Agent.
- Short explanation under each.
- Strong hover/focus state.
- No clutter.
- No technical jargon overload.

---

# Surface 2 — Chat Mode UI

## Purpose

Chat Mode should feel like a clean local ChatGPT-style conversation interface.

It should not look like a coding-agent dashboard.

## Required Chat Layout

Use this structure:

```text
┌──────────────────────────────────────────────┐
│ Top bar: Chat | Model name | Runtime status  │
├───────────────┬──────────────────────────────┤
│ Left sidebar  │ Main chat                    │
│               │                              │
│ New Chat      │ Messages                     │
│ History       │                              │
│ Thread titles │ Composer                     │
│               │ + file button | input | send │
└───────────────┴──────────────────────────────┘
```

## Chat Left Sidebar

The Chat sidebar should contain only chat-related items:

- New chat button
- Previous chats with useful titles
- Search history placeholder only if already simple
- Maybe small model/runtime badge
- No repo path
- No workspace selector
- No command controls
- No approvals
- No tool list
- No planner settings

Thread titles should be meaningful, not generic thread numbers when possible.

Examples:

```text
UI redesign ideas
Fix Docker runtime issue
Explain agent planning
```

## Chat Main Area

The main chat area should contain:

- welcome/empty state,
- message list,
- assistant/user messages,
- markdown rendering,
- readable code blocks,
- readable math blocks,
- composer/input at bottom.

The message column should have a readable max width. Do not make text stretch across the whole screen on wide monitors.

Suggested behavior:

```text
max-width: 760px to 900px for message content
centered message stream
comfortable vertical spacing
```

## Chat Composer

The composer should include:

- text input,
- send button,
- plus/file button,
- attachment preview if currently supported,
- clear disabled/loading state.

The composer should be visually stable and easy to find.

It should not contain agent execution controls.

## Chat Top Bar

The Chat top bar should show:

```text
Current mode: Chat
Model: <active model>
Runtime: llama.cpp / Ollama fallback / offline
Settings button
Back/switch mode button
```

Keep it compact.

If runtime fallback is active, show a small warning badge, not a giant alert.

## Chat Markdown and LaTeX Requirements

Fix the Chat Mode markdown/math readability.

The user specifically reported LaTeX formulas are too small.

Update styles so:

- inline math is readable inside text,
- block math is larger and centered or properly indented,
- math blocks have enough vertical spacing,
- formulas do not look tiny compared to normal text,
- notes written in markdown look polished,
- headings inside assistant responses have clear hierarchy,
- lists have proper spacing,
- code blocks are readable,
- tables are scrollable on small screens.

Suggested CSS direction:

```css
.chat-mode .markdown-body {
  font-size: 15.5px;
  line-height: 1.75;
}

.chat-mode .markdown-body .katex {
  font-size: 1.08em;
}

.chat-mode .markdown-body .katex-display {
  font-size: 1.18em;
  margin: 1.1rem 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.chat-mode .markdown-body h1,
.chat-mode .markdown-body h2,
.chat-mode .markdown-body h3 {
  line-height: 1.25;
  margin-top: 1.25rem;
  margin-bottom: 0.65rem;
}

.chat-mode .markdown-body p,
.chat-mode .markdown-body ul,
.chat-mode .markdown-body ol {
  margin-bottom: 0.85rem;
}
```

Adapt the exact class names to the current codebase.

Do not break existing `react-markdown`, `remark-math`, `rehype-katex`, or KaTeX rendering.

## Chat Empty State

The empty state should be calm and useful.

Example:

```text
Start a chat

Ask a question, paste notes, or attach a file for context.
```

Do not show agent instructions in Chat empty state.

---

# Surface 3 — Agent Mode UI

## Purpose

Agent Mode should feel like a focused local coding harness.

The user should immediately understand:

- what repo/workspace is active,
- what runtime/model is active,
- what the agent is doing now,
- what goal is current,
- what tools/checks ran,
- what files changed,
- whether approval is required.

## Required Agent Layout

Use this structure:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Top bar: Agent | Runtime | Model | Workspace | Settings          │
├────────────────┬──────────────────────────────┬──────────────────┤
│ Left sidebar   │ Main agent work area          │ Right status     │
│                │                              │                  │
│ Workspace      │ Task prompt                   │ Current goal     │
│ Plans          │ Agent output                  │ Pending goals    │
│ Past runs      │ Tool activity                 │ Files touched    │
│                │                              │ Checks/results   │
└────────────────┴──────────────────────────────┴──────────────────┘
```

## Agent Top Status Block

Agent Mode must always show a compact status block.

Required fields:

```text
Current mode: Agent
Runtime: llama.cpp / Ollama fallback / offline
Model: Gemma GGUF / configured model
Workspace: /path/to/repo
Write access: approval required / workspace write / read-only
Current goal: <active goal title>
```

This can be in the top bar or at the top of the right panel, but it must be easy to see.

If Ollama fallback is active, show warning:

```text
Warning: using Ollama fallback, not GGUF primary runtime
```

## Agent Left Sidebar

The Agent sidebar should contain only Agent-related navigation:

- Workspace/repo section
- Current workspace path
- Recent workspaces if available
- Plans
- Past runs
- New agent task
- Maybe compact runtime badge

Do not show chat history here unless it is specifically agent run history.

## Agent Main Area

The main area should focus on:

- user task prompt,
- agent output,
- current run narrative,
- tool activity feed,
- approval prompts when needed.

The task prompt should be obvious and not buried.

Suggested main area order:

```text
Task composer
Current run summary / agent output
Tool activity
Approvals if active
```

## Agent Right Panel

The right panel should show operational clarity:

- current goal,
- pending goals,
- completed goals,
- failed/blocked goals,
- files touched,
- checks/results,
- diff summary if already available,
- command status,
- checkpoint/rollback status if already supported.

Do not overbuild the advanced diff panel in this stage. Use existing Run Console/diff/check components where possible, but reorganize them so the hierarchy is clear.

## Agent Tool Activity

Tool activity should be visible, but not noisy.

Each tool event should show:

```text
Tool name
Status: running/done/failed
Short input summary
Short output preview
```

Long raw output should be collapsed by default.

## Agent Approval UI

Approvals should be noticeable but not chaotic.

Approval cards should show:

- action type,
- target file/command,
- risk level,
- reason,
- approve/reject buttons.

Approvals should appear in Agent Mode only.

Do not show approvals in Chat Mode.

## Agent Empty State

Agent empty state should guide the user:

```text
Choose a workspace, then describe the task.

Example:
“Inspect this repo and create a plan to separate Chat and Agent mode.”
```

Do not show a blank console with unexplained controls.

---

# Settings UI Redesign

## Current Problem

Settings should not pop out as a side panel that makes the whole layout feel cramped.

Settings should open as a centered modal/popover overlay.

## Required Settings Behavior

When the user clicks Settings:

```text
centered modal opens
background dims
modal has clear title
modal has tabs/sections
modal can be closed with X
modal can be closed with Escape
modal can be closed by clicking outside if safe
focus is trapped inside modal while open
```

## Required Settings Layout

Settings modal should have grouped tabs or sections.

Suggested sections:

```text
Runtime
Model
Chat
Agent
Workspace
Advanced
```

Only show sections that are actually implemented.

## Settings Content Rules

### Runtime Settings

Runtime settings may show:

- active runtime,
- primary runtime,
- fallback runtime,
- base URLs,
- active model,
- GGUF model path/alias if configured,
- connection status,
- warning if fallback active.

### Chat Settings

Chat settings may show:

- markdown rendering toggle if available,
- thinking display toggle if available,
- history behavior if available,
- attachment limits if useful.

Do not show workspace/write/tool settings in Chat settings.

### Agent Settings

Agent settings may show:

- workspace policy,
- approval mode,
- tool retry max,
- context budget,
- agent execution profile,
- self-check setting,
- session memory.

### Advanced Settings

Advanced settings may show technical values but should be collapsed or separate so beginners are not overwhelmed.

## Settings Visual Requirements

- Centered modal width around 720px to 920px on desktop.
- Max height around 80vh.
- Internal scrolling if needed.
- Clear section headings.
- Save/apply buttons if settings are editable.
- Close button always visible.
- No layout shift of the main app when opening settings.

---

# Global Visual Design Requirements

## Typography

Improve hierarchy:

- app title clear,
- mode label visible,
- section headings readable,
- body text comfortable,
- metadata smaller but legible,
- code and tool output monospace.

Avoid overly tiny text.

Suggested minimums:

```text
Body text: 14.5px–16px
Sidebar text: 13px–14px
Metadata: 12px–13px
Code/tool output: 12.5px–13.5px
Math inline: 1.05em+
Math block: 1.15em+
```

## Spacing

Use a consistent spacing scale:

```text
4px
8px
12px
16px
20px
24px
32px
```

Avoid cramped cards.

Panels should breathe.

## Cards and Panels

Use cards only where grouping matters.

Avoid too many nested borders.

Use:

- subtle border,
- slightly elevated surface,
- clear heading,
- compact metadata.

## Buttons

Buttons should have clear hierarchy:

```text
Primary: main action
Secondary: normal action
Ghost/icon: low emphasis
Danger: destructive action
```

Do not make every button look equally important.

## Runtime Status Badges

Use clear badges:

```text
Connected
Fallback
Offline
Warning
Read-only
Approval required
```

Badges should be readable but not visually loud.

## Scroll Behavior

Fix scroll areas.

Each mode should have predictable scrolling:

- whole app should not produce weird hidden overflow bugs,
- sidebars scroll internally,
- chat messages scroll,
- agent panels scroll,
- settings modal scrolls internally.

Avoid layouts where controls disappear off-screen.

## Responsive Behavior

Support at least desktop and laptop widths.

For smaller screens:

- Chat sidebar can collapse.
- Agent right panel can collapse or move below main.
- Settings modal should fit mobile width.
- Composer should remain accessible.

Do not allow the UI to become unusable on narrower screens.

---

# What Should Stay Visible vs Hidden

## Always Visible in Chat Mode

- mode label: Chat
- model name
- runtime status compact badge
- messages
- composer
- new chat/history sidebar or toggle

## Hidden from Chat Mode

- workspace path
- repo tools
- approval mode
- file write permissions
- planner controls
- command output
- diff/check panels
- agent settings

## Always Visible in Agent Mode

- mode label: Agent
- runtime status
- model
- workspace
- write/access policy
- current task or current goal
- task composer
- progress/tool visibility

## Hidden or Collapsed in Agent Mode

- long raw logs
- full advanced settings
- huge diffs unless user opens them
- rarely used advanced runtime config
- internal debug traces unless in advanced/debug section

---

# Required Implementation Goals

Complete this stage in five goals.

---

## Goal 1 — Audit Current UI and Create Design Map

### Purpose

Understand the current UI before redesigning it.

### Required Inspection

Inspect:

```text
apps/web/src/App.tsx
apps/web/src/HarnessApp.tsx
apps/web/src/app/
apps/web/src/components/
apps/web/src/components/run-console/
apps/web/src/components/approvals/
apps/web/src/types/
apps/web/src/index.css
apps/web/package.json
```

Identify:

- current app shell,
- current topbar,
- current sidebar,
- current chat panel,
- current agent/run console,
- current settings panel,
- current modal/popup behavior,
- current markdown renderer,
- current KaTeX/math styles,
- current responsive styles,
- current runtime/model status display,
- current workspace display,
- current approval UI,
- current diff/check UI.

### Required Output Before Editing

Create a short internal design map in the final report or implementation notes:

```text
Existing surfaces:
- Landing / shell:
- Chat:
- Agent:
- Settings:
- Runtime status:
- Markdown/math:
- Major clutter sources:
```

Do not start by randomly editing CSS.

### Completion Criteria

Goal 1 is complete when the current UI structure and clutter sources are identified.

---

## Goal 2 — Redesign App Shell, Landing Screen, and Settings Modal

### Purpose

Create the overall clarity structure first.

### Required Changes

Implement or refine:

- clean mode landing page,
- clear mode switch,
- top-level app shell,
- dark theme layout tokens,
- settings as centered modal/popover,
- settings close behavior,
- settings sections/tabs,
- no side settings panel that squeezes the main layout.

### Settings Modal Requirements

Settings modal must:

- open centered,
- dim background,
- include close button,
- support Escape close,
- preferably close on safe outside click,
- keep focus behavior reasonable,
- scroll internally,
- not shift the whole app layout.

### Completion Criteria

Goal 2 is complete when:

- landing page is clear,
- Chat and Agent routes/surfaces are visually distinct,
- settings open as a centered modal,
- old side settings layout is removed or no longer primary,
- dark theme is preserved.

---

## Goal 3 — Redesign Chat Mode for Clean Conversation and Better Math

### Purpose

Make Chat Mode feel clean, readable, and focused.

### Required Changes

Implement or refine:

- Chat topbar,
- Chat sidebar with New Chat and history,
- Chat message layout,
- Chat composer,
- attachment UI if already supported,
- markdown rendering styles,
- LaTeX/KaTeX size and spacing,
- readable code blocks,
- clean empty state.

### Must Fix

LaTeX/math in Chat Mode must not appear tiny.

Improve:

- inline formula size,
- display formula size,
- formula spacing,
- markdown headings,
- note readability,
- list spacing,
- code block readability.

### Completion Criteria

Goal 3 is complete when:

- Chat Mode has no agent clutter,
- messages are readable,
- math formulas are larger and properly spaced,
- markdown notes look polished,
- composer is easy to use,
- history/sidebar is clean.

---

## Goal 4 — Redesign Agent Mode for Operational Clarity

### Purpose

Make Agent Mode clearly show what the agent is doing.

### Required Changes

Implement or refine:

- Agent topbar/status block,
- workspace/repo sidebar,
- plans/past-runs area,
- task composer,
- agent output area,
- tool activity feed,
- current goal/progress right panel,
- files touched,
- checks/results,
- approval cards,
- runtime/model/workspace/write-access visibility.

### Required Agent Status Block

Agent Mode must clearly show:

```text
Current mode: Agent
Runtime: llama.cpp / Ollama fallback / offline
Model: <active model>
Workspace: <path>
Write access: <policy>
Current goal: <goal>
```

### Completion Criteria

Goal 4 is complete when:

- user can immediately tell Agent Mode is active,
- active runtime/model/workspace are visible,
- current goal/progress is visible,
- tool activity is understandable,
- long logs are collapsed or controlled,
- approvals are visible only in Agent Mode.

---

## Goal 5 — Responsive Polish, Accessibility, Validation, and Final Report

### Purpose

Make the redesigned UI reliable and shippable.

### Required Checks

Validate:

- desktop layout,
- laptop layout,
- narrower width behavior,
- scroll behavior,
- modal close behavior,
- keyboard accessibility,
- focus states,
- markdown rendering,
- KaTeX rendering,
- runtime status display,
- Chat/Agent mode switching.

### Build Commands

Run:

```bash
npm run build --workspace web
```

If broader checks are reasonable:

```bash
npm run build
npm run lint --workspace web
```

Do not claim checks passed unless they actually passed.

### Manual Verification Checklist

Verify:

#### Landing

- App opens to clear Chat/Agent choice.
- No clutter on landing.
- Runtime badge is compact.

#### Chat

- Chat topbar shows mode/model/runtime.
- Chat sidebar shows New Chat/history only.
- Chat does not show workspace/agent tools.
- Messages are readable.
- Markdown is readable.
- LaTeX formulas are larger and properly spaced.
- Composer is easy to use.
- Attachments still work if previously supported.

#### Agent

- Agent topbar/status block is clear.
- Workspace is visible.
- Runtime/model are visible.
- Current goal is visible.
- Tool activity is understandable.
- Approvals are clear.
- Files/checks/results are visible but not overwhelming.

#### Settings

- Settings open centered.
- Settings close with X.
- Settings close with Escape.
- Settings do not squeeze the layout.
- Settings content is grouped.

#### Responsive

- UI does not break on narrower screens.
- Important controls remain reachable.
- Scroll areas behave correctly.

### Final Report Requirements

Report:

```text
Completed changes
Files changed
Design before
Design after
Chat improvements
Agent improvements
Settings modal behavior
Markdown/LaTeX improvements
Checks run
Check results
Known limitations
Next recommended goals
```

Be honest. Do not overhype.

---

## Strict Scope Boundaries

Do not work on these in this stage:

- llama.cpp/GGUF runtime priority unless Stage 3 left a tiny display integration issue,
- adaptive planner logic,
- goal runner logic,
- tool runtime logic,
- new dangerous tools,
- broad web search,
- authentication,
- database work,
- major backend rewrite,
- full advanced diff panel redesign,
- changing model behavior.

This stage is specifically:

```text
Redesign the UI around clarity while preserving existing behavior.
```

---

## Implementation Principles

1. **Clarity first.**
   - Every visible UI element should have a reason.

2. **Preserve dark theme.**
   - Improve the dark theme; do not replace it with light mode.

3. **Separate by mode.**
   - Chat should look like Chat. Agent should look like Agent.

4. **Settings belong in a modal.**
   - Do not keep settings as a layout-crushing side panel.

5. **Show essential status.**
   - Runtime/model/workspace/current goal should be visible where relevant.

6. **Hide advanced clutter.**
   - Advanced settings and debug traces should be collapsed or moved behind details.

7. **Make math readable.**
   - LaTeX formulas in Chat Mode must be larger and properly spaced.

8. **Avoid giant CSS chaos.**
   - Organize styles by mode or component where possible.

9. **Do not break working behavior.**
   - This is a redesign, not a feature rewrite.

10. **Validate with build and manual checks.**
    - Do not claim success without checking.

---

## Suggested File Direction

The exact files depend on the current repo state, but likely targets include:

```text
apps/web/src/index.css

apps/web/src/app/
  AppShell.tsx
  ModeLanding.tsx

apps/web/src/app/chat/
  ChatMode.tsx
  ChatComposer.tsx
  ChatMessageList.tsx
  ChatMessageRow.tsx
  ChatHistory.tsx

apps/web/src/app/agent/
  AgentMode.tsx
  AgentWorkspacePanel.tsx
  AgentTaskComposer.tsx
  AgentRunConsole.tsx
  AgentStatusPanel.tsx

apps/web/src/app/shared/
  SettingsModal.tsx
  RuntimeStatusBadge.tsx
  MarkdownRenderer.tsx
  layout components

apps/web/src/components/run-console/
apps/web/src/components/approvals/
apps/web/src/components/StreamingMarkdown.tsx
```

Do not force these exact names if the current architecture after previous stages has better names.

The required outcome is a clear and usable UI.

---

## Definition of Done

This task is complete only when all of the following are true:

1. The dark theme is preserved and improved.
2. The landing page clearly offers Chat and Agent.
3. Chat Mode is visually clean and free of agent clutter.
4. Agent Mode clearly shows workspace, runtime, model, write access, current goal, tools, and checks.
5. Settings open as a centered modal/popover, not a side panel.
6. Settings can be closed clearly.
7. Chat markdown rendering is polished.
8. Chat LaTeX/math is larger and readable.
9. Long logs and advanced details do not overwhelm the UI.
10. Layout is usable on desktop and narrower screens.
11. Existing core behavior is preserved.
12. Build/check commands are run or failures are documented.
13. The final report explains exactly what changed and what still needs work.


---

# Combined Stage 5 Source — Stage 5 — Add Minimal Diff/Test Visibility Without Hindering the Agent

# AGENTS.md — Stage 5: Add Minimal Diff/Test Visibility Without Hindering the Agent

## Mission

Add a **minimal, non-disruptive Diff/Test visibility panel** to Agent Mode.

This stage is not about building a full advanced diff viewer.

The goal is simple:

```text
After the agent changes files, the user should immediately see:
- which files changed,
- which verification checks ran,
- whether those checks passed/failed,
- and a simple “View diff” option.
```

This must be lightweight, clear, and safe.

Do **not** build a full side-by-side diff UI in this stage.  
Do **not** add command-history dashboards in this stage.  
Do **not** add rollback buttons in this stage.  
Do **not** add approve/reject per file in this stage.  
Do **not** redesign the entire Agent UI in this stage.  
Do **not** slow down or block the agent’s normal workflow.

This stage should improve trust without making the UI heavier.

---

## Stage Dependency

This is **Stage 5**.

It should be applied on a new branch like the other stages.

Expected previous stages:

1. Stage 1 — Separate Chat Mode and Agent Mode
2. Stage 2 — Adaptive self-planning
3. Stage 3 — Make llama.cpp/GGUF primary
4. Stage 4 — Redesign UI around clarity

If some previous stages are not merged yet, confirm the correct base branch before starting.

Do not assume all stages are already on `main`.

---

## Repository and Branch Rules

Expected local repository path:

```text
/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness
```

Expected project:

```text
Local-AI-Harness / Gemma 4 Harness
```

Run first:

```bash
pwd
git status
git branch
git log --oneline --decorate -8
```

Do not work directly on:

```text
main
rescue/lightweight-harness-reset
experiment/action-dsl-workflow-26b
```

unless the user explicitly tells you to.

Create a new branch for this stage.

Recommended branch name:

```bash
git checkout -b feature/minimal-diff-test-visibility
```

If this stage should be stacked on a previous stage branch, first check out that branch, then create the new branch:

```bash
git checkout <previous-stage-branch>
git checkout -b feature/minimal-diff-test-visibility
```

If there are uncommitted changes, stop and report them before continuing.

---

## Product Reason

The agent can edit files and run checks, but the user needs a quick trust signal.

The user should not have to search raw logs to answer:

```text
What changed?
Did the build/test pass?
Can I view the diff?
```

Minimum useful display:

```text
Changed:
- src/components/Navbar.jsx
- src/styles/navbar.css

Verification:
- npm run build: passed

[ View diff ]
```

That is enough for this stage.

---

## Core Design Rule

The panel must be **minimal**.

It should help the user understand the result without getting in the way of agent execution.

Correct behavior:

```text
Agent works normally
↓
Files changed are summarized
↓
Verification checks are summarized
↓
User can expand/view diff if desired
```

Incorrect behavior:

```text
Agent waits on a complex diff UI
Agent slows down to render giant diffs
Agent flow becomes dependent on the panel
The panel takes over the whole UI
The user is forced to inspect diffs before continuing
```

The panel is a visibility layer, not the agent controller.

---

## Required Outcome

Agent Mode should include a compact result/verification card or panel showing:

```text
Changed files
Verification checks
Simple pass/fail status
View diff button
```

This may appear in the Agent right panel, run summary area, or current run result area depending on the Stage 4 UI.

Keep the layout consistent with the existing Agent Mode design.

---

## What to Build Now

Build only the minimum version.

### Required Minimal Panel

The panel should show:

```text
Changed
- <file path>
- <file path>

Verification
- <command>: passed
- <command>: failed
- <command>: not run

[ View diff ]
```

### Required Data

The panel should use existing agent/run data where possible:

- changed files,
- structured diff summary,
- git diff summary,
- command/check results,
- selected test results,
- build/lint/test status.

Do not add a heavy new backend system if existing data already exists.

### Required Interaction

The `View diff` button should:

- show the existing diff view if one already exists,
- or open a simple expandable/collapsible diff preview,
- or reveal raw unified diff in a controlled scroll area.

Use the simplest existing path.

The default state should show the summary first, not a giant diff.

### Required Empty State

If no files changed:

```text
Changed
No files changed.
```

If no checks ran:

```text
Verification
No verification checks were run.
```

If diff data is unavailable:

```text
Diff unavailable.
```

Do not crash the UI if any data is missing.

---

## What Not to Build Yet

Do not build these in this stage:

- side-by-side diff viewer,
- syntax-highlighted diff engine,
- command history timeline,
- failed-check deep inspector,
- rollback button,
- approve/reject per changed file,
- per-file review workflow,
- PR-style code review UI,
- diff comments,
- large test output dashboard,
- log search,
- coverage panel,
- performance charts.

These are later-stage features.

This stage is only the basic trust panel.

---

## Required UI Behavior

The minimal panel should be visible only in Agent Mode.

It should not appear in Chat Mode.

It should be visually compact.

Suggested placement:

```text
Agent right panel
  Current goal
  Pending goals
  Files touched
  Checks/results
  Minimal Diff/Test Summary
```

or:

```text
Agent main run summary
  Completed run summary
  Changed files
  Verification
  View diff
```

Choose the placement that fits the current Stage 4 layout best.

---

## Required Visual Style

The panel should match the dark theme.

Use compact visual states:

```text
passed  = green/success badge
failed  = red/danger badge
running = blue/accent or neutral badge
not run = gray/secondary badge
warning = yellow/warning badge
```

Do not make the panel visually louder than the current goal or approval cards.

Use clear labels:

```text
Changed
Verification
View diff
```

Do not use vague labels like:

```text
Output
Info
Stuff
```

---

## Required Agent Safety Rule

This panel must never become required for the agent to continue.

The agent execution loop should not depend on rendering the panel.

The panel should consume run results.  
It should not control run results.

Correct dependency:

```text
Agent run state → Diff/Test panel
```

Wrong dependency:

```text
Diff/Test panel → Agent execution state
```

---

## Required Implementation Goal

Complete this stage as one focused implementation goal.

---

# Goal 1 — Add Minimal Changed-Files and Verification Summary to Agent Mode

## Purpose

Add a compact Agent Mode panel/card that shows changed files, verification status, and a simple diff viewer entry point.

## Required Inspection

Before editing, inspect the existing change/diff/check data flow.

Likely areas:

```text
packages/tool-runtime/
packages/core/src/
packages/core/src/agent-run.ts
packages/core/src/engine.ts
packages/task-orchestrator/src/
packages/planner/src/
apps/api/src/server.ts
apps/web/src/app/agent/
apps/web/src/components/run-console/
apps/web/src/components/
apps/web/src/types/
apps/web/src/index.css
```

Search for existing names such as:

```text
gitDiff
getStructuredDiff
structuredDiff
changedFiles
runSummary
checks
verification
selectTestsForChangedFiles
runCommand
commandResult
testResult
diff
```

Do not invent new data models until you know what already exists.

## Required Data Mapping

Map existing run data into a simple UI shape.

Suggested frontend type:

```ts
interface MinimalRunVerificationSummary {
  changedFiles: Array<{
    path: string;
    status?: 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';
  }>;
  checks: Array<{
    command: string;
    status: 'passed' | 'failed' | 'running' | 'skipped' | 'not_run' | 'unknown';
    durationMs?: number;
    summary?: string;
  }>;
  diffAvailable: boolean;
  diffText?: string;
}
```

Use existing project types if available.

Do not overfit the type. Keep it small.

## Required Panel Behavior

The panel should show:

### Changed section

If changed files exist:

```text
Changed
- apps/web/src/app/agent/AgentMode.tsx
- apps/web/src/index.css
```

If none exist:

```text
Changed
No files changed.
```

### Verification section

If checks exist:

```text
Verification
- npm run build --workspace web: passed
- npm test: failed
```

If no checks ran:

```text
Verification
No verification checks were run.
```

### Diff button

If diff is available:

```text
[ View diff ]
```

Clicking it should reveal the diff in one of these acceptable forms:

1. existing diff component,
2. collapsible inline raw unified diff,
3. modal with raw unified diff,
4. link/scroll-to existing run-console diff section.

Choose the least invasive option.

If no diff is available:

```text
Diff unavailable
```

Do not show an active `View diff` button when no diff exists.

## Required Collapsed Behavior

Diff content must be collapsed by default.

The first view should be summary-only.

Do not render a giant diff automatically.

This prevents the panel from overwhelming the Agent Mode UI.

## Required Backend/API Behavior

If the backend already emits changed files/checks/diff data, reuse it.

If not, add the smallest necessary field to the existing run summary/event payload.

Avoid a broad backend rewrite.

Acceptable additions:

```text
changedFiles: string[]
verificationChecks: { command, status, summary }[]
diffAvailable: boolean
diffText?: string
```

Do not add a new full diff service unless it already exists.

## Required State Behavior

The panel should update when:

- files are changed,
- structured diff is generated,
- verification command starts,
- verification command finishes,
- run completes,
- run fails.

If live updates are too complex, update the panel at run completion for this stage.

Live updates are nice, but not required.

Minimum requirement:

```text
After a run finishes or stops, the panel summarizes changed files and verification.
```

## Required Failure Handling

If a command fails, show:

```text
Verification
- npm run build: failed
```

Optionally include short summary:

```text
TypeScript error in apps/web/src/...
```

Do not dump full logs into the minimal summary.

Long logs should remain in existing run console/log area.

## Required Chat Mode Boundary

This panel belongs only in Agent Mode.

Chat Mode must not show:

- Changed files,
- Verification,
- View diff,
- git diff,
- test results,
- command output.

If a shared component is used, ensure it is only mounted from Agent Mode.

## Validation Commands

Run:

```bash
npm run build --workspace web
```

If broader build is reasonable:

```bash
npm run build
```

If tests exist and are reasonable:

```bash
npm test
```

If frontend tests exist for components, add or update minimal tests for:

- changed files render,
- no changed files empty state,
- checks render,
- no checks empty state,
- View diff hidden when unavailable,
- View diff reveals diff when available.

Do not create a large testing framework if none exists.

## Manual Verification Checklist

Verify:

### Agent Mode

- Changed files section appears after a file edit.
- Verification section appears after a check runs.
- Passed checks are clearly marked.
- Failed checks are clearly marked.
- Empty changed-files state is clear.
- Empty verification state is clear.
- View diff appears only when diff exists.
- Diff is collapsed by default.
- Clicking View diff reveals diff without breaking layout.
- Long diff scrolls safely.
- Panel does not block agent continuation.
- Panel does not replace the run console.
- Panel does not hide current goal/progress.

### Chat Mode

- No diff/test panel appears.
- No changed files appear.
- No verification checks appear.
- Chat remains clean.

### Layout

- Panel fits inside Agent Mode.
- Panel does not make the UI feel crowded.
- Panel works with dark theme.
- Panel remains readable on laptop-sized screens.

## Final Report Requirements

At the end, report:

```text
Completed changes
Files changed
Data source used for changed files
Data source used for verification checks
How View diff works
Checks run
Check results
Known limitations
Future full diff/test panel ideas
```

Be honest.

If diff data was not available and the panel only shows changed files/check status, say that clearly.

If checks were not available and only changed files display, say that clearly.

---

## Strict Scope Boundaries

Do not work on these in this stage:

- side-by-side diff viewer,
- advanced test dashboard,
- command history timeline,
- rollback button,
- approve/reject per changed file,
- PR-style review UI,
- syntax-highlighted full diff viewer,
- log search,
- broad UI redesign,
- planner redesign,
- runtime redesign,
- Chat Mode changes except ensuring the panel does not appear there,
- new dangerous tools,
- backend rewrite.

This stage is specifically:

```text
Minimal changed-files + verification summary + View diff button.
```

---

## Implementation Principles

1. **Minimal first.**
   - Build the smallest useful version.

2. **Do not hinder the agent.**
   - The agent must keep working even if the panel fails to render.

3. **Summary before detail.**
   - Show changed files and check statuses before showing raw diff.

4. **Diff collapsed by default.**
   - Never flood the UI with full diff automatically.

5. **Reuse existing data.**
   - Prefer existing run summary, structured diff, command result, and verification data.

6. **Agent Mode only.**
   - Do not leak diff/test UI into Chat Mode.

7. **No new workflow dependency.**
   - The panel observes run state; it does not control run state.

8. **Handle missing data gracefully.**
   - No files, no checks, or no diff should not crash the UI.

9. **Keep logs where they belong.**
   - Long logs stay in the run console, not the summary card.

10. **Prepare for later expansion.**
    - Use names and structure that can later support advanced diff/test UI without rewriting everything.

---

## Suggested File Direction

The exact files depend on the repo state after earlier stages, but likely targets include:

```text
apps/web/src/app/agent/
  AgentMode.tsx
  AgentRunConsole.tsx
  AgentStatusPanel.tsx
  MinimalDiffTestSummary.tsx

apps/web/src/components/run-console/
  RunConsole.tsx
  existing diff/check components

apps/web/src/types/
  run.ts

apps/web/src/index.css

packages/core/src/
  engine.ts
  agent-run.ts

packages/tool-runtime/
  git/diff tools or structured diff tools

apps/api/src/
  server.ts
```

Do not force exact filenames if the current architecture after previous stages suggests better names.

The required outcome is minimal visibility, not a specific file layout.

---

## Definition of Done

This task is complete only when all of the following are true:

1. Agent Mode shows a compact changed-files section.
2. Agent Mode shows a compact verification section.
3. Agent Mode shows pass/fail/not-run status clearly.
4. Agent Mode has a `View diff` option when diff is available.
5. Diff content is collapsed by default.
6. Missing changed-files/check/diff data is handled gracefully.
7. Chat Mode does not show diff/test UI.
8. The panel does not block or slow agent execution.
9. The panel reuses existing data where possible.
10. The app builds or build failure is documented.
11. The final report clearly explains what was added and what remains for the later full diff/test panel.


---

# Combination Verification

The following original stage files were checked and included in this combined file without removing their original stage text:

- Stage 1 — Separate Chat Mode and Agent Mode — source file `AGENTS-stage1(remnote).md` — characters: 24003 — included fully: `True`
- Stage 2 — Replace Rigid Planner with Adaptive Self-Planning — source file `AGENTS_stage2_adaptive_self_planning.md` — characters: 24681 — included fully: `True`
- Stage 3 — Make llama.cpp/GGUF the Primary Runtime — source file `AGENTS_stage3_llamacpp_gguf_primary.md` — characters: 17349 — included fully: `True`
- Stage 4 — Redesign UI Around Clarity — source file `AGENTS_stage4_ui_clarity_redesign.md` — characters: 26643 — included fully: `True`
- Stage 5 — Add Minimal Diff/Test Visibility Without Hindering the Agent — source file `AGENTS_stage5_minimal_diff_test_visibility.md` — characters: 15637 — included fully: `True`

This verification only confirms full text inclusion of the uploaded stage files inside the combined Markdown file. The master workflow section at the top was added to enforce the requested rescue-branch merge and single new branch process before applying Stage 1 through Stage 5.


---

# Reviewed File Verification

Generated: 2026-06-04T19:14:38

This final reviewed file includes:

- the original combined Stage 1–5 file text,
- a new binding reviewed master workflow,
- a gap audit based on the uploaded master file and current repo inspection,
- required corrections for branch workflow, component structure, API safety, adaptive planning, runtime selection, UI layout, and minimal diff/test visibility.

The preserved original combined file length was:

```text
113119 characters
```

The final reviewed file length is:

```text
132724 characters before this verification footer
```
