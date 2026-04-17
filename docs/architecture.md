# Architecture

## Overview
This document defines the core architecture for the local coding harness. The system is designed to be lightweight, offline-capable, and optimized for running on local CPU inference with limited RAM (e.g., 16 GB), prioritizing operator visibility without exposing internal reasoning clutter.

## Core Decisions

### Model & Transport
- **Local Model Server**: Ollama
- **Default Model**: `gemma4:e4b`
- **Primary Transport**: Ollama native chat API (`/api/chat`) for local thinking visibility and reliable `think` control
- **Compatibility Transports**: OpenAI-compatible API (`/v1`) and Anthropic-compatible API (`/v1/messages`) for external tool ecosystems and future provider adapters

### Runtime Composition
The application runtime is broken down into modular packages:
- **Core Engine**: Orchestrates execution, memory, and task flow.
- **Planner**: Manages task phases, plan states, reasoning summaries, and logical progression.
- **Tool Runtime**: Executes bounded local operations securely inside the workspace.
- **Skill Manager**: Ingests, parses, and provides curated skill prompts and behaviors.
- **UI Event Bus**: Provides low-latency event streams indicating state changes and tool usage to connected surfaces.
- **Session Storage**: Manages conversation history, metadata, and active state.
- **Workspace Policy**: Enforces safety, read/write permissions, and boundaries around file operations.

### Surfaces
- **CLI**: Real terminal harness for fast programmatic, scripting, and pure-text interactions.
- **Web UI**: Primary localhost frontend exposing comprehensive control over tasks, approvals, and diff reviews.

### Visibility & Tracing (Hard Rule)
> **Constraint**: Do **not** fabricate or infer hidden reasoning. Only surface model-emitted thinking when the provider returns it explicitly.

The UI Event Bus and all surfaces must build their display logic around structured, concise operational visibility:
- Current overall plan
- Active phase
- Tool name being executed
- Tool input summary
- Tool output summary
- File diffs representing proposed state changes
- Concise rationale blocks (why is the agent doing this?)
- Model-emitted `thinking` or `<think>...</think>` blocks in a visually separate channel

### Agentic Coding Compatibility
- **Gemma 4 / Qwen 3.5**: Prefer native Ollama chat for non-tool turns so the harness can preserve `thinking` output and explicitly suppress or reduce thinking on simple inspect requests.
- **Tool strategy**: Small local reasoning models should default to deterministic local shortcuts for trivial workspace questions, native Ollama tool calling first, and stepwise/manual tool protocol only when native tool calling is flaky or unsupported.
- **Workspace truth**: The sidebar and CLI must reflect the same backend workspace root the tools use; browser-only folder attachments are secondary context, not the source of truth.
- **Surface parity**: CLI and Web must share the same session phases, thinking presentation, workspace root, model runtime status, and approval workflow language so the harness feels consistent across both surfaces.
- **Mode split**: Direct chat and agentic coding are separate runtime paths; caveman overlay stays agentic-only and must not change approval or safety copy.

### Storage
- **Session Storage Engine**: Local file-based JSON/text formats or a local SQLite database suitable for persistent session history, configuration parameters, and metadata storage.

### Extension Paths
The system must be built with clear extension paths to prevent technical debt:
- **Antigravity Exporter**: Architecture must yield to exporting custom workflows and skills into Antigravity packages.
- **IDE Extensions**: Provide clear IPC or port logic to enable future VS Code / editor integrations.
- **Standalone App Packaging**: Core logic decoupling allowing for future GUI bundling via Tauri or Electron for consumer installation.
