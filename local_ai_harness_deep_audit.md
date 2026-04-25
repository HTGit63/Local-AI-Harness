# Local AI Harness Deep Architecture Audit
## Scope

This report audits the repository **HTGit63/Local-AI-Harness** as inspected through the available GitHub connector and fetched source files.

Important constraint: I could **not** perform live web browsing in this session because web search is disabled.  
So this report is **repo-grounded**, not web-research-grounded.

This is therefore a **code-and-architecture audit**, not a market survey, competitor benchmark, or live dependency intelligence report.

The user's request was explicit: focus on **problems**, not solutions.  
Accordingly, this document is deliberately diagnosis-heavy and fix-light.

Target product intent, based on repo docs and user framing:
- direct mode should behave like a broad everyday local assistant,
- agentic mode should behave like a local coding operator,
- the whole system should feel like a local/offline Codex-style harness centered around Gemma 4,
- operator trust depends on workspace truth, action visibility, useful explanations, and reliable execution rather than merely having many packages.

## Short answer to the user's main questions

### 1. Is direct mode actually general purpose?
Yes, in architectural intent and in the API implementation, direct mode is general-purpose chat rather than a coding harness.  
But there is an implementation inconsistency: the non-stream and stream direct paths do not go through the exact same backend route.

### 2. Is agentic mode weak for real reasons visible in the repo?
Yes. Very much so.  
The weakness is not reducible to “Gemma is bad.” The repo shows repeated signs of:
- contract drift,
- workspace-binding ambiguity,
- shallow planning state,
- brittle fallback behavior,
- compressed visibility,
- low loop budgets,
- dead-or-underwired capabilities,
- and several places where the system already anticipates failure because failure is normal enough to shape the architecture.

### 3. Are the user's suspicions mostly real?
Mostly yes, with nuance:
- some capabilities **do** exist,
- but many are **under-integrated**, **mis-presented**, or **bounded more tightly than the user expects**.

### 4. Is Caveman already disabled?
At runtime activation level: yes, the engine filters it out.  
At total system/catalog level: not fully verified from the fetched files.

### 5. Is internet access possible?
At the low-level runtime layer: yes, partly.  
At the actual agent behavior layer: not in a fully coherent or user-trustworthy way.

### 6. Is the model “sleeping” / stalling issue plausible from the code?
Yes. There are believable architecture-level reasons for that complaint.

## Method used for this audit

The audit is based on inspection of these key files and documents:

- `README.md`
- `docs/architecture.md`
- `docs/safety.md`
- `docs/approvals.md`
- `package.json`
- `packages/core/src/engine.ts`
- `packages/workspace-policy/src/policy.ts`
- `packages/tool-runtime/src/registry.ts`
- `packages/model-adapter/src/client.ts`
- `packages/planner/src/planner.ts`
- `packages/session-store/src/store.ts`
- `apps/api/src/server.ts`
- `apps/web/src/HarnessApp.tsx`
- `apps/web/src/components/ChatMessageRow.tsx`
- `apps/web/src/components/AgentRunSummary.tsx`
- `apps/web/src/components/AgentRunSteps.tsx`
- `tests/unit/core.test.ts`
- `tests/e2e/api.test.ts`

I treat direct code evidence as **confirmed**, and architectural consequences drawn from those files as **high-confidence inference** when clearly supported.

## Executive diagnosis

The project is not failing because it has no architecture.  
It is failing because it has **a lot** of architecture, but the architecture is not yet converged into one consistent operator truth.

The deepest pattern in the repo is **contract drift**:
- docs say one thing,
- engine prompts say another,
- runtime policy does another,
- UI exposes a compressed version of a fourth thing,
- and tests validate a controlled subset of the behavior rather than the messiest real-world local-model realities.

This produces a very specific user experience:
1. the app looks feature-rich,
2. the user sees proof that tools exist,
3. some simple tasks work,
4. but the moment the user expects Codex-like continuity, the system becomes hesitant, brittle, confusing, or strangely under-explanatory.

The product therefore risks a particularly damaging trust pattern:
- it looks more capable than it feels,
- and when it fails, it fails in ways that resemble indecision or shallow intelligence rather than cleanly declared scope boundaries.

In other words, the current problem is not “missing package count.”  
The problem is **system coherence**.

## Architecture map in plain language

At a high level, the harness currently behaves like this:

1. **Web UI**
   - lets the operator choose direct or agentic mode,
   - optionally attach a browser folder or images,
   - can try to map a browser-picked folder to a real backend workspace,
   - streams NDJSON events from the API,
   - renders summaries, steps, tool cards, and assistant content.

2. **API server**
   - owns the long-lived `CoreEngine`,
   - exposes config, runtime, skills, sessions, approvals, workspace tools, and chat endpoints,
   - multiplexes direct and agentic modes,
   - mediates approval responses.

3. **Core engine**
   - classifies intent,
   - decides whether to short-circuit locally or launch a fuller agent loop,
   - selects tools,
   - chooses native tools vs manual fallback,
   - emits trace, step, metric, and run summary events,
   - persists shallow turn metadata.

4. **Tool runtime**
   - actually reads, writes, deletes, searches, diffs, runs commands, and even supports web search/fetch at low level.

5. **Workspace policy**
   - enforces root confinement and approval rules.

6. **Model adapter**
   - talks to Ollama native chat when available,
   - handles tool calls, thinking, images, lifecycle switching, and some family-specific tuning.

7. **Planner**
   - tracks visible state about what the run is doing.

8. **Session store**
   - persists session metadata and turn records.

That sounds solid on paper.  
The trouble begins because the practical operator experience depends on how these layers agree with one another, and right now they do not fully agree.

## High-confidence problem catalogue

### P-001 — Danger mode is documented as broad access but implemented as workspace-bound only
**Category:** Safety contract drift / workspace access

**What the code shows**
- docs/safety.md says `danger` mode allows reads, writes, deletes, and shell access anywhere.
- packages/workspace-policy/src/policy.ts first denies any target path outside the workspace root before the `danger` branch runs.
- packages/core/src/engine.ts also injects a workspace-context system rule saying all file and command-path targets must stay inside the workspace root, including in danger mode.

**Why this matters**
This is a direct contract mismatch between documentation, operator expectation, and runtime behavior. A user can switch to danger mode expecting broader access and still get denials. That makes the harness feel dishonest or broken rather than merely constrained.

**Likely user-facing manifestations**
- The model says it cannot access files outside the workspace even when the user believes danger mode should allow it.
- Cross-project work, parent-directory inspection, and ad hoc file movement all look broken.
- The user experiences the system as having 'zero workspace understanding' because the selected root becomes a hard prison.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-001 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-002 — Internet tooling exists in the runtime but is not integrated into the agent loop in a usable way
**Category:** Tooling integration / capability drift

**What the code shows**
- packages/tool-runtime/src/registry.ts implements `webSearch` and `fetchUrl` with HTTP fetch plus DuckDuckGo HTML parsing.
- packages/core/src/engine.ts includes `webSearch` and `fetchUrl` in `SUPPORTED_TOOLS` and in argument summarization.
- The same engine file's `executeToolCall()` switch does not include cases for `webSearch` or `fetchUrl`.
- The tool-selection heuristics in `selectToolNames()` never choose web tools.
- The frontend config type in apps/web/src/HarnessApp.tsx does not expose an `internetAccessEnabled` field even though the backend public config includes it.

**Why this matters**
The codebase advertises internet capability, and the runtime package really does implement it, but the agent path does not actually route work into those tools. That means the feature exists mostly as dead weight from the user perspective.

**Likely user-facing manifestations**
- The user asks whether internet can be provided to the model. The technical answer is 'partly yes at runtime, but not coherently in the current harness behavior.'
- A future operator may think web access is enabled because the backend default is on, yet the agent still never uses it.
- Debugging this becomes painful because the missing behavior is not in the low-level tool implementation; it is in orchestration and tool selection.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-002 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-003 — Direct mode is general-purpose chat, but its non-stream and stream paths are inconsistent
**Category:** Mode architecture / API inconsistency

**What the code shows**
- apps/api/src/server.ts `/api/chat` with `agentic: false` instantiates a fresh `ModelAdapter` and calls the model directly.
- The same file's `/api/chat/stream` with `agentic: false` uses `engine.directChatStream()` instead.
- The direct path intentionally bypasses workspace tools and agentic orchestration, making it conversational rather than coding-centric.

**Why this matters**
The user's question about whether direct mode is a general-purpose channel can be answered yes, but the implementation splits into two different code paths. That can create subtle behavioral differences in thinking handling, status events, session bookkeeping, and future feature parity.

**Likely user-facing manifestations**
- A direct reply can behave differently depending on whether the UI used streaming or non-streaming.
- Fixes added to one direct path can silently miss the other.
- The harness risks looking flaky because identical user intent can go through different runtime code.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-003 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-004 — The planner is mostly a status tracker, not a deep planning memory system
**Category:** Planning / statefulness

**What the code shows**
- packages/planner/src/planner.ts stores taskSummary, phase, active skills, intended action, blockers, run steps, and a summary.
- It does not implement durable task decomposition, subgoal dependency management, rollback state, or long-horizon working memory.
- packages/session-store/src/store.ts persists shallow turn metadata and session metadata, not a rich task graph.

**Why this matters**
The user expects Codex-like layer-by-layer iterative work. This harness has a planner component, but it is lightweight and largely presentational. That does not mean the project is hopeless, but it does mean the current planning substrate is far thinner than the user expects.

**Likely user-facing manifestations**
- The model appears to 'forget what it just did' after a few steps.
- Long tasks feel like disconnected turns rather than one coherent execution.
- The UI can show phases and steps without the agent truly maintaining strong internal progress state.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-004 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-005 — Agentic mode has many early shortcut exits that bypass the richer execution loop
**Category:** Agent orchestration / behavior drift

**What the code shows**
- packages/core/src/engine.ts contains shortcut responders: `tryAnswerFromLocalState`, `tryAnswerFromDirectWorkspaceTools`, `tryAnswerFromLocalRepoOverview`, and `tryAnswerFromRootManifest`.
- These can produce immediate responses before the model/tool loop fully engages.
- The tests explicitly validate several of these shortcut behaviors.

**Why this matters**
Shortcuts improve latency for simple cases, but they also make the agent feel inconsistent. Sometimes it behaves like an autonomous coding harness; other times it behaves like a smart shortcut router. The user then experiences the system as unpredictable rather than dependable.

**Likely user-facing manifestations**
- Some requests get a terse answer without visible exploration.
- The harness may look smart on trivial workspace questions and weak on real work.
- The user can interpret shortcut answers as failure to truly inspect the repo.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-005 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-006 — The agent loop is bounded by low loop caps that can choke iterative work
**Category:** Execution budget / task completion

**What the code shows**
- packages/core/src/engine.ts sets MAX_LOOPS to 5 for edit_code, 4 for run_command, and 3 for everything else.
- The same loop budget is consumed by retries, tool corrections, and fallback transitions.

**Why this matters**
A small local model often needs extra corrective turns to inspect, patch, verify, and revise. A low cap can force the harness to stop in the middle of useful work. That matches the user's description of an agent that starts but does not complete tasks.

**Likely user-facing manifestations**
- The harness reaches 'Maximum tool execution loops reached or no response from model.'
- Fallback logic burns the same budget that real work needs.
- Complex coding tasks degrade into partial inspections and unfinished edits.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-006 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-007 — The manual fallback path is structurally brittle and easy for a small model to derail
**Category:** Fallback design / small-model ergonomics

**What the code shows**
- packages/core/src/engine.ts uses a manual JSON tool protocol when native tools are unavailable or flaky.
- The model must return exactly one JSON object for either a tool action or a final answer.
- The engine contains repeated correction nudges and simulation-detection logic because the model often fails that strict protocol.

**Why this matters**
This fallback exists for practical reasons, but it asks a lot from a small model under pressure. The more brittle the protocol, the more often the harness spends time correcting formatting instead of doing work.

**Likely user-facing manifestations**
- The model asks for more information or emits planning language instead of a precise tool action.
- The harness reports that no tools were executed because the model simulated tool text.
- Operator trust collapses because the system looks stuck in meta-protocol rather than coding.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-007 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-008 — The system detects simulated tool usage but still relies on the model to stop simulating
**Category:** Robustness / failure handling

**What the code shows**
- packages/core/src/engine.ts has `looksLikeSimulatedToolCall()` and correction prompts for both native and manual modes.
- After repeated failures it returns a generic warning that no tools were executed and suggests retrying or switching models.

**Why this matters**
Detection is better than silent lying, but it is still a weak recovery strategy. The harness identifies the failure mode yet often cannot escape it autonomously. That contributes to the user's sense that the shell is alive but the brain is gone.

**Likely user-facing manifestations**
- The UI shows reasoning-like or tool-like blobs with little concrete progress.
- The task halts at protocol enforcement rather than moving to a deterministic alternative.
- The final user-facing explanation becomes a defensive warning, not useful work.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-008 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-009 — Browser folder context and backend workspace binding are conceptually split, which easily confuses the user
**Category:** Workspace model / UX architecture

**What the code shows**
- apps/web/src/HarnessApp.tsx explicitly builds a browser context message that says the picked folder does not change the backend workspace path for tools or commands.
- The same file contains separate logic for resolving the picked folder into a real workspace path via `/api/workspace/resolve`.
- If resolution fails, the system falls back to browser-only read context.

**Why this matters**
This is an honest design, but it is easy to misunderstand. The user sees a folder in the UI and assumes the agent now has real file access. In reality, the harness may only have a read-only snapshot plus a different backend root. That is one of the strongest explanations for the user's complaints about file access and workspace confusion.

**Likely user-facing manifestations**
- The user opens a folder and assumes edits should work, but the agent says writes or commands are unavailable.
- The UI looks bound while the backend remains somewhere else.
- The same request behaves differently depending on whether the folder successfully mapped to a host path.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-009 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-010 — Workspace resolution is heuristic and can fail silently into snapshot-only behavior
**Category:** Workspace binding / environment discovery

**What the code shows**
- apps/api/src/server.ts resolves a browser-picked folder by label and a sampled set of verification files across candidate roots.
- The search depth and candidate limits are finite, and if matching fails the UI keeps a browser-only fallback.

**Why this matters**
Heuristics are fine for convenience, but they make the system fragile when directory names repeat, when file samples are sparse, or when the target project lies outside expected search roots. The user then experiences the harness as unaware of the workspace or unable to jump between files.

**Likely user-facing manifestations**
- The explorer shows the project tree while tool actions still target another location.
- Users get snapshot-only analysis unexpectedly.
- Workspace rebinding can look random.

**Confidence:** confirmed from code with inferred operational impact

**Deeper commentary**

The significance of P-010 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-011 — Changing workspace root resets important runtime state and can make memory feel broken
**Category:** Session continuity / workspace switching

**What the code shows**
- packages/core/src/engine.ts `updateConfig()` nulls `currentSession` when workspace changes and resets planner state.
- Session storage path is resolved relative to the workspace root by default.
- apps/api/src/server.ts uses the engine config update path for workspace resolution.

**Why this matters**
A workspace switch is not just a directory change; it changes the session store location, current session object, planner state, and indexing context. That makes continuity across workspaces weak by design.

**Likely user-facing manifestations**
- The user feels the model does not remember what it did when the workspace changes.
- Previously visible state disappears after rebinding.
- The system can feel like two disconnected apps: one before workspace bind and one after.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-011 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-012 — Skills loading is tied to the current workspace root in a way that can silently empty the skill catalog
**Category:** Skill system / workspace coupling

**What the code shows**
- apps/api/src/server.ts sets `SKILLS_PATH` to `${WORKSPACE_ROOT}/packages/skills/dist/curated_pack.json`.
- If that file cannot be read, `loadSkills()` returns an empty array without surfacing an error.

**Why this matters**
When the workspace root is switched from the harness repo to a target project, the skills artifact may no longer exist at that path. The UI can then lose visible skills even though the harness architecture assumes a skill system exists.

