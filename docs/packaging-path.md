# Packaging Path — Web-to-Standalone

## Current Architecture (v1): Localhost Web Mode

The harness runs as two processes on the developer's machine:

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  apps/web    │◄─────►│  apps/api    │◄─────►│  Ollama      │
│  (Vite dev)  │       │  localhost:  │       │  localhost:  │
│  localhost:  │       │  3001        │       │  11434       │
│  5173        │       └──────────────┘       └──────────────┘
└──────────────┘
       ▲
       │ same machine
       ▼
┌──────────────┐
│  apps/cli    │
│  (Node.js)   │
└──────────────┘
```

All data stays local. No cloud services required.

---

## Future: Desktop Bundle Mode

The architecture is intentionally designed to be packaging-friendly for Tauri or Electron.

### Why this works today

| Concern | Current state | Packaging-ready? |
|---|---|---|
| Web UI | Vite React SPA, no SSR | ✅ Trivially wrappable |
| API calls | Web UI targets the local `apps/api` process on `localhost:3001` | ✅ No cloud dependency and easy to wrap |
| Storage | File-based JSON in workspace | ✅ Portable, no external DB |
| Config paths | Relative to `cwd` or `$HOME` | ✅ Works in sandboxed apps |
| Model server | Ollama as separate process | ⚠️ Must be bundled or required as prerequisite |

### Tauri path (recommended)

1. Build `apps/web` as static assets: `npm run build`
2. Create a Tauri project pointing to `dist/`
3. Tauri's Rust backend can optionally manage the Ollama lifecycle
4. All `packages/*` compile to standard JS — no native addons needed

### Electron path (alternative)

1. Same static build approach
2. Electron's `main.js` spawns the local API server
3. Renderer loads the Vite output

### What to avoid

- ❌ Do not add SSR or server-side rendering — breaks packaging
- ❌ Do not add native Node.js addons — breaks Tauri compatibility
- ❌ Do not hardcode absolute paths — use `path.resolve` and env vars
- ❌ Do not add external network dependencies — breaks offline guarantee

---

## Config Path Strategy

All configuration follows this resolution order:

1. `$HARNESS_CONFIG_DIR` environment variable (if set)
2. `$HOME/.gamma-harness/` (default)
3. `./.gamma-harness/` in workspace root (project-local override)

This ensures portability across bare localhost, Tauri sandbox, and Electron `userData` directories.
