# Session Cleanup

Session cleanup is explicit. The harness does not silently delete user sessions during normal chat or agent runs.

Default session storage is `.gamma-harness/sessions` relative to the workspace root unless `sessionDataDir` is configured.

## API

`POST /api/sessions/cleanup`

Body:

```json
{
  "maxAgeMs": 604800000,
  "dryRun": true
}
```

Rules:

- Cleanup is scoped to the configured session store directory.
- The current active session is preserved automatically.
- Normal sessions are deleted only when `maxAgeMs` is provided and the session `updatedAt` age exceeds that value.
- Orphan turn sidecars are removed when their matching session file no longer exists.
- `dryRun: true` reports what would be deleted without removing files.

The response includes deleted, preserved, skipped, and orphan-sidecar records so callers can audit the operation.
