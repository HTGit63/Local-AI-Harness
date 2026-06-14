# Observability

The harness writes durable run logs for Chat and Agent runs.

## Paths

- JSONL events: `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.jsonl`
- Summary: `.gamma-harness/logs/<yyyy-mm-dd>/<run-id>.summary.json`

Agent runs also keep checkpoints in `.gamma-harness/runs` and adaptive plan artifacts in `.gamma-harness/plans`.

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

## Redaction

Durable log writes and reads redact common secret patterns, authorization headers, API keys, JWT-like values, and private key blocks. Secret-like object keys such as `token`, `authorization`, `password`, and `secret` are replaced with `[REDACTED_SECRET]`.

Log write failure is non-fatal. The run continues even if the filesystem cannot accept a log write.
