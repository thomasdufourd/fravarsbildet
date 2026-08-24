#!/usr/bin/env bash
# Run this ON YOUR HOST (not inside the sandbox) to expose the dev server
# running in the sandbox at http://localhost:5173 on your machine.
set -euo pipefail

SANDBOX_NAME="claude-digital-l--sning-for-sykefrav--rsreduksjon"

sbx ports "$SANDBOX_NAME" --publish 5173:5173/tcp
echo "Published. Open http://localhost:5173 in your browser."