**Likely user-facing manifestations**
- The skills panel suddenly shows nothing after rebinding.
- Operators think the skill system is unreliable or broken.
- Runtime capability and UI expectations drift apart.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-012 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-013 — Caveman is already disabled in the engine, but not necessarily removed from every surface
**Category:** Skill hygiene / partial deactivation

**What the code shows**
- packages/core/src/engine.ts declares `DISABLED_SKILL_SLUGS = new Set(['caveman'])` and filters active skills through it.
- I did not verify the generated curated skill pack contents, so I cannot confirm the slug is absent from every catalog or artifact.

**Why this matters**
This matters because the user's requested removal is partly already done at runtime. The remaining question is whether the disabled skill still leaks into UI catalogs or build artifacts. So the issue is not total absence of mitigation; it is incomplete certainty about complete removal.

**Likely user-facing manifestations**
- The engine refuses to activate caveman even if selected.
- A UI list could still show caveman if the catalog still contains it.
- Operators may interpret visibility as functionality even when runtime filters it.

**Confidence:** partly confirmed, partly unresolved

**Deeper commentary**

The significance of P-013 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-014 — The tool-selection heuristics are regex-driven and therefore narrow and brittle
**Category:** Intent and tool routing

**What the code shows**
- packages/core/src/engine.ts decides whether a request is a workspace question and which tools to include using regex rules on the latest user message.
- Quick inspect mode only treats a prompt as workspace-related if certain repo-like keywords appear.

**Why this matters**
Regex gating is simple and fast, but it misses many naturally phrased coding requests. A user can ask for a real task in everyday language and accidentally fall outside the tool-enabled path.

**Likely user-facing manifestations**
- The model asks for clarification or stays conversational instead of inspecting files.
- Tool availability depends on wording quirks rather than task substance.
- The harness feels more capable when the operator learns how to phrase commands than when the system truly understands intent.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-014 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-015 — Automatic repo-context injection is disabled by default, weakening workspace understanding on harder tasks
**Category:** Context assembly / repo comprehension

**What the code shows**
- packages/core/src/engine.ts only enables automatic repo context when `HARNESS_AUTO_REPO_CONTEXT === '1'`.
- Otherwise the system relies on workspace context, local inventory, and bootstrap steps rather than broad prompt injection.

**Why this matters**
This choice reduces latency and context bloat, but it also starves the model of structural context on larger tasks. That may be acceptable for simple inspections and poor for deeper coding work.

**Likely user-facing manifestations**
- The model has patchy understanding of the repo layout.
- It can answer simple path questions but struggle to carry architectural context through multi-step edits.
- The user sees a big-context model but weak effective context use.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-015 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-016 — The stream idle timeout appears configured but not actually enforced in the visible streaming path
**Category:** Stall handling / watchdog weakness

**What the code shows**
- packages/core/src/engine.ts defines `streamIdleTimeoutMs` in config and declares an idle-timeout error type helper.
- In the fetched `streamAssistantMessage()` implementation, the stream read loop does not visibly enforce an idle timer.
- apps/api/src/server.ts sets very long server timeouts of roughly one hour.

**Why this matters**
This directly matches the user's 'brain is gone but shell remains' complaint. The code exposes an idle-timeout concept, but the streamed chat path I inspected does not visibly use it to break dead sessions.

**Likely user-facing manifestations**
- RAM can drop while HTTP stays alive.
- The UI remains in an active-looking state without meaningful progress.
- Long hangs persist instead of failing fast.

**Confidence:** strong inference from inspected code

**Deeper commentary**

The significance of P-016 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-017 — Model lifecycle policy encourages unloading after short inactivity, which can look like the model 'fell asleep'
**Category:** Model runtime / lifecycle behavior

**What the code shows**
- packages/model-adapter/src/client.ts preloads the target model with `keep_alive: '2m'`.
- It also unloads other running models during activation.

**Why this matters**
This is not necessarily wrong, especially on a 16 GB machine, but it can create the exact visual symptom the user described: RAM drops after inactivity and the operator interprets that as the model going out of commission.

**Likely user-facing manifestations**
- The active model disappears from RAM after a short period.
- The next request incurs a cold start or feels stalled.
- Operators interpret normal lifecycle behavior as a crash.

**Confidence:** confirmed from code with inferred user-facing impact

**Deeper commentary**

The significance of P-017 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-018 — RunCommand is intentionally safe and narrow, which can be mistaken for broken shell access
**Category:** Command execution / expectation mismatch

**What the code shows**
- packages/tool-runtime/src/registry.ts rejects shell operators, redirection, command substitution, and multi-command syntax.
- It only supports a single executable with arguments and blocks path escapes outside the workspace.
- In workspace-write mode, execution also requires approval.

**Why this matters**
The shell is not missing, but it is tightly bounded. For coding workflows that often rely on shell chains or redirected output, the experience can feel crippled.

**Likely user-facing manifestations**
- The user thinks command execution is not working.
- Simple test or build commands work better than complex one-liners.
- The harness feels less agentic than Codex because its command surface is intentionally narrower.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-018 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-019 — The UI promises visibility, but the visible information is often compressed into counts and summaries rather than concrete change logs
**Category:** Observability / operator visibility

**What the code shows**
- apps/web/src/components/AgentRunSummary.tsx shows counts for files read, directories listed, searches, commands, and aggregate changed-file statistics.
- The summary card does not itself show a per-file change ledger or exact line ranges.
- The activity tab in apps/web/src/HarnessApp.tsx shows trace timestamps and types, not rich trace payload detail.

**Why this matters**
The user wants to know exactly what file changed and what lines were added or removed. The raw data partly exists in previews, diffs, and run metadata, but the UI's top-level presentation still compresses much of it into summaries.

**Likely user-facing manifestations**
- The user can tell work happened but not fully reconstruct it.
- A large tool card block may appear without a satisfying clear end-of-task explanation.
- The system feels verbose in the wrong places and under-informative in the places that matter.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-019 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-020 — The chat renderer contains an honesty fallback because the model often fails to return a real final narrative answer
**Category:** UI fallback / incomplete completion

**What the code shows**
- apps/web/src/components/ChatMessageRow.tsx has `buildHonestFallback()` which uses the run summary when the assistant content is not renderable.
- If there were only tool events and no final narrative, it emits: 'Inspected tool activity only. Completed X tool steps, but model did not return final narrative answer.'

**Why this matters**
This is one of the strongest code-level confirmations of the user's complaint. The UI authors already knew the agent sometimes does tool work but fails to produce a satisfying explanatory finish, so they built an honesty fallback around that failure mode.

**Likely user-facing manifestations**
- Users see tool blocks and summaries but weak or missing prose conclusions.
- The app feels unfinished because the renderer has to paper over non-completion.
- Trust drops because the user has to infer what the agent actually achieved.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-020 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-021 — Reasoning blocks can visually dominate the response and make the useful outcome feel too small
**Category:** UI presentation / cognitive load

**What the code shows**
- apps/web/src/components/ChatMessageRow.tsx splits assistant content into `<think>` and non-think segments.
- Thought blocks are rendered in a details panel titled 'Reasoning Process'.
- When streaming, those details are open; short thought blocks also open automatically.

**Why this matters**
The user complained about a huge block and a small amount of useful content. The renderer behavior supports that complaint. Even when the system is technically honest, the presentation can make reasoning or operational scaffolding overshadow the final answer.

**Likely user-facing manifestations**
- The eye lands on reasoning rather than result.
- Users feel the model is talking about work more than doing work.
- The end-state explanation looks smaller and less authoritative than the surrounding machinery.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-021 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-022 — The API and docs claim an approvals queue button in the header, but the current UI surface differs
**Category:** Documentation drift / UX drift

**What the code shows**
- docs/approvals.md says pending approvals appear in an Approvals Queue button in the header.
- apps/web/src/HarnessApp.tsx instead renders approvals inline above the composer and in Settings > Activity; there is no obvious dedicated header queue button.

**Why this matters**
This is a smaller mismatch than the danger-mode issue, but it reinforces the same pattern: documentation and actual UX are drifting apart. That makes diagnosis harder because the user may be following the docs and not the running product.

**Likely user-facing manifestations**
- An operator looks for a queue button that is no longer there.
- Approval flow feels hidden or inconsistent compared with docs.
- Support instructions age badly.

**Confidence:** confirmed from code and docs

**Deeper commentary**

The significance of P-022 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-023 — The test suite is extensive for mocked happy paths but weak against real local-model failure modes
**Category:** Quality assurance / realism gap

**What the code shows**
- tests/unit/core.test.ts and tests/e2e/api.test.ts heavily mock model responses and native chat behavior.
- The tests validate many intended behaviors, but they do not reproduce true small-model hesitation, RAM pressure, degraded throughput, or corrupted long-lived streams.

**Why this matters**
This matters because the repo can look well-tested while still failing in the exact scenarios the user cares about: real Gemma behavior on CPU, long coding sessions, format drift, and stalls.

**Likely user-facing manifestations**
- The codebase feels more stable in CI than in practice.
- Developers can be surprised by issues the tests never exercised.
- The user experiences live problems despite a healthy-looking test surface.

**Confidence:** confirmed with reasonable inference

**Deeper commentary**

The significance of P-023 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-024 — The tests encode optimistic expectations that can mask operator pain
**Category:** Test design / success framing

**What the code shows**
- tests/unit/core.test.ts uses `assertAgenticResponse()` to require that agentic responses include `What I did:` and `Files changed:`.
- The mocked responses often resolve neatly into compliant final answers after limited steps.

**Why this matters**
Tests like this prove formatting and basic orchestration, but they do not guarantee the user experiences the system as effective. A response can technically include those sections and still feel empty, partial, or unconvincing.

**Likely user-facing manifestations**
- Engine changes that preserve boilerplate may still ship even when practical usefulness regresses.
- The app can satisfy test expectations while disappointing the operator.
- The product over-indexes on formal completion markers.

**Confidence:** confirmed from tests

**Deeper commentary**

The significance of P-024 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-025 — The repository contains strong support for native Ollama chat, but the overall architecture still assumes fragile capability detection
**Category:** Model integration / native-tools reliability

**What the code shows**
- packages/model-adapter/src/client.ts prefers native Ollama `/api/chat` and preserves tool calls, thinking, and images.
- Capability detection still relies on `/api/show` and fallback heuristics for Gemma and Qwen families.
- The engine has to decide between native, manual_preferred, and manual_fallback modes.

**Why this matters**
This is better than a pure OpenAI-compat integration, but it still leaves room for capability drift between what Ollama really handles and what the harness believes it can handle. The result is more mode switching and complexity than the user expects.

**Likely user-facing manifestations**
- The harness can behave differently across models with similar seeming capability.
- One model family may stay on native tools while another falls into manual JSON fallback.
- Operators see inconsistency that looks like intelligence failure rather than adapter complexity.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-025 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-026 — The engine advertises workspace safety and visibility, but the actual source of truth changes depending on context
**Category:** Architecture coherence / source-of-truth drift

**What the code shows**
- docs/architecture.md says the sidebar and CLI must reflect the same backend workspace root the tools use, and browser-only folder attachments are secondary context.
- The web app still prominently supports browser-selected trees that may not be backend-bound.
- The run summary differentiates `workspaceSource: backend` vs `browser_snapshot`.

**Why this matters**
The architecture knows this distinction matters, yet the UI still needs to carry both worlds. That duality is probably necessary, but it is also a major source of user confusion and perceived unreliability.

**Likely user-facing manifestations**
- The user assumes the visible tree is the writable truth.
- The agent reports snapshot-only behavior that feels like a bug.
- The same repo may appear in the sidebar while the backend is elsewhere.

**Confidence:** confirmed from docs and code

**Deeper commentary**

The significance of P-026 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-027 — The system is built for local-first CPU use, but several pieces still prioritize scaffolding and guardrails over raw task throughput
**Category:** Performance / product tradeoff

**What the code shows**
- The engine layers intent classification, prompt recipes, optional repo context, bootstrap plans, run builders, planner state, approval workflow, trace bus, and UI event streaming around each task.
- On a CPU-only small-model setup, every extra orchestration round trip matters.

**Why this matters**
This is not a bug in isolation. It is a structural tradeoff. But when the user compares the harness to a polished remote agent like Codex, the local orchestration overhead becomes part of the perceived bottleneck.

**Likely user-facing manifestations**
- The harness feels slow before and between meaningful actions.
- Small models spend too much budget on harness protocol instead of task reasoning.
- Operators blame the model even when orchestration weight is part of the delay.

**Confidence:** inference strongly grounded in architecture

**Deeper commentary**

The significance of P-027 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-028 — The repo indexer strategy is intentionally lightweight and therefore may under-serve harder repository understanding tasks
**Category:** Repository context / scale limits

**What the code shows**
- README.md explicitly says the harness is not a RAG system and uses lightweight file indexing rather than vector databases.
- The repo-indexer is described as a lightweight project context scanner.
- Auto repo context is off by default unless an environment variable enables it.

**Why this matters**
Lightweight indexing is consistent with the local-first goal, but it also means deep semantic retrieval and cross-file recall are not especially strong out of the box. That limits how well a large-context model can actually use its context window in practice.

**Likely user-facing manifestations**
- The model sees some top-level structure but misses critical internal relationships.
- Cross-file reasoning can stall unless the tool loop explicitly reads the right files.
- The user sees a large theoretical context window but modest practical repository recall.

**Confidence:** confirmed with inference

**Deeper commentary**

The significance of P-028 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-029 — The frontend config model is already drifting from backend config fields
**Category:** Frontend-backend contract drift

**What the code shows**
- packages/core/src/engine.ts public config includes `internetAccessEnabled` and `streamIdleTimeoutMs`.
- apps/web/src/HarnessApp.tsx `ConfigState` only includes baseUrl, model, profile, mode, workspaceRoot, and sessionDataDir.

**Why this matters**
This is an early sign of maintainability trouble. Once frontend types stop matching backend reality, new runtime controls become hidden or silently ignored.

**Likely user-facing manifestations**
- Internet control and timeout control are invisible in the main settings UI.
- Operators cannot trust that the configuration panel exposes the real runtime contract.
- Backend changes can ship without meaningful operator affordances.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-029 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-030 — The harness already anticipates planning-only and simulation failures, which means those failures are normal enough to shape the architecture
**Category:** Failure pattern normalization

**What the code shows**
- packages/core/src/engine.ts contains native-tool retry nudges, manual-tool correction prompts, and simulated-tool-call detection.
- The UI contains a fallback narrative path when a final assistant answer is missing.

**Why this matters**
This is not just defensive coding. It is evidence that incomplete execution and noncompliant model behavior are expected steady-state hazards in the current design.

**Likely user-facing manifestations**
- The user routinely sees partial or awkward outputs.
- A meaningful portion of the architecture is devoted to correction and recovery rather than direct work.
- The product carries visible scars of model unreliability.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-030 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-031 — Direct mode does look intentionally general-purpose, but it is not intended to be a coding agent
**Category:** Mode scope clarity

**What the code shows**
- README.md distinguishes direct chat and agentic coding modes.
- apps/api/src/server.ts direct mode simply calls the model adapter without tools.
- apps/web/src/HarnessApp.tsx lets the user toggle Agentic vs Direct and only exposes coding-oriented chat presets while agentic mode is on.

**Why this matters**
This directly answers the user's first question. Direct mode is meant to be everyday chat. The problem is not that it failed to be general-purpose; the problem is that agentic mode carries the coding burden and currently under-delivers on that burden.

**Likely user-facing manifestations**
- Direct mode feels okay for ordinary questions.
- Agentic mode feels disproportionately disappointing because it is where the hard promises live.
- Users may compare the two and conclude the model itself is fine while the harness around it is failing.

**Confidence:** confirmed from code and docs

**Deeper commentary**

The significance of P-031 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-032 — The model adapter tunes Gemma and other families, but effective context use still depends on orchestration quality rather than nominal context length
**Category:** Context-window efficiency

