# AGENTS.md

> Repository: `HTGit63/Local-AI-Harness`
> Active branch to work on: `rescue/lightweight-harness-reset`
> Primary operator: Hunde Tefera Entele
> Target machine: local Linux laptop, 16 GB RAM, Ollama local models, CPU/iGPU-class performance
> Mission: make the Local AI Harness reliable, lightweight, understandable, and usable before adding advanced agent features.

---

# 0. Read this first

This file is a full replacement for the current `AGENTS.md`.

Do **not** preserve the old completion-ledger framing.

The previous `AGENTS.md` treated the overbuilt smart-agent architecture as complete. That framing is now considered part of the problem.

The current recovery effort must simplify the harness around:

- clear Chat Mode
- clear Agent Work
- one active local model by default
- lightweight deterministic project inspection
- reduced default tool exposure
- compact memory
- clean API, CLI, and web mode contracts
- clean UI with advanced details hidden by default
- safe workspace binding
- explicit approval outcomes
- conservative local model budgets
- tests that prevent the old heavy behavior from returning

The goal is not to build the most impressive local agent.

The goal is to build a local harness that Hunde can actually use without fighting it.

---

# 1. Branch discipline

## 1.1 Work only on the active recovery branch

All implementation work must happen on:

```bash
git switch rescue/lightweight-harness-reset
```

Before editing, confirm:

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

Do not work on:

- `main`
- `experiment/action-dsl-workflow-26b`
- any old experiment branch

unless the user explicitly asks.

## 1.2 No hidden broad rewrites

Do not rewrite the app in a giant pass.

Each milestone must be implemented in small commits. Every commit should answer:

- What changed?
- Why did it change?
- What behavior is now protected?
- What validation passed?

## 1.3 Keep the April 28 working behavior as the learning baseline

The previously useful behavior was simple project inspection. The harness could inspect a normal project folder, identify the stack, list main files, and explain how the app worked.

That behavior worked because it was:

- deterministic
- lightweight
- fast
- based on obvious files like `package.json`, entry files, `views/`, and `public/`
- not a repo-wide audit
- not a multi-agent workflow
- not dependent on heavy model routing
- not cluttered by advanced tool panels

This recovery must preserve that lesson.

---

# 2. Current vulnerability report

The latest recovery branch improved one important area: the core model-role configuration was mostly simplified back to one active model. However, the old workflow risks remain. The system can still become slow, confusing, or unreliable because old agentic assumptions remain in API defaults, CLI defaults, task routing, UI, tools, memory, and tests.

## 2.1 Critical vulnerabilities

| ID | Vulnerability | Urgency | Why it can break the system |
|---|---|---:|---|
| C1 | API defaults to Agent Mode | Critical | Normal chat can accidentally trigger planner, tools, repo context, approvals, and long local-model loops. |
| C2 | CLI defaults to agentic execution | Critical | The CLI claims to be chat but sends normal input through the heavy agent path. |
| C3 | Simple project inspection routes to `repo_wide_audit` | Critical | “What kind of project is this?” becomes a heavy multi-step audit instead of fast deterministic inspection. |
| C4 | Rigid task templates control the agent | Critical | The agent becomes trapped in predefined workflows instead of using flexible planning. |
| C5 | Advanced tools are exposed by default | Critical | Local models receive too many tools and may choose the wrong path. |
| C6 | Current instructions still point toward overbuilt architecture | Critical | Future agents will preserve the wrong system unless this file replaces the old direction. |
| C7 | Web UI still renders a heavy Run Console by default | Critical | Users see too much internal machinery and cannot quickly understand what happened. |
| C8 | No explicit API mode contract | Critical | `agentic` booleans and implicit defaults make behavior unpredictable across web, CLI, and API. |
| C9 | No true `inspectProject()` first-class path | Critical | The best working feature is not protected by code and tests. |
| C10 | Tests currently allow wrong product behavior | Critical | The test suite can pass while preserving the heavy workflow that caused the problem. |
| C11 | Event contracts still expose `direct` / `agentic` internally and inconsistently | Critical | UI/API/session code can look updated while old mode states keep driving behavior. |
| C12 | Browser folder resolution can silently bind the wrong workspace | Critical | Folder-label matching can appear correct while backend reads/writes another candidate path. |

## 2.2 High-priority workflow failures

| ID | Failure | Urgency | Why it matters |
|---|---|---:|---|
| H1 | Planner state still contains stale profile concepts | High | Removed model-routing ideas still leak into planner/UI types. |
| H2 | Web presets still suggest “Deep Agent” / autonomous behavior | High | Product language pushes users toward heavy workflows unsuitable for the target PC. |
| H3 | Tool naming is inconsistent | High | `readFile` vs `read_file` style mismatch can break traces, UI display, tests, and debugging. |
| H4 | Session turn metadata can store full run objects | High | Memory and session files can grow too large over time. |
| H5 | Structured diff and checkpoint UI are too visible | High | Useful internals become default visual clutter. |
| H6 | Command approval flow is safe but heavy | High | Even safe verification commands can become disruptive. |
| H7 | Browser snapshot vs backend workspace is not clear enough | High | The agent may appear workspace-aware when it is only looking at browser-provided context. |
| H8 | File walking/search ignore lists are incomplete and inconsistent between modules | High | The harness can scan generated, vendored, or harness-internal directories and slow down badly. |
| H9 | Web/internet tools are available too easily | High | Local coding work can unexpectedly try network access. |
| H10 | Local model budgets are not clearly conservative | High | 16 GB machines can stall if context/output/retry settings are too high. |
| H11 | Secret and credential files are not treated as a first-class exclusion category | High | Broad read/search/context paths can accidentally surface sensitive files. |
| H12 | Skill activation is still mixed into the normal session path | High | Skills can add another dimension of complexity before Chat/Agent basics are stable. |
| H13 | API streaming and non-streaming paths can drift | High | Fixing only one endpoint can leave the other with old Agent Mode defaults. |
| H14 | Repo-indexer candidate path lists contain stale web paths | High | The code may look for `apps/web/src/HarnessApp.tsx` while the actual path is `apps/web/src/app/HarnessApp.tsx`. |

## 2.3 Medium and low-level issues

