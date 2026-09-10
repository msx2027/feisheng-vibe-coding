#!/usr/bin/env python3
"""Contracts for the executable governance semantic projection."""

from __future__ import annotations

import json
import hashlib
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import governance_route_projection as governance_route_oracle
import runtime_decision_contract as runtime_decision
from governance_semantic_projection import (
    ROOT,
    SemanticProjectionError,
    compare_projection,
)
from validation_support import markdown_section, split_table_row
from governance_route_projection import (
    build_governance_route_catalog,
    build_governance_route_projection,
)
from runtime_decision_contract import build_route_catalog, build_route_projection


class GovernanceSemanticProjectionContractsTest(unittest.TestCase):
    def run_route_cli(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "python3",
                "-B",
                str(ROOT / "scripts/runtime_decision_contract.py"),
                *arguments,
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_route_catalog_and_projection_preserve_exact_canonical_cells(self) -> None:
        rows = {}
        for line in (ROOT / "references/routes-index.md").read_text(
            encoding="utf-8"
        ).splitlines():
            cells = split_table_row(line)
            if len(cells) == 4 and cells[0].startswith("`"):
                rows[cells[0].strip("`")] = cells

        catalog_result = self.run_route_cli("route-catalog", "--format", "json")
        self.assertEqual(
            catalog_result.returncode,
            0,
            catalog_result.stdout + catalog_result.stderr,
        )
        catalog = json.loads(catalog_result.stdout)
        self.assertEqual(
            [entry["route"] for entry in catalog["routes"]],
            list(rows),
        )
        for entry in catalog["routes"]:
            canonical = rows[entry["route"]]
            self.assertEqual(entry["purpose"], canonical[1])

        projection_result = self.run_route_cli(
            "route-projection", "--route", "开发执行", "--format", "json"
        )
        self.assertEqual(
            projection_result.returncode,
            0,
            projection_result.stdout + projection_result.stderr,
        )
        projection = json.loads(projection_result.stdout)
        self.assertEqual(projection["purpose"], rows["开发执行"][1])
        self.assertEqual(projection["load"], rows["开发执行"][3])
        self.assertEqual(
            projection["source"]["sha256"], catalog["source"]["sha256"]
        )

    def test_skill_startup_queries_lens_catalog_only_from_impact_evidence(self) -> None:
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        startup = markdown_section(skill, "Startup Protocol")
        self.assertIsNotNone(startup)
        self.assertIn("lens-catalog --format json", startup)
        self.assertIn("only when the request or current truth shows", startup)
        self.assertIn("then query every selected lens", startup)
        self.assertIn("fail-closed fallback", startup)

    def test_lens_catalog_preserves_exact_ids_impacts_digest_and_bytes(self) -> None:
        self.assertTrue(
            hasattr(runtime_decision, "build_lens_catalog"),
            "runtime lens catalog is missing",
        )
        self.assertTrue(
            hasattr(governance_route_oracle, "build_governance_lens_catalog"),
            "independent lens catalog is missing",
        )
        registry = ROOT / "references/routes-index.md"
        text = registry.read_text(encoding="utf-8")
        rows = runtime_decision.parse_lens_registry_rows(text)
        runtime_catalog = runtime_decision.build_lens_catalog(registry)
        oracle_catalog = governance_route_oracle.build_governance_lens_catalog(text)
        self.assertEqual(runtime_catalog["lenses"], oracle_catalog["lenses"])
        self.assertEqual(
            runtime_catalog["lenses"],
            [
                {"lens": row["lens"], "impact": row["impact"]}
                for row in rows
            ],
        )
        self.assertTrue(
            all(set(entry) == {"lens", "impact"} for entry in runtime_catalog["lenses"])
        )
        self.assertEqual(
            runtime_catalog["source"]["sha256"],
            hashlib.sha256(registry.read_bytes()).hexdigest(),
        )
        result = self.run_route_cli("lens-catalog", "--format", "json")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout), runtime_catalog)
        self.assertEqual(
            len(result.stdout.encode("utf-8")),
            len(
                (
                    json.dumps(
                        runtime_catalog,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                    + "\n"
                ).encode("utf-8")
            ),
        )

    def test_duplicate_lens_catalog_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            registry = Path(raw) / "routes-index.md"
            text = (ROOT / "references/routes-index.md").read_text(encoding="utf-8")
            row = next(
                line
                for line in text.splitlines()
                if line.startswith("| `frontend-design` |")
            )
            self.assertEqual(text.count(row), 1)
            registry.write_text(text.replace(row, f"{row}\n{row}", 1), encoding="utf-8")
            result = self.run_route_cli(
                "lens-catalog", "--format", "json", "--registry", str(registry)
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "routes registry lens key is invalid or duplicated: frontend-design",
                result.stderr,
            )

    def test_ui_loading_budget_includes_lens_catalog_and_selected_lens(self) -> None:
        result = subprocess.run(
            ["python3", "-B", str(ROOT / "scripts/evaluate_execution_backbone.py")],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        match = re.search(
            r"route_projection=(\d+) bytes, lens_catalog=(\d+) bytes, "
            r"frontend-design_projection=(\d+) bytes, UI_D0=(\d+) bytes, "
            r"bounded_D1_UI=(\d+) bytes",
            result.stdout,
        )
        self.assertIsNotNone(match)
        route_bytes, lens_catalog_bytes, lens_bytes, d0_bytes, bounded_bytes = (
            int(value) for value in match.groups()
        )
        def cli_bytes(*args: str) -> int:
            projection = self.run_route_cli(*args)
            self.assertEqual(
                projection.returncode,
                0,
                projection.stdout + projection.stderr,
            )
            return len(projection.stdout.encode("utf-8"))

        self.assertEqual(
            route_bytes,
            cli_bytes("route-catalog", "--format", "json")
            + cli_bytes(
                "route-projection", "--route", "开发执行", "--format", "json"
            ),
        )
        self.assertEqual(
            lens_catalog_bytes,
            cli_bytes("lens-catalog", "--format", "json"),
        )
        self.assertEqual(
            lens_bytes,
            cli_bytes(
                "lens-projection",
                "--lens",
                "frontend-design",
                "--format",
                "json",
            ),
        )
        cases = json.loads(
            (ROOT / "tests/execution-backbone-cases.json").read_text(encoding="utf-8")
        )["development_loading_contract"]
        startup = ["SKILL.md", "references/runtime-adapter.md"]
        d0_files = dict.fromkeys([*startup, *cases["d0_required_refs"]])
        bounded_files = dict.fromkeys([*startup, *cases["bounded_d1_required_refs"]])
        projection_total = route_bytes + lens_catalog_bytes + lens_bytes
        self.assertEqual(
            d0_bytes,
            projection_total + sum((ROOT / path).stat().st_size for path in d0_files),
        )
        self.assertEqual(
            bounded_bytes,
            projection_total
            + sum((ROOT / path).stat().st_size for path in bounded_files),
        )

    def test_bounded_project_audit_budget_counts_exact_progressive_projection(self) -> None:
        result = subprocess.run(
            ["python3", "-B", str(ROOT / "scripts/evaluate_execution_backbone.py")],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        match = re.search(r"bounded_project_audit=(\d+) bytes", result.stdout)
        self.assertIsNotNone(match)
        measured = int(match.group(1))

        def cli_bytes(*args: str) -> int:
            projection = self.run_route_cli(*args)
            self.assertEqual(
                projection.returncode,
                0,
                projection.stdout + projection.stderr,
            )
            return len(projection.stdout.encode("utf-8"))

        cases = json.loads(
            (ROOT / "tests/execution-backbone-cases.json").read_text(encoding="utf-8")
        )["project_audit_loading_contract"]
        projected = sum(
            (
                cli_bytes("route-catalog", "--format", "json"),
                cli_bytes(
                    "route-projection",
                    "--route",
                    cases["route"],
                    "--format",
                    "json",
                ),
                cli_bytes("lens-catalog", "--format", "json"),
                cli_bytes(
                    "lens-projection",
                    "--lens",
                    cases["lens"],
                    "--format",
                    "json",
                ),
            )
        )
        files = dict.fromkeys(
            [
                "SKILL.md",
                "references/runtime-adapter.md",
                *cases["required_refs"],
            ]
        )
        self.assertEqual(
            measured,
            projected + sum((ROOT / path).stat().st_size for path in files),
        )
        self.assertLessEqual(measured, cases["bounded_max_bytes"])

    def test_lens_projection_preserves_exact_canonical_cells(self) -> None:
        self.assertTrue(
            hasattr(runtime_decision, "build_lens_projection"),
            "runtime lens projection is missing",
        )
        self.assertTrue(
            hasattr(governance_route_oracle, "build_governance_lens_projection"),
            "independent lens projection is missing",
        )
        registry = ROOT / "references/routes-index.md"
        text = registry.read_text(encoding="utf-8")
        section = markdown_section(text, "Conditional Development Lenses")
        self.assertIsNotNone(section)
        rows = {}
        for line in section.splitlines():
            cells = split_table_row(line)
            if len(cells) == 3 and cells[0].startswith("`"):
                rows[cells[0].strip("`")] = cells
        result = self.run_route_cli(
            "lens-projection", "--lens", "frontend-design", "--format", "json"
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        projection = json.loads(result.stdout)
        self.assertEqual(projection["impact"], rows["frontend-design"][1])
        self.assertEqual(projection["load"], rows["frontend-design"][2])
        self.assertEqual(
            projection["source"]["sha256"],
            hashlib.sha256(registry.read_bytes()).hexdigest(),
        )

    def test_runtime_projection_matches_independent_oracle_and_actual_json_bytes(self) -> None:
        registry = ROOT / "references/routes-index.md"
        text = registry.read_text(encoding="utf-8")
        expected_digest = hashlib.sha256(registry.read_bytes()).hexdigest()
        runtime_catalog = build_route_catalog(registry)
        oracle_catalog = build_governance_route_catalog(text)
        self.assertEqual(runtime_catalog["source"]["sha256"], expected_digest)
        self.assertEqual(
            runtime_catalog["routes"],
            oracle_catalog["routes"],
        )
        catalog_result = self.run_route_cli("route-catalog", "--format", "json")
        self.assertEqual(
            len(catalog_result.stdout.encode("utf-8")),
            len(
                (
                    json.dumps(
                        runtime_catalog,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                    + "\n"
                ).encode("utf-8")
            ),
        )
        for route in (entry["route"] for entry in runtime_catalog["routes"]):
            runtime_projection = build_route_projection(route, registry)
            oracle_projection = build_governance_route_projection(text, route)
            self.assertEqual(
                {key: value for key, value in runtime_projection.items() if key != "source"},
                {key: value for key, value in oracle_projection.items() if key != "source"},
            )
            self.assertEqual(runtime_projection["source"]["sha256"], expected_digest)
        for row in runtime_decision.parse_lens_registry_rows(text):
            runtime_projection = runtime_decision.build_lens_projection(
                row["lens"], registry
            )
            oracle_projection = (
                governance_route_oracle.build_governance_lens_projection(
                    text, row["lens"]
                )
            )
            self.assertEqual(
                {key: value for key, value in runtime_projection.items() if key != "source"},
                {key: value for key, value in oracle_projection.items() if key != "source"},
            )
            self.assertEqual(runtime_projection["source"]["sha256"], expected_digest)
            result = self.run_route_cli(
                "lens-projection", "--lens", row["lens"], "--format", "json"
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(
                len(result.stdout.encode("utf-8")),
                len(
                    (
                        json.dumps(
                            runtime_projection,
                            ensure_ascii=False,
                            separators=(",", ":"),
                        )
                        + "\n"
                    ).encode("utf-8")
                ),
            )

    def test_lens_projection_follows_exact_load_drift_and_digest(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            registry = Path(raw) / "routes-index.md"
            text = (ROOT / "references/routes-index.md").read_text(encoding="utf-8")
            current = runtime_decision.build_lens_projection(
                "frontend-design", ROOT / "references/routes-index.md"
            )["load"]
            mutated = current.replace(
                "fresh verification",
                "fresh verification with an exact mutation marker",
                1,
            )
            self.assertNotEqual(current, mutated)
            self.assertEqual(text.count(current), 1)
            registry.write_text(text.replace(current, mutated, 1), encoding="utf-8")
            runtime_projection = runtime_decision.build_lens_projection(
                "frontend-design", registry
            )
            oracle_projection = (
                governance_route_oracle.build_governance_lens_projection(
                    registry.read_text(encoding="utf-8"), "frontend-design"
                )
            )
            self.assertEqual(runtime_projection["load"], mutated)
            self.assertEqual(runtime_projection["load"], oracle_projection["load"])
            self.assertEqual(
                runtime_projection["source"]["sha256"],
                hashlib.sha256(registry.read_bytes()).hexdigest(),
            )

    def test_unknown_lens_projection_fails_closed(self) -> None:
        result = self.run_route_cli(
            "lens-projection", "--lens", "unknown-lens", "--format", "json"
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(
            "lens projection requires one canonical lens: unknown-lens",
            result.stderr,
        )

    def test_projection_digest_and_cells_follow_mutated_registry_without_summary(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            registry = Path(raw) / "routes-index.md"
            text = (ROOT / "references/routes-index.md").read_text(encoding="utf-8")
            old_purpose = "Own additions, changes, fixes, refactors, config, tests, reviews, and continuation from current truth through implementation and proof; operation is `implement`, `阶段计划`, `执行子阶段`, `工作室模式`, or `防漂移`."
            new_purpose = old_purpose + " Exact mutation marker."
            old_load = "Eligible bounded `D1` stays on this base"
            new_load = "Eligible bounded `D1` stays on this exact mutated base"
            self.assertEqual(text.count(old_purpose), 1)
            self.assertEqual(text.count(old_load), 1)
            registry.write_text(
                text.replace(old_purpose, new_purpose, 1).replace(old_load, new_load, 1),
                encoding="utf-8",
            )
            result = self.run_route_cli(
                "route-projection",
                "--route",
                "开发执行",
                "--format",
                "json",
                "--registry",
                str(registry),
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            projection = json.loads(result.stdout)
            self.assertEqual(projection["purpose"], new_purpose)
            self.assertIn(new_load, projection["load"])
            self.assertEqual(
                projection["source"]["sha256"],
                hashlib.sha256(registry.read_bytes()).hexdigest(),
            )

    def test_acceptance_route_parser_is_independent_from_runtime_parser(self) -> None:
        oracle = (ROOT / "scripts/governance_route_projection.py").read_text(
            encoding="utf-8"
        )
        semantic_gate = (ROOT / "scripts/governance_semantic_projection.py").read_text(
            encoding="utf-8"
        )
        capability_gate = (ROOT / "scripts/compare_capability_baseline.py").read_text(
            encoding="utf-8"
        )
        self.assertNotIn("runtime_decision_contract", oracle)
        self.assertIn("parse_governance_lens_rows", oracle)
        self.assertIn("parse_governance_route_projection", semantic_gate)
        self.assertIn("parse_governance_route_projection", capability_gate)

    def fixture(self, raw: str) -> tuple[Path, Path]:
        source = Path(raw) / "source"
        shutil.copytree(ROOT, source, ignore=shutil.ignore_patterns(".git", "dist", "__pycache__", "*.pyc"))
        subprocess.run(["git", "init", "--quiet"], cwd=source, check=True)
        subprocess.run(["git", "config", "user.name", "Semantic Projection Test"], cwd=source, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=source, check=True)
        subprocess.run(["git", "add", "--all"], cwd=source, check=True)
        subprocess.run(["git", "commit", "--quiet", "-m", "baseline"], cwd=source, check=True)
        revision = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=source, text=True,
            capture_output=True, check=True,
        ).stdout.strip()
        manifest = source / "semantic-baseline.json"
        manifest.write_text(json.dumps({"source_commit": revision}), encoding="utf-8")
        return source, manifest

    def test_current_projection_preserves_immutable_baseline(self) -> None:
        result = compare_projection(ROOT, ROOT / "tests/governance/baseline-29695fe.json")
        self.assertGreater(result["preserved"], 100)
        self.assertEqual(result["changed"], 0)
        self.assertEqual(result["retired"], 0)

    def test_baseline_revision_rejects_symbolic_refs_and_short_sha(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source, manifest = self.fixture(raw)
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
            for candidate in ("HEAD", "main", revision[:12]):
                with self.subTest(candidate=candidate):
                    manifest.write_text(
                        json.dumps({"source_commit": candidate}),
                        encoding="utf-8",
                    )
                    with self.assertRaisesRegex(
                        SemanticProjectionError,
                        "source_commit must be a full lowercase Git commit",
                    ):
                        compare_projection(source, manifest)

    def test_route_delivery_change_fails(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source, manifest = self.fixture(raw)
            path = source / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            path.write_text(
                text.replace(
                    "`baseline` -> `implementation`, `behavior_verification`",
                    "`baseline` -> `audit`",
                    1,
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SemanticProjectionError, "semantics changed"):
                compare_projection(source, manifest)

    def test_task_base_decision_change_fails_but_new_field_is_additive(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source, manifest = self.fixture(raw)
            path = source / "tests/task-decision-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["base_decision"]["task_depth"] = "D0"
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            with self.assertRaisesRegex(SemanticProjectionError, "semantics changed"):
                compare_projection(source, manifest)

    def test_action_tier_removal_fails(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            source, manifest = self.fixture(raw)
            path = source / "scripts/runtime_decision_contract.py"
            text = path.read_text(encoding="utf-8")
            path.write_text(
                text.replace('    "publish": "critical_operation",\n', "", 1),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(SemanticProjectionError, "semantics retired"):
                compare_projection(source, manifest)


if __name__ == "__main__":
    unittest.main()
