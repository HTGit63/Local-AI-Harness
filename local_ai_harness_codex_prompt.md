# Codex Implementation Prompt for Local-AI-Harness
**Target repo:** `HTGit63/Local-AI-Harness`  
**Goal:** turn the current local Gemma 4 harness into a fast, reliable, CPU-friendly agentic coding assistant with strong workspace awareness, structured tool reporting, and low-latency streaming UI.

---

## 0. What you are fixing

You are working inside a TypeScript monorepo with `apps/api`, `apps/cli`, `apps/web`, and packages including `core`, `model-adapter`, `planner`, `repo-indexer`, `tool-runtime`, `trace-bus`, `skills`, and `prompt-recipes`. The current repo already claims to be a local-first coding harness with tool execution, workspace safety, a planner, a trace bus, and a web UI, and the docs explicitly say the system should surface structured operational visibility rather than fake hidden reasoning. fileciteturn8file0 fileciteturn12file0 fileciteturn13file0

The current implementation already has:
- a streaming API route at `/api/chat/stream` that emits NDJSON events such as `status`, `tool`, `delta`, and `done`, plus workspace, approvals, trace, plan, model runtime, and git endpoints, fileciteturn15file0
- a `CoreEngine` that decides prompt mode, chooses tools, runs tool loops, does direct-mode and agentic-mode handling, and currently includes manual tool fallback logic and many workspace heuristics, fileciteturn16file0
- a `ModelAdapter` that prefers native Ollama `/api/chat`, exposes model capability detection and model activation, and translates Ollama tool calls into OpenAI-like structures, fileciteturn18file0
- a `ToolRegistry` that implements local file, search, git, and safe command tools, emitting trace events for each call/result, fileciteturn27file0
- a `RepoIndexer` that builds a lightweight repo summary and workspace inventory with TTL caching, fileciteturn29file0
- a `Planner` and `TraceBus`, but they are too generic for rich agent run reporting, fileciteturn23file0 fileciteturn25file0
- a large React web UI that polls the backend, streams NDJSON, renders markdown for every streamed update, and currently shows generic tool activity cards and reasoning blocks. fileciteturn21file0

The benchmark targets in the docs say direct chat should reach first token under 2000 ms and full answer under 5000 ms, with tool-loop overhead under 15 ms and UI event lag under 2 ms on CPU-only 16 GB RAM hardware. Right now that target is not being met. fileciteturn14file0

---

## 1. User-observed failures to solve

The user reported these practical problems:

1. In agentic mode the model thinks, plans, and shows activity, but often does **not actually complete the work** or explain the result clearly.
2. The tool activity UI is weak. It does not show a trustworthy run log like:
   - what was explored,
   - which files were opened,
   - what commands ran,
   - how many commands ran,
   - which steps completed,
   - what changed,
   - what was added/removed.
3. Direct mode works better and memory/session continuity is good, but text rendering is too slow and can take many minutes for big tasks.
4. The system must work on **16 GB RAM, CPU-only, no GPU**.
5. The final agent output must always include a short summary of what it did, what changed, and how the task was updated.
6. The system must track **lines added and removed** across the run.

Your job is to implement all of that inside the current repo.

---

## 2. High-confidence diagnosis of the current bottlenecks

### 2.1 The biggest reliability issue: agentic mode disables tools in browser-context fallback
In `CoreEngine.runChat()`, if `browserFolderContextActive` is true, the engine disables selected tools and also suppresses repo/workspace context injection by setting `selectedToolNames` to `[]` and disabling normal workspace context. That means when a user picks a folder in the browser but the backend workspace binding is not truly resolved, the model can be shown browser context yet lose tool execution power. This is a direct cause of “it thinks and plans but does not actually do things.” fileciteturn16file0

### 2.2 Gemma 4 is forced into a brittle manual JSON tool protocol
`selectToolProtocol()` currently chooses `manual_preferred` for Gemma 4 unless `HARNESS_FORCE_NATIVE_TOOLS=1`. The current manual protocol requires the model to return **exactly one JSON object and nothing else**. That is too fragile for small local models and invites correction loops, fake tool text, or dead-end “thinking but not doing” behavior. The short correction prompts in `packages/prompt-recipes` are not strong enough to stabilize this under real user tasks. fileciteturn16file0 fileciteturn32file0 fileciteturn33file0

### 2.3 Planner and trace model are too weak for a serious agent timeline
The current `Planner` only tracks generic state such as `taskSummary`, `currentPhase`, `activeSkills`, and `intendedNextAction`, and emits generic `planner_trace`. The `TraceBus` is a thin event wrapper. There is no first-class concept of:
- one agent run,
- ordered run steps,
- file exploration,
- command execution counts,
- line add/remove stats,
- execution duration,
- fallback reasons,
- diff summaries,
- final run summary object. fileciteturn23file0 fileciteturn25file0

### 2.4 UI is expensive because it re-renders the whole markdown chat on every streamed token
The React web UI streams NDJSON, then updates the full `messages` array on every `status`, `tool`, and `delta` event. It renders assistant content through `ReactMarkdown`, `remark-gfm`, `remark-math`, and `rehype-katex`, and smooth-scrolls on every message change. That is expensive, especially during long streams. It also keeps polling backend state while streaming. This is a major reason the UI feels slow even when inference itself is not the only bottleneck. fileciteturn21file0

