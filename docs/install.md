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
  -m models/<local-model-file>.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192 \
  --alias gemma-4-gguf
```

Verify the server:

```bash
curl http://127.0.0.1:8080/v1/models
```

Expected harness defaults:

```bash
export HARNESS_RUNTIME_PROVIDER=llamacpp
export HARNESS_PRIMARY_RUNTIME=llamacpp
export LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
export LLAMACPP_MODEL_PATH=models/<local-model-file>.gguf
export LLAMACPP_MODEL_ALIAS=gemma-4-gguf
export HARNESS_MODEL=gemma-4-gguf
export HARNESS_ENABLE_OLLAMA_FALLBACK=true
export HARNESS_FALLBACK_RUNTIME=ollama-legacy
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
export OLLAMA_MODEL=gemma4:e4b
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

Doctor checks local config, workspace access, provider setup, and runtime reachability. If the llama.cpp primary server is offline, the runtime status reports it clearly and only uses Ollama as a visible fallback when enabled.

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
export HARNESS_ENABLE_OLLAMA_FALLBACK=true
export HARNESS_FALLBACK_RUNTIME=ollama-legacy
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
export OLLAMA_MODEL=gemma4:e4b
ollama pull gemma4:e4b
```
