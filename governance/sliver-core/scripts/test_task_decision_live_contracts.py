#!/usr/bin/env python3
"""Regression tests for Task Decision fresh-task evidence contracts."""

from __future__ import annotations

import copy
import json
import subprocess
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

from live_evidence_isolation import build_allowed_inputs, input_manifest_digest
from runtime_identity import source_revision, source_runtime_digest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/evaluate_task_decision_live_behavior.py"
LIVE_CASES = ROOT / "tests/task-decision-live-cases.json"
STATIC_CASES = ROOT / "tests/task-decision-cases.json"
VERSION = (ROOT / "VERSION").read_text(encoding="utf-8").strip()


def isolation_manifest(revision: str, runtime_digest: str) -> dict[str, Any]:
    allowed_inputs = build_allowed_inputs("codex")
    return {
        "schema": "sliver-live-evidence-isolation/v1",
        "environment": "github_hosted_ephemeral",
        "workspace_origin": "versioned_synthetic_fixture",
        "source_revision": revision,
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


def set_path(target: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    current = target
    for part in parts[:-1]:
        child = current.get(part)
        if not isinstance(child, dict):
            raise AssertionError(f"fixture path is not an object: {path}")
        current = child
    current[parts[-1]] = value


class TaskDecisionLiveContractsTest(unittest.TestCase):
    def test_default_entrypoint_reports_unverified(self) -> None:
        result = subprocess.run(
            ["python3", "-B", str(SCRIPT)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("UNVERIFIED", result.stdout)

    def run_evaluator(self, results: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["python3", "-B", str(SCRIPT), "--results", str(results)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def decisions(self) -> dict[str, dict[str, Any]]:
        static = json.loads(STATIC_CASES.read_text(encoding="utf-8"))
        base = static["base_decision"]
        valid = {
            case["id"]: case["patch"]
            for case in static["cases"]
            if case["expected"] == "valid"
        }
        mapping = {
            "button-spacing": "button-spacing",
            "button-spacing-complex-nouns": "button-spacing-with-complex-nouns",
            "ordinary-bug": "ordinary-owner-bug",
            "explicit-exclusion-preserved": "explicit-exclusion-preserved",
            "cross-user-auth-bug": "cross-user-authorization-bug",
            "public-log-read": "read-public-log",
            "sensitive-log-read": "read-sensitive-production-log",
            "publish-verified-artifact": "publish-verified-artifact",
            "executable-governance-plan": "executable-governance-plan-materializes",
            "frontend-backend-studio": "frontend-backend-studio",
            "game-pipeline-studio": "game-assets-studio",
            "proactive-studio-without-naming": "frontend-backend-studio",
            "long-discussion-truth-capture-card": "truth-capture-create-new-waits-for-card",
            "selection-decision-goes-to-adr": "truth-capture-confirmed-card-writes-adr",
        }
        decisions: dict[str, dict[str, Any]] = {}
        for live_id, static_id in mapping.items():
            decision = copy.deepcopy(base)
            for path, value in valid[static_id].items():
                set_path(decision, path, value)
            decisions[live_id] = decision

        decisions["single-module-no-studio"] = copy.deepcopy(base)
        decisions["bounded-source-presence-check"] = copy.deepcopy(base)
        money_release = copy.deepcopy(base)
        money_release.update(
            decision_status="unresolved_protected_stop",
            primary_route="发布准备",
            operation="prepare",
            delivery_kind="verification",
            result="Assess real-funds readiness while protected evidence is unverified",
            risk_lanes=["money_entitlement"],
            discovery="unresolved_protected_stop",
            reason="Build evidence cannot close the real-funds state machine",
        )
        money_release["evidence"] = {
            "mode": "route",
            "test_level": None,
            "route_evidence_kind": "verification",
            "status": "unverified",
        }
        money_release["effect"] = {
            "effect_class": "none",
            "required_tier": "read_only",
            "granted_tier": "read_only",
            "authorization_evidence": "Current request authorizes a read-only release decision",
            "exact_target": "real-funds release readiness",
            "recovery_known": True,
            "health_and_stop_required": False,
            "authorization_status": "satisfied",
            "action": "audit",
        }
        money_release["scope"] = {
            "proposed_targets": ["release/**"],
            "excluded_targets": [],
        }
        money_release["loaded_owner_ids"] = [
            "routes",
            "task_depth",
            "effect_recovery",
            "risk_control",
        ]
        decisions["build-green-real-funds-unverified"] = money_release
        overlap = copy.deepcopy(base)
        overlap["owner_topology"]["shared_writable_surface"] = True
        overlap["studio_decision"] = "resolve_boundaries_first"
        overlap["loaded_owner_ids"].append("studio_execution")
        overlap["reason"] = "Shared writer boundary must be resolved first"
        decisions["overlapping-writers-stop"] = overlap
        return decisions

    def make_package(
        self,
        directory: Path,
        mutate: Callable[[dict[str, Any], Path], None] | None = None,
    ) -> Path:
        live = json.loads(LIVE_CASES.read_text(encoding="utf-8"))
        decisions = self.decisions()
        generated = datetime.now(timezone.utc)
        raw_dir = directory / "raw"
        raw_dir.mkdir()
        case_results: list[dict[str, Any]] = []
        for index, case in enumerate(live["cases"]):
            case_id = case["id"]
            thread_id = f"fresh-thread-{index}-{case_id}"
            host_validation_context = None
            if decisions[case_id].get("plan_target_kind") == "task_temporary":
                host_root = directory / "host-task-temp" / thread_id
                host_root.mkdir(parents=True)
                host_root = host_root.resolve()
                plan_target = host_root / f"sliver-plan-{thread_id}.md"
                decisions[case_id]["plan_task_identity"] = thread_id
                decisions[case_id]["plan_target"] = str(plan_target)
                host_validation_context = {
                    "host_task_identity": thread_id,
                    "host_task_temp_root": str(host_root),
                    "expected_blocking_review_refs": ["review-governance-owners"],
                }
            expected_exclusions = case.get("context", {}).get("expected_excluded_targets")
            if expected_exclusions is not None:
                host_validation_context = host_validation_context or {}
                host_validation_context["expected_excluded_targets"] = expected_exclusions
            raw_path = raw_dir / f"{case_id}.json"
            raw_path.write_text(
                json.dumps(decisions[case_id], ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            started = generated - timedelta(minutes=2) + timedelta(seconds=index * 2)
            ended = started + timedelta(seconds=1)
            case_results.append(
                {
                    "id": case_id,
                    "thread_id": thread_id,
                    "host_id": "codex-desktop-test-host",
                    "started_at": started.isoformat(),
                    "ended_at": ended.isoformat(),
                    "case_prompt": case["prompt"],
                    "initial_user": f"只输出合同 JSON。\n{case['prompt']}",
                    "raw_result_path": f"raw/{case_id}.json",
                    "decision": decisions[case_id],
                    **(
                        {"host_validation_context": host_validation_context}
                        if host_validation_context is not None
                        else {}
                    ),
                }
            )
        revision = source_revision(ROOT)
        runtime_digest = source_runtime_digest(ROOT, "codex")
        results: dict[str, Any] = {
            "schema": "sliver-task-decision-live-results/v2",
            "run_id": "deterministic-contract-regression",
            "skill_version": VERSION,
            "runtime_target": "codex",
            "runtime_digest": runtime_digest,
            "host": "codex-desktop-test-host",
            "model": "deterministic-contract-fixture",
            "generated_at": generated.isoformat(),
            "fresh_session": True,
            "source_revision": revision,
            "runner_isolation": isolation_manifest(revision, runtime_digest),
            "cases": case_results,
        }
        if mutate is not None:
            mutate(results, directory)
        results_path = directory / "task-decision-live-results.json"
        results_path.write_text(
            json.dumps(results, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        return results_path

    def assert_rejected(
        self,
        mutate: Callable[[dict[str, Any], Path], None],
        message: str,
    ) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            results = self.make_package(Path(temporary), mutate)
            completed = self.run_evaluator(results)
        self.assertNotEqual(completed.returncode, 0, completed.stdout)
        self.assertIn(message, completed.stdout)

    def test_valid_package_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            results = self.make_package(Path(temporary))
            completed = self.run_evaluator(results)
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        self.assertIn("fresh-session results validated", completed.stdout)

    def test_task_owned_plan_requires_external_host_context(self) -> None:
        def mutate(results: dict[str, Any], _directory: Path) -> None:
            case = next(
                item for item in results["cases"]
                if item["id"] == "executable-governance-plan"
            )
            case.pop("host_validation_context")

        self.assert_rejected(mutate, "host_validation_context must be an object")

    def test_task_owned_plan_rejects_host_identity_mismatch(self) -> None:
        def mutate(results: dict[str, Any], _directory: Path) -> None:
            case = next(
                item for item in results["cases"]
                if item["id"] == "executable-governance-plan"
            )
            case["host_validation_context"]["host_task_identity"] = "other-task"

        self.assert_rejected(mutate, "must equal its fresh task identifier")

    def test_non_fresh_results_are_rejected(self) -> None:
        self.assert_rejected(
            lambda results, _directory: results.__setitem__("fresh_session", False),
            "must come from fresh tasks",
        )

    def test_stale_results_are_rejected(self) -> None:
        self.assert_rejected(
            lambda results, _directory: results.__setitem__(
                "generated_at",
                (datetime.now(timezone.utc) - timedelta(days=8)).isoformat(),
            ),
            "older than the 7-day live evidence window",
        )

    def test_reused_thread_identifier_is_rejected(self) -> None:
        def mutate(results: dict[str, Any], _directory: Path) -> None:
            results["cases"][1]["thread_id"] = results["cases"][0]["thread_id"]

        self.assert_rejected(mutate, "fresh task identifier reused")

    def test_raw_decision_mismatch_is_rejected(self) -> None:
        def mutate(results: dict[str, Any], directory: Path) -> None:
            raw = directory / results["cases"][0]["raw_result_path"]
            direct = json.loads(raw.read_text(encoding="utf-8"))
            direct["reason"] = "tampered raw output"
            raw.write_text(
                json.dumps(direct, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

        self.assert_rejected(mutate, "differs from its raw result")

    def test_wrong_runtime_digest_is_rejected(self) -> None:
        self.assert_rejected(
            lambda results, _directory: results.__setitem__(
                "runtime_digest", "0" * 64
            ),
            "does not match the exact runtime candidate",
        )

    def test_normal_user_environment_is_rejected(self) -> None:
        def mutate(results: dict[str, Any], _directory: Path) -> None:
            results["runner_isolation"]["isolated_home"] = False

        self.assert_rejected(mutate, "isolated_home must be true")

    def test_unbound_input_manifest_is_rejected(self) -> None:
        def mutate(results: dict[str, Any], _directory: Path) -> None:
            results["runner_isolation"]["allowed_inputs"][0]["sha256"] = "9" * 64

        self.assert_rejected(mutate, "allowed input digest is stale")

    def test_initial_user_must_contain_exact_case_prompt(self) -> None:
        def mutate(results: dict[str, Any], _directory: Path) -> None:
            results["cases"][0]["initial_user"] = "另一个没有合同样例的请求"

        self.assert_rejected(mutate, "omits the contracted case prompt")

    def test_live_corpus_cannot_drop_a_required_case(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            mutated = Path(temporary) / "cases.json"
            data = json.loads(LIVE_CASES.read_text(encoding="utf-8"))
            data["cases"] = data["cases"][:-1]
            mutated.write_text(json.dumps(data), encoding="utf-8")
            completed = subprocess.run(
                ["python3", "-B", str(SCRIPT), "--contract-only", "--cases", str(mutated)],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("live corpus IDs or order drifted", completed.stdout)

    def test_live_metamorphic_fields_cannot_be_weakened(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            mutated = Path(temporary) / "cases.json"
            data = json.loads(LIVE_CASES.read_text(encoding="utf-8"))
            data["metamorphic_pairs"][1]["same_fields"] = ["task_depth"]
            mutated.write_text(json.dumps(data), encoding="utf-8")
            completed = subprocess.run(
                ["python3", "-B", str(SCRIPT), "--contract-only", "--cases", str(mutated)],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("metamorphic pair contract drifted", completed.stdout)


if __name__ == "__main__":
    unittest.main()
