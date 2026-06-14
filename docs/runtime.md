# Runtime

Current default: Ollama legacy provider.

## Defaults

| Field | Value |
|---|---|
| Provider | `ollama-legacy` |
| Model | `gemma4:e4b-it-qat` |
| Base URL | `http://127.0.0.1:11434/v1` |
| API key | `ollama` |
| Optional provider | `llamacpp` |
| Local llama.cpp URL | `http://127.0.0.1:8080/v1` |
| Docker llama.cpp URL | `http://host.docker.internal:8081/v1` |

Docker web UI owns host port `8080`. Do not point Docker-hosted API fallback at
`host.docker.internal:8080/v1`; that routes back to the UI. Use host port
`8081` for optional llama.cpp when Docker is running.

## Environment

```bash
HARNESS_RUNTIME_PROVIDER=ollama-legacy
HARNESS_PRIMARY_RUNTIME=ollama-legacy
HARNESS_MODEL=gemma4:e4b-it-qat
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=gemma4:e4b-it-qat
OPENAI_API_KEY=ollama
HARNESS_ENABLE_OLLAMA_FALLBACK=1
HARNESS_FALLBACK_RUNTIME=llamacpp
LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
LLAMACPP_MODEL_ALIAS=gemma-4-gguf
HARNESS_ADAPTIVE_PLAN_TIMEOUT_MS=15000
```

## Fallback

Fallback is visible, not silent. Runtime state is exposed in:

- `GET /api/config`
- `GET /api/model/runtime`
- Agent Mode top bar and settings
- durable run logs under `.gamma-harness/logs`

Provider-neutral warnings name both the unavailable primary and active fallback.

## Ollama Setup

```bash
ollama serve
ollama list
```

Use any installed local model by setting `HARNESS_MODEL` and `OLLAMA_MODEL`.
`nemotron-3-nano:4b` is for smoke plumbing only. Use stronger models for real
refactor work.

Small local models can be slow or unreliable at structured planning. Adaptive
planning has its own timeout (`HARNESS_ADAPTIVE_PLAN_TIMEOUT_MS`, default
15000) and falls back to a validated template plan when the planner response is
invalid or too slow. Caller cancellation still aborts the run.

## llama.cpp Setup

```bash
llama-server \
  -m models/<local-model-file>.gguf \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192 \
  --alias gemma-4-gguf
```

When Docker web UI is running, use `--port 8081` and set:

```bash
DOCKER_HARNESS_RUNTIME_PROVIDER=llamacpp
DOCKER_HARNESS_PRIMARY_RUNTIME=llamacpp
DOCKER_HARNESS_LLAMACPP_BASE_URL=http://host.docker.internal:8081/v1
DOCKER_HARNESS_MODEL=gemma-4-gguf
```