| ID | Issue | Urgency |
|---|---|---:|
| L1 | Remove temporary user experiment names from tests, prompts, fixtures, and docs. | Medium |
| L2 | Do not hardcode file-specific explanations like `RunConsole` or `engine.ts` inside generic UI helpers. | Medium |
| L3 | Do not open raw diffs by default. | Medium |
| L4 | Do not open structured diffs by default. | Medium |
| L5 | Hide context budget telemetry behind Advanced Details. | Medium |
| L6 | Hide checkpoint IDs behind Advanced Details. | Medium |
| L7 | Do not print thinking blocks by default in CLI. | Medium |
| L8 | CLI `prompt` should not silently run Agent Mode. | Medium |
| L9 | CLI help text is too crowded. | Medium |
| L10 | `webSearch` and `fetchUrl` should not be default coding tools. | Medium |
| L11 | Fallback file walking ignores too few heavy directories. | Medium |
| L12 | Grep fallback can scan too broadly. | Medium |
| L13 | `run_command` should not be treated as a write intent. | Medium |
| L14 | `workspace_overview` should not always be direct chat. | Medium |
| L15 | `architecture_change` is triggered too easily by common words. | Medium |
| L16 | `small_patch` builds context packs too early. | Medium |
| L17 | `single_file` forces checkpoint behavior too early. | Medium |
| L18 | Agent summaries can overstate changed files if diff metadata accumulates. | Medium |
| L19 | The system lacks a final “safe idle” state after failed/denied actions. | Medium |
| L20 | Runtime stall states are not prominent enough in UI/CLI. | Medium |
| L21 | `thinking` output can leak into default CLI/web display even when it should be hidden. | Medium |
| L22 | CORS and host binding rules are not explained as local-only defaults. | Medium |
| L23 | Large image attachments and multimodal context can bypass lightweight expectations if not isolated. | Medium |
| L24 | Session list output can imply turn history is loaded when listing intentionally omits it. | Medium |
| L25 | Advanced run history and checkpoint endpoints can encourage debugging UI clutter before simple modes work. | Medium |

---

# 3. Product contract

Local AI Harness must become a small, reliable, local-first assistant with two clear modes and one special lightweight inspection path.

## 3.1 Chat Mode

Chat Mode is for normal conversation.

It must:

- be the default mode in API, web, and CLI
- avoid planner execution
- avoid workspace edit tools
- avoid repo-wide indexing
- avoid approval workflows
- avoid Run Console clutter
- avoid tool schema exposure by default
- be fast enough for local daily use
- support normal explanation and lightweight Q&A

Chat Mode may read files only if the user explicitly chooses file context or asks for a specific file, and the UI/CLI must make that clear.

## 3.2 Agent Work

Agent Work is for workspace-aware action.

It may:

- inspect files
- create a lightweight plan
- run safe read tools
- propose edits
- request approvals
- apply minimal patches
- run verification commands
- summarize changed files and results

Agent Work must always show:

- workspace root
- workspace source
- permission mode
- mode
- goal
- current action
- files inspected
- files changed
- checks run
- blocked/failed/safe-idle reason
- final result

## 3.3 Inspect Project

Inspect Project is a special lightweight Agent Work path.

It must:

- be deterministic first
- avoid repo-wide audit
- avoid edit tools
- avoid checkpoints
- avoid web tools
- inspect only obvious project files/directories
- return a clear project summary
- run fast enough to feel like a utility, not an agent loop

## 3.4 Full Audit

Full Audit is different from Inspect Project.

Full Audit may read more broadly, but only when the user explicitly asks for broad review language such as:

- “audit the whole repo”
- “review the entire codebase”
- “find all bottlenecks”
- “scan everything”
- “deep repo audit”

Do not treat ordinary project inspection as Full Audit.

## 3.5 One active model

There is only one active model by default.

Default:

```ts
model: 'gemma4:e4b'
```

Do not reintroduce:

```ts
fastModel
codingModel
reviewModel
apiModel
executionProfile
providerProfile
promptProfile
automatic model routing
```

A future manual model preset system may exist, but automatic per-purpose model routing is forbidden until the base harness works reliably.

## 3.6 Skills are advanced, not default behavior

Skills are allowed only as optional user-selected behavior.

Do not let skills:

- change Chat Mode into Agent Work
- add hidden tool access
- bypass mode/tool-profile rules
- override workspace policy
- activate disabled skills
- silently expand memory or context budgets

Keep disabled skills disabled unless the user explicitly changes policy and tests are updated.

---

# 4. Workflow breakdowns that must be fixed

## 4.1 Normal chat becomes agent work

Break path:

1. User opens web or CLI.
2. User types a normal question.
3. System defaults to agentic execution.
4. Planner starts, tools become available, context grows.
5. Local model slows or stalls.

Fix:

- Chat must be default.
- Agent Work must be explicitly selected.
- API must not infer Agent Work from missing fields.

## 4.2 Project inspection becomes repo audit

Break path:

1. User asks what kind of project the workspace is.
2. Classifier maps it to `repo_wide_audit`.
3. System builds context packs and reads too much.
4. Simple inspection becomes slow and confusing.

Fix:

- Add `inspect_project`.
- Add deterministic `inspectProject()`.
- Use `full_audit` only when explicitly requested.

## 4.3 Local model receives too many tools

Break path:

1. Agent Mode exposes advanced AST/import/diff/checkpoint/web tools.
2. Small local model picks unnecessary tools.
3. Tool calls fail or become malformed.
4. Manual fallback starts.
5. User sees noise instead of progress.

Fix:

- Reduce default tool set.
- Gate advanced tools behind Advanced Agent Mode.
- Expose tools by mode and intent, not one giant global list.

## 4.4 UI tells the wrong story

Break path:

1. RunConsole shows context budget, plan, files, diffs, checkpoints, approvals, verification.
2. User sees many panels but does not know what actually happened.
3. Simple tasks look complicated.
4. Failures look like progress.

Fix:

- Chat Mode UI must be simple.
- Agent Work UI must show only essential activity by default.
- Advanced Details must hide raw traces, diffs, budget, and checkpoints.

## 4.5 Session memory grows too heavy

Break path:

1. Agent run stores full run summaries.
2. Full run summaries may include diffs, commands, web fetches, steps, metadata.
3. JSONL grows.
4. Loading and summarizing sessions becomes slow.

Fix:

- Store compact run summaries only.
- Keep full traces/runs separate and bounded.
- Do not inject large memory into prompts.

## 4.6 Approval deadlock

Break path:

1. Agent requests write/command approval.
2. User denies or ignores it.
3. Agent run remains pending or unclear.
4. UI/CLI appears stuck.

Fix:

- Denial must transition run to `blocked` or `safe_idle`.
- Timeout/no response must be visible.
- Final message must explain what was not done and why.

## 4.7 Browser workspace mismatch

Break path:

1. User selects a folder in browser.
2. Backend workspace root is different or unresolved.
3. Agent appears to work on one workspace but reads/writes another.

Fix:

- Always show `workspaceSource` as `backend_bound` or `browser_snapshot_only`.
- Do not write files unless backend workspace is bound.
- Browser snapshots are read-only unless resolved to a backend path.
- Never silently bind if there are multiple candidates or low confidence.

## 4.8 Web/network surprise

Break path:

1. User asks a local coding question.
2. Agent sees `webSearch`/`fetchUrl` tools.
3. Model calls web unnecessarily.
4. Local task becomes slow and privacy/confidence is reduced.

Fix:

- Web tools are disabled by default.
- Web tools require explicit web intent or setting.
- UI must show when web access is enabled.

## 4.9 Stale path assumptions

Break path:

1. Agent/test/tool assumes an older file path.
2. Repo has moved the file.
3. Context selection silently misses the real file.
4. Agent patches the wrong place or fails.

Fix:

- Always verify paths with `git ls-files`, `find`, or `fs.access`.
- Tests must fail when candidate path lists contain stale paths for key app files.

---

# 5. Global engineering rules

## 5.1 Work incrementally

Every milestone must be completed in small commits.

Do not create one massive rewrite.

Each commit should answer:

- What changed?
- Why?
- What behavior is protected?
- What tests passed?

## 5.2 No fake completion

Do not mark any milestone done unless:

- implementation is complete
- tests are updated
- validation commands pass or failure is documented
- old behavior is removed or gated
- user-facing behavior is clear

## 5.3 No temporary experiment names

Do not hardcode user experiment folder names or past test project names into runtime code, tests, prompts, fixtures, or docs.

Use generic names like:

```txt
sample-express-app
sample-node-app
fixture-project
sample-vite-app
```

Do not use names from temporary experiments.

## 5.4 Prefer deterministic helpers

For local models, deterministic code should do obvious work:

- inspect package manifests
- identify common entry files
- detect scripts
- list top-level directories
- read obvious files
- summarize known framework signals
- detect likely package manager
- detect whether the project is frontend, backend, full-stack, CLI, or library

Do not ask the model to guess what deterministic code can compute.

## 5.5 Keep local hardware in mind

Target machine:

- Linux
- 16 GB RAM
- Ollama local models
- CPU/iGPU performance
- slow long-context generation

Therefore:

- avoid large context by default
- avoid huge tool lists
- avoid long planner loops
- avoid unnecessary repo-wide scans
- avoid large diffs in prompts
- avoid huge session memory
- avoid high retry counts
- avoid loading multiple models by default
- avoid default network calls
- avoid default multimodal/image-heavy payloads

## 5.6 Type and schema migrations must be deliberate

When changing shared types, update all consumers in the same milestone.

Shared areas include:

- API payload types
- web run types
- session metadata types
- planner types
- engine config types
- tool trace event types
- CLI JSON output shapes
- tests and mocks

Do not leave stale fields in one package because “it still compiles.”

## 5.7 Backward compatibility must not preserve bad defaults

If old API callers use `agentic` booleans, support them only as compatibility mapping.

Compatibility rules:

- missing mode means `chat`
- `agentic: true` means `agent`
- `agentic: false` means `chat`
- `mode: "agent"` takes precedence over legacy fields
- API response should use modern `executionMode: "chat" | "agent"`
- legacy `executionMode: "direct" | "agentic"` may appear only in migration adapters, never as the public final contract

Do not keep `agentic !== false` logic.

## 5.8 Security and privacy rules

- No writes outside workspace root.
- No execute outside workspace root.
- No shell operators unless explicitly approved and safely parsed.
- No web access unless explicitly enabled or requested.
- No raw secrets in logs, traces, UI, session files, or final summaries.
- No accidental reading of `.env`, key files, or credential stores unless the user explicitly asks and policy allows it.
- No generated/vendored/harness-internal directories in broad scans by default.
- Redact likely tokens, keys, passwords, connection strings, and authorization headers from all UI/session/trace outputs.
- Never show full environment variables by default.

## 5.9 Canonical ignore list

All broad walking, search, indexing, context-packing, and fixture scans must share a canonical ignore list.

At minimum ignore:

```txt
.git
.gamma-harness
.next
.nuxt
.cache
.turbo
.vite
.playwright
.playwright-cli
node_modules
dist
build
coverage
base_repos
third_party
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
```

If a tool needs one of these paths, it must be explicitly requested by the user and must pass workspace policy.

## 5.10 Public event contract

Public API/UI/CLI events should use stable mode names:

```txt
chat
agent
inspect_project
full_audit
```

Avoid exposing internal legacy labels as public UX:

```txt
direct
agentic
repo_wide_audit
architecture_change
```

Internal code may keep temporary adapters during migration, but tests must enforce the final public names.

---

# 6. Validation commands

Use these commands as standard validation:

```bash
npm run build:packages
npm run build:apps
npm test
```

Layer-specific validation:

```bash
node --import tsx tests/unit/core.test.ts
node --import tsx tests/integration/workflow.test.ts
node --import tsx tests/e2e/api.test.ts
node --import tsx tests/e2e/cli.test.ts
```

After UI changes:

```bash
npm run build --workspace web
```

After API changes:

```bash
npm run build --workspace @local-harness/api
```

After CLI changes:

```bash
npm run build --workspace @local-harness/cli
node --import tsx tests/e2e/cli.test.ts
```

Manual local smoke tests:

```bash
ollama ps
harness chat
harness inspect
harness agent
```

If a command fails, document:

- command run
- failure output
- likely cause
- whether failure is related to the current milestone

---

# 7. File path correction note

Verify real file paths before editing.

The web app path in this branch may use:

```txt
apps/web/src/app/HarnessApp.tsx
```

not:

```txt
apps/web/src/HarnessApp.tsx
```

