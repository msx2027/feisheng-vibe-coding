#!/usr/bin/env python3
"""Synthetic regression tests for runtime governance contracts."""

from __future__ import annotations

import unittest
from copy import deepcopy

from runtime_governance_contract import (
    GovernanceContractError,
    delivery_shape_pre_lock_digest,
    validate_delivery_shape_lock,
    validate_formal_materialization,
    validate_release_readiness,
    validate_truth_resolution,
)


DIGEST = "a" * 64


def truth_record() -> dict[str, object]:
    return {
        "schema": "sliver-truth-resolution/v1",
        "asks_current_executability": True,
        "sources": [
            {
                "id": "product-owner",
                "plane": "product_contract",
                "authority": "adopted_product_contract",
                "freshness": "fresh",
                "relation": "supports",
            },
            {
                "id": "derived-conflict",
                "plane": "product_contract",
                "authority": "derived_document",
                "freshness": "fresh",
                "relation": "conflicts",
            },
            {
                "id": "provider-observation",
                "plane": "external_current_state",
                "authority": "fresh_external_evidence",
                "freshness": "fresh",
                "relation": "supports",
            },
        ],
        "plane_results": [
            {
                "plane": "product_contract",
                "status": "resolved",
                "verdict": "supported",
                "evidence_refs": ["product-owner", "derived-conflict"],
                "conflict_status": "closed",
                "resolution_reason": "The adopted contract owns the requested product behavior.",
            },
            {
                "plane": "external_current_state",
                "status": "resolved",
                "verdict": "unavailable",
                "evidence_refs": ["provider-observation"],
                "conflict_status": "none",
                "resolution_reason": None,
            },
        ],
        "answer_order": ["external_current_state", "product_contract"],
        "overall_status": "resolved",
    }


def formal_record() -> dict[str, object]:
    return {
        "schema": "sliver-formal-materialization/v1",
        "artifact_kind": "render",
        "artifact_identity": "output/lesson.mp4",
        "source_revision": "revision-17",
        "accepted_input_digest": DIGEST,
        "writer_identity": "writer-main",
        "blocking_reviews": [
            {
                "ref": "review-contract",
                "status": "completed",
                "source_revision": "revision-17",
                "accepted_input_digest": DIGEST,
            },
            {
                "ref": "review-visual",
                "status": "completed",
                "source_revision": "revision-17",
                "accepted_input_digest": DIGEST,
            },
        ],
    }


def formal_context() -> dict[str, object]:
    return {
        "expected_artifact_identity": "output/lesson.mp4",
        "expected_source_revision": "revision-17",
        "expected_accepted_input_digest": DIGEST,
        "expected_blocking_review_refs": ["review-contract", "review-visual"],
        "active_writer_identities": ["writer-main"],
    }


