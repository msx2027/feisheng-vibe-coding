#!/bin/bash
# DocMap:
# Layer: L3 / 关键脚本
# Module: tools
# Depends on: DOC-MAP.md, tools/INDEX.md
# Syncs with: tools/doc-sync-gate.sh, hooks/mark-source-change-needed.sh, codex-hooks/mark-source-change-needed.sh
# Shared path classification helpers for review/doc-sync enforcement.

_DOC_SYNC_HELPERS_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$_DOC_SYNC_HELPERS_DIR/doc-sync-path-helpers.sh"
. "$_DOC_SYNC_HELPERS_DIR/doc-sync-doc-helpers.sh"
. "$_DOC_SYNC_HELPERS_DIR/doc-sync-tier-helpers.sh"
. "$_DOC_SYNC_HELPERS_DIR/doc-sync-state-helpers.sh"
unset _DOC_SYNC_HELPERS_DIR