**What the code shows**
- packages/model-adapter/src/client.ts adjusts parameters for Gemma, DeepSeek, and Qwen families.
- The engine still feeds the model through selective workspace context, bootstrap steps, manual fallback protocol, and loop caps.

**Why this matters**
The user's complaint about poor use of Gemma's context window is well founded at a systems level. A big context window does not help if the harness under-selects context, exits early, or burns turns on protocol friction.

**Likely user-facing manifestations**
- The model can have 128k theoretical context yet still act myopic.
- Complex tasks do not accumulate context layer by layer the way Codex does.
- The user sees local-model limitations amplified by harness design.

**Confidence:** grounded inference

**Deeper commentary**

The significance of P-032 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-033 — The current UI does surface run steps and tool cards, but the information density and structure may still feel wrong to a human operator
**Category:** Operator UX / information design

**What the code shows**
- apps/web/src/components/AgentRunSteps.tsx concatenates title, tool input summary, command, and detail into a single line per step.
- apps/web/src/components/AgentRunSummary.tsx summarizes activity in compact cards.
- apps/web/src/components/ChatMessageRow.tsx stacks run overview, run steps, tool cards, attachments, and final body.

**Why this matters**
Visibility is not binary. The UI can technically display activity and still communicate poorly. The user is reacting to the quality of visibility, not just its existence.

**Likely user-facing manifestations**
- The app shows many blocks, but the important story is still hard to read.
- Run steps can look like noise rather than a clean execution narrative.
- The final answer loses prominence.

**Confidence:** confirmed from code with human-UX inference

**Deeper commentary**

The significance of P-033 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-034 — The activity tab exposes only trace headers, not the rich trace payloads needed for real diagnosis
**Category:** Diagnostics / observability depth

**What the code shows**
- apps/web/src/HarnessApp.tsx Activity tab renders each trace row with only a timestamp and trace type label.
- It does not show the associated data payload by default.

**Why this matters**
For a project like this, trace headers are often not enough. The user wants to inspect what tool was called, what path was targeted, why a fallback was triggered, and what the system believed. The raw trace bus contains more information than the default activity view exposes.

**Likely user-facing manifestations**
- The UI can confirm that something happened without explaining it.
- Debugging still requires code inspection or API poking.
- The user perceives the observability story as weak even though the backend emits plenty of events.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-034 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-035 — The tool registry is stronger than the agent's effective ability to exploit it
**Category:** Capability-vs-behavior gap

**What the code shows**
- packages/tool-runtime/src/registry.ts implements a fairly rich set of file, git, shell, and web tools.
- The user's complaints are mostly about the model not exploiting these tools well.
- packages/core/src/engine.ts is where routing, fallback, heuristics, and loop limits determine whether those tools become useful.

**Why this matters**
This is a core diagnosis. The low-level tool layer is not the whole problem. The orchestration layer and the user-facing behavior are where most of the pain shows up.

**Likely user-facing manifestations**
- The harness has features on paper that do not translate into satisfying outcomes.
- Users think tools are bad when the worse problem is how they are selected, sequenced, and explained.
- The project looks more complete in a package diagram than in real use.

**Confidence:** confirmed with architectural interpretation

**Deeper commentary**

The significance of P-035 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

### P-036 — The product already contains explicit logic for snapshot-only refusal, which means some user requests are intentionally non-executable until binding succeeds
**Category:** Scope control / execution refusal

**What the code shows**
- packages/core/src/engine.ts returns a binding warning when the intent is `workspace_binding_needed`.
- It says snapshot-only analysis can inspect and suggest edits, but real file writes and commands require backend binding.

**Why this matters**
This is honest behavior, but if the user does not internalize the difference between snapshot and bound workspace, it feels like the agent simply refuses to work.

**Likely user-facing manifestations**
- The model gives a binding explanation instead of performing the requested coding task.
- The user experiences that as over-cautiousness or incompetence.
- The harness feels bureaucratic.

**Confidence:** confirmed from code

**Deeper commentary**

The significance of P-036 is not limited to its local code fragment. It affects the whole trust model of the harness.
When a system like this is sold to the operator as a local coding agent, the operator does not mentally separate policy logic,
orchestration logic, UI rendering, and documentation language. The operator only sees one thing: whether the assistant behaves like a
coherent working partner. Problems like this one fracture that coherence.

In a polished cloud coding agent, many of these disagreements are hidden because the product surface is more centralized. Here,
the repo itself exposes the fracture lines. That is useful for diagnosis, but harsh for the operator. The user can feel the seams.

This problem also interacts with several other problems rather than standing alone. For example, a contract mismatch around workspace
boundaries makes tool output look less believable. Weak tool visibility then makes the same mismatch harder to understand. A shallow
planning substrate makes recovery from that mismatch weaker. The result is multiplicative pain rather than additive pain.

So even if this issue looked small in isolation, it would still matter because it participates in a chain:
documentation expectation -> UI expectation -> action attempt -> refusal or weak execution -> explanation quality -> trust erosion.
In this codebase, many of the largest complaints follow that chain.

## File-by-file dossier of the most important inspected files

### File dossier: `README.md`
The README positions the project as a local-first, offline-capable coding harness optimized for Gemma 4 E4B on CPU hardware. It promises tool execution, visibility, safety boundaries, approvals, curated skills, and lightweight indexing rather than heavyweight RAG. That framing matters because many of the user's frustrations arise not from absence of ambition but from the gap between these promises and the lived operator experience. The README also normalizes a two-mode worldview: direct chat for ordinary use and agentic coding for real repository work. In that sense, the user's lived distinction between a decent direct mode and a weak agentic mode is already embedded in the product concept.


The reason `README.md` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `README.md` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The README positions the project as a local-first, offline-capable coding harness optimized for Gemma 4 E4B on CPU hardware. It promises tool execution, visibility, safety boundaries, approvals, curated skills, and lightweight indexing rather than heavyweight RAG. That framing matters because many of the user's frustrations arise not from absence of ambition but from the gap between these promises and the lived operator experience. The README also normalizes a two-mode worldview: direct chat for ordinary use and agentic coding for real repository work. In that sense, the user's lived distinction between a decent direct mode and a weak agentic mode is already embedded in the product concept.


The reason `README.md` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `README.md` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The README positions the project as a local-first, offline-capable coding harness optimized for Gemma 4 E4B on CPU hardware. It promises tool execution, visibility, safety boundaries, approvals, curated skills, and lightweight indexing rather than heavyweight RAG. That framing matters because many of the user's frustrations arise not from absence of ambition but from the gap between these promises and the lived operator experience. The README also normalizes a two-mode worldview: direct chat for ordinary use and agentic coding for real repository work. In that sense, the user's lived distinction between a decent direct mode and a weak agentic mode is already embedded in the product concept.


The reason `README.md` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `README.md` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `docs/architecture.md`
The architecture document is unusually explicit about operational visibility. It says the UI should expose current plan, active phase, tool names, tool input summaries, tool output summaries, diffs, concise rationale, and model-emitted thinking only when the provider truly emits it. It also states that browser-only folder attachments are secondary context and that the sidebar and CLI should reflect the same backend workspace root the tools use. This is important because it gives a strong standard against which the current behavior can be judged. The user's dissatisfaction is not arbitrary; it maps directly onto architecture promises that the codebase itself made.


The reason `docs/architecture.md` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `docs/architecture.md` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The architecture document is unusually explicit about operational visibility. It says the UI should expose current plan, active phase, tool names, tool input summaries, tool output summaries, diffs, concise rationale, and model-emitted thinking only when the provider truly emits it. It also states that browser-only folder attachments are secondary context and that the sidebar and CLI should reflect the same backend workspace root the tools use. This is important because it gives a strong standard against which the current behavior can be judged. The user's dissatisfaction is not arbitrary; it maps directly onto architecture promises that the codebase itself made.


The reason `docs/architecture.md` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `docs/architecture.md` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The architecture document is unusually explicit about operational visibility. It says the UI should expose current plan, active phase, tool names, tool input summaries, tool output summaries, diffs, concise rationale, and model-emitted thinking only when the provider truly emits it. It also states that browser-only folder attachments are secondary context and that the sidebar and CLI should reflect the same backend workspace root the tools use. This is important because it gives a strong standard against which the current behavior can be judged. The user's dissatisfaction is not arbitrary; it maps directly onto architecture promises that the codebase itself made.


The reason `docs/architecture.md` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `docs/architecture.md` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `packages/core/src/engine.ts`
The core engine is the real center of gravity of the harness. It owns configuration, model adapter wiring, workspace policy, session persistence, the trace bus, approvals, planner integration, repo indexing, tool execution, bootstrap planning, native-tool versus manual-tool protocol decisions, streaming assembly, run summaries, and task finalization. It is also where the most important contradictions live. The file contains strong scaffolding for a serious agent, but it also contains many heuristics, short-circuits, loop caps, and fallback behaviors that make the system feel less decisive in practice than the architecture suggests.


The reason `packages/core/src/engine.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/core/src/engine.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The core engine is the real center of gravity of the harness. It owns configuration, model adapter wiring, workspace policy, session persistence, the trace bus, approvals, planner integration, repo indexing, tool execution, bootstrap planning, native-tool versus manual-tool protocol decisions, streaming assembly, run summaries, and task finalization. It is also where the most important contradictions live. The file contains strong scaffolding for a serious agent, but it also contains many heuristics, short-circuits, loop caps, and fallback behaviors that make the system feel less decisive in practice than the architecture suggests.


The reason `packages/core/src/engine.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/core/src/engine.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The core engine is the real center of gravity of the harness. It owns configuration, model adapter wiring, workspace policy, session persistence, the trace bus, approvals, planner integration, repo indexing, tool execution, bootstrap planning, native-tool versus manual-tool protocol decisions, streaming assembly, run summaries, and task finalization. It is also where the most important contradictions live. The file contains strong scaffolding for a serious agent, but it also contains many heuristics, short-circuits, loop caps, and fallback behaviors that make the system feel less decisive in practice than the architecture suggests.


The reason `packages/core/src/engine.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/core/src/engine.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `packages/tool-runtime/src/registry.ts`
The tool runtime is one of the strongest technical layers in the project. It implements bounded file reads and writes, directory listing, globbing, text search, diff previews, approval-aware writes, git status and diff, command execution with conservative shell restrictions, and even web search and URL fetching. The low-level layer is not empty. The bigger issue is that the orchestration layer above it does not consistently let the model exploit this tool surface smoothly or transparently.


The reason `packages/tool-runtime/src/registry.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/tool-runtime/src/registry.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The tool runtime is one of the strongest technical layers in the project. It implements bounded file reads and writes, directory listing, globbing, text search, diff previews, approval-aware writes, git status and diff, command execution with conservative shell restrictions, and even web search and URL fetching. The low-level layer is not empty. The bigger issue is that the orchestration layer above it does not consistently let the model exploit this tool surface smoothly or transparently.


The reason `packages/tool-runtime/src/registry.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/tool-runtime/src/registry.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The tool runtime is one of the strongest technical layers in the project. It implements bounded file reads and writes, directory listing, globbing, text search, diff previews, approval-aware writes, git status and diff, command execution with conservative shell restrictions, and even web search and URL fetching. The low-level layer is not empty. The bigger issue is that the orchestration layer above it does not consistently let the model exploit this tool surface smoothly or transparently.


The reason `packages/tool-runtime/src/registry.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/tool-runtime/src/registry.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `packages/model-adapter/src/client.ts`
The model adapter reflects substantial effort to treat local Ollama-native chat seriously rather than relying blindly on an OpenAI-compatible shim. It preserves thinking, tool calls, image support, and model family–specific parameter tuning. It also includes model activation and unloading behavior. But the very existence of native-tool detection, fallback heuristics, and special-casing for Gemma and Qwen reveals how hard it is to keep the behavior stable across model families.


The reason `packages/model-adapter/src/client.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/model-adapter/src/client.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The model adapter reflects substantial effort to treat local Ollama-native chat seriously rather than relying blindly on an OpenAI-compatible shim. It preserves thinking, tool calls, image support, and model family–specific parameter tuning. It also includes model activation and unloading behavior. But the very existence of native-tool detection, fallback heuristics, and special-casing for Gemma and Qwen reveals how hard it is to keep the behavior stable across model families.


The reason `packages/model-adapter/src/client.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/model-adapter/src/client.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The model adapter reflects substantial effort to treat local Ollama-native chat seriously rather than relying blindly on an OpenAI-compatible shim. It preserves thinking, tool calls, image support, and model family–specific parameter tuning. It also includes model activation and unloading behavior. But the very existence of native-tool detection, fallback heuristics, and special-casing for Gemma and Qwen reveals how hard it is to keep the behavior stable across model families.


The reason `packages/model-adapter/src/client.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/model-adapter/src/client.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `packages/workspace-policy/src/policy.ts`
The workspace policy is simple enough to audit and therefore especially revealing. Its first rule is that any target outside the workspace root is denied, even before the danger-mode branch. That means the code has already settled the outside-workspace question more aggressively than the docs imply. The file is short, but it produces one of the biggest trust problems in the whole system because it contradicts the published safety matrix.


The reason `packages/workspace-policy/src/policy.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/workspace-policy/src/policy.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The workspace policy is simple enough to audit and therefore especially revealing. Its first rule is that any target outside the workspace root is denied, even before the danger-mode branch. That means the code has already settled the outside-workspace question more aggressively than the docs imply. The file is short, but it produces one of the biggest trust problems in the whole system because it contradicts the published safety matrix.


The reason `packages/workspace-policy/src/policy.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/workspace-policy/src/policy.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The workspace policy is simple enough to audit and therefore especially revealing. Its first rule is that any target outside the workspace root is denied, even before the danger-mode branch. That means the code has already settled the outside-workspace question more aggressively than the docs imply. The file is short, but it produces one of the biggest trust problems in the whole system because it contradicts the published safety matrix.


The reason `packages/workspace-policy/src/policy.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/workspace-policy/src/policy.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `packages/session-store/src/store.ts`
The session store is optimized for persistence convenience, not for deep agent memory. It stores shallow metadata in JSON, appends turns to a JSONL sidecar, and can load or list sessions, but it does not persist a rich cognitive state. This is enough for continuity of basic session identity and turn metadata, yet it is not enough to create the strong sense that a coding agent is carrying a detailed, living working memory across a long task.


The reason `packages/session-store/src/store.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/session-store/src/store.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The session store is optimized for persistence convenience, not for deep agent memory. It stores shallow metadata in JSON, appends turns to a JSONL sidecar, and can load or list sessions, but it does not persist a rich cognitive state. This is enough for continuity of basic session identity and turn metadata, yet it is not enough to create the strong sense that a coding agent is carrying a detailed, living working memory across a long task.


The reason `packages/session-store/src/store.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/session-store/src/store.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The session store is optimized for persistence convenience, not for deep agent memory. It stores shallow metadata in JSON, appends turns to a JSONL sidecar, and can load or list sessions, but it does not persist a rich cognitive state. This is enough for continuity of basic session identity and turn metadata, yet it is not enough to create the strong sense that a coding agent is carrying a detailed, living working memory across a long task.


The reason `packages/session-store/src/store.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `packages/session-store/src/store.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `apps/api/src/server.ts`
The API server is small enough to be understandable and large enough to expose design decisions cleanly. It wires the engine, exposes config, runtime, approvals, workspace endpoints, and both chat modes, and uses NDJSON streams for live events. It also reveals critical inconsistencies, including the split direct-chat implementation and the skill-path coupling to the current workspace root. It is the clearest place where backend truth, UI assumptions, and operator experience intersect.


