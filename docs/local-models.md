# Local Models

## Default Configuration

| Setting | Value |
|---|---|
| Server | Ollama |
| Base URL | `http://127.0.0.1:11434/v1` |
| API Key | `ollama` (placeholder) |
| Default Model | `gemma4:e4b` |
| Native Chat | Preferred automatically for Ollama requests when available; OpenAI-compatible fallback only when native chat is unavailable |

## Inference Profiles

| Profile | Max Tokens | Temperature | Use Case |
|---|---|---|---|
| `fast` | 512 | 0.1 | Quick file inspections, short answers |
| `balanced` | 1536 | 0.3 | Standard coding tasks |
| `deep` | 2048 | 0.6 | Complex multi-step reasoning |

## Hardware Requirements

- **CPU**: Any modern x86_64 or ARM64
- **RAM**: 16GB recommended (8GB minimum)
- **GPU**: Not required — CPU inference is the target
- **Disk**: ~5GB for model weights

## Adding Other Models

```bash
ollama pull <model-name>
```

Then update the runtime config through the web settings page or by editing the environment before launch:
```bash
node apps/cli/dist/cli.js config show --json
```

To inspect and switch models from the terminal:
```bash
node apps/cli/dist/cli.js model status --json
node apps/cli/dist/cli.js model list --json
node apps/cli/dist/cli.js model use gemma4:e4b --json
node apps/cli/dist/cli.js model use qwen3.5:9b-q4_K_M --json
node apps/cli/dist/cli.js model use deepseek-coder-v2:latest --json
ollama ps
```

To switch from the web UI:

1. Open `http://localhost:8080`
2. Open `Settings`
3. Select the target model
4. Click `Save runtime config`
5. Check the `Active:` badge and the `Model runtime` card

When the selected provider is Ollama, the runtime unloads the previous running model and warms the requested model before reporting the switch complete.

## Runtime Budgets

The current local defaults are:

- `profile`: `fast`
- `timeoutMs`: `60000`
- `retries`: `1`
- `keep_alive`: `2m`

These values keep local CPU-first runs bounded and avoid pinning memory longer than needed.

## Model Notes

- `gemma4:e4b` and `qwen3.5:9b-q4_K_M` are treated as thinking-capable local models. The harness now prefers Ollama native chat for these non-tool turns so the UI and CLI can show their emitted thinking stream separately from the final answer.
- For tool-heavy coding turns on `gemma4:e4b` and `qwen3.5:9b-q4_K_M`, the harness now prefers native tool calling first. Manual JSON fallback is only used when native tools are unsupported or explicitly fail, so the fast path stays native and the fallback stays bounded.
- `deepseek-coder-v2:latest` remains supported, but it does not expose the same thinking channel and is better treated as a fast code-focused fallback than as the default agentic model.
- If a selected model does not report `thinking` support, the UI and CLI now warn that the toggle may be ignored instead of hiding the mismatch.
- For simple inspect requests like listing files or checking git status, the harness now answers directly from local tools instead of round-tripping through the model. This keeps Gemma and Qwen from wasting time thinking about deterministic workspace lookups.

Or set environment variables:
```bash
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama
```
