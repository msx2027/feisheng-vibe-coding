#!/usr/bin/env python3
"""Deterministic fixture check used by UI fresh-session cases."""

import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REQUIRED = (
    "preview.html",
    "src/components/StableDataTable.js",
    "src/components/ui/Card.js",
    "src/i18n/workflow.js",
    "src/pages/records.js",
    "package.json",
    "tests/table-system.test.mjs",
)
missing = [relative for relative in REQUIRED if not (ROOT / relative).is_file()]
if missing:
    raise SystemExit(f"missing UI fixture workspace files: {', '.join(missing)}")
if "type=module" not in (ROOT / "preview.html").read_text(encoding="utf-8"):
    raise SystemExit("render entry is not executable")
node = shutil.which("node")
if node is None:
    raise SystemExit("node is required to execute the synthetic UI behavior test")
for command in (
    [node, "--check", "src/pages/records.js"],
    [node, "tests/table-system.test.mjs"],
):
    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        raise SystemExit(
            "synthetic UI behavior test failed: "
            + (completed.stderr.strip() or completed.stdout.strip())
        )
print("OK: synthetic UI workspace behavior verified")
