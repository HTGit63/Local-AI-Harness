# Safety Model

## Core Principle

The harness never silently writes broad changes. Every mutative action passes through a policy check and, when required, an explicit human approval gate.

## Workspace Modes

| Mode | Reads | Writes | Deletes | Shell |
|---|---|---|---|---|
| `read-only` | ✅ | ❌ | ❌ | ❌ |
| `workspace-write` | ✅ | ✅ (in workspace) | ⚠️ Approval | ⚠️ Approval |
| `danger` | ✅ | ✅ (anywhere) | ✅ | ✅ |

`danger` mode is **disabled by default** and requires explicit opt-in.

## Denied Actions

- Writes outside workspace root in `workspace-write` mode → **hard denied**
- File deletions → **require approval**
- Multi-file writes → **require approval**
- New file creation → **warning shown**
- Shell command execution → **require approval**

## Visibility Over Secrecy

The system shows:
- Current plan phase, not raw chain-of-thought
- Tool name and input summary
- Tool output summary
- File diffs before acceptance
- Concise rationale blocks

The system never shows:
- Giant verbose thought dumps
- Fake "thinking" without operational content
- Hidden file edits
