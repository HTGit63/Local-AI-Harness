
# AGENTS.md - Offline Local Coding Harness Build Contract

> Status date: `2026-04-11`
>
> Audit snapshot: `2026-04-11`
>
> The 20 build-contract tasks below were re-audited against the current codebase, docs, and executable checks. The repo now builds cleanly, the automated suite passes, `doctor --json` and `benchmark --json` return machine-readable output, the web/API approval flow is covered end-to-end, and the remaining doc drift found during audit has been corrected.

## Current Audit Snapshot

| Task | Status | Audit note |
|---|---|---|
| 1 Vendor Intake | Verified | `third_party/` contains all four repos and `third_party/manifest.json` is present. |
| 2 Capability Audit | Verified | `docs/capability-matrix.md` and `docs/decision-records/0001-upstream-selection.md` exist and match the current architecture. |
| 3 Architecture Selection | Verified | `docs/architecture.md` matches the shared core, CLI, API, and web package graph. |
| 4 Model Adapter | Verified | Ollama health/model listing works and runtime config updates now propagate into the adapter. |
| 5 Session + Workspace Policy | Verified | Session persistence, resume, and workspace boundary denial are exercised in tests and API e2e. |
| 6 Tool Runtime | Verified | Safe argument-based command execution, diff previews, approval hooks, and directory deletion all work. |
| 7 Planner + Trace | Verified | Planner state is integrated through `CoreEngine`, trace bus events, CLI, API, and web UI. |
| 8 Web UI Foundation | Verified | Web UI provides folder browsing, chat rail, mode picker, approvals, trace, history, and runtime settings. |
| 9 CLI Surface | Verified | `doctor`, `prompt`, `chat`, `session`, `workspace`, `skills`, `model`, and `config` commands work. |
| 10 Skills Ingestion | Verified | `agency-agents` is indexed into 150 skills with a 12-skill curated pack and Antigravity exports. |
| 11 Prompt Recipes | Verified | Prompt recipes exist as runtime assets and are now intentionally selected during chat execution. |
| 12 Local Prompt Optimization | Verified | Local-model profiles and prompt reframe logic are wired into the runtime. |
| 13 Approval + Diff Workflow | Verified | Pending approval queue, live diff preview updates, and approve/reject flow work through the API. |
| 14 Repo Indexing | Verified | Repo indexing is wired into core, API, and web surfaces for workspace context. |
| 15 Doctor + Benchmarks | Verified | Diagnostics and benchmarks both run, and JSON mode is now clean for automation. |
| 16 Antigravity + IDE | Verified | Antigravity export path works and integration docs state the runtime boundary honestly. |
| 17 Packaging Path | Verified | Packaging docs now reflect the real web -> API -> Ollama topology and portability constraints. |
| 18 Test Strategy | Verified | Unit, integration, CLI e2e, and API e2e coverage now exercise critical safety and workflow paths. |
| 19 Docs + Operator UX | Verified | README and operator docs were updated to match the shipped commands, counts, and process layout. |
| 20 Release Gate | Verified | Build, tests, diagnostics, prompt flow, approval flow, and local-model checks pass on the current tree. |
>
> This project is a new build. The mission is not to recreate any upstream project wholesale.
> The mission is to build a local-first coding harness that works offline on consumer hardware, uses Gemma through Ollama, exposes a simple localhost web UI, supports CLI and web control surfaces, preserves reusable skill and prompt assets from the reference repos, and avoids importing heavyweight or cloud-first assumptions that do not fit the target machine.
>
> The target user environment is a Linux laptop with roughly `16 GB RAM`, CPU-first inference, and a working local Ollama installation where `gemma4:e4b` runs successfully while `gemma4:26b` does not fit reliably. Every architectural choice must respect that fact.

## 0. Project Snapshot

### Goal

Build a **local coding harness** with these characteristics:

- Runs offline after initial setup
- Uses **Ollama** as the model server
- Uses **Gemma 4 E4B** as the default local model
- Exposes a **web UI on localhost**
- Also exposes a CLI entry point
- Shows clear operational trace of what the agent is doing
- Uses curated skills and prompt recipes derived from the reference repositories
- Supports guarded file operations with workspace boundaries
- Is lightweight enough to feel usable on CPU-only hardware

### Non-goals

Do **not** build any of the following in v1:

- A full multi-channel assistant like WhatsApp/Telegram/Signal/iMessage routing
- A cloud-first Claude clone
- A full OpenClaw gateway deployment
- A massive multi-agent swarm with opaque behavior
- A model-training system
- A raw chain-of-thought viewer
- A general-purpose browser automation system unless it is explicitly useful for local coding tasks
- A hardware profile that assumes strong GPU inference

### Reference repositories to inspect and vendor

1. `openclaw/openclaw`
2. `ultraworkers/claw-code`
3. `msitarzewski/agency-agents`
4. `dair-ai/Prompt-Engineering-Guide`

### Source-repo role assignment

- **`openclaw/openclaw`**  
  Mine for architecture ideas around local-first control planes, web/chat surfaces, workspace semantics, skills packaging ideas, and operator UX.  
  Do **not** copy the multi-channel messaging stack, mobile node stack, or whole gateway complexity into v1.

- **`ultraworkers/claw-code`**  
  Mine for CLI harness behavior, session model, permission modes, slash-command ideas, workspace-write safety, and provider-routing patterns for OpenAI-compatible local endpoints.  
  Do **not** inherit Anthropic-first defaults, heavy local-model assumptions, or weak UX around tiny local models.

- **`msitarzewski/agency-agents`**  
  Preserve the full agent library and integration assets in the repository vendor area. Use it as the primary source of reusable specialist skills, personas, and skill formatting for downstream integrations such as Antigravity.  
  Do **not** turn all agents on by default. Curate and route them.

- **`dair-ai/Prompt-Engineering-Guide`**  
  Preserve the full documentation and technique corpus in the repository vendor area. Use it to create prompt recipes, evaluation prompts, tool-use patterns, and policy templates.  
  Do **not** mistake it for runtime code.

## 1. Working Rules

- Work in the new project repository only.
- Clone all four upstream repositories into a `third_party/` or `vendor/` area first.
- Preserve upstream repositories as references. Do not destructively modify vendored source.
- When code is borrowed from upstream, annotate provenance in comments and docs.
- Favor composition over direct merging.
- The runtime must work with **local OpenAI-compatible/Ollama endpoints** first.
- Default model path must be:
  - base URL: `http://127.0.0.1:11434/v1`
  - model: `gemma4:e4b`
- Do not hard-require Anthropic, OpenAI, xAI, or DashScope credentials.
- The web UI must run locally on `localhost` and remain functional offline.
- The CLI and web UI must hit the same shared core runtime, not duplicated logic.
- Show execution trace, tool calls, plan state, and decisions, but **do not expose hidden raw chain-of-thought**. Show concise reasoning summaries and tool traces instead.
- Every tool action that can modify files must be bounded by workspace policy.
- Human confirmation must exist for risky or broad write operations.
- Optimize for usability on CPU-only hardware with limited RAM.
- If a feature makes the system materially slower without strong value, reject it or defer it.
- Treat `gemma4:e4b` as the guaranteed target; treat larger models as optional future work.
- The final system must be understandable by one developer working locally, not only by a large team.

## 2. Build Contract

The finished project must include these first-class surfaces:

### Required surfaces

- **Core engine**
  - model adapter
  - session manager
  - task planner
  - tool router
  - skill manager
  - prompt recipe manager
  - workspace policy engine
  - event stream / trace bus

- **CLI**
  - one-shot prompt mode
  - interactive REPL mode
  - slash-command style controls for status, model, permissions, sessions, skills, and doctor