The reason `apps/api/src/server.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/api/src/server.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The API server is small enough to be understandable and large enough to expose design decisions cleanly. It wires the engine, exposes config, runtime, approvals, workspace endpoints, and both chat modes, and uses NDJSON streams for live events. It also reveals critical inconsistencies, including the split direct-chat implementation and the skill-path coupling to the current workspace root. It is the clearest place where backend truth, UI assumptions, and operator experience intersect.


The reason `apps/api/src/server.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/api/src/server.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The API server is small enough to be understandable and large enough to expose design decisions cleanly. It wires the engine, exposes config, runtime, approvals, workspace endpoints, and both chat modes, and uses NDJSON streams for live events. It also reveals critical inconsistencies, including the split direct-chat implementation and the skill-path coupling to the current workspace root. It is the clearest place where backend truth, UI assumptions, and operator experience intersect.


The reason `apps/api/src/server.ts` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/api/src/server.ts` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `apps/web/src/HarnessApp.tsx`
The web application shows a team actively trying to present the harness honestly. It tracks sessions, approvals, plan state, repo context, traces, direct versus agentic mode, browser-picked folders, workspace binding, image attachments, and streamed tool events. But the same file also encodes the core UX complexity that hurts operator trust: browser snapshot versus backend-bound workspace, hidden heavy-refresh logic, compressed trace presentation, and a rendering model that can swamp the final answer with surrounding execution scaffolding.


The reason `apps/web/src/HarnessApp.tsx` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/web/src/HarnessApp.tsx` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The web application shows a team actively trying to present the harness honestly. It tracks sessions, approvals, plan state, repo context, traces, direct versus agentic mode, browser-picked folders, workspace binding, image attachments, and streamed tool events. But the same file also encodes the core UX complexity that hurts operator trust: browser snapshot versus backend-bound workspace, hidden heavy-refresh logic, compressed trace presentation, and a rendering model that can swamp the final answer with surrounding execution scaffolding.


The reason `apps/web/src/HarnessApp.tsx` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/web/src/HarnessApp.tsx` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The web application shows a team actively trying to present the harness honestly. It tracks sessions, approvals, plan state, repo context, traces, direct versus agentic mode, browser-picked folders, workspace binding, image attachments, and streamed tool events. But the same file also encodes the core UX complexity that hurts operator trust: browser snapshot versus backend-bound workspace, hidden heavy-refresh logic, compressed trace presentation, and a rendering model that can swamp the final answer with surrounding execution scaffolding.


The reason `apps/web/src/HarnessApp.tsx` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/web/src/HarnessApp.tsx` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

### File dossier: `apps/web/src/components/ChatMessageRow.tsx`
The message-row renderer is arguably the best single-file proof that the project already knows where its own pain points are. It explicitly parses `<think>` blocks, renders run summaries and run steps, shows tool-event cards, and contains an honesty fallback for the case where the model never produced a real narrative final answer. The existence of that fallback is not incidental. It is a direct acknowledgment that the agent often completes partial operational work without landing a satisfying explanation.


The reason `apps/web/src/components/ChatMessageRow.tsx` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/web/src/components/ChatMessageRow.tsx` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The message-row renderer is arguably the best single-file proof that the project already knows where its own pain points are. It explicitly parses `<think>` blocks, renders run summaries and run steps, shows tool-event cards, and contains an honesty fallback for the case where the model never produced a real narrative final answer. The existence of that fallback is not incidental. It is a direct acknowledgment that the agent often completes partial operational work without landing a satisfying explanation.


The reason `apps/web/src/components/ChatMessageRow.tsx` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/web/src/components/ChatMessageRow.tsx` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.
The message-row renderer is arguably the best single-file proof that the project already knows where its own pain points are. It explicitly parses `<think>` blocks, renders run summaries and run steps, shows tool-event cards, and contains an honesty fallback for the case where the model never produced a real narrative final answer. The existence of that fallback is not incidental. It is a direct acknowledgment that the agent often completes partial operational work without landing a satisfying explanation.


The reason `apps/web/src/components/ChatMessageRow.tsx` matters is that it does not just implement a small local behavior. It anchors part of the harness's public promise.
In a local agentic product, users judge quality by whether the repo's moving parts reinforce one another. This file contributes to that
reinforcement or to its breakdown.

From an audit perspective, `apps/web/src/components/ChatMessageRow.tsx` also acts as evidence of intent. Even when a file does not directly cause a failure, it tells us
what the project author believed the system should be doing. That matters because the biggest story in this audit is the difference between
intended product identity and experienced product behavior.

Put differently: files like this are not interesting only for their logic. They are interesting because they reveal the product's theory of itself.
Where that theory and the runtime agree, the harness feels trustworthy. Where they diverge, the harness feels weak, hesitant, or confused.

## Evaluation of the user's explicit hypotheses

### User claim A
**Claim:** The AI does not plan from the user's prompt and keeps asking for more information

**Audit judgment:** This is partly true. The engine does have a planning scaffold, but it is shallow and largely presentational. It also uses regex gating and shortcut responders, so some prompts never enter a rich inspect-edit-verify loop. On top of that, manual-tool fallback is brittle and can force the model into a format game rather than a work loop. The result is an agent that can look hesitant, under-planned, or overly clarification-prone even when the repo technically contains planning primitives.


The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

### User claim B
**Claim:** The tools are used badly or the web UI does not display tool usage properly

**Audit judgment:** This is largely true, but it splits into two subproblems. First, the engine does emit statuses, run steps, tool events, metrics, and summaries. Second, the UI presentation compresses important detail and can let reasoning or run scaffolding overshadow the final answer. So the issue is not that tool visibility is absent. The issue is that tool visibility is often insufficiently legible, insufficiently concrete, or not accompanied by a strong final narrative.


The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

### User claim C
**Claim:** The AI may not really have file read/write access across the workspace

**Audit judgment:** This is partly true and strongly context-dependent. Inside a properly bound backend workspace, file tools exist and are real. But the browser-snapshot path is explicitly read-only. Outside the workspace root, access is denied even in danger mode. Writes in workspace-write mode always require approval. Safe command execution is intentionally narrow. So access exists, but it is narrower and more conditional than the user expects.


The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

### User claim D
**Claim:** The model has a huge context window but does not use it efficiently

**Audit judgment:** This is strongly supported at the system level. The nominal model context is not the same as effective task context. Auto repo context is off by default. Tool selection is heuristic. Planning memory is lightweight. Loop budgets are low. Manual fallback burns turns. The harness therefore does not consistently exploit a large context window in a layered Codex-like manner.


The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

### User claim E
**Claim:** It is hard to know whether the AI actually changed files and what changed

**Audit judgment:** This is also largely true. The backend gathers file write metadata, diff previews, and git stats, and the UI shows counts and tool cards. But the top-level display still emphasizes summaries over a precise, human-friendly change ledger. The user wants a crisp answer such as what file changed, what lines changed, and what new files were created. The current interface only partly satisfies that need.


The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

### User claim F
**Claim:** The AI should explain its work clearly at the end

**Audit judgment:** The architecture wants this, the tests expect this, and the renderer even contains a fallback when it fails. So the codebase clearly recognizes the requirement. The problem is that the model does not always land the final narrative answer reliably, which is why the fallback exists in the first place.


The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

The important thing here is that the judgment is rarely a simple yes/no. In this repo, many complaints are best understood as:
- a feature exists in one layer,
- but that feature is bounded, partial, or under-exposed,
- and the user reasonably experiences the result as failure.

That distinction matters because it separates “there is no such capability” from “the product does not yet turn that capability into a trustworthy user experience.”
In this audit, many of the strongest complaints land in the second category.

## Evaluation of the user's extra requested checks

### Extra check X1
**Requested concern:** The model should not access anything outside the workspace, even in danger access

**Audit judgment:** The runtime already enforces this. In fact, the code is stricter than the docs. Outside-workspace actions are denied before danger mode can broaden anything.


This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

### Extra check X2
**Requested concern:** Disable caveman skill entirely

**Audit judgment:** Runtime activation is already filtered through a hard disabled-slug set containing `caveman`. Complete catalog removal was not fully verified from the files I inspected.


This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

### Extra check X3
**Requested concern:** Provide internet access to the model

**Audit judgment:** The runtime tool layer implements web access and the engine config defaults to internet enabled unless the environment disables it. But orchestration currently does not integrate web tools well enough for this to feel like a robust agent feature.


This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

### Extra check X4
**Requested concern:** The model sleeps after a while

**Audit judgment:** There are two credible contributors in the code: model lifecycle preloading with a short keep-alive window, and a weak visible watchdog around hanging streamed tasks.


This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

### Extra check X5
**Requested concern:** Direct mode is for everyday use; agentic mode is for coding

**Audit judgment:** That is consistent with the repo's own architecture and API behavior.


This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

### Extra check X6
**Requested concern:** Agent harness does not let the model do the work

**Audit judgment:** This is a fair high-level diagnosis. The strongest problems are in orchestration, mode switching, workspace binding, fallback brittleness, and visibility quality rather than in the bare existence of low-level tools.


This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

This check is useful because it translates a user expectation into a code-grounded reality check.
The local harness is full of places where the intuitive operator model and the actual runtime model are not the same.
Explicitly resolving those mismatches is one of the most important jobs of an audit like this.

## Failure pattern catalogue

### F-01 — Snapshot illusion
The operator opens a folder in the sidebar and assumes the backend is now bound to that folder. In reality, the browser tree may be only a read-only snapshot. The agent then refuses writes or commands, and the user interprets the refusal as stupidity rather than a source-of-truth mismatch.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-02 — Shortcut optimism
A simple question is answered quickly by a local shortcut, which trains the operator to believe the harness has full workspace command over the repo. On the next harder request, the richer loop stumbles or refuses, producing a jarring contrast.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-03 — Planning-only stall
The model emits thought content or a vague planning turn without actual tool execution. The engine notices, nudges, retries once, and then may fall back or stop. This feels like a brain that talks about acting but never quite acts.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-04 — Manual JSON derailment
The manual fallback path asks the model to emit exactly one JSON object. Small deviations create correction loops. The task budget is spent on formatting discipline rather than code work.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-05 — Unclear change ledger
The run summary says work happened, but the operator still cannot immediately answer which files changed and in what humanly legible way. Trust drops because the visibility is quantitative rather than concrete.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-06 — Lifecycle misread as crash
A short keep-alive window unloads the model after inactivity. The operator watches RAM drop and concludes the model died. From the user's perspective, that conclusion is understandable even if the behavior is technically lifecycle policy rather than a hard crash.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-07 — Tool-power paradox
The tool runtime is fairly strong, but the agent behavior remains weak. The user therefore blames the tools, when the deeper issue is the orchestration layer that decides when and how those tools are used.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-08 — Header-doc mismatch
Documentation says approvals live behind a header queue button. The running UI surfaces approvals differently. The operator follows stale mental instructions and feels the product is inconsistent.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-09 — Silent skill disappearance
The workspace root changes to a target project, the curated skill pack path becomes invalid, and the skills panel empties. Nothing dramatic crashes, but the operator sees a capability disappear.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

### F-10 — Stream without watchdog
A long NDJSON stream remains open, the server timeouts are generous, and the user sees apparent activity long after practical progress has stopped.


This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

This failure pattern matters because it is more psychologically powerful than a conventional bug.
A conventional bug says “this endpoint is broken.” A pattern like this says “the whole assistant feels less dependable than it really is,
or more capable than it really is.” That is harder on operator trust, and harder to diagnose from casual testing.

In a local agentic environment, recurring patterns matter more than isolated errors because users quickly form a theory about what the system is.
If the recurring pattern is hesitation, opacity, or mismatch between visible context and executable truth, that theory becomes negative very quickly.

## Contract drift matrix

### D-01
Danger mode documentation vs actual outside-workspace denial.


Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

### D-02
Approvals queue documentation vs current UI location.


Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

### D-03
Backend public config fields vs frontend `ConfigState` fields.


Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

### D-04
README promise of tool execution visibility vs compressed activity trace presentation.


Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

### D-05
Internet-capable runtime vs orchestration path that never really routes into web tools.


Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

### D-06
Promised source-of-truth parity between backend workspace and visible tree vs continued browser snapshot fallback complexity.


Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

Contract drift is the silent killer of this codebase's credibility. When a repo has strong docs, visible architecture language, and a feature-rich UI,
the operator naturally assumes consistency. Every drift item weakens that assumption. A single drift can be survivable; many drifts create an atmosphere
where the user stops trusting any single statement about what the harness can do.

## Test realism gaps

### Gap T-01
No proof in the inspected tests that the system survives a truly idle or wedged stream from a real local model.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-02
No proof that the UI remains understandable under dozens of tool events and very large reasoning blocks.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-03
No proof that internet tools are routed through the agent path because that path is not visibly exercised end-to-end.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-04
No proof that a real Gemma 4 session under CPU pressure behaves as cleanly as the mocked native chat responders.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-05
No proof that workspace rebinding across multiple real projects preserves the right operator expectations.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-06
No proof that the skill catalog remains coherent after workspace root changes away from the harness repo.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-07
No proof that long multi-command developer workflows are gracefully handled, because shell support is deliberately narrowed.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

### Gap T-08
No proof that manual fallback remains usable under realistic local-model formatting drift across many turns.


This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

This is not a complaint that the tests are useless. In fact, the test surface is broader than many early local-agent repos.
The problem is that the tests are disproportionately good at validating designed intent under controlled mock conditions.
They are less persuasive at validating the chaotic edge cases that define user trust in a real local coding harness.

## Long-form analysis of the direct mode question

The user explicitly asked whether direct mode is functioning as a general-purpose mode.

The answer from the repo is yes in product intent and yes in implementation scope.
Direct mode is not designed to be the coding operator. It is designed to be the everyday assistant path.

Evidence for that conclusion:
- the README distinguishes direct and agentic concerns,
- the API has an explicit `agentic !== false` split,
- the non-agentic path bypasses workspace tools and sends the conversation straight to the model adapter,
- the UI shows chat presets only in agentic mode, reinforcing the idea that direct mode is broader and lighter.

However, this does **not** mean the direct-mode architecture is clean.
The repo currently maintains two non-identical direct-mode paths:
- `/api/chat` direct mode uses a fresh `ModelAdapter`,
- `/api/chat/stream` direct mode uses `engine.directChatStream()`.

That difference can be subtle today and painful tomorrow.
It means direct mode is conceptually one mode but operationally two different code routes.
As soon as a feature, warning path, or formatting fix is added to one route and not the other,
direct mode starts developing internal inconsistency.

This matters because direct mode currently carries the burden of “the one part of the app that feels okay.”
If that mode also drifts internally, the user loses even the stable comparison point that currently makes the architecture legible.

So the right audit conclusion is:
- direct mode is indeed the general-purpose path,
- but it is not a single clean implementation yet,
- and it is not the part of the system where the hardest coding-agent promises live.

The user explicitly asked whether direct mode is functioning as a general-purpose mode.

The answer from the repo is yes in product intent and yes in implementation scope.
Direct mode is not designed to be the coding operator. It is designed to be the everyday assistant path.

Evidence for that conclusion:
- the README distinguishes direct and agentic concerns,
- the API has an explicit `agentic !== false` split,
- the non-agentic path bypasses workspace tools and sends the conversation straight to the model adapter,
- the UI shows chat presets only in agentic mode, reinforcing the idea that direct mode is broader and lighter.

However, this does **not** mean the direct-mode architecture is clean.
The repo currently maintains two non-identical direct-mode paths:
- `/api/chat` direct mode uses a fresh `ModelAdapter`,
- `/api/chat/stream` direct mode uses `engine.directChatStream()`.

That difference can be subtle today and painful tomorrow.
It means direct mode is conceptually one mode but operationally two different code routes.
As soon as a feature, warning path, or formatting fix is added to one route and not the other,
direct mode starts developing internal inconsistency.

This matters because direct mode currently carries the burden of “the one part of the app that feels okay.”
If that mode also drifts internally, the user loses even the stable comparison point that currently makes the architecture legible.

So the right audit conclusion is:
- direct mode is indeed the general-purpose path,
- but it is not a single clean implementation yet,
- and it is not the part of the system where the hardest coding-agent promises live.

The user explicitly asked whether direct mode is functioning as a general-purpose mode.

The answer from the repo is yes in product intent and yes in implementation scope.
Direct mode is not designed to be the coding operator. It is designed to be the everyday assistant path.

