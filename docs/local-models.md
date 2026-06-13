# Local Models

## Stable Runtime

| Setting | Value |
|---|---|
| Provider | `ollama-legacy` |
| Protocol | OpenAI-compatible `/v1` |
| Base URL | `http://127.0.0.1:11434/v1` |
| API Key | `ollama` |
| Default Model | `gemma4:e4b-it-qat` |
| Hardware target | 16 GB RAM, CPU-first, no GPU assumption |

Check Ollama:

```bash
ollama serve
ollama ls
```

Check health:

```bash
curl http://127.0.0.1:11434/v1/models
```

## Provider Configuration

```bash
export HARNESS_RUNTIME_PROVIDER=ollama-legacy
export HARNESS_PRIMARY_RUNTIME=ollama-legacy
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
export OLLAMA_MODEL=gemma4:e4b-it-qat
export OPENAI_API_KEY=ollama
export HARNESS_MODEL=gemma4:e4b-it-qat
```

Supported provider values:

| Provider | Use |
|---|---|
| `ollama-legacy` | Stable default path with local installed models and lifecycle support. |
| `llamacpp` | Optional local path for Gemma 4 E4B GGUF. |
| `openai-compatible` | Custom OpenAI-compatible local server. |

Optional GGUF provider:

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
export LLAMACPP_MODEL_PATH=models/<local-model-file>.gguf
export LLAMACPP_MODEL_ALIAS=gemma-4-gguf
export HARNESS_MODEL=gemma-4-gguf
```

Runtime selection order:

```text
Ollama default at OLLAMA_BASE_URL
↓
optional manual switch
↓
llama.cpp GGUF at LLAMACPP_BASE_URL
```

The harness reports endpoint status and installed models in `/api/model/runtime`.

## Local GGUF Files

Keep GGUF model files local:

```text
models/
*.gguf
*.gguf.*
```

These paths are ignored by git. Do not commit local model files.

## Runtime Budgets

Defaults are conservative for local CPU-first use:

- No full-repo context by default.
- Deterministic tools skip model calls.
- One active model generation by default.
- Bounded model/tool loops in agent mode.
- Small output limits from the active inference profile.
- Prompt-size and runtime state are surfaced in the UI.

## Inference Profiles

| Profile | Max Tokens | Temperature | Use |
|---|---:|---:|---|
| `fast` | 512 | 0.1 | Quick answers and deterministic evidence summaries |
| `balanced` | 1536 | 0.3 | Standard planning/editing |
| `deep` | 2048 | 0.6 | Harder multi-step reasoning, still E4B-local |

## Model Scope

`gemma4:e4b-it-qat` is the stable default. Gemma 4 26B quantized is a future advanced mode only after the E4B harness passes the milestone gate.

If llama.cpp is offline, switch back to Ollama in Settings. Docker uses `host.docker.internal:11434` for host Ollama. Docker maps the Web UI to host port `8080`, so use `http://host.docker.internal:8081/v1` for optional host llama.cpp while Docker is running.
