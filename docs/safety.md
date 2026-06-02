# Safety Model

## Core Rule

The harness must show every file change, command, approval, verification result, and runtime error. It must not simulate tool results or claim checks passed unless they ran.

## Permission Modes

| Mode | Reads | Edits | Deletes | Shell | Model Required |
|---|---|---|---|---|---|
| `chat` | Selected context only | No | No | No | Yes |
| `inspect` | Deterministic read/search/git | No | No | Safe read-only only | No |
| `plan` | AI may inspect evidence | No | No | No destructive commands | Yes |
| `trusted-edit` | Yes | Scoped in workspace | Approval | Safe verification allowlist | Optional |
| `full-agent` | Yes | With visible plan/diff | Approval | Approval unless safe verification | Yes |
| `danger-sandbox` | Yes | Workspace only | No repeated prompt | No repeated prompt | Optional |

Legacy aliases `read-only`, `workspace-write`, and `danger` are still accepted internally for compatibility.

## Hard Denials

These are denied even in danger-style modes unless the product is explicitly reconfigured:

- Paths outside the workspace root.
- Protected files such as `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `secrets.*`, and `credentials.*`.
- Hidden writes or edits that skip diff visibility.

## Approval Rules

- Inspect and Plan cannot edit.
- Trusted Edit can make small in-workspace edits to non-protected files with fewer prompts.
- Delete, broad move/copy, installs, deploys, pushes, migrations, network operations, and protected-path access still require approval or are denied.
- Full Agent must show plan, files changed, diff, and verification status.

## Verification

Safe verification commands may run without repeated approval in trusted modes:

- `npm test`, `npm t`, and safe `npm run` scripts such as build/test/lint/typecheck/check.
- Equivalent safe `pnpm` and `yarn` scripts.
- `tsc --noEmit`, `tsc -b`, `vitest`, `jest`, `pytest`, and direct `node` execution of test/spec files.

Verification states are explicit: `not-run`, `running`, `passed`, `failed`, or `skipped`.

## Project Memory

Memory is small, structured, visible, editable, and deletable. It stores project facts such as package manager, commands, main folders, rules, and last runtime config. It must not store full prompts, traces, diffs, file contents, or raw model thoughts.
