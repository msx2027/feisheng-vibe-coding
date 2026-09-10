#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
required = (
    "preview.html",
    "src/components/StableRecords.js",
    "src/styles/tokens.css",
    "src/contracts/settings.json",
    "src/contracts/dashboard.json",
)
for relative in required:
    path = ROOT / relative
    if not path.is_file() or not path.read_text(encoding="utf-8").strip():
        raise SystemExit(f"missing synthetic workspace owner: {relative}")
preview = (ROOT / "preview.html").read_text(encoding="utf-8")
for term in ("<main", "<table", "<button", 'aria-labelledby="surface-title"'):
    if term not in preview:
        raise SystemExit(f"synthetic preview lacks semantic term: {term}")
print("OK: synthetic UI governance workspace verified")
