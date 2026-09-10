#!/usr/bin/env python3
"""Contract tests for the bounded, path-only private-risk heuristic scan."""

from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_project_guardrails  # noqa: E402


class PrivateRiskScanContractTests(unittest.TestCase):
    def test_secret_like_assignment_reports_path_and_risk_type_without_value(self) -> None:
        secret_value = "sk_live_Q7m9K2p4R8v6N3x5C1z0"
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "config.json").write_text(
                json.dumps({"api_key": secret_value}),
                encoding="utf-8",
            )

            risks = check_project_guardrails.find_private_risks(root)

        self.assertEqual(
            risks,
            [{"path": "config.json", "risk_type": "secret_like_assignment"}],
        )
        self.assertNotIn(secret_value, json.dumps(risks, ensure_ascii=False))
        self.assertEqual(set(risks[0]), {"path", "risk_type"})

    def test_secret_word_inside_an_ordinary_filename_is_not_a_filename_risk(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "my-secrets-notes.md").write_text(
                "# Secret-management notes\n\nNever commit credentials.\n",
                encoding="utf-8",
            )

            risks = check_project_guardrails.find_private_risks(root)

        self.assertEqual(risks, [])

    def test_content_scan_skips_binary_oversized_and_symlink_inputs(self) -> None:
        secret_line = b'api_key = "sk_live_Q7m9K2p4R8v6N3x5C1z0"\n'
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "binary.dat").write_bytes(b"\x00" + secret_line)
            (root / "oversized.txt").write_bytes(
                secret_line
                + b"x" * check_project_guardrails.PRIVATE_SCAN_MAX_FILE_BYTES
            )
            outside = root.parent / f"{root.name}-outside-config.json"
            outside.write_bytes(secret_line)
            try:
                (root / "linked-config.json").symlink_to(outside)
                risks = check_project_guardrails.find_private_risks(root)
            finally:
                outside.unlink(missing_ok=True)

        self.assertEqual(risks, [])

    def test_scan_stays_informational_and_caps_reported_paths_at_thirty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for index in range(35):
                (root / f".env.{index:02d}").write_text(
                    f"APP_MODE=fixture-{index}\n",
                    encoding="utf-8",
                )

            result = check_project_guardrails.check_project(
                root=root,
                mode="constitution",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=False,
                foundation_gate="contract",
            )

        self.assertEqual(len(result["private_risks"]), 30)
        self.assertTrue(
            all(set(item) == {"path", "risk_type"} for item in result["private_risks"])
        )
        self.assertEqual(
            result["private_risk_note"],
            "informational bounded heuristic only; inspect paths before staging or pushing",
        )
        self.assertFalse(any("private" in failure for failure in result["failures"]))


if __name__ == "__main__":
    unittest.main()