### 2.5 Dashboard polling is doing avoidable background work during active turns
The web app polls live backend state every 3 seconds and does heavier full refreshes every 15 seconds, including repo indexing and git diff fetching. That is acceptable for idle monitoring, but it is the wrong thing to do during active model streaming on a 16 GB CPU-only machine. fileciteturn21file0

### 2.6 Tool activity display is derived from vague text, not structured run events
The current UI guesses badge types by reading free-form status strings. That makes the activity log look noisy and not trustworthy. The backend already emits tool events, but not a rich enough event taxonomy to produce the kind of “worked for 1m 20s / ran 2 commands / explored 2 files / edited 1 file” presentation the user wants. fileciteturn21file0

### 2.7 Skills are too generic for this harness’s real problems
The current curated skills system documents 12 fairly broad skills like frontend developer, backend architect, code reviewer, product manager, etc. That is fine as a base layer, but this harness needs operational skills such as workspace binding, repo cartography, tool routing, run summarization, approval explanation, and safe local command execution. fileciteturn42file0

---

## 3. Non-negotiable target outcome

You must turn the harness into a system with these properties:

1. **Agentic mode actually executes work** when tools are allowed and the workspace is bound.
2. **Tool selection is fast and deterministic** for common repo questions.
3. **No fake activity.** The UI may only display actions that truly happened.
4. **Every agentic run produces a structured final summary**:
   - what it inspected,
   - what tools were used,
   - what files changed,
   - line additions/removals,
   - commands run,
   - approvals requested,
   - failures/fallbacks,
   - final short user-facing summary.
5. **The web UI streams fast** and does not stall on markdown parsing or unnecessary refreshes.
6. **The whole system remains practical on 16 GB RAM, CPU-only.**

---

## 4. Hard product rules

### 4.1 Never imply tool execution that did not happen
If a tool did not run, do not make the UI sound like it ran.  
If the workspace is only a browser snapshot and not a real bound workspace, the UI must say so clearly.

### 4.2 No hidden reasoning fabrication
Respect the architecture doc rule: surface only model-emitted thinking, and keep it visually separate. Do not invent hidden chain-of-thought. fileciteturn13file0

### 4.3 Agentic summary is required
Every agentic turn must end with:
- a short human-readable answer,
- a structured run summary object persisted in the session,
- UI rendering of that summary.

### 4.4 CPU-first design
Any solution that increases steady-state memory pressure, adds a vector DB, adds heavy embedding pipelines, or forces broad repo ingestion on every turn is the wrong direction.

---

## 5. The implementation strategy

Implement this in phases, but code it fully.

---

## 6. Phase A — Replace brittle agent routing with deterministic task routing

### 6.1 Add a first-class task classifier
Create a small deterministic classifier layer in `packages/core` that categorizes the latest user request into one of these intents:

- `status_query`
- `workspace_overview`
- `find_file`
- `read_file`
- `search_text`
- `explain_code`
- `review_diff`
- `edit_code`
- `run_command`
- `workspace_binding_needed`
- `browser_snapshot_only`
- `general_chat`

This classifier must be **fast, synchronous, regex/heuristic-first**, and must run before model invocation.

### 6.2 Add deterministic bootstrap plans for common intents
For common inspect-style tasks, do not ask the model to decide the first step. The engine should immediately decide the first tool sequence itself.

Examples:
- `workspace_overview` -> `buildWorkspaceInventory()` and/or `listDir('.')`
- `find_file` -> `glob(...)`
- `read_file` -> `readFile(...)`
- `search_text` -> `searchText(...)`
- `review_diff` -> `gitDiff()` then model synthesis
- `status_query` -> local state answer without LLM if possible

### 6.3 Stop forcing Gemma 4 into manual JSON protocol by default
Change `selectToolProtocol()` so that:
- if model capabilities include tools, prefer native tools first,
- if native tools fail on a real attempt, then fall back,
- manual JSON protocol becomes a **last-resort recovery path**, not the default for Gemma 4,
- keep an opt-in env flag to force manual mode for debugging, but not as default.

### 6.4 Keep manual fallback, but make it stronger and safer
If you still need manual fallback:
- use a very strict parser,
- limit it to one step at a time,
- include the tool schema and one or two exact examples,
- after repeated invalid replies, stop the loop early and explain the limitation,
- persist the fallback reason in the run summary.

---

## 7. Phase B — Add a real Agent Run model

### 7.1 Introduce a first-class `AgentRun` object
Create a new shared type, likely in `packages/core` or `packages/planner`, something like:

