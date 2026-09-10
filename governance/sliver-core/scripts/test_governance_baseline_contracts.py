#!/usr/bin/env python3
"""Contract tests for the immutable governance baseline manifest."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/governance_baseline.py"
MANIFEST = ROOT / "tests/governance/baseline-29695fe.json"
BASELINE_COMMIT = "29695fe099c6b38c9b5c470abbb2e065fc1ff936"


class GovernanceBaselineContractsTest(unittest.TestCase):
    def run_verify(self, manifest: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-B", str(SCRIPT), "--verify", str(manifest)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_checked_in_manifest_matches_the_git_object(self) -> None:
        result = self.run_verify(MANIFEST)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("OK: governance baseline verified", result.stdout)

    def test_manifest_binds_the_clean_baseline_and_unverified_live_state(self) -> None:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(data["schema"], "sliver-governance-baseline/v1")
        self.assertEqual(data["source_commit"], BASELINE_COMMIT)
        self.assertEqual(data["source_state"], "clean_git_object")
        self.assertEqual(data["fresh_session_status"], "UNVERIFIED")
        self.assertEqual(set(data["runtime_digests"]), {"codex", "claude-code", "gemini-cli"})
        self.assertGreater(len(data["contract_inputs"]), 20)
        self.assertGreater(data["fixture_file_count"], 20)
        self.assertEqual(len(data["fixture_tree_digest"]), 64)
        gate = data["contract_gate"]
        self.assertEqual(gate["source_commit"], BASELINE_COMMIT)
        self.assertEqual(gate["status"], "UNVERIFIED")
        self.assertIn("bound Git object", gate["reason"])

    def test_tampered_manifest_digest_fails_closed(self) -> None:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        data["contract_inputs"][0]["sha256"] = "0" * 64
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "baseline.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            result = self.run_verify(path)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("digest", (result.stdout + result.stderr).casefold())

    def test_manifest_rejects_an_unexpected_contract_input(self) -> None:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        data["contract_inputs"].append(
            {"path": "README.md", "sha256": "0" * 64}
        )
        data["contract_inputs"].sort(key=lambda item: item["path"])
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "baseline.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            result = self.run_verify(path)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("exact contract input set", (result.stdout + result.stderr).casefold())

    def test_candidate_cannot_claim_an_unbound_historical_contract_run(self) -> None:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
        data["contract_gate"] = {
            "status": "passed",
            "source_commit": BASELINE_COMMIT,
            "reason": "candidate working-tree log",
        }
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "baseline.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            result = self.run_verify(path)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unverified", (result.stdout + result.stderr).casefold())


if __name__ == "__main__":
    unittest.main()
