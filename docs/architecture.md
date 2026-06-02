# Architecture

## Product Shape

The harness is a web-first local coding tool. The Web UI is the control center; the CLI is secondary. Deterministic workspace operations are backend features and must work without the model.

## Layer Order

1. Deterministic tools
2. Web UI control center
3. Permission and sandbox policy
4. Runtime provider adapter
5. Agent brain
6. Verification loop
7. Project memory

This order matters. Simple file, search, git, and runtime status work must not route through Gemma.

## Runtime

| Field | Stable value |
|---|---|
| Provider | `llamacpp` |
| Transport | OpenAI-compatible `/v1` |
| Base URL | `http://127.0.0.1:8080/v1` |
| API key | `no-key` |
| Model | `gemma4:e4b` |

Optional providers:

- `openai-compatible` for custom local servers.
- `ollama-legacy` for existing Ollama setups and lifecycle calls.

Provider-specific behavior is isolated inside `packages/model-adapter`.

## Core Packages

- `packages/core`: mode routing, orchestration, traces, project memory, and agent runs.
- `packages/tool-runtime`: deterministic workspace, file, git, diff, and command tools.
- `packages/workspace-policy`: mode-based permissions, workspace boundary, and protected-path checks.
- `packages/model-adapter`: provider-based local runtime client.
- `packages/repo-indexer`: bounded project summaries, ignoring reference folders and build output.
- `packages/skills`: native bundled skill metadata and Antigravity export.
- `packages/doctor`: diagnostics and benchmarks.

## Web UI Contract

The Web UI exposes:

- workspace selection
- project explorer
- file viewer
- text search
- git status and diff
- runtime/model status
- mode selector
- tool activity
- agent timeline
- approvals
- diff review
- terminal output
- verification result
- project memory editor

Raw traces and raw structured diff details are advanced-only.

## Agent Contract

The agent is one feature on top of tools, UI, runtime, and policy. It must:

- inspect minimal evidence
- search before reading broad files
- plan before editing
- avoid full repo context
- show diffs
- run or report verification truthfully
- stop after bounded loops

Inspect and Plan modes do not edit or create hidden checkpoints.

## Context And Memory

`base_repos/` and `third_party/` are not normal project context. They are ignored if they exist locally.

Project memory is structured routing data, not repo memory. It is visible and user-editable.
