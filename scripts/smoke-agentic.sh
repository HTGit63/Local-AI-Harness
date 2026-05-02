#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/apps/cli/dist/cli.js"

cd "$ROOT"

node "$CLI" agent-smoke \
  --task "Read package.json and tell me the package name" \
  --require-action read_file

node "$CLI" agent-smoke \
  --task "Create hello.txt with the word hello" \
  --require-approval \
  --require-diff

node "$CLI" agent-smoke \
  --task "Inspect this repo and identify the API entry file" \
  --workflow inspect_project