```ts
interface AgentRun {
  id: string;
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  executionMode: 'agentic' | 'direct';
  workspaceRoot: string;
  model: string;
  promptMode: string;
  intent: string;
  browserContextActive: boolean;
  workspaceBound: boolean;
  usedNativeTools: boolean;
  usedManualFallback: boolean;
  fallbackReason?: string;
  steps: AgentRunStep[];
  filesRead: string[];
  filesWritten: string[];
  filesDeleted: string[];
  directoriesCreated: string[];
  searches: Array<{ query: string; pattern?: string }>;
  commands: Array<{ command: string; success: boolean; durationMs?: number }>;
  approvals: Array<{ id: string; target: string; approved: boolean | null }>;
  git?: {
    isRepo: boolean;
    addedLines: number;
    removedLines: number;
    changedFiles: number;
  };
  finalAnswer?: string;
  summary?: string;
  error?: string;
}
```

And step shape:

```ts
interface AgentRunStep {
  id: string;
  type:
    | 'classify'
    | 'local_answer'
    | 'inventory'
    | 'tool'
    | 'model'
    | 'fallback'
    | 'approval'
    | 'summary';
  title: string;
  detail?: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'done' | 'error' | 'skipped';
  toolName?: string;
  toolInputSummary?: string;
  toolOutputPreview?: string;
  filePaths?: string[];
  command?: string;
}
```

### 7.2 Persist runs in the session store
Extend the session store so each turn can persist:
- the plain chat turn metadata,
- the full `AgentRun` summary for agentic turns.

### 7.3 Emit new trace events
Add structured events:
- `run_started`
- `run_step_started`
- `run_step_finished`
- `tool_started`
- `tool_finished`
- `approval_requested`
- `approval_resolved`
- `run_summary_ready`
- `run_failed`

These must drive the UI directly instead of forcing it to infer behavior from generic strings.

---

## 8. Phase C — Make tool activity look trustworthy and useful

### 8.1 The UI must look closer to a real agent run log
The desired style is not “some vague tool activity plus a reasoning dump.” It must be more like:

- **Worked for:** 1m 20s
- **Explored:** 3 files, 2 directories
- **Searched:** 2 patterns
- **Ran:** 1 command
- **Changed:** 2 files (+54 / -13)
- **Approvals:** 1 approved
- **Fallback:** none

Then below that, step-by-step cards such as:
- Read `package.json`
- Listed `apps/`
- Searched `createChatCompletion`
- Ran `git diff --`
- Wrote `packages/core/src/agent-run.ts`

### 8.2 Replace heuristic badge guessing with event-driven rendering
The frontend must stop guessing “READ / WRITE / EXEC / SYS” from free-form strings and instead use explicit event types and step types from the backend.

### 8.3 Show actual command and file metrics
The UI must display:
- exact command run,
- files read,
- files written,
- files deleted,
- line additions/removals,
- if there was no real file edit, say so.

---

## 9. Phase D — Add line added/removed statistics

### 9.1 Git-aware stats
When the workspace is a git repo, compute line counts from `git diff --numstat` after mutating actions or at run end.

Add a helper in `tool-runtime` or `core` that returns:
- `changedFiles`
- `addedLines`
- `removedLines`

### 9.2 Non-git fallback
If not a git repo:
- parse unified diff previews from `writeFile`, `patchFile`, and `deleteFile`,
- aggregate line add/remove counts from those previews,
- store those counts in the run summary.

### 9.3 Surface in summary
The final user-facing answer for agentic edits must include a short “Changed X files (+A / -R)” summary.

---

## 10. Phase E — Make direct streaming and web rendering fast

### 10.1 Stop expensive markdown parsing on every delta
While a message is actively streaming:
- render it as plain text or very light formatting,
- do not run full `ReactMarkdown + remark + rehype + katex` on every chunk,
- once the stream is done, upgrade the final content to full markdown rendering.

### 10.2 Throttle delta application
Coalesce NDJSON `delta` updates into a short interval buffer, such as every 30–60 ms. Do not update React state for every tiny chunk.

### 10.3 Stop smooth scroll spam during streaming
During an active stream:
- use immediate scroll,
- or only scroll if the user is already near the bottom,
- do not call smooth scroll on every chunk.

### 10.4 Pause heavy dashboard polling while a turn is active
While `isSending` is true:
- suspend the 3-second live polling,
- suspend the 15-second full refresh,
- only do a light refresh when the turn finishes.

### 10.5 Memoize message rows
Split the chat message row into memoized subcomponents:
- message shell,
- tool activity panel,
- thought block,
- markdown body,
- image attachments.

Only the streaming assistant row should rerender during stream.

### 10.6 Keep the fast path for direct mode
Direct mode should remain simple:
- minimal prompt wrapping,
- no repo indexing unless explicitly requested,
- no planner overhead unless needed,
- low-latency first-token path.

---

## 11. Phase F — Make workspace binding explicit and safe

### 11.1 Add a real `workspaceBound` state
Today the browser folder fallback is easy to confuse with a real backend workspace binding. Introduce an explicit runtime field:
- `workspaceBound: boolean`
- `workspaceSource: 'backend' | 'browser_snapshot'`

### 11.2 Show a clear UI banner when agentic tools are limited
If only browser snapshot context exists:
- show a banner in the UI and composer,
- explain that the model can inspect the attached snapshot but cannot safely claim backend file operations unless the workspace is bound,
- do not silently pretend everything is normal.

