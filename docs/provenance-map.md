# Provenance Map

The current stable harness does not require vendored external repositories.

Normal product flow:

- Native skills live in `packages/skills/src/harness-native.ts`.
- Prompt recipes live in `packages/prompt-recipes`.
- Runtime logic lives in `packages/model-adapter`.
- Deterministic tools live in `packages/tool-runtime`.

`base_repos/` and `third_party/` are ignored if they appear locally and are not included in normal context packs.

When adding an externally derived asset later, document:

- upstream URL
- license
- exact local file
- whether it is runtime source, documentation, or reference-only
