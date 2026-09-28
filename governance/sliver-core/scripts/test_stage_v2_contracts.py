#!/usr/bin/env python3
"""Contract and migration tests for the Stage v2 surface."""

from __future__ import annotations

from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_project_guardrails  # noqa: E402


def stage_v2_text(
    *,
    scope_authorization: str = "blocked:plan gate does not grant execution authority",
    authorization_substage: Optional[str] = None,
    product_decision: str = "not_required:requested result is already explicit",
    result_status: str = "not_started",
    truth_writeback: str = "pending",
    evidence_refs: str = "[]",
) -> str:
    if authorization_substage is None:
        authorization_substage = (
            "pending"
            if scope_authorization.startswith("blocked:")
            else "S1-owner-contract"
        )
    return f"""# Policy owner stage

## Stage Control

- schema: sliver-stage/v2
- stage_id: policy-owner-stage
- primary_route: 开发执行
- operation: implement
- delivery_kind: implementation
- task_depth: D2
- materialization_trigger: [cross_owner_drift]
- risk_lanes: []
- evidence_mode: test
- test_level: T2
- route_evidence_kind: null
- effect_class: local_reversible
- operational_mode: planned
- scope_authorization: {scope_authorization}
- authorization_substage: {authorization_substage}
- product_decision: {product_decision}
- active_substage: S1-owner-contract
- result_status: {result_status}
- truth_writeback: {truth_writeback}
- migration_state: not_applicable
- evidence_refs: {evidence_refs}

## Stage Goal And User Flow

The user can configure one policy while the existing login flow stays unchanged.

## Current Truth And Owner

`src/domain/policy.py` owns the rule. API and UI consume it.

## Research Decision

- research_status: not_required:current repository evidence closes the owner decision

No external comparison changes this owner decision.

## Scope And Non-Goals

Change the policy owner and its callers. Do not change login, deployment, or database schema.

## Substage Plan

| Substage | Result | Owner | Done Standard | Validation | Do Not Touch |
| --- | --- | --- | --- | --- | --- |
| S1-owner-contract | One policy contract | src/domain/policy.py | One owner is active | Focused contract tests | Login and deployment |

## Test Security And Impact

T2 applies. No identity, money, provider, production, or destructive boundary changes.

## Validation Method

Run the focused contract test and the affected regression suite.

## Stop Conditions And Unverified

Stop after S1. A structurally valid document is not real implementation evidence.

## Implementation Write-Back

- actual_result: The S1 owner contract was updated
- changed_owners: src/domain/policy.py and tests/test_policy.py
- plan_deviation: none
- fresh_evidence: python3 -m unittest tests.test_policy reported two passing tests
- remaining_risk: none recorded
- next_substage: stop and wait for a new bounded task
- git_checkpoint: worktree boundary inspected; no commit claimed
"""


def stage_v1_text(*, task_depth: str = "标准任务") -> str:
    return f"""# Legacy stage

## Stage Control

- schema: sliver-stage/v1
- stage_status: closeout_ready
- task_depth: {task_depth}
- product_confirmation: confirmed:old confirmation
- active_substage: S1-owner-contract
- authorized_substage: S1-owner-contract
- substage_authorization: confirmed:old authorization
- result_status: completed
- truth_writeback: complete

## Stage Goal And User Flow

Legacy goal.

## Current Truth And Owner

Legacy owner.

## Research Decision

- research_status: completed:old research

## Scope And Non-Goals

Legacy scope.

## Substage Plan

| Substage | Result | Owner | Done Standard | Validation | Do Not Touch |
| --- | --- | --- | --- | --- | --- |
| S1-owner-contract | Legacy result | old.py | Old done claim | Old evidence | Other owners |

## Test Security And Impact

Legacy test decision.

## Validation Method

Legacy validation.

## Stop Conditions And Unverified

Legacy stop.

## Implementation Write-Back

- actual_result: old completed claim
- changed_owners: old.py
- plan_deviation: none
- evidence_status: verified
- fresh_evidence: old test output
- remaining_risk: none
- next_substage: none
- git_checkpoint: old checkpoint
"""


