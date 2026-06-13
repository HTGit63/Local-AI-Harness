# Release Gate

## Stable Harness Criteria

| # | Criterion |
|---:|---|
| 1 | Web UI can browse, read, search, and show git status without loading a model. |
| 2 | Deterministic tool operations include timing metadata and make zero model calls. |
| 3 | Web UI clearly separates Chat, Inspect, Plan, Trusted Edit, Full Agent, and Danger Sandbox. |
| 4 | Permission rules block outside-workspace paths and protected files. |
| 5 | Ollama works as the default provider through OpenAI-compatible `/v1`; optional `llama.cpp` remains selectable. |
| 6 | Runtime status, endpoint errors, and first-token latency are visible when available. |
| 7 | Plan and Inspect modes do not edit or create hidden checkpoints. |
| 8 | Agent editing shows exact changed files, diffs, and verification results. |
| 9 | Verification status distinguishes `not-run`, `running`, `passed`, `failed`, and `skipped`. |
| 10 | Project memory is small, structured, editable, deletable, and selectively injected. |
| 11 | `base_repos/` and `third_party/` are removed from normal product flow and ignored if present. |
| 12 | Unit, integration, e2e, package, and app builds pass. |

## Failure Conditions

The project is not stable if any of these happen:

- File browsing, file opening, search, or git status routes through Gemma.
- Chat Mode exposes edit tools.
- Inspect or Plan Mode edits files.
- Trusted Edit touches protected files casually.
- Full Agent runs without bounded loops.
- The UI hides current action, diffs, verification state, or command output.
- Runtime config assumes Ollama only and removes selectable `llama.cpp`.
- Defaults assume GPU or 26B availability.
- External reference repos appear in normal context.

## Final Validation Commands

```bash
npm run build:packages
npm run build:apps
node --import tsx tests/unit/core.test.ts
node --import tsx tests/integration/workflow.test.ts
node --import tsx tests/e2e/cli.test.ts
node --import tsx tests/e2e/api.test.ts
```
