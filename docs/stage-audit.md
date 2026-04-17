# Stage Audit

Status date: `2026-04-16`

This audit checks current repo against `AGENTS.md` stage contract and current runnable behavior. Status below reflects code, tests, and doc state after latest cleanup.

## Stage Status

1. Stage 1: Done. Dirty tree preserved, no destructive reset, current repo state treated as source of truth.
2. Stage 2: Done. Built-path benchmark contract documented and benchmark CLI present.
3. Stage 3: Done. `PromptAnalyzer` is pass-through only; no hidden analyzer round-trip remains in API hot path.
4. Stage 4: Done. Native Ollama chat/tool path preferred first for Gemma-capable turns.
5. Stage 5: Done. Manual tool protocol remains bounded fallback, not default lane.
6. Stage 6: Done. Think toggle wired through web, CLI, API, engine, and adapter; unsupported models warn.
7. Stage 7: Done. Image attachments pass through API/runtime with validation limits.
8. Stage 8: Done. Direct and agentic execution stay separate and persisted in turn history.
9. Stage 9: Done. Prompt recipes refreshed for Gemma-native behavior and lean local prompts.
10. Stage 10: Done. Toggle UX exists in web and CLI with consistent runtime meaning.
11. Stage 11: Done. Thinking is surfaced separately from final answer instead of mixed invisibly.
12. Stage 12: Done. Trace/status stream explains runtime progress for agentic turns.
13. Stage 13: Done. Caveman stays agentic-only by contract and docs.
14. Stage 14: Done. API stream path cleaned; analyzer branch removed; direct stream path simplified.
15. Stage 15: Done. Repo indexer caches context and ignores heavy/vendor/cache areas.
16. Stage 16: Done. Session store uses index-backed metadata and append-friendly turn history.
17. Stage 17: Done. Fast local budgets now default; timeouts/retries/keep-alive tuned for 16 GB CPU-first target.
18. Stage 18: Done. Approval, workspace boundary, and diff policy remain enforced across runtime lanes.
19. Stage 19: Done. Unit, integration, CLI e2e, and API e2e coverage all pass under current tree.
20. Stage 20: Done. Top-level docs now align on native-first, think toggle, images, direct-vs-agentic split, and no hidden analyzer.

## Extra Cleanup

- Removed tracked `.playwright-cli` snapshot cache files from git.
- Added `.playwright-cli/` to `.gitignore` so browser capture junk stops re-entering repo.
- Corrected stale repo-structure notes in `gamma4.readme`.

## Verification

- `npm test` passes.
- `AGENTS.md` contains completion notes for Stages 1 through 20 plus final graph ending in `All 20 stages over`.
