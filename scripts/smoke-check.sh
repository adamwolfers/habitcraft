#!/bin/sh
# Post-deploy smoke check (habitcraft-vxln.9.1): one habit round trip as a
# throwaway user against a deployed server, which deletes that user whether the
# round trip passed or not. Exits 0 only when every step passed and the user is
# gone. Needs acceptance/'s dependencies installed (npm ci); no browser.
#
# Usage: scripts/smoke-check.sh <base-url>
#   e.g. scripts/smoke-check.sh http://localhost:3020   (server-test)
set -eu

if [ $# -ne 1 ] || [ -z "$1" ]; then
    echo "usage: $0 <base-url>" >&2
    exit 2
fi

cd "$(dirname "$0")/../acceptance"
SMOKE_BASE_URL="$1" exec node_modules/.bin/playwright test -c playwright.smoke.config.ts