### 11.3 Agentic mode behavior in snapshot-only mode
In snapshot-only mode:
- allow explanation and summarization tasks,
- disallow actual file mutation tools,
- do not claim commands were run,
- if the user asks for edits, explain that workspace binding is required.

---

## 12. Phase G — Improve prompting without making the system slow

### 12.1 Replace broad “one prompt recipe per mode” with compact operational instructions
The current recipe layer is too generic and too short. Keep prompts compact but operational. For agentic turns, inject:
- current workspace source,
- tool availability,
- task intent,
- native vs fallback tool path,
- explicit instruction to finish with a concise actionable answer,
- explicit prohibition against simulating work.

### 12.2 Add a required finish contract
For agentic turns, the assistant must end with:
1. a short answer,
2. a “What I did” summary,
3. if edits happened, “Files changed” with add/remove counts.

This finish contract should be lightweight and not massive.

### 12.3 Keep token budgets tight
For CPU-only operation:
- inspect tasks: low max tokens,
- edit tasks: moderate max tokens,
- docs: moderate/high only when necessary,
- hard cap loops,
- avoid injecting large repo context unless the request truly needs it.

---

## 13. Phase H — Expand the skill system for local harness reality

Do not remove the current generic skill pack. Add a harness-native skill layer that can be activated automatically or manually.

Add at least these skills:

- `repo-cartographer` — maps package/app/module structure quickly
- `tool-router` — chooses deterministic tool-first actions
- `file-explainer` — explains a file after inspection
- `patch-surgeon` — makes small focused edits
- `diff-summarizer` — explains changes and line stats
- `approval-explainer` — rewrites approvals in plain language
- `workspace-binder` — explains workspace binding limitations
- `performance-profiler` — detects slow UI/render paths
- `local-safety-operator` — CPU/RAM-aware operational constraints
- `command-runner` — safe local command workflow
- `test-runner` — test/lint/build decision helper
- `session-continuity` — concise use of prior session context

These skills should not balloon prompt size. Use them as structured instructions or labels that influence deterministic runtime behavior.

---

## 14. Phase I — Add better runtime metrics and diagnostics

### 14.1 Measure timing inside the engine
Record:
- time to intent classification,
- time to first model call,
- time to first token,
- time spent in tools,
- total run duration,
- UI stream duration,
- number of model loops,
- whether fallback happened.

### 14.2 Add doctor/benchmark checks for the new behavior
Extend the doctor or benchmark package so it can verify:
- direct mode first-token latency,
- agentic inspect latency,
- tool step latency,
- final run summary presence,
- line stat computation,
- UI event structure.

The benchmark docs already describe what good performance should look like; now make the code enforce that more concretely. fileciteturn14file0

---

## 15. File-by-file implementation guidance

### 15.1 `packages/core/src/engine.ts`
Refactor this file heavily but carefully.

Do all of the following:
- add intent classification,
- add deterministic bootstrap planning,
- stop defaulting Gemma 4 to manual JSON tool mode,
- create and maintain `AgentRun`,
- emit rich run events,
- aggregate file/command/search/edit stats,
- produce final structured summaries,
- distinguish clearly between `workspaceBound` and `browser_snapshot` modes,
- keep direct mode lean.

### 15.2 `packages/model-adapter/src/client.ts`
Keep native Ollama preference.
Improve:
- native tool failure detection,
- first-token timing capture hooks if possible,
- cleaner return metadata for tool-capable vs non-tool-capable models,
- maybe expose a “fast path” hint for inspect tasks.

Do **not** add heavy dependencies.

### 15.3 `packages/tool-runtime/src/registry.ts`
Add structured metadata return values so the engine can record:
- normalized file path list,
- command duration,
- diff add/remove counts when possible,
- whether output was truncated,
- a short preview for UI.

Keep command execution safe.

### 15.4 `packages/planner/src/planner.ts`
Upgrade the planner so it can track:
- current run id,
- ordered steps,
- step status,
- current tool,
- run summary.

Avoid turning it into a giant state machine. Keep it practical.

### 15.5 `packages/trace-bus/src/bus.ts`
Keep it lightweight, but support richer event shapes and consistent IDs.

### 15.6 `packages/repo-indexer/src/indexer.ts`
Keep caching.
Avoid full context rebuilds during active stream unless required.
Add a cheaper “inventory only” fast path for workspace overview requests.

### 15.7 `packages/prompt-recipes/src/recipes.ts` and `optimizer.ts`
Simplify and strengthen:
- native tool-first instructions,
- non-simulation rule,
- finish contract,
- compact fallback instructions.

### 15.8 `apps/api/src/server.ts`
Keep current endpoints, but extend the stream so the UI gets:
- `run_started`
- `run_step`
- `run_metric`
- `run_summary`
or equivalent structured types.

Do not break existing basic NDJSON compatibility.

### 15.9 `apps/web/src/HarnessApp.tsx`
This file needs serious cleanup and component extraction.

Do all of the following:
- split into smaller components,
- throttle stream updates,
- render streaming text cheaply,
- render full markdown after done,
- pause background polling during send,
- add a real run summary panel,
- show exact commands/files/changes,
- show workspace-bound vs browser-snapshot state clearly,
- keep reasoning in a separate expandable block,
- remove fake-looking activity guessing.

