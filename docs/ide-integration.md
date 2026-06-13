# IDE Integration Guide

## Architecture Boundary

| Layer | What it is | Portable? |
|---|---|---|
| Skills / Personas | Exported `SKILL.md` files | Yes |
| Model Backend | Any configured local OpenAI-compatible server | Yes |
| Runtime Harness | This repo's core engine, planner, tools, policy, approvals, traces | No |

Exporting skills to another IDE does not export this harness runtime. The other IDE uses its own runtime and model.

## Antigravity Skill Export

```bash
cd packages/skills
npm run build
npm run index
```

Exports are written to:

```text
packages/skills/dist/antigravity_exports/
```

Install:

```bash
cp -r packages/skills/dist/antigravity_exports/* ~/.gemini/antigravity/skills/
```

The exported skills are the native bundled harness skills. No external reference repo scan is required.

## OpenAI-Compatible IDEs

Any IDE extension that supports a custom OpenAI-compatible endpoint can point at the same local Ollama server:

- Base URL: `http://127.0.0.1:11434/v1`
- API key: `ollama`
- Model: `gemma4:e4b-it-qat`

Optional GGUF users can point IDEs at a separate `llama.cpp` server, for example `http://127.0.0.1:8080/v1` outside Docker or `http://127.0.0.1:8081/v1` when Docker owns host port `8080`.
