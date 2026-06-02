# Repository Intake Process

External reference repositories are not part of the normal harness architecture.

Rules:

1. Do not add `base_repos/` or `third_party/` as normal project context.
2. Do not scan copied external repos for model context by default.
3. Keep ignore rules for these folders so accidental local copies do not slow tools or bias prompts.
4. If external source material is needed, bring in only the specific idea or small artifact with clear attribution.
5. Normal builds must work from this repo's source code and bundled native skill pack.

Historical source studies may remain documented, but they are not runtime dependencies.
