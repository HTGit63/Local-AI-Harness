# Real Model Testing

Mock tests prove deterministic harness behavior. Real-model smoke proves local
runtime plumbing, streaming, planning traces, tool execution, durable logs, and
safe temp-workspace edits against an actual model.

Normal `npm test` does not require Ollama.

## Command

```bash
HARNESS_REAL_MODEL_TESTS=1 \
HARNESS_RUNTIME_PROVIDER=ollama-legacy \
HARNESS_MODEL=nemotron-3-nano:4b \
OLLAMA_MODEL=nemotron-3-nano:4b \
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 \
npm run test:real-model
```

The script checks `ollama list` first. It skips clearly when Ollama is not
available or the model is missing.

Default per-scenario timeout is 30 seconds. Override with
`HARNESS_REAL_MODEL_TIMEOUT_MS` when first model load is expected to be slower.

## Temp Workspace

The smoke creates a temp fixture under the OS temp directory:

```text
tmp/harness-smoke-xxxx/
```

It never edits the real repo.

## Scenarios

1. Direct Chat
   - asks for `harness-ok`
   - asserts no tool events
   - requires durable chat log

2. Agent Inspect
   - asks the agent to inspect the temp math function
   - asserts workspace inventory/context events
   - asserts a read/list/search tool event
   - asserts no file changed

3. Agent Edit + Verify
   - runs in `trusted-edit` so unattended smoke can make scoped temp edits
   - asks for an exact temp-file replacement and `npm test`
   - asserts skill selection and adaptive plan validation
   - asserts `patchFile`/`runCommand` tool execution, changed file content, and verification event
   - prints run id and log paths

## Output

The script prints:

```text
Real model smoke result:
- passed / failed / skipped
- model
- provider
- base URL
- workspace path
- run id
- log jsonl path
- summary path
```

## Limits

`nemotron-3-nano:4b` is only a plumbing model. A smoke pass does not prove the
model can complete complex refactors. A smoke failure with clear logs is still
useful evidence for runtime or prompt/tool discipline debugging.

Adaptive planning is bounded separately by `HARNESS_ADAPTIVE_PLAN_TIMEOUT_MS`
(default 15000). If the tiny model cannot produce a valid plan quickly, the
harness records a validation failure and uses a validated fallback plan before
continuing with deterministic exact edit and verification tools.