def delivery_shape_record() -> dict[str, object]:
    return {
        "schema": "sliver-delivery-shape-lock/v3",
        "phase": "pre_implementation",
        "target_surface": "checkout-summary",
        "non_mechanical": True,
        "owner_paths": ["src/ui/CheckoutSummary.tsx"],
        "constraint_owner_paths": ["src/ui/tokens.ts"],
        "allowed_regions": ["summary-total"],
        "unchanged_regions": ["payment-method", "navigation"],
        "proposed_changed_regions": ["summary-total"],
        "user_task": {
            "primary_user": "account operator",
            "single_job": "confirm the current total before continuing",
            "success_signal": "the confirmed total is visible in the existing summary",
        },
        "interaction_model": {
            "familiar_pattern": "single-step checkout confirmation",
            "user_objects": ["order total", "payment method"],
            "user_actions": ["confirm order total"],
            "expected_results": ["the order continues with the confirmed total"],
            "system_concepts": [
                {
                    "id": "pricing-revision",
                    "disposition": "hidden_internal",
                    "user_need": None,
                    "element_ref": None,
                }
            ],
            "deviation": {
                "status": "conforming",
                "reason": None,
                "evidence_refs": [],
            },
        },
        "journey": {
            "entry": "the operator opens the existing checkout summary",
            "preconditions": ["an order and payment method already exist"],
            "primary_action": "confirm the visible order total",
            "system_response": "continue the existing checkout without exposing pricing internals",
            "success_signal": "the next checkout step opens with the confirmed total",
            "next_action": "continue checkout",
            "boundaries": [
                {"id": "cancel_back", "status": "applicable", "expected": "return without changing the order"},
                {"id": "error_recovery", "status": "applicable", "expected": "keep the order and offer retry"},
                {"id": "refresh_resume", "status": "applicable", "expected": "restore the same checkout step"},
                {"id": "deep_link", "status": "out_of_scope", "expected": "checkout does not support direct deep links"},
                {"id": "role_handoff", "status": "out_of_scope", "expected": "one account operator owns this step"},
            ],
        },
        "stable_reference": {
            "status": "present",
            "role": "finished_product",
            "kind": "repo_path",
            "ref": "src/ui/StableSummary.tsx",
            "sha256": DIGEST,
        },
        "introduced_or_changed_elements": [
            {
                "id": "summary-total",
                "kind": "data_view",
                "user_need": "recognize the total that will be confirmed",
                "source_owner": "contracts/summary.json",
                "visibility": "primary",
                "display_condition": "always",
            }
        ],
        "source_schema_projection": {
            "status": "not_applicable",
            "fields": [],
        },
        "interaction_states": ["default"],
        "acceptance_requirements": {
            "affected_viewports": ["desktop-640x360"],
            "reference_comparison_required": True,
            "dom_semantics_required": True,
            "keyboard_required": False,
        },
        "acceptance_evidence": None,
    }


def delivery_shape_context() -> dict[str, object]:
    record = delivery_shape_record()
    return {
        "project_root": "/synthetic/workspace",
        "expected_target_surface": record["target_surface"],
        "expected_owner_paths": record["owner_paths"],
        "expected_constraint_owner_paths": record["constraint_owner_paths"],
        "expected_phase": "pre_implementation",
        "expected_source_revision": "revision-17",
        "expected_pre_lock_digest": None,
        "expected_source_field_ids": [],
        "expected_stable_reference": deepcopy(record["stable_reference"]),
        "expected_visual_pairs": [],
        "expected_dom_snapshot_refs": [],
        "expected_interaction_refs": [],
        "expected_changed_region_refs": [],
        "expected_unchanged_region_refs": [],
        "expected_independent_review_ref": None,
    }


def delivery_shape_acceptance() -> tuple[dict[str, object], dict[str, object]]:
    record = delivery_shape_record()
    pre_lock_digest = delivery_shape_pre_lock_digest(record)
    pair = {
        "pair_id": "summary-default",
        "reference_artifact": "artifact:reference",
        "candidate_artifact": "artifact:candidate",
        "viewport": "desktop-640x360",
        "state": "default",
        "theme": "light",
    }
    record["phase"] = "acceptance"
    record["pre_lock_digest"] = pre_lock_digest
    record["source_revision"] = "revision-17"
    record["acceptance_evidence"] = {
        "visual_pairs": [pair],
        "dom_snapshot_refs": ["artifact:dom"],
        "interaction_refs": [],
        "changed_region_refs": ["artifact:changed"],
        "unchanged_region_refs": ["artifact:unchanged"],
        "independent_review_ref": "review:independent",
    }
    context = delivery_shape_context()
    context.update(
        expected_phase="acceptance",
        expected_pre_lock_digest=pre_lock_digest,
        expected_visual_pairs=[deepcopy(pair)],
        expected_dom_snapshot_refs=["artifact:dom"],
        expected_changed_region_refs=["artifact:changed"],
        expected_unchanged_region_refs=["artifact:unchanged"],
        expected_independent_review_ref="review:independent",
    )
    return record, context


