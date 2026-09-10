#!/usr/bin/env python3
"""Fail-closed release verdict for known live gaps and runtime targets."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from evaluate_governance_mutations import load_live_gaps


ROOT = Path(__file__).resolve().parents[1]
KNOWN_LIVE_GAPS = ROOT / "tests/governance/known-live-gaps-v1.json"
TARGETS = ("codex", "claude-code", "gemini-cli")


def blocking_live_gap_ids(path: Path = KNOWN_LIVE_GAPS) -> list[str]:
    data = load_live_gaps(path)
    return [case["id"] for case in data["cases"] if case["status"] != "PASS"]


def target_verdicts(observed_target: str, blocking_gaps: list[str]) -> dict[str, Any]:
    if observed_target not in TARGETS:
        raise ValueError(f"unsupported runtime target: {observed_target}")
    verdicts = {
        target: {
            "status": "UNVERIFIED",
            "reason": (
                f"{len(blocking_gaps)} release-blocking live gaps remain open"
                if target == observed_target and blocking_gaps
                else "no trusted target-specific live evidence"
            ),
        }
        for target in TARGETS
    }
    return {"targets": verdicts, "overall": "BLOCKED"}


def render_target_verdicts(verdict: dict[str, Any]) -> str:
    lines = [
        f"{target}: {verdict['targets'][target]['status']} "
        f"({verdict['targets'][target]['reason']})"
        for target in TARGETS
    ]
    lines.append(f"overall: {verdict['overall']}")
    return "\n".join(lines)