Do not guess paths from older docs. Use `git ls-files` or `find` first.

Tests should protect the real path so future repo-indexing logic does not drift.

---

# 8. Ten-milestone recovery plan

## Milestone 01 — Replace misleading instructions and lock recovery direction

### Urgency

Critical.

The current instruction file encourages the old overbuilt architecture. This must be fixed first because future agents follow this file.

### Goal

Make `AGENTS.md` the recovery playbook for a lightweight harness.

### Files to inspect

- `AGENTS.md`
- `package.json`
- `packages/core/src/engine.ts`
- `packages/task-orchestrator/src/index.ts`
- `apps/api/src/server.ts`
- `apps/cli/src/cli.ts`
- `apps/web/src/app/HarnessApp.tsx`

### Tasks

1. Replace the old completion ledger with this recovery file.
2. Remove language that says smart-agent tooling and model routing are complete goals.
3. Add a clear rule that Chat Mode is default.
4. Add a clear rule that Agent Work is explicit.
5. Add a clear rule that one active model is default.
6. Add a clear rule that project inspection is lightweight, not repo-wide audit.
7. Add a clear rule that advanced tools are gated.
8. Remove all hardcoded temporary experiment names from docs/tests/prompts.
9. Add validation commands to the file.
10. Record the recovery branch name.
11. Add the canonical ignore/security rules from this file.
12. Add the public event contract from this file.

### Acceptance criteria

- `AGENTS.md` no longer mentions the old architecture as the direction to preserve.
- No “completion ledger” tells agents the overbuilt state is final.
- The first page of `AGENTS.md` clearly states vulnerabilities and urgency.
- A new agent can understand the recovery goal without reading prior conversations.
- Security, ignore-list, and event-contract rules are present.

### Validation

```bash
git diff -- AGENTS.md
npm run build:packages
npm run build:apps
```

### Completion status

Done on 2026-05-14.

Evidence:

- Recovery branch and lightweight harness direction are recorded in this file.
- Temporary experiment names were removed from tests.
- Stale web path candidates were corrected to `apps/web/src/app/HarnessApp.tsx`.
- Repo-indexer ignore and secret-file exclusions were hardened.
- `npm run build:packages` passed.
- `npm run build:apps` passed.

---

## Milestone 02 — Make Chat Mode and Agent Work truly separate

### Urgency

Critical.

The current API and CLI can run agentic workflows by default. That is the main reason normal use feels slow and confusing.

### Goal

Create a real mode contract across API, CLI, web, engine, session metadata, and tests.

### Files to inspect

- `apps/api/src/server.ts`
- `apps/cli/src/cli.ts`
- `apps/web/src/app/HarnessApp.tsx`
- `packages/core/src/engine.ts`
- `packages/session-store/src/types.ts`
- `tests/e2e/api.test.ts`
- `tests/e2e/cli.test.ts`
- `tests/unit/core.test.ts`

### Required API behavior

- Default request mode is Chat Mode.
- Agent Work requires `mode: "agent"` or legacy `agentic: true`.
- Response includes `executionMode: "chat" | "agent"`.
- Streaming and non-streaming endpoints use the same mode parser.
- Missing mode never means Agent Work.
- Direct/chat streaming must not emit agent run events unless a file-read context action was explicitly requested.

### Required CLI behavior

- `harness chat` opens Chat Mode.
- `harness agent` opens Agent Work.
- `harness prompt` defaults to Chat Mode unless `--agent` is provided.
- Interactive startup clearly shows selected mode.
- Normal CLI chat does not call the agent planner.
- Thinking output is hidden unless `--show-thinking` is passed.

### Required web behavior

- Clear top-level mode switch: `Chat` and `Agent Work`.
- Chat Mode hides Run Console and agent panels.
- Agent Work shows activity panel.
- Mode state is saved intentionally, not hidden in old `agentic` naming.
- `localStorage` keys should be renamed from agentic-centric names to neutral mode names.

### Required engine behavior

Provide or normalize explicit methods/options:

```ts
directChat(...)
agentWork(...)
chatStream(..., { mode: 'chat' | 'agent' })
```

Do not infer agent mode from missing fields.

### Tasks

1. Replace `body.agentic !== false` with explicit mode parsing.
2. Make default mode `chat`.
3. Update streaming and non-streaming endpoints consistently.
4. Update CLI command routing.
5. Update web request payloads.
6. Update session metadata language where needed.
7. Keep legacy compatibility only if it does not preserve bad defaults.
8. Add tests proving Chat Mode does not create task plans.
9. Add tests proving Agent Work creates a lightweight plan.
10. Update UI labels from `direct/agentic` to `Chat/Agent Work`.
11. Add a single shared mode parser used by both `/api/chat` and `/api/chat/stream`.
12. Add tests proving stream and non-stream behavior match.

### Acceptance criteria

- Normal chat never creates `task_plan_created`.
- Normal CLI chat never runs Agent Work.
- Agent Work is explicitly selected.
- Web mode is visually obvious.
- Tests fail if Agent Mode becomes default again.
- `direct` / `agentic` are no longer public UX names.

### Validation

```bash
npm run build:packages
npm run build:apps
node --import tsx tests/unit/core.test.ts
node --import tsx tests/e2e/api.test.ts
node --import tsx tests/e2e/cli.test.ts
```

### Completion status

Done on 2026-05-14.

Evidence:

- API mode parsing defaults to `chat` and maps legacy `agentic` only for compatibility.
- CLI `prompt` defaults to Chat Mode; Agent Work requires `--agent` or `harness agent`.
- Web mode state uses a neutral mode key and sends `mode: "chat" | "agent"`.
- Public execution metadata uses `chat` and `agent`.
- `node --import tsx tests/unit/core.test.ts` passed.
- `node --import tsx tests/e2e/api.test.ts` passed.
- `node --import tsx tests/e2e/cli.test.ts` passed.

---

## Milestone 03 — Restore lightweight project inspection as a first-class path

### Urgency

Critical.

The earlier working behavior came from simple deterministic project inspection. That must be restored and protected.

### Goal

Add `inspect_project` and `inspectProject()`.

### Files to inspect

- `packages/core/src/engine.ts`
- `packages/task-orchestrator/src/index.ts`
- `packages/repo-indexer/src/indexer.ts`
- `packages/tool-runtime/src/registry.ts`
- `tests/unit/core.test.ts`
- `tests/integration/workflow.test.ts`

