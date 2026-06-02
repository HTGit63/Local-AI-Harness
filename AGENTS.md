# AGENTS.md — Web-First Local AI Harness Recovery Plan

> Repository: `HTGit63/Local-AI-Harness`  
> Active branch: `rescue/lightweight-harness-reset`  
> Primary user surface: Web UI  
> Hardware target: local Linux machine, 16 GB RAM, assume about 14 GB usable, CPU-first, no GPU assumption  
> Primary model target: Gemma 4 E4B only  
> Preferred local runtime target: `llama.cpp` server with quantized GGUF models  
> Future model target: Gemma 4 26B quantized as optional maximum-intelligence / hardcore mode only after the stable E4B harness is complete

---

## 0. Read This First

This file replaces the current `AGENTS.md` direction.

The project must stop behaving like a terminal agent with a web page attached. The goal is a **web-first local AI harness** where the Web UI is the control center, deterministic tools are instant, and the AI model is used only when reasoning, explanation, planning, or editing truly requires it.

The harness must be useful even when the model is off.

That sentence is the main product rule.

If a task can be completed by deterministic code, do not call the model. File browsing, file opening, search, git status, package-script reading, workspace metadata, and terminal-output display must be handled directly by the backend and surfaced immediately in the Web UI.

---

## 1. Current Strategic Decision

The system is being rebuilt around these priorities:

1. **Fast deterministic tools first**
2. **Web UI control center second**
3. **Permission/sandbox system third**
4. **llama.cpp + Gemma 4 E4B runtime fourth**
5. **Agent brain fifth**
6. **Evaluation/verification loop sixth**
7. **Project memory last**

Do not start by adding more agent intelligence. Do not start by adding more tools to the model. Do not start by adding 26B support. Do not start by improving memory. The bottleneck is that simple work is currently routed through too much agent machinery.

---

## 2. Non-Negotiable Constraints

### 2.1 Hardware Constraints

The target device is a local Linux machine with 16 GB RAM, with about 14 GB expected to be practically available. All defaults must assume CPU-first inference and no GPU.

The system must not assume:

- CUDA
- vLLM
- multi-GPU serving
- large server memory
- large context windows by default
- parallel heavy agent runs
- 26B model availability during the stable-harness phase

### 2.2 Model Constraints

The only primary model for the stable harness is:

```text
gemma4:e4b
```

When using `llama.cpp`, the UI may still label the model as `gemma4:e4b`, but the runtime alias may need to be something like `gemma4-e4b` depending on the server launch command. Keep the user-facing model identity clear: **Gemma 4 E4B only for now**.

Do not add automatic model routing. Do not bring back separate role-based model names such as:

```text
fastModel
codingModel
reviewModel
apiModel
```

A future manual “maximum intelligence” mode may use Gemma 4 26B quantized, but it is out of scope until the stable E4B harness passes all milestone acceptance checks.

### 2.3 Runtime Constraints

`llama.cpp` server is the preferred local runtime target. Ollama may remain as a legacy/optional provider, but the harness must not be architecturally dependent on Ollama.

Runtime support must be provider-based:

```text
provider: llama.cpp | ollama-legacy | openai-compatible-custom
```

The stable path must focus on:

```text
llama.cpp server → OpenAI-compatible endpoint → Gemma 4 E4B quantized GGUF
```

Do not use vLLM for the current local setup. vLLM is a future GPU/server path, not a 16 GB CPU-first laptop path.

### 2.4 Web UI Constraint

The Web UI is the product surface. The CLI may exist, but it must not define the product architecture.

Every core operation must be visible and controllable from the Web UI:

- workspace selection
- folder browsing
- file viewing
- search
- git status
- git diff
- model/runtime status
- deterministic tool logs
- agent run timeline
- approvals
- diff review
- terminal output
- stop/cancel
- rollback/checkpoint visibility

### 2.5 Speed Constraint

Deterministic operations must not call the model.

Targets:

| Operation | Target |
|---|---:|
| List root folder | < 200 ms |
| Read normal small/medium file | < 100 ms |
| Git status | < 500 ms |
| Search normal repo | < 2 sec |
| Deterministic operation | 0 model calls |
| Tool result UI update | immediate after tool completes |
| Agent loop | bounded, no endless loops |
| Context pack | visible token/char budget |

If these targets are not met, fix deterministic routing before improving the agent.

---

## 3. Repo-Specific Findings and Required Corrections

The current repo already has useful pieces, but they are in the wrong priority order.

### 3.1 Keep These Existing Strengths

Keep and strengthen:

- workspace APIs for listing, reading, searching, writing, patching, git status, and git diff
- direct backend tool paths for file/folder/git/search operations
- explicit `chat` vs `agent` execution mode concept
- `inspect_project` intent and bounded task plans
- permission boundary that denies paths outside the workspace root
- run timeline and trace concepts, but simplify their default presentation
- structured diff support, but hide raw structured internals by default
- session persistence, but keep it compact
- approval queue, but reduce approval spam through scoped trusted modes

### 3.2 Remove or De-emphasize These Problem Areas

Remove or de-emphasize:

- Ollama-first product language
- old “Gamma 4 Harness API” naming if it confuses the product direction
- default-heavy agent paths for simple questions
- broad automatic repo context injection
- giant tool exposure to local models
- advanced AST/import/diff/checkpoint tools in default agent mode
- visible raw traces and raw structured diff panels by default
- hidden model calls for file browsing/search/git status
- old model-role concepts such as fast/coding/review model routing
- web search/fetch tools as default coding tools
- any code, docs, tests, or UI assumptions that treat `base_repos` or external reference repos as normal project context

### 3.3 Remove `base_repos` and External Reference Repo Handling

The repo currently contains references to `base_repos`, `third_party`, or reference-repo style folders. These must be removed from the normal harness architecture.

Required actions:

1. Delete any local `base_repos/` folder from the repository if it exists and contains copied code from other projects.
2. Delete any local `third_party/` folder if it is only being used as reference-code context and is not required source code.
3. Remove UI language that presents reference repos as useful project knowledge.
4. Remove repo-indexer logic that treats reference repos as a first-class concept.
5. Remove tests or fixtures that expect `base_repos` or `third_party` to appear in project summaries.
6. Keep ignore rules that prevent these folders from being scanned if they accidentally exist locally.
7. Do not use copied code from different repos as context for this project unless the user explicitly asks and provides a direct reason.

Reason: these reference folders increase complexity, confuse the model, slow indexing, and do not solve the current product problem.

### 3.4 Rename and Clarify Modes

The current terms `chat` and `agent` are acceptable internally, but the Web UI must present clearer user-facing modes:

| User-Facing Mode | Internal Behavior |
|---|---|
| Chat | no tools by default |
| Inspect | deterministic read/search/git tools, no edits |
| Plan | AI can inspect and propose; no edits |
| Trusted Edit | scoped edits with fewer prompts |
| Full Agent | plan → edit → verify → summarize |
| Danger Sandbox | isolated/dev-only unrestricted mode |

Do not use vague labels such as “Deep Agent” as a default path. If advanced behavior exists, mark it clearly as advanced and expensive.

---

## 4. Required Development Order

Work in this order only.

| Order | Layer | Why It Comes Here |
|---:|---|---|
| 1 | Deterministic Tools | Fixes the main speed problem. The UI must browse/search/read/git without waiting for Gemma. |
| 2 | Web UI | Once tools are fast, expose them through a real control center. |
| 3 | Permission/Sandbox | Trusted edit and agent work require clear safety boundaries. |
| 4 | Model Runtime | Add stable llama.cpp + Gemma 4 E4B after the UI/tool base is usable. |
| 5 | Agent Brain | Add planning/editing only after the harness itself is fast and safe. |
| 6 | Evaluation/Verification | Add reliable checks after edits exist. |
| 7 | Project Memory | Add memory last so it does not bloat prompts or hide bad routing. |

Do not reorder this sequence without explicit user approval.

---

## 5. System Layer Contracts

