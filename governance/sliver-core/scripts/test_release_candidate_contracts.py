#!/usr/bin/env python3
"""Regression tests for the aggregate release-candidate gate."""

from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from live_evidence_isolation import build_allowed_inputs, file_sha256, input_manifest_digest
from release_live_contract import blocking_live_gap_ids, target_verdicts
from validation_support import ContractError
from validate_release_candidate import ROOT, static_commands, validate_live_headers
from validate_release_candidate import python_command, source_snapshot


SCRIPT = ROOT / "scripts/validate_release_candidate.py"


def isolation_manifest(source_revision: str, runtime_digest: str) -> dict[str, object]:
    allowed_inputs = build_allowed_inputs("codex")
    return {
        "schema": "sliver-live-evidence-isolation/v1",
        "environment": "github_hosted_ephemeral",
        "workspace_origin": "versioned_synthetic_fixture",
        "source_revision": source_revision,
        "runtime_digest": runtime_digest,
        "producer": {
            "kind": "github_actions",
            "repository": "example/sliver-vibe-coding",
            "workflow_path": ".github/workflows/external-live-evidence.yml",
            "run_id": "123456",
        },
        "isolated_home": True,
        "isolated_runtime_home": True,
        "user_config_loaded": False,
        "user_rules_loaded": False,
        "global_memory_mounted": False,
        "global_skills_mounted": False,
        "plugins_enabled": False,
        "session_history_mounted": False,
        "personal_projects_mounted": False,
        "allowed_inputs": allowed_inputs,
        "input_manifest_sha256": input_manifest_digest(allowed_inputs),
        "external_authorization_ref": "github-actions-environment:live-evidence",
        "privacy_scan_status": "passed",
        "cleanup_status": "complete",
    }


