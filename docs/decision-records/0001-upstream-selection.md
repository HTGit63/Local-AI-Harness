# Decision Record: 0001 - Upstream Repository Selection

**Date**: 2026-04-10
**Status**: Accepted

## Context
We need to build a new local coding harness optimized for Gemma 4 E4B, offline usage, and low-resource environments (e.g., CPU-first inference, 16GB RAM) by leveraging code and concepts from four upstream repos: `openclaw`, `claw-code`, `agency-agents`, and `Prompt-Engineering-Guide`. Merging blindly from all four will result in a bloated, incompatible product.

## Decision
We will not adopt any single upstream repository wholesale as the base runtime. Instead, we implement a composite intake strategy based on the Capability Audit:

1. **`openclaw`**: We reject the multi-channel gateway routing, voice, and mobile networking nodes. We will selectively wrap its workspace bounding policies and adapt its Web UI for local usage only.
2. **`claw-code`**: We reject its Anthropic dependencies and hidden reasoning "spinners." We will extract and directly import its strong CLI slash-commands, REPL scaffolding, and tool-action boundary concepts while repointing the inference core aggressively to `localhost:11434`.
3. **`agency-agents`**: We will treat this repository as static metadata rather than a direct import. We will synthesize only the specialized coding/review personas into active skill configurations while ignoring marketing and sales personas.
4. **`Prompt-Engineering-Guide`**: We will not attempt to implement the entirety of this guide natively. We will synthesize lightweight, ReAct-focused prompt templates that fit the strict context requirements of a 4B parameter local model.

## Consequences
- We incur higher up-front integration costs to synthesize the code, but we guarantee an offline-capable, lightweight core.
- Future upstream syncs will need to be intentional to avoid accidentally bringing in discarded bloated components.
