#!/usr/bin/env bash
# Run this INSIDE the sandbox to (re)start the Regelmotor dev server.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  npx --yes pnpm@latest install
fi

exec npx --yes pnpm@latest dev