def release_record() -> dict[str, object]:
    return {
        "schema": "sliver-release-readiness/v1",
        "artifact_identity": "dist/application",
        "source_revision": "revision-17",
        "target": "production",
        "funds_mode": "real",
        "risk_lanes": ["money_entitlement"],
        "evidence_planes": {
            "build": {"status": "collected", "evidence_refs": ["build:17"]},
            "runtime": {"status": "collected", "evidence_refs": ["runtime:17"]},
            "protected_boundary": {"status": "collected", "evidence_refs": ["money:17"]},
            "external_current_state": {"status": "collected", "evidence_refs": ["provider:17"]},
        },
        "protected_controls": {
            "lifecycle_state_effect": {"status": "collected", "evidence_refs": ["state:17"]},
            "idempotency_replay": {"status": "collected", "evidence_refs": ["replay:17"]},
            "failure_recovery": {"status": "collected", "evidence_refs": ["recovery:17"]},
        },
        "verdict": "release_ready",
        "blockers": [],
    }


def release_context() -> dict[str, object]:
    return {
        "expected_artifact_identity": "dist/application",
        "expected_source_revision": "revision-17",
        "expected_risk_lanes": ["money_entitlement"],
    }


class TruthResolutionContractsTest(unittest.TestCase):
    def test_current_external_answer_and_closed_conflict_pass(self) -> None:
        validate_truth_resolution(truth_record())

    def test_open_conflict_can_remain_unverified(self) -> None:
        record = truth_record()
        result = record["plane_results"][0]
        result.update(
            status="unverified",
            verdict="unverified",
            conflict_status="open",
            resolution_reason=None,
        )
        record["overall_status"] = "unverified"
        validate_truth_resolution(record)

    def test_open_conflict_cannot_claim_resolved(self) -> None:
        record = truth_record()
        record["plane_results"][0]["conflict_status"] = "open"
        record["plane_results"][0]["resolution_reason"] = None
        with self.assertRaisesRegex(
            GovernanceContractError, "open truth conflict requires unverified"
        ):
            validate_truth_resolution(record)

    def test_current_executable_answer_must_be_first(self) -> None:
        record = truth_record()
        record["answer_order"] = ["product_contract", "external_current_state"]
        with self.assertRaisesRegex(
            GovernanceContractError, "current executable answer must be first"
        ):
            validate_truth_resolution(record)

    def test_external_verdict_requires_fresh_external_evidence(self) -> None:
        record = truth_record()
        record["sources"][2]["authority"] = "stale_external_evidence"
        record["sources"][2]["freshness"] = "stale"
        with self.assertRaisesRegex(
            GovernanceContractError, "external_current_state lacks question-dependent authority"
        ):
            validate_truth_resolution(record)


class FormalMaterializationContractsTest(unittest.TestCase):
    def test_complete_reviews_and_single_writer_pass(self) -> None:
        validate_formal_materialization(formal_record(), formal_context())

    def test_interrupted_review_fails_closed(self) -> None:
        record = formal_record()
        record["blocking_reviews"][0]["status"] = "interrupted"
        with self.assertRaisesRegex(GovernanceContractError, "is not completed"):
            validate_formal_materialization(record, formal_context())

    def test_missing_review_fails_complete_set(self) -> None:
        record = formal_record()
        record["blocking_reviews"].pop()
        with self.assertRaisesRegex(
            GovernanceContractError, "coordinator-authenticated complete review set"
        ):
            validate_formal_materialization(record, formal_context())

    def test_stale_input_invalidates_record(self) -> None:
        record = formal_record()
        record["accepted_input_digest"] = "b" * 64
        with self.assertRaisesRegex(GovernanceContractError, "record is stale"):
            validate_formal_materialization(record, formal_context())

    def test_stale_review_invalidates_record(self) -> None:
        record = formal_record()
        record["blocking_reviews"][1]["source_revision"] = "revision-16"
        with self.assertRaisesRegex(GovernanceContractError, "review is stale"):
            validate_formal_materialization(record, formal_context())

    def test_writer_collision_fails_closed(self) -> None:
        context = formal_context()
        context["active_writer_identities"] = ["writer-main", "writer-other"]
        with self.assertRaisesRegex(GovernanceContractError, "writer collision"):
            validate_formal_materialization(formal_record(), context)

    def test_artifact_identity_cannot_self_authenticate(self) -> None:
        record = formal_record()
        record["artifact_identity"] = "output/other.mp4"
        with self.assertRaisesRegex(GovernanceContractError, "coordinator context"):
            validate_formal_materialization(record, formal_context())


