# Decision Record: 0002 - Gamma v2 Workflow Reset

**Date**: 2026-05-07
**Status**: Accepted

## Context

Gamma Local Harness already has a broad TypeScript monorepo: CLI, API, web UI, core engine, model adapter, planner, task orchestrator, repo indexer, session store, skills, prompt recipes, tool runtime, approval workflow, trace bus, workspace policy, checkpoints, diffs, and tests.

The v1 posture became too broad. It tried to act as chat app, coding agent, web IDE, model runner, planner, memory layer, diff viewer, and tool executor at the same time. That overload is a poor fit for 16 GB RAM, CPU-first inference, Ollama, and Gemma/Qwen-class local models.

## Decision

Gamma Local Harness v2 will reset around one product identity:

```text
CLI-first local coding harness for small local models with persistent task state, one bounded micro-step at a time, and evidence-only DONE.
```

We will treat web UI as a later dashboard over runtime state. We will not use web UI as a second agent brain.

We will require `.gamma-harness/agent_state.md` for Agent mode because session history alone is not durable enough for small local models.

We will build one-step execution before multi-step autonomy. Multi-agent/subagent behavior is explicitly deferred.

We will require proof before DONE. The model's final statement is not sufficient evidence.

## Consequences

- CLI becomes the primary operator surface.
- Chat Mode and Agent Mode must be separate runtimes.
- Agent Mode must read and update persistent state.
- Tool exposure must be phase-specific.
- Edits must follow checkpoint, patch, diff, verify, state update.
- Web work is paused until CLI loop is reliable.
- Provider routing, heavy RAG, web IDE expansion, browser automation, and multi-agent systems are not v2 foundations.

## Verification

This decision is documentation-level until runtime code and tests enforce it. Phase completion requires executable proof in the relevant implementation pass.