- **Web UI**
  - single localhost app
  - chat/task panel
  - live event/trace panel
  - current workspace panel
  - skill picker
  - approval controls for file writes
  - session history
  - basic settings page

- **Vendor / knowledge preservation**
  - full vendored copies of `agency-agents` and `Prompt-Engineering-Guide`
  - a curated extracted layer used by the runtime
  - a provenance map documenting where each curated skill or prompt recipe came from

### Required runtime posture

- Offline-first after initial clone/install
- Local model first
- Web UI first for visibility
- CLI parity for scripting and terminal workflows
- Safe workspace boundaries
- Explicit approval for risky actions
- Fast startup on local hardware
- No mandatory internet dependency during normal coding use

## 3. Repository Intake Map

This section is the minimum intake contract Codex must follow before designing or copying anything.

### 3A. `openclaw/openclaw`

Inspect at minimum:

- `README.md`
- top-level package/workspace config
- web UI entry points
- gateway/control-plane entry points
- skills/workspace configuration files
- docs or code that define:
  - workspace root
  - agent config
  - skills
  - web surfaces
  - control UI
  - model selection
  - model failover

What to keep:

- Local-first architecture mindset
- Gateway/control-plane concepts
- WebChat/control UI ideas
- Skills/workspace injection concepts
- Session and agent isolation ideas
- Good operator ergonomics

What to avoid in v1:

- Multi-channel inbox sprawl
- Mobile/node infrastructure
- Voice wake, camera, device nodes, and remote messaging complexity
- Tailnet/Serve/Funnel complexity unless needed later
- Massive surface area that hurts local maintainability

### 3B. `ultraworkers/claw-code`

Inspect at minimum:

- `README.md`
- `USAGE.md`
- `PARITY.md`
- `PHILOSOPHY.md`
- `rust/README.md`
- `rust/crates/api/`
- `rust/crates/runtime/`
- `rust/crates/commands/`
- `rust/crates/tools/`
- `rust/crates/plugins/`
- `rust/crates/rusty-claude-cli/`

What to keep:

- CLI harness patterns
- REPL ideas
- Slash commands
- Session model
- Permission modes (`read-only`, `workspace-write`, `danger-full-access`)
- OpenAI-compatible local-provider route
- Workspace config resolution
- Tool routing patterns
- Session persistence ideas

What to avoid or rewrite:

- Anthropic-first defaults
- Poor local-small-model defaults
- Any hard-coded output budgets unsuitable for Gemma E4B
- UX that says “Thinking…” too long without useful trace output
- Behavior that lets the model summarize instead of using tools when file action is required
- Opaque text-mode output paths

### 3C. `msitarzewski/agency-agents`

Inspect at minimum:

- `README.md`
- all major division directories:
  - `engineering/`
  - `design/`
  - `marketing/`
  - `product/`
  - `project-management/`
  - `testing/`
  - `support/`
  - `specialized/`
- `scripts/convert.sh`
- `scripts/install.sh`
- `integrations/`
- especially:
  - `integrations/antigravity/`
  - `integrations/openclaw/`
  - `integrations/opencode/`
  - `integrations/claude-code/`
  - `integrations/cursor/`
  - `integrations/aider/`
  - `integrations/windsurf/`

What to keep:

- Full agent library vendored intact
- All integration assets preserved
- Antigravity skill formatting
- OpenClaw-compatible agent packaging concepts
- Good role descriptions, mission blocks, and workflows
- Curated specialist modes for coding, review, product, testing, and writing

What to avoid:

- Enabling 100+ agents blindly
- Treating every persona as equally valuable for local coding
- Letting agent personality override operational clarity
- Creating a confusing skill explosion in the UI

### 3D. `dair-ai/Prompt-Engineering-Guide`

Inspect at minimum:

- `README.md`
- prompt technique docs
- applications docs
- prompt hub
- risk/misuse docs
- model notes
- notebooks
- lecture content if useful

