# Product

## Register

product

## Users

Local developers using a CPU-first Linux workstation to inspect, plan, edit, verify, and review code with a local model. They need clear separation between ordinary model conversation and repo-affecting agent work.

## Product Purpose

Gemma 4 Harness is a localhost coding harness for Gemma 4 E4B and other OpenAI-compatible local runtimes. Success means users can choose Chat for safe conversation, choose Agent for workspace-bound coding work, see tool/run state clearly, and trust that mode boundaries prevent accidental repo access.

## Brand Personality

Precise, local-first, operational. The interface should feel like a dependable developer tool, not a marketing page or novelty AI chat surface.

## Anti-references

Avoid mixed chat-agent dashboards, hidden tool access from normal chat, fake success states, decorative SaaS hero layouts, oversized cards, weak gray text, and controls that obscure current mode or workspace safety.

## Design Principles

- Mode first: users choose Chat or Agent before seeing advanced controls.
- Safety visible: workspace, policy, tools, approvals, diffs, and checks stay explicit in Agent Mode.
- Chat stays clean: no repo controls, no workspace context, no approval or diff surfaces.
- Preserve local truth: report degraded runtime, failed checks, and unbound workspace state honestly.
- Dense when needed: operational panels may be compact, but labels and states must stay readable.
- Minimal by default: show only the next useful action and current truth; move raw internals into details.
- Settings as interruption: settings open as a centered modal and never squeeze task layouts.
- Status ledger: Agent Mode keeps runtime, model, workspace, write access, and current goal visible as a compact operational rail.

## Accessibility & Inclusion

Target WCAG AA contrast for text and controls. Preserve keyboard access, visible focus states, readable markdown/math, and reduced-motion behavior for transitions.

## Stage 4 UI Brief

This stage is design-only. It must not change planner, runtime routing, tool policy, API safety, or execution semantics.

Design target:

- Landing: calm mode selection, no internal controls.
- Chat: reading-first conversation, narrow message measure, large readable markdown and math, no agent clutter.
- Agent: repo work surface with clear status, task composer, current goal, tool/check visibility, and collapsed advanced logs.
- Settings: modal overlay with grouped sections, Escape close, outside click close, no main-layout shift.

The visual system stays dark, restrained, local-first, and operational. Accent color marks current selection and primary action only.