### Required behavior

When the user asks:

```txt
Inspect the current project and tell me what kind of app it is.
What kind of project is this?
Look at this workspace and explain the stack.
Tell me how this app is structured.
```

The system must use lightweight inspection, not repo-wide audit.

### `inspectProject()` should inspect

- `package.json`
- `README.md`
- `server.js`
- `app.js`
- `index.js`
- `main.js`
- `src/index.*`
- `src/main.*`
- `src/App.*`
- `views/`
- `public/`
- `vite.config.*`
- `next.config.*`
- `tsconfig.json`
- common lockfiles

### Output should include

- project name
- likely project type
- framework/library signals
- backend/frontend signals
- main entry points
- view/static directories
- package scripts
- package manager
- how to run
- obvious missing files
- next recommended check

### Forbidden classifications for simple inspection

Do not classify simple inspection as:

```txt
repo_wide_audit
architecture_change
multi_file
small_patch
```

### Tasks

1. Add `TaskIntent` or equivalent: `inspect_project`.
2. Add deterministic `inspectProject()` in core or repo-indexer.
3. Route simple project-inspection requests to `inspect_project`.
4. Keep `full_audit` only for explicit whole-repo audit requests.
5. Add a generic fixture project for tests.
6. Remove hardcoded temporary experiment names from tests.
7. Add tests for Express/EJS-like generic fixture detection.
8. Add tests for Vite/React-like generic fixture detection if simple.
9. Ensure no edit tools are exposed during inspect-only mode.
10. Ensure no checkpoint is created during inspect-only mode.
11. Ensure no web tool is exposed during inspect-only mode.
12. Ensure inspect output is deterministic and useful even if model call fails.

### Acceptance criteria

- Simple project inspection returns through a lightweight path.
- No repo-wide audit occurs unless explicitly requested.
- No advanced tools are used for basic project inspection.
- No web tools are used.
- Tests protect this behavior.

### Validation

```bash
npm run build:packages
node --import tsx tests/unit/core.test.ts
node --import tsx tests/integration/workflow.test.ts
```

### Completion status

Done on 2026-05-14.

Evidence:

- `inspect_project` is now a first-class intent.
- `inspectProject()` produces deterministic project summaries from obvious local files.
- Simple project-inspection prompts avoid repo-wide audit, model calls, checkpoints, and edit tools.
- Generic Express and Vite-style inspection tests protect the behavior.
- `node --import tsx tests/unit/core.test.ts` passed.
- `node --import tsx tests/integration/workflow.test.ts` passed.

---

## Milestone 04 — Simplify the task orchestrator and planner

### Urgency

Critical.

The current planner is too rigid. It can force the agent into fixed workflows that are inappropriate for small local tasks.

### Goal

Replace rigid task templates with a flexible, lightweight plan model.

### Files to inspect

- `packages/task-orchestrator/src/index.ts`
- `packages/planner/src/planner.ts`
- `packages/planner/src/types.ts`
- `packages/core/src/engine.ts`
- `tests/unit/core.test.ts`

### New intent set

Use a small set:

```ts
type TaskIntent =
  | 'chat'
  | 'inspect_project'
  | 'inspect_file'
  | 'search_project'
  | 'edit_file'
  | 'run_command'
  | 'summarize_changes'
  | 'full_audit';
```

### New plan shape

```ts
interface LightweightPlan {
  id: string;
  mode: 'chat' | 'agent';
  intent: TaskIntent;
  goal: string;
  status: 'pending' | 'running' | 'blocked' | 'safe_idle' | 'done' | 'failed';
  steps: LightweightPlanStep[];
  currentStepId?: string;
  evidence: string[];
  nextAction?: string;
  stopCondition: string;
  revisedAt?: number;
}
```

### Plan rules

- Chat Mode does not create plans.
- Agent Work creates short plans.
- Plans can be revised.
- Plan steps are not marked complete until real work happens.
- Inspection can stop once enough evidence exists.
- Full audit only runs when explicitly requested.
- Denied approvals transition to `blocked` or `safe_idle`, not silent pending.
- Planning must guide work; it must not trap the agent.

### Tasks

1. Remove or gate rigid `architecture_change`, `multi_file`, and `repo_wide_audit` templates.
2. Replace broad `TaskComplexity` with simple intent plus optional size estimate.
3. Remove stale fields like `executionProfile` and `promptProfile`.
4. Add clear stop conditions.
5. Add evidence tracking.
6. Add plan revision support.
7. Ensure plan events are small and structured.
8. Update UI types.
9. Update tests.
10. Delete tests that encode old heavy classification.
11. Make `run_command` its own intent, not a write intent.
12. Make `workspace_overview` inspect-related only when workspace evidence is needed.

### Acceptance criteria

- Simple tasks have simple plans.
- `inspect_project` has a short plan or deterministic path.
- `run_command` is not treated as write intent.
- `architecture_change` is not triggered by ordinary words.
- Tests fail if project inspection becomes repo-wide audit again.

### Validation

```bash
npm run build:packages
node --import tsx tests/unit/core.test.ts
```

### Completion status

DONE - 2026-05-18.

- `TaskComplexity` runtime contract replaced with intent plus size estimate in planner/orchestrator/API/web test surfaces.
- Planner tracks stop condition, evidence, revision state, and `safe_idle`.
- Classifier no longer routes ordinary architecture/file names to old heavy templates; `run_command` stays separate from edit intent.
- Verified by `npm test` and `git diff --check`.

---

## Milestone 05 — Reduce default tools and gate advanced tools

### Urgency

Critical.

Too many default tools confuse local models and increase failure rates.

### Goal

Create small default tool sets by mode and intent.

### Files to inspect

- `packages/core/src/engine.ts`
- `packages/tool-runtime/src/registry.ts`
- `packages/tool-runtime/src/types.ts`
- `packages/task-orchestrator/src/index.ts`
- `tests/integration/workflow.test.ts`

### Default Chat Mode tools

None.

Optional explicit file-read only if user chooses file context.

### Default Agent Work tools

Use only:

```txt
listDir
readFile
searchText
writeFile
patchFile
runCommand
gitStatus
gitDiff
```

### Inspect Project tools

Use only:

