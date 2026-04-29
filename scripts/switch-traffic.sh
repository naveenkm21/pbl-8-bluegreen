#!/usr/bin/env bash
# Atomically flip the public Service selector between blue and green.
# Usage: ./switch-traffic.sh <blue|green>

set -euo pipefail

TARGET="${1:?usage: $0 <blue|green>}"

if [[ "$TARGET" != "blue" && "$TARGET" != "green" ]]; then
    echo "ERROR: target must be 'blue' or 'green'"
    exit 1
fi

PREVIEW=$([[ "$TARGET" == "blue" ]] && echo "green" || echo "blue")

echo "==> Switching public traffic to $TARGET"
kubectl patch svc pbl8-app-svc -p \
    "{\"spec\":{\"selector\":{\"app\":\"pbl8-app\",\"color\":\"$TARGET\"}}}"

echo "==> Pointing preview service to $PREVIEW"
kubectl patch svc pbl8-app-preview -p \
    "{\"spec\":{\"selector\":{\"app\":\"pbl8-app\",\"color\":\"$PREVIEW\"}}}"

echo "==> Done. Active=$TARGET  Preview=$PREVIEW"
kubectl get svc pbl8-app-svc pbl8-app-preview -o wide