What to keep:

- Prompt design patterns
- Prompt chaining
- ReAct-style tool prompting
- Self-consistency and evaluation concepts
- RAG/retrieval guidance
- Function/tool-calling prompting ideas
- Risk and factuality guidance
- Good prompting examples for coding, summarization, extraction, reasoning, and evaluation

What to avoid:

- Treating the guide as executable runtime logic
- Over-complicating prompts for a small local model
- Pulling in every possible technique whether or not it helps Gemma E4B

## 4. New Project Structure Contract

Create a clean new repository structure like this unless a clearly better equivalent emerges:

```text
local-harness/
  AGENTS.md
  README.md
  docs/
    architecture.md
    repo-intake.md
    safety.md
    model-routing.md
    ui.md
    skills.md
    evaluation.md
    performance.md
  third_party/
    openclaw/
    claw-code/
    agency-agents/
    Prompt-Engineering-Guide/
  packages/
    core/
    model-adapter/
    session-store/
    workspace-policy/
    tool-runtime/
    planner/
    skills/
    prompt-recipes/
    trace-bus/
    exporters/
  apps/
    web/
    cli/
  tests/
    unit/
    integration/
    e2e/
  scripts/
    vendor-sync/
    index-skills/
    build-recipes/
    benchmark/
```

### Language recommendation

Use **TypeScript** for the main implementation unless there is a compelling reason to isolate one subsystem in Rust later.

Why:

- Easy to integrate web UI and CLI
- Easy to talk to Ollama over HTTP
- Easier to build on local Linux quickly
- Easier to package for a standalone app later with Tauri/Electron if desired
- Easier to transform `agency-agents` and prompt-guide assets into runtime-readable metadata

Rust may be used later for one or two performance-sensitive subsystems, but not as the default for the first pass.

## 5. Task 1 - Vendor Intake and Provenance Baseline

### Objective

Create a deterministic and documented intake process for all four upstream repositories so the new harness is legally, technically, and operationally understandable.

### Required work

- Clone all four repositories under `third_party/`
- Record:
  - upstream URL
  - default branch
  - pinned commit SHA
  - last sync date
  - local path
- Create `docs/repo-intake.md`
- Create `docs/provenance-map.md`
- Create a machine-readable manifest:
  - `third_party/manifest.json`

### Required outcomes

- A single manifest exists for all upstream repos
- Vendored repos are preserved intact
- There is a documented rule for what may be copied, wrapped, referenced, or transformed
- Codex documents license and attribution obligations
- The new repo can later resync upstream sources without confusion

### Guardrails

- Do not manually cherry-pick files before the manifest exists
- Do not flatten the repositories into one blob
- Do not lose provenance when copying code or prompts

### Done means

- All four repos are present locally
- Intake documentation exists
- Provenance and sync rules are written down
- Future contributors can trace every borrowed piece back to upstream

## 6. Task 2 - Capability Audit of Each Upstream Repo

### Objective

Turn the upstream repos into a capability matrix that makes architectural decisions obvious instead of emotional.

### Required work

Create `docs/capability-matrix.md` with these columns:

- repository
- surface type
- runtime or reference
- strongest features
- weak features
- local-offline suitability
- direct import candidates
- wrap-only candidates
- do-not-import candidates
- notes for Gemma E4B compatibility

### Required judgments

- `openclaw` must be judged primarily as a broad assistant platform, not a coding harness
- `claw-code` must be judged primarily as a CLI harness, not a general personal assistant
- `agency-agents` must be judged as a skill/persona library, not a runtime
- `Prompt-Engineering-Guide` must be judged as a design/reference library, not implementation code

### Deliverables

- `docs/capability-matrix.md`
- a short `docs/decision-records/0001-upstream-selection.md`

### Done means

- The new project has an explicit keep/avoid matrix for each repo
- The team can explain why certain code is copied, wrapped, or ignored