### 15.10 `tests`
Add and update tests for:
- workspace snapshot mode,
- workspace bound mode,
- native tools preferred,
- manual fallback only after native failure,
- run summary presence,
- line count summary,
- streaming event sequence,
- UI fallback for agentic turns with no content but real tool summary.

---

## 16. UI/UX requirements in detail

### 16.1 Agentic response card layout
Every agentic assistant response should have these sections, in this order:

1. **Tool Activity / Run Overview**
   - total duration
   - tools used
   - files explored
   - files changed
   - line delta
   - commands run
   - approvals

2. **Run Steps**
   - chronological step list

3. **Reasoning Process** (only if actual model thinking exists)
   - collapsible

4. **Final Answer**
   - concise and useful

### 16.2 No empty assistant cards
If the model produced no useful natural-language answer but real tools ran, the UI must synthesize a small, honest summary from the run data:
- “Inspected 4 files and ran 1 search, but the model did not produce a final narrative answer.”
Not a fake claim, not a vague placeholder.

### 16.3 Display line delta prominently for edits
For edit runs show something like:
- `Changed 3 files (+81 / -24)`

### 16.4 Display exact commands
For command runs show exact command text and whether it succeeded.

---

## 17. Acceptance criteria

The work is only done if all of these are true:

1. On a bound workspace, a repo-inspection request causes real tool execution and a final explanation.
2. On a snapshot-only workspace, the system clearly says it is snapshot-only and does not fake backend access.
3. Agentic runs show trustworthy step-by-step activity with exact files/commands.
4. Agentic runs end with a concise summary and structured run summary data.
5. Line add/remove stats are shown for edit runs.
6. Direct-mode streaming no longer feels blocked by markdown rendering.
7. Background polling no longer competes with active streaming.
8. The system remains usable on 16 GB RAM, CPU-only.
9. Tests pass.

---

## 18. Suggested concrete design changes

### 18.1 New files you should probably add
These are suggestions, not rigid requirements:

- `packages/core/src/intent-classifier.ts`
- `packages/core/src/agent-run.ts`
- `packages/core/src/run-summary.ts`
- `packages/core/src/tool-plan.ts`
- `packages/planner/src/run-state.ts`
- `apps/web/src/components/ChatMessageRow.tsx`
- `apps/web/src/components/AgentRunSummary.tsx`
- `apps/web/src/components/AgentRunSteps.tsx`
- `apps/web/src/components/StreamingMarkdown.tsx`
- `apps/web/src/hooks/useNdjsonStream.ts`
- `apps/web/src/hooks/useStreamingBuffer.ts`

### 18.2 Event naming
Standardize around a clear NDJSON schema. For example:

```ts
type StreamEvent =
  | { type: 'status'; phase: string; action: string; loop: number }
  | { type: 'run_started'; runId: string; intent: string }
  | { type: 'run_step'; runId: string; step: AgentRunStep }
  | { type: 'tool'; id: string; name: string; state: 'start' | 'done'; inputSummary: string; output?: string; success?: boolean }
  | { type: 'delta'; delta: string }
  | { type: 'run_summary'; runId: string; summary: AgentRun }
  | { type: 'done'; response: string }
  | { type: 'error'; message: string };
```

### 18.3 Final summary generation
After tool execution is complete and before returning the final assistant response:
- compute run summary metrics,
- build a short structured english summary,
- persist it,
- stream it to the UI,
- then return the assistant answer.

---

## 19. Performance guardrails

### 19.1 Do not add heavy new dependencies unless truly necessary
No big client-state library, no vector DB, no Electron conversion, no huge telemetry stack.

### 19.2 Keep inference context small
Do not inject giant repo trees or giant tool transcripts into the model unless needed.

### 19.3 Respect CPU-only constraints
Prefer deterministic runtime code over LLM reasoning when the answer can be computed directly.

---

## 20. Example of desired runtime behavior

### 20.1 Repo overview question
User asks:
> review the architecture and explain the project

Desired behavior:
1. intent classifier marks `workspace_overview`
2. run starts
3. engine gathers workspace inventory and maybe key manifests/entry points
4. one or two cheap tools run
5. model synthesizes explanation
6. UI shows:
   - Worked for 18s
   - Explored 5 files
   - Ran 0 commands
   - Changed 0 files
7. final answer explains architecture clearly

### 20.2 Code edit question
User asks:
> fix the slow direct streaming render

Desired behavior:
1. intent classifier marks `edit_code`
2. engine reads `apps/web/src/HarnessApp.tsx`
3. maybe searches for markdown rendering and polling logic
4. applies patch or writes extracted components
5. computes line delta
6. final answer says what changed

### 20.3 Unbound workspace question
User asks:
> edit the attached folder

Desired behavior:
1. system sees browser snapshot only
2. UI banner says workspace is not backend-bound
3. assistant explains it can inspect and propose edits, but actual writes require workspace binding
4. no fake write tool execution appears

---

## 21. Test plan you must implement