```txt
listDir
readFile
searchText
```

### Advanced tools

Gate behind Advanced Agent Mode:

```txt
glob
webSearch
fetchUrl
findSymbol
findFunction
findComponent
whatDoesThisImport
whoImports
affectedFiles
selectTestsForChangedFiles
detectProjectCommands
buildContextPack
replaceFunction
insertImport
addTypeProperty
renameIdentifier
replaceRange
insertAfter
insertBefore
replaceBlock
applyUnifiedPatch
previewPatch
getStructuredDiff
createCheckpoint
rollbackToCheckpoint
```

### Tool naming rule

Pick one canonical external name style and normalize all traces/UI/tests to it.

Recommended external/public names:

```txt
listDir
readFile
searchText
writeFile
patchFile
runCommand
gitStatus
gitDiff
```

Runtime may internally map to snake_case, but API/UI/test contracts must be consistent.

### Tasks

1. Introduce tool profiles: `chat`, `inspect`, `edit-basic`, `verify`, `advanced`.
2. Make tool exposure depend on mode and intent.
3. Remove web tools from default local coding path.
4. Remove AST/import tools from default path.
5. Keep write tools approval-gated.
6. Make advanced mode explicit in UI/API/CLI.
7. Normalize tool naming.
8. Add tests for tool selection.
9. Add tests that Chat Mode exposes no tools.
10. Add tests that `inspect_project` exposes only read tools.
11. Add tests that advanced tools are absent until Advanced Agent Mode.
12. Add tests for canonical tool naming in traces and UI events.

### Acceptance criteria

- Small local model sees fewer tools.
- Chat Mode has no tool list.
- Inspect mode cannot edit.
- Advanced tools never appear unless Advanced Agent Mode is selected.
- Web tools never appear unless user asks for web or enables web intent.

### Validation

```bash
npm run build:packages
node --import tsx tests/unit/core.test.ts
node --import tsx tests/integration/workflow.test.ts
```

### Completion status

DONE - 2026-05-18.

- Tool profiles now gate Chat, inspect, basic edit/verify, and advanced tools.
- Chat Mode exposes no tools; inspect stays read-only; web/search and AST/checkpoint/diff advanced tools require explicit advanced Agent Work.
- API rejects invalid `advancedTools` payloads.
- Verified by unit/integration/API e2e coverage plus `npm test` and `git diff --check`.

---

## Milestone 06 — Rebuild web UI around clarity

### Urgency

Critical.

The current UI is too cluttered and makes the user feel lost.

### Goal

Create a simple two-mode web interface.

### Files to inspect

- `apps/web/src/app/HarnessApp.tsx`
- `apps/web/src/index.css`
- `apps/web/src/components/ChatMessageRow.tsx`
- `apps/web/src/components/AgentRunSummary.tsx`
- `apps/web/src/components/run-console/RunConsole.tsx`
- `apps/web/src/components/run-console/CurrentTaskCard.tsx`
- `apps/web/src/components/run-console/ToolCallList.tsx`
- `apps/web/src/components/run-console/TaskPlanView.tsx`

### Required layout

Main screen:

- top mode switch:
  - Chat
  - Agent Work
- small status:
  - active model
  - workspace root
  - workspace source
  - permission mode
  - internet access state
- center:
  - conversation/results
- Agent Work side panel:
  - Goal
  - Now
  - Files inspected
  - Files changed
  - Checks
  - Blocked reason
  - Final result

### Hide by default

- context budget
- structured diff
- raw diff
- checkpoint IDs
- full traces
- tool payloads
- why-file-selected cards
- provider thinking
- advanced model details
- skill audit internals

### Advanced Details

Advanced Details may show:

- raw traces
- structured diff
- raw diff
- context budget
- checkpoint IDs
- full tool input/output preview
- runtime capabilities
- skill audit internals

### Tasks

1. Rename UI language from `direct/agentic` to `Chat/Agent Work`.
2. Hide Run Console in Chat Mode.
3. Replace Run Console default with a minimal Agent Activity panel.
4. Move raw diff and structured diff behind Advanced Details.
5. Move checkpoint IDs behind Advanced Details.
6. Remove hardcoded file-specific explanation helpers.
7. Remove “Deep Agent” / “autonomous” wording.
8. Make empty states clear.
9. Ensure blocked/failed/safe-idle state is visible.
10. Add UI build validation.
11. Rename localStorage keys away from agentic-centric names.
12. Ensure browser snapshot mode is visibly read-only until backend binding is confirmed.

### Acceptance criteria

- A new user can understand the UI in 10 seconds.
- Chat Mode looks like chat.
- Agent Work shows useful progress but not internal clutter.
- Advanced details are optional.
- No old model-router UI remains.
- Workspace source is visible.

### Validation

```bash
npm run build --workspace web
npm run build:apps
```

### Completion status

DONE - 2026-05-18.

- Web UI keeps Chat and Agent Work as public mode language.
- Top status shows model, workspace, permission mode, and internet state.
- Agent Activity shows goal, now, files inspected, files changed, checks, blocked state, result, and workspace binding.
- Raw diff, structured diff, checkpoint IDs, context budget, plan files, tool output, and verification output are collapsed under Advanced Details.
- Default prompts no longer push deep/autonomous workflows.
- Verified by `npm run build --workspace web`, `npm run build:apps`, `npm test`, and `git diff --check`.

---

## Milestone 07 — Rebuild CLI around clear mode selection

### Urgency

High.

CLI must be the simplest reliable operator interface.

### Goal

Make CLI commands explicit and clean.

### Files to inspect

- `apps/cli/src/cli.ts`
- `tests/e2e/cli.test.ts`

### Required commands

```bash
harness chat
harness agent
harness inspect
harness status
harness config
harness model
harness workspace
```

### Chat behavior

- No planner.
- No tools by default.
- No thinking printed unless `--show-thinking`.
- No run summary unless needed.
- Fast direct response.

### Agent behavior

Shows:

- goal
- plan
- current action
- tool start/done
- blocked/failed/safe-idle reason
- final summary

Does not show raw traces unless `--verbose`.

### Inspect behavior

```bash
harness inspect
```

Runs lightweight project inspection.

### Tasks

