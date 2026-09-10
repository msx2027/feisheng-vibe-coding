#!/usr/bin/env python3
"""Contracts for candidate-vs-baseline capability comparison."""

from __future__ import annotations

import copy
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from compare_capability_baseline import (
    DEFAULT_REGISTRY,
    ROOT,
    CapabilityBaselineError,
    compare_registry,
    load_registry,
    _python_unittest_records,
)


class CapabilityBaselineContractsTest(unittest.TestCase):
    def test_python_capability_record_binds_test_body_not_only_method_name(self) -> None:
        before = b"class ContractTest:\n    def test_rule(self):\n        assert True\n"
        after = b"class ContractTest:\n    def test_rule(self):\n        assert False\n"
        self.assertNotEqual(
            _python_unittest_records(before, label="before")["ContractTest.test_rule"],
            _python_unittest_records(after, label="after")["ContractTest.test_rule"],
        )
    def test_current_candidate_preserves_baseline_capability_ids(self) -> None:
        matrix = compare_registry(ROOT, load_registry(DEFAULT_REGISTRY))
        self.assertEqual(set(matrix), {
            "route-contracts",
            "route-operation-delivery-projection",
            "selector-families",
            "execution-contracts",
            "task-decision-contracts",
            "task-decision-live",
            "ui-lifecycle-contracts",
            "ui-live-contracts",
            "foundation-live-contracts",
            "studio-live-contracts",
            "stage-v2-contracts",
            "governance-semantic-projection-contracts",
            "validation-contracts",
            "private-risk-scan-contracts",
            "runtime-governance-contracts",
            "governance-static-mutations",
            "governance-meta-mutations",
            "governance-mutation-contracts",
            "runtime-safety-contracts",
            "release-isolation-contracts",
            "known-live-gap-contracts",
            "execution-liveness-live-contracts",
        })
        self.assertTrue(all(not result["retired"] for result in matrix.values()))

    def test_baseline_revision_rejects_symbolic_refs_and_short_sha(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source = Path(raw) / "source"
            source.mkdir()
            registry = load_registry(DEFAULT_REGISTRY)
            relatives = [
                registry["baseline_manifest"],
                "tests/governance/capability-registry-v1.json",
                *(item["path"] for item in registry["sources"]),
            ]
            for relative in dict.fromkeys(relatives):
                destination = source / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / relative, destination)
            subprocess.run(["git", "init", "--quiet"], cwd=source, check=True)
            subprocess.run(
                ["git", "config", "user.name", "Capability Revision Test"],
                cwd=source,
                check=True,
            )
            subprocess.run(
                ["git", "config", "user.email", "test@example.invalid"],
                cwd=source,
                check=True,
            )
            subprocess.run(["git", "add", "--all"], cwd=source, check=True)
            subprocess.run(
                ["git", "commit", "--quiet", "-m", "baseline"],
                cwd=source,
                check=True,
            )
            revision = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=source,
                text=True,
                capture_output=True,
                check=True,
            ).stdout.strip()
            subprocess.run(
                ["git", "update-ref", "refs/heads/main", revision],
                cwd=source,
                check=True,
            )
            manifest = source / registry["baseline_manifest"]
            for candidate in ("HEAD", "main", revision[:12]):
                with self.subTest(candidate=candidate):
                    manifest.write_text(
                        json.dumps({"source_commit": candidate}),
                        encoding="utf-8",
                    )
                    with self.assertRaisesRegex(
                        CapabilityBaselineError,
                        "source_commit must be a full lowercase Git commit",
                    ):
                        compare_registry(
                            source,
                            load_registry(
                                source
                                / "tests/governance/capability-registry-v1.json"
                            ),
                        )

    def test_registry_cannot_silently_drop_a_capability_source(self) -> None:
        registry = copy.deepcopy(load_registry(DEFAULT_REGISTRY))
        registry["sources"].pop()
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "registry.json"
            path.write_text(json.dumps(registry), encoding="utf-8")
            with self.assertRaisesRegex(
                CapabilityBaselineError,
                "source IDs or order drifted",
            ):
                load_registry(path)

    def test_candidate_registry_cannot_contain_a_self_approval_field(self) -> None:
        registry = copy.deepcopy(load_registry(DEFAULT_REGISTRY))
        registry["sources"][0]["reviewed_changes"] = ["ordinary-local-ui-tweak"]
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "registry.json"
            path.write_text(json.dumps(registry), encoding="utf-8")
            with self.assertRaisesRegex(CapabilityBaselineError, "fields drifted"):
                load_registry(path)

    def test_changed_baseline_record_requires_external_baseline_promotion(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source = Path(raw) / "source"
            source.mkdir()
            registry = load_registry(DEFAULT_REGISTRY)
            relatives = [
                registry["baseline_manifest"],
                "tests/governance/capability-registry-v1.json",
                *(item["path"] for item in registry["sources"]),
            ]
            for relative in relatives:
                destination = source / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / relative, destination)
            subprocess.run(["git", "init", "--quiet"], cwd=source, check=True)
            subprocess.run(["git", "config", "user.name", "Capability Test"], cwd=source, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=source, check=True)
            subprocess.run(["git", "add", "--all"], cwd=source, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "baseline"], cwd=source, check=True)
            revision = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=source,
                text=True,
                capture_output=True,
                check=True,
            ).stdout.strip()
            (source / registry["baseline_manifest"]).write_text(
                json.dumps({"source_commit": revision}),
                encoding="utf-8",
            )
            route_path = source / "tests/route-eval-cases.json"
            routes = json.loads(route_path.read_text(encoding="utf-8"))
            routes["cases"][0]["expected_lenses"] = []
            route_path.write_text(json.dumps(routes), encoding="utf-8")
            with self.assertRaisesRegex(
                CapabilityBaselineError,
                "lacks trusted external baseline promotion",
            ):
                compare_registry(source, load_registry(source / "tests/governance/capability-registry-v1.json"))

    def test_full_route_operation_delivery_projection_cannot_silently_change(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source = Path(raw) / "source"
            source.mkdir()
            registry = load_registry(DEFAULT_REGISTRY)
            relatives = [
                registry["baseline_manifest"],
                "tests/governance/capability-registry-v1.json",
                *(item["path"] for item in registry["sources"]),
            ]
            for relative in dict.fromkeys(relatives):
                destination = source / relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / relative, destination)
            subprocess.run(["git", "init", "--quiet"], cwd=source, check=True)
            subprocess.run(["git", "config", "user.name", "Capability Test"], cwd=source, check=True)
            subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=source, check=True)
            subprocess.run(["git", "add", "--all"], cwd=source, check=True)
            subprocess.run(["git", "commit", "--quiet", "-m", "baseline"], cwd=source, check=True)
            revision = subprocess.run(
                ["git", "rev-parse", "HEAD"], cwd=source, text=True,
                capture_output=True, check=True,
            ).stdout.strip()
            (source / registry["baseline_manifest"]).write_text(
                json.dumps({"source_commit": revision}), encoding="utf-8"
            )
            routes = source / "references/routes-index.md"
            text = routes.read_text(encoding="utf-8")
            old = "`baseline` -> `implementation`, `behavior_verification`"
            self.assertEqual(text.count(old), 1)
            routes.write_text(text.replace(old, "`baseline` -> `audit`", 1), encoding="utf-8")
            with self.assertRaisesRegex(
                CapabilityBaselineError,
                "route-operation-delivery-projection capability change",
            ):
                compare_registry(
                    source,
                    load_registry(source / "tests/governance/capability-registry-v1.json"),
                )


if __name__ == "__main__":
    unittest.main()
