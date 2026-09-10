#!/usr/bin/env python3
"""Deterministic fixture check used by foundation fresh-session cases."""

import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REQUIRED = (
    "notes/idea-a.md",
    "notes/idea-b.md",
    "drafts/function-notes.md",
    "docs/index.md",
    "docs/guide.md",
    "src/core/record-owner.mjs",
    "src/adapters/record-adapter.mjs",
    "tests/record-owner.test.mjs",
    "dev-docs/stages/stage-01.md",
)

missing = [relative for relative in REQUIRED if not (ROOT / relative).is_file()]
if missing:
    raise SystemExit(f"missing fixture workspace files: {', '.join(missing)}")
if "./guide.md" not in (ROOT / "docs/index.md").read_text(encoding="utf-8"):
    raise SystemExit("documentation link contract is not repaired")
if "owner: record-owner" not in (ROOT / "src/core/record-owner.mjs").read_text(encoding="utf-8"):
    raise SystemExit("record owner marker is missing")
node = shutil.which("node")
if node is None:
    raise SystemExit("node is required to execute the synthetic workspace behavior test")
completed = subprocess.run(
    [node, "tests/record-owner.test.mjs"],
    cwd=ROOT,
    text=True,
    capture_output=True,
    check=False,
)
if completed.returncode != 0:
    raise SystemExit(
        "synthetic foundation behavior test failed: "
        + (completed.stderr.strip() or completed.stdout.strip())
    )
print("OK: synthetic foundation workspace behavior verified")