## 7. Task 3 - Runtime Architecture Selection

### Objective

Define the architecture of the new harness before writing feature code.

### Required work

Create `docs/architecture.md` that locks in:

- local model server: Ollama
- default model: `gemma4:e4b`
- transport: OpenAI-compatible `/v1`
- runtime composition:
  - core engine
  - planner
  - tool runtime
  - skill manager
  - UI event bus
  - session storage
  - workspace policy
- surfaces:
  - CLI
  - web UI
- visibility:
  - tool trace
  - current action
  - decision summary
  - approval queue
- storage:
  - local file-based or SQLite session storage
- extension path:
  - Antigravity exporter
  - future VS Code integration
  - future standalone app packaging

### Hard rule

Do **not** build around raw chain-of-thought exposure. Build around:

- current plan
- active phase
- tool name
- tool input summary
- tool output summary
- file diffs
- concise rationale blocks

### Done means

- Architecture is documented and approved in the repo
- No one is still trying to merge all upstream repos directly

## 8. Task 4 - Local Model Adapter

### Objective

Build a clean model adapter for Ollama/OpenAI-compatible local inference.

### Required work

Implement `packages/model-adapter/` with:

- configurable base URL
- configurable model name
- sensible defaults:
  - `OPENAI_BASE_URL=http://127.0.0.1:11434/v1`
  - `OPENAI_API_KEY=ollama`
  - model `gemma4:e4b`
- streaming response support
- timeout handling
- retry policy
- health check
- model listing
- graceful degraded mode when the model is unavailable

### Optimization requirements

- token budgets must be conservative and local-model friendly
- avoid cloud-style giant max-token defaults
- support different profiles:
  - `fast`
  - `balanced`
  - `deep`
- profile tuning must be stored in config

### Done means

- The runtime can talk to Ollama reliably
- Health checks exist
- Model config is local-first
- The adapter can be reused by both CLI and web UI

## 9. Task 5 - Session Model and Workspace Policy

### Objective

Recreate the good parts of `claw-code` session discipline while improving local usability.

### Required work

Implement:

- session persistence
- workspace root detection
- read-only mode
- workspace-write mode
- danger mode, disabled by default
- per-session tool allowlist
- session metadata:
  - model
  - mode
  - cwd
  - skills active
  - timestamps
- session resume in CLI and web UI

### Safety requirements

- Writes must be denied outside workspace in workspace-write mode
- Approval prompts must exist for broad file creation, rename, delete, or multi-file writes
- File diffs must be shown before commit-style acceptance when relevant

### Done means

- Workspace boundaries work
- Session persistence is reliable
- CLI and web UI see the same sessions

## 10. Task 6 - Tool Runtime

### Objective

Implement a lightweight but reliable tool runtime optimized for coding work.

### Minimum tools for v1

- `glob`
- `read_file`
- `search_text`
- `list_dir`
- `write_file`
- `patch_file`
- `make_dir`
- `delete_file` (approval-gated)
- `run_command` (read-only safe subset first)
- `git_status`
- `git_diff`

### Required behavior

- Every tool call emits an event into the trace bus
- Every tool call is logged with:
  - tool name
  - timestamp
  - input summary
  - output summary
  - approval state if relevant
- The tool layer must support “preview before apply” for file modifications

### Hard rule

The model must not be allowed to silently modify files. The user must be able to see pending writes or diffs.

### Done means

- Tool runtime exists
- Tools are evented, bounded, and inspectable
- File changes are legible and safe

## 11. Task 7 - Planner and Action Trace Design

### Objective

Give the user visibility into what the harness is doing without exposing hidden raw reasoning.

### Required work

Implement a planner/trace layer that shows:

- task summary
- current phase
- active skill(s)
- intended next action
- tool calls
- result summaries
- blockers
- final outcome

### UI/UX requirement

The trace must feel alive but lightweight. It should answer:

