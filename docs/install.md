# Install Guide

## Prerequisites

- Node.js >= 18
- Ollama with at least one local model installed
- Optional: a local `llama.cpp` server binary and Gemma 4 E4B GGUF model file
- 16 GB RAM target, CPU-first, no GPU required

## 1. Start The Model Server

Run Ollama:

```bash
ollama serve
ollama ls
```

Verify the server:

```bash
curl http://127.0.0.1:11434/v1/models
```

Expected harness defaults:

```bash
export HARNESS_RUNTIME_PROVIDER=ollama-legacy
export HARNESS_PRIMARY_RUNTIME=ollama-legacy
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
export OLLAMA_MODEL=gemma4:e4b-it-qat
export HARNESS_MODEL=gemma4:e4b-it-qat
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

Doctor checks local config, workspace access, provider setup, and runtime reachability.

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

## Optional llama.cpp / GGUF Provider

Use GGUF when `llama-server` is ready:

```bash
./llama-server \
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

When running the harness through Docker Compose, the Web UI already uses host
port `8080`. Start llama.cpp on `8081` instead and set:

```bash
export DOCKER_HARNESS_LLAMACPP_BASE_URL=http://host.docker.internal:8081/v1
```
