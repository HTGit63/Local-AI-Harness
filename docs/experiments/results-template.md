# Experiment Results Template

Use this template for future Action DSL, workflow-runner, and heavy-model runs.

## Run Metadata

- Date:
- Branch:
- Commit:
- Operator:
- Workspace:
- Protocol: `native_tools` / `action_dsl` / `workflow_runner`
- Model:
- Agent model:
- Summary model:
- Agent keep-alive:
- Hardware/RAM notes:

## Scenario

- Task prompt:
- Expected workflow:
- Expected action:
- Expected approval:
- Expected diff:
- Expected verification:

## Commands

```bash
npm run build
npm test
node apps/cli/dist/cli.js doctor --json
node apps/cli/dist/cli.js model status --json
node apps/cli/dist/cli.js agent-smoke --task "" --require-action read_file
```

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Build | Pass/Fail/Skipped |  |
| Tests | Pass/Fail/Skipped |  |
| Doctor | Pass/Fail/Skipped |  |
| Model status | Pass/Fail/Skipped |  |
| Smoke read | Pass/Fail/Skipped |  |
| Smoke write | Pass/Fail/Skipped |  |
| Smoke workflow | Pass/Fail/Skipped |  |
| Benchmark | Pass/Fail/Skipped |  |

## Telemetry

- First-token ms:
- Total ms:
- Tool count:
- Approval count:
- Diff preview present:
- Parse failure count:
- Repair count:
- Routing notes:
- Memory/RAM notes:
- Workflow status:
- Files read:
- Files changed:
- Commands run:

## Decision Notes

- What worked:
- What failed:
- RAM pressure observed:
- User-visible clarity:
- Default recommendation:
- Merge recommendation:
- Follow-up work:
