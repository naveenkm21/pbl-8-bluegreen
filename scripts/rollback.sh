#!/usr/bin/env bash
# Roll back to the previous color by reading current selector and flipping it.
set -euo pipefail

CURRENT=$(kubectl get svc pbl8-app-svc -o jsonpath='{.spec.selector.color}')
TARGET=$([[ "$CURRENT" == "blue" ]] && echo "green" || echo "blue")

echo "==> Current: $CURRENT  →  Rolling back to: $TARGET"
exec "$(dirname "$0")/switch-traffic.sh" "$TARGET"
