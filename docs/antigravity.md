# Antigravity Integration

## What Gets Exported

Curated skill personas from `packages/skills/dist/antigravity_exports/`, each containing a `SKILL.md` with YAML frontmatter.

## Installation

```bash
cd packages/skills && npm run build && npm run index
cp -r dist/antigravity_exports/* ~/.gemini/antigravity/skills/
```

Or use the exporter script:
```bash
node dist/export-antigravity.js
```

## Important Boundary

Antigravity skill support does **not** mean Antigravity uses this harness's runtime or model backend. Only the skill instruction files are portable. See [IDE Integration](ide-integration.md) for the full boundary documentation.