1. Make `harness chat` use Chat Mode.
2. Make `harness prompt` default to Chat Mode.
3. Add `--agent` flag for one-shot Agent Work.
4. Add `harness agent` interactive flow.
5. Add `harness inspect`.
6. Hide thinking unless requested.
7. Simplify help output.
8. Add command examples.
9. Update CLI tests.
10. Ensure denied approvals do not freeze CLI.
11. Ensure `/status` or `harness status` reports public `chat` / `agent` names, not legacy names.
12. Ensure session list does not imply turn history is loaded when it is not.

### Acceptance criteria

- CLI startup does not say `Execution: agentic` unless Agent Work is selected.
- `harness prompt "hello"` does not create a task plan.
- `harness inspect` produces project structure summary.
- CLI help is readable.
- Thinking output is hidden by default.

### Validation

```bash
npm run build --workspace @local-harness/cli
node --import tsx tests/e2e/cli.test.ts
```

### Completion status

DONE - 2026-05-18.

- CLI help now states Chat Mode default and Agent Work only via `harness agent` or `harness prompt --agent`.
- `harness prompt` defaults to Chat; `--agent` and `--advanced-tools` are explicit.
- Interactive CLI startup uses public `Chat` / `Agent Work` labels and condensed help groups.
- `harness inspect` remains lightweight project inspection.
- Verified by `npm run build --workspace @local-harness/cli`, `node --import tsx tests/e2e/cli.test.ts`, `npm test`, and `git diff --check`.

---

## Milestone 08 — Compact session memory and run summaries

### Urgency

High.

The harness should remember orientation, not huge histories.

### Goal

Make session memory small and useful.

### Files to inspect

- `packages/session-store/src/types.ts`
- `packages/session-store/src/store.ts`
- `packages/core/src/agent-run.ts`
- `packages/core/src/engine.ts`

### Compact turn summary

Store this in session turn history:

```ts
interface CompactRunSummary {
  runId: string;
  mode: 'chat' | 'agent';
  intent: string;
  goal?: string;
  outcome: 'done' | 'blocked' | 'safe_idle' | 'failed';
  filesRead: string[];
  filesChanged: string[];
  commandsRun: string[];
  approvals: number;
  summary: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}
```

Do not store full:

- structured diffs
- raw diffs
- full trace arrays
- full tool outputs
- full web fetch text
- huge model responses
- raw secrets
- full image payloads

### Tasks

1. Add compact run summary type.
2. Keep full run files separate and bounded.
3. Store only compact summary in session turn metadata.
4. Add max turn history count or truncation.
5. Add max summary lengths.
6. Add max files remembered.
7. Deduplicate diff/file-change metadata.
8. Add tests for memory size.
9. Add tests for loading old sessions.
10. Ensure session list stays fast.
11. Add migration adapter for old `runSummary?: AgentRun`.
12. Add redaction before any run/session text is persisted.

### Acceptance criteria

- Session JSONL remains small.
- Session listing does not load full turns.
- Resuming a session gives useful orientation.
- Large diffs do not enter prompt memory.
- Old sessions load safely without preserving old heavy behavior.

### Validation

```bash
npm run build:packages
node --import tsx tests/integration/workflow.test.ts
```

### Completion status

DONE - 2026-05-18.

- Session turn metadata now stores compact `CompactRunSummary` objects instead of full `AgentRun` payloads.
- Session JSON keeps turn history out of the main file; JSONL turns are sanitized, bounded, and redacted.
- Old heavy `runSummary?: AgentRun` records are migrated on load without preserving raw diffs, full answers, traces, or secret-like text.
- Structured diff file metadata is deduplicated before run summaries are produced.
- Verified by `npm run build`, `node --import tsx tests/integration/workflow.test.ts`, `npm test`, and `git diff --check`.

---

## Milestone 09 — Fix local model runtime budgets and stall handling

### Urgency

High.

The harness must behave well on a 16 GB machine.

### Goal

Make model runtime behavior conservative and visible.

### Files to inspect

- `packages/model-adapter/src/client.ts`
- `packages/model-adapter/src/config.ts`
- `packages/model-adapter/src/types.ts`
- `packages/core/src/engine.ts`
- `apps/api/src/server.ts`
- `apps/web/src/app/HarnessApp.tsx`

### Required runtime policy

Default profile:

```txt
Local Balanced
```

Recommended settings:

```txt
contextBudget: 12000-16000
max output: conservative
toolRetryMax: 1 or 2
stream idle timeout: visible
sessionMemoryTurns: 2 or 3
```

### Tasks

1. Review token budget logic for Gemma, Qwen, and DeepSeek.
2. Remove misleading comments about raising token ceilings if code caps them.
3. Avoid forcing huge `num_predict` values.
4. Add clear runtime status.
5. Add stall timeout state.
6. Add visible “model is loading” status.
7. Add visible “stream stalled” failure.
8. Do not retry forever.
9. Add tests for timeout behavior if possible.
10. Add live manual smoke test instructions.
11. Ensure no UI preset defaults to internet on unless explicitly desired.
12. Ensure model lifecycle actions do not unload/reload multiple models unless explicitly requested.

### Acceptance criteria

- Default settings are safe for 16 GB RAM.
- A stalled model fails visibly.
- User can see configured model and active model.
- Runtime status does not imply multiple active agents/models.
- Presets do not push user toward deep/autonomous defaults.

### Validation

```bash
npm run build:packages
node --import tsx tests/unit/core.test.ts
```

Manual smoke:

```bash
ollama ps
harness chat
harness inspect
harness agent
```

### Completion status

DONE - 2026-05-18.

- Default runtime profile is Local Balanced with `contextBudget: 16000`, `toolRetryMax: 2`, and `sessionMemoryTurns: 3`.
- Gemma, Qwen, and DeepSeek local output budgets are capped conservatively instead of forcing huge `num_predict` values.
- Runtime status now reports configured/active model state and visible loading/stall states.
- Model activation preloads the requested model without unloading other running models.
- UI presets keep internet access off by default and avoid deep/autonomous defaults.
- Smoke checked `ollama ps`, `node apps/cli/dist/cli.js status --json`, `node apps/cli/dist/cli.js inspect --json`, `/api/config`, and `/api/model/runtime`.
- Verified by `npm run build`, `node --import tsx tests/unit/core.test.ts`, `npm test`, and `git diff --check`.

---

## Milestone 10 — Add regression tests that protect the lightweight harness

### Urgency

