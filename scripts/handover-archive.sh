#!/usr/bin/env bash
# Builds veritas-szava-development-handover.zip from a commit (default HEAD):
# the handover package, the authoritative docs it links to, the shared UI
# code, the showcase and the examples. It uses `git archive`, so only files
# tracked at that commit can enter it: no .env files, secrets, node_modules
# or build output. The repository stays authoritative; the zip is a snapshot.
#
# Usage: scripts/handover-archive.sh [commit] [output-directory]
set -euo pipefail

commit="${1:-HEAD}"
out_dir="${2:-.}"
sha="$(git rev-parse --short "$commit")"
out="$out_dir/veritas-szava-development-handover.zip"

git archive --format=zip --prefix="veritas-szava-development-handover-$sha/" -o "$out" "$commit" -- \
  docs/handover/szava \
  docs/design-system \
  docs/architecture \
  docs/product \
  docs/features \
  docs/ROADMAP.md docs/FEATURES.md docs/REVIEW.md docs/USER-MANUAL.md \
  AGENTS.md CLAUDE.md CONTRIBUTING.md README.md \
  src/ui/paper \
  src/ui/components/layout \
  src/ui/styles/liquid-glass.css \
  src/app/globals.css \
  src/app/dev/design-system \
  scripts/handover-archive.sh

echo "$out ($commit = $(git rev-parse "$commit"))"