class ReleaseCandidateContractsTest(unittest.TestCase):
    def test_v090_release_metadata_is_closed_and_current(self) -> None:
        self.assertEqual((ROOT / "VERSION").read_text(encoding="utf-8").strip(), "1.0.0")
        changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        compatibility = (ROOT / "COMPATIBILITY.md").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        plugin = json.loads(
            (ROOT / "plugins/sliver-session-continuity/.codex-plugin/plugin.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertIn("## v1.0.0 — 2026-09-07", changelog)
        self.assertNotIn("## 未发布", changelog)
        self.assertIn("项目体检与执行存活", changelog)
        self.assertIn("Host/service", changelog)
        self.assertIn("## v0.9.0 发布边界", compatibility)
        self.assertIn("54,", compatibility)
        self.assertIn("Host/service", compatibility)
        self.assertIn("插件版本切换是会话边界", compatibility)
        self.assertEqual(plugin["version"], "0.2.0")
        self.assertIn("continuity 插件 `0.2.0`", changelog)
        self.assertNotIn("Delivery Shape v2", readme)
        self.assertNotIn("本次 Delivery Shape v2", compatibility)

    def test_contract_only_gate_includes_governance_baseline_and_mutations(self) -> None:
        commands = [" ".join(command) for command in static_commands()]
        for required in (
            "scripts/governance_baseline.py --verify tests/governance/baseline-29695fe.json",
            "scripts/test_governance_baseline_contracts.py",
            "scripts/governance_semantic_projection.py",
            "scripts/test_governance_semantic_projection_contracts.py",
            "scripts/compare_capability_baseline.py",
            "scripts/test_capability_baseline_contracts.py",
            "scripts/evaluate_governance_mutations.py",
            "scripts/test_governance_mutation_contracts.py",
            "scripts/evaluate_governance_meta_mutations.py",
            "scripts/evaluate_execution_liveness_live_behavior.py --contract-only",
            "scripts/test_runtime_governance_contracts.py",
            "scripts/test_private_risk_scan_contracts.py",
        ):
            self.assertTrue(
                any(required in command for command in commands),
                f"aggregate release gate is missing: {required}",
            )

    def test_runtime_bundle_oracle_runs_before_expensive_meta_mutations(self) -> None:
        commands = [" ".join(command) for command in static_commands()]
        runtime_oracle = next(
            index
            for index, command in enumerate(commands)
            if "scripts/test_runtime_bundle_safety.py" in command
        )
        meta_mutations = next(
            index
            for index, command in enumerate(commands)
            if "scripts/evaluate_governance_meta_mutations.py" in command
        )
        self.assertLess(runtime_oracle, meta_mutations)

    def test_ci_calls_the_single_aggregate_gate(self) -> None:
        push_ci = (ROOT / ".github/workflows/validate.yml").read_text(encoding="utf-8")
        release_ci = (ROOT / ".github/workflows/release-validate.yml").read_text(
            encoding="utf-8"
        )
        self.assertGreaterEqual(push_ci.count("fetch-depth: 0"), 1)
        self.assertGreaterEqual(release_ci.count("fetch-depth: 0"), 1)
        self.assertIn(
            "python3 -B scripts/validate_release_candidate.py --contract-only",
            push_ci,
        )
        for duplicated_child in (
            "python3 scripts/governance_baseline.py --verify tests/governance/baseline-29695fe.json",
            "python3 scripts/test_governance_baseline_contracts.py",
            "python3 scripts/evaluate_governance_mutations.py",
            "python3 scripts/test_governance_mutation_contracts.py",
        ):
            self.assertNotIn(duplicated_child, push_ci)
        for required in (
            "runtime-bundles:",
            "needs: validate",
            "target: [codex, claude-code, gemini-cli]",
            "python3 -B scripts/build_runtime_bundle.py",
            "python3 -B scripts/validate_runtime_bundle.py",
            "actions/upload-artifact@v4",
            "sliver-runtime-${{ matrix.target }}",
        ):
            self.assertIn(required, push_ci)

    def test_aggregate_propagates_bytecode_suppression_and_snapshots_source(self) -> None:
        command = python_command("scripts/validate_skill.py")
        self.assertEqual(command[1], "-B")
        self.assertEqual(source_snapshot(), source_snapshot())
        aggregate = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('sys.dont_write_bytecode = True', aggregate)
        self.assertIn('env["PYTHONDONTWRITEBYTECODE"] = "1"', aggregate)
        self.assertIn("aggregate gate changed the source checkout", aggregate)

    def test_missing_live_packages_only_blocks_full_live_validation(self) -> None:
        result = subprocess.run(
            ["python3", "-B", str(SCRIPT)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertIn("full live validation", result.stdout)
        self.assertIn("--contract-only", result.stdout)

    def test_known_live_gaps_block_release_and_keep_per_target_verdicts(self) -> None:
        gaps = blocking_live_gap_ids()
        self.assertEqual(len(gaps), 29)
        self.assertTrue(
            {
                "bounded_d1_governance_burden",
                "async_handle_reaping",
                "background_command_finalization",
                "context_budget_handoff",
                "host_result_to_model_continuation",
                "bounded_project_audit_governance_burden",
                "discovery_batch_truncation_recovery",
                "user_stop_to_bounded_final",
            }
            <= set(gaps)
        )
        verdict = target_verdicts("codex", gaps)
        self.assertEqual(verdict["overall"], "BLOCKED")
        self.assertEqual(set(verdict["targets"]), {"codex", "claude-code", "gemini-cli"})
        self.assertTrue(all(item["status"] == "UNVERIFIED" for item in verdict["targets"].values()))

    def test_live_packages_must_name_one_exact_candidate(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            task_decision = directory / "task-decision.json"
            foundation = directory / "foundation.json"
            ui = directory / "ui.json"
            studio = directory / "studio.json"
            common = {
                "skill_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": "a" * 64,
                "source_revision": "git:" + "b" * 40 + ":clean",
            }
            task_decision.write_text(json.dumps(common), encoding="utf-8")
            foundation.write_text(json.dumps(common), encoding="utf-8")
            ui.write_text(json.dumps({**common, "runtime_digest": "c" * 64}), encoding="utf-8")
            studio.write_text(json.dumps(common), encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "same candidate"):
                validate_live_headers(task_decision, foundation, ui, studio)

    def test_task_decision_package_participates_in_candidate_identity(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            paths = [
                directory / name
                for name in ("task.json", "foundation.json", "ui.json", "studio.json")
            ]
            common = {
                "skill_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": "a" * 64,
                "source_revision": "git:" + "b" * 40 + ":clean",
            }
            for path in paths:
                path.write_text(json.dumps(common), encoding="utf-8")
            paths[0].write_text(
                json.dumps({**common, "runtime_target": "gemini-cli"}),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ContractError, "same candidate"):
                validate_live_headers(*paths)

    def test_full_live_workflow_binds_source_without_assuming_a_missing_producer(self) -> None:
        workflow = (ROOT / ".github/workflows/release-validate.yml").read_text(encoding="utf-8")
        self.assertIn("full live", workflow.casefold())
        for required in (
            "getWorkflowRun",
            "head_sha",
            "SLIVER_TRUSTED_PRODUCER_WORKFLOW",
            "SLIVER_TRUSTED_PRODUCER_WORKFLOW_SHA256",
            "environment: sliver-live-release",
            "attestations: read",
            "createHash('sha256')",
            "--expected-producer-workflow-path",
            "runner.temp",
            "task-decision-live-results.json",
            "foundation-live-results.json",
            "ui-design-live-results.json",
            "studio-live-results.json",
            "validate_release_candidate.py",
            "--expected-producer-run-id",
            "--expected-producer-repository",
        ):
            self.assertIn(required, workflow)
        compatibility = (ROOT / "COMPATIBILITY.md").read_text(encoding="utf-8")
        self.assertIn("`attestations: read` 权限本身不算验证", compatibility)
        self.assertIn("`UNVERIFIED/BLOCKED`", compatibility)
        self.assertNotIn(".github/workflows/produce-live-evidence.yml", workflow)
        self.assertNotIn("inputs.producer_workflow_path", workflow)
        self.assertNotIn("path: live-results", workflow)

    def test_live_packages_share_one_isolated_producer_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            revision = "git:" + "b" * 40 + ":clean"
            runtime_digest = "a" * 64
            common = {
                "skill_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": runtime_digest,
                "source_revision": revision,
                "runner_isolation": isolation_manifest(revision, runtime_digest),
            }
            paths = [directory / f"{name}.json" for name in ("task", "foundation", "ui", "studio")]
            for path in paths:
                path.write_text(json.dumps(common), encoding="utf-8")
            validate_live_headers(
                *paths,
                expected_producer_run_id="123456",
                expected_producer_repository="example/sliver-vibe-coding",
                expected_producer_workflow_path=".github/workflows/external-live-evidence.yml",
            )
            tampered = json.loads(paths[-1].read_text(encoding="utf-8"))
            tampered["runner_isolation"]["producer"]["run_id"] = "654321"
            paths[-1].write_text(json.dumps(tampered), encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "source run"):
                validate_live_headers(
                    *paths,
                    expected_producer_run_id="123456",
                    expected_producer_repository="example/sliver-vibe-coding",
                    expected_producer_workflow_path=".github/workflows/external-live-evidence.yml",
                )

    def test_live_manifest_rejects_an_underdeclared_readable_input_set(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            revision = "git:" + "b" * 40 + ":clean"
            runtime_digest = "a" * 64
            manifest = isolation_manifest(revision, runtime_digest)
            manifest["allowed_inputs"] = manifest["allowed_inputs"][:-1]
            manifest["input_manifest_sha256"] = input_manifest_digest(
                manifest["allowed_inputs"]
            )
            common = {
                "skill_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": runtime_digest,
                "source_revision": revision,
                "runner_isolation": manifest,
            }
            paths = [directory / f"{name}.json" for name in ("task", "foundation", "ui", "studio")]
            for path in paths:
                path.write_text(json.dumps(common), encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "exact readable input closure"):
                validate_live_headers(
                    *paths,
                    expected_producer_run_id="123456",
                    expected_producer_repository="example/sliver-vibe-coding",
                    expected_producer_workflow_path=".github/workflows/external-live-evidence.yml",
                )

    def test_live_manifest_rejects_an_extra_readable_input(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            revision = "git:" + "b" * 40 + ":clean"
            runtime_digest = "a" * 64
            manifest = isolation_manifest(revision, runtime_digest)
            manifest["allowed_inputs"].append(
                {"path": "README.md", "sha256": file_sha256(ROOT / "README.md")}
            )
            manifest["allowed_inputs"].sort(key=lambda item: item["path"])
            manifest["input_manifest_sha256"] = input_manifest_digest(
                manifest["allowed_inputs"]
            )
            common = {
                "skill_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": runtime_digest,
                "source_revision": revision,
                "runner_isolation": manifest,
            }
            paths = [directory / f"{name}.json" for name in ("task", "foundation", "ui", "studio")]
            for path in paths:
                path.write_text(json.dumps(common), encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "exact readable input closure"):
                validate_live_headers(
                    *paths,
                    expected_producer_run_id="123456",
                    expected_producer_repository="example/sliver-vibe-coding",
                    expected_producer_workflow_path=".github/workflows/external-live-evidence.yml",
                )

    def test_live_manifest_binds_the_actual_producer_workflow(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            directory = Path(raw)
            revision = "git:" + "b" * 40 + ":clean"
            runtime_digest = "a" * 64
            common = {
                "skill_version": (ROOT / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": runtime_digest,
                "source_revision": revision,
                "runner_isolation": isolation_manifest(revision, runtime_digest),
            }
            paths = [directory / f"{name}.json" for name in ("task", "foundation", "ui", "studio")]
            for path in paths:
                path.write_text(json.dumps(common), encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "workflow_path does not match"):
                validate_live_headers(
                    *paths,
                    expected_producer_run_id="123456",
                    expected_producer_repository="example/sliver-vibe-coding",
                    expected_producer_workflow_path=".github/workflows/another-producer.yml",
                )

    def test_release_static_gate_runs_continuity_safety_suite(self) -> None:
        commands = [" ".join(command) for command in static_commands()]
        self.assertTrue(
            any("scripts/test_session_continuity.py" in command for command in commands)
        )


if __name__ == "__main__":
    unittest.main()