### 5.1 Web UI Contract

The Web UI must become the command center.

It must support:

- project explorer
- file viewer
- text search
- git status panel
- git diff panel
- runtime/model card
- mode selector
- agent run timeline
- tool activity log
- approval inbox
- diff review
- terminal output
- stop/cancel controls
- simple/advanced display toggle

The Web UI must remain useful when no model is loaded.

### 5.2 Deterministic Tools Contract

Deterministic tools are backend operations, not model abilities.

These must be callable directly from the Web UI and API without model involvement:

```text
listDir
readFile
searchText
glob
gitStatus
gitDiff
getStructuredDiff
readPackageScripts
getWorkspaceInfo
getModelRuntimeStatus
```

All deterministic tool responses must include:

```ts
{
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
  metadata: {
    durationMs: number;
    truncated?: boolean;
    fileReads?: string[];
    directoriesRead?: string[];
    command?: unknown;
  };
}
```

### 5.3 Model Runtime Contract

The runtime layer must be replaceable.

Do not tie product logic to Ollama-specific endpoints. Put provider-specific behavior behind a runtime adapter.

Required runtime adapter shape:

```ts
type RuntimeProvider = 'llamacpp' | 'ollama-legacy' | 'openai-compatible';

interface RuntimeAdapter {
  provider: RuntimeProvider;
  baseUrl: string;
  modelAlias: string;
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<ModelInfo[]>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest): AsyncIterable<ChatStreamEvent>;
}
```

### 5.4 Agent Brain Contract

The agent is not the harness. The agent is one feature layered on top of fast tools, UI, runtime, and permissions.

The agent must:

- plan before editing
- read minimal relevant files
- prefer search-before-read
- use deterministic tools first
- avoid full repo context
- avoid full-file rewrites
- stop after bounded loops
- show exact files changed
- show exact checks run
- never claim tests passed unless actually run
- never simulate tool results

### 5.5 Permission/Sandbox Contract

Permission rules must be explicit, user-visible, and mode-based.

Outside-workspace access is denied even in dangerous modes unless the user explicitly extends writable/readable roots.

