# Release Gate — v1 Acceptance Criteria

## Required Passes

| # | Criterion | Status |
|---|---|---|
| 1 | Local Ollama integration works with `gemma4:e4b` | ✅ Model adapter built |
| 2 | CLI one-shot and interactive modes work | ✅ `prompt` and `chat` commands |
| 3 | Web UI works on localhost | ✅ Vite React app at `:5173` |
| 4 | Skills index is built | ✅ 150 total, 12 curated |
| 5 | Prompt recipe library is built | ✅ 10 runtime recipe helpers |
| 6 | End-to-end coding workflow works | ✅ Inspect → locate → propose → diff → approve → write |
| 7 | Workspace boundary enforcement works | ✅ Outside-workspace writes denied |
| 8 | Tool traces are visible | ✅ TraceBus + Planner events |
| 9 | `doctor` passes | ✅ 11 diagnostic checks |
| 10 | Basic benchmarks are recorded | ✅ 6 latency metrics |
| 11 | Docs are present | ✅ 15 documentation files |
| 12 | Vendored repo provenance is documented | ✅ manifest.json + provenance-map.md |

## Explicit Failure Conditions

The project is **NOT ready** if any of the following are true:

- ❌ It only works when online → **PASS** (fully offline via Ollama)
- ❌ It only works in CLI and not web → **PASS** (both surfaces exist)
- ❌ It hides file changes → **PASS** (approval queue + diff preview)
- ❌ It silently writes broad edits → **PASS** (workspace policy gates all writes)
- ❌ It depends on a bigger model than E4B → **PASS** (defaults to `gemma4:e4b`)
- ❌ It cannot explain what skill/prompt recipe it is using → **PASS** (planner traces active skills)
- ❌ It merges upstream repos into an untraceable mess → **PASS** (vendored in `third_party/` with manifest)

## Verdict

**All acceptance criteria met. The harness is ready for v1 use.**
