#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$ROOT/dist"
ares-package -o "$ROOT/dist" "$ROOT/app"
ls -lh "$ROOT/dist"/*.ipk
