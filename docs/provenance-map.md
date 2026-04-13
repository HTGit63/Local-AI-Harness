# Provenance Map

This document serves as the declarative map documenting where each curated skill, idea, or recipe comes from. It tracks license obligations and origins.

## Repositories

### 1. `openclaw`
- **Upstream**: https://github.com/openclaw/openclaw.git
- **Local Location**: `third_party/openclaw`
- **Attribution Obligation**: Preserve the original repository license. Annotate within UI component wrappers or server setup files whenever core control ideas are reused. Include an open source notices file in published builds.

### 2. `claw-code`
- **Upstream**: https://github.com/ultraworkers/claw-code.git
- **Local Location**: `third_party/claw-code`
- **Attribution Obligation**: Preserve the original repository license. When borrowing Rust or UI patterns for CLI harness commands, leave a comment at the top of the file denoting the source from `claw-code`. 

### 3. `agency-agents`
- **Upstream**: https://github.com/msitarzewski/agency-agents.git
- **Local Location**: `third_party/agency-agents`
- **Attribution Obligation**: These are skill content files. Keep the full clone untouched. When metadata is extracted, the exported local skill must include a `source: agency-agents` tag and link back to its original path.

### 4. `Prompt-Engineering-Guide`
- **Upstream**: https://github.com/dair-ai/Prompt-Engineering-Guide.git
- **Local Location**: `third_party/Prompt-Engineering-Guide`
- **Attribution Obligation**: Any generated prompt recipes referencing techniques or explicit texts from this repository must include a comment tag noting the `Prompt-Engineering-Guide` provenance.
