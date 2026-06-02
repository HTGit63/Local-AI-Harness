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

Any IDE extension that supports a custom OpenAI-compatible endpoint can point at the same local `llama.cpp` server:

- Base URL: `http://127.0.0.1:8080/v1`
- API key: `no-key`
- Model: `gemma4:e4b`

Ollama can still be used by IDEs separately, but it is not the stable harness default.
