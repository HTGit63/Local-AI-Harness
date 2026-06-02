# Install Guide

## Prerequisites

- Node.js >= 18
- A local `llama.cpp` server binary
- A Gemma 4 E4B GGUF model file
- 16 GB RAM target, CPU-first, no GPU required

## 1. Start The Model Server

Run `llama.cpp` with an OpenAI-compatible endpoint:

```bash
./llama-server \
  -m /path/to/gemma-4-e4b.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192
```

Verify the server:

```bash
curl http://127.0.0.1:8080/v1/models
```

Expected harness defaults:

```bash
export HARNESS_RUNTIME_PROVIDER=llamacpp
export OPENAI_BASE_URL=http://127.0.0.1:8080/v1
export OPENAI_API_KEY=no-key
export HARNESS_MODEL=gemma4:e4b
```

## 2. Install The Harness

```bash
git clone <repo-url> gemma4-harness
cd gemma4-harness
npm install
npm run build
```

## 3. Run Doctor

```bash
node apps/cli/dist/cli.js doctor
```

Doctor checks local config, workspace access, provider setup, and runtime reachability. If the server is offline, the runtime check reports it clearly instead of requiring Ollama.

## 4. Launch The Web UI

```bash
# terminal 1
npm run dev --workspace @local-harness/api

# terminal 2
npm run dev --workspace web
```

Open:

```text
http://localhost:5173
```

The project explorer, file viewer, search, git panels, settings, and runtime card work without loading a model.

## 5. Optional CLI

```bash
node apps/cli/dist/cli.js chat
node apps/cli/dist/cli.js prompt --agent "inspect this repo"
```

The CLI exists for scripting. The Web UI is the primary product surface.

## Optional Ollama Legacy Provider

Ollama can still be used for older local setups:

```bash
export HARNESS_RUNTIME_PROVIDER=ollama-legacy
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama
ollama pull gemma4:e4b
```
