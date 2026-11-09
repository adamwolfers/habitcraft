#!/bin/bash

# Fail on a breaking change to the Go server's exported API that
# server/CHANGELOG.md does not own up to (habitcraft-vxln.6).
#
# Usage: scripts/go-api-check.sh [BASE]
#
# BASE defaults to the newest server/v* tag reachable from HEAD: the last
# version an embedding application could have pinned. apidiff compares the
# module's exported API there with the working tree's. Internal packages are
# not compared; nothing outside the module can import them.
#
# A pre-1.0 module may break its API, so an incompatible change is allowed,
# but only when the changelog's "## Unreleased" section has a "### Breaking"
# heading, so every release says what an upgrade breaks.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODULE=github.com/adamwolfers/habitcraft/server
CHANGELOG="$ROOT/server/CHANGELOG.md"

base="${1:-}"
if [[ -z "$base" ]]; then
    if ! base=$(git -C "$ROOT" describe --tags --match 'server/v*' --abbrev=0 HEAD 2>/dev/null); then
        echo "✅ No server/v* tag yet, so there is no released API to compare against"
        exit 0
    fi
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# One apidiff binary, built from this tree's pin, for both sides: the base
# need not have it as a tool.
(cd "$ROOT/server" && go build -o "$tmp/apidiff" golang.org/x/exp/cmd/apidiff)

git -C "$ROOT" archive "$base" server | tar -x -C "$tmp"
mkdir "$tmp/old"
mv "$tmp/server" "$tmp/old/server"
(cd "$tmp/old/server" && "$tmp/apidiff" -m -w "$tmp/old.api" "$MODULE")
(cd "$ROOT/server" && "$tmp/apidiff" -m -w "$tmp/new.api" "$MODULE")

breaking=$("$tmp/apidiff" -m -incompatible "$tmp/old.api" "$tmp/new.api")
if [[ -z "$breaking" ]]; then
    echo "✅ The Go API is compatible with $base"
    exit 0
fi

# The lines of the Unreleased section, up to the next release heading.
unreleased=$(awk '/^## /{inside = ($0 ~ /^## Unreleased/)} inside' "$CHANGELOG")
if grep -q '^### Breaking' <<<"$unreleased"; then
    echo "⚠️  Breaking changes since $base, documented in server/CHANGELOG.md:"
    echo "$breaking"
    exit 0
fi

echo "❌ Breaking changes to the Go API since $base:"
echo "$breaking"
echo ""
echo "If they are intended, describe them under a '### Breaking' heading in the"
echo "'## Unreleased' section of server/CHANGELOG.md."
exit 1
