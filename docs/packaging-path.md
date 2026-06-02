# Packaging Path

## Current Localhost Mode

```text
apps/web  <->  apps/api  <->  local OpenAI-compatible model server
  5173          3001          default: llama.cpp on 127.0.0.1:8080/v1
```

All data stays local. No cloud service is required.

## Packaging-Ready Boundaries

| Concern | Current state |
|---|---|
| Web UI | Vite React SPA |
| API | Local Node process on `localhost:3001` |
| Model server | Separate local process, default `llama.cpp` |
| Storage | File-based workspace/session/project memory data |
| Config | Environment variables plus local config files |

## Desktop Bundle Path

Tauri or Electron can wrap the Web UI and spawn the API process. The model server can remain a documented prerequisite or become a managed sidecar later.

Avoid:

- SSR requirements
- native Node addons
- hardcoded absolute paths
- required external network access
- assumptions that GPU, vLLM, Ollama, or Gemma 4 26B are available