Protected files must never be casually read or modified:

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
secrets.*
credentials.*
```

### 5.6 Evaluation/Verification Contract

Verification must be cheap first.

Order:

1. `git status`
2. `git diff`
3. syntax/type check if available
4. targeted test if identifiable
5. full build/test only after user approval or explicit request

### 5.7 Project Memory Contract

Memory must be small, structured, editable, and visible.

Do not store full prompts, full diffs, full traces, or full repo summaries as memory.

Memory should store only:

- project name
- package manager
- run commands
- test commands
- main folders
- selected user preferences
- last working runtime config
- stable project rules

---

## 6. Permission Modes

Implement these modes as first-class Web UI choices.

### 6.1 Chat Mode

- Default mode.
- No tools by default.
- No repo indexing by default.
- No approvals.
- No agent run timeline unless a model response is actively streaming.
- May answer general questions.
- May use selected file context only if the user explicitly selects files or asks to inspect a specific file.

### 6.2 Inspect Mode

- Uses deterministic tools only.
- Can list, read, search, and show git status/diff.
- No edits.
- No shell commands except safe read-only git/status commands.
- No model required.
- Optional “Explain with AI” button can send selected evidence to Gemma.

### 6.3 Plan Mode

- AI can inspect project evidence and propose a plan.
- No file edits.
- No destructive commands.
- No hidden checkpoints.
- Plan must be shown before switching into edit mode.

### 6.4 Trusted Edit Mode

- Allows scoped edits inside the workspace with fewer prompts.
- Must still show diffs.
- Must still create rollback checkpoint before edits when practical.
- Must still block protected files and outside-workspace paths.

Allowed without repeated approval when inside workspace:

```text
small file edits
patchFile
writeFile for non-protected files
makeDir
formatting commands that are explicitly allowlisted
```

Still requires approval:

```text
delete
rm/rmdir/mv/cp with broad scope
install commands
network access
git push
deploy commands
database migrations
.env/secrets edits
outside-workspace paths
```

### 6.5 Full Agent Mode

- Explicit user choice only.
- Runs plan → edit → verify → summarize.
- Bounded model/tool loops.
- Shows run timeline.
- Shows changed files.
- Shows verification results.

### 6.6 Danger Sandbox Mode

- Not default.
- Only for isolated/dev sandbox use.
- Must show warning in UI.
- Must still keep outside-workspace protection unless explicitly configured otherwise.

---

## 7. Milestone Plan

Each layer has two milestones: Foundation and Hardening. Each milestone must include implementation, tests, and UI/API validation where applicable.

---

# Layer 1 — Deterministic Tools

## Milestone 1A — Fast Tool Router Foundation

### Goal

Make simple workspace operations instant and model-free.

### Required Work

- Add or strengthen a deterministic router before any model call.
- Route obvious requests directly:

```text
list files → listDir
show/open/read file → readFile
search/grep/find text → searchText
git status → gitStatus
git diff/what changed → gitDiff
package scripts → readPackageScripts
current folder/workspace → getWorkspaceInfo
model status → getModelRuntimeStatus
```

- Ensure Web UI calls deterministic endpoints directly instead of going through chat.
- Add timing metadata to every deterministic tool result.
- Add a no-model-call assertion for deterministic routes.

### Acceptance Checks

```text
list root folder < 200 ms
read normal file < 100 ms
git status < 500 ms
search normal repo < 2 sec
deterministic routes make 0 model calls
Web UI updates immediately after tool result
```

### Forbidden Regressions

- Do not send `list files` through Gemma.
- Do not start task plans for deterministic UI actions.
- Do not build repo context for deterministic UI actions.

---

## Milestone 1B — Tool Reliability and Output Control

### Goal

Make tools safe, bounded, and UI-friendly.

### Required Work

- Add binary file detection.
- Add large file detection.
- Add max read size with clear truncation.
- Add output truncation metadata.
- Add consistent ignore lists across tool runtime, repo indexer, API workspace resolver, and search.
- Ensure these folders are ignored by default:

```text
.git
node_modules
dist
build
coverage
.next
.nuxt
.cache
.turbo
.vite
.gamma-harness
base_repos
third_party
```

- Add structured errors.
- Add cancellation/abort support where possible.
- Add tests for huge output, missing files, denied files, and binary files.

### Acceptance Checks

```text
large file does not freeze UI
binary file does not render as text
node_modules ignored by default
base_repos ignored/removed from normal context
search output is safely truncated
tool errors display cleanly
tool log shows exact duration
```

---

# Layer 2 — Web UI

## Milestone 2A — Web UI Control Center

### Goal

Turn the Web UI into the main workspace surface.

### Required Work

Create or refine these panels:

```text
Project Explorer
File Viewer
Search Panel
Git Status Panel
Git Diff Panel
Runtime / Model Status Card
Mode Selector
Terminal Output Panel
```

Rules:

- These panels must work without a loaded model.
- Project Explorer must call `/api/workspace/list` or equivalent deterministic endpoint.
- File Viewer must call `/api/workspace/file` or equivalent deterministic endpoint.
- Search Panel must call deterministic search.
- Git panels must call deterministic git endpoints.
- Do not route these through `/api/chat`.

### Acceptance Checks

```text
user can browse project without AI
user can open files without AI
user can search without AI
user can see git status without AI
user can see runtime status without asking chat
```

---

## Milestone 2B — Web UI Run Visibility

### Goal

Make every action visible and understandable without overwhelming the user.

### Required Work

- Add a simple/advanced display toggle.
- Default UI must show only:

```text
current mode
current workspace
current action
files read
files changed
approvals needed
verification result
errors
```

- Advanced details may show:

```text
raw trace
raw structured diff
checkpoint id
context budget
full run plan
fallback protocol details
```

- Add stop/cancel button for active model and tool runs.
- Add clear empty states.
- Add error banners that explain whether failure came from UI, API, tool, runtime, or model.

### Acceptance Checks

```text
user always knows what is running
tool call durations are visible
diffs are reviewable
approval prompts do not hide important UI
cancel stops active run or marks safe idle
advanced traces are hidden by default
```

---

# Layer 3 — Permission / Sandbox System

## Milestone 3A — Policy Foundation

### Goal

Separate safe actions from risky actions.

### Required Work

- Replace or extend current modes with user-facing modes:

```text
Chat
Inspect
Plan
Trusted Edit
Full Agent
Danger Sandbox
```

- Keep internal policy states simple.
- Add protected-path deny rules.
- Add allowlisted routine commands.
- Add explicit network-disabled default.
- Add outside-workspace denial.
- Add UI explanation for current permission mode.

### Acceptance Checks

```text
read file does not ask approval in Inspect Mode
write inside workspace follows mode rules
delete asks approval
outside workspace is blocked
network access is blocked unless enabled
protected files are denied or require explicit approval
```

---

## Milestone 3B — Trusted Edit Mode

### Goal

Reduce approval spam without removing safety.

### Required Work

- Add scoped trusted edit mode.
- Auto-approve small in-workspace edits to non-protected files.
- Auto-approve safe filesystem operations only if scoped and allowlisted.
- Require approval for dangerous commands, broad deletes, installs, deploys, network, secrets, and outside-workspace paths.
- Always display diff after edit.
- Always allow rollback or show why rollback is unavailable.

### Acceptance Checks

```text
normal small edit does not ask every time
dangerous command still asks
protected files are guarded
diff remains visible after edit
rollback/checkpoint is visible
```

---

# Layer 4 — Model Runtime

## Milestone 4A — llama.cpp Runtime Adapter for Gemma 4 E4B

### Goal

Add `llama.cpp` server support as the preferred local runtime without breaking existing optional providers.

### Required Work

- Add provider setting:

```text
llamacpp
ollama-legacy
openai-compatible
```

- Add `llama.cpp` defaults:

```text
baseUrl: http://127.0.0.1:8080/v1
apiKey: no-key
modelAlias: gemma4:e4b or configured alias
```

- Add runtime health check using `/v1/models` for OpenAI-compatible server.
- Add streaming support.
- Add first-token latency tracking.
- Add tokens/sec display if returned by runtime.
- Add model loaded/unavailable status.
- Add clear error when server is not running.
- Keep Ollama optional, not required.

### Acceptance Checks

```text
Web UI can connect to llama.cpp server
model health is shown
chat request works
streaming works
failure shows clear server/runtime error
Ollama is not required for the stable path
```

---

## Milestone 4B — Runtime Performance Guardrails

### Goal

Prevent local model overload on a 16 GB RAM CPU-first machine.

### Required Work

- Set conservative defaults for Gemma 4 E4B.
- Do not use huge context by default even if the model supports it.
- Add prompt-size warnings.
- Add context budget display.
- Add output token limits.
- Add one active generation lock by default.
- Add model busy/idle state.
- Add runtime telemetry in UI.
- Add environment/config documentation.

Recommended initial defaults:

```text
contextBudget: 6000–8000 tokens equivalent
maxOutputTokens chat: 512–768
maxOutputTokens inspect/explain: 768–1024
maxOutputTokens edit: 1024–1400
maxModelCallsPerRun: 3–6
maxToolCallsPerRun: 8–20
internetAccessEnabled: false
advancedAgentToolsEnabled: false
```

### Acceptance Checks

```text
Gemma 4 E4B does not receive full repo context by default
UI shows first-token latency
UI shows generation duration
large prompts warn or block
model calls are skipped for deterministic tasks
only one generation runs by default
```

---

# Layer 5 — Agent Brain

## Milestone 5A — Minimal Plan / Inspect Agent

### Goal

Create an agent that reads only what it needs and does not edit during planning.

### Required Work

- Implement Plan Mode behavior.
- Implement Inspect Mode plus optional AI explanation.
- Use search-before-read.
- Use selected-file context when available.
- Use current workspace deterministic evidence.
- Avoid broad repo context.
- Avoid automatic checkpoints in plan/inspect.
- Avoid edit tools in plan/inspect.

### Acceptance Checks

```text
agent can inspect project without editing
agent creates a clear plan
agent reads limited files
agent does not read whole repo
agent waits before editing
no checkpoint created during pure plan mode
```

---

## Milestone 5B — Edit Agent with Bounded Autonomy

### Goal

Let the agent modify code safely and visibly.

### Required Workflow

```text
understand request
inspect minimal evidence
write plan
receive approval or mode permission
create checkpoint if needed
apply minimal patch
show diff
run targeted verification
summarize exact changes
enter safe idle
```

### Required Guardrails

- Never rewrite full files unnecessarily.
- Never hide file changes.
- Never continue endlessly.
- Never simulate tool results.
- Never claim tests passed unless actually run.
- Never silently switch into advanced tools.
- Never use web tools unless internet is enabled and the user requests/approves it.

### Acceptance Checks

```text
agent edits only planned files
diff shows exact changes
rollback exists before edit or reason shown
agent stops after budget
summary lists changed files and verification status
```

---

# Layer 6 — Evaluation / Verification Loop

## Milestone 6A — Basic Verification

### Goal

Confirm changes with cheap checks first.

### Required Work

- Detect package manager.
- Detect available scripts.
- Show test/lint/build scripts in UI.
- Run `git status` after edits.
- Run `git diff` after edits.
- Suggest targeted checks.
- Add manual run buttons for checks.
- Keep full build/test opt-in unless requested.

### Acceptance Checks

```text
after edit, diff is shown
available test scripts are detected
agent suggests targeted checks
user can run verification from UI
verification output streams to UI
```

---

## Milestone 6B — Verification Automation

### Goal

Let safe verification run automatically in trusted modes.

### Required Work

- Add allowlist for safe verification commands.
- Add timeouts.
- Add streamed command output.
- Add failure summary.
- Add retry suggestion.
- Add clear distinction between not-run, passed, failed, and skipped.

### Acceptance Checks

```text
safe tests can run without repeated approval in trusted mode
long commands can be cancelled
failed tests are summarized clearly
agent does not ignore failures
final summary distinguishes passed/failed/skipped/not-run
```

---

# Layer 7 — Project Memory

## Milestone 7A — Lightweight Project Memory

### Goal

Store useful project facts without bloating prompts.

### Required Work

Store only structured facts:

```text
project name
workspace root
package manager
run scripts
test scripts
main folders
entry points
user preferences
last working runtime config
```

Do not store:

```text
full conversation history
full traces
full diffs
full file contents
full repo summary
raw model thoughts
large tool outputs
```

### Acceptance Checks

```text
memory improves routing
memory does not slow deterministic tools
user can view/edit/delete memory
memory has timestamps
memory is not injected blindly into every prompt
```

---

## Milestone 7B — Context Packs, Not Full Repo Memory

### Goal

Use memory and deterministic search to build small relevant context packs.

### Required Work

- Add context pack preview before model call.
- Include selected files, search snippets, recent changed files, and relevant commands only.
- Show token/char budget.
- Let user remove files from context.
- Avoid automatic full repo context.

### Acceptance Checks

```text
agent receives only relevant context
prompt size is visible
context pack can be previewed
user can remove files from context
large context requires explicit user approval
```

---

## 8. Global Implementation Rules

### Rule 1 — Model-Free First

If deterministic code can answer the request, do not call the model.

### Rule 2 — Web UI First

Every core operation must be visible and controllable from the Web UI.

### Rule 3 — No Hidden Agent Work

Every tool call, file change, command, approval, and error must be visible in the UI.

### Rule 4 — Small Context by Default

Never inject the whole repo automatically.

### Rule 5 — Gemma 4 E4B Only for Stable Phase

Do not add 26B mode until the E4B harness is stable and all milestones pass.

### Rule 6 — llama.cpp Runtime Target

Prioritize `llama.cpp` server as the preferred local runtime.

### Rule 7 — No GPU Assumption

All defaults must work on CPU-first 16 GB RAM systems.

### Rule 8 — Safe Autonomy

Reduce approval spam, but do not remove safety boundaries.

### Rule 9 — Remove Reference Repo Noise

Remove `base_repos` / external copied repo context from the normal product. Ignore those folders if they exist locally.

### Rule 10 — Tests Must Protect Product Behavior

Tests must verify user-visible behavior, not just internal code paths.

---

## 9. Forbidden Regressions

Do not allow these behaviors to return:

- `list files` triggers a model call
- opening a file triggers an agent plan
- search triggers repo-wide context injection
- Chat Mode exposes edit tools
- Inspect Mode creates checkpoints
- Plan Mode edits files
- Trusted Edit touches protected files without approval
- Full Agent runs forever
- Web UI hides current action
- Web UI shows raw trace noise by default
- model runtime assumes Ollama only
- default config assumes GPU
- 26B mode appears before E4B stability
- `base_repos` or `third_party` reference code appears in normal context
- tests pass while simple UI actions remain slow

---

## 10. Required Tests

Add tests in this order.

### 10.1 Deterministic Tool Tests

```text
list workspace root without model
read file without model
search without model
git status without model
large file truncation
binary file protection
ignored folder protection
```

### 10.2 API Tests

```text
/api/workspace/list does not call model
/api/workspace/file does not call model
/api/workspace/search does not call model
/api/chat defaults to chat mode
/api/chat mode=agent explicitly invokes agent
/api/config supports llama.cpp provider
```

### 10.3 Web UI Tests

```text
project explorer loads without model
file viewer loads without model
search panel loads without model
mode selector changes behavior visibly
run timeline only appears for agent/model work
advanced details hidden by default
```

### 10.4 Runtime Tests

```text
llama.cpp health check works against OpenAI-compatible /v1/models
clear error when server offline
streaming chat works
first-token latency captured
Ollama legacy path still optional if kept
```

### 10.5 Agent Tests

```text
Plan Mode does not edit
Inspect Mode does not edit
Trusted Edit edits only in workspace
protected files blocked or require approval
Full Agent stops after bounded loops
verification result is accurately reported
```

---

## 11. Documentation Requirements

Update docs as part of implementation.

Required docs:

```text
README.md quick start for Web UI
llama.cpp setup guide for Gemma 4 E4B
runtime provider configuration
permission mode explanation
Web UI workflow guide
development/testing commands
troubleshooting slow model/runtime issues
```

Docs must clearly say:

- Web UI is the primary interface.
- Deterministic tools work without AI.
- Gemma 4 E4B is the default stable model target.
- Gemma 4 26B is future advanced mode, not current default.
- Ollama is optional/legacy, not the required stable path.
- `base_repos` and copied external repos are not part of the normal architecture.

---

## 12. Definition of Done

The stable harness is not done until all of these are true:

```text
1. Web UI can browse, read, search, and show git status without loading a model.
2. Deterministic tool operations show timing and make zero model calls.
3. Web UI clearly separates Chat, Inspect, Plan, Trusted Edit, and Full Agent behavior.
4. Permission rules protect outside-workspace paths and protected files.
5. llama.cpp server runtime works with Gemma 4 E4B through OpenAI-compatible endpoint.
6. Runtime status, first-token latency, and errors are visible in the Web UI.
7. Agent planning does not edit files.
8. Agent editing shows diffs and verification results.
9. Verification distinguishes passed, failed, skipped, and not-run.
10. Project memory is small, structured, editable, and not blindly injected.
11. base_repos/third_party reference context is removed from normal product flow.
12. Tests protect all major user-facing behaviors.
```

---

## 13. Final Product Direction

Build the harness in this shape:

```text
Web UI first
Deterministic tools second
Runtime provider third
Permissions fourth
Agent fifth
Verification sixth
Memory last
```

The model should help the user reason and edit. It should not be responsible for basic file-system interaction.

The correct user experience is:

```text
User opens Web UI → project appears instantly → files/search/git work instantly → model is used only when requested → agent work is visible, bounded, reviewable, and safe.
```

That is the target.