- What is the agent doing?
- What tool is it using?
- Why is it doing that at a high level?
- What file is it about to change?
- What changed?
- What is waiting on me?

### Avoid

- giant verbose thought dumps
- fake “thinking” without operational content
- hidden file edits
- spinner-only UX

### Done means

- The system has a visible and useful action trace
- Users can understand behavior without reading logs

## 12. Task 8 - Web UI Foundation

### Objective

Create the localhost web interface that becomes the main human-facing surface.

### Required views

- home / session launcher
- active session view
- trace/event panel
- workspace file/diff panel
- skill picker
- settings / model config
- approvals queue
- history / saved sessions

### UI requirements

- minimal, fast, readable
- dark mode default acceptable
- keyboard-friendly
- no bloated design system required in v1
- built for clarity over decoration

### Functional requirements

- start a task
- watch it work
- approve or reject risky actions
- switch skills
- inspect diffs
- resume prior sessions
- change model profile

### Done means

- The web UI is usable on localhost
- It exposes the runtime clearly
- It is better than a terminal-only experience for understanding agent behavior

## 13. Task 9 - CLI Surface

### Objective

Provide a real CLI harness, not only a web app.

### Required commands

- `doctor`
- `prompt`
- `chat`
- `session list`
- `session resume`
- `workspace status`
- `skills list`
- `skills activate`
- `model list`
- `config show`

### Desired behavior

- CLI uses the same core engine as web
- REPL mode exists
- one-shot mode exists
- output can be plain text or JSON
- compact mode exists for local model performance

### Done means

- CLI and web parity exists for core features
- CLI is scriptable
- CLI is usable without needing the browser

## 14. Task 10 - Skills Ingestion from `agency-agents`

### Objective

Preserve and transform `agency-agents` into a curated skill system for the new harness.

### Required work

- Preserve the full vendored repo
- Build an indexer that parses agent files
- Create metadata for each skill:
  - slug
  - title
  - division
  - description
  - source file
  - source repo
  - tags
  - recommended use
  - risk level if available
- Create a curated default pack focused on local coding:
  - frontend developer
  - backend architect
  - rapid prototyper
  - code reviewer
  - technical writer
  - product manager
  - reality checker
  - workflow architect
  - MCP builder
  - software architect
  - database optimizer
  - security engineer

### Antigravity requirement

Preserve or regenerate Antigravity-compatible skill exports modeled after the repo’s Antigravity integration assets.

### Done means

- Full skills are preserved
- A curated operational subset exists
- Skills can be activated in the new harness
- Antigravity export path exists

## 15. Task 11 - Prompt Recipe Library from `Prompt-Engineering-Guide`

### Objective

Turn the prompt guide into a practical recipe and evaluation library rather than leaving it as a passive pile of docs.

### Required work

Build `packages/prompt-recipes/` and `docs/prompt-recipes.md` with extracted patterns for:

- baseline instruction prompts
- zero-shot
- few-shot
- prompt chaining
- ReAct/tool prompting
- evaluation prompts
- factuality guards
- summarization patterns
- code review patterns
- file synthesis patterns
- patch planning patterns
- self-check prompts suitable for small local models

### Hard rule

Do not over-engineer prompts for Gemma E4B. Keep recipes short, strong, and local-model friendly.

### Done means

- Recipes exist as reusable assets
- The runtime can choose or apply recipes intentionally
- Prompt guide knowledge is preserved and operationalized

## 16. Task 12 - Local Model Prompt Optimization

### Objective

Tune the harness specifically for Gemma 4 E4B on local CPU hardware.

### Required work

- Create small-model prompt policies
- Reduce unnecessary verbosity
- Avoid huge max-token requests
- Add mode profiles for:
  - quick inspect
  - code review
  - targeted edit
  - doc generation
- Add fallback behavior when a task is too broad
- Add forced decomposition for large tasks

### Important behavior

