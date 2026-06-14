# Observability

The harness writes durable run logs for Chat and Agent runs.

## Paths

- JSONL events: `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.jsonl`
- Summary: `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.summary.json`

Agent runs also keep checkpoints in `.gamma-harness/runs` and adaptive plan artifacts in `.gamma-harness/plans`.

## JSONL Event Shape

Each line is one redacted event:

```ts
{
  timestamp: number;
  isoTime: string;
  runId?: string;
  sessionId?: string;
  requestId?: string;
  stepId?: string;
  goalId?: string;
  eventType: string;
  source: "api" | "core" | "model-adapter" | "tool-runtime" | "planner" | "web";
  level: "debug" | "info" | "warn" | "error";
  data: Record<string, unknown>;
}
```

Typical Agent logs include:

- `request_received`
- `runtime_selected`
- `intent_classified`
- `workspace_doc_inventory`
- `agent_skill_selection`
- `workspace_context_collected`
- `adaptive_plan_requested`
- `adaptive_plan_validated`
- `task_plan_created`
- `current_goal_selected`
- `tool_call_started`
- `tool_call_completed`
- `verification_started`
- `verification_completed`
- `model_request`
- `model_response`

## Prompt Logging

`HARNESS_LOG_PROMPTS` controls prompt capture:

- `off`: prompt/message fields are replaced with `[PROMPT_LOGGING_OFF]`
- `summary`: prompt/message fields are summarized and redacted
- `full`: prompt/message fields are written after redaction and size bounding

Default: `summary`.

## API

- `GET /api/logs/runs`
- `GET /api/logs/runs/:runId`
- `GET /api/logs/runs/:runId/summary`

Run ids are validated before filesystem lookup. Traversal-style ids are rejected.

Agent Mode shows recent runs in the Run Logs panel. Open a row to view the
redacted JSON response. The filesystem path in the row title points to the raw
JSONL file.

## Redaction

Durable log writes and reads redact common secret patterns, authorization headers, API keys, JWT-like values, and private key blocks. Secret-like object keys such as `token`, `authorization`, `password`, and `secret` are replaced with `[REDACTED_SECRET]`.

Log write failure is non-fatal. The run continues even if the filesystem cannot accept a log write.

## What To Send For Debugging

Send both files for the affected run:

- `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.jsonl`
- `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.summary.json`

Use `HARNESS_LOG_PROMPTS=summary` for normal debugging. Use `full` only when
prompt content is necessary and safe to share after redaction.
