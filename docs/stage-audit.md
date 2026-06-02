# Stage Audit

Status date: `2026-06-02`

This audit reflects the reset direction in `AGENTS.md`: Web UI first, deterministic tools first, provider-based runtime, bounded agent work, verification truth, and small editable project memory.

## Current Layer Status

1. Deterministic tools: direct list/read/search/git/runtime/script paths, timing metadata, truncation, binary protection, ignore lists, cancellation hooks.
2. Web UI: control-center panels for explorer, viewer, search, git, runtime, mode, tool output, verification, approvals, settings, and project memory.
3. Permissions: Chat, Inspect, Plan, Trusted Edit, Full Agent, and Danger Sandbox modes with workspace and protected-path boundaries.
4. Runtime: default `llamacpp` provider at `http://127.0.0.1:8080/v1`; optional `ollama-legacy` and custom OpenAI-compatible providers.
5. Agent brain: deterministic shortcuts, Plan/Inspect no-edit behavior, bounded edit runs, minimal context, visible diff/check results.
6. Verification: safe command allowlist, UI run buttons, command output, and explicit `not-run`/`running`/`passed`/`failed`/`skipped` states.
7. Project memory: small structured JSON, visible/editable/deletable, selectively injected only for workspace agent context.

## Removed Normal Context

`base_repos/` and `third_party/` are removed from normal product flow and ignored if present locally.

## Verification

Use the release gate commands in `docs/release-gate.md`.