### 21.1 Core tests
- intent classification
- native tool-first routing
- manual fallback path
- workspace snapshot handling
- run summary generation
- line stat aggregation

### 21.2 API tests
- stream emits new structured events
- run summary arrives before `done`
- snapshot-only mode clearly represented

### 21.3 UI tests
- streaming delta buffering
- markdown only upgraded post-stream
- no expensive rerender storm
- run summary panel renders correctly
- line stats render correctly
- snapshot-only warning renders

---

## 22. Output quality rules for the final user answer

When the harness itself answers after this refactor:
- be clear,
- do not over-explain,
- always say what was actually done,
- always distinguish inspection from edits,
- always distinguish proposed changes from applied changes,
- do not dump a wall of thought text unless the user explicitly wants that.

---

## 23. Deliverables you must complete in this repo

Implement the code changes, not just docs.

At minimum, commit working changes that include:
1. backend run summary and event model,
2. improved engine routing,
3. improved web streaming performance,
4. improved tool activity UI,
5. line add/remove statistics,
6. tests.

---

## 24. Final checklist before you stop

Before finishing, verify:

- [x] Agentic mode performs real work on a bound workspace
- [x] Snapshot-only mode does not fake backend access
- [x] Gemma 4 no longer defaults to brittle manual JSON tool mode
- [x] Final answer always includes a concise “what I did” summary
- [x] Run summary persisted in session store
- [x] UI shows files explored, commands run, files changed, line delta
- [x] Streaming UI is substantially faster
- [x] Polling is paused or minimized during active turns
- [x] Tests updated and passing

Completed after three audit/fix passes on 2026-04-18.

---

## 25. Brief architectural note for implementation style

Be aggressive about improving the behavior, but do **not** rewrite the entire repo from scratch. This repo already has the right major pieces:
- API server,
- engine,
- model adapter,
- tool runtime,
- repo indexer,
- planner,
- trace bus,
- web UI. fileciteturn12file0

The problem is mostly in:
- brittle routing,
- weak run-state modeling,
- weak event semantics,
- expensive UI rendering,
- unclear workspace state.

Refactor around those weaknesses rather than replacing everything.

---

## 26. Optional but recommended improvements

These are welcome if they remain lightweight:

- add a compact “first token” timer in UI
- show whether native tools or fallback tools were used
- show exact fallback reason when manual mode was needed
- add a small “copy summary” button on agentic responses
- add a tiny “run facts” footer: `3 files read · 1 command · +42/-10`

---

## 27. End condition

The task is complete when the harness feels like a trustworthy local coding agent instead of a chat UI that sometimes thinks aloud and stalls.

The most important rule:  
**Make the system visibly honest, operationally clear, and fast enough to feel responsive on CPU-only hardware.**

---

## 28. Concrete pseudocode guidance

### 28.1 Intent classifier sketch

```ts
export type TaskIntent =
  | 'status_query'
  | 'workspace_overview'
  | 'find_file'
  | 'read_file'
  | 'search_text'
  | 'explain_code'
  | 'review_diff'
  | 'edit_code'
  | 'run_command'
  | 'workspace_binding_needed'
  | 'browser_snapshot_only'
  | 'general_chat';

export interface IntentDecision {
  intent: TaskIntent;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  targetPath?: string;
  searchQuery?: string;
  commandHint?: string;
}

export function classifyIntent(input: {
  latestUserMessage: string;
  browserContextActive: boolean;
  workspaceBound: boolean;
}): IntentDecision {
  const text = input.latestUserMessage.toLowerCase().trim();

  if (input.browserContextActive && !input.workspaceBound) {
    if (/(edit|change|fix|write|patch|create|delete|update|implement)/.test(text)) {
      return {
        intent: 'workspace_binding_needed',
        confidence: 'high',
        reasons: ['Mutating request but backend workspace is not bound.'],
      };
    }
  }

  if (/(what workspace|current workspace|which folder|active model|configured model|current mode)/.test(text)) {
    return { intent: 'status_query', confidence: 'high', reasons: ['Local status query.'] };
  }

  if (/(architecture|project structure|repo overview|explain the project|main packages|main apps)/.test(text)) {
    return { intent: 'workspace_overview', confidence: 'high', reasons: ['Overview request.'] };
  }

  if (/(find file|where is|which file|locate file)/.test(text)) {
    return { intent: 'find_file', confidence: 'high', reasons: ['File search request.'] };
  }

  if (/(read file|open file|inspect file|explain .*file)/.test(text)) {
    return { intent: 'read_file', confidence: 'medium', reasons: ['Direct file inspection request.'] };
  }

  if (/(search|grep|look for|find text|references to|mentions of)/.test(text)) {
    return { intent: 'search_text', confidence: 'high', reasons: ['Workspace text search request.'] };
  }

  if (/(review diff|git diff|review changes|code review)/.test(text)) {
    return { intent: 'review_diff', confidence: 'high', reasons: ['Diff review request.'] };
  }

  if (/(run|test|lint|build|benchmark|doctor)/.test(text)) {
    return { intent: 'run_command', confidence: 'medium', reasons: ['Likely command request.'] };
  }

  if (/(edit|change|fix|write|patch|create|delete|update|implement|refactor)/.test(text)) {
    return { intent: 'edit_code', confidence: 'high', reasons: ['Edit request.'] };
  }

  if (/(explain|summarize|teach me|what does this do)/.test(text)) {
    return { intent: 'explain_code', confidence: 'medium', reasons: ['Explanation request.'] };
  }

  return { intent: 'general_chat', confidence: 'low', reasons: ['Fallback intent.'] };
}
```

