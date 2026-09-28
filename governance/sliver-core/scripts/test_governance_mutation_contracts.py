#!/usr/bin/env python3
"""Contract tests for the deterministic governance mutation gate."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from evaluate_governance_mutations import (
    MutationError,
    load_cases,
    load_live_gaps,
    validate_source,
)
from evaluate_governance_meta_mutations import CASES as META_CASES


ROOT = Path(__file__).resolve().parents[1]
CASES = ROOT / "tests/governance/static-mutation-cases-v1.json"
LIVE_GAPS = ROOT / "tests/governance/known-live-gaps-v1.json"


class GovernanceMutationContractsTest(unittest.TestCase):
    def test_current_source_satisfies_static_invariants(self) -> None:
        data = load_cases(CASES, source_root=ROOT)
        validate_source(ROOT, data)

    def test_corpus_declares_seventy_two_diagnostic_critical_mutants(self) -> None:
        data = load_cases(CASES, source_root=ROOT)
        self.assertEqual(len(data["mutations"]), 72)
        ids = {case["id"] for case in data["mutations"]}
        self.assertTrue(
            {
                "first_refresh_can_be_skipped",
                "running_batch_becomes_unbounded",
                "pending_final_is_allowed",
                "metadata_incomplete_becomes_unrecoverable",
                "route_catalog_purpose_is_summarized",
                "route_projection_load_is_reinterpreted",
                "route_projection_source_digest_is_stale",
                "governance_route_oracle_imports_runtime_parser",
                "frontend_design_bounded_load_regressed",
                "lens_projection_load_is_reinterpreted",
                "unknown_lens_projection_is_accepted",
                "liveness_forbidden_field_removed",
                "liveness_home_path_pattern_narrowed",
                "liveness_schema_forbidden_fields_drift_allowed",
                "skill_lens_catalog_call_removed",
                "lens_catalog_impact_is_summarized",
                "duplicate_lens_catalog_is_accepted",
                "bounded_d1_lens_catalog_bytes_omitted",
                "project_audit_full_flow_becomes_default",
                "project_audit_testing_owner_becomes_default",
                "project_audit_truncated_batch_is_replayed",
                "project_audit_lens_bytes_are_omitted",
                "user_stop_finalization_is_removed",
                "subagent_implementation_backdoor_restored",
                "studio_proactive_evaluation_removed",
                "truth_capture_silent_write_allowed",
                "post_acceptance_drift_check_removed",
                "audit_artifact_default_removed",
                "code_audit_route_folded_into_health_audit",
                "audit_review_pass_removed",
                "growing_dirs_bulk_read_allowed",
                "audit_ledger_treated_as_truth",
            }.issubset(ids)
        )
        self.assertTrue(all(case["critical"] is True for case in data["mutations"]))
        for case in data["mutations"]:
            self.assertTrue(case["expected_failure"]["exit_codes"])
            self.assertTrue(case["expected_failure"]["output_contains"])

    def test_six_coordinated_meta_mutants_are_fixed(self) -> None:
        self.assertEqual(len(META_CASES), 6)
        ids = [case_id for case_id, _mutate, _diagnostic in META_CASES]
        self.assertEqual(
            ids,
            [
                "capability_change_with_candidate_self_approval",
                "runtime_manifest_and_oracle_shrink_together",
                "baseline_gate_claim_forged_in_candidate",
                "route_parser_and_negative_oracle_collude",
                "runtime_governance_and_unit_oracle_collude",
                "delivery_shape_and_unit_oracle_collude",
            ],
        )
        self.assertTrue(all(diagnostic for _case_id, _mutate, diagnostic in META_CASES))

    def test_live_gaps_cannot_claim_static_or_live_success(self) -> None:
        data = load_live_gaps(LIVE_GAPS)
        self.assertEqual(data["schema"], "sliver-governance-known-live-gaps/v1")
        self.assertEqual(len(data["cases"]), 29)
        ids = {case["id"] for case in data["cases"]}
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
            }.issubset(ids)
        )
        self.assertIn("plan_document_write_through", ids)
        self.assertIn("post_compaction_plan_owner_reload", ids)
        self.assertIn("blocking_audit_join_before_materialization", ids)
        self.assertIn("truth_source_conflict_resolution", ids)
        self.assertIn("formal_materialization_host_enforcement", ids)
        self.assertIn("explicit_exclusion_preservation", ids)
        self.assertIn("bounded_task_delegation_behavior", ids)
        self.assertIn("money_release_claim_behavior", ids)
        self.assertIn("os_readable_input_isolation", ids)
        self.assertIn("delivery_shape_user_task_behavior", ids)
        self.assertIn("delivery_shape_source_projection_behavior", ids)
        self.assertIn("delivery_shape_reference_grounding_behavior", ids)
        self.assertIn("delivery_shape_paired_acceptance_behavior", ids)
        for case in data["cases"]:
            self.assertEqual(case["status"], "UNVERIFIED")
            self.assertIs(case["static_surrogate_forbidden"], True)

    def test_live_gap_schema_drift_fails_closed(self) -> None:
        data = json.loads(LIVE_GAPS.read_text(encoding="utf-8"))
        data["cases"][0]["unexpected"] = True
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "live-gaps.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(MutationError, "fields drifted"):
                load_live_gaps(path)

    def test_unsafe_mutation_path_fails_closed(self) -> None:
        data = json.loads(CASES.read_text(encoding="utf-8"))
        data["mutations"][0]["path"] = "../SKILL.md"
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "cases.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(MutationError, "normalized repository-relative"):
                load_cases(path, source_root=ROOT)

    def test_replacement_must_match_exactly_once(self) -> None:
        data = json.loads(CASES.read_text(encoding="utf-8"))
        data["mutations"][0]["replacements"][0]["old"] = "missing mutation anchor"
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "cases.json"
            path.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(MutationError, "exactly once"):
                load_cases(path, source_root=ROOT)


if __name__ == "__main__":
    unittest.main()