class DeliveryShapeContractsTest(unittest.TestCase):
    def test_bounded_non_mechanical_change_passes(self) -> None:
        validate_delivery_shape_lock(
            delivery_shape_record(), delivery_shape_context()
        )

    def test_bound_acceptance_evidence_passes(self) -> None:
        record, context = delivery_shape_acceptance()
        validate_delivery_shape_lock(record, context)

    def test_change_outside_allowed_regions_fails(self) -> None:
        record = delivery_shape_record()
        record["proposed_changed_regions"] = ["summary-total", "coupon-panel"]
        with self.assertRaisesRegex(GovernanceContractError, "exceeds allowed regions"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_record_without_user_task_and_information_architecture_must_fail(self) -> None:
        record = delivery_shape_record()
        del record["user_task"]
        with self.assertRaisesRegex(
            GovernanceContractError, "user_task|introduced_or_changed_elements"
        ):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_record_without_interaction_model_must_fail(self) -> None:
        record = delivery_shape_record()
        del record["interaction_model"]
        with self.assertRaisesRegex(GovernanceContractError, "interaction_model"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_record_without_complete_journey_boundaries_must_fail(self) -> None:
        record = delivery_shape_record()
        record["journey"]["boundaries"] = record["journey"]["boundaries"][:-1]
        with self.assertRaisesRegex(GovernanceContractError, "journey boundaries"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_hidden_system_concept_cannot_bind_visible_element(self) -> None:
        record = delivery_shape_record()
        concept = record["interaction_model"]["system_concepts"][0]
        concept["element_ref"] = "summary-total"
        concept["user_need"] = "show internal revision"
        with self.assertRaisesRegex(GovernanceContractError, "hidden_internal"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_pattern_deviation_requires_reason_and_evidence(self) -> None:
        record = delivery_shape_record()
        record["interaction_model"]["deviation"] = {
            "status": "evidence_backed",
            "reason": None,
            "evidence_refs": [],
        }
        with self.assertRaisesRegex(GovernanceContractError, "deviation"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_candidate_claimed_runtime_reference_must_not_self_authenticate(self) -> None:
        record = delivery_shape_record()
        record["stable_reference"] = {
            "status": "present",
            "role": "finished_product",
            "kind": "rendered_capture",
            "ref": "artifact:candidate-claimed-reference",
            "sha256": "b" * 64,
        }
        with self.assertRaisesRegex(GovernanceContractError, "context|reference"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_acceptance_without_bound_pre_lock_must_fail(self) -> None:
        record, context = delivery_shape_acceptance()
        context["expected_pre_lock_digest"] = "b" * 64
        with self.assertRaisesRegex(
            GovernanceContractError, "pre-lock digest"
        ):
            validate_delivery_shape_lock(record, context)

    def test_source_projection_must_close_host_fields(self) -> None:
        record = delivery_shape_record()
        record["source_schema_projection"] = {
            "status": "complete",
            "fields": [
                {
                    "source_id": "total",
                    "disposition": "visible",
                    "element_ref": "summary-total",
                }
            ],
        }
        context = delivery_shape_context()
        context["expected_source_field_ids"] = ["total", "internal_revision"]
        with self.assertRaisesRegex(
            GovernanceContractError, "source schema projection"
        ):
            validate_delivery_shape_lock(record, context)

    def test_hidden_internal_element_cannot_claim_visible_condition(self) -> None:
        record = delivery_shape_record()
        record["introduced_or_changed_elements"].append(
            {
                "id": "internal-revision",
                "kind": "status",
                "user_need": "remain internal for diagnostics",
                "source_owner": "contracts/summary.json",
                "visibility": "hidden_internal",
                "display_condition": "always",
            }
        )
        with self.assertRaisesRegex(
            GovernanceContractError, "never_visible"
        ):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_acceptance_cannot_drift_from_pre_lock(self) -> None:
        record, context = delivery_shape_acceptance()
        record["user_task"]["single_job"] = "show every available field"
        with self.assertRaisesRegex(GovernanceContractError, "drifted"):
            validate_delivery_shape_lock(record, context)

    def test_visual_pair_must_match_host_context(self) -> None:
        record, context = delivery_shape_acceptance()
        record["acceptance_evidence"]["visual_pairs"][0][
            "viewport"
        ] = "mobile-240x320"
        with self.assertRaisesRegex(
            GovernanceContractError,
            "reference/candidate viewport, state, and theme must match",
        ):
            validate_delivery_shape_lock(record, context)


class ReleaseReadinessContractsTest(unittest.TestCase):
    def test_real_funds_release_with_complete_evidence_passes(self) -> None:
        validate_release_readiness(release_record(), release_context())

    def test_build_green_cannot_authorize_real_funds_test(self) -> None:
        record = release_record()
        record["evidence_planes"]["protected_boundary"] = {
            "status": "unverified",
            "evidence_refs": [],
        }
        record["protected_controls"]["idempotency_replay"] = {
            "status": "unverified",
            "evidence_refs": [],
        }
        record["verdict"] = "release_ready"
        with self.assertRaisesRegex(
            GovernanceContractError, "real-funds readiness requires collected protected evidence"
        ):
            validate_release_readiness(record, release_context())

    def test_real_funds_gap_may_be_reported_as_deferred(self) -> None:
        record = release_record()
        record["evidence_planes"]["protected_boundary"] = {
            "status": "unverified",
            "evidence_refs": [],
        }
        record["protected_controls"]["failure_recovery"] = {
            "status": "unverified",
            "evidence_refs": [],
        }
        record["verdict"] = "defer"
        record["blockers"] = ["failure recovery remains unverified"]
        validate_release_readiness(record, release_context())

    def test_candidate_cannot_hide_expected_money_lane(self) -> None:
        record = release_record()
        record["risk_lanes"] = []
        with self.assertRaisesRegex(GovernanceContractError, "risk lanes do not match host context"):
            validate_release_readiness(record, release_context())

    def test_allowed_and_unchanged_regions_cannot_overlap(self) -> None:
        record = delivery_shape_record()
        record["unchanged_regions"] = ["summary-total"]
        with self.assertRaisesRegex(GovernanceContractError, "must be disjoint"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_owner_path_traversal_fails(self) -> None:
        record = delivery_shape_record()
        record["owner_paths"] = ["../outside.tsx"]
        with self.assertRaisesRegex(GovernanceContractError, "repository-relative"):
            validate_delivery_shape_lock(record, delivery_shape_context())

    def test_missing_stable_reference_requires_constraint_owners(self) -> None:
        record = delivery_shape_record()
        record["stable_reference"] = {
            "status": "absent",
            "role": "constraint_set",
            "kind": "none",
            "ref": None,
            "sha256": None,
        }
        record["constraint_owner_paths"] = []
        context = delivery_shape_context()
        context["expected_constraint_owner_paths"] = []
        context["expected_stable_reference"] = deepcopy(
            record["stable_reference"]
        )
        with self.assertRaisesRegex(
            GovernanceContractError, "stable reference or constraint owners"
        ):
            validate_delivery_shape_lock(record, context)


if __name__ == "__main__":
    unittest.main()