If the model starts summarizing when it should use tools, the runtime should:
- reframe
- narrow
- ask for tool-first behavior
- or request human confirmation for next step

### Done means

- Small local model behavior improves
- The harness is measurably more reliable than naïve prompting
- Gemma E4B is treated as the real target, not an afterthought

## 17. Task 13 - Approval and Diff Workflow

### Objective

Make file modification safe and legible.

### Required work

Implement:

- pending write queue
- diff preview
- approve/reject/edit instruction loop
- single-file and multi-file approvals
- overwrite warning
- new-file warning
- delete warning
- outside-workspace denial

### UI requirements

Approvals must be easy in both:
- web UI
- CLI

### Done means

- The system cannot quietly write broad changes
- The user can inspect diffs and control changes
- Agentic coding becomes practically usable instead of scary

## 18. Task 14 - Project Indexing and Repo Understanding

### Objective

Give the harness a modest but useful repo-understanding layer without turning v1 into a huge RAG system.

### Required work

Implement lightweight indexing for:

- file tree
- entry files
- dependency manifests
- exports/imports
- readme/docs
- common config files

### Do not build in v1

- giant vector DB complexity
- internet retrieval dependency
- bloated semantic pipeline

### Good enough v1 behavior

- quickly identify app entry points
- quickly find relevant files
- maintain a small project memory summary per workspace
- store index artifacts locally

### Done means

- The agent can orient itself in a repo faster
- The user sees what context the harness is using

## 19. Task 15 - Doctor, Diagnostics, and Benchmarking

### Objective

Build a strong local-first doctor command and benchmark suite.

### Required checks

- Ollama reachable
- selected model installed
- base URL valid
- API key placeholder valid for local use
- write permission to workspace
- session store healthy
- trace bus healthy
- skill index present
- prompt recipe index present
- UI server starts
- CLI commands resolve

### Benchmark requirements

Measure:
- cold prompt latency
- warm prompt latency
- tool-call loop latency
- file read latency
- write-preview latency
- UI event lag

### Done means

- `doctor` gives useful answers
- Benchmarking exists
- Performance tuning has a baseline

## 20. Task 16 - Antigravity and IDE Integration Path

### Objective

Make the new harness compatible with the user’s preferred tools without pretending unsupported integrations already exist.

### Required work

- Build an exporter for Antigravity-compatible `SKILL.md` skills
- Document how to install exported skills into:
  - `~/.gemini/antigravity/skills/`
- Build a small integration doc for:
  - VS Code local use via Ollama/OpenAI-compatible endpoint
  - Antigravity skill export and usage
- Separate clearly:
  - skills/personas
  - model backend
  - runtime harness

### Hard truth to preserve

Antigravity skill support does **not** automatically mean Antigravity will use the harness runtime or model backend. Document the boundary clearly.

### Done means

- Antigravity export exists
- IDE integration docs are honest
- No fake promises about unsupported integrations remain

## 21. Task 17 - Minimal Web-to-Standalone Packaging Path

### Objective

Prepare the project so it can later become a standalone desktop app without changing the whole architecture.

### Required work

- Keep the web UI and local server packaging-friendly
- Avoid architecture that prevents Tauri or Electron packaging later
- Add docs describing:
  - web-only localhost mode
  - future desktop bundle mode
- Keep local storage and config paths portable

### Done means

- The project can stay web-based now
- It has a clean path to become a standalone app later

## 22. Task 18 - Test Strategy

### Objective

Build a meaningful test strategy for an offline coding harness.

### Required test layers

- unit tests for:
  - config
  - model adapter
  - workspace policy
  - skill parser
  - prompt recipe loader
- integration tests for:
  - tool calls
  - session persistence
  - approval queue
  - model adapter mocking
- e2e tests for:
  - CLI prompt flow
  - web session flow
  - diff approval flow
  - workspace boundary enforcement

### Special requirement