Evidence for that conclusion:
- the README distinguishes direct and agentic concerns,
- the API has an explicit `agentic !== false` split,
- the non-agentic path bypasses workspace tools and sends the conversation straight to the model adapter,
- the UI shows chat presets only in agentic mode, reinforcing the idea that direct mode is broader and lighter.

However, this does **not** mean the direct-mode architecture is clean.
The repo currently maintains two non-identical direct-mode paths:
- `/api/chat` direct mode uses a fresh `ModelAdapter`,
- `/api/chat/stream` direct mode uses `engine.directChatStream()`.

That difference can be subtle today and painful tomorrow.
It means direct mode is conceptually one mode but operationally two different code routes.
As soon as a feature, warning path, or formatting fix is added to one route and not the other,
direct mode starts developing internal inconsistency.

This matters because direct mode currently carries the burden of “the one part of the app that feels okay.”
If that mode also drifts internally, the user loses even the stable comparison point that currently makes the architecture legible.

So the right audit conclusion is:
- direct mode is indeed the general-purpose path,
- but it is not a single clean implementation yet,
- and it is not the part of the system where the hardest coding-agent promises live.

The user explicitly asked whether direct mode is functioning as a general-purpose mode.

The answer from the repo is yes in product intent and yes in implementation scope.
Direct mode is not designed to be the coding operator. It is designed to be the everyday assistant path.

Evidence for that conclusion:
- the README distinguishes direct and agentic concerns,
- the API has an explicit `agentic !== false` split,
- the non-agentic path bypasses workspace tools and sends the conversation straight to the model adapter,
- the UI shows chat presets only in agentic mode, reinforcing the idea that direct mode is broader and lighter.

However, this does **not** mean the direct-mode architecture is clean.
The repo currently maintains two non-identical direct-mode paths:
- `/api/chat` direct mode uses a fresh `ModelAdapter`,
- `/api/chat/stream` direct mode uses `engine.directChatStream()`.

That difference can be subtle today and painful tomorrow.
It means direct mode is conceptually one mode but operationally two different code routes.
As soon as a feature, warning path, or formatting fix is added to one route and not the other,
direct mode starts developing internal inconsistency.

This matters because direct mode currently carries the burden of “the one part of the app that feels okay.”
If that mode also drifts internally, the user loses even the stable comparison point that currently makes the architecture legible.

So the right audit conclusion is:
- direct mode is indeed the general-purpose path,
- but it is not a single clean implementation yet,
- and it is not the part of the system where the hardest coding-agent promises live.

## Long-form analysis of the agentic-mode failure story

Agentic mode is where the repo tries to become more than a chatbot.
It tries to become a bounded operator.

The good news is that the repo does not fake seriousness.
It has:
- a core engine,
- policy enforcement,
- approvals,
- run summaries,
- step tracking,
- tool cards,
- model capability detection,
- manual fallback,
- workspace resolution,
- session persistence,
- and tests that clearly care about these behaviors.

The bad news is that all of this machinery makes the product feel strong **only if it converges**.
Right now it has not fully converged.

The user's complaint that agentic mode is “ass” is crude but directionally accurate.
The repo reveals several reinforcing reasons:

1. The agent loop is bounded tightly.
2. The planner is lightweight.
3. Tool routing is heuristic.
4. Manual fallback is brittle.
5. The UI does not always turn rich backend events into satisfying human clarity.
6. Workspace truth can diverge from visible folder context.
7. Several features exist in the runtime but are not fully integrated into the agent path.
8. The product anticipates common failure modes strongly enough that fallback logic is now part of the normal architecture.

The result is a harness that can look very serious in a package diagram and still fail to feel like a serious operator in day-to-day use.
That is not because the idea is wrong.
It is because the implementation is still in the phase where scaffolding and product truth have not collapsed into one mature surface.

Agentic mode is where the repo tries to become more than a chatbot.
It tries to become a bounded operator.

The good news is that the repo does not fake seriousness.
It has:
- a core engine,
- policy enforcement,
- approvals,
- run summaries,
- step tracking,
- tool cards,
- model capability detection,
- manual fallback,
- workspace resolution,
- session persistence,
- and tests that clearly care about these behaviors.

The bad news is that all of this machinery makes the product feel strong **only if it converges**.
Right now it has not fully converged.

The user's complaint that agentic mode is “ass” is crude but directionally accurate.
The repo reveals several reinforcing reasons:

1. The agent loop is bounded tightly.
2. The planner is lightweight.
3. Tool routing is heuristic.
4. Manual fallback is brittle.
5. The UI does not always turn rich backend events into satisfying human clarity.
6. Workspace truth can diverge from visible folder context.
7. Several features exist in the runtime but are not fully integrated into the agent path.
8. The product anticipates common failure modes strongly enough that fallback logic is now part of the normal architecture.

The result is a harness that can look very serious in a package diagram and still fail to feel like a serious operator in day-to-day use.
That is not because the idea is wrong.
It is because the implementation is still in the phase where scaffolding and product truth have not collapsed into one mature surface.

Agentic mode is where the repo tries to become more than a chatbot.
It tries to become a bounded operator.

The good news is that the repo does not fake seriousness.
It has:
- a core engine,
- policy enforcement,
- approvals,
- run summaries,
- step tracking,
- tool cards,
- model capability detection,
- manual fallback,
- workspace resolution,
- session persistence,
- and tests that clearly care about these behaviors.

The bad news is that all of this machinery makes the product feel strong **only if it converges**.
Right now it has not fully converged.

The user's complaint that agentic mode is “ass” is crude but directionally accurate.
The repo reveals several reinforcing reasons:

1. The agent loop is bounded tightly.
2. The planner is lightweight.
3. Tool routing is heuristic.
4. Manual fallback is brittle.
5. The UI does not always turn rich backend events into satisfying human clarity.
6. Workspace truth can diverge from visible folder context.
7. Several features exist in the runtime but are not fully integrated into the agent path.
8. The product anticipates common failure modes strongly enough that fallback logic is now part of the normal architecture.

The result is a harness that can look very serious in a package diagram and still fail to feel like a serious operator in day-to-day use.
That is not because the idea is wrong.
It is because the implementation is still in the phase where scaffolding and product truth have not collapsed into one mature surface.

Agentic mode is where the repo tries to become more than a chatbot.
It tries to become a bounded operator.

The good news is that the repo does not fake seriousness.
It has:
- a core engine,
- policy enforcement,
- approvals,
- run summaries,
- step tracking,
- tool cards,
- model capability detection,
- manual fallback,
- workspace resolution,
- session persistence,
- and tests that clearly care about these behaviors.

The bad news is that all of this machinery makes the product feel strong **only if it converges**.
Right now it has not fully converged.

The user's complaint that agentic mode is “ass” is crude but directionally accurate.
The repo reveals several reinforcing reasons:

1. The agent loop is bounded tightly.
2. The planner is lightweight.
3. Tool routing is heuristic.
4. Manual fallback is brittle.
5. The UI does not always turn rich backend events into satisfying human clarity.
6. Workspace truth can diverge from visible folder context.
7. Several features exist in the runtime but are not fully integrated into the agent path.
8. The product anticipates common failure modes strongly enough that fallback logic is now part of the normal architecture.

The result is a harness that can look very serious in a package diagram and still fail to feel like a serious operator in day-to-day use.
That is not because the idea is wrong.
It is because the implementation is still in the phase where scaffolding and product truth have not collapsed into one mature surface.

Agentic mode is where the repo tries to become more than a chatbot.
It tries to become a bounded operator.

The good news is that the repo does not fake seriousness.
It has:
- a core engine,
- policy enforcement,
- approvals,
- run summaries,
- step tracking,
- tool cards,
- model capability detection,
- manual fallback,
- workspace resolution,
- session persistence,
- and tests that clearly care about these behaviors.

The bad news is that all of this machinery makes the product feel strong **only if it converges**.
Right now it has not fully converged.

The user's complaint that agentic mode is “ass” is crude but directionally accurate.
The repo reveals several reinforcing reasons:

1. The agent loop is bounded tightly.
2. The planner is lightweight.
3. Tool routing is heuristic.
4. Manual fallback is brittle.
5. The UI does not always turn rich backend events into satisfying human clarity.
6. Workspace truth can diverge from visible folder context.
7. Several features exist in the runtime but are not fully integrated into the agent path.
8. The product anticipates common failure modes strongly enough that fallback logic is now part of the normal architecture.

The result is a harness that can look very serious in a package diagram and still fail to feel like a serious operator in day-to-day use.
That is not because the idea is wrong.
It is because the implementation is still in the phase where scaffolding and product truth have not collapsed into one mature surface.

Agentic mode is where the repo tries to become more than a chatbot.
It tries to become a bounded operator.

The good news is that the repo does not fake seriousness.
It has:
- a core engine,
- policy enforcement,
- approvals,
- run summaries,
- step tracking,
- tool cards,
- model capability detection,
- manual fallback,
- workspace resolution,
- session persistence,
- and tests that clearly care about these behaviors.

The bad news is that all of this machinery makes the product feel strong **only if it converges**.
Right now it has not fully converged.

The user's complaint that agentic mode is “ass” is crude but directionally accurate.
The repo reveals several reinforcing reasons:

1. The agent loop is bounded tightly.
2. The planner is lightweight.
3. Tool routing is heuristic.
4. Manual fallback is brittle.
5. The UI does not always turn rich backend events into satisfying human clarity.
6. Workspace truth can diverge from visible folder context.
7. Several features exist in the runtime but are not fully integrated into the agent path.
8. The product anticipates common failure modes strongly enough that fallback logic is now part of the normal architecture.

The result is a harness that can look very serious in a package diagram and still fail to feel like a serious operator in day-to-day use.
That is not because the idea is wrong.
It is because the implementation is still in the phase where scaffolding and product truth have not collapsed into one mature surface.

## Narrative walkthrough: what happens during a typical agentic turn

To understand why the harness feels inconsistent, it helps to walk through a typical agentic turn as the code currently suggests it unfolds.

The user writes a message in the web UI.
The UI may or may not also attach browser-folder context.
The UI may or may not be truly bound to the backend workspace.
The UI constructs a system prompt that mentions workspace, session, selected skills, optional browser folder, optional selected file, and optional repo summary.
It then streams the result from `/api/chat/stream`.

Inside the backend, the engine may start a session if none exists.
It classifies the intent.
It may decide the request is simple enough to answer from local state or from direct workspace tools without entering the full agent loop.
If that happens, the user gets an answer fast, but no deep Codex-like progression.

If it does enter the fuller loop, the engine selects tools using regex heuristics.
It asks the model adapter for model capabilities.
It decides whether to attempt native tool calling or manual fallback.
It builds runtime contract messages and maybe bootstrap steps.
It may index workspace inventory.
It may list the root.
It may push system messages about workspace context and available tools.

Then the real uncertainty begins.
If native tools work, the model may request tool calls and the engine executes them.
If native tools do not work cleanly, manual fallback may activate.
If the model emits planning-only text, the engine retries or falls back.
If the model simulates tool use, the engine corrects it and may eventually give up.
If a write requires approval, the run pauses and the UI must surface that pause clearly enough for the operator to understand it.

Even after successful tool work, the model still needs to produce a satisfying final narrative.
The UI already knows this sometimes fails, which is why it has an honesty fallback.

This walkthrough explains the core emotional experience:
the operator is not watching a single smooth worker.
The operator is watching a multi-layer protocol stack that sometimes behaves like a worker and sometimes behaves like a bureaucracy.

To understand why the harness feels inconsistent, it helps to walk through a typical agentic turn as the code currently suggests it unfolds.

The user writes a message in the web UI.
The UI may or may not also attach browser-folder context.
The UI may or may not be truly bound to the backend workspace.
The UI constructs a system prompt that mentions workspace, session, selected skills, optional browser folder, optional selected file, and optional repo summary.
It then streams the result from `/api/chat/stream`.

Inside the backend, the engine may start a session if none exists.
It classifies the intent.
It may decide the request is simple enough to answer from local state or from direct workspace tools without entering the full agent loop.
If that happens, the user gets an answer fast, but no deep Codex-like progression.

If it does enter the fuller loop, the engine selects tools using regex heuristics.
It asks the model adapter for model capabilities.
It decides whether to attempt native tool calling or manual fallback.
It builds runtime contract messages and maybe bootstrap steps.
It may index workspace inventory.
It may list the root.
It may push system messages about workspace context and available tools.

Then the real uncertainty begins.
If native tools work, the model may request tool calls and the engine executes them.
If native tools do not work cleanly, manual fallback may activate.
If the model emits planning-only text, the engine retries or falls back.
If the model simulates tool use, the engine corrects it and may eventually give up.
If a write requires approval, the run pauses and the UI must surface that pause clearly enough for the operator to understand it.

Even after successful tool work, the model still needs to produce a satisfying final narrative.
The UI already knows this sometimes fails, which is why it has an honesty fallback.

This walkthrough explains the core emotional experience:
the operator is not watching a single smooth worker.
The operator is watching a multi-layer protocol stack that sometimes behaves like a worker and sometimes behaves like a bureaucracy.

To understand why the harness feels inconsistent, it helps to walk through a typical agentic turn as the code currently suggests it unfolds.

The user writes a message in the web UI.
The UI may or may not also attach browser-folder context.
The UI may or may not be truly bound to the backend workspace.
The UI constructs a system prompt that mentions workspace, session, selected skills, optional browser folder, optional selected file, and optional repo summary.
It then streams the result from `/api/chat/stream`.

Inside the backend, the engine may start a session if none exists.
It classifies the intent.
It may decide the request is simple enough to answer from local state or from direct workspace tools without entering the full agent loop.
If that happens, the user gets an answer fast, but no deep Codex-like progression.

If it does enter the fuller loop, the engine selects tools using regex heuristics.
It asks the model adapter for model capabilities.
It decides whether to attempt native tool calling or manual fallback.
It builds runtime contract messages and maybe bootstrap steps.
It may index workspace inventory.
It may list the root.
It may push system messages about workspace context and available tools.

Then the real uncertainty begins.
If native tools work, the model may request tool calls and the engine executes them.
If native tools do not work cleanly, manual fallback may activate.
If the model emits planning-only text, the engine retries or falls back.
If the model simulates tool use, the engine corrects it and may eventually give up.
If a write requires approval, the run pauses and the UI must surface that pause clearly enough for the operator to understand it.

Even after successful tool work, the model still needs to produce a satisfying final narrative.
The UI already knows this sometimes fails, which is why it has an honesty fallback.

This walkthrough explains the core emotional experience:
the operator is not watching a single smooth worker.
The operator is watching a multi-layer protocol stack that sometimes behaves like a worker and sometimes behaves like a bureaucracy.

To understand why the harness feels inconsistent, it helps to walk through a typical agentic turn as the code currently suggests it unfolds.

The user writes a message in the web UI.
The UI may or may not also attach browser-folder context.
The UI may or may not be truly bound to the backend workspace.
The UI constructs a system prompt that mentions workspace, session, selected skills, optional browser folder, optional selected file, and optional repo summary.
It then streams the result from `/api/chat/stream`.

Inside the backend, the engine may start a session if none exists.
It classifies the intent.
It may decide the request is simple enough to answer from local state or from direct workspace tools without entering the full agent loop.
If that happens, the user gets an answer fast, but no deep Codex-like progression.

If it does enter the fuller loop, the engine selects tools using regex heuristics.
It asks the model adapter for model capabilities.
It decides whether to attempt native tool calling or manual fallback.
It builds runtime contract messages and maybe bootstrap steps.
It may index workspace inventory.
It may list the root.
It may push system messages about workspace context and available tools.

Then the real uncertainty begins.
If native tools work, the model may request tool calls and the engine executes them.
If native tools do not work cleanly, manual fallback may activate.
If the model emits planning-only text, the engine retries or falls back.
If the model simulates tool use, the engine corrects it and may eventually give up.
If a write requires approval, the run pauses and the UI must surface that pause clearly enough for the operator to understand it.

