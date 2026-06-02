# Local Models

## Stable Runtime

| Setting | Value |
|---|---|
| Provider | `llamacpp` |
| Protocol | OpenAI-compatible `/v1` |
| Base URL | `http://127.0.0.1:8080/v1` |
| API Key | `no-key` |
| Default Model | `gemma4:e4b` |
| Hardware target | 16 GB RAM, CPU-first, no GPU assumption |

Start `llama.cpp`:

```bash
./llama-server \
  -m /path/to/gemma-4-e4b.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192
```

Check health:

```bash
curl http://127.0.0.1:8080/v1/models
```

## Provider Configuration

```bash
export HARNESS_RUNTIME_PROVIDER=llamacpp
export OPENAI_BASE_URL=http://127.0.0.1:8080/v1
export OPENAI_API_KEY=no-key
export HARNESS_MODEL=gemma4:e4b
```

Supported provider values:

| Provider | Use |
|---|---|
| `llamacpp` | Stable local path for Gemma 4 E4B GGUF. |
| `openai-compatible` | Custom OpenAI-compatible local server. |
| `ollama-legacy` | Optional legacy path with Ollama lifecycle support. |

Ollama legacy:

```bash
export HARNESS_RUNTIME_PROVIDER=ollama-legacy
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama
ollama pull gemma4:e4b
```

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

If the runtime server is offline, the UI and CLI report the endpoint and provider that failed. They do not silently fall back to another provider.
