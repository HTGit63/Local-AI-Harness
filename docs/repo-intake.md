# Repository Intake Process

## Purpose
This document outlines the rules for what may be copied, wrapped, referenced, or transformed from the upstream vendor repositories in the `third_party` directory.

## General Rules
1. **Preservation**: Vendored repositories under `third_party/` are preserved intact. Do not destructively modify vendored source code or content.
2. **Composition over Merging**: Favor writing new code that composes or calls into vendored assets, rather than merging files directly.
3. **Traceability**: All borrowed pieces must be traceable back to their upstream repository. Read `provenance-map.md` for specific license and attribution obligations.

## Specific Repository Intake

### `openclaw/openclaw`
- **What to Keep**: Local-first architecture mindset, gateway/control-plane concepts, WebChat UI ideas, skills/workspace injection, and operator ergonomics.
- **Rules**: Can reference architectures and borrow UI concepts. Multi-channel messaging and mobile node stacks must be avoided.

### `ultraworkers/claw-code`
- **What to Keep**: CLI harness patterns, REPL ideas, session model, read-only/workspace-write permissions, and OpenAI-compatible provider routes.
- **Rules**: Can copy command parsing logic and session structural code, provided Anthropic-first defaults and output budgeting limits are rewritten to favor `gemma4:e4b`.

### `msitarzewski/agency-agents`
- **What to Keep**: Full agent library vendored intact, Antigravity skill formatting, role descriptions, and expert coding personas.
- **Rules**: Do not modify directly. Wrap and extract metadata to generate runtime-ready curated skills. Only activate a small local-coding optimized set by default.

### `dair-ai/Prompt-Engineering-Guide`
- **What to Keep**: ReAct tools, prompt design patterns, eval concepts, constraint patterns, and documentation.
- **Rules**: Treat strictly as reference material. Do not execute or directly embed this guide as runtime logic. Extract useful prompts into separate lightweight recipes under `packages/prompt-recipes/`.
