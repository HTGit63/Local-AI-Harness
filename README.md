# Gemma 4 Harness

Web-first local AI coding harness for **Gemma 4 E4B** on a CPU-first Linux machine. The stable runtime target is a local `llama.cpp` server exposing an OpenAI-compatible `/v1` API.

The harness stays useful when no model is loaded. File browsing, file reads, search, git status, git diff, package-script detection, runtime status, and verification command buttons are deterministic backend operations.

## What This Is

- A localhost Web UI for inspecting, planning, editing, verifying, and reviewing code.
- A local API and CLI sharing the same workspace policy, model adapter, tools, sessions, and traces.
- A deterministic tool layer that handles workspace basics without model calls.
- A provider-based runtime adapter. Default: `llamacpp`; optional: `ollama-legacy` and `openai-compatible`.
- A small native skill pack bundled in `packages/skills`, with no required external reference repos.

## What This Is Not

- Not a cloud service.
- Not Ollama-dependent. Ollama is optional legacy support.
- Not a VS Code extension.
- Not a RAG system or full-repo memory system.
- Not a Gemma 4 26B product yet. 26B is future advanced mode after E4B stability.

## Quick Start

Start a local `llama.cpp` server with your Gemma 4 E4B GGUF model:

```bash
./llama-server \
  -m /path/to/gemma-4-e4b.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192
```

Install and run the harness:

```bash
npm install
npm run build

# terminal 1
npm run dev --workspace @local-harness/api

# terminal 2
npm run dev --workspace web
```

Open the Web UI:

```text
http://localhost:5173
```

Run CLI diagnostics when needed:

```bash
node apps/cli/dist/cli.js doctor
node apps/cli/dist/cli.js model status --json
```

## Web UI Workflow

Use the Web UI as the control center:

1. Pick a workspace.
2. Use the project explorer, file viewer, search, git status, and git diff panels without AI.
3. Pick a mode: Chat, Inspect, Plan, Trusted Edit, Full Agent, or Danger Sandbox.
4. Use the runtime card to confirm provider, endpoint, model, and health.
5. Review tool activity, approvals, diffs, terminal output, and verification status in the run panels.
6. Save small project memory facts in Settings only when they help routing.

## Runtime Defaults

| Setting | Default |
|---|---|
| Provider | `llamacpp` |
| Base URL | `http://127.0.0.1:8080/v1` |
| API key | `no-key` |
| Model | `gemma4:e4b` |
| Stable hardware target | 16 GB RAM, CPU-first, no GPU assumption |

Override with:

```bash
export HARNESS_RUNTIME_PROVIDER=llamacpp
export OPENAI_BASE_URL=http://127.0.0.1:8080/v1
export OPENAI_API_KEY=no-key
export HARNESS_MODEL=gemma4:e4b
```

Ollama remains available as a legacy provider:

```bash
export HARNESS_RUNTIME_PROVIDER=ollama-legacy
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama
```

## Modes

| Mode | Purpose |
|---|---|
| Chat | Model chat, no tools by default. |
| Inspect | Deterministic read/search/git tools only; no edits; no model required. |
| Plan | AI can inspect and propose; no edits or hidden checkpoints. |
| Trusted Edit | Scoped in-workspace edits with fewer prompts; protected paths still blocked. |
| Full Agent | Plan, edit, verify, summarize with visible timeline and bounded loops. |
| Danger Sandbox | Advanced sandbox/dev mode; outside-workspace and protected-path boundaries still apply. |

## Docker Run

Docker Compose runs the Web UI and API. The model server still runs separately on the host.

```bash
docker compose up --build
```

Defaults:

- Web UI: `http://localhost:8080`
- API: `http://localhost:3001/api`
- Workspace mount: `${HARNESS_WORKSPACE_SOURCE:-.}` to `/workspace`
- Runtime provider: `${HARNESS_RUNTIME_PROVIDER:-llamacpp}`
- Runtime base URL: `${HARNESS_MODEL_BASE_URL:-http://127.0.0.1:8080/v1}`

Example:

```bash
HARNESS_WORKSPACE_SOURCE=/absolute/path/to/project \
HARNESS_RUNTIME_PROVIDER=llamacpp \
HARNESS_MODEL_BASE_URL=http://127.0.0.1:8080/v1 \
docker compose up --build
```

## Project Structure

```text
apps/
  api/               Local API bridge to the core engine
  cli/               Terminal interface
  web/               Primary localhost Web UI
packages/
  core/              Orchestration engine, modes, memory, run traces
  model-adapter/     Provider-based local runtime client
  workspace-policy/  Mode-based permissions and protected-path checks
  session-store/     File-based session persistence
  trace-bus/         Tool/model/run event bus
  tool-runtime/      Deterministic workspace, git, file, and command tools
  planner/           Run-phase display state
  approval-workflow/ Approval queue and diff review
  repo-indexer/      Lightweight bounded project scanner
  skills/            Native bundled skill pack and exporter
  prompt-recipes/    Prompt patterns for small local models
  doctor/            Diagnostics and benchmarks
tests/               Unit, integration, and e2e tests
docs/                Architecture, safety, install, runtime, and workflow docs
```

`base_repos/` and `third_party/` are not normal project context. They are ignored if they appear locally.

## Development Commands

```bash
npm run build:packages
npm run build:apps
node --import tsx tests/unit/core.test.ts
node --import tsx tests/integration/workflow.test.ts
node --import tsx tests/e2e/cli.test.ts
node --import tsx tests/e2e/api.test.ts
```

## Documentation

| Doc | Purpose |
|---|---|
| [Architecture](docs/architecture.md) | System design |
| [Install Guide](docs/install.md) | Setup and launch |
| [Local Models](docs/local-models.md) | Runtime provider config |
| [Safety](docs/safety.md) | Modes, protected paths, approvals |
| [Skills](docs/skills.md) | Native skill pack |
| [Benchmarks](docs/benchmarks.md) | Measurement guidance |
| [Release Gate](docs/release-gate.md) | Acceptance criteria |

## License

Project source is local-harness code. External reference repos are not required runtime inputs.
