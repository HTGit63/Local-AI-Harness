# IDE Integration Guide

## Architecture Boundary — Important

The Gamma 4 Harness consists of three distinct layers. Understanding this separation is critical before integrating with any IDE or external tool.

| Layer | What it is | Portable? |
|---|---|---|
| **Skills / Personas** | Markdown-based agent instruction files (`SKILL.md`) | ✅ Yes — can be exported and used in any tool that supports skill files |
| **Model Backend** | Ollama running `gemma4:e4b` on `localhost:11434` via OpenAI-compatible `/v1` | ✅ Yes — any tool supporting OpenAI-compatible endpoints can use it |
| **Runtime Harness** | This project's core engine, planner, tool runtime, approval workflow, trace bus | ❌ No — this is specific to this harness |

> [!IMPORTANT]
> Exporting skills to Antigravity does **not** mean Antigravity will use this harness's runtime or model backend. Antigravity will use its own runtime and its own model. The skills are portable; the engine is not.

---

## Antigravity Skill Export

### What gets exported

Each curated skill from `packages/skills/dist/antigravity_exports/` contains:
- A `SKILL.md` file with YAML frontmatter (`name`, `description`) and markdown instructions

### Installation

```bash
# Copy all exported skills into Antigravity's skill directory
cp -r packages/skills/dist/antigravity_exports/* ~/.gemini/antigravity/skills/
```

After copying, Antigravity will discover and list these skills automatically on next session start.

### Regenerating exports

```bash
cd packages/skills && npm run build && npm run index
```

This re-scans `third_party/agency-agents/` and regenerates both `all_skills.json`, `curated_pack.json`, and the `antigravity_exports/` directory.

---

## VS Code Integration via Ollama

VS Code can use the same local Ollama backend that powers this harness. No special plugin from this project is required.

### Option 1: Continue (recommended)

1. Install the [Continue](https://continue.dev) VS Code extension
2. Configure `~/.continue/config.json`:

```json
{
  "models": [{
    "title": "Gemma 4 E4B (Local)",
    "provider": "ollama",
    "model": "gemma4:e4b",
    "apiBase": "http://127.0.0.1:11434"
  }]
}
```

### Option 2: Any OpenAI-compatible extension

Any VS Code extension that supports custom OpenAI endpoints can point to:
- **Base URL**: `http://127.0.0.1:11434/v1`
- **API Key**: `ollama` (placeholder, not validated)
- **Model**: `gemma4:e4b`

---

## What this harness does NOT provide to IDEs

- ❌ A VS Code extension (not built in v1)
- ❌ Language Server Protocol integration
- ❌ Direct code action providers inside the editor
- ❌ Automatic Antigravity runtime bridging

These are future extension paths documented in `docs/architecture.md`.
