# Local Models

## Stable Runtime

| Setting | Value |
|---|---|
| Provider | `llamacpp` |
| Protocol | OpenAI-compatible `/v1` |
| Base URL | `http://127.0.0.1:8080/v1` |
| API Key | `no-key` |
| Default Model | `gemma-4-gguf` |
| Hardware target | 16 GB RAM, CPU-first, no GPU assumption |

Start `llama.cpp`:

```bash
llama-server \
  -m models/<local-model-file>.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192 \
  --alias gemma-4-gguf
```

Check health:

```bash
curl http://127.0.0.1:8080/v1/models
```

## Provider Configuration

```bash
export HARNESS_RUNTIME_PROVIDER=llamacpp
export HARNESS_PRIMARY_RUNTIME=llamacpp
export LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
export LLAMACPP_MODEL_PATH=models/<local-model-file>.gguf
export LLAMACPP_MODEL_ALIAS=gemma-4-gguf
export OPENAI_API_KEY=no-key
export HARNESS_MODEL=gemma-4-gguf
```

Supported provider values:

| Provider | Use |
|---|---|
| `llamacpp` | Stable local path for Gemma 4 E4B GGUF. |
| `openai-compatible` | Custom OpenAI-compatible local server. |
| `ollama-legacy` | Optional fallback path with Ollama lifecycle support. |

Ollama fallback:

```bash
export HARNESS_ENABLE_OLLAMA_FALLBACK=1
export HARNESS_FALLBACK_RUNTIME=ollama-legacy
export OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
export OLLAMA_MODEL=gemma4:e4b
ollama pull gemma4:e4b
```

Runtime selection order:

```text
llama.cpp primary at LLAMACPP_BASE_URL
↓
if unavailable and fallback enabled
↓
Ollama fallback at OLLAMA_BASE_URL with visible warning
```

The harness reports primary and fallback endpoint status in `/api/model/runtime`. Fallback is never silent.

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

`gemma4:e4b` is the stable default. Gemma 4 26B quantized is a future advanced mode only after the E4B harness passes the milestone gate.

If llama.cpp is offline, the UI and CLI report the failed primary endpoint. If Ollama fallback is reachable, the active runtime is shown as `Ollama fallback` with a warning.
