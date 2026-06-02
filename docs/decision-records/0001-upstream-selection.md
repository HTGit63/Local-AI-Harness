# Decision Record: 0001 - Upstream Repository Selection

**Date**: 2026-04-10
**Status**: Superseded by the 2026-06-02 web-first reset in `AGENTS.md`

## Context
This historical record captured an early source-study plan. The current reset keeps the lightweight/offline goal, but removes external reference repositories from normal architecture and makes `llama.cpp` the stable runtime target.

## Decision
We will not adopt any single upstream repository wholesale as the base runtime. Instead, we implement a composite intake strategy based on the Capability Audit:

1. **`openclaw`**: We reject the multi-channel gateway routing, voice, and mobile networking nodes. We will selectively wrap its workspace bounding policies and adapt its Web UI for local usage only.
2. **`claw-code`**: We reject its Anthropic dependencies and hidden reasoning "spinners." Early CLI and tool-boundary ideas were useful, but the current product is Web UI first.
3. **`agency-agents`**: Superseded. The current stable build uses native bundled harness skills and does not require external skill repos.
4. **`Prompt-Engineering-Guide`**: We will not attempt to implement the entirety of this guide natively. We will synthesize lightweight, ReAct-focused prompt templates that fit the strict context requirements of a 4B parameter local model.

## Consequences
- We incur higher up-front integration costs to synthesize the code, but we guarantee an offline-capable, lightweight core.
- Future upstream syncs will need to be intentional to avoid accidentally bringing in discarded bloated components.