Even after successful tool work, the model still needs to produce a satisfying final narrative.
The UI already knows this sometimes fails, which is why it has an honesty fallback.

This walkthrough explains the core emotional experience:
the operator is not watching a single smooth worker.
The operator is watching a multi-layer protocol stack that sometimes behaves like a worker and sometimes behaves like a bureaucracy.

To understand why the harness feels inconsistent, it helps to walk through a typical agentic turn as the code currently suggests it unfolds.

The user writes a message in the web UI.
The UI may or may not also attach browser-folder context.
The UI may or may not be truly bound to the backend workspace.
The UI constructs a system prompt that mentions workspace, session, selected skills, optional browser folder, optional selected file, and optional repo summary.
It then streams the result from `/api/chat/stream`.

Inside the backend, the engine may start a session if none exists.
It classifies the intent.
It may decide the request is simple enough to answer from local state or from direct workspace tools without entering the full agent loop.
If that happens, the user gets an answer fast, but no deep Codex-like progression.

If it does enter the fuller loop, the engine selects tools using regex heuristics.
It asks the model adapter for model capabilities.
It decides whether to attempt native tool calling or manual fallback.
It builds runtime contract messages and maybe bootstrap steps.
It may index workspace inventory.
It may list the root.
It may push system messages about workspace context and available tools.

Then the real uncertainty begins.
If native tools work, the model may request tool calls and the engine executes them.
If native tools do not work cleanly, manual fallback may activate.
If the model emits planning-only text, the engine retries or falls back.
If the model simulates tool use, the engine corrects it and may eventually give up.
If a write requires approval, the run pauses and the UI must surface that pause clearly enough for the operator to understand it.

Even after successful tool work, the model still needs to produce a satisfying final narrative.
The UI already knows this sometimes fails, which is why it has an honesty fallback.

This walkthrough explains the core emotional experience:
the operator is not watching a single smooth worker.
The operator is watching a multi-layer protocol stack that sometimes behaves like a worker and sometimes behaves like a bureaucracy.

To understand why the harness feels inconsistent, it helps to walk through a typical agentic turn as the code currently suggests it unfolds.

The user writes a message in the web UI.
The UI may or may not also attach browser-folder context.
The UI may or may not be truly bound to the backend workspace.
The UI constructs a system prompt that mentions workspace, session, selected skills, optional browser folder, optional selected file, and optional repo summary.
It then streams the result from `/api/chat/stream`.

Inside the backend, the engine may start a session if none exists.
It classifies the intent.
It may decide the request is simple enough to answer from local state or from direct workspace tools without entering the full agent loop.
If that happens, the user gets an answer fast, but no deep Codex-like progression.

If it does enter the fuller loop, the engine selects tools using regex heuristics.
It asks the model adapter for model capabilities.
It decides whether to attempt native tool calling or manual fallback.
It builds runtime contract messages and maybe bootstrap steps.
It may index workspace inventory.
It may list the root.
It may push system messages about workspace context and available tools.

Then the real uncertainty begins.
If native tools work, the model may request tool calls and the engine executes them.
If native tools do not work cleanly, manual fallback may activate.
If the model emits planning-only text, the engine retries or falls back.
If the model simulates tool use, the engine corrects it and may eventually give up.
If a write requires approval, the run pauses and the UI must surface that pause clearly enough for the operator to understand it.

Even after successful tool work, the model still needs to produce a satisfying final narrative.
The UI already knows this sometimes fails, which is why it has an honesty fallback.

This walkthrough explains the core emotional experience:
the operator is not watching a single smooth worker.
The operator is watching a multi-layer protocol stack that sometimes behaves like a worker and sometimes behaves like a bureaucracy.

## Why the harness can feel less capable than Codex even when many pieces exist

The user's comparison to Codex is not really about model size alone.
It is about workflow quality.

Codex-like behavior feels good when the system:
- keeps the working set coherent,
- chooses the next action without excessive ceremony,
- reads and edits the right files in sequence,
- verifies changes,
- reports concretely,
- and does not make the operator babysit the protocol.

This harness currently loses ground on several of those fronts:

- working memory is shallow,
- loop budgets are tight,
- fallback logic is rigid,
- workspace truth can be ambiguous,
- shell capability is intentionally narrow,
- high-level visibility is present but not always legible,
- and final narration is not reliable enough to avoid UI honesty fallbacks.

So the user's “Codex keeps building layer by layer” observation maps to a real systems gap.
Codex-like feel is not just a model attribute.
It is the product of orchestration, state handling, recovery behavior, and presentation.
This repo has many of the parts, but the parts have not yet become one dependable operator loop.

The user's comparison to Codex is not really about model size alone.
It is about workflow quality.

Codex-like behavior feels good when the system:
- keeps the working set coherent,
- chooses the next action without excessive ceremony,
- reads and edits the right files in sequence,
- verifies changes,
- reports concretely,
- and does not make the operator babysit the protocol.

This harness currently loses ground on several of those fronts:

- working memory is shallow,
- loop budgets are tight,
- fallback logic is rigid,
- workspace truth can be ambiguous,
- shell capability is intentionally narrow,
- high-level visibility is present but not always legible,
- and final narration is not reliable enough to avoid UI honesty fallbacks.

So the user's “Codex keeps building layer by layer” observation maps to a real systems gap.
Codex-like feel is not just a model attribute.
It is the product of orchestration, state handling, recovery behavior, and presentation.
This repo has many of the parts, but the parts have not yet become one dependable operator loop.

The user's comparison to Codex is not really about model size alone.
It is about workflow quality.

Codex-like behavior feels good when the system:
- keeps the working set coherent,
- chooses the next action without excessive ceremony,
- reads and edits the right files in sequence,
- verifies changes,
- reports concretely,
- and does not make the operator babysit the protocol.

This harness currently loses ground on several of those fronts:

- working memory is shallow,
- loop budgets are tight,
- fallback logic is rigid,
- workspace truth can be ambiguous,
- shell capability is intentionally narrow,
- high-level visibility is present but not always legible,
- and final narration is not reliable enough to avoid UI honesty fallbacks.

So the user's “Codex keeps building layer by layer” observation maps to a real systems gap.
Codex-like feel is not just a model attribute.
It is the product of orchestration, state handling, recovery behavior, and presentation.
This repo has many of the parts, but the parts have not yet become one dependable operator loop.

The user's comparison to Codex is not really about model size alone.
It is about workflow quality.

Codex-like behavior feels good when the system:
- keeps the working set coherent,
- chooses the next action without excessive ceremony,
- reads and edits the right files in sequence,
- verifies changes,
- reports concretely,
- and does not make the operator babysit the protocol.

This harness currently loses ground on several of those fronts:

- working memory is shallow,
- loop budgets are tight,
- fallback logic is rigid,
- workspace truth can be ambiguous,
- shell capability is intentionally narrow,
- high-level visibility is present but not always legible,
- and final narration is not reliable enough to avoid UI honesty fallbacks.

So the user's “Codex keeps building layer by layer” observation maps to a real systems gap.
Codex-like feel is not just a model attribute.
It is the product of orchestration, state handling, recovery behavior, and presentation.
This repo has many of the parts, but the parts have not yet become one dependable operator loop.

The user's comparison to Codex is not really about model size alone.
It is about workflow quality.

Codex-like behavior feels good when the system:
- keeps the working set coherent,
- chooses the next action without excessive ceremony,
- reads and edits the right files in sequence,
- verifies changes,
- reports concretely,
- and does not make the operator babysit the protocol.

This harness currently loses ground on several of those fronts:

- working memory is shallow,
- loop budgets are tight,
- fallback logic is rigid,
- workspace truth can be ambiguous,
- shell capability is intentionally narrow,
- high-level visibility is present but not always legible,
- and final narration is not reliable enough to avoid UI honesty fallbacks.

So the user's “Codex keeps building layer by layer” observation maps to a real systems gap.
Codex-like feel is not just a model attribute.
It is the product of orchestration, state handling, recovery behavior, and presentation.
This repo has many of the parts, but the parts have not yet become one dependable operator loop.

## Deep commentary on memory and continuity

The user repeatedly suspected a memory issue.
That suspicion is reasonable.

What the repo does have:
- session identity,
- session metadata,
- turn metadata,
- saved sessions,
- some run summaries attached to turns,
- planner state during execution.

What the repo does not appear to have from the inspected files:
- a rich persistent task graph,
- durable step-to-step working memory across long coding operations,
- strongly structured internal representations of hypotheses, failed attempts, or pending subgoals,
- a cross-workspace continuity model that survives rebinding cleanly.

That means the memory story is good enough for:
- basic mode tracking,
- basic session resumption,
- rough continuity markers.

It is weaker for:
- long multistep coding arcs,
- rollback-aware execution,
- layered repair after failed attempts,
- and the feeling that the agent is carrying a serious evolving plan in its hands.

This is exactly why the user's complaint feels sharper in agentic mode than in direct mode.
Direct mode only needs continuity good enough for conversation.
Agentic mode needs continuity good enough for work.
Those are very different standards.

The user repeatedly suspected a memory issue.
That suspicion is reasonable.

What the repo does have:
- session identity,
- session metadata,
- turn metadata,
- saved sessions,
- some run summaries attached to turns,
- planner state during execution.

What the repo does not appear to have from the inspected files:
- a rich persistent task graph,
- durable step-to-step working memory across long coding operations,
- strongly structured internal representations of hypotheses, failed attempts, or pending subgoals,
- a cross-workspace continuity model that survives rebinding cleanly.

That means the memory story is good enough for:
- basic mode tracking,
- basic session resumption,
- rough continuity markers.

It is weaker for:
- long multistep coding arcs,
- rollback-aware execution,
- layered repair after failed attempts,
- and the feeling that the agent is carrying a serious evolving plan in its hands.

This is exactly why the user's complaint feels sharper in agentic mode than in direct mode.
Direct mode only needs continuity good enough for conversation.
Agentic mode needs continuity good enough for work.
Those are very different standards.

The user repeatedly suspected a memory issue.
That suspicion is reasonable.

What the repo does have:
- session identity,
- session metadata,
- turn metadata,
- saved sessions,
- some run summaries attached to turns,
- planner state during execution.

What the repo does not appear to have from the inspected files:
- a rich persistent task graph,
- durable step-to-step working memory across long coding operations,
- strongly structured internal representations of hypotheses, failed attempts, or pending subgoals,
- a cross-workspace continuity model that survives rebinding cleanly.

That means the memory story is good enough for:
- basic mode tracking,
- basic session resumption,
- rough continuity markers.

It is weaker for:
- long multistep coding arcs,
- rollback-aware execution,
- layered repair after failed attempts,
- and the feeling that the agent is carrying a serious evolving plan in its hands.

This is exactly why the user's complaint feels sharper in agentic mode than in direct mode.
Direct mode only needs continuity good enough for conversation.
Agentic mode needs continuity good enough for work.
Those are very different standards.

The user repeatedly suspected a memory issue.
That suspicion is reasonable.

What the repo does have:
- session identity,
- session metadata,
- turn metadata,
- saved sessions,
- some run summaries attached to turns,
- planner state during execution.

What the repo does not appear to have from the inspected files:
- a rich persistent task graph,
- durable step-to-step working memory across long coding operations,
- strongly structured internal representations of hypotheses, failed attempts, or pending subgoals,
- a cross-workspace continuity model that survives rebinding cleanly.

That means the memory story is good enough for:
- basic mode tracking,
- basic session resumption,
- rough continuity markers.

It is weaker for:
- long multistep coding arcs,
- rollback-aware execution,
- layered repair after failed attempts,
- and the feeling that the agent is carrying a serious evolving plan in its hands.

This is exactly why the user's complaint feels sharper in agentic mode than in direct mode.
Direct mode only needs continuity good enough for conversation.
Agentic mode needs continuity good enough for work.
Those are very different standards.

The user repeatedly suspected a memory issue.
That suspicion is reasonable.

What the repo does have:
- session identity,
- session metadata,
- turn metadata,
- saved sessions,
- some run summaries attached to turns,
- planner state during execution.

What the repo does not appear to have from the inspected files:
- a rich persistent task graph,
- durable step-to-step working memory across long coding operations,
- strongly structured internal representations of hypotheses, failed attempts, or pending subgoals,
- a cross-workspace continuity model that survives rebinding cleanly.

That means the memory story is good enough for:
- basic mode tracking,
- basic session resumption,
- rough continuity markers.

It is weaker for:
- long multistep coding arcs,
- rollback-aware execution,
- layered repair after failed attempts,
- and the feeling that the agent is carrying a serious evolving plan in its hands.

This is exactly why the user's complaint feels sharper in agentic mode than in direct mode.
Direct mode only needs continuity good enough for conversation.
Agentic mode needs continuity good enough for work.
Those are very different standards.

The user repeatedly suspected a memory issue.
That suspicion is reasonable.

What the repo does have:
- session identity,
- session metadata,
- turn metadata,
- saved sessions,
- some run summaries attached to turns,
- planner state during execution.

What the repo does not appear to have from the inspected files:
- a rich persistent task graph,
- durable step-to-step working memory across long coding operations,
- strongly structured internal representations of hypotheses, failed attempts, or pending subgoals,
- a cross-workspace continuity model that survives rebinding cleanly.

That means the memory story is good enough for:
- basic mode tracking,
- basic session resumption,
- rough continuity markers.

It is weaker for:
- long multistep coding arcs,
- rollback-aware execution,
- layered repair after failed attempts,
- and the feeling that the agent is carrying a serious evolving plan in its hands.

This is exactly why the user's complaint feels sharper in agentic mode than in direct mode.
Direct mode only needs continuity good enough for conversation.
Agentic mode needs continuity good enough for work.
Those are very different standards.

## Deep commentary on visibility, explanation, and trust

One of the most interesting aspects of this repo is that it clearly values honesty.
It refuses to fabricate hidden reasoning.
It emits statuses.
It surfaces tool cards.
It tracks run steps.
It shows run summaries.
It even includes an honesty fallback when the model never lands a proper narrative conclusion.

That is good engineering character.

But honesty alone is not the same as satisfying operator visibility.
The operator does not just want proof that the harness ran some tools.
The operator wants a readable account of what happened and why it matters.
They want:
- which files were read,
- which files were changed,
- whether tests were run,
- what succeeded,
- what failed,
- what remains uncertain.

The current UI surfaces a lot of machinery:
- run overview,
- run steps,
- tool event cards,
- optional reasoning blocks,
- final content.

The trouble is that the machinery can dominate the message.
When that happens, the user sees a great deal of activity but not enough clear authorship.
The app feels like a log viewer wrapped around a nervous model rather than a decisive coding partner.

That is why the user's complaint about “big block, small content” is so important.
It is not a superficial aesthetic preference.
It is a sign that the product has not yet found the right balance between operational transparency and outcome clarity.

One of the most interesting aspects of this repo is that it clearly values honesty.
It refuses to fabricate hidden reasoning.
It emits statuses.
It surfaces tool cards.
It tracks run steps.
It shows run summaries.
It even includes an honesty fallback when the model never lands a proper narrative conclusion.

That is good engineering character.

But honesty alone is not the same as satisfying operator visibility.
The operator does not just want proof that the harness ran some tools.
The operator wants a readable account of what happened and why it matters.
They want:
- which files were read,
- which files were changed,
- whether tests were run,
- what succeeded,
- what failed,
- what remains uncertain.

The current UI surfaces a lot of machinery:
- run overview,
- run steps,
- tool event cards,
- optional reasoning blocks,
- final content.

The trouble is that the machinery can dominate the message.
When that happens, the user sees a great deal of activity but not enough clear authorship.
The app feels like a log viewer wrapped around a nervous model rather than a decisive coding partner.

That is why the user's complaint about “big block, small content” is so important.
It is not a superficial aesthetic preference.
It is a sign that the product has not yet found the right balance between operational transparency and outcome clarity.

