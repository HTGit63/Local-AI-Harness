# AGENTS.md

> Generated on 2026-04-19 for **HTGit63/Local-AI-Harness**.
> Purpose: make the current harness converge into a trustworthy local coding operator centered on Gemma 4 E4B and Qwen 3.5 9B class models, without rewriting the TypeScript architecture.

# 0. 2026-04-23 completion ledger

- `TASK-01 [done]` Workspace/mode/runtime truth now converges better through shared engine state, planner runtime context, session continuity state, and visible workspace-bound vs snapshot-only surfaces.
- `TASK-02 [done]` Small-model agent loop now carries qwe-qwe-style long-run mechanisms: truncated-response continuation, bounded loop compaction, and compacted tool-result reinjection instead of uncontrolled context growth.
- `TASK-03 [done]` Direct mode now reuses the same engine-owned path for stream and non-stream responses, with direct-chat history compaction and continuation recovery instead of split behavior.
- `TASK-04 [done]` Live progress no longer freezes during active runs: web polling stays on during sends, recent planner state stays fresh, and current run state is promoted into first-class UI.
- `TASK-05 [done]` Agent progress presentation is stronger: main web surface now shows live phase, next action, current tool, recent run steps, and recent trace without forcing the user into the settings drawer.
- `TASK-06 [done]` Osaurus-inspired web refresh landed in lightweight form: cleaner command-center shell, stronger ambient layout, improved direct/agent posture cards, and no extra heavy runtime dependencies.
- `TASK-07 [done]` Long-session stability improved through conversation compaction, loop compaction, and large tool-output truncation for model context, which reduces local RAM/context pressure during extended work.
- `TASK-08 [done]` CLI visibility improved: active tool start/done events and run-summary heartbeat now print inline during long runs instead of waiting for the final answer.
- `TASK-09 [done]` Regression coverage added for continuation recovery, direct-chat conversation compaction, and large tool-output compaction in unit tests; full repo test sweep passes.
- `TASK-10 [done]` External-reference intent now maps to concrete repo changes instead of notes only: qwe-qwe informed continuation/compaction; Osaurus informed main-shell/live-activity UI posture; Codex docs informed explicit approval/runtime/status visibility.

# 0.1 2026-04-28 smart-agent tool ledger

- `TASK-11 [done]` Deterministic code-structure tools added: `findSymbol`, `findFunction`, `findComponent`, import graph queries, affected-file discovery, context packs, project command detection, and targeted test selection.
- `TASK-12 [done]` Precision edit tools added: `replaceFunction`, `insertImport`, `addTypeProperty`, and `renameIdentifier`, all routed through existing policy/approval/diff paths instead of whole-file rewrites.
- `TASK-13 [done]` Structured diff and rollback trust path added: `getStructuredDiff`, structured run summary fields, checkpoint creation, rollback-to-checkpoint, and API endpoints for UI/runtime use.
- `TASK-14 [done]` Run console now shows inline diff hunks with old/new line numbers, file-level change totals, why-file-selected notes, context-budget telemetry, and richer tool transparency with duration/output previews.
- `TASK-15 [done]` Model routing foundation added: execution profiles, provider profile labels, prompt profiles, fast/code/review/API model slots, route selection traces, and model-per-purpose calls for direct/code/summarize paths.
- `TASK-16 [done]` Regression coverage added for deterministic repo tools, AST edits, import graph, targeted test selection, command detection, checkpoint rollback, and full `npm test` passes.

Status: complete as of 2026-04-30; all checklist items in sections 0 and 0.1 are marked [done].

Implementation audit note:
- `qwe-qwe` mechanisms selectively ported: response continuation, context compaction mindset, bounded retry/continuation loop, compacted tool reinjection.
- `osaurus` ideas selectively ported: clearer direct-vs-agent posture, stronger live command-center framing, better visible session/activity shell.
- Official Codex docs influence applied selectively: explicit runtime/status surfaces, approval/state clarity, local-first constraints preserved.
- Manual-only residual remains: live Ollama smoke with the operator’s preferred Gemma/Qwen models on this exact machine is still recommended after code/test completion.

# 1. Core contract

This file is the single operational playbook for any agent working inside `HTGit63/Local-AI-Harness`. It exists because the current harness already contains serious architecture, but the audit concludes that the parts do not yet converge into one trustworthy operator loop. The goal is therefore not to rebuild the harness from scratch, but to tighten the loop between policy, engine, adapter, tools, planner, API, traces, and UI so the system feels coherent, decisive, and inspectable.

The audit’s ranked diagnosis should be treated as the root ordering principle for all work. The most important failure is **system coherence**, followed by **workspace truth**, then **agent execution**, then **visibility quality**, then **continuity**, then **capability integration**, then the **realism gap in tests**. Any implementation plan that improves one small symptom while preserving those higher-level fractures is incomplete.

# 2. Product truth to preserve

- Direct mode is the everyday general-purpose path and should stay lean, fast, and conversational.
- Agentic mode is the coding/operator path and must inspect, act, verify, recover, and explain.
- Reuse the current TypeScript architecture rather than replacing it.
- Keep the planner, trace bus, approval workflow, session store, and workspace policy as the primary backbone.
- Do not fabricate hidden reasoning; only show provider-emitted thinking if explicitly returned.
- Optimize for CPU-only local use on 16 GB RAM realities before fancy abstractions.

# 3. Non-goals and forbidden moves

- Do not rewrite the project into Python, Swift, Electron, or a second orchestration core.
- Do not remove the current planner, trace bus, approval workflow, or workspace policy system.
- Do not cargo-cult external repos wholesale.
- Do not copy Apple-specific MLX/macOS internals from Osaurus.
- Do not assume the user-provided `deepfounder-ai/qwe-qwe` repo is publicly resolvable; verify it first.
- Do not dump giant debug blobs into the UI and call that observability.
- Do not rely on prompts alone to solve architectural failures.
- Do not make the agent more autonomous by making it less inspectable.

# 4. External references the agent must understand before making changes

The agent is allowed to learn from external systems, but only in a selective, architecture-compatible way. The external references fall into two groups: **product references** (Codex, Claude Code, Cursor, Windsurf) and **code references** (Osaurus and the Qwen-family terminal-agent reference). The point is not imitation for its own sake. The point is to identify transferable behavior patterns that close the exact gaps documented in the audit.

## 4.1 Product references: what to study and what to borrow

### Codex

Codex is a reference system, not an implementation template. Borrow the parts below selectively and only where they close a diagnosed Local-AI-Harness problem.

**Borrow**

- clear separation between pairing locally and delegating in cloud
- approval-mode clarity (suggest / auto edit / full auto style mental model)
- sandboxed execution framing and explicit status surfaces
- multi-agent and long-horizon framing, especially context compaction mindset
- skills/worktrees/automations as organized capability layers rather than random extras

**Avoid**

- blindly copying cloud assumptions into a local CPU harness
- background orchestration patterns that require server infrastructure
- complexity that makes direct mode feel heavy

### Claude Code

Claude Code is a reference system, not an implementation template. Borrow the parts below selectively and only where they close a diagnosed Local-AI-Harness problem.

**Borrow**

- fine-grained permissions model and explicit user-visible permission state
- hooks as a mental model for pre/post tool policy points
- slash commands and subagents as controlled specialization, not anarchy
- clear terminal-first identity with readable status and health surfaces

**Avoid**

- assuming Claude’s tool semantics or hook architecture can be copied 1:1
- overfitting the harness around Anthropic-specific concepts

### Cursor

Cursor is a reference system, not an implementation template. Borrow the parts below selectively and only where they close a diagnosed Local-AI-Harness problem.

**Borrow**

- mode separation (Agent vs Ask vs manual/custom mindset)
- rules and AGENTS.md as persistent prompt-level context
- tool inventory discipline and configurable modes
- auto-run/auto-fix mindset without surrendering control

**Avoid**

- IDE-specific assumptions that do not transfer to this harness UI
- pretending all IDE affordances exist locally in the current app

### Windsurf

Windsurf is a reference system, not an implementation template. Borrow the parts below selectively and only where they close a diagnosed Local-AI-Harness problem.

**Borrow**

- AGENTS.md and rules engine alignment, especially directory-scoped instructions
- clear activity timeline and command auto-execution levels
- memories vs rules vs workflows vs skills as separate customization primitives
- context-awareness/RAG mental model for repo understanding
- current-tool / current-phase / current-runtime visibility

**Avoid**

- assuming a heavyweight IDE context engine is free on CPU-only local hardware
- letting auto-generated memory replace durable rules or explicit AGENTS content

## 4.2 Code references: repo inspection protocol

The user explicitly wants two external repos placed under a `base_repos/` style area so a coding agent can inspect them and port useful ideas into the current TypeScript harness. Treat the following as the required clone-and-inspect policy.

- Primary external UI/runtime reference: `osaurus-ai/osaurus`.
- Primary external small-model terminal-agent reference requested by the user: `deepfounder-ai/qwe-qwe`.
- Public-source verification note: a publicly verifiable `deepfounder-ai/qwe-qwe` repository could not be confirmed in this research pass; the closest verified and highly relevant open-source terminal agent is `QwenLM/qwen-code`.
- Therefore the execution policy is: first attempt to clone exactly the user-specified repo; if it does not resolve, record the failure and substitute `QwenLM/qwen-code` as the verified fallback reference.

```bash
mkdir -p base_repos
cd base_repos

# UI/runtime reference
if [ ! -d osaurus ]; then
  git clone https://github.com/osaurus-ai/osaurus.git osaurus \
  || git clone https://github.com/dinoki-ai/osaurus.git osaurus
fi

# Small-model terminal-agent reference requested by user
if [ ! -d qwe-qwe ]; then
  git clone https://github.com/deepfounder-ai/qwe-qwe.git qwe-qwe \
  || git clone https://github.com/QwenLM/qwen-code.git qwe-qwe
fi
```

The agent must document which clone path succeeded. If the user-specified repository is unavailable, the fallback substitution is not something to hide; it should be written into notes, traces, and any architecture appendix. That preserves trust and keeps the implementation grounded.

# 5. Source hierarchy

- Highest authority for Local-AI-Harness current problems: `local_ai_harness_deep_audit.md`.
- Highest authority for the external-integration intent: `Pasted text.txt` provided by the user.
- Highest authority for current product/tool docs: official docs from OpenAI, Anthropic, Cursor, and Windsurf.
- Highest authority for external reference code when clone succeeds: checked-out repos under `base_repos/`.
- When sources disagree, prefer: local code reality > user-provided integration instructions > official current docs > repo marketing copy.

# 6. Condensed audit truth the agent must carry into every task

- Direct mode is broadly correct in intent, but internally split across inconsistent code paths.
- Agentic mode weakness is real and rooted in orchestration, not just in Gemma quality.
- System coherence is the root problem: docs, engine, API, UI, and policy do not yet speak with one voice.
- Workspace truth is muddy: browser snapshot, bound backend root, and danger-mode expectations diverge.
- Planner/session continuity is too shallow for long coding work.
- Tool runtime is stronger than the agent’s ability to exploit it.
- Internet capability exists below the surface but not yet as a trustworthy product-level behavior.
- UI observability exists, but its storytelling and change-ledger quality are weak.
- The system already anticipates planning-only and simulated-tool failures; recovery is not yet strong enough.
- Tests validate many mocked happy paths but under-model the real local-model pain that matters.

