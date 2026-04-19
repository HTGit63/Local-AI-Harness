# AGENTS.md - Gamma 4 Harness Active Contract

> Status date: `2026-04-19`
> Scope: only live hard rails and current work.
> Old repeated 20-stage contract is retired.

## Mission

Gamma 4 Harness must behave like a real local coding harness.

- `Direct mode` is everyday assistant mode for broad user help.
- `Agentic mode` is coding mode for repo inspection, file edits, shell commands, approvals, and verification.
- Local model must act on workspace truth instead of stalling in planning text.
- Workspace boundary must stay real even in `danger` mode.

## Hard Rails

### Workspace truth

- Backend workspace root is source of truth.
- Browser folder snapshot is secondary context only.
- File reads, writes, deletes, directory creation, and command path targets must stay inside workspace root.
- `danger` mode removes approval friction, not workspace boundary.
- Agent must always know current workspace root and surface it in UI and CLI.

### Agentic behavior

- Coding-shaped requests in agentic mode must inspect workspace before asking user for more detail when tools are already available.
- Never claim file changes, commands, or approvals that did not happen.
- Never treat planning text as completion.
- Prefer native Ollama tool calling first.
- If native tools fail, manual fallback must be explicit and visible.
- Real progress must come from trace, tool, approval, and run-step events only.

### Mode split

- `Direct mode`: general user help, low overhead, tool use only when clearly needed.
- `Agentic mode`: coding-first, repo-aware, tool-driven, verification-focused.
- Direct and agentic must not share hidden behavior that confuses the user.
- Safety copy and approval copy must stay normal, exact, and uncompressed.

### Skills

- Harness must not auto-enable `caveman`.
- Disabled skills must not survive through session defaults, resume, or manual activation.
- Skill state must be explicit, optional, and never weaken execution quality.

### Visibility

- Web and CLI must show real run steps, current tool, approvals, and final run summary.
- If approval pauses execution, surface that immediately in-stream.
- If model returns thinking, show it separately from answer.
- If model stalls or runtime dies, surface that as runtime failure, not silent hang.

## Current Audit Findings

### Fixed in this pass

1. Workspace escape existed in `danger` mode because policy allowed any target path.
2. Command tool could bypass workspace boundary because command arguments were not checked for outside-workspace paths.
3. Harness still wired `caveman` into default UI skill state and prompt handling.
4. Generic agentic repo-diagnostic turns could start with zero forced inspection, making the model drift into talk-only replies.

### Still open after this pass

1. Harness has no first-class internet research tool yet.
2. Long-running model stall detection and recovery is still weak.
3. Direct-vs-agentic intent/routing still needs broader regression coverage for ambiguous prompts.

## Active Tasks

### P0 - must hold now

1. Workspace boundary hard lock
   Acceptance:
   all file tools denied outside workspace;
   command path escape denied outside workspace;
   `danger` still bound to workspace.

2. Remove caveman from harness runtime
   Acceptance:
   no default caveman skill in web;
   disabled on session create/resume/update;
   no agentic badge or prompt guardrail tied to caveman.

3. Agentic first inspection
   Acceptance:
   coding and repo-diagnostic turns bootstrap with workspace facts;
   agent does not stop at plan-only text when tools are available.

4. Approval continuity
   Acceptance:
   approval pending, update, and resolved events stream to UI;
   run visibly pauses and resumes on real approval.

### P1 - next implementation

5. Internet access for agentic runs
   Goal:
   add first-class read-only web fetch/search capability instead of relying on shell hacks.
   Acceptance:
   explicit tool;
   clear source attribution;
   bounded timeout and payload size;
   disabled by config if needed.

6. Stall watchdog and model-liveness recovery
   Goal:
   stop zombie runs where shell stays open but model work is dead.
   Acceptance:
   heartbeat or idle timeout for streamed runs;
   clear stalled status in UI and CLI;
   cancel or retry path with reason;
   optional model re-warm hook when Ollama drops out.

7. Direct vs agentic contract tightening
   Goal:
   everyday help stays in direct mode;
   software-building tasks behave agentically without coaxing.
   Acceptance:
   ambiguous coding prompts route to repo inspection in agentic mode;
   direct mode avoids planner/tool drag for normal conversation;
   tests cover both sides.

## Verification Gate

Before closing any major harness task, run as much of this gate as environment allows:

- `npm run build`
- `node --import tsx tests/unit/core.test.ts`
- `node --import tsx tests/integration/workflow.test.ts`
- `node --import tsx tests/e2e/api.test.ts`

If host/runtime limits block a check, record exact blocker instead of pretending pass.

## Operator Notes

- Give users `localhost` or `127.0.0.1`, never `0.0.0.0`, for browser access.
- Do not reset dirty trees to feel safe.
- Verify runtime behavior from code, tests, and actual events.
- Keep this file short. When work is done, replace tasks instead of appending endless history.