One of the most interesting aspects of this repo is that it clearly values honesty.
It refuses to fabricate hidden reasoning.
It emits statuses.
It surfaces tool cards.
It tracks run steps.
It shows run summaries.
It even includes an honesty fallback when the model never lands a proper narrative conclusion.

That is good engineering character.

But honesty alone is not the same as satisfying operator visibility.
The operator does not just want proof that the harness ran some tools.
The operator wants a readable account of what happened and why it matters.
They want:
- which files were read,
- which files were changed,
- whether tests were run,
- what succeeded,
- what failed,
- what remains uncertain.

The current UI surfaces a lot of machinery:
- run overview,
- run steps,
- tool event cards,
- optional reasoning blocks,
- final content.

The trouble is that the machinery can dominate the message.
When that happens, the user sees a great deal of activity but not enough clear authorship.
The app feels like a log viewer wrapped around a nervous model rather than a decisive coding partner.

That is why the user's complaint about “big block, small content” is so important.
It is not a superficial aesthetic preference.
It is a sign that the product has not yet found the right balance between operational transparency and outcome clarity.

One of the most interesting aspects of this repo is that it clearly values honesty.
It refuses to fabricate hidden reasoning.
It emits statuses.
It surfaces tool cards.
It tracks run steps.
It shows run summaries.
It even includes an honesty fallback when the model never lands a proper narrative conclusion.

That is good engineering character.

But honesty alone is not the same as satisfying operator visibility.
The operator does not just want proof that the harness ran some tools.
The operator wants a readable account of what happened and why it matters.
They want:
- which files were read,
- which files were changed,
- whether tests were run,
- what succeeded,
- what failed,
- what remains uncertain.

The current UI surfaces a lot of machinery:
- run overview,
- run steps,
- tool event cards,
- optional reasoning blocks,
- final content.

The trouble is that the machinery can dominate the message.
When that happens, the user sees a great deal of activity but not enough clear authorship.
The app feels like a log viewer wrapped around a nervous model rather than a decisive coding partner.

That is why the user's complaint about “big block, small content” is so important.
It is not a superficial aesthetic preference.
It is a sign that the product has not yet found the right balance between operational transparency and outcome clarity.

One of the most interesting aspects of this repo is that it clearly values honesty.
It refuses to fabricate hidden reasoning.
It emits statuses.
It surfaces tool cards.
It tracks run steps.
It shows run summaries.
It even includes an honesty fallback when the model never lands a proper narrative conclusion.

That is good engineering character.

But honesty alone is not the same as satisfying operator visibility.
The operator does not just want proof that the harness ran some tools.
The operator wants a readable account of what happened and why it matters.
They want:
- which files were read,
- which files were changed,
- whether tests were run,
- what succeeded,
- what failed,
- what remains uncertain.

The current UI surfaces a lot of machinery:
- run overview,
- run steps,
- tool event cards,
- optional reasoning blocks,
- final content.

The trouble is that the machinery can dominate the message.
When that happens, the user sees a great deal of activity but not enough clear authorship.
The app feels like a log viewer wrapped around a nervous model rather than a decisive coding partner.

That is why the user's complaint about “big block, small content” is so important.
It is not a superficial aesthetic preference.
It is a sign that the product has not yet found the right balance between operational transparency and outcome clarity.

One of the most interesting aspects of this repo is that it clearly values honesty.
It refuses to fabricate hidden reasoning.
It emits statuses.
It surfaces tool cards.
It tracks run steps.
It shows run summaries.
It even includes an honesty fallback when the model never lands a proper narrative conclusion.

That is good engineering character.

But honesty alone is not the same as satisfying operator visibility.
The operator does not just want proof that the harness ran some tools.
The operator wants a readable account of what happened and why it matters.
They want:
- which files were read,
- which files were changed,
- whether tests were run,
- what succeeded,
- what failed,
- what remains uncertain.

The current UI surfaces a lot of machinery:
- run overview,
- run steps,
- tool event cards,
- optional reasoning blocks,
- final content.

The trouble is that the machinery can dominate the message.
When that happens, the user sees a great deal of activity but not enough clear authorship.
The app feels like a log viewer wrapped around a nervous model rather than a decisive coding partner.

That is why the user's complaint about “big block, small content” is so important.
It is not a superficial aesthetic preference.
It is a sign that the product has not yet found the right balance between operational transparency and outcome clarity.

## Problem priority stack

If the entire audit is compressed into a ranked problem stack, the order is roughly this:

1. **System coherence problem**
   The repo's docs, engine, policy, API, and UI do not yet speak with one voice.

2. **Workspace-truth problem**
   Snapshot context, bound workspace, and danger-mode expectations are easy to confuse and sometimes contradictory.

3. **Agent execution problem**
   The agent loop is too shallow, too bounded, and too protocol-fragile for the user's expectations.

4. **Visibility-quality problem**
   The UI shows many signals but not always the right story.

5. **Continuity problem**
   Session persistence is real, but deep working memory is weak.

6. **Capability integration problem**
   Some capabilities exist in lower layers without becoming trustworthy product-level behavior.

7. **Realism gap problem**
   The tests prove many happy-path intentions but do not fully model the user's real local-model pain.

This priority stack matters because it warns against a tempting but shallow diagnosis:
“just improve the prompts.”
The repo's problems are not prompt-only.
They are architectural, contractual, and experiential.

If the entire audit is compressed into a ranked problem stack, the order is roughly this:

1. **System coherence problem**
   The repo's docs, engine, policy, API, and UI do not yet speak with one voice.

2. **Workspace-truth problem**
   Snapshot context, bound workspace, and danger-mode expectations are easy to confuse and sometimes contradictory.

3. **Agent execution problem**
   The agent loop is too shallow, too bounded, and too protocol-fragile for the user's expectations.

4. **Visibility-quality problem**
   The UI shows many signals but not always the right story.

5. **Continuity problem**
   Session persistence is real, but deep working memory is weak.

6. **Capability integration problem**
   Some capabilities exist in lower layers without becoming trustworthy product-level behavior.

7. **Realism gap problem**
   The tests prove many happy-path intentions but do not fully model the user's real local-model pain.

This priority stack matters because it warns against a tempting but shallow diagnosis:
“just improve the prompts.”
The repo's problems are not prompt-only.
They are architectural, contractual, and experiential.

If the entire audit is compressed into a ranked problem stack, the order is roughly this:

1. **System coherence problem**
   The repo's docs, engine, policy, API, and UI do not yet speak with one voice.

2. **Workspace-truth problem**
   Snapshot context, bound workspace, and danger-mode expectations are easy to confuse and sometimes contradictory.

3. **Agent execution problem**
   The agent loop is too shallow, too bounded, and too protocol-fragile for the user's expectations.

4. **Visibility-quality problem**
   The UI shows many signals but not always the right story.

5. **Continuity problem**
   Session persistence is real, but deep working memory is weak.

6. **Capability integration problem**
   Some capabilities exist in lower layers without becoming trustworthy product-level behavior.

7. **Realism gap problem**
   The tests prove many happy-path intentions but do not fully model the user's real local-model pain.

This priority stack matters because it warns against a tempting but shallow diagnosis:
“just improve the prompts.”
The repo's problems are not prompt-only.
They are architectural, contractual, and experiential.

If the entire audit is compressed into a ranked problem stack, the order is roughly this:

1. **System coherence problem**
   The repo's docs, engine, policy, API, and UI do not yet speak with one voice.

2. **Workspace-truth problem**
   Snapshot context, bound workspace, and danger-mode expectations are easy to confuse and sometimes contradictory.

3. **Agent execution problem**
   The agent loop is too shallow, too bounded, and too protocol-fragile for the user's expectations.

4. **Visibility-quality problem**
   The UI shows many signals but not always the right story.

5. **Continuity problem**
   Session persistence is real, but deep working memory is weak.

6. **Capability integration problem**
   Some capabilities exist in lower layers without becoming trustworthy product-level behavior.

7. **Realism gap problem**
   The tests prove many happy-path intentions but do not fully model the user's real local-model pain.

This priority stack matters because it warns against a tempting but shallow diagnosis:
“just improve the prompts.”
The repo's problems are not prompt-only.
They are architectural, contractual, and experiential.

## Final audit conclusion

The Local-AI-Harness repository is **not** an empty or unserious project.
It is a substantial local-agent harness with real ambition and real infrastructure.

But it is currently in a dangerous middle state:
- too sophisticated to be judged as a toy,
- not yet coherent enough to feel dependable as a serious local coding operator.

The direct mode question is the easiest part:
yes, it is basically your everyday general-purpose path.

The hard part is the agentic mode.
That is where the repo's deepest contradictions are visible:
- strong low-level tools,
- weaker high-level exploitation of those tools,
- real safety policy,
- drifting documentation,
- real visibility events,
- weaker visibility storytelling,
- real sessions,
- weaker working memory,
- real model integration,
- weaker long-horizon execution feel.

The product therefore already contains the seeds of something useful,
but the current user pain is real, understandable, and well supported by the code.

If someone asked me for the single sentence summary of the whole audit, it would be this:

**The harness already has many of the parts required for a local Codex-like experience, but the parts do not yet converge into one trustworthy operator loop, and that convergence failure is exactly why the user experiences the system as unreliable, confused, or unfinished.**

The Local-AI-Harness repository is **not** an empty or unserious project.
It is a substantial local-agent harness with real ambition and real infrastructure.

But it is currently in a dangerous middle state:
- too sophisticated to be judged as a toy,
- not yet coherent enough to feel dependable as a serious local coding operator.

The direct mode question is the easiest part:
yes, it is basically your everyday general-purpose path.

The hard part is the agentic mode.
That is where the repo's deepest contradictions are visible:
- strong low-level tools,
- weaker high-level exploitation of those tools,
- real safety policy,
- drifting documentation,
- real visibility events,
- weaker visibility storytelling,
- real sessions,
- weaker working memory,
- real model integration,
- weaker long-horizon execution feel.

The product therefore already contains the seeds of something useful,
but the current user pain is real, understandable, and well supported by the code.

If someone asked me for the single sentence summary of the whole audit, it would be this:

**The harness already has many of the parts required for a local Codex-like experience, but the parts do not yet converge into one trustworthy operator loop, and that convergence failure is exactly why the user experiences the system as unreliable, confused, or unfinished.**

The Local-AI-Harness repository is **not** an empty or unserious project.
It is a substantial local-agent harness with real ambition and real infrastructure.

But it is currently in a dangerous middle state:
- too sophisticated to be judged as a toy,
- not yet coherent enough to feel dependable as a serious local coding operator.

The direct mode question is the easiest part:
yes, it is basically your everyday general-purpose path.

The hard part is the agentic mode.
That is where the repo's deepest contradictions are visible:
- strong low-level tools,
- weaker high-level exploitation of those tools,
- real safety policy,
- drifting documentation,
- real visibility events,
- weaker visibility storytelling,
- real sessions,
- weaker working memory,
- real model integration,
- weaker long-horizon execution feel.

The product therefore already contains the seeds of something useful,
but the current user pain is real, understandable, and well supported by the code.

If someone asked me for the single sentence summary of the whole audit, it would be this:

**The harness already has many of the parts required for a local Codex-like experience, but the parts do not yet converge into one trustworthy operator loop, and that convergence failure is exactly why the user experiences the system as unreliable, confused, or unfinished.**

The Local-AI-Harness repository is **not** an empty or unserious project.
It is a substantial local-agent harness with real ambition and real infrastructure.

But it is currently in a dangerous middle state:
- too sophisticated to be judged as a toy,
- not yet coherent enough to feel dependable as a serious local coding operator.

The direct mode question is the easiest part:
yes, it is basically your everyday general-purpose path.

The hard part is the agentic mode.
That is where the repo's deepest contradictions are visible:
- strong low-level tools,
- weaker high-level exploitation of those tools,
- real safety policy,
- drifting documentation,
- real visibility events,
- weaker visibility storytelling,
- real sessions,
- weaker working memory,
- real model integration,
- weaker long-horizon execution feel.

The product therefore already contains the seeds of something useful,
but the current user pain is real, understandable, and well supported by the code.

If someone asked me for the single sentence summary of the whole audit, it would be this:

**The harness already has many of the parts required for a local Codex-like experience, but the parts do not yet converge into one trustworthy operator loop, and that convergence failure is exactly why the user experiences the system as unreliable, confused, or unfinished.**

## Appendix A — Issue matrix through three lenses

### Appendix for P-001 — Danger mode is documented as broad access but implemented as workspace-bound only
#### Operator lens

From the operator's perspective, P-001 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-001, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-001 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-001 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-001 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-001 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-001 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-001 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-002 — Internet tooling exists in the runtime but is not integrated into the agent loop in a usable way
#### Operator lens

From the operator's perspective, P-002 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-002, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-002 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-002 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-002 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-002 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-002 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-002 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-003 — Direct mode is general-purpose chat, but its non-stream and stream paths are inconsistent
#### Operator lens

From the operator's perspective, P-003 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-003, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-003 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-003 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-003 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-003 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-003 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-003 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-004 — The planner is mostly a status tracker, not a deep planning memory system
#### Operator lens

From the operator's perspective, P-004 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-004, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-004 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-004 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-004 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-004 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-004 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-004 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-005 — Agentic mode has many early shortcut exits that bypass the richer execution loop
#### Operator lens

From the operator's perspective, P-005 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-005, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-005 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-005 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-005 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-005 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-005 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-005 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-006 — The agent loop is bounded by low loop caps that can choke iterative work
#### Operator lens

From the operator's perspective, P-006 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-006, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-006 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-006 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-006 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-006 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-006 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-006 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-007 — The manual fallback path is structurally brittle and easy for a small model to derail
#### Operator lens

From the operator's perspective, P-007 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-007, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-007 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-007 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-007 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-007 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-007 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-007 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-008 — The system detects simulated tool usage but still relies on the model to stop simulating
#### Operator lens

From the operator's perspective, P-008 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-008, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-008 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-008 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-008 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-008 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-008 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-008 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-009 — Browser folder context and backend workspace binding are conceptually split, which easily confuses the user
#### Operator lens

From the operator's perspective, P-009 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-009, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-009 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-009 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-009 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-009 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-009 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-009 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-010 — Workspace resolution is heuristic and can fail silently into snapshot-only behavior
#### Operator lens

From the operator's perspective, P-010 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-010, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-010 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-010 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-010 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-010 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-010 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-010 remains confirmed from code with inferred operational impact.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-011 — Changing workspace root resets important runtime state and can make memory feel broken
#### Operator lens

From the operator's perspective, P-011 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-011, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-011 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-011 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-011 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-011 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-011 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-011 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-012 — Skills loading is tied to the current workspace root in a way that can silently empty the skill catalog
#### Operator lens

From the operator's perspective, P-012 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-012, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-012 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-012 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-012 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-012 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-012 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-012 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-013 — Caveman is already disabled in the engine, but not necessarily removed from every surface
#### Operator lens

From the operator's perspective, P-013 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-013, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-013 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-013 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-013 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-013 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-013 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-013 remains partly confirmed, partly unresolved.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-014 — The tool-selection heuristics are regex-driven and therefore narrow and brittle
#### Operator lens

From the operator's perspective, P-014 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-014, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-014 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-014 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-014 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-014 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-014 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-014 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-015 — Automatic repo-context injection is disabled by default, weakening workspace understanding on harder tasks
#### Operator lens

From the operator's perspective, P-015 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-015, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-015 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-015 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-015 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-015 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-015 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-015 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-016 — The stream idle timeout appears configured but not actually enforced in the visible streaming path
#### Operator lens

From the operator's perspective, P-016 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-016, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-016 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-016 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-016 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-016 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-016 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-016 remains strong inference from inspected code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-017 — Model lifecycle policy encourages unloading after short inactivity, which can look like the model 'fell asleep'
#### Operator lens

From the operator's perspective, P-017 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-017, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-017 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-017 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-017 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-017 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-017 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-017 remains confirmed from code with inferred user-facing impact.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-018 — RunCommand is intentionally safe and narrow, which can be mistaken for broken shell access
#### Operator lens