# 7. Ten-task program, ranked by problem proximity

The user asked for ten tasks divided by proximity of the problem. In this file, **proximity** means closeness to the root causes ranked by the audit. Tasks 1–3 hit the deepest execution fractures. Tasks 4–6 turn those engine improvements into operator trust. Tasks 7–10 harden persistence, retrieval, safety, and realism. Every task below includes the problem mapping, the external inspirations allowed, the files to touch first, and the acceptance criteria the agent must satisfy before calling the task complete.

## TASK-01 — Converge system truth around workspace, mode, and operator expectations

**Problems addressed:** P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036

**Primary files:**

- packages/core/src/engine.ts
- packages/workspace-policy/src/policy.ts
- apps/api/src/server.ts
- apps/web/src/HarnessApp.tsx
- packages/session-store/src/store.ts

**External patterns allowed:**

- Codex approval-mode clarity
- Claude Code permissions surface
- Cursor mode separation
- Windsurf AGENTS.md and rules scoping

### Why this task is near the root

This task sits in position 1 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.
- One visible workspace root, one effective workspace root, one truth model.
- Direct vs agentic must be understandable before any request is run.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.

### Concrete engineering directives

- Unify the meaning of current workspace root across engine, API, UI, planner, and run summary.
- Expose whether the session is `backend_bound` or `browser_snapshot_only` in a machine-readable field on every agentic run.
- Normalize direct and agentic mode state into one clearly typed execution-mode contract.
- Do not let danger-mode docs imply capabilities the runtime still denies.
- When workspace rebinding resets state, surface that reset explicitly instead of letting the user infer memory loss.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.
- Switching or binding workspace no longer creates silent truth mismatches.
- Mode and policy names visible in UI match backend reality.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-02 — Rebuild the small-model agent loop so Gemma/Qwen act instead of hesitating

**Problems addressed:** P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035

**Primary files:**

- packages/core/src/engine.ts
- packages/planner/src/planner.ts
- packages/model-adapter/src/client.ts

**External patterns allowed:**

- Qwen Code parser resilience and terminal-agent discipline
- Codex long-horizon context compaction mindset
- Claude Code subagents/permissions thinking without copying the stack

### Why this task is near the root

This task sits in position 2 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.
- Agentic mode must inspect, decide, act, verify, and recover with less hedging.
- Complex tasks must decompose internally instead of repeatedly bouncing back to the user.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Bias toward deterministic helpers around parsing, retries, and fallback path choice rather than letting the model improvise endlessly.
- Bound recovery loops, but make the bounds smarter instead of simply smaller.

### Concrete engineering directives

- Add internal decomposition for multi-step requests: inspect → identify target files → plan action → execute → verify → summarize.
- Treat planning-only text from the model as insufficient when tool/action intent is required.
- Reduce tool exposure per turn to the smallest relevant set for the detected task class.
- Use stronger anti-hedge nudges for small models: if executable with current context, act before asking.
- Carry forward compact task state so the next loop knows what has already been tried, what failed, and what remains.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.
- The agent performs more inspect-act-verify loops before asking for more information.
- Hesitation and planning-only behavior drop on benchmark prompts.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.
- Do not let the model stay in meta-protocol longer than the task itself.
- Do not consume all loop budget on repair chatter.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-03 — Make manual fallback a first-class, inspectable operating path

**Problems addressed:** P-006, P-007, P-008, P-020, P-025, P-030

**Primary files:**

- packages/core/src/engine.ts
- packages/model-adapter/src/client.ts
- apps/api/src/server.ts
- apps/web/src/components/ChatMessageRow.tsx

**External patterns allowed:**

- Qwen Code robust parser adaptations
- Codex explicit approval/fallback clarity
- Claude Code permission-state transparency

### Why this task is near the root

This task sits in position 3 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Bias toward deterministic helpers around parsing, retries, and fallback path choice rather than letting the model improvise endlessly.
- Bound recovery loops, but make the bounds smarter instead of simply smaller.

### Concrete engineering directives

- Make fallback mode explicit: `native_tools`, `native_retry`, `manual_fallback`, `manual_repair`, `final_noop_warning`.
- Implement JSON/tool-call repair helpers around malformed arguments and formatting noise.
- When native tools fail, retry once with a targeted correction, then shift paths cleanly instead of oscillating.
- Surface the fallback path in traces, planner, and UI so the operator can see why behavior changed.
- Never allow manual fallback to become an invisible degraded mode.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.
- Fallback path is explicitly visible and understandable.
- Malformed tool payloads recover more often without user babysitting.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.
- Do not let the model stay in meta-protocol longer than the task itself.
- Do not consume all loop budget on repair chatter.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-04 — Redesign operational visibility so the UI tells the right story

**Problems addressed:** P-019, P-020, P-021, P-022, P-033, P-034

**Primary files:**

