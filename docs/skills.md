# Skills System

## Overview

Skills are agent personas that shape the model's behavior for specific tasks. Each skill provides role instructions, constraints, and recommended workflows.

## Curated Coding Pack

| Skill | Division | Risk |
|---|---|---|
| Frontend Developer | Engineering | Low |
| Backend Architect | Engineering | Low |
| Rapid Prototyper | Engineering | Low |
| Code Reviewer | Engineering | Low |
| Technical Writer | Engineering | Low |
| Software Architect | Engineering | Low |
| Database Optimizer | Engineering | Low |
| Security Engineer | Engineering | Medium |
| Product Manager | Product | Low |
| MCP Builder | Specialized | Medium |
| Workflow Architect | Specialized | Low |
| Reality Checker | Testing | Medium |

The curated pack currently contains 12 skills and is regenerated from `third_party/agency-agents` during `packages/skills` build.

## Activating Skills

**CLI:**
```bash
node dist/cli.js skills list
node dist/cli.js skills activate frontend-developer
```

**Web UI:** Use the skill picker in the workbench to activate the runtime skill set for the current session.

## Exporting to Antigravity

```bash
cd packages/skills && npm run build && npm run index
node dist/export-antigravity.js
```

Skills are copied to `~/.gemini/antigravity/skills/`.
