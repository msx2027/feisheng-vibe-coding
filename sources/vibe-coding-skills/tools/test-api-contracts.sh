#!/bin/bash
# DocMap:
# Layer: L3 / test script
# Module: tools
# Depends on: tools/test-api-contracts.mjs
# Syncs with: tools/INDEX.md, .github/workflows/vibe-quality.yml
# Bash-compatible wrapper for the cross-platform API contract gate tests.

set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
node "$SCRIPT_DIR/test-api-contracts.mjs"