- apps/web/src/HarnessApp.tsx
- apps/web/src/components/ChatMessageRow.tsx
- apps/web/src/components/AgentRunSummary.tsx
- apps/web/src/components/AgentRunSteps.tsx
- packages/trace-bus/src/*

**External patterns allowed:**

- Osaurus product-grade chat/runtime feel
- Windsurf activity timeline clarity
- Codex agent-command-center mental model

### Why this task is near the root

This task sits in position 4 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.
- The UI must answer: what is the agent doing now, what did it change, what remains blocked, and what path is active.
- Reasoning must never visually bury the actual result.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Make runtime state visible to the UI as typed event payloads and explicit run-summary fields.
- Do not smuggle important state only in prose.

### Concrete engineering directives

- Rebuild the activity timeline around phase, current tool, tool start, tool done, preview, command, file changes, approvals, and run summary.
- Separate three visual lanes: assistant answer, operational activity, optional provider-emitted thinking.
- Add a precise change ledger view listing files read, written, deleted, and changed-file stats in a human-readable order.
- Upgrade the activity tab from trace headers to selectively inspectable structured payloads.
- Use concise grouped status text rather than giant undifferentiated blocks.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.
- A user can answer ‘what changed?’ from the UI alone.
- Thinking never dominates final outcome presentation.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.
- Do not turn direct mode into a debug shell.
- Do not let reasoning panels overshadow the answer.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-05 — Strengthen direct chat as a lean everyday mode with minimal agent overhead

**Problems addressed:** P-003, P-027, P-031

**Primary files:**

- apps/api/src/server.ts
- packages/core/src/engine.ts
- packages/model-adapter/src/client.ts
- apps/web/src/HarnessApp.tsx

**External patterns allowed:**

- Cursor Ask/Agent distinction
- Codex pair-vs-delegate separation
- Osaurus fast local chat feel

### Why this task is near the root

This task sits in position 5 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Make runtime state visible to the UI as typed event payloads and explicit run-summary fields.
- Do not smuggle important state only in prose.

### Concrete engineering directives

- Keep direct chat on the shortest reliable path and avoid planner/tool overhead for ordinary use.
- Eliminate drift between stream and non-stream direct routes or make one canonical implementation path.
- Expose only direct-chat-relevant runtime information, not the full agent stack, when the user is in direct mode.
- Preserve multimodal capability and model switching without leaking agentic complexity.
- Use direct mode as the clean control condition against which agentic mode is judged.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.
- Do not turn direct mode into a debug shell.
- Do not let reasoning panels overshadow the answer.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-06 — Improve runtime/model control, loading policy, and stall handling

**Problems addressed:** P-016, P-017, P-025, P-027, P-032

**Primary files:**

- packages/model-adapter/src/client.ts
- packages/core/src/engine.ts
- apps/api/src/server.ts
- apps/web/src/HarnessApp.tsx

**External patterns allowed:**

- Osaurus runtime status monitor
- Windsurf terminal/runtime controls
- Codex environment/status visibility

### Why this task is near the root

This task sits in position 6 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Make runtime state visible to the UI as typed event payloads and explicit run-summary fields.
- Do not smuggle important state only in prose.

### Concrete engineering directives

- Strengthen timeouts, retries, and stall detection for local Ollama chat and streaming.
- Make keep-alive and unload policy visible enough that RAM drops are interpretable, not mysterious.
- Expose active model, configured model, reasoning support, tool-path mode, and current policy mode in runtime status.
- If the stream goes idle beyond policy, fail visibly and explain why.
- Do not let long server timeouts masquerade as healthy work.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-07 — Fix skill, instruction, and durable-context hygiene

**Problems addressed:** P-012, P-013, P-015, P-028, P-029

**Primary files:**

- apps/api/src/server.ts
- packages/core/src/engine.ts
- packages/planner/src/planner.ts
- packages/session-store/src/store.ts

**External patterns allowed:**

- Windsurf AGENTS.md + rules engine concepts
- Cursor AGENTS.md and rules layering
- Codex Skills mindset without copying cloud assumptions

### Why this task is near the root

This task sits in position 7 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Use durable rules/AGENTS/session summaries for reusable context; do not force raw history to carry every burden.
- For small models, contextual precision beats contextual volume.

### Concrete engineering directives

- Decouple skill discovery from fragile workspace-root assumptions where possible.
- Normalize AGENTS/rules/memory/skills so each mechanism has a clear job and precedence.
- Record whether a skill is available, filtered, or missing, and why.
- Treat durable repo guidance as versioned instructions, not as transient chat trivia.
- Keep Caveman filtered and make the filtering state auditable.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-08 — Add internet, retrieval, and repo-understanding improvements without bloating small-model prompts

**Problems addressed:** P-002, P-014, P-015, P-028, P-032, P-035

**Primary files:**

- packages/core/src/engine.ts
- packages/tool-runtime/src/registry.ts
- packages/model-adapter/src/client.ts
- packages/planner/src/planner.ts

**External patterns allowed:**

- Windsurf RAG/context awareness ideas
- Codex repo/environment grounding
- Qwen Code disciplined context exposure

### Why this task is near the root

This task sits in position 8 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.
- Use durable rules/AGENTS/session summaries for reusable context; do not force raw history to carry every burden.
- For small models, contextual precision beats contextual volume.

### Concrete engineering directives

- Wire internet-enabled tools into agent selection only when they truly add value and the policy allows it.
- Do not expose web tools by default for every turn; contextual discipline matters.
- Improve repo understanding via compaction, targeted retrieval, workspace inventory, and better file-selection heuristics.
- Favor compact summaries of prior exploration over raw transcript growth.
- Guard against prompt bloat that makes 4B/9B models worse instead of smarter.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-09 — Bring terminal and command execution under clearer safety and autonomy controls

**Problems addressed:** P-001, P-018, P-022, P-026, P-036

**Primary files:**

- packages/tool-runtime/src/registry.ts
- packages/workspace-policy/src/policy.ts
- apps/web/src/HarnessApp.tsx
- apps/api/src/server.ts

**External patterns allowed:**

- Claude Code permissions and hooks model
- Windsurf allow/deny/auto/turbo command levels
- Codex suggest/auto edit/full auto mental model

### Why this task is near the root

This task sits in position 9 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.

### Concrete engineering directives

- Clarify command auto-execution posture with a stable allow/deny/approval model.
- Preserve workspace confinement but explain it clearly and consistently.
- Make the shell capability feel intentionally scoped rather than mysteriously crippled.
- Tie command execution state into the same visible activity model as file tools.
- Use approvals as part of trust, not as hidden friction.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

## TASK-10 — Close the realism gap with better traces, event contracts, and adversarial tests

**Problems addressed:** P-023, P-024, P-030, P-033, P-034

**Primary files:**

- tests/unit/core.test.ts
- tests/e2e/api.test.ts
- packages/trace-bus/src/*
- packages/core/src/engine.ts
- apps/api/src/server.ts

**External patterns allowed:**

- Codex trust-through-clear-state
- Claude Code health/status surface
- Qwen Code failure-path realism

### Why this task is near the root

This task sits in position 10 because it directly resolves one or more of the audit’s highest-ranked failure classes. If this track is skipped, later work will mostly decorate a still-fragile harness. The core standard here is convergence: the code path, policy posture, planner state, API contract, traces, and UI narrative must agree well enough that the operator stops seeing the harness as a bundle of loosely related subsystems and starts experiencing it as one coherent worker.

### Mandatory outcomes

- Turn a currently ambiguous or brittle behavior into a clearly defined, inspectable runtime contract.
- Reduce the number of states where the operator can plausibly believe the harness is lying, confused, or asleep.
- Improve success on Gemma 4 E4B and Qwen 3.5 9B class models without assuming frontier-model luxuries.
- Preserve or improve trust: every new optimization must remain explainable through planner state, traces, and UI.

### Required implementation approach

- Start from the current code path, not from a greenfield rewrite.
- Prefer tightening contracts, events, and state transitions over introducing a new layer.
- Where external ideas are borrowed, port the behavior pattern into existing modules instead of recreating foreign architecture names blindly.
- Every sub-change should be reversible, testable, and explainable in trace/state terms.

### Concrete engineering directives

- Write adversarial tests for planning-only replies, malformed tool calls, wedged streams, state loss after rebinding, and misleading UI summaries.
- Test the machine-readable event contract, not just prose output formatting.
- Ensure the app can still tell the truth under many tool events and long runs.
- Measure whether new behavior improves completion, clarity, and fallback quality on small-model paths.
- Do not let passing tests certify empty-feeling behavior.

### Acceptance criteria

- The operator can explain what the harness is doing from visible runtime state without reading the code.
- Gemma/Qwen class models complete more real tasks with fewer clarification loops and less protocol drift.
- The change preserves architectural consistency rather than adding a duplicate subsystem.
- Tests include real-looking local failure paths, not just friendly mocks.

### Anti-patterns

- Do not hide unresolved ambiguity behind confident prose.
- Do not add raw logs when what is needed is structured, grouped narrative activity.
- Do not borrow named features from external tools unless they solve a mapped Local-AI-Harness problem.
- Do not optimize one path by silently degrading another.

### Deliverables for this task

- Code changes in the listed files.
- Updated or new tests proving the behavior.
- Short architecture note: what changed, what was borrowed, what was deliberately not copied.
- Event-contract note if trace/planner/API/UI payloads changed.

# 8. Issue-to-task mapping matrix

| Issue | Task Track | Why it belongs there |
|---|---|---|
| P-001 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-002 | TASK-08 | internet/retrieval/context compaction |
| P-003 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-004 | TASK-02 | core agent loop/planning/selection/continuity |
| P-005 | TASK-02 | core agent loop/planning/selection/continuity |
| P-006 | TASK-02 | core agent loop/planning/selection/continuity |
| P-007 | TASK-02 | core agent loop/planning/selection/continuity |
| P-008 | TASK-02 | core agent loop/planning/selection/continuity |
| P-009 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-010 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-011 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-012 | TASK-07 | skills, rules, durable-context hygiene |
| P-013 | TASK-07 | skills, rules, durable-context hygiene |
| P-014 | TASK-02 | core agent loop/planning/selection/continuity |
| P-015 | TASK-02 | core agent loop/planning/selection/continuity |
| P-016 | TASK-06 | runtime loading/timeouts/model control |
| P-017 | TASK-06 | runtime loading/timeouts/model control |
| P-018 | TASK-09 | command/approval/safety execution |
| P-019 | TASK-04 | UI narrative and observability |
| P-020 | TASK-03 | fallback and recovery path quality |
| P-021 | TASK-04 | UI narrative and observability |
| P-022 | TASK-04 | UI narrative and observability |
| P-023 | TASK-10 | tests and realism |
| P-024 | TASK-10 | tests and realism |
| P-025 | TASK-03 | fallback and recovery path quality |
| P-026 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-027 | TASK-05 | direct-path simplicity and speed |
| P-028 | TASK-07 | skills, rules, durable-context hygiene |
| P-029 | TASK-01 | mode/workspace/policy/source-of-truth |
| P-030 | TASK-02 | core agent loop/planning/selection/continuity |
| P-031 | TASK-05 | direct-path simplicity and speed |
| P-032 | TASK-02 | core agent loop/planning/selection/continuity |
| P-033 | TASK-04 | UI narrative and observability |
| P-034 | TASK-04 | UI narrative and observability |
| P-035 | TASK-02 | core agent loop/planning/selection/continuity |
| P-036 | TASK-01 | mode/workspace/policy/source-of-truth |

# 9. Base-repo inspection instructions

Before making major changes, the agent should inspect the checked-out external repos under `base_repos/` with an explicit notebook of transferable ideas. The output of that inspection should not be a vague admiration essay. It should be a porting ledger with four columns: **observed behavior**, **Local-AI-Harness problem it solves**, **exact current files to touch**, and **what not to copy**.

- From Osaurus, extract UI/runtime/status ideas, local-first harness framing, model/runtime presentation, tool-activity clarity, and product polish patterns.
- From the Qwen-side reference, extract parser resilience, small-model recovery, terminal-agent discipline, context compaction, and anti-hesitation patterns.
- Where both external repos present the same idea differently, choose the version that better fits a TypeScript/Ollama/local-CPU harness.
- Never import platform-specific internals or naming conventions just to feel modern.

# 10. Detailed external-pattern extraction checklist

### Codex

The agent must explicitly note how Codex handles pair-vs-delegate, approval tiers, sandbox clarity, skills/worktrees/automations framing, then convert those observations into TypeScript-compatible action items that address mapped Local-AI-Harness issues.

### Claude Code

The agent must explicitly note how Claude Code handles permissions, hooks, slash commands, subagents, health/status surfaces, then convert those observations into TypeScript-compatible action items that address mapped Local-AI-Harness issues.

### Cursor

The agent must explicitly note how Cursor handles modes, tools inventory, rules, AGENTS.md, configurable autonomy, then convert those observations into TypeScript-compatible action items that address mapped Local-AI-Harness issues.

### Windsurf

The agent must explicitly note how Windsurf handles AGENTS.md scoping, rules/memories/workflows/skills distinctions, terminal auto-exec levels, activity timeline, then convert those observations into TypeScript-compatible action items that address mapped Local-AI-Harness issues.

### Osaurus

The agent must explicitly note how Osaurus handles local-first harness posture, status UI, runtime monitor, chat polish, tool-compatible API surfaces, then convert those observations into TypeScript-compatible action items that address mapped Local-AI-Harness issues.

### Qwen Code

The agent must explicitly note how Qwen Code handles parser adaptations, terminal-agent ergonomics, small-model survival, provider flexibility, headless/interactive split, then convert those observations into TypeScript-compatible action items that address mapped Local-AI-Harness issues.

# 11. Runtime/event contract the agent should move toward

The exact event names may change during implementation, but the harness should move toward an explicit event contract that separates operational state from prose. The UI should not infer critical execution state from text alone when structured events can carry it directly.

- session_mode_changed
- workspace_binding_state_changed
- run_phase_changed
- run_tool_set_selected
- tool_call_started
- tool_call_completed
- tool_call_failed
- tool_preview_ready
- native_tool_retry_requested
- manual_fallback_activated
- stream_idle_timeout
- approval_requested
- approval_resolved
- file_change_ledger_updated
- run_summary_ready
- assistant_final_ready
- runtime_status_updated

# 12. UI model the agent should target

- Direct mode panel: lean conversation, model/runtime badge, minimal activity unless directly relevant.
- Agentic mode header: workspace root, policy mode, model, tool-path mode, thinking availability.
- Run overview card: phase, elapsed time, fallback state, approvals count, file change counts.
- Activity timeline: ordered events with tool name, brief intent, preview, success/failure, and next step.
- Change ledger: files read, files written, files deleted, changed file stats, commands executed.
- Assistant answer block: final narrative answer, concise, prominent, always visually above or clearly separate from the trace.
- Optional thinking block: collapsible, clearly labeled as model-emitted thinking only.
- Activity tab: inspectable structured trace payloads, not only timestamps and labels.

# 13. Small-model survival doctrine

- Prefer fewer relevant tools over many generic tools.
- Prefer compact incremental state over long raw transcript history.
- Prefer deterministic helpers for parsing and recovery over repeated pleading with the model.
- Prefer inspect-first and assumption-taking over over-asking when the task is executable.
- Prefer explicit fallback transitions over invisible degraded behavior.
- Prefer bounded but meaningful retries over rigid early exits.
- Prefer stable system contracts over clever prompt theatrics.

# 14. Direct-mode doctrine

- Direct mode is for everyday help, code understanding, quick answers, and low-overhead interaction.
- Direct mode should not silently accumulate agentic scaffolding unless the user actually wants work done.
- Any complexity retained in direct mode must justify itself in latency or clarity terms.
- Direct mode is the benchmark for cleanliness; if it begins to feel like a debug console, the design is failing.

# 15. Agentic-mode doctrine

- Agentic mode exists to perform coding work, not merely to talk about coding work.
- Every serious agentic run should move through a recognizable loop: scope → inspect → choose → act → verify → summarize.
- When blocked, the run should explain the block concretely: missing binding, permission required, unsupported command shape, unavailable tool, malformed model output, or exhausted loop budget.
- Agentic mode must show what path it is using: native tools, repaired native retry, or manual fallback.
- After acting, the system should tell the user what changed, what it read, what it ran, what succeeded, and what still needs attention.

# 16. Clone/inspect/port workflow the coding agent must follow

- Step 1: confirm current Local-AI-Harness branch and working tree cleanliness.
- Step 2: clone or update `base_repos/osaurus` and `base_repos/qwe-qwe` using the policy above.
- Step 3: inspect only the relevant surfaces: status UI, activity timeline, model/runtime controls, parser/fallback helpers, tool event streaming, context compaction, command execution model, permission/approval model.
- Step 4: write a porting ledger mapping every borrowed idea to a Local-AI-Harness problem code and target file.
- Step 5: implement in current TypeScript paths, not in a new subsystem.
- Step 6: add tests and visible status/trace outputs that prove the ported behavior exists.
- Step 7: write a concise architecture note documenting what was borrowed and what was intentionally not copied.

# 17. Expanded guidance for each of the ten tasks

### Guide for TASK-01

The agent should treat TASK-01 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036), review current behavior in the listed files (packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts), compare with allowed external patterns (Codex approval-mode clarity, Claude Code permissions surface, Cursor mode separation, Windsurf AGENTS.md and rules scoping), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-02

The agent should treat TASK-02 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035), review current behavior in the listed files (packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts), compare with allowed external patterns (Qwen Code parser resilience and terminal-agent discipline, Codex long-horizon context compaction mindset, Claude Code subagents/permissions thinking without copying the stack), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-03

The agent should treat TASK-03 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-006, P-007, P-008, P-020, P-025, P-030), review current behavior in the listed files (packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx), compare with allowed external patterns (Qwen Code robust parser adaptations, Codex explicit approval/fallback clarity, Claude Code permission-state transparency), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-04

The agent should treat TASK-04 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-019, P-020, P-021, P-022, P-033, P-034), review current behavior in the listed files (apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*), compare with allowed external patterns (Osaurus product-grade chat/runtime feel, Windsurf activity timeline clarity, Codex agent-command-center mental model), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-05

The agent should treat TASK-05 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-003, P-027, P-031), review current behavior in the listed files (apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx), compare with allowed external patterns (Cursor Ask/Agent distinction, Codex pair-vs-delegate separation, Osaurus fast local chat feel), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-06

The agent should treat TASK-06 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-016, P-017, P-025, P-027, P-032), review current behavior in the listed files (packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx), compare with allowed external patterns (Osaurus runtime status monitor, Windsurf terminal/runtime controls, Codex environment/status visibility), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-07

The agent should treat TASK-07 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-012, P-013, P-015, P-028, P-029), review current behavior in the listed files (apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts), compare with allowed external patterns (Windsurf AGENTS.md + rules engine concepts, Cursor AGENTS.md and rules layering, Codex Skills mindset without copying cloud assumptions), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-08

The agent should treat TASK-08 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-002, P-014, P-015, P-028, P-032, P-035), review current behavior in the listed files (packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts), compare with allowed external patterns (Windsurf RAG/context awareness ideas, Codex repo/environment grounding, Qwen Code disciplined context exposure), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-09

The agent should treat TASK-09 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-001, P-018, P-022, P-026, P-036), review current behavior in the listed files (packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts), compare with allowed external patterns (Claude Code permissions and hooks model, Windsurf allow/deny/auto/turbo command levels, Codex suggest/auto edit/full auto mental model), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

### Guide for TASK-10

The agent should treat TASK-10 as a bounded but rich delivery track. The right way to approach it is to begin from its mapped problems (P-023, P-024, P-030, P-033, P-034), review current behavior in the listed files (tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts), compare with allowed external patterns (Codex trust-through-clear-state, Claude Code health/status surface, Qwen Code failure-path realism), and then convert the findings into a change set that improves runtime truth, UI truth, and test truth together. This task is not complete when the code compiles; it is complete when the operator experience for the associated failure class becomes materially clearer, more reliable, and better evidenced through traces and UI state.

**Questions the agent must answer while implementing**

- What is the operator’s mental model here, and how is the current harness violating it?
- Which exact current state transitions are ambiguous or invisible?
- Which parts of the change belong in engine logic, adapter behavior, planner state, API payloads, and UI components respectively?
- How will a Gemma/Qwen-class model behave under this change, especially under failure conditions?
- What new tests prove the improvement under hostile or messy inputs, not only friendly mocks?

**Proof the agent must produce**

- A before/after note written in plain language.
- A machine-readable trace or event sample that shows the new behavior.
- A UI-visible sample or screenshot plan describing how the user will perceive the change.
- A test proving the behavior does not only work in a happy path.

# 18. Architecture note template the agent should fill after implementation


```md
# Architecture Note

## Scope
What task tracks were touched and why.

## Borrowed from Qwen-side reference
- behavior pattern
- exact Local-AI-Harness file(s)
- why it fit
- what was adapted

## Borrowed from Osaurus
- behavior pattern
- exact Local-AI-Harness file(s)
- why it fit
- what was adapted

## Borrowed from Codex / Claude Code / Cursor / Windsurf
- behavior pattern
- exact Local-AI-Harness file(s)
- why it fit
- what was adapted

## Intentionally not copied
- upstream behavior
- reason it was excluded
- local constraint that ruled it out

## New or changed events
- event
- payload summary
- UI consumer

## Before / after behavior
### Direct chat
### Agentic mode
### Tool failure handling
### Fallback handling
### Runtime status display
```

# 19. Research digest the agent should keep in mind

### Codex

- local terminal agent with suggest/auto edit/full auto-style approval modes
- cloud Codex provisions isolated sandboxed containers per task
- Codex app emphasizes multi-agent workflows, worktrees, skills, automations

### Claude Code

- terminal-first coding tool
- fine-grained permissions with read-only vs bash vs file-modification distinction
- hooks for PreToolUse/PostToolUse/UserPromptSubmit/Notification
- slash commands and subagents for specialization

### Cursor

- Agent/Ask/Manual/Custom mode split
- Agent can use search, edit, terminal, web, MCP tools
- rules and AGENTS.md provide prompt-level persistent instructions

### Windsurf

- Cascade memories vs rules vs workflows vs skills are distinct customization layers
- AGENTS.md is auto-scoped by directory location
- terminal auto-execution has disabled / allowlist / auto / turbo mental model
- context engine is RAG-based and indexes local codebase

### Osaurus

- local-first macOS harness with status UI, memory, skills, schedules, watchers, local/cloud flexibility
- OpenAI-compatible API and MCP server concepts
- product-grade runtime visibility and polished chat surface

### Qwen Code

- open-source terminal agent optimized for Qwen models
- provider-flexible
- described as rich built-in tools with Skills and SubAgents for a Claude Code-like experience
- parser-level adaptations are explicitly called out in the repo as a major contribution

# 20. Durable writing guidance for this AGENTS.md itself

- Prefer concrete, directory- and file-specific instructions over vague aspirations.
- Keep global instructions in the root AGENTS.md; split out subdirectory AGENTS.md files later if directory-specific conventions become dense.
- Do not duplicate parent instructions unnecessarily in child AGENTS files.
- Treat this document as versioned infrastructure, not disposable chat output.

# Appendix A — Detailed issue cards

### P-001

**Core issue:** Danger mode docs claim broad access, but runtime remains workspace-bound; trust and scope mismatch.

**Why this matters for the operator:** P-001 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-002

**Core issue:** Internet tooling exists in runtime but is not coherently wired into agent execution.

**Why this matters for the operator:** P-002 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-003

**Core issue:** Direct mode is general-purpose but split across inconsistent stream/non-stream code paths.

**Why this matters for the operator:** P-003 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-004

**Core issue:** Planner is largely a status tracker rather than a deep working-memory/task-graph system.

**Why this matters for the operator:** P-004 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-005

**Core issue:** Agentic mode uses many early shortcuts that bypass the richer inspect-edit-verify loop.

**Why this matters for the operator:** P-005 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-006

**Core issue:** Low loop caps choke iterative work and spend precious turns on recovery rather than completion.

**Why this matters for the operator:** P-006 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-007

**Core issue:** Manual JSON fallback is brittle for small local models and easy to derail.

**Why this matters for the operator:** P-007 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-008

**Core issue:** Simulation detection exists, but recovery still relies too much on the model fixing itself.

**Why this matters for the operator:** P-008 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-009

**Core issue:** Browser folder context and backend workspace binding are conceptually split and user-confusing.

**Why this matters for the operator:** P-009 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-010

**Core issue:** Workspace resolution is heuristic and can silently fall back to snapshot-only behavior.

**Why this matters for the operator:** P-010 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-011

**Core issue:** Changing workspace root resets important runtime/session/planner state.

**Why this matters for the operator:** P-011 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-012

**Core issue:** Skills loading is coupled to workspace root and can disappear silently after rebinding.

**Why this matters for the operator:** P-012 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-013

**Core issue:** Caveman is runtime-disabled but may still leak in catalog surfaces or build artifacts.

**Why this matters for the operator:** P-013 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-014

**Core issue:** Tool selection is regex-driven and therefore narrow, brittle, and phrasing-sensitive.

**Why this matters for the operator:** P-014 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-015

**Core issue:** Automatic repo-context injection is off by default, weakening hard-task repository understanding.

**Why this matters for the operator:** P-015 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-016

**Core issue:** Idle timeout seems configured but not truly enforced in the main streaming path.

**Why this matters for the operator:** P-016 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-017

**Core issue:** Model lifecycle unloading can look like sleep/crash from the operator’s point of view.

**Why this matters for the operator:** P-017 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-018

**Core issue:** RunCommand is intentionally narrow, which users often experience as broken shell access.

**Why this matters for the operator:** P-018 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-019

**Core issue:** UI visibility compresses activity into counts and summaries instead of precise change ledgers.

**Why this matters for the operator:** P-019 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-020

**Core issue:** Renderer has an honesty fallback because the model often fails to return a real final narrative.

**Why this matters for the operator:** P-020 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-021

**Core issue:** Reasoning blocks can visually dominate the actual useful outcome.

**Why this matters for the operator:** P-021 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-022

**Core issue:** Approvals documentation and UI surface have drifted apart.

**Why this matters for the operator:** P-022 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-023

**Core issue:** Tests mock happy paths and miss real local-model hesitation, RAM pressure, and wedged streams.

**Why this matters for the operator:** P-023 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-024

**Core issue:** Tests encode optimistic success markers that can still feel empty to users.

**Why this matters for the operator:** P-024 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-025

**Core issue:** Native Ollama support is strong, but capability detection and mode selection remain fragile.

**Why this matters for the operator:** P-025 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-026

**Core issue:** Source-of-truth for workspace changes depending on context, eroding trust.

**Why this matters for the operator:** P-026 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-027

**Core issue:** Local-first CPU reality is burdened by orchestration overhead and protocol weight.

**Why this matters for the operator:** P-027 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-028

**Core issue:** Lightweight indexing helps latency but under-serves deep repo understanding tasks.

**Why this matters for the operator:** P-028 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-029

**Core issue:** Frontend config already drifts from backend runtime config fields.

**Why this matters for the operator:** P-029 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-030

**Core issue:** Architecture already normalizes planning-only/simulation failure because those failures are common.

**Why this matters for the operator:** P-030 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-031

**Core issue:** Direct mode is correctly broad, but that only sharpens disappointment in agentic mode.

**Why this matters for the operator:** P-031 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-032

**Core issue:** Nominal context window is large, but effective context use remains poor.

**Why this matters for the operator:** P-032 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-033

**Core issue:** UI exposes run steps and tool cards, but the information density/structure still feels wrong.

**Why this matters for the operator:** P-033 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-034

**Core issue:** Activity tab shows trace headers without enough payload depth for diagnosis.

**Why this matters for the operator:** P-034 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-035

**Core issue:** Tool registry is stronger than the agent’s effective ability to exploit it.

**Why this matters for the operator:** P-035 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

### P-036

**Core issue:** Snapshot-only refusal is honest, but it feels bureaucratic if binding truth is unclear.

**Why this matters for the operator:** P-036 is not a cosmetic problem. It feeds the core trust deficit documented in the audit: the harness looks more capable than it feels, and when it fails it often feels indecisive, confused, or unfinished. This card exists so that future coding agents cannot optimize the wrong thing. They must be able to name the failure class precisely, identify where it lives in the current stack, and explain how their changes reduce the operator pain rather than merely shifting it elsewhere.

**Questions to ask before changing code:** 
1. Is the failure caused by a mismatch between backend reality and user-visible presentation? 
2. Is the failure caused by a shallow or brittle model loop? 
3. Is the failure caused by inadequate planner or session state? 
4. Is the failure caused by a missing event or unclear API contract? 
5. Is the failure caused by a UI component that technically displays information but in the wrong shape?

**What a good fix would look like:** A good fix for any issue card improves three layers at once: runtime truth, visible truth, and test truth. Runtime truth means the system actually behaves better. Visible truth means the operator can see what changed in an understandable way. Test truth means the improvement is encoded in automated checks that exercise realistic failure modes.

**What a bad fix would look like:** A bad fix papers over the symptom in prose, adds a large prompt blob without reducing ambiguity, invents a duplicate subsystem, or makes the harness harder to reason about while claiming to make it more agentic.

# Appendix B — Ten-task sequencing rationale

### TASK-01

TASK-01 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-01 are packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Codex approval-mode clarity, Claude Code permissions surface, Cursor mode separation, Windsurf AGENTS.md and rules scoping) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-02

TASK-02 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-02 are packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Qwen Code parser resilience and terminal-agent discipline, Codex long-horizon context compaction mindset, Claude Code subagents/permissions thinking without copying the stack) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-03

TASK-03 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-03 are packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Qwen Code robust parser adaptations, Codex explicit approval/fallback clarity, Claude Code permission-state transparency) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-04

TASK-04 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-04 are apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Osaurus product-grade chat/runtime feel, Windsurf activity timeline clarity, Codex agent-command-center mental model) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-05

TASK-05 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-05 are apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Cursor Ask/Agent distinction, Codex pair-vs-delegate separation, Osaurus fast local chat feel) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-06

TASK-06 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-06 are packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Osaurus runtime status monitor, Windsurf terminal/runtime controls, Codex environment/status visibility) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-07

TASK-07 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-07 are apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Windsurf AGENTS.md + rules engine concepts, Cursor AGENTS.md and rules layering, Codex Skills mindset without copying cloud assumptions) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-08

TASK-08 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-08 are packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Windsurf RAG/context awareness ideas, Codex repo/environment grounding, Qwen Code disciplined context exposure) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-09

TASK-09 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-09 are packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Claude Code permissions and hooks model, Windsurf allow/deny/auto/turbo command levels, Codex suggest/auto edit/full auto mental model) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

### TASK-10

TASK-10 comes where it does because of dependency order. Later tracks benefit from it, and some later tracks are actively misleading if attempted first. For example, UI polish without event-contract improvements becomes cosmetic; retrieval improvements without tighter tool discipline can worsen small-model confusion; more tests without clarified runtime truth can merely snapshot existing ambiguity. The sequencing rule is simple: first make the harness know what it is doing, then make that state visible, then make it durable and test-realistic.

Primary files for TASK-10 are tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. That list is a bias, not a prison. If a change spills into nearby modules, the agent may touch them, but it should justify why. The listed external references (Codex trust-through-clear-state, Claude Code health/status surface, Qwen Code failure-path realism) are inspiration boundaries: borrow behavior patterns, not branding or foreign architecture.

# Appendix C — Example acceptance test themes

- planning-only native response should trigger intelligent retry and then fallback, not silence
- malformed tool arguments should repair or fail loudly with visible path state
- workspace binding failure should yield explicit `snapshot_only` status in run summary and UI
- stream idle should eventually surface a timeout event and stop pretending work is happening
- direct mode should remain fast and low-overhead compared with agentic mode
- activity timeline should reveal the right story even under many tool events
- change ledger should list files and command activity in a stable readable order
- mode, workspace root, policy mode, fallback mode, and active model should all be visible and consistent

# Appendix D — Source notes

The following source list is included so future agents know which public references informed this AGENTS file.

- **Codex CLI approval modes and local terminal workflow** — OpenAI Help Center — `https://help.openai.com/en/articles/11096431-openai-codex-ci-getting-started`
- **Codex cloud overview: sandboxed cloud containers, background work, GitHub-connected repos** — OpenAI Platform Docs — `https://platform.openai.com/docs/codex/overview`
- **Codex app and product surface: multi-agent workflows, worktrees, skills, automations** — OpenAI — `https://openai.com/codex/`
- **Codex app product announcement** — OpenAI — `https://openai.com/index/introducing-the-codex-app/`
- **Claude Code overview** — Anthropic — `https://docs.anthropic.com/en/docs/claude-code/overview`
- **Claude Code permissions** — Anthropic — `https://code.claude.com/docs/en/permissions`
- **Claude Code hooks** — Anthropic — `https://docs.claude.com/en/docs/claude-code/hooks`
- **Claude Code slash commands** — Anthropic — `https://docs.claude.com/en/docs/claude-code/slash-commands`
- **Claude Code subagents** — Anthropic — `https://code.claude.com/docs/en/sub-agents`
- **Cursor tools** — Cursor — `https://docs.cursor.com/agent/tools`
- **Cursor modes** — Cursor — `https://docs.cursor.com/en/chat/agent`
- **Cursor rules and AGENTS.md** — Cursor — `https://docs.cursor.com/en/context`
- **Windsurf overview** — Windsurf — `https://docs.windsurf.com/windsurf`
- **Windsurf terminal auto-execution levels and allow/deny lists** — Windsurf — `https://docs.windsurf.com/windsurf/terminal`
- **Windsurf memories, rules, workflows, skills, AGENTS.md positioning** — Windsurf — `https://docs.windsurf.com/windsurf/cascade/memories`
- **Windsurf AGENTS.md automatic directory scoping** — Windsurf — `https://docs.windsurf.com/windsurf/cascade/agents-md`
- **Windsurf context awareness / RAG-based indexing** — Windsurf — `https://docs.windsurf.com/context-awareness/overview`
- **Osaurus docs overview** — Osaurus — `https://docs.osaurus.ai/`
- **Osaurus GitHub repo** — GitHub — `https://github.com/osaurus-ai/osaurus`
- **Qwen Code GitHub repo** — GitHub — `https://github.com/QwenLM/qwen-code`

# Appendix E — Implementation playbooks by task track

### TASK-01 playbook

#### Operator story

For TASK-01, the **operator story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-01, the **runtime story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-01, the **planner story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-01, the **trace story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-01, the **api story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-01, the **ui story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-01, the **test story** must be rewritten so that the mapped issues (P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-01 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-02 playbook

#### Operator story

For TASK-02, the **operator story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-02, the **runtime story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-02, the **planner story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-02, the **trace story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-02, the **api story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-02, the **ui story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-02, the **test story** must be rewritten so that the mapped issues (P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-02 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-03 playbook

#### Operator story

For TASK-03, the **operator story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-03, the **runtime story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-03, the **planner story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-03, the **trace story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-03, the **api story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-03, the **ui story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-03, the **test story** must be rewritten so that the mapped issues (P-006, P-007, P-008, P-020, P-025, P-030) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-03 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-04 playbook

#### Operator story

For TASK-04, the **operator story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-04, the **runtime story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-04, the **planner story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-04, the **trace story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-04, the **api story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-04, the **ui story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-04, the **test story** must be rewritten so that the mapped issues (P-019, P-020, P-021, P-022, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-04 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-05 playbook

#### Operator story

For TASK-05, the **operator story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-05, the **runtime story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-05, the **planner story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-05, the **trace story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-05, the **api story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-05, the **ui story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-05, the **test story** must be rewritten so that the mapped issues (P-003, P-027, P-031) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-05 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-06 playbook

#### Operator story

For TASK-06, the **operator story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-06, the **runtime story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-06, the **planner story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-06, the **trace story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-06, the **api story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-06, the **ui story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-06, the **test story** must be rewritten so that the mapped issues (P-016, P-017, P-025, P-027, P-032) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-06 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-07 playbook

#### Operator story

For TASK-07, the **operator story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-07, the **runtime story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-07, the **planner story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-07, the **trace story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-07, the **api story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-07, the **ui story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-07, the **test story** must be rewritten so that the mapped issues (P-012, P-013, P-015, P-028, P-029) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-07 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-08 playbook

#### Operator story

For TASK-08, the **operator story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-08, the **runtime story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-08, the **planner story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-08, the **trace story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-08, the **api story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-08, the **ui story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-08, the **test story** must be rewritten so that the mapped issues (P-002, P-014, P-015, P-028, P-032, P-035) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-08 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-09 playbook

#### Operator story

For TASK-09, the **operator story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-09, the **runtime story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-09, the **planner story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-09, the **trace story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-09, the **api story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-09, the **ui story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-09, the **test story** must be rewritten so that the mapped issues (P-001, P-018, P-022, P-026, P-036) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-09 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

### TASK-10 playbook

#### Operator story

For TASK-10, the **operator story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Runtime story

For TASK-10, the **runtime story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Planner story

For TASK-10, the **planner story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Trace story

For TASK-10, the **trace story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### API story

For TASK-10, the **api story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### UI story

For TASK-10, the **ui story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

#### Test story

For TASK-10, the **test story** must be rewritten so that the mapped issues (P-023, P-024, P-030, P-033, P-034) become legible and improvable. The agent should explicitly describe the current failure mode, the desired future behavior, the state transitions involved, and the evidence the user will see when the change is done. This requirement exists because Local-AI-Harness has repeatedly suffered from partial solutions that improved one layer while leaving another layer ambiguous. Every change in TASK-10 should therefore be narratable through this seven-lens method: what the operator thinks is happening, what runtime actually does, what planner remembers, what traces emit, what API streams, what UI renders, and what tests verify.

# Appendix F — Work-package backlog for the ten task tracks

### Backlog for TASK-01 — Converge system truth around workspace, mode, and operator expectations

#### WP-01

Within TASK-01, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-01, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-01, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-01, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-01, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-01, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-01, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-01, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-001, P-003, P-009, P-010, P-011, P-026, P-029, P-036 and the primary files packages/core/src/engine.ts, packages/workspace-policy/src/policy.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-02 — Rebuild the small-model agent loop so Gemma/Qwen act instead of hesitating

#### WP-01

Within TASK-02, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-02, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-02, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-02, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-02, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-02, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-02, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-02, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-004, P-005, P-006, P-007, P-008, P-014, P-015, P-030, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/model-adapter/src/client.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-03 — Make manual fallback a first-class, inspectable operating path

#### WP-01

Within TASK-03, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-03, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-03, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-03, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-03, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-03, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-03, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-03, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-006, P-007, P-008, P-020, P-025, P-030 and the primary files packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/api/src/server.ts, apps/web/src/components/ChatMessageRow.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-04 — Redesign operational visibility so the UI tells the right story

#### WP-01

Within TASK-04, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-04, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-04, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-04, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-04, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-04, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-04, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-04, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-019, P-020, P-021, P-022, P-033, P-034 and the primary files apps/web/src/HarnessApp.tsx, apps/web/src/components/ChatMessageRow.tsx, apps/web/src/components/AgentRunSummary.tsx, apps/web/src/components/AgentRunSteps.tsx, packages/trace-bus/src/*. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-05 — Strengthen direct chat as a lean everyday mode with minimal agent overhead

#### WP-01

Within TASK-05, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-05, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-05, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-05, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-05, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-05, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-05, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-05, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-003, P-027, P-031 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/model-adapter/src/client.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-06 — Improve runtime/model control, loading policy, and stall handling

#### WP-01

Within TASK-06, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-06, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-06, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-06, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-06, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-06, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-06, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-06, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-016, P-017, P-025, P-027, P-032 and the primary files packages/model-adapter/src/client.ts, packages/core/src/engine.ts, apps/api/src/server.ts, apps/web/src/HarnessApp.tsx. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-07 — Fix skill, instruction, and durable-context hygiene

#### WP-01

Within TASK-07, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-07, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-07, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-07, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-07, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-07, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-07, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-07, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-012, P-013, P-015, P-028, P-029 and the primary files apps/api/src/server.ts, packages/core/src/engine.ts, packages/planner/src/planner.ts, packages/session-store/src/store.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-08 — Add internet, retrieval, and repo-understanding improvements without bloating small-model prompts

#### WP-01

Within TASK-08, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-08, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-08, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-08, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-08, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-08, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-08, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-08, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-002, P-014, P-015, P-028, P-032, P-035 and the primary files packages/core/src/engine.ts, packages/tool-runtime/src/registry.ts, packages/model-adapter/src/client.ts, packages/planner/src/planner.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-09 — Bring terminal and command execution under clearer safety and autonomy controls

#### WP-01

Within TASK-09, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-09, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-09, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-09, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-09, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-09, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-09, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-09, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-001, P-018, P-022, P-026, P-036 and the primary files packages/tool-runtime/src/registry.ts, packages/workspace-policy/src/policy.ts, apps/web/src/HarnessApp.tsx, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

### Backlog for TASK-10 — Close the realism gap with better traces, event contracts, and adversarial tests

#### WP-01

Within TASK-10, work package 01 is: Define the exact current failure state in code and in user-visible behavior before changing anything. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-02

Within TASK-10, work package 02 is: Identify the minimum set of files that currently own the broken contract and list which layer each belongs to. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-03

Within TASK-10, work package 03 is: Specify the new planner fields or run-summary fields needed so the behavior becomes visible and persistent. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-04

Within TASK-10, work package 04 is: Specify the new or changed trace events needed so the UI and tests can consume the behavior without inferring it from prose. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-05

Within TASK-10, work package 05 is: Implement the runtime change in the existing path rather than inventing a parallel mechanism. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-06

Within TASK-10, work package 06 is: Write one adversarial test and one realistic flow test for the new behavior. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-07

Within TASK-10, work package 07 is: Document the before/after behavior in operator language, not only in implementation language. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

#### WP-08

Within TASK-10, work package 08 is: Review whether the change improves or worsens small-model prompt pressure and token load. This package should be interpreted against the mapped issues P-023, P-024, P-030, P-033, P-034 and the primary files tests/unit/core.test.ts, tests/e2e/api.test.ts, packages/trace-bus/src/*, packages/core/src/engine.ts, apps/api/src/server.ts. The agent should not treat this as a checklist item to be ticked mechanically. It should produce a concrete artifact: a note, a diff, a planner field, an event schema, a UI element, or a test. The point of this repeated structure is to force completeness. Local-AI-Harness has enough architecture already; what it lacks is disciplined closure across runtime, presentation, and verification.

When completing this package, the agent should answer four questions in writing: 
(1) what exact ambiguity is being removed, 
(2) how the new behavior will be visible to the user, 
(3) how the behavior will survive a messy small-model reply, and 
(4) what test or trace proves the result. If any of these answers is vague, the package is not finished.

# Appendix G — Detailed porting ledger patterns from external systems

### Codex

#### Approval-mode clarity

When borrowing **Approval-mode clarity** from Codex, the agent should interpret the pattern as follows: Map Local-AI-Harness modes and command/file autonomy into a visible, low-confusion ladder so the operator knows the difference between read-only help, auto-edit with command approval, and more autonomous execution. Do not copy Codex cloud infrastructure; copy the clarity of the contract. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Pair vs delegate distinction

When borrowing **Pair vs delegate distinction** from Codex, the agent should interpret the pattern as follows: Keep direct chat lean and agentic work purposeful. When the user just wants help, avoid heavy agent protocol. When the user wants work done, expose an execution-oriented path with explicit status. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Context compaction for long-horizon work

When borrowing **Context compaction for long-horizon work** from Codex, the agent should interpret the pattern as follows: Favor compact persistent state and targeted retrieval over raw history growth. The point is not to imitate OpenAI internals but to preserve long-horizon coherence under local-model limits. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Skills as organized reusable capability

When borrowing **Skills as organized reusable capability** from Codex, the agent should interpret the pattern as follows: Treat skills as curated reusable capability rather than random prompt snippets; surface missing/disabled/active state clearly. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Worktree and environment mentality

When borrowing **Worktree and environment mentality** from Codex, the agent should interpret the pattern as follows: Even if this harness cannot match Codex cloud worktrees, it should adopt the mindset that execution context must be explicit, inspectable, and isolated enough to trust. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Automations mental model

When borrowing **Automations mental model** from Codex, the agent should interpret the pattern as follows: Background or scheduled behavior should only be added where runtime truth and user visibility remain strong; never quietly automate ambiguous states. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

### Claude Code

#### Fine-grained permissions

When borrowing **Fine-grained permissions** from Claude Code, the agent should interpret the pattern as follows: Separate read, write, and command autonomy clearly, and allow the user to see permission state and approval provenance. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Pre/post tool hooks mindset

When borrowing **Pre/post tool hooks mindset** from Claude Code, the agent should interpret the pattern as follows: Use explicit pre-tool and post-tool policy points inside the current architecture to normalize tool behavior and status emission. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Slash commands and specialization

When borrowing **Slash commands and specialization** from Claude Code, the agent should interpret the pattern as follows: Treat repeatable workflows as explicit capabilities or documented commands rather than hidden magic. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Subagent discipline

When borrowing **Subagent discipline** from Claude Code, the agent should interpret the pattern as follows: If specialization is added, it must remain inspectable, deny-able, and bounded; do not explode the system into invisible autonomous helpers. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Health/status surfaces

When borrowing **Health/status surfaces** from Claude Code, the agent should interpret the pattern as follows: Expose installation/runtime/model/connectivity state visibly so users can diagnose the system without reading source. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Compaction and memory controls

When borrowing **Compaction and memory controls** from Claude Code, the agent should interpret the pattern as follows: Allow explicit compaction/summarization behaviors for long sessions rather than pretending history is free. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

### Cursor

#### Mode separation

When borrowing **Mode separation** from Cursor, the agent should interpret the pattern as follows: Use a clear everyday-help path and a clear autonomous-work path; let the UI reinforce that distinction. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Configurable tool sets

When borrowing **Configurable tool sets** from Cursor, the agent should interpret the pattern as follows: Reduce confusion by choosing a tight relevant tool set per mode and per turn. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Rules and AGENTS.md

When borrowing **Rules and AGENTS.md** from Cursor, the agent should interpret the pattern as follows: Treat persistent instructions as prompt-level infrastructure rather than as conversation residue. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Manual/Ask/Agent mentality

When borrowing **Manual/Ask/Agent mentality** from Cursor, the agent should interpret the pattern as follows: Not every request should have the same autonomy surface; different request classes justify different tool exposure. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Web and MCP awareness

When borrowing **Web and MCP awareness** from Cursor, the agent should interpret the pattern as follows: External capability should be explicit and policy-governed rather than silently available or silently absent. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Auto-run/auto-fix caution

When borrowing **Auto-run/auto-fix caution** from Cursor, the agent should interpret the pattern as follows: Automation is useful only if failure and rollback remain legible. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

### Windsurf

#### AGENTS.md directory scoping

When borrowing **AGENTS.md directory scoping** from Windsurf, the agent should interpret the pattern as follows: Root instructions should be always-on; subdirectory instructions should be scoped by location. This is especially relevant if Local-AI-Harness later adds nested AGENTS files. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Rules vs memories vs workflows vs skills

When borrowing **Rules vs memories vs workflows vs skills** from Windsurf, the agent should interpret the pattern as follows: Keep durable shared knowledge separate from auto-generated memory and separate again from complex reusable workflows. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Terminal allow/deny/auto/turbo ladder

When borrowing **Terminal allow/deny/auto/turbo ladder** from Windsurf, the agent should interpret the pattern as follows: A clearer command execution posture can help users reason about shell autonomy without guessing. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Activity timeline

When borrowing **Activity timeline** from Windsurf, the agent should interpret the pattern as follows: Show phase, current tool, preview, and summary in a product-grade sequence rather than raw logs. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Context-aware retrieval

When borrowing **Context-aware retrieval** from Windsurf, the agent should interpret the pattern as follows: Use repository context intelligently, but do not over-pin or over-bloat prompts for small models. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Current-state runtime indicators

When borrowing **Current-state runtime indicators** from Windsurf, the agent should interpret the pattern as follows: Configured model, active model, workspace root, current policy, and execution path should be visible without digging. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

### Osaurus

#### Local-first harness framing

When borrowing **Local-first harness framing** from Osaurus, the agent should interpret the pattern as follows: Reinforce that the harness, not a single model, is the compounding layer. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Runtime status and monitor feel

When borrowing **Runtime status and monitor feel** from Osaurus, the agent should interpret the pattern as follows: Bring product-grade runtime visibility and status polish into the existing web UI. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Chat polish

When borrowing **Chat polish** from Osaurus, the agent should interpret the pattern as follows: Stream output smoothly, keep markdown readable, and avoid letting diagnostics swallow the chat experience. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Tool-compatible API posture

When borrowing **Tool-compatible API posture** from Osaurus, the agent should interpret the pattern as follows: Preserve compatible local model and tool interfaces where useful, but do not chase Apple-specific runtime internals. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Memory/skills/watchers mental model

When borrowing **Memory/skills/watchers mental model** from Osaurus, the agent should interpret the pattern as follows: Use organized capability layers as a design reference, not as a mandate to clone every feature. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Product coherence

When borrowing **Product coherence** from Osaurus, the agent should interpret the pattern as follows: Make the harness feel intentional, not accidental. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

### Qwen Code

#### Parser resilience

When borrowing **Parser resilience** from Qwen Code, the agent should interpret the pattern as follows: Adopt stronger repair around malformed tool payloads, code fences, JSON drift, and small-model formatting noise. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Terminal-agent ergonomics

When borrowing **Terminal-agent ergonomics** from Qwen Code, the agent should interpret the pattern as follows: Treat command-line execution as a first-class coding workflow, not an afterthought. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Small-model survival tactics

When borrowing **Small-model survival tactics** from Qwen Code, the agent should interpret the pattern as follows: Prioritize anti-hesitation behavior, compact state, and disciplined tool exposure. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Provider flexibility

When borrowing **Provider flexibility** from Qwen Code, the agent should interpret the pattern as follows: Keep model/provider logic adapter-driven, not woven into random code paths. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Interactive vs headless split

When borrowing **Interactive vs headless split** from Qwen Code, the agent should interpret the pattern as follows: Maintain a lean interactive path and a scriptable/automatable path where sensible. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

#### Claude-Code-like but Qwen-adapted lesson

When borrowing **Claude-Code-like but Qwen-adapted lesson** from Qwen Code, the agent should interpret the pattern as follows: The lesson is not branding; the lesson is that parser-level and small-model-specific adaptation matter. The port is successful only if it closes a mapped Local-AI-Harness problem and leaves the resulting behavior more legible to the operator. A pattern is not considered ported merely because similar words appear in the UI or code. It is ported when the current harness actually behaves better under real local-model conditions.

# Appendix H — Full problem-guidance matrix

### P-001

#### Operator lens

From the operator lens, P-001 should be understood as follows: Danger mode docs claim broad access, but runtime remains workspace-bound; trust and scope mismatch. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-001 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-002

#### Operator lens

From the operator lens, P-002 should be understood as follows: Internet tooling exists in runtime but is not coherently wired into agent execution. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-002 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-003

#### Operator lens

From the operator lens, P-003 should be understood as follows: Direct mode is general-purpose but split across inconsistent stream/non-stream code paths. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-003 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-004

#### Operator lens

From the operator lens, P-004 should be understood as follows: Planner is largely a status tracker rather than a deep working-memory/task-graph system. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-004 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-005

#### Operator lens

From the operator lens, P-005 should be understood as follows: Agentic mode uses many early shortcuts that bypass the richer inspect-edit-verify loop. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-005 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-006

#### Operator lens

From the operator lens, P-006 should be understood as follows: Low loop caps choke iterative work and spend precious turns on recovery rather than completion. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-006 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-007

#### Operator lens

From the operator lens, P-007 should be understood as follows: Manual JSON fallback is brittle for small local models and easy to derail. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-007 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-008

#### Operator lens

From the operator lens, P-008 should be understood as follows: Simulation detection exists, but recovery still relies too much on the model fixing itself. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-008 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-009

#### Operator lens

From the operator lens, P-009 should be understood as follows: Browser folder context and backend workspace binding are conceptually split and user-confusing. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-009 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-010

#### Operator lens

From the operator lens, P-010 should be understood as follows: Workspace resolution is heuristic and can silently fall back to snapshot-only behavior. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-010 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-011

#### Operator lens

From the operator lens, P-011 should be understood as follows: Changing workspace root resets important runtime/session/planner state. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-011 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-012

#### Operator lens

From the operator lens, P-012 should be understood as follows: Skills loading is coupled to workspace root and can disappear silently after rebinding. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-012 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-013

#### Operator lens

From the operator lens, P-013 should be understood as follows: Caveman is runtime-disabled but may still leak in catalog surfaces or build artifacts. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-013 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-014

#### Operator lens

From the operator lens, P-014 should be understood as follows: Tool selection is regex-driven and therefore narrow, brittle, and phrasing-sensitive. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-014 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-015

#### Operator lens

From the operator lens, P-015 should be understood as follows: Automatic repo-context injection is off by default, weakening hard-task repository understanding. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-015 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-016

#### Operator lens

From the operator lens, P-016 should be understood as follows: Idle timeout seems configured but not truly enforced in the main streaming path. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-016 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-017

#### Operator lens

From the operator lens, P-017 should be understood as follows: Model lifecycle unloading can look like sleep/crash from the operator’s point of view. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-017 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-018

#### Operator lens

From the operator lens, P-018 should be understood as follows: RunCommand is intentionally narrow, which users often experience as broken shell access. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-018 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-019

#### Operator lens

From the operator lens, P-019 should be understood as follows: UI visibility compresses activity into counts and summaries instead of precise change ledgers. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-019 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-020

#### Operator lens

From the operator lens, P-020 should be understood as follows: Renderer has an honesty fallback because the model often fails to return a real final narrative. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-020 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-021

#### Operator lens

From the operator lens, P-021 should be understood as follows: Reasoning blocks can visually dominate the actual useful outcome. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-021 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-022

#### Operator lens

From the operator lens, P-022 should be understood as follows: Approvals documentation and UI surface have drifted apart. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-022 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-023

#### Operator lens

From the operator lens, P-023 should be understood as follows: Tests mock happy paths and miss real local-model hesitation, RAM pressure, and wedged streams. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-023 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-024

#### Operator lens

From the operator lens, P-024 should be understood as follows: Tests encode optimistic success markers that can still feel empty to users. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-024 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-025

#### Operator lens

From the operator lens, P-025 should be understood as follows: Native Ollama support is strong, but capability detection and mode selection remain fragile. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-025 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-026

#### Operator lens

From the operator lens, P-026 should be understood as follows: Source-of-truth for workspace changes depending on context, eroding trust. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-026 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-027

#### Operator lens

From the operator lens, P-027 should be understood as follows: Local-first CPU reality is burdened by orchestration overhead and protocol weight. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-027 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-028

#### Operator lens

From the operator lens, P-028 should be understood as follows: Lightweight indexing helps latency but under-serves deep repo understanding tasks. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-028 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-029

#### Operator lens

From the operator lens, P-029 should be understood as follows: Frontend config already drifts from backend runtime config fields. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-029 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-030

#### Operator lens

From the operator lens, P-030 should be understood as follows: Architecture already normalizes planning-only/simulation failure because those failures are common. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-030 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-031

#### Operator lens

From the operator lens, P-031 should be understood as follows: Direct mode is correctly broad, but that only sharpens disappointment in agentic mode. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-031 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-032

#### Operator lens

From the operator lens, P-032 should be understood as follows: Nominal context window is large, but effective context use remains poor. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-032 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-033

#### Operator lens

From the operator lens, P-033 should be understood as follows: UI exposes run steps and tool cards, but the information density/structure still feels wrong. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-033 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-034

#### Operator lens

From the operator lens, P-034 should be understood as follows: Activity tab shows trace headers without enough payload depth for diagnosis. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-034 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-035

#### Operator lens

From the operator lens, P-035 should be understood as follows: Tool registry is stronger than the agent’s effective ability to exploit it. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-035 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

### P-036

#### Operator lens

From the operator lens, P-036 should be understood as follows: Snapshot-only refusal is honest, but it feels bureaucratic if binding truth is unclear. The operator does not care which module technically caused the issue; they care whether the assistant felt dependable. Therefore any change targeting P-036 must improve the user’s ability to predict, interpret, and trust the harness. A fix that only changes code without changing the user’s ability to understand the behavior is insufficient.

#### Engine lens

From the engine lens, the agent should identify the controlling state machine, retries, loop budgets, parser behavior, and policy checks that create or amplify this issue. The implementation goal is not merely to add more text to prompts, but to improve the contract between model behavior and deterministic runtime behavior. When in doubt, add stronger structure around the model instead of asking the model to be magically more perfect.

#### UI lens

From the UI lens, the question is: what should the user see when this issue is happening, and what should they see after it is fixed? Every important runtime state should have a visual correlate or a trace correlate that is accessible from the current app. The UI must not be forced to reverse-engineer execution truth from free-form prose alone.

#### Porting lens

From the porting lens, the agent should ask which external reference offers the best transferable idea for this issue. Some issues are better informed by Codex-style clarity, some by Claude Code permissions discipline, some by Cursor/Windsurf mode and rule design, some by Osaurus polish, and many by Qwen-side parser resilience. Choose the pattern that matches the issue class, not the tool with the coolest branding.

#### Verification lens

From the verification lens, the agent must specify exactly how the improvement will be proven. That proof can be a new test, a trace sample, a run-summary field, a UI element, or a measured reduction in clarification loops—but it must be concrete. A claim like 'this should make the model smarter' is not verification.

# Appendix I — Examples of good and bad AGENTS.md instructions

- **Good:** When changing planner state, add a machine-readable field and ensure the same field appears in API output and the UI activity model.
- **Bad:** Improve the planner so it is more robust and intelligent.
- **Good:** If the requested coding task is executable with current workspace binding and current policy, inspect first, act second, and ask follow-up only when a specific blocker remains.
- **Bad:** Try not to ask too many questions.
- **Good:** If native tool mode emits planning-only text or malformed tool payloads, retry once with a targeted correction; then explicitly activate manual fallback and surface the path in run summary and UI.
- **Bad:** Handle tool-call failures better.
- **Good:** Direct mode must stay on the shortest reliable path and should not inherit agentic trace overhead unless the feature directly improves direct-chat usability.
- **Bad:** Make direct mode cleaner.

# Appendix J — Checklist for deciding whether a change belongs in AGENTS.md, rules, memory, or code

- If it is a durable instruction about how agents should behave in this repo, put it in AGENTS.md or a scoped child AGENTS.md.
- If it is reusable project guidance with activation logic, a rules mechanism may be more appropriate.
- If it is transient learned context from one run, it belongs in planner/session summaries, not as permanent global instruction.
- If it is a runtime truth needed by the UI or tests, it belongs in code and event contracts, not only in documentation.
- If it is a one-off observation about an upstream repo, put it in a porting ledger or architecture note rather than polluting permanent instructions.

# Appendix K — Failure vignettes and desired future behavior

### P-001

#### Current likely vignette

A plausible current vignette for P-001 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences danger mode docs claim broad access, but runtime remains workspace-bound; trust and scope mismatch. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-002

#### Current likely vignette

A plausible current vignette for P-002 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences internet tooling exists in runtime but is not coherently wired into agent execution. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-003

#### Current likely vignette

A plausible current vignette for P-003 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences direct mode is general-purpose but split across inconsistent stream/non-stream code paths. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-004

#### Current likely vignette

A plausible current vignette for P-004 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences planner is largely a status tracker rather than a deep working-memory/task-graph system. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-005

#### Current likely vignette

A plausible current vignette for P-005 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences agentic mode uses many early shortcuts that bypass the richer inspect-edit-verify loop. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-006

#### Current likely vignette

A plausible current vignette for P-006 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences low loop caps choke iterative work and spend precious turns on recovery rather than completion. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-007

#### Current likely vignette

A plausible current vignette for P-007 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences manual json fallback is brittle for small local models and easy to derail. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-008

#### Current likely vignette

A plausible current vignette for P-008 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences simulation detection exists, but recovery still relies too much on the model fixing itself. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-009

#### Current likely vignette

A plausible current vignette for P-009 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences browser folder context and backend workspace binding are conceptually split and user-confusing. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-010

#### Current likely vignette

A plausible current vignette for P-010 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences workspace resolution is heuristic and can silently fall back to snapshot-only behavior. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-011

#### Current likely vignette

A plausible current vignette for P-011 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences changing workspace root resets important runtime/session/planner state. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-012

#### Current likely vignette

A plausible current vignette for P-012 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences skills loading is coupled to workspace root and can disappear silently after rebinding. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-013

#### Current likely vignette

A plausible current vignette for P-013 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences caveman is runtime-disabled but may still leak in catalog surfaces or build artifacts. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-014

#### Current likely vignette

A plausible current vignette for P-014 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences tool selection is regex-driven and therefore narrow, brittle, and phrasing-sensitive. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-015

#### Current likely vignette

A plausible current vignette for P-015 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences automatic repo-context injection is off by default, weakening hard-task repository understanding. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-016

#### Current likely vignette

A plausible current vignette for P-016 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences idle timeout seems configured but not truly enforced in the main streaming path. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-017

#### Current likely vignette

A plausible current vignette for P-017 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences model lifecycle unloading can look like sleep/crash from the operator’s point of view. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-018

#### Current likely vignette

A plausible current vignette for P-018 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences runcommand is intentionally narrow, which users often experience as broken shell access. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-019

#### Current likely vignette

A plausible current vignette for P-019 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences ui visibility compresses activity into counts and summaries instead of precise change ledgers. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-020

#### Current likely vignette

A plausible current vignette for P-020 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences renderer has an honesty fallback because the model often fails to return a real final narrative. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-021

#### Current likely vignette

A plausible current vignette for P-021 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences reasoning blocks can visually dominate the actual useful outcome. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-022

#### Current likely vignette

A plausible current vignette for P-022 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences approvals documentation and ui surface have drifted apart. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-023

#### Current likely vignette

A plausible current vignette for P-023 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences tests mock happy paths and miss real local-model hesitation, ram pressure, and wedged streams. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-024

#### Current likely vignette

A plausible current vignette for P-024 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences tests encode optimistic success markers that can still feel empty to users. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-025

#### Current likely vignette

A plausible current vignette for P-025 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences native ollama support is strong, but capability detection and mode selection remain fragile. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-026

#### Current likely vignette

A plausible current vignette for P-026 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences source-of-truth for workspace changes depending on context, eroding trust. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-027

#### Current likely vignette

A plausible current vignette for P-027 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences local-first cpu reality is burdened by orchestration overhead and protocol weight. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-028

#### Current likely vignette

A plausible current vignette for P-028 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences lightweight indexing helps latency but under-serves deep repo understanding tasks. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-029

#### Current likely vignette

A plausible current vignette for P-029 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences frontend config already drifts from backend runtime config fields. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-030

#### Current likely vignette

A plausible current vignette for P-030 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences architecture already normalizes planning-only/simulation failure because those failures are common. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-031

#### Current likely vignette

A plausible current vignette for P-031 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences direct mode is correctly broad, but that only sharpens disappointment in agentic mode. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-032

#### Current likely vignette

A plausible current vignette for P-032 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences nominal context window is large, but effective context use remains poor. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-033

#### Current likely vignette

A plausible current vignette for P-033 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences ui exposes run steps and tool cards, but the information density/structure still feels wrong. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-034

#### Current likely vignette

A plausible current vignette for P-034 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences activity tab shows trace headers without enough payload depth for diagnosis. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-035

#### Current likely vignette

A plausible current vignette for P-035 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences tool registry is stronger than the agent’s effective ability to exploit it. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

### P-036

#### Current likely vignette

A plausible current vignette for P-036 is that a user asks the harness to do something that should feel routine, but the system responds with uncertainty, fragmented visibility, or a mismatch between what the interface implies and what runtime truth allows. In plain language, the user experiences snapshot-only refusal is honest, but it feels bureaucratic if binding truth is unclear. The important lesson for future agents is that these vignettes are not edge fiction; they are proxies for how trust erodes in real use. A fix should therefore be shaped around the vignette, not merely around the code abstraction.

#### Desired future vignette

In the desired future vignette, the same request produces a clearer contract. The user can tell what mode is active, what context is bound, what the system is trying next, what tool path is in use, what changed, and what blocked progress if any. Even when the harness cannot complete the task, it should fail in a way that still feels trustworthy, bounded, and technically grounded.

#### Implementation reminder

Do not treat the future vignette as a UI-only goal. The runtime, planner, API, traces, and tests must line up so the visible improvement is backed by real behavior. If the vignette is only cosmetically improved while the engine remains ambiguous, the issue is not fixed.

# Appendix L — Task-track review rubrics

### TASK-01

Use this rubric to review work delivered under TASK-01. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-01: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-01: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-01: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-01: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-01: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-01: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-01: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-01: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-02

Use this rubric to review work delivered under TASK-02. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-02: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-02: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-02: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-02: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-02: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-02: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-02: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-02: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-03

Use this rubric to review work delivered under TASK-03. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-03: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-03: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-03: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-03: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-03: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-03: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-03: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-03: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-04

Use this rubric to review work delivered under TASK-04. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-04: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-04: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-04: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-04: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-04: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-04: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-04: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-04: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-05

Use this rubric to review work delivered under TASK-05. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-05: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-05: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-05: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-05: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-05: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-05: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-05: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-05: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-06

Use this rubric to review work delivered under TASK-06. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-06: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-06: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-06: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-06: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-06: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-06: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-06: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-06: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-07

Use this rubric to review work delivered under TASK-07. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-07: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-07: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-07: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-07: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-07: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-07: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-07: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-07: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-08

Use this rubric to review work delivered under TASK-08. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-08: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-08: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-08: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-08: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-08: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-08: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-08: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-08: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-09

Use this rubric to review work delivered under TASK-09. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-09: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-09: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-09: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-09: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-09: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-09: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-09: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-09: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

### TASK-10

Use this rubric to review work delivered under TASK-10. A change should not be accepted merely because it compiles or because one demo looks better. It should be evaluated against the criteria below, with explicit notes describing what changed, what evidence exists, and what still remains weak.

#### Runtime truth is clearer and more deterministic.

Review question for TASK-10: how does this work demonstrate that **runtime truth is clearer and more deterministic.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Planner state is richer or more useful where needed.

Review question for TASK-10: how does this work demonstrate that **planner state is richer or more useful where needed.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Trace/event payloads got more explicit instead of more noisy.

Review question for TASK-10: how does this work demonstrate that **trace/event payloads got more explicit instead of more noisy.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### UI clarity improved without burying the final answer.

Review question for TASK-10: how does this work demonstrate that **ui clarity improved without burying the final answer.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Small-model prompt load did not bloat unnecessarily.

Review question for TASK-10: how does this work demonstrate that **small-model prompt load did not bloat unnecessarily.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Fallback behavior became more inspectable and less mysterious.

Review question for TASK-10: how does this work demonstrate that **fallback behavior became more inspectable and less mysterious.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### Tests gained at least one realistic hostile-path case.

Review question for TASK-10: how does this work demonstrate that **tests gained at least one realistic hostile-path case.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

#### The change did not create a duplicate orchestration core.

Review question for TASK-10: how does this work demonstrate that **the change did not create a duplicate orchestration core.**? The reviewer should demand concrete evidence: a diff, a trace payload, a UI artifact, a run-summary field, a test, or a measured behavioral difference. If the answer is hand-wavy, the criterion is not satisfied. This insistence on evidence is necessary because Local-AI-Harness has suffered from elegant-sounding but weakly grounded changes before.

# Appendix M — Suggested nested AGENTS.md strategy for the future

- **root/AGENTS.md** — global product truth, architecture constraints, external reference policy, task-track program
- **packages/core/AGENTS.md** — engine loop, planner interplay, fallback logic, event schema discipline
- **packages/model-adapter/AGENTS.md** — Ollama/native capability handling, model lifecycle, retries, timeouts
- **packages/tool-runtime/AGENTS.md** — tool safety, command execution rules, preview/result semantics
- **apps/api/AGENTS.md** — streaming contracts, session/workspace binding truth, approval API behavior
- **apps/web/AGENTS.md** — activity timeline, answer-vs-trace separation, runtime badges, change ledger
- **tests/AGENTS.md** — realism-first local-model tests, hostile-path coverage, event contract assertions

The root file should stay authoritative on global product truth. Nested files should only appear when a directory accumulates enough local complexity that a scoped instruction file will materially help future agents. Do not create nested AGENTS.md files just because it feels sophisticated; create them when local conventions or failure modes are genuinely different and worth scoping by directory.

# Appendix N — Implementation notes on the unresolved repo-name discrepancy

The user-provided integration prompt names `osaurus-ai/osaurus` and `deepfounder-ai/qwe-qwe`. Public research in this session strongly supports the existence of Osaurus under the `osaurus-ai/osaurus` identity and an official documentation site. Public research did not confirm a `deepfounder-ai/qwe-qwe` repository. The nearest high-confidence open-source terminal-agent reference matching the desired small-model patterns is `QwenLM/qwen-code`. Future agents must preserve this distinction: attempt the exact requested clone first, but if it does not resolve, record the substitution and continue with the verified fallback rather than pretending the requested repo was available.

This note is intentionally persistent because hidden substitutions are a trust failure. A high-quality coding agent should be honest when upstream identifiers are unavailable, especially when the whole purpose of the work is to improve operator trust in Local-AI-Harness itself.

# Appendix O — Long-form reminders for future maintainers

- The audit already proved that the harness has architecture. Stop acting as if one more subsystem is the cure.
- Most failures are not missing-feature failures; they are convergence failures.
- Visibility is not the same as raw logging. Activity should explain work, not drown it.
- A model with a large context window can still feel myopic if orchestration is weak.
- When the user says the model is 'sleeping', check runtime lifecycle and streaming watchdogs before blaming the model.
- When the user says the tool system is bad, inspect routing, fallback, and UI storytelling before rewriting the registry.
- When the user says the harness asks too many questions, inspect internal decomposition, tool discipline, and anti-hedge behavior.
- When the user cannot tell what changed, the fault is both in the UI ledger and in the event contract beneath it.
- Good local-agent design is not about maximal autonomy. It is about bounded autonomy plus truthfulness.
- Any feature that makes the system harder to explain to the operator must justify itself with major gains.

# Appendix P — Final operating mantra

The harness must stop feeling like a protocol stack that occasionally behaves like a worker and start feeling like a worker whose protocol stack is visible, trustworthy, and disciplined. That is the design bar. Every future change should be judged against it.

In short: one workspace truth, one mode truth, one runtime truth, one visible story, one testable contract. If a change weakens any of those, it does not belong here—even if it sounds intelligent.

# Appendix Q — Review prompts for human supervisors

### TASK-01

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-02

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-03

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-04

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-05

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-06

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-07

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-08

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-09

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?

### TASK-10

- Can I tell, from the UI alone, what the harness is doing right now?
- Can I tell which workspace root is real and whether the run is snapshot-only or backend-bound?
- Can I tell whether the harness is using native tools, a repaired native retry, or manual fallback?
- If the model hesitates, do I see a bounded recovery path rather than an endless stall?
- If files changed, can I tell which files and roughly what happened without reading the raw diff first?
- Would this behavior still make sense on Gemma 4 E4B or Qwen 3.5 9B under local CPU constraints?
- Is the change easier to explain than the behavior it replaced?
