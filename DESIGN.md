# Design

## Stage 4 Direction

Gemma 4 Harness is a local developer tool used while reading code, asking the model questions, and letting an agent work in a bounded repo. The UI should feel like a quiet workbench: dark, compact, honest, and readable for long sessions.

Physical scene: a developer has terminal, editor, and browser open on one workstation at night. The harness sits beside the editor, so it must reduce cognitive load and show only operational truth.

## Current UI Audit

Existing surfaces:

- Landing: clear Chat and Agent choice exists, but visual language is generic and lacks runtime/workbench identity.
- Chat: mode is isolated and mostly clean, but safety strip and composer pills repeat "workspace none" and "tools off", adding noise.
- Agent: preserves workspace and run behavior, but topbar has too many badges, command-center cards are hidden by CSS, and the user sees many small controls before the next action.
- Settings: still implemented as a side drawer inside `.main-layout.settings-open`, which widens the grid and violates Stage 4.
- Runtime status: visible in topbar and settings, but the active/primary/fallback distinction needs clearer hierarchy.
- Markdown/math: markdown renderer works, but Chat-specific math sizing and note spacing need stronger CSS.
- Major clutter sources: repeated badges, side settings drawer, large settings status lists, raw output/diff/log sections, tool controls competing with task composer.

## Product Workflow

```
Landing
  choose Chat or Agent

Chat
  read history
  ask question
  attach image when needed
  read markdown/math answer
  switch mode only from topbar

Agent
  confirm workspace
  see runtime/model/write access/current goal
  enter task
  follow current goal and run console
  approve only when required
  open details only when debugging

Settings
  open modal
  change runtime/workspace/agent settings
  close without layout shift
```

## Token System

Color strategy: restrained product dark, with blue only for active selection and primary action. Warnings stay amber, success green, failures red.

- Ink: `#050505`
- Panel: `#090909`
- Raised: `#121212`
- Border: `rgba(255,255,255,0.08)`
- Text: `#f4f4f4`
- Muted text: `#a8a8a8`
- Accent: `#2f9bff`
- Warning: `#ffbd2e`
- Success: `#3ddc84`
- Danger: `#ff5f57`

Typography: system sans for all UI roles, monospace only for paths, commands, diffs, and code. Fixed product scale, no fluid display type.

Spacing: 4/8/12/16/20/24/32 px. Cards max radius 12px, panels 0-8px unless modal.

Signature element: status ledger. Agent Mode uses compact truth chips for mode, runtime, workspace, write access, and current goal; this is the primary recognition pattern.

## Wireframes

Landing:

```text
G4 Harness
Choose work surface

Chat     Agent
```

Chat:

```text
Chat | Runtime | Model                          Settings | Agent
History | centered messages
        | composer
```

Agent:

```text
Agent | runtime | workspace | write | goal      Settings
Workspace nav | task + messages       | run console/status
```

Settings:

```text
dim backdrop
  centered modal
  tabs: Runtime Workspace Agent Sessions Activity
  grouped settings
```

## Stage 4 Goal Plan

1. Audit UI and create design map.
2. Redesign shell, landing, and settings modal.
3. Redesign Chat for clean conversation and readable markdown/math.
4. Redesign Agent for operational clarity and compact status.
5. Polish responsive behavior, validate in browser, run build/lint/tests, commit.

## Guardrails

- No backend behavior changes.
- No planner changes.
- No runtime routing changes.
- Chat never shows workspace, diff, approvals, or tool controls.
- Full diffs, raw traces, long logs, and JSON snapshots stay collapsed.
- Settings never changes main layout width.