Critical.

Tests must prevent the same failure from returning.

### Goal

Make the test suite enforce the new product behavior.

### Files to inspect

- `tests/unit/core.test.ts`
- `tests/integration/workflow.test.ts`
- `tests/e2e/api.test.ts`
- `tests/e2e/cli.test.ts`
- `tests/mocks/model-responses.ts`

### Required tests

1. Chat Mode does not create task plans.
2. API defaults to Chat Mode.
3. CLI prompt defaults to Chat Mode.
4. Agent Work requires explicit mode.
5. `inspect_project` does not become `repo_wide_audit`.
6. Generic fixture project inspection works.
7. No temporary experiment folder names exist in tests.
8. Chat Mode exposes no tools.
9. Inspect Project exposes only read tools.
10. Advanced tools require Advanced Agent Mode.
11. Web config exposes one model field.
12. No `fastModel/codingModel/reviewModel/apiModel` fields exist.
13. Planner does not include stale `executionProfile/promptProfile`.
14. Session memory stores compact summaries only.
15. Denied approval ends cleanly.
16. Safe command denial is visible.
17. UI build passes.
18. CLI help contains Chat and Agent Work clearly.
19. Project inspection avoids checkpoints.
20. Full audit only runs when user asks for full audit.
21. Browser snapshot cannot write unless resolved to backend workspace.
22. Web tools are absent from default tool profiles.
23. Generated and vendored directories are ignored during broad file walking.
24. Mode parser maps legacy `agentic` safely without making Agent Work the default.
25. Raw diff and structured diff are hidden by default in UI state/render tests where possible.
26. Stream and non-stream `/api/chat` endpoints use the same mode parser.
27. Legacy `direct` / `agentic` are not public API/UX mode names after migration.
28. Actual web app path is verified in repo-indexer candidates.
29. Secret-like files are excluded from broad read/search/context paths.
30. Session persistence redacts likely secrets and does not persist full image payloads.
31. `harness inspect` works without model success if deterministic inspection is enough.
32. A denied approval transitions the run to `blocked` or `safe_idle`.
33. A stalled stream emits a visible stalled/failed state.
34. Tool trace names are normalized to one public naming convention.
35. No default preset uses “Deep Agent” or “autonomous” language.

### Test fixture names

Use generic fixture names only:

```txt
fixtures/sample-express-app
fixtures/sample-vite-app
fixtures/sample-node-cli
```

Do not use user experiment names.

### Acceptance criteria

- Tests fail if Agent Mode becomes default.
- Tests fail if project inspection routes to repo-wide audit.
- Tests fail if model role routing returns.
- Tests fail if temporary experiment names return.
- Tests fail if stale web app paths return.
- Full `npm test` passes.

### Validation

```bash
npm run build
npm test
```

### Completion status

DONE - 2026-05-18.

- Added/updated regression coverage for compact session memory, old-session migration, redaction, bounded run summaries, local output caps, no-unload model lifecycle, stream stall fallback, and safe runtime defaults.
- Updated API, CLI, integration, and unit tests to enforce the lightweight harness contract.
- Full validation passed: `npm test`.
- Whitespace validation passed: `git diff --check`.

---

# 9. Implementation order

Follow this order unless the user explicitly changes it:

1. Milestone 01 — Replace instructions.
2. Milestone 02 — Separate Chat and Agent Work.
3. Milestone 03 — Restore lightweight project inspection.
4. Milestone 04 — Simplify planner/orchestrator.
5. Milestone 05 — Reduce tool exposure.
6. Milestone 10 — Add regression tests for the above early.
7. Milestone 06 — Simplify web UI.
8. Milestone 07 — Simplify CLI.
9. Milestone 08 — Compact session memory.
10. Milestone 09 — Runtime budgets and stall handling.
11. Final full validation.

Milestone 10 is listed last as a plan milestone, but its tests should be added throughout the work. Do not wait until the end to add all tests.

---

# 10. Forbidden regressions

Do not reintroduce:

- Agent Mode as default
- `fastModel`
- `codingModel`
- `reviewModel`
- `apiModel`
- automatic per-purpose model routing
- `executionProfile`
- `providerProfile`
- `promptProfile`
- hidden Agent Work inside Chat Mode
- hidden Chat Mode inside Agent Work
- project inspection as `repo_wide_audit`
- temporary experiment names in tests
- advanced AST/import tools in default tool list
- web tools in default local coding path
- raw diff open by default
- structured diff open by default
- thinking blocks printed by default
- full run summaries stored in session turn history
- giant trace dumps in default UI
- “Deep Agent” / “autonomous” default product language
- false “done” labels before validation
- browser snapshot writes without backend binding
- silent approval hangs
- silent model stall hangs
- full-audit behavior from ordinary project inspection
- stale path assumptions in repo-indexer or tests
- raw secret persistence in sessions, traces, or UI
- tool names drifting between API/UI/runtime/tests
- web access enabled by default for local coding
- skills silently expanding mode/tool capabilities

---

# 11. Definition of done

The recovery is complete only when all of the following are true:

- Chat Mode is default in API, CLI, and web.
- Agent Work is explicit.
- One active model is used by default.
- `gemma4:e4b` remains the safe default.
- Project inspection has a lightweight deterministic path.
- Simple project inspection does not trigger repo-wide audit.
- Default tool list is small.
- Advanced tools are gated.
- Web tools are not default.
- Web UI is clean and understandable.
- CLI is clean and understandable.
- Session memory is compact.
- Runtime stalls are visible.
- Denied approvals end cleanly.
- Browser snapshot vs backend workspace is clear.
- Workspace rebind never happens silently when ambiguous.
- Secrets are excluded/redacted by default.
- Tool naming is consistent across API/UI/runtime/tests.
- Tests protect all of the above.
- `npm test` passes.

---

# 12. Final operator standard

The harness should feel like this:

- Chat is fast and clean.
- Agent Work is deliberate and visible.
- Inspect Project is fast and useful.
- The model is not overwhelmed with tools.
- The UI does not look like a debug cockpit.
- The CLI does not surprise the user.
- Memory helps orientation but does not bloat.
- Failures are honest and visible.
- Workspace truth is obvious.
- The system does not pretend to be more autonomous than it is.

If a change makes the harness more impressive but less usable on Hunde’s laptop, reject the change.
