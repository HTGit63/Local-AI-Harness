# e2b Agent Smoke Timeout Report

Date: 2026-05-07

## Scope

- Harness repo: `/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/Gemma 4 Harness`
- Playground workspace: `/mnt/01DBAB8A7D80C830/Users/hunde/Documents/WebDEV/web.dev.projects/art-gallery`
- Model requested for live smoke: `gemma4:e2b`

## What Worked

- `ollama list` showed `gemma4:e2b` installed.
- Direct CLI Chat Mode with `gemma4:e2b` returned the expected exact response: `E2B_OK`.
- `gamma agent status --json` in `art-gallery` returned `IDLE` and pointed at the expected `.gamma-harness/agent_state.md` path.
- API health responded at `http://127.0.0.1:3107/api/health` with status `ok` and model `gemma4:e2b`.
- Web dev server responded with HTTP 200 at `http://127.0.0.1:5175/`.
- Read-only Agent dashboard endpoint responded at `http://127.0.0.1:3107/api/agent/dashboard`.

## What Did Not Respond

This command did not produce output after more than 3 minutes and was stopped:

```bash
env HARNESS_MODEL=gemma4:e2b \
  HARNESS_FAST_MODEL=gemma4:e2b \
  HARNESS_CODING_MODEL=gemma4:e2b \
  HARNESS_REVIEW_MODEL=gemma4:e2b \
  HARNESS_AGENT_MODEL=gemma4:e2b \
  HARNESS_SUMMARY_MODEL=gemma4:e2b \
  HARNESS_LOCAL_MODEL_BUDGET_PROFILE=lean \
  HARNESS_CONTEXT_BUDGET=12000 \
  HARNESS_AGENT_KEEP_ALIVE=0 \
  HARNESS_AGENT_PROTOCOL=action_dsl \
  node apps/cli/dist/cli.js agent-smoke \
    --task "Read package.json and report the package name only" \
    --require-action read_file \
    --json
```

## Likely Cause

The app/API/web runtime was responsive. The non-response was isolated to the live `agent-smoke` Action DSL path with `gemma4:e2b` on CPU. Most likely causes:

- `gemma4:e2b` took too long to produce the structured Action DSL response on CPU.
- The smoke command currently has no short, user-visible timeout for this live model path.
- The command gives no progress output while waiting for the model response, so it appears stuck.

## Current Status

- App health: responding.
- Web UI: responding.
- Direct e2b chat: responding.
- Deterministic Agent status: responding.
- e2b Action DSL smoke: timed out manually after no output.

## Recommended Follow-up

- Add a bounded timeout and progress output to `agent-smoke` model calls.
- Keep `gemma4:e2b` as lightweight direct chat/default smoke model.
- Treat e2b Action DSL success as unproven until a timeout-safe smoke passes.
