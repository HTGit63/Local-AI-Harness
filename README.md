# Gemma 4 Harness

Web-first local AI coding harness for **Gemma 4 E4B** on a CPU-first Linux machine. Current stable default is local Ollama, with optional `llama.cpp`/GGUF through the same provider adapter.

The harness stays useful when no model is loaded. File browsing, file reads, search, git status, git diff, package-script detection, runtime status, and verification command buttons are deterministic backend operations.

## What This Is

- A localhost Web UI for inspecting, planning, editing, verifying, and reviewing code.
- A local API and CLI sharing the same workspace policy, model adapter, tools, sessions, and traces.
- A deterministic tool layer that handles workspace basics without model calls.
- A provider-based runtime adapter. Default: `ollama-legacy`; optional: `llamacpp` and `openai-compatible`.
- A small native skill pack bundled in `packages/skills`, with no required external reference repos.

## What This Is Not

- Not a cloud service.
- Not cloud-dependent. Ollama is the local default until the GGUF path is fully proven on the target machine.
- Not a VS Code extension.
- Not a RAG system or full-repo memory system.
- Not a Gemma 4 26B product yet. 26B is future advanced mode after E4B stability.

## Quick Start

Start Ollama and confirm at least one local model is installed:

```bash
ollama serve
ollama ls
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

Durable run logs are written under `.gamma-harness/logs/<yyyy-mm-dd>/`. Use
`HARNESS_LOG_PROMPTS=off|summary|full` to control prompt capture; the default is
`summary`. See `docs/observability.md`.

## Runtime Defaults

| Setting | Default |
|---|---|
| Primary provider | `ollama-legacy` |
| Primary base URL | `http://127.0.0.1:11434/v1` |
| Optional GGUF provider | `llamacpp` |
| GGUF base URL | `http://127.0.0.1:8080/v1` |
| API key | `ollama` |
| Default model | `gemma4:e4b-it-qat` |
| Stable hardware target | 16 GB RAM, CPU-first, no GPU assumption |

Override with:

```bash
export HARNESS_RUNTIME_PROVIDER=ollama-legacy
export HARNESS_PRIMARY_RUNTIME=ollama-legacy
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
export OLLAMA_MODEL=gemma4:e4b-it-qat
export OPENAI_API_KEY=ollama
export HARNESS_MODEL=gemma4:e4b-it-qat
```

Optional GGUF path:

```bash
llama-server \
  -m models/<local-model-file>.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192 \
  --alias gemma-4-gguf

export HARNESS_RUNTIME_PROVIDER=llamacpp
export HARNESS_PRIMARY_RUNTIME=llamacpp
export LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
export LLAMACPP_MODEL_ALIAS=gemma-4-gguf
export HARNESS_MODEL=gemma-4-gguf
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
- API through Web UI proxy: `http://localhost:8080/api`
- Internal API service: `api:3001`
- Workspace mount: `${HARNESS_WORKSPACE_SOURCE:-.}` to `/workspace`
- Runtime provider: `${DOCKER_HARNESS_RUNTIME_PROVIDER:-ollama-legacy}`
- Ollama URL: `${DOCKER_HARNESS_OLLAMA_BASE_URL:-http://host.docker.internal:11434/v1}`
- Optional llama.cpp URL: `${DOCKER_HARNESS_LLAMACPP_BASE_URL:-http://host.docker.internal:8081/v1}`
- Runtime model: `${DOCKER_HARNESS_MODEL:-gemma4:e4b-it-qat}`

Docker uses `host.docker.internal` for host model runtimes. Keep `127.0.0.1`
for non-Docker local runs only; inside a container it points back at the
container itself. The compose web UI owns host port `8080`, so run optional
host llama.cpp on `8081` when using Docker.

Example:

```bash
HARNESS_WORKSPACE_SOURCE=/absolute/path/to/project \
DOCKER_HARNESS_RUNTIME_PROVIDER=ollama-legacy \
DOCKER_HARNESS_OLLAMA_BASE_URL=http://host.docker.internal:11434/v1 \
DOCKER_HARNESS_MODEL=gemma4:e4b-it-qat \
docker compose up --build
```

Optional Docker GGUF example:

```bash
llama-server \
  -m models/<local-model-file>.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  --ctx-size 8192 \
  --alias gemma-4-gguf

DOCKER_HARNESS_RUNTIME_PROVIDER=llamacpp \
DOCKER_HARNESS_PRIMARY_RUNTIME=llamacpp \
DOCKER_HARNESS_LLAMACPP_BASE_URL=http://host.docker.internal:8081/v1 \
DOCKER_HARNESS_MODEL=gemma-4-gguf \
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
