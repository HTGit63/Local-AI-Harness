# Local Models

## Default Configuration

| Setting | Value |
|---|---|
| Server | Ollama |
| Base URL | `http://127.0.0.1:11434/v1` |
| API Key | `ollama` (placeholder) |
| Default Model | `gemma4:e4b` |
| Native Chat | Preferred automatically for Ollama requests that do not require OpenAI-style native tool calls |

## Inference Profiles

| Profile | Max Tokens | Temperature | Use Case |
|---|---|---|---|
| `fast` | 512 | 0.1 | Quick file inspections, short answers |
| `balanced` | 1536 | 0.3 | Standard coding tasks |
| `deep` | 4096 | 0.6 | Complex multi-step reasoning |

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

## Model Notes

- `gemma4:e4b` and `qwen3.5:9b-q4_K_M` are treated as thinking-capable local models. The harness now prefers Ollama native chat for these non-tool turns so the UI and CLI can show their emitted thinking stream separately from the final answer.
- For tool-heavy coding turns on `gemma4:e4b` and `qwen3.5:9b-q4_K_M`, the harness now prefers the stepwise manual tool protocol instead of relying on OpenAI-style native function calling. This is slower than a frontier cloud agent, but it is more compatible and much less likely to hang on local reasoning models.
- `deepseek-coder-v2:latest` remains supported, but it does not expose the same thinking channel and is better treated as a fast code-focused fallback than as the default agentic model.
- For simple inspect requests like listing files or checking git status, the harness now answers directly from local tools instead of round-tripping through the model. This keeps Gemma and Qwen from wasting time thinking about deterministic workspace lookups.

Or set environment variables:
```bash
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
export OPENAI_API_KEY=ollama
```
