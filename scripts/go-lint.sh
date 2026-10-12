#!/bin/bash

# Lint the Go server: gofmt must have nothing to change, and go vet must pass.
# Usage: scripts/go-lint.sh
#
# One script so CI's server-unit-tests job and scripts/test-all.sh run the same
# check (habitcraft-vxln.3).

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../server"

unformatted=$(gofmt -l .)
if [[ -n "$unformatted" ]]; then
    echo "❌ gofmt would reformat these files; run: (cd server && gofmt -w .)"
    echo "$unformatted"
    exit 1
fi

go vet ./...
echo "✅ gofmt and go vet are clean"