### 28.2 Deterministic bootstrap planner sketch

```ts
export interface BootstrapPlanStep {
  type: 'inventory' | 'tool' | 'local_answer' | 'model';
  toolName?: SupportedTool;
  args?: Record<string, unknown>;
  title: string;
}

export function buildBootstrapPlan(ctx: {
  intent: TaskIntent;
  latestUserMessage: string;
  workspaceBound: boolean;
}): BootstrapPlanStep[] {
  switch (ctx.intent) {
    case 'status_query':
      return [{ type: 'local_answer', title: 'Answer from runtime state' }];

    case 'workspace_overview':
      return [
        { type: 'inventory', title: 'Build workspace inventory' },
        { type: 'tool', toolName: 'listDir', args: { dirPath: '.' }, title: 'List workspace root' },
        { type: 'model', title: 'Synthesize architecture overview' },
      ];

    case 'review_diff':
      return [
        { type: 'tool', toolName: 'gitDiff', args: {}, title: 'Read git diff' },
        { type: 'model', title: 'Review current diff' },
      ];

    case 'edit_code':
      return [
        { type: 'tool', toolName: 'searchText', args: { query: 'relevant terms' }, title: 'Search target code' },
        { type: 'model', title: 'Plan focused edit' },
      ];

    default:
      return [{ type: 'model', title: 'Handle request normally' }];
  }
}
```

### 28.3 Agent run aggregation sketch

```ts
export class AgentRunBuilder {
  private run: AgentRun;

  constructor(init: Pick<AgentRun, 'id' | 'sessionId' | 'workspaceRoot' | 'model' | 'promptMode' | 'intent'>) {
    this.run = {
      ...init,
      startedAt: Date.now(),
      executionMode: 'agentic',
      browserContextActive: false,
      workspaceBound: true,
      usedNativeTools: false,
      usedManualFallback: false,
      steps: [],
      filesRead: [],
      filesWritten: [],
      filesDeleted: [],
      directoriesCreated: [],
      searches: [],
      commands: [],
      approvals: [],
    };
  }

  startStep(partial: Omit<AgentRunStep, 'startedAt' | 'status'>) {
    const step: AgentRunStep = {
      ...partial,
      startedAt: Date.now(),
      status: 'running',
    };
    this.run.steps.push(step);
    return step.id;
  }

  finishStep(id: string, patch: Partial<AgentRunStep>) {
    const step = this.run.steps.find(s => s.id === id);
    if (!step) return;
    Object.assign(step, patch, { endedAt: Date.now(), status: patch.status ?? 'done' });
  }

  recordFileRead(filePath: string) {
    if (!this.run.filesRead.includes(filePath)) this.run.filesRead.push(filePath);
  }

  recordFileWrite(filePath: string) {
    if (!this.run.filesWritten.includes(filePath)) this.run.filesWritten.push(filePath);
  }

  recordCommand(command: string, success: boolean, durationMs?: number) {
    this.run.commands.push({ command, success, durationMs });
  }

  finalize(summary: string, finalAnswer: string, git?: AgentRun['git']) {
    this.run.endedAt = Date.now();
    this.run.summary = summary;
    this.run.finalAnswer = finalAnswer;
    if (git) this.run.git = git;
    return this.run;
  }
}
```

### 28.4 Stream buffering hook sketch for the web UI

```ts
export function useStreamingBuffer(flushMs = 40) {
  const [value, setValue] = useState('');
  const bufferRef = useRef('');
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (!bufferRef.current) return;
    setValue(prev => prev + bufferRef.current);
    bufferRef.current = '';
    timerRef.current = null;
  }, []);

  const push = useCallback((chunk: string) => {
    bufferRef.current += chunk;
    if (timerRef.current === null) {
      timerRef.current = window.setTimeout(flush, flushMs);
    }
  }, [flush, flushMs]);

  const reset = useCallback(() => {
    bufferRef.current = '';
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setValue('');
  }, []);

  return { value, push, flush, reset };
}
```

### 28.5 Streaming markdown upgrade pattern

```tsx
function AssistantContent({ content, status }: { content: string; status?: string }) {
  const isStreaming = status === 'sending' || status === 'streaming';

  if (isStreaming) {
    return <pre className="stream-plain-text">{content}</pre>;
  }

  return <MarkdownContent content={content} />;
}
```

### 28.6 Poll pause logic sketch

```ts
useEffect(() => {
  if (isSending) return;

  const liveId = window.setInterval(() => {
    void refreshDashboard('live');
  }, 3000);

  const fullId = window.setInterval(() => {
    void refreshDashboard('full');
  }, 15000);

  return () => {
    clearInterval(liveId);
    clearInterval(fullId);
  };
}, [isSending, refreshDashboard]);
```

