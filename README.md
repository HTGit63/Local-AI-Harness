# Gamma 4 Harness

A local-first, offline-capable coding harness optimized for **Gemma 4 E4B** running on CPU-only hardware via **Ollama**.

## What This Is

A self-contained agentic coding assistant that runs entirely on your machine. It provides:
- A **CLI** and **Web UI** for interacting with a local LLM
- **Tool execution** (file read/write, git, shell) with full visibility and approval gates
- **Workspace safety** boundaries preventing silent broad edits
- **Curated skill personas** sourced from vetted upstream repositories
- **Prompt recipes** optimized for small local models

## What This Is Not

- Not a cloud service — everything runs on `localhost`
- Not a VS Code extension (yet) — it's a standalone harness
- Not dependent on GPT-4 or any large model — designed for 4B parameter models
- Not a RAG system — uses lightweight file indexing, not vector databases

## Quick Start

```bash
# 1. Install Ollama and pull the model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull gemma4:e4b

# 2. Install dependencies and build once
npm install
npm run build

# 3. Start the API server in one terminal
npm run dev --workspace @local-harness/api

# 4. Start the Web UI in another terminal
npm run dev --workspace web

# 5. Build the CLI and run diagnostics or chat
npm run build --workspace @local-harness/cli
node apps/cli/dist/cli.js doctor
node apps/cli/dist/cli.js model list --json
node apps/cli/dist/cli.js chat
```

The web UI is organized around:
- A left folder browser that opens local files directly in the browser
- A focused main workspace with tabs for conversation, file preview, activity, history, and settings
- A bottom composer with a `+` button for mode switching (`architecture`, `data analysis`, `code review`, `implementation`, `general`)

## Using Models

Installed local models are discovered from Ollama automatically. The harness can switch between them and, when Ollama lifecycle control is available, it unloads the previous running model before warming the requested one.

Current local models on this machine:
- `gemma4:e4b`
- `qwen3.5:9b-q4_K_M`
- `deepseek-coder-v2:latest`

CLI:

```bash
# Show installed and active models
node apps/cli/dist/cli.js model status --json
node apps/cli/dist/cli.js model list --json

# Activate a model
node apps/cli/dist/cli.js model use gemma4:e4b --json
node apps/cli/dist/cli.js model use qwen3.5:9b-q4_K_M --json
node apps/cli/dist/cli.js model use deepseek-coder-v2:latest --json

# Verify what Ollama actually has loaded
ollama ps
```

Web UI:

1. Open `http://localhost:8080`
2. Go to `Settings`
3. Pick a model from the `Model` dropdown
4. Click `Save runtime config`
5. Confirm the `Active:` badge and the `Model runtime` card show the requested model

The top bar shows the selected model and the active loaded model separately, so you can tell whether the backend config and the live Ollama runtime match.

## Docker Run

If you want to run the harness without leaving the IDE open, use Docker Compose from the repo root:

```bash
docker compose up --build
```

This starts:
- Web UI on `http://localhost:8080`
- API on `http://localhost:3001`

Notes:
- The web container proxies `/api` to the API container, so the browser UI works as a single app.
- The API container mounts `${HARNESS_WORKSPACE_SOURCE:-.}` into `/workspace`, which means it can operate on the current repo by default.
- On Linux, the API container uses host networking so it can reach Ollama on the host loopback address by default.
- The API uses `${HARNESS_MODEL_BASE_URL:-http://127.0.0.1:11434/v1}` by default.
- Use `http://localhost:8080` in your browser for the app. If you want to probe the API directly, use `http://localhost:3001/api/health`.
- Do not browse to `http://0.0.0.0:3001`; `0.0.0.0` is only the bind address shown in server logs.
- To point the container at a different repo or folder, set `HARNESS_WORKSPACE_SOURCE` before running Compose.

Example:

```bash
HARNESS_WORKSPACE_SOURCE=/absolute/path/to/your/project \
HARNESS_MODEL_BASE_URL=http://127.0.0.1:11434/v1 \
docker compose up --build
```

## Project Structure

```
├── apps/
│   ├── cli/              # Terminal interface
│   └── web/              # Localhost web UI (Vite + React)
├── packages/
│   ├── model-adapter/    # Ollama/OpenAI-compatible client
│   ├── workspace-policy/ # Read-only / write / danger modes
│   ├── session-store/    # File-based session persistence
│   ├── trace-bus/        # Event bus for tool execution logging
│   ├── tool-runtime/     # File, git, and shell tools
│   ├── planner/          # UX-friendly execution state traces
│   ├── approval-workflow/# Pending write queue and diff approval
│   ├── repo-indexer/     # Lightweight project context scanner
│   ├── skills/           # Skill indexer and Antigravity exporter
│   ├── prompt-recipes/   # Optimized prompt patterns for local models
│   └── doctor/           # Diagnostics and benchmarking
├── third_party/          # Vendored upstream repos (read-only)
├── tests/                # Unit, integration, and e2e tests
└── docs/                 # Architecture, safety, install guides
```

## Documentation

| Doc | Purpose |
|---|---|
| [Architecture](docs/architecture.md) | System design and component diagram |
| [Install Guide](docs/install.md) | Step-by-step setup |
| [Local Models](docs/local-models.md) | Ollama configuration and profiles |
| [Skills](docs/skills.md) | Skill system and persona activation |
| [Prompt Recipes](docs/prompt-recipes.md) | Optimized prompt patterns |
| [Safety](docs/safety.md) | Workspace boundaries and approval gates |
| [Approvals](docs/approvals.md) | Diff review and write control |
| [Antigravity](docs/antigravity.md) | Skill export and IDE integration |
| [Benchmarks](docs/benchmarks.md) | Performance baselines |
| [Provenance](docs/provenance-map.md) | Upstream repo origins and licenses |

## License

See individual vendored repositories in `third_party/` for their respective licenses.
