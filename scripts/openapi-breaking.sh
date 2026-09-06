#!/bin/bash

# Fail if shared/api-spec/openapi.yaml has changed in a way that breaks an
# existing client, comparing the working tree against a base git revision.
#
# Usage:
#   ./scripts/openapi-breaking.sh                compare against origin/master
#   ./scripts/openapi-breaking.sh <git-rev>      compare against that revision
#
# WHY (habitcraft-467)
#
# habitcraft-34d.2 made the spec load-bearing against the provider, and
# scripts/api-codegen.js makes it generate what the consumers read. Both of
# those keep the three components AGREEING with each other. Neither says
# anything about whether a change is safe to ship.
#
# That is what this adds. `version: 1.0.0` in the spec is a promise; without a
# diff gate it is just a string in a file. Renaming a response field, dropping
# an enum value, tightening a maxLength or adding a required request property
# all keep every gate above green -- provider, consumers and generated files
# move together in one commit -- while breaking the mobile build already in
# users' hands, which cannot be updated in lockstep.
#
# Implementation notes:
#
# - The base spec is extracted with `git show` on the HOST and handed to the
#   container as a plain file, so the container never needs .git mounted and
#   the comparison works the same in CI and locally.
# - The revision is the WORKING TREE copy, not HEAD's, so the check answers
#   "is what I am about to push breaking?" before the commit exists.
# - The image is pinned BY DIGEST for the same reason scripts/schema-dump.sh
#   pins its two: a moving tag would eventually reclassify a change and turn CI
#   red with no spec edit at all. Bump the digest deliberately.
#
# Escape hatch for a deliberate breaking change: commit
# shared/api-spec/oasdiff-severity.txt, one `<rule-id> <level>` pair per line.
# The rule id is what this script prints in brackets, e.g.
# `request-property-max-length-decreased info`. It is picked up automatically
# when present, so an exception is reviewed as a diff rather than living as an
# invisible flag on a CI job.
#
# Note the granularity: a downgrade applies to that RULE everywhere in the
# spec, not to the one operation that tripped it. Prefer making the change
# additive over silencing a rule across the whole API.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_RELPATH="shared/api-spec/openapi.yaml"
SPEC_PATH="$PROJECT_ROOT/$SPEC_RELPATH"
SEVERITY_PATH="$PROJECT_ROOT/shared/api-spec/oasdiff-severity.txt"

# oasdiff e887d0d -- see the note above before changing this.
OASDIFF_IMAGE="tufin/oasdiff@sha256:d4e92503a1b46d0c1a0746bf5b5100df6fdb9742abbc2e74d338b05b2920d0e9"

case "${1:-}" in
    -h|--help)
        sed -n '3,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
esac

BASE_REF="${1:-${OPENAPI_BASE_REF:-origin/master}}"

if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running -- this script runs oasdiff in a container."
    exit 1
fi

cd "$PROJECT_ROOT"

if ! git rev-parse --verify --quiet "$BASE_REF^{commit}" > /dev/null; then
    echo "❌ Base revision '$BASE_REF' does not exist in this repository."
    echo "   Fetch it first, or pass one that does:  $0 <git-rev>"
    exit 1
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# A spec that does not exist at the base is a NEW spec, not a broken one --
# there is no client to break. Distinguished from a bad ref, which failed above.
if ! git show "$BASE_REF:$SPEC_RELPATH" > "$WORKDIR/base.yaml" 2>/dev/null; then
    echo "ℹ️  $SPEC_RELPATH does not exist at $BASE_REF -- nothing to compare against."
    exit 0
fi

cp "$SPEC_PATH" "$WORKDIR/revision.yaml"

OASDIFF_ARGS=(breaking /specs/base.yaml /specs/revision.yaml --fail-on ERR --color never)

if [ -f "$SEVERITY_PATH" ]; then
    cp "$SEVERITY_PATH" "$WORKDIR/severity.txt"
    OASDIFF_ARGS+=(--severity-levels /specs/severity.txt)
    echo "ℹ️  Applying committed exceptions from shared/api-spec/oasdiff-severity.txt"
fi

echo "Comparing $SPEC_RELPATH against $BASE_REF..."

if docker run --rm -v "$WORKDIR:/specs:ro" "$OASDIFF_IMAGE" "${OASDIFF_ARGS[@]}"; then
    echo "✅ No breaking changes in $SPEC_RELPATH"
    exit 0
fi

echo ""
echo "❌ $SPEC_RELPATH introduces breaking changes against $BASE_REF."
echo "   Clients already deployed -- the mobile app above all -- cannot be"
echo "   updated in lockstep with the server, so a breaking change needs a"
echo "   deliberate decision, not a passing build."
echo ""
echo "   Options:"
echo "     - Make the change additive instead (new optional field, new endpoint)."
echo "     - Version the operation, keeping the old shape working."
echo "     - If it really is safe, downgrade the rule id printed above in"
echo "       shared/api-spec/oasdiff-severity.txt, so it is reviewed as a diff."
exit 1