---

## 29. Exact pain points in the current codebase to address

### 29.1 `browserFolderContextActive` currently collapses real tool usage
In the current `runChat()` flow, when browser folder context is active, normal selected tool choice is disabled. That must be replaced with an explicit distinction:
- `browser snapshot only`
- `browser snapshot plus backend-bound workspace`

If the folder picker successfully maps to a real workspace root, agentic mode should still have normal backend tools.

### 29.2 Generic activity lines are too lossy
The UI currently stores `activity: string[]` and shows those strings as if they were a reliable run log. Replace or augment this with a structured `runSummary` object plus `runSteps`.

### 29.3 Fallback “tool summary markdown” is too weak
The current fallback where the UI synthesizes markdown from completed tool events is not enough. Replace this with a proper backend-generated summary when the assistant narrative is missing.

### 29.4 Full repo indexing should not happen casually during every active turn
`refreshDashboard('full')` fetches workspace index and git diff. This is fine when idle, not fine during active streaming.

---

## 30. Proposed event contract between backend and frontend

Use this as the source of truth:

```ts
interface RunStartedEvent {
  type: 'run_started';
  runId: string;
  sessionId: string;
  intent: string;
  workspaceBound: boolean;
  browserContextActive: boolean;
}

interface RunStepEvent {
  type: 'run_step';
  runId: string;
  step: AgentRunStep;
}

interface RunMetricEvent {
  type: 'run_metric';
  runId: string;
  metrics: Partial<{
    filesRead: number;
    filesWritten: number;
    commandsRun: number;
    searchesRun: number;
    approvals: number;
    addedLines: number;
    removedLines: number;
  }>;
}

interface RunSummaryEvent {
  type: 'run_summary';
  runId: string;
  summary: AgentRun;
}
```

The frontend should trust this contract, not infer facts indirectly.

---

## 31. Required run summary phrasing

For each agentic turn, generate a compact natural-language summary like one of these:

### 31.1 Inspect-only example
> I reviewed the repo structure by reading the root manifest and workspace inventory, then summarized the main apps and packages. I inspected 4 files and did not make any changes.

### 31.2 Edit example
> I updated the web streaming path to buffer text before rendering markdown, paused polling during active turns, and added line-delta reporting. I changed 3 files (+81 / -24) and did not run any shell commands.

### 31.3 Command example
> I ran `npm test` and reviewed the output. No files were changed.

These summaries should be generated from actual run facts, not guessed from text.

---

## 32. Strong guidance for handling Gemma 4

### 32.1 Favor deterministic orchestration over model self-direction
Gemma 4 can still be the synthesis model, but the harness must make more of the operational decisions itself:
- classify,
- decide first tool,
- aggregate result,
- decide if more tool steps are needed,
- only then ask the model to synthesize or choose among limited next actions.

### 32.2 Limit loops
Set a smaller default for low-risk inspect tasks, for example:
- inspect: max 3 loops
- review diff: max 3 loops
- edit: max 5 loops
- command-heavy: max 4 loops

### 32.3 Reduce correction spam
Do not keep injecting correction messages in long chains. After one or two failed attempts, either:
- switch execution strategy,
- or fail honestly with a useful explanation.

---

## 33. Minimum refactor standard for the web UI

Do not leave the giant `HarnessApp.tsx` mostly unchanged. At minimum split out:

- `TopBar`
- `ExplorerSidebar`
- `ChatPanel`
- `AgentRunSummary`
- `ToolActivityList`
- `AssistantMessage`
- `Composer`
- `SettingsDrawer`

Also separate data hooks from presentation components.

---

## 34. Definition of success for the user’s screenshots

When you are done, the harness should feel much closer to the desired behavior shown by the user:
- not just “Preparing agentic run”
- not just “Generating assistant response”
- but concrete operational lines such as:
  - “Listed workspace root”
  - “Read package.json”
  - “Searched createChatCompletion in packages/model-adapter/src/client.ts”
  - “Ran git diff”
  - “Updated apps/web/src/HarnessApp.tsx”
  - “Computed line delta (+81 / -24)”

And after the run:
- “Worked for 42s”
- “Explored 5 files”
- “Ran 1 command”
- “Changed 2 files (+81 / -24)”

---

## 35. Do not regress these existing strengths

The user already likes that:
- direct mode works,
- session continuity is good,
- memory feels shared across direct and agentic modes.

Do not break that. Keep session continuity intact while improving routing and rendering.

---

## 36. Final delivery expectations inside the repo

After coding, the repo should contain:
- actual implementation changes,
- updated docs if needed,
- passing tests,
- no broken build,
- no placeholder TODO stubs for core features.

If you need to add migration or compatibility glue, do it cleanly.

---

## 37. Final instruction

Act like a senior engineer cleaning up a promising but unreliable local agent harness.

Do not be timid.
Do not paper over the problem with more prompt text.
Fix the execution model, the event model, and the UI render path.
Do not Stop until you finish the task listed above
And run audit at least 3 times when you are done to find errors and then patch (Make sure to check your code ) 
