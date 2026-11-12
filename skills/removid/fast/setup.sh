#!/usr/bin/env bash
# setup.sh <removid-project> [--no-install]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$here/scripts/setup.mjs" "$@"