class StageV2ContractTests(unittest.TestCase):
    def write_stage(self, root: Path, text: str) -> Path:
        path = root / "stage.md"
        path.write_text(text, encoding="utf-8")
        return path

    def check(self, root: Path, gate: str) -> dict:
        return check_project_guardrails.check_project(
            root=root,
            mode="stage",
            truth_dir="dev-docs",
            allow_template=False,
            stage_file="stage.md",
            skip_private_scan=True,
            stage_gate=gate,
        )

    def run_guardrail(self, root: Path, gate: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/check_project_guardrails.py"),
                str(root),
                "--mode",
                "stage",
                "--stage-file",
                "stage.md",
                "--stage-gate",
                gate,
                "--json",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_v1_stage_fails_closed_as_migration_required_exit_3(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v1_text())
            result = self.check(root, "closeout")
            self.assertEqual(result["contract_status"], "MIGRATION_REQUIRED")
            self.assertFalse(result["completion_claim_allowed"])
            cli = self.run_guardrail(root, "closeout")
            self.assertEqual(cli.returncode, 3, cli.stdout + cli.stderr)
            self.assertIn("MIGRATION_REQUIRED", cli.stdout)

    def test_missing_schema_or_legacy_chinese_depth_requires_migration(self) -> None:
        mutations = (
            stage_v1_text().replace("- schema: sliver-stage/v1\n", ""),
            stage_v2_text().replace("- task_depth: D2", "- task_depth: 高风险任务"),
            stage_v2_text().replace("- task_depth: D2", "- 任务深度: 标准任务"),
        )
        for text in mutations:
            with self.subTest(text=text[:40]), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.write_stage(root, text)
                result = self.check(root, "plan")
                self.assertEqual(result["contract_status"], "MIGRATION_REQUIRED")
                self.assertEqual(result["contract_exit_code"], 3)

    def test_unknown_schema_is_invalid_schema_not_migration(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(
                root,
                stage_v2_text().replace("sliver-stage/v2", "sliver-stage/v99"),
            )
            result = self.check(root, "plan")
            self.assertEqual(result["contract_status"], "INVALID_SCHEMA")
            self.assertEqual(result["contract_exit_code"], 2)

    def test_v2_plan_contract_is_structurally_valid(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v2_text())
            result = self.check(root, "plan")
            self.assertTrue(result["ok"], result)
            self.assertTrue(result["structural_gate_met"])
            self.assertFalse(result["completion_claim_allowed"])

    def test_published_template_materializes_to_a_valid_v2_plan(self) -> None:
        replacements = {
            "@@阶段名称@@": "策略 owner 阶段",
            "@@stable-ascii-stage-id@@": "policy-owner-stage",
            "@@canonical-primary-route@@": "开发执行",
            "@@canonical-route-operation@@": "implement",
            "@@implementation-or-route-delivery-kind@@": "implementation",
            "@@D2-or-D3@@": "D2",
            "@@cross_owner_drift-or-ordered_nonclosable_transition-or-durable_handoff_requested@@": "cross_owner_drift",
            "@@test-or-route@@": "test",
            "@@T0-T4-or-null@@": "T2",
            "@@audit-diagnosis-decision-design-verification-handoff-or-null@@": "null",
            "@@none-local_reversible-or-controlled@@": "local_reversible",
            "@@not_required-reason-or-confirmed-evidence-or-pending-reason@@": "not_required:requested result is already explicit",
            "@@当前唯一子阶段名称@@": "S1-owner-contract",
            "@@completed-evidence-or-not_required-reason-or-unverified_nonblocking-reason-or-unverified_blocking-reason@@": "not_required:current repository evidence closes the owner decision",
            "@@与 active_substage 一致@@": "S1-owner-contract",
        }
        text = (ROOT / "assets/project-stage/stage-truth.md").read_text(encoding="utf-8")
        for old, new in replacements.items():
            text = text.replace(old, new)
        text = re.sub(
            r"@@[^@]+@@",
            "已按当前项目证据填写且没有扩大范围",
            text,
        )
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, text)
            result = self.check(root, "plan")
            self.assertTrue(result["ok"], result)

    def test_execute_requires_current_scope_authorization(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v2_text())
            blocked = self.check(root, "execute")
            self.assertFalse(blocked["ok"])
            self.assertIn("scope authorization is blocked", blocked["stage_gate_blockers"])

            self.write_stage(
                root,
                stage_v2_text(
                    scope_authorization="original_request_authorized:user explicitly authorized S1",
                ),
            )
            self.assertTrue(self.check(root, "execute")["ok"])

    def test_stage_scope_authorization_cannot_execute_controlled_action(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            text = stage_v2_text(
                scope_authorization="original_request_authorized:user explicitly authorized S1",
            ).replace("- effect_class: local_reversible", "- effect_class: controlled")
            self.write_stage(root, text)
            result = self.check(root, "execute")
            self.assertFalse(result["ok"])
            self.assertIn(
                "controlled action requires the independent action gate; stage scope authorization cannot authorize it",
                result["stage_gate_blockers"],
            )

    def test_stage_materialization_rejects_d0_and_d1(self) -> None:
        for depth in ("D0", "D1"):
            with self.subTest(depth=depth), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.write_stage(
                    root,
                    stage_v2_text().replace("- task_depth: D2", f"- task_depth: {depth}"),
                )
                result = self.check(root, "plan")
                self.assertFalse(result["ok"])
                self.assertIn("task_depth", result["invalid_stage_fields"])

    def test_authorization_is_bound_to_the_active_substage(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(
                root,
                stage_v2_text(
                    scope_authorization=(
                        "original_request_authorized:user explicitly authorized S1"
                    ),
                    authorization_substage="S0-audit",
                ),
            )
            result = self.check(root, "execute")
            self.assertFalse(result["ok"])
            self.assertIn(
                "authorization_substage",
                result["invalid_stage_fields"],
            )

    def test_test_and_route_evidence_are_a_discriminated_union(self) -> None:
        mutations = (
            stage_v2_text().replace(
                "- route_evidence_kind: null",
                "- route_evidence_kind: audit",
            ),
            stage_v2_text()
            .replace("- delivery_kind: implementation", "- delivery_kind: audit")
            .replace("- evidence_mode: test", "- evidence_mode: route")
            .replace("- route_evidence_kind: null", "- route_evidence_kind: audit"),
        )
        for text in mutations:
            with self.subTest(), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.write_stage(root, text)
                result = self.check(root, "plan")
                self.assertFalse(result["ok"])
                self.assertIn("invalid_stage_fields", result["failures"])

        valid_route = (
            stage_v2_text()
            .replace("- primary_route: 开发执行", "- primary_route: 项目体检")
            .replace("- operation: implement", "- operation: audit")
            .replace("- delivery_kind: implementation", "- delivery_kind: audit")
            .replace("- evidence_mode: test", "- evidence_mode: route")
            .replace("- test_level: T2", "- test_level: null")
            .replace("- route_evidence_kind: null", "- route_evidence_kind: audit")
            .replace("- effect_class: local_reversible", "- effect_class: none")
        )
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, valid_route)
            self.assertTrue(self.check(root, "plan")["ok"])

    def test_route_operation_delivery_projection_is_enforced(self) -> None:
        mutations = (
            stage_v2_text().replace("- operation: implement", "- operation: audit"),
            stage_v2_text()
            .replace("- primary_route: 开发执行", "- primary_route: 项目体检")
            .replace("- operation: implement", "- operation: audit"),
        )
        for text in mutations:
            with self.subTest(), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.write_stage(root, text)
                result = self.check(root, "plan")
                self.assertFalse(result["ok"])
                self.assertTrue(
                    "operation" in result["invalid_stage_fields"]
                    or "route_operation_delivery" in result["invalid_stage_fields"]
                )

    def test_materialization_trigger_is_required_and_closed(self) -> None:
        for value in ("[]", "[task_is_large]"):
            with self.subTest(value=value), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                self.write_stage(
                    root,
                    stage_v2_text().replace(
                        "[cross_owner_drift]",
                        value,
                    ),
                )
                result = self.check(root, "plan")
                self.assertFalse(result["ok"])
                self.assertIn("materialization_trigger", result["invalid_stage_fields"])

    def test_risk_lane_ids_are_closed_without_changing_task_depth(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(
                root,
                stage_v2_text().replace(
                    "- risk_lanes: []",
                    "- risk_lanes: [privacy_secret_data]",
                ),
            )
            valid = self.check(root, "plan")
            self.assertTrue(valid["ok"], valid)
            self.assertEqual(valid["stage_values"]["task_depth"], "D2")

            self.write_stage(
                root,
                stage_v2_text().replace(
                    "- risk_lanes: []",
                    "- risk_lanes: [generic_high_risk]",
                ),
            )
            invalid = self.check(root, "plan")
            self.assertFalse(invalid["ok"])
            self.assertIn("risk_lanes", invalid["invalid_stage_fields"])

    def test_structural_closeout_never_self_proves_real_completion(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(
                root,
                stage_v2_text(
                    scope_authorization="confirmed:user confirmed the bounded result",
                    product_decision="confirmed:user confirmed the changed product outcome",
                    result_status="completed",
                    truth_writeback="complete",
                    evidence_refs="[run-2026-07-31-focused-tests]",
                ),
            )
            result = self.check(root, "closeout")
            self.assertTrue(result["ok"], result)
            self.assertTrue(result["structural_gate_met"])
            self.assertFalse(result["completion_claim_allowed"])
            self.assertTrue(result["completion_claim_requires_external_evidence"])

    def test_blocked_closeout_does_not_reuse_or_require_execution_authority(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(
                root,
                stage_v2_text(
                    result_status="blocked",
                    truth_writeback="complete",
                    evidence_refs="[blocker-observation-2026-07-31]",
                ),
            )
            result = self.check(root, "closeout")
            self.assertTrue(result["ok"], result)
            self.assertFalse(result["completion_claim_allowed"])
            self.assertFalse(result["completion_claim_requires_external_evidence"])


class StageV2MigrationTests(unittest.TestCase):
    def run_migration(self, source: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts/migrate_stage_contract.py"),
                str(source),
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_migration_creates_sibling_draft_without_overwriting_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "stage.md"
            original = stage_v1_text()
            source.write_text(original, encoding="utf-8")
            result = self.run_migration(source)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            draft = root / "stage.v2-draft.md"
            self.assertTrue(draft.is_file())
            self.assertEqual(source.read_text(encoding="utf-8"), original)

            migrated = draft.read_text(encoding="utf-8")
            self.assertIn("- schema: sliver-stage/v2", migrated)
            self.assertNotIn("sliver-stage/v1", migrated)
            self.assertFalse(
                any(
                    label in migrated
                    for label in ("轻量任务", "常规任务", "标准任务", "高风险任务")
                )
            )
            self.assertNotIn("old confirmation", migrated)
            self.assertNotIn("old authorization", migrated)
            self.assertNotIn("- result_status: completed", migrated)
            self.assertNotIn("- evidence_status: verified", migrated)
            self.assertNotIn("old test output", migrated)
            self.assertIn(
                "- scope_authorization: blocked:migration draft does not inherit authorization",
                migrated,
            )
            self.assertIn("- result_status: not_started", migrated)
            self.assertIn("- authorization_substage: pending", migrated)
            self.assertIn("- evidence_refs: []", migrated)
            self.assertIn("Legacy goal.", migrated)
            self.assertIn("Legacy owner.", migrated)
            self.assertIn("Legacy scope.", migrated)
            self.assertIn("| S1-owner-contract | Legacy result |", migrated)
            guardrail = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/check_project_guardrails.py"),
                    str(root),
                    "--mode",
                    "stage",
                    "--stage-file",
                    draft.name,
                    "--stage-gate",
                    "plan",
                    "--json",
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(guardrail.returncode, 1, guardrail.stdout + guardrail.stderr)
            self.assertIn("INVALID_CONTRACT", guardrail.stdout)

    def test_migration_refuses_to_overwrite_an_existing_draft(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "stage.md"
            source.write_text(stage_v1_text(), encoding="utf-8")
            draft = root / "stage.v2-draft.md"
            draft.write_text("keep me", encoding="utf-8")
            result = self.run_migration(source)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(draft.read_text(encoding="utf-8"), "keep me")

    def test_missing_schema_legacy_stage_can_generate_a_draft(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "stage.md"
            source.write_text(
                stage_v1_text().replace("- schema: sliver-stage/v1\n", ""),
                encoding="utf-8",
            )
            result = self.run_migration(source)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((root / "stage.v2-draft.md").is_file())

    def test_reclassified_sibling_draft_can_pass_plan_without_replacing_legacy_owner(self) -> None:
        replacements = {
            "@@RECLASSIFY_PRIMARY_ROUTE@@": "开发执行",
            "@@RECLASSIFY_ROUTE_OPERATION@@": "implement",
            "@@RECLASSIFY_DELIVERY_KIND@@": "implementation",
            "@@RECLASSIFY_D0_D3@@": "D2",
            "@@RECLASSIFY_MATERIALIZATION_TRIGGER@@": "cross_owner_drift",
            "@@RECLASSIFY_RISK_LANES@@": "",
            "@@RECLASSIFY_EVIDENCE_MODE@@": "test",
            "@@RECLASSIFY_TEST_LEVEL_OR_NULL@@": "T2",
            "@@RECLASSIFY_ROUTE_EVIDENCE_KIND_OR_NULL@@": "null",
            "@@RECLASSIFY_EFFECT_CLASS@@": "local_reversible",
            "@@RECLASSIFY_OPERATIONAL_MODE@@": "planned",
            "@@RECLASSIFY_ACTIVE_SUBSTAGE@@": "S1-owner-contract",
            "@@SET_RECLASSIFIED_AFTER_ALL_AXES_ARE_REVIEWED@@": "reclassified",
            "@@RECLASSIFY_TEST_SECURITY_AND_IMPACT_FROM_CURRENT_EVIDENCE@@": "T2 focused owner-contract evidence; no protected lane is active.",
            "@@DEFINE_CURRENT_ROUTE_OR_TEST_EVIDENCE@@": "Run the focused owner-contract tests before execution.",
        }
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "stage.md"
            original = stage_v1_text()
            source.write_text(original, encoding="utf-8")
            result = self.run_migration(source)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            draft = root / "stage.v2-draft.md"
            text = draft.read_text(encoding="utf-8")
            for old, new in replacements.items():
                text = text.replace(old, new)
            draft.write_text(text, encoding="utf-8")
            checked = check_project_guardrails.check_project(
                root=root,
                mode="stage",
                truth_dir="dev-docs",
                allow_template=False,
                stage_file=draft.name,
                skip_private_scan=True,
                stage_gate="plan",
            )
            self.assertTrue(checked["ok"], checked)
            self.assertEqual(source.read_text(encoding="utf-8"), original)


if __name__ == "__main__":
    unittest.main()