Add mocked model responses so tests do not require live Ollama for every run.

### Done means

- The repo has automated test coverage for its critical safety and workflow surfaces

## 23. Task 19 - Documentation and Operator UX

### Objective

Make the project easy to install, understand, and operate.

### Required docs

- `README.md`
- `docs/architecture.md`
- `docs/install.md`
- `docs/local-models.md`
- `docs/skills.md`
- `docs/prompt-recipes.md`
- `docs/safety.md`
- `docs/approvals.md`
- `docs/antigravity.md`
- `docs/benchmarks.md`

### Required UX quality

The docs must explain:
- what this is
- what it is not
- how to run it locally
- how to point it at Gemma/Ollama
- how to activate skills
- how to approve writes
- why it shows reasoning summaries instead of hidden chain-of-thought
- where upstream material came from

### Done means

- A new developer can install and run the harness without guesswork
- The user understands the system boundaries

## 24. Task 20 - Release Gate

### Objective

Define the final acceptance gate before calling the harness usable.

### Required acceptance criteria

- Local Ollama integration works with `gemma4:e4b`
- CLI one-shot and interactive modes work
- Web UI works on localhost
- Skills index is built
- Prompt recipe library is built
- At least one curated coding workflow works end-to-end:
  - inspect project
  - locate main files
  - propose change
  - show diff
  - write after approval
- Workspace boundary enforcement works
- Tool traces are visible
- `doctor` passes
- basic benchmarks are recorded
- docs are present
- vendored repo provenance is documented

### Explicit failure conditions

Do not call the project ready if any of these are true:

- It only works when online
- It only works in CLI and not web
- It hides file changes
- It silently writes broad edits
- It depends on a bigger model than E4B
- It cannot explain what skill/prompt recipe it is using
- It merges upstream repos into an untraceable mess

## 25. Coding and Review Rules

- Prefer boring and readable code.
- Keep core engine interfaces small.
- Favor explicit config over magic.
- Every cross-package dependency must be justified.
- Do not let UI code import core runtime internals directly; go through stable interfaces.
- Every borrowed upstream pattern should be adapted to the local model reality.
- Every risky file operation must pass through policy + approval.
- Keep the number of always-on background workers low.

## 26. First Curated Feature Set

The first usable release should focus on exactly these jobs:

1. Inspect a folder
2. Read key files
3. Summarize project structure
4. Draft a README or report
5. Propose a targeted code change
6. Show a diff
7. Write only after approval
8. Activate one specialist skill at a time
9. Save and resume the session
10. Display an intelligible action trace

Do **not** chase multi-agent autonomy before these are solid.

## 27. Final Direction for Codex

Codex must treat this project as a **new composition build**, not a “fork one repo and bolt the others on” task.

### Priority order

1. Build the **new runtime and UI** around local Ollama
2. Borrow the **best harness patterns** from `claw-code`
3. Borrow the **best control/UI ideas** from `openclaw`
4. Preserve and operationalize **all skills** from `agency-agents`
5. Preserve and operationalize **all prompt techniques/docs** from `Prompt-Engineering-Guide`
6. Optimize for **Gemma 4 E4B on local CPU hardware**
7. Keep the result explainable, bounded, and safe

### The correct mindset

- Not the biggest bot
- Not the most agents
- Not the most integrations
- The best **local offline coding harness** for this machine and workflow

## 28. Exit Criteria

The work is only on track when all of the following are true:

- All four repos are vendored and documented
- The architecture is written down
- The runtime is local-first
- The web UI exists and runs on localhost
- The CLI exists and is useful
- Skills are preserved and indexed
- Prompt recipes are preserved and indexed
- The harness can inspect, plan, diff, and write safely
- The system is tuned for Gemma E4B
- Antigravity export exists
- Documentation is honest about boundaries
- Upstream provenance is preserved
- The project feels faster, clearer, and safer than forcing raw `claw-code` to do everything locally