From the operator's perspective, P-018 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-018, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-018 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-018 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-018 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-018 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-018 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-018 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-019 — The UI promises visibility, but the visible information is often compressed into counts and summaries rather than concrete change logs
#### Operator lens

From the operator's perspective, P-019 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-019, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-019 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-019 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-019 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-019 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-019 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-019 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-020 — The chat renderer contains an honesty fallback because the model often fails to return a real final narrative answer
#### Operator lens

From the operator's perspective, P-020 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-020, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-020 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-020 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-020 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-020 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-020 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-020 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-021 — Reasoning blocks can visually dominate the response and make the useful outcome feel too small
#### Operator lens

From the operator's perspective, P-021 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-021, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-021 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-021 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-021 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-021 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-021 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-021 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-022 — The API and docs claim an approvals queue button in the header, but the current UI surface differs
#### Operator lens

From the operator's perspective, P-022 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-022, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-022 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-022 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-022 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-022 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-022 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-022 remains confirmed from code and docs.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-023 — The test suite is extensive for mocked happy paths but weak against real local-model failure modes
#### Operator lens

From the operator's perspective, P-023 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-023, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-023 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-023 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-023 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-023 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-023 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-023 remains confirmed with reasonable inference.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-024 — The tests encode optimistic expectations that can mask operator pain
#### Operator lens

From the operator's perspective, P-024 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-024, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-024 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-024 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-024 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-024 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-024 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-024 remains confirmed from tests.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-025 — The repository contains strong support for native Ollama chat, but the overall architecture still assumes fragile capability detection
#### Operator lens

From the operator's perspective, P-025 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-025, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-025 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-025 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-025 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-025 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-025 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-025 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-026 — The engine advertises workspace safety and visibility, but the actual source of truth changes depending on context
#### Operator lens

From the operator's perspective, P-026 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-026, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-026 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-026 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-026 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-026 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-026 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-026 remains confirmed from docs and code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-027 — The system is built for local-first CPU use, but several pieces still prioritize scaffolding and guardrails over raw task throughput
#### Operator lens

From the operator's perspective, P-027 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-027, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-027 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-027 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-027 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-027 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-027 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-027 remains inference strongly grounded in architecture.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-028 — The repo indexer strategy is intentionally lightweight and therefore may under-serve harder repository understanding tasks
#### Operator lens

From the operator's perspective, P-028 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-028, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-028 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-028 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-028 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-028 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-028 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-028 remains confirmed with inference.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-029 — The frontend config model is already drifting from backend config fields
#### Operator lens

From the operator's perspective, P-029 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-029, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-029 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-029 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-029 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-029 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-029 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-029 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-030 — The harness already anticipates planning-only and simulation failures, which means those failures are normal enough to shape the architecture
#### Operator lens

From the operator's perspective, P-030 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-030, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-030 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-030 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-030 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-030 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-030 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-030 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-031 — Direct mode does look intentionally general-purpose, but it is not intended to be a coding agent
#### Operator lens

From the operator's perspective, P-031 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-031, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-031 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-031 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-031 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-031 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-031 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-031 remains confirmed from code and docs.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-032 — The model adapter tunes Gemma and other families, but effective context use still depends on orchestration quality rather than nominal context length
#### Operator lens

From the operator's perspective, P-032 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-032, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-032 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-032 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-032 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-032 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-032 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-032 remains grounded inference.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-033 — The current UI does surface run steps and tool cards, but the information density and structure may still feel wrong to a human operator
#### Operator lens

From the operator's perspective, P-033 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-033, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-033 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-033 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-033 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-033 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-033 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-033 remains confirmed from code with human-UX inference.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-034 — The activity tab exposes only trace headers, not the rich trace payloads needed for real diagnosis
#### Operator lens

From the operator's perspective, P-034 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-034, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-034 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-034 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-034 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-034 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-034 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-034 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-035 — The tool registry is stronger than the agent's effective ability to exploit it
#### Operator lens

From the operator's perspective, P-035 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-035, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-035 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-035 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-035 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-035 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-035 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-035 remains confirmed with architectural interpretation.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

### Appendix for P-036 — The product already contains explicit logic for snapshot-only refusal, which means some user requests are intentionally non-executable until binding succeeds
#### Operator lens

From the operator's perspective, P-036 is experienced less as an abstract implementation quirk and more as a question of trust.
The user is trying to build a mental model of the assistant. Every time the assistant behaves in a way that collides with that model,
the operator has to spend cognitive effort re-learning what the harness really is. In a tool meant to save effort, that re-learning tax is a major cost.

With P-036, the operator is likely to interpret the behavior emotionally before they interpret it technically.
They may call it lazy, stuck, dumb, inconsistent, bureaucratic, or fake. Those labels are not precise engineering diagnoses,
but they are meaningful user-experience signals. They tell us that the system is not making its contract legible enough at the moment of use.

A strong product would make the state transition around this issue obvious.
A weaker product leaves the user guessing, and guessing is exactly what local-agent users hate because it forces them into supervisory labor.
#### Architecture lens

Architecturally, P-036 matters because it reveals where this repository is still a federation of good subsystems rather than one converged product.
The packages are not trivial. There is real thought here. But a product can still fail if the subsystems do not coordinate around one stable operating truth.

In systems terms, P-036 is not just a point defect. It is a coupling problem.
It interacts with policy, mode routing, UI framing, prompt construction, session state, and the operator's expectations.
That means its blast radius is larger than the local file that first reveals it.

This is why audits of agentic products have to care about seams.
Classical app bugs often live inside one component.
Agentic-product bugs often live at the seam between components, because the seam is where the illusion of intelligence becomes a real user workflow.
#### Product lens

From the product lens, P-036 tells us something about maturity stage.
This is what a serious early harness looks like before convergence:
many sensible mechanisms,
many explicit safeguards,
many honest traces of encountered failure modes,
and a user experience that is not yet polished enough to turn those mechanisms into confidence.

The hardest part of a local coding harness is not adding another package.
It is shrinking the gap between:
- what the team believes the product does,
- what the code really does,
- what the UI visibly communicates,
- and what the user believes just happened.

P-036 sits directly in that gap, which is why it matters more than its local code footprint might suggest.
#### Why this issue compounds other issues

Compound effects are a recurring theme in this repo.
P-036 does not operate in isolation.
It usually compounds at least three other categories of weakness:
- ambiguity about workspace truth,
- ambiguity about whether the model actually acted,
- ambiguity about whether the final explanation is complete.

In a stable product, one ambiguity is often survivable.
In a developing local agent, several ambiguities stack and produce a much stronger negative impression.
That is why the user's complaints sound global rather than narrow.
The experience of the harness is governed by interaction effects.
#### Audit note

My confidence on P-036 remains confirmed from code.
Where the issue is code-confirmed, the remaining uncertainty is usually about degree, not existence.
Where the issue includes inference, the inference is still tightly tied to inspected architecture rather than guesswork.

## Appendix B — Slow-motion workflow breakdowns

### Workflow case W-01
Open folder -> fail to bind -> browser snapshot only -> user asks for edit -> agent explains binding boundary -> user perceives refusal.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-02
Ask for code review with vague phrasing -> heuristics under-select tools -> model stays conversational -> user perceives lack of planning.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-03
Agent enters native tool path -> model emits planning-only text -> retry prompt added -> loop budget consumed -> user sees delay and little output.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-04
Manual fallback activates -> model emits almost-correct JSON -> correction prompt issued -> tool action delayed -> trust drops.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-05
Write action selected -> approval required -> approval surface visible but not as concrete as expected -> user perceives blockage.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-06
Tool work completes -> final narrative weak or absent -> UI honesty fallback fires -> operator sees machinery without satisfying explanation.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-07
Workspace root changed -> sessions and skills shift with workspace-relative paths -> user experiences memory or capability disappearance.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

### Workflow case W-08
Model unloaded after short keep_alive window -> RAM drops -> next work feels cold or sleepy -> operator blames agent intelligence.


This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

This workflow case is useful because it illustrates how a reasonable implementation can still produce an unreasonable human impression.
The code is often behaving according to its own internal rules.
The user, however, is judging the system according to a much simpler rule:
“Did my assistant understand the workspace, use the right tools, make progress, and explain itself clearly?”

Every time the answer to that simple rule is “not obviously,” the harness loses ground.
That is why these workflow cases matter more than isolated helper-function details.
They are the lived route from architecture to frustration.

## Appendix C — Repeated summary of the most important confirmed facts

### Confirmed fact
Danger mode does not actually allow outside-workspace access in the inspected policy code.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
Caveman is disabled at runtime skill activation level.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
Direct mode is general-purpose and bypasses the coding-tool loop.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
Direct stream and direct non-stream are not implemented through the same path.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
Internet tooling exists in the tool runtime.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
Internet tooling is not fully wired into the agent orchestration path.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
The planner is lightweight and presentational rather than a strong long-horizon memory substrate.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
Session persistence is shallow relative to the user's Codex-like expectations.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
The UI has explicit honesty fallback logic when no final narrative answer is produced.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
The UI displays run summaries and run steps but still compresses important change detail.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
The workspace model distinguishes backend-bound workspace from browser snapshot context.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

### Confirmed fact
The test suite is rich but heavily mocked.


I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

I am repeating these facts intentionally because they are the anchor points of the audit.
In a very large report, the risk is that the central diagnosis gets lost in the detail.
These facts are the stable spine of the whole analysis.
Everything else in the report either elaborates them, contextualizes them, or explores their consequences.

## Appendix D — What makes the repo feel 'almost there' instead of 'already there'

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

This repository feels “almost there” because it already contains many signs of a second-generation local-agent design rather than a first-generation toy.
It has:
- explicit workspace policy,
- approvals,
- native Ollama chat support,
- model lifecycle control,
- structured run summaries,
- a trace bus,
- session persistence,
- browser snapshot fallback,
- repo indexing,
- tests for native vs manual tool paths,
- and multiple UI surfaces for status.

A repo with none of that would simply be incomplete.
This repo is more frustrating because it is **partially mature**.
Partial maturity is the hardest maturity stage for users because the product constantly hints at a more reliable future version of itself.

The operator can feel that future version in the current codebase.
They can see why the idea should work.
That makes current weakness more aggravating, not less.
The user is not reacting to a weak idea.
The user is reacting to the friction between a strong idea and an unconverged implementation.

## Appendix E — Risk register by product surface

### Workspace surface
- Visible folder tree may not equal executable backend workspace.
- Danger mode operator expectation conflicts with actual confinement policy.
- Workspace rebinding can reset sessions and indirectly alter skill availability.
- Resolution from browser folder to host path is heuristic.


The workspace surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the workspace surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The workspace surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the workspace surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The workspace surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the workspace surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The workspace surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the workspace surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

### Tool surface
- Low-level tools are stronger than high-level orchestration exploitability.
- Web tools exist but are effectively dead at the agent-routing layer.
- Shell support is intentionally narrow and can feel nonfunctional for dev workflows.
- Approval gating is correct but contributes to perceived friction when surfaced weakly.


The tool surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the tool surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The tool surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the tool surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The tool surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the tool surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The tool surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the tool surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

### Model surface
- Native tools and manual fallback create mode complexity.
- Loop caps are low for a small local model doing coding work.
- Planning-only and simulated-tool failure modes are common enough to have dedicated recovery logic.
- Short keep_alive windows can resemble model sleep.


The model surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the model surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The model surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the model surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The model surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the model surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The model surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the model surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

### UI surface
- Run summary favors counts over a concrete change ledger.
- Trace activity view is shallow by default.
- Reasoning blocks can overshadow actionable conclusions.
- There is an honesty fallback because missing final narratives are a normal enough failure mode.


The ui surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the ui surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The ui surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the ui surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The ui surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the ui surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The ui surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the ui surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

### Session surface
- Persisted state is metadata-rich enough for bookkeeping but not cognition-rich enough for strong agent memory.
- Workspace-relative session data makes continuity brittle across rebinding.
- Direct and agentic paths record different kinds of useful context.
- Long-running tasks may not feel like one continuous mind at work.


The session surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the session surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The session surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the session surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The session surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the session surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The session surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the session surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

### Documentation surface
- Docs and runtime disagree on danger mode.
- Docs and UI disagree on approvals location.
- The visible promises of the product are therefore harder to trust.
- Support burden rises because operator instructions can age into half-truths.


The documentation surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the documentation surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The documentation surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the documentation surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The documentation surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the documentation surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

The documentation surface is important because it is one of the places where the operator builds a mental contract with the harness.
A local coding assistant is not judged only by raw intelligence. It is judged by whether each product surface reinforces a single believable story.

In the current repo, the documentation surface still carries too much explanatory burden.
The user has to infer invisible distinctions, remember mode boundaries, and decode whether the current turn is operating on a bound workspace,
a browser snapshot, a shortcut responder, a native tool path, or a manual fallback path.

That is why risk at this surface is not merely local. It interacts with every other surface.
The more surfaces carry explanatory burden at once, the more the operator feels like the harness needs supervision.

## Appendix F — Extended reflection on why local-first agent products are hard

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

A cloud product can hide a lot of complexity behind stable infrastructure.
A local-first product has to expose much more of its own machinery.

This repository is a case study in that reality.
Because it is local-first, it must care about:
- real filesystem boundaries,
- model lifecycle control,
- CPU and RAM constraints,
- path resolution,
- approvals that feel safe even on a personal machine,
- shells that do not become arbitrary exploit surfaces,
- multi-model capability drift,
- and UI honesty about what actually happened.

Those are not optional concerns.
They are the price of the local-first promise.

The consequence is that a local-first coding harness often accumulates more “visible seams” than a cloud service.
Seams are not automatically bad.
In fact, many seams in this repo are signs of serious engineering caution.
The problem is when too many seams become part of the user's normal path.

At that point the product no longer feels like one assistant.
It feels like an assistant plus a policy engine plus a visibility dashboard plus a model adapter plus a workspace mapper plus a fallback protocol.
All of those pieces are sensible. But the user only wanted one trustworthy worker.

That tension is everywhere in this audit.
It is why so many findings are not simple bugs.
They are product-identity problems born from legitimate local-first constraints.

## Appendix G — Reframing the repo's current maturity stage

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

The most charitable and honest way to describe this repository is:
**advanced prototype approaching productization, but not yet behaviorally coherent enough for operator trust at the promised level.**

Why “advanced prototype”?
Because the project already has:
- real packaging,
- real policy,
- real approvals,
- real model integration,
- real UI event streaming,
- real tests,
- and real thought about safety and observability.

Why “not yet behaviorally coherent enough”?
Because the user can still easily fall into states where:
- visible folder is not executable truth,
- docs do not match runtime behavior,
- tool capability exists but is not actually used,
- steps are visible but still not satisfying,
- and a missing final explanation has to be replaced by an honesty fallback.

That gap is exactly what separates an advanced prototype from a mature operator product.

The wrong read would be to call the project fake.
It is not fake.
The more accurate read is that it is carrying too many transitional layers in public.
The user is not interacting with a clean final abstraction yet; they are interacting with several partially converged abstractions at once.

## Appendix H — Repeated concise verdicts

### Verdict
The direct mode question is basically settled: yes, it is the general-purpose mode.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The agentic-mode pain is real and code-supported.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The biggest architectural problem is coherence, not package count.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The biggest trust problem is workspace truth and contract drift.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The biggest execution problem is brittle orchestration around a small local model.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The biggest UI problem is visibility quality rather than total absence of visibility.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The biggest memory problem is shallow continuity relative to the user's expectations.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

### Verdict
The biggest hidden capability problem is internet tooling that exists low in the stack without becoming a real product behavior.


This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.

This verdict is intentionally terse.
In a large audit, repetition is useful when it preserves the spine of the conclusion.
If the report is reduced to a handful of memorable ideas, this is the cluster I would preserve.