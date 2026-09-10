#!/usr/bin/env python3
"""Validate conditional truth, formal-materialization, UI-shape, and release records."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any


class GovernanceContractError(ValueError):
    """Raised when a runtime governance record fails closed."""


TRUTH_SCHEMA = "sliver-truth-resolution/v1"
FORMAL_SCHEMA = "sliver-formal-materialization/v1"
DELIVERY_SHAPE_SCHEMA = "sliver-delivery-shape-lock/v3"
RELEASE_SCHEMA = "sliver-release-readiness/v1"

PLANES = (
    "product_contract",
    "implementation_state",
    "external_current_state",
    "historical_cause",
)
PLANE_VERDICTS = {
    "product_contract": {"supported", "not_supported", "unverified"},
    "implementation_state": {"implemented", "not_implemented", "unverified"},
    "external_current_state": {"available", "unavailable", "unverified"},
    "historical_cause": {"established", "unverified"},
}
PLANE_AUTHORITIES = {
    "product_contract": {
        "adopted_product_contract",
        "derived_document",
        "unadopted_reference",
    },
    "implementation_state": {
        "current_implementation",
        "runtime_observation",
        "derived_document",
    },
    "external_current_state": {
        "fresh_external_evidence",
        "stale_external_evidence",
        "derived_document",
    },
    "historical_cause": {"git_history", "archive", "derived_document"},
}
RESOLVING_AUTHORITIES = {
    "product_contract": {"adopted_product_contract"},
    "implementation_state": {"current_implementation", "runtime_observation"},
    "external_current_state": {"fresh_external_evidence"},
    "historical_cause": {"git_history", "archive"},
}
FORMAL_KINDS = {
    "render",
    "export",
    "package",
    "archive",
    "signed_build",
    "deployment_candidate",
    "formal_deliverable",
}
SHA256_RE = re.compile(r"[0-9a-f]{64}")
RELEASE_EVIDENCE_PLANES = {
    "build",
    "runtime",
    "protected_boundary",
    "external_current_state",
}
MONEY_RELEASE_CONTROLS = {
    "lifecycle_state_effect",
    "idempotency_replay",
    "failure_recovery",
}
DELIVERY_ELEMENT_KINDS = {
    "field",
    "action",
    "status",
    "navigation",
    "content",
    "data_view",
    "decoration",
}
DELIVERY_VISIBILITIES = {"primary", "contextual", "advanced", "hidden_internal"}
DELIVERY_REFERENCE_ROLES = {"finished_product", "structural", "style", "constraint_set"}
DELIVERY_REFERENCE_KINDS = {"repo_path", "rendered_capture", "none"}
SOURCE_FIELD_DISPOSITIONS = {
    "visible",
    "derived",
    "defaulted",
    "advanced",
    "omitted_internal",
    "out_of_scope",
}
JOURNEY_BOUNDARY_IDS = {
    "cancel_back",
    "error_recovery",
    "refresh_resume",
    "deep_link",
    "role_handoff",
}
SYSTEM_CONCEPT_DISPOSITIONS = {
    "hidden_internal",
    "progressive_disclosure",
    "user_visible",
}


def _object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise GovernanceContractError(f"{label} must be an object")
    return value


def _exact_fields(value: dict[str, Any], expected: set[str], label: str) -> None:
    actual = set(value)
    if actual != expected:
        raise GovernanceContractError(
            f"{label} fields drifted: expected {sorted(expected)}, got {sorted(actual)}"
        )


def _string(value: Any, label: str, *, minimum: int = 1) -> str:
    if not isinstance(value, str) or len(value.strip()) < minimum:
        raise GovernanceContractError(f"{label} must be a non-empty string")
    return value.strip()


def _enum(value: Any, allowed: set[str], label: str) -> str:
    item = _string(value, label)
    if item not in allowed:
        raise GovernanceContractError(f"{label} is invalid: {item}")
    return item


def _string_list(value: Any, label: str, *, allow_empty: bool = True) -> list[str]:
    if not isinstance(value, list):
        raise GovernanceContractError(f"{label} must be a list")
    items = [_string(item, f"{label} item") for item in value]
    if not allow_empty and not items:
        raise GovernanceContractError(f"{label} must not be empty")
    if len(items) != len(set(items)):
        raise GovernanceContractError(f"{label} must not contain duplicates")
    return items


def _digest(value: Any, label: str) -> str:
    digest = _string(value, label)
    if SHA256_RE.fullmatch(digest) is None:
        raise GovernanceContractError(f"{label} must be a lowercase SHA-256 digest")
    return digest


def validate_truth_resolution(value: Any) -> dict[str, Any]:
    record = _object(value, "truth resolution")
    _exact_fields(
        record,
        {
            "schema",
            "asks_current_executability",
            "sources",
            "plane_results",
            "answer_order",
            "overall_status",
        },
        "truth resolution",
    )
    if record["schema"] != TRUTH_SCHEMA:
        raise GovernanceContractError("truth resolution schema is invalid")
    asks_current = record["asks_current_executability"]
    if not isinstance(asks_current, bool):
        raise GovernanceContractError("asks_current_executability must be boolean")

    sources_value = record["sources"]
    if not isinstance(sources_value, list) or not sources_value:
        raise GovernanceContractError("truth sources must be a non-empty list")
    sources: dict[str, dict[str, str]] = {}
    for index, raw_source in enumerate(sources_value):
        source = _object(raw_source, f"truth source {index}")
        _exact_fields(
            source,
            {"id", "plane", "authority", "freshness", "relation"},
            f"truth source {index}",
        )
        source_id = _string(source["id"], f"truth source {index} id")
        if source_id in sources:
            raise GovernanceContractError(f"duplicate truth source id: {source_id}")
        plane = _enum(source["plane"], set(PLANES), f"{source_id} plane")
        authority = _enum(
            source["authority"], PLANE_AUTHORITIES[plane], f"{source_id} authority"
        )
        freshness = _enum(
            source["freshness"], {"fresh", "stale", "not_applicable"}, f"{source_id} freshness"
        )
        relation = _enum(
            source["relation"], {"supports", "conflicts", "context"}, f"{source_id} relation"
        )
        sources[source_id] = {
            "plane": plane,
            "authority": authority,
            "freshness": freshness,
            "relation": relation,
        }

    results_value = record["plane_results"]
    if not isinstance(results_value, list) or not results_value:
        raise GovernanceContractError("plane_results must be a non-empty list")
    results: dict[str, dict[str, Any]] = {}
    for index, raw_result in enumerate(results_value):
        result = _object(raw_result, f"plane result {index}")
        _exact_fields(
            result,
            {
                "plane",
                "status",
                "verdict",
                "evidence_refs",
                "conflict_status",
                "resolution_reason",
            },
            f"plane result {index}",
        )
        plane = _enum(result["plane"], set(PLANES), f"plane result {index} plane")
        if plane in results:
            raise GovernanceContractError(f"duplicate plane result: {plane}")
        status = _enum(result["status"], {"resolved", "unverified"}, f"{plane} status")
        verdict = _enum(result["verdict"], PLANE_VERDICTS[plane], f"{plane} verdict")
        evidence_refs = _string_list(result["evidence_refs"], f"{plane} evidence_refs")
        conflict_status = _enum(
            result["conflict_status"], {"none", "open", "closed"}, f"{plane} conflict_status"
        )
        reason = result["resolution_reason"]
        if reason is not None:
            reason = _string(reason, f"{plane} resolution_reason")
        referenced: list[dict[str, str]] = []
        for ref in evidence_refs:
            source = sources.get(ref)
            if source is None:
                raise GovernanceContractError(f"{plane} references unknown truth source: {ref}")
            if source["plane"] != plane:
                raise GovernanceContractError(f"{plane} references evidence from another plane: {ref}")
            referenced.append(source)
        if conflict_status == "open" and (status != "unverified" or verdict != "unverified"):
            raise GovernanceContractError("open truth conflict requires unverified")
        if conflict_status == "closed" and not reason:
            raise GovernanceContractError(f"{plane} closed conflict requires resolution_reason")
        if conflict_status != "closed" and reason is not None:
            raise GovernanceContractError(f"{plane} resolution_reason is only valid for a closed conflict")
        if status == "unverified" and verdict != "unverified":
            raise GovernanceContractError(f"{plane} unverified status requires unverified verdict")
        if status == "resolved":
            if verdict == "unverified":
                raise GovernanceContractError(f"{plane} resolved status cannot use unverified verdict")
            if not any(item["authority"] in RESOLVING_AUTHORITIES[plane] for item in referenced):
                raise GovernanceContractError(f"{plane} lacks question-dependent authority")
        if plane == "external_current_state" and status == "resolved":
            if not any(
                item["authority"] == "fresh_external_evidence" and item["freshness"] == "fresh"
                for item in referenced
            ):
                raise GovernanceContractError(
                    "external current verdict requires fresh external evidence"
                )
        results[plane] = {"status": status, "verdict": verdict}

    answer_order = _string_list(record["answer_order"], "answer_order", allow_empty=False)
    if set(answer_order) != set(results):
        raise GovernanceContractError("answer_order must cover every plane result exactly once")
    if asks_current:
        if "external_current_state" not in results:
            raise GovernanceContractError("current executability requires external_current_state")
        if answer_order[0] != "external_current_state":
            raise GovernanceContractError("current executable answer must be first")
    overall = _enum(record["overall_status"], {"resolved", "unverified"}, "overall_status")
    expected_overall = (
        "unverified"
        if any(result["status"] == "unverified" for result in results.values())
        else "resolved"
    )
    if overall != expected_overall:
        raise GovernanceContractError(f"overall_status must be {expected_overall}")
    return record


def validate_formal_materialization(value: Any, context_value: Any) -> dict[str, Any]:
    record = _object(value, "formal materialization")
    context = _object(context_value, "formal materialization context")
    _exact_fields(
        record,
        {
            "schema",
            "artifact_kind",
            "artifact_identity",
            "source_revision",
            "accepted_input_digest",
            "writer_identity",
            "blocking_reviews",
        },
        "formal materialization",
    )
    _exact_fields(
        context,
        {
            "expected_artifact_identity",
            "expected_source_revision",
            "expected_accepted_input_digest",
            "expected_blocking_review_refs",
            "active_writer_identities",
        },
        "formal materialization context",
    )
    if record["schema"] != FORMAL_SCHEMA:
        raise GovernanceContractError("formal materialization schema is invalid")
    _enum(record["artifact_kind"], FORMAL_KINDS, "artifact_kind")
    artifact_identity = _string(record["artifact_identity"], "artifact_identity")
    source_revision = _string(record["source_revision"], "source_revision")
    accepted_input_digest = _digest(record["accepted_input_digest"], "accepted_input_digest")
    writer_identity = _string(record["writer_identity"], "writer_identity")

    expected_artifact = _string(context["expected_artifact_identity"], "expected_artifact_identity")
    expected_source = _string(context["expected_source_revision"], "expected_source_revision")
    expected_digest = _digest(
        context["expected_accepted_input_digest"], "expected_accepted_input_digest"
    )
    if artifact_identity != expected_artifact:
        raise GovernanceContractError("artifact identity does not match coordinator context")
    if source_revision != expected_source or accepted_input_digest != expected_digest:
        raise GovernanceContractError("formal materialization record is stale")

    expected_refs = _string_list(
        context["expected_blocking_review_refs"], "expected_blocking_review_refs"
    )
    reviews_value = record["blocking_reviews"]
    if not isinstance(reviews_value, list):
        raise GovernanceContractError("blocking_reviews must be a list")
    review_refs: list[str] = []
    for index, raw_review in enumerate(reviews_value):
        review = _object(raw_review, f"blocking review {index}")
        _exact_fields(
            review,
            {"ref", "status", "source_revision", "accepted_input_digest"},
            f"blocking review {index}",
        )
        ref = _string(review["ref"], f"blocking review {index} ref")
        review_refs.append(ref)
        status = _enum(
            review["status"], {"completed", "interrupted", "failed"}, f"{ref} status"
        )
        if status != "completed":
            raise GovernanceContractError(f"blocking review is not completed: {ref}")
        if (
            _string(review["source_revision"], f"{ref} source_revision") != expected_source
            or _digest(review["accepted_input_digest"], f"{ref} accepted_input_digest")
            != expected_digest
        ):
            raise GovernanceContractError(f"blocking review is stale: {ref}")
    if len(review_refs) != len(set(review_refs)):
        raise GovernanceContractError("blocking review refs must not contain duplicates")
    if set(review_refs) != set(expected_refs):
        raise GovernanceContractError(
            "blocking review refs must match coordinator-authenticated complete review set"
        )

    active_writers = _string_list(
        context["active_writer_identities"], "active_writer_identities"
    )
    if not active_writers:
        raise GovernanceContractError("formal artifact has no active writer lease")
    if len(active_writers) != 1:
        raise GovernanceContractError("formal artifact writer collision")
    if active_writers[0] != writer_identity:
        raise GovernanceContractError("writer identity does not own the active writer lease")
    return record


def _repo_path(value: Any, label: str) -> str:
    path = _string(value, label)
    if "\\" in path or path.startswith("/"):
        raise GovernanceContractError(f"{label} must be a normalized repository-relative path")
    parts = path.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise GovernanceContractError(f"{label} must be a normalized repository-relative path")
    return path


DELIVERY_COMMON_FIELDS = {
    "schema",
    "phase",
    "target_surface",
    "non_mechanical",
    "owner_paths",
    "constraint_owner_paths",
    "allowed_regions",
    "unchanged_regions",
    "proposed_changed_regions",
    "user_task",
    "interaction_model",
    "journey",
    "stable_reference",
    "introduced_or_changed_elements",
    "source_schema_projection",
    "interaction_states",
    "acceptance_requirements",
    "acceptance_evidence",
}
DELIVERY_CONTEXT_FIELDS = {
    "project_root",
    "expected_target_surface",
    "expected_owner_paths",
    "expected_constraint_owner_paths",
    "expected_phase",
    "expected_source_revision",
    "expected_pre_lock_digest",
    "expected_source_field_ids",
    "expected_stable_reference",
    "expected_visual_pairs",
    "expected_dom_snapshot_refs",
    "expected_interaction_refs",
    "expected_changed_region_refs",
    "expected_unchanged_region_refs",
    "expected_independent_review_ref",
}


def _nullable_string(value: Any, label: str) -> str | None:
    if value is None:
        return None
    return _string(value, label)


def _validate_interaction_model(value: Any) -> dict[str, Any]:
    model = _object(value, "interaction_model")
    _exact_fields(
        model,
        {
            "familiar_pattern",
            "user_objects",
            "user_actions",
            "expected_results",
            "system_concepts",
            "deviation",
        },
        "interaction_model",
    )
    _string(model["familiar_pattern"], "interaction_model familiar_pattern")
    _string_list(
        model["user_objects"], "interaction_model user_objects", allow_empty=False
    )
    actions = _string_list(
        model["user_actions"], "interaction_model user_actions", allow_empty=False
    )
    results = _string_list(
        model["expected_results"],
        "interaction_model expected_results",
        allow_empty=False,
    )
    if len(actions) != len(results):
        raise GovernanceContractError(
            "interaction_model user_actions and expected_results must align one-to-one"
        )

    concepts = model["system_concepts"]
    if not isinstance(concepts, list):
        raise GovernanceContractError("interaction_model system_concepts must be a list")
    concept_ids: set[str] = set()
    for index, raw_concept in enumerate(concepts):
        concept = _object(raw_concept, f"system concept {index}")
        _exact_fields(
            concept,
            {"id", "disposition", "user_need", "element_ref"},
            f"system concept {index}",
        )
        concept_id = _string(concept["id"], f"system concept {index} id")
        if concept_id in concept_ids:
            raise GovernanceContractError(
                f"duplicate interaction_model system concept: {concept_id}"
            )
        concept_ids.add(concept_id)
        disposition = _enum(
            concept["disposition"],
            SYSTEM_CONCEPT_DISPOSITIONS,
            f"{concept_id} disposition",
        )
        user_need = _nullable_string(concept["user_need"], f"{concept_id} user_need")
        element_ref = _nullable_string(
            concept["element_ref"], f"{concept_id} element_ref"
        )
        if disposition == "hidden_internal":
            if user_need is not None or element_ref is not None:
                raise GovernanceContractError(
                    f"hidden_internal system concept must not bind a user need or visible element: {concept_id}"
                )
        elif user_need is None or element_ref is None:
            raise GovernanceContractError(
                f"visible system concept requires a user need and element_ref: {concept_id}"
            )

    deviation = _object(model["deviation"], "interaction_model deviation")
    _exact_fields(
        deviation,
        {"status", "reason", "evidence_refs"},
        "interaction_model deviation",
    )
    deviation_status = _enum(
        deviation["status"],
        {"conforming", "evidence_backed"},
        "interaction_model deviation status",
    )
    deviation_reason = _nullable_string(
        deviation["reason"], "interaction_model deviation reason"
    )
    deviation_refs = _string_list(
        deviation["evidence_refs"], "interaction_model deviation evidence_refs"
    )
    if deviation_status == "conforming":
        if deviation_reason is not None or deviation_refs:
            raise GovernanceContractError(
                "conforming interaction_model deviation requires null reason and no evidence refs"
            )
    elif deviation_reason is None or not deviation_refs:
        raise GovernanceContractError(
            "evidence_backed interaction_model deviation requires reason and evidence refs"
        )
    return model


def _validate_journey(value: Any) -> dict[str, Any]:
    journey = _object(value, "journey")
    _exact_fields(
        journey,
        {
            "entry",
            "preconditions",
            "primary_action",
            "system_response",
            "success_signal",
            "next_action",
            "boundaries",
        },
        "journey",
    )
    for key in (
        "entry",
        "primary_action",
        "system_response",
        "success_signal",
        "next_action",
    ):
        _string(journey[key], f"journey {key}")
    _string_list(journey["preconditions"], "journey preconditions")
    boundaries = journey["boundaries"]
    if not isinstance(boundaries, list):
        raise GovernanceContractError("journey boundaries must be a list")
    boundary_ids: set[str] = set()
    for index, raw_boundary in enumerate(boundaries):
        boundary = _object(raw_boundary, f"journey boundary {index}")
        _exact_fields(
            boundary,
            {"id", "status", "expected"},
            f"journey boundary {index}",
        )
        boundary_id = _enum(
            boundary["id"], JOURNEY_BOUNDARY_IDS, f"journey boundary {index} id"
        )
        if boundary_id in boundary_ids:
            raise GovernanceContractError(
                f"duplicate journey boundary: {boundary_id}"
            )
        boundary_ids.add(boundary_id)
        _enum(
            boundary["status"],
            {"applicable", "out_of_scope"},
            f"{boundary_id} status",
        )
        _string(boundary["expected"], f"{boundary_id} expected")
    if boundary_ids != JOURNEY_BOUNDARY_IDS:
        raise GovernanceContractError(
            "journey boundaries must cover cancel_back, error_recovery, refresh_resume, deep_link, and role_handoff exactly once"
        )
    return journey


def _validate_stable_reference(
    value: Any, *, constraint_paths: list[str]
) -> dict[str, Any]:
    stable = _object(value, "stable_reference")
    _exact_fields(
        stable, {"status", "role", "kind", "ref", "sha256"}, "stable_reference"
    )
    status = _enum(stable["status"], {"present", "absent"}, "stable_reference status")
    role = _enum(stable["role"], DELIVERY_REFERENCE_ROLES, "stable_reference role")
    kind = _enum(stable["kind"], DELIVERY_REFERENCE_KINDS, "stable_reference kind")
    if status == "present":
        if role == "constraint_set" or kind == "none":
            raise GovernanceContractError(
                "present stable_reference requires a concrete reference role and kind"
            )
        ref = _string(stable["ref"], "stable_reference ref")
        if kind == "repo_path":
            _repo_path(ref, "stable_reference ref")
        _digest(stable["sha256"], "stable_reference sha256")
    else:
        if role != "constraint_set" or kind != "none":
            raise GovernanceContractError(
                "absent stable_reference must bind the constraint_set role and none kind"
            )
        if stable["ref"] is not None or stable["sha256"] is not None:
            raise GovernanceContractError(
                "absent stable_reference requires null ref and sha256"
            )
        if not constraint_paths:
            raise GovernanceContractError(
                "non-mechanical UI change requires a stable reference or constraint owners"
            )
    return stable


def _validate_visual_pairs(value: Any, label: str) -> list[dict[str, str]]:
    if not isinstance(value, list):
        raise GovernanceContractError(f"{label} must be a list")
    pairs: list[dict[str, str]] = []
    pair_ids: set[str] = set()
    reference_ids: set[str] = set()
    candidate_ids: set[str] = set()
    for index, raw_pair in enumerate(value):
        pair = _object(raw_pair, f"{label} item {index}")
        _exact_fields(
            pair,
            {
                "pair_id",
                "reference_artifact",
                "candidate_artifact",
                "viewport",
                "state",
                "theme",
            },
            f"{label} item {index}",
        )
        normalized = {
            key: _string(pair[key], f"{label} item {index} {key}")
            for key in (
                "pair_id",
                "reference_artifact",
                "candidate_artifact",
                "viewport",
                "state",
                "theme",
            )
        }
        if normalized["pair_id"] in pair_ids:
            raise GovernanceContractError(f"{label} contains duplicate pair_id")
        if normalized["reference_artifact"] in reference_ids:
            raise GovernanceContractError(f"{label} reuses a reference artifact")
        if normalized["candidate_artifact"] in candidate_ids:
            raise GovernanceContractError(f"{label} reuses a candidate artifact")
        pair_ids.add(normalized["pair_id"])
        reference_ids.add(normalized["reference_artifact"])
        candidate_ids.add(normalized["candidate_artifact"])
        pairs.append(normalized)
    return pairs


def delivery_shape_pre_lock_digest(value: Any) -> str:
    record = _object(value, "delivery shape pre-lock")
    if (
        record.get("schema") != DELIVERY_SHAPE_SCHEMA
        or record.get("phase") != "pre_implementation"
    ):
        raise GovernanceContractError(
            "pre-lock digest requires a v3 pre_implementation record"
        )
    canonical = json.dumps(
        record, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def validate_delivery_shape_lock(value: Any, context_value: Any) -> dict[str, Any]:
    record = _object(value, "delivery shape lock")
    context = _object(context_value, "delivery shape context")
    phase = _enum(
        record.get("phase"), {"pre_implementation", "acceptance"}, "phase"
    )
    expected_fields = set(DELIVERY_COMMON_FIELDS)
    if phase == "acceptance":
        expected_fields.update({"pre_lock_digest", "source_revision"})
    _exact_fields(record, expected_fields, "delivery shape lock")
    _exact_fields(context, DELIVERY_CONTEXT_FIELDS, "delivery shape context")
    if record["schema"] != DELIVERY_SHAPE_SCHEMA:
        raise GovernanceContractError("delivery shape lock schema is invalid")
    if context["expected_phase"] != phase:
        raise GovernanceContractError(
            "delivery shape phase does not match host context"
        )
    _string(context["project_root"], "project_root")
    expected_source_revision = _string(
        context["expected_source_revision"], "expected_source_revision"
    )

    target_surface = _string(record["target_surface"], "target_surface")
    if target_surface != _string(
        context["expected_target_surface"], "expected_target_surface"
    ):
        raise GovernanceContractError("target surface does not match host context")
    if record["non_mechanical"] is not True:
        raise GovernanceContractError(
            "Delivery Shape Lock v3 applies to non-mechanical UI changes; "
            "lightweight corrections stay outside this record"
        )

    owner_paths = _string_list(
        record["owner_paths"], "owner_paths", allow_empty=False
    )
    constraint_paths = _string_list(
        record["constraint_owner_paths"], "constraint_owner_paths"
    )
    expected_owner_paths = _string_list(
        context["expected_owner_paths"], "expected_owner_paths", allow_empty=False
    )
    expected_constraint_paths = _string_list(
        context["expected_constraint_owner_paths"],
        "expected_constraint_owner_paths",
    )
    for label, paths in (
        ("owner_paths", owner_paths),
        ("constraint_owner_paths", constraint_paths),
        ("expected_owner_paths", expected_owner_paths),
        ("expected_constraint_owner_paths", expected_constraint_paths),
    ):
        for index, path in enumerate(paths):
            _repo_path(path, f"{label} item {index}")
    if (
        owner_paths != expected_owner_paths
        or constraint_paths != expected_constraint_paths
    ):
        raise GovernanceContractError(
            "delivery shape owners do not match host context"
        )

    allowed = set(
        _string_list(
            record["allowed_regions"], "allowed_regions", allow_empty=False
        )
    )
    unchanged = set(
        _string_list(record["unchanged_regions"], "unchanged_regions")
    )
    proposed = set(
        _string_list(
            record["proposed_changed_regions"],
            "proposed_changed_regions",
            allow_empty=False,
        )
    )
    if allowed & unchanged:
        raise GovernanceContractError(
            "allowed_regions and unchanged_regions must be disjoint"
        )
    if not proposed <= allowed:
        raise GovernanceContractError("proposed change exceeds allowed regions")

    user_task = _object(record["user_task"], "user_task")
    _exact_fields(
        user_task,
        {"primary_user", "single_job", "success_signal"},
        "user_task",
    )
    for key in ("primary_user", "single_job", "success_signal"):
        _string(user_task[key], f"user_task {key}")

    interaction_model = _validate_interaction_model(record["interaction_model"])
    _validate_journey(record["journey"])

    stable = _validate_stable_reference(
        record["stable_reference"], constraint_paths=constraint_paths
    )
    expected_stable = _validate_stable_reference(
        context["expected_stable_reference"],
        constraint_paths=expected_constraint_paths,
    )
    if stable != expected_stable:
        raise GovernanceContractError(
            "stable reference does not match host context; "
            "candidate cannot self-authenticate"
        )

    raw_elements = record["introduced_or_changed_elements"]
    if not isinstance(raw_elements, list) or not raw_elements:
        raise GovernanceContractError(
            "introduced_or_changed_elements must be a non-empty list"
        )
    elements: dict[str, dict[str, Any]] = {}
    visible_semantic_kinds: set[str] = set()
    for index, raw_element in enumerate(raw_elements):
        element = _object(raw_element, f"introduced element {index}")
        _exact_fields(
            element,
            {
                "id",
                "kind",
                "user_need",
                "source_owner",
                "visibility",
                "display_condition",
            },
            f"introduced element {index}",
        )
        element_id = _string(element["id"], f"introduced element {index} id")
        if element_id in elements:
            raise GovernanceContractError(
                f"duplicate introduced element id: {element_id}"
            )
        kind = _enum(
            element["kind"], DELIVERY_ELEMENT_KINDS, f"{element_id} kind"
        )
        visibility = _enum(
            element["visibility"],
            DELIVERY_VISIBILITIES,
            f"{element_id} visibility",
        )
        _string(element["user_need"], f"{element_id} user_need")
        _string(element["source_owner"], f"{element_id} source_owner")
        condition = _string(
            element["display_condition"], f"{element_id} display_condition"
        )
        if visibility == "hidden_internal" and condition != "never_visible":
            raise GovernanceContractError(
                "hidden_internal element must use never_visible "
                f"display_condition: {element_id}"
            )
        if visibility != "hidden_internal":
            visible_semantic_kinds.add(kind)
        elements[element_id] = element
    if not visible_semantic_kinds:
        raise GovernanceContractError(
            "delivery shape must contain at least one user-visible element"
        )
    for concept in interaction_model["system_concepts"]:
        if concept["disposition"] == "hidden_internal":
            continue
        element = elements.get(concept["element_ref"])
        if element is None or element["visibility"] == "hidden_internal":
            raise GovernanceContractError(
                "visible system concept must bind a known user-visible element: "
                f"{concept['id']}"
            )

    projection = _object(
        record["source_schema_projection"], "source_schema_projection"
    )
    _exact_fields(
        projection, {"status", "fields"}, "source_schema_projection"
    )
    projection_status = _enum(
        projection["status"],
        {"not_applicable", "complete"},
        "source_schema_projection status",
    )
    expected_source_ids = _string_list(
        context["expected_source_field_ids"], "expected_source_field_ids"
    )
    raw_fields = projection["fields"]
    if not isinstance(raw_fields, list):
        raise GovernanceContractError(
            "source_schema_projection fields must be a list"
        )
    projected_ids: list[str] = []
    for index, raw_field in enumerate(raw_fields):
        field = _object(raw_field, f"source projection field {index}")
        _exact_fields(
            field,
            {"source_id", "disposition", "element_ref"},
            f"source projection field {index}",
        )
        source_id = _string(
            field["source_id"], f"source projection field {index} source_id"
        )
        if source_id in projected_ids:
            raise GovernanceContractError(
                f"duplicate source projection field: {source_id}"
            )
        projected_ids.append(source_id)
        disposition = _enum(
            field["disposition"],
            SOURCE_FIELD_DISPOSITIONS,
            f"{source_id} disposition",
        )
        element_ref = _nullable_string(
            field["element_ref"], f"{source_id} element_ref"
        )
        if disposition in {"visible", "derived", "advanced"}:
            if element_ref is None or element_ref not in elements:
                raise GovernanceContractError(
                    f"{source_id} visible projection requires a known element_ref"
                )
            visibility = elements[element_ref]["visibility"]
            if visibility == "hidden_internal":
                raise GovernanceContractError(
                    f"{source_id} cannot project to hidden_internal element"
                )
            if disposition == "advanced" and visibility != "advanced":
                raise GovernanceContractError(
                    f"{source_id} advanced projection requires advanced visibility"
                )
        elif element_ref is not None:
            raise GovernanceContractError(
                f"{source_id} {disposition} projection requires null element_ref"
            )
    if projection_status == "not_applicable":
        if raw_fields or expected_source_ids:
            raise GovernanceContractError(
                "not_applicable source schema projection requires "
                "no host source fields"
            )
    elif not expected_source_ids or set(projected_ids) != set(
        expected_source_ids
    ):
        raise GovernanceContractError(
            "source schema projection does not match host context"
        )

    _string_list(
        record["interaction_states"], "interaction_states", allow_empty=False
    )
    requirements = _object(
        record["acceptance_requirements"], "acceptance_requirements"
    )
    _exact_fields(
        requirements,
        {
            "affected_viewports",
            "reference_comparison_required",
            "dom_semantics_required",
            "keyboard_required",
        },
        "acceptance_requirements",
    )
    _string_list(
        requirements["affected_viewports"],
        "affected_viewports",
        allow_empty=False,
    )
    for key in (
        "reference_comparison_required",
        "dom_semantics_required",
        "keyboard_required",
    ):
        if not isinstance(requirements[key], bool):
            raise GovernanceContractError(f"{key} must be boolean")
    if (
        stable["status"] == "present"
        and not requirements["reference_comparison_required"]
    ):
        raise GovernanceContractError(
            "concrete stable reference requires reference comparison"
        )
    if (
        visible_semantic_kinds - {"decoration"}
        and not requirements["dom_semantics_required"]
    ):
        raise GovernanceContractError(
            "user-visible semantic elements require DOM semantics evidence"
        )
    if (
        visible_semantic_kinds & {"field", "action", "navigation"}
        and not requirements["keyboard_required"]
    ):
        raise GovernanceContractError(
            "interactive elements require keyboard evidence"
        )

    expected_visual_pairs = _validate_visual_pairs(
        context["expected_visual_pairs"], "expected_visual_pairs"
    )
    expected_dom_refs = _string_list(
        context["expected_dom_snapshot_refs"], "expected_dom_snapshot_refs"
    )
    expected_interaction_refs = _string_list(
        context["expected_interaction_refs"], "expected_interaction_refs"
    )
    expected_changed_refs = _string_list(
        context["expected_changed_region_refs"],
        "expected_changed_region_refs",
    )
    expected_unchanged_refs = _string_list(
        context["expected_unchanged_region_refs"],
        "expected_unchanged_region_refs",
    )
    expected_review_ref = _nullable_string(
        context["expected_independent_review_ref"],
        "expected_independent_review_ref",
    )

    if phase == "pre_implementation":
        if record["acceptance_evidence"] is not None:
            raise GovernanceContractError(
                "pre_implementation requires null acceptance_evidence"
            )
        if context["expected_pre_lock_digest"] is not None:
            raise GovernanceContractError(
                "pre_implementation context requires null "
                "expected_pre_lock_digest"
            )
        if any(
            (
                expected_visual_pairs,
                expected_dom_refs,
                expected_interaction_refs,
                expected_changed_refs,
                expected_unchanged_refs,
            )
        ) or expected_review_ref is not None:
            raise GovernanceContractError(
                "pre_implementation context must not claim acceptance artifacts"
            )
        return record

    source_revision = _string(record["source_revision"], "source_revision")
    if source_revision != expected_source_revision:
        raise GovernanceContractError(
            "delivery shape source revision does not match host context"
        )
    pre_lock_digest = _digest(
        record["pre_lock_digest"], "pre_lock_digest"
    )
    expected_pre_lock_digest = _digest(
        context["expected_pre_lock_digest"], "expected_pre_lock_digest"
    )
    if pre_lock_digest != expected_pre_lock_digest:
        raise GovernanceContractError(
            "pre-lock digest does not match host context"
        )
    normalized_pre = {
        key: record[key]
        for key in DELIVERY_COMMON_FIELDS
        if key != "acceptance_evidence"
    }
    normalized_pre["phase"] = "pre_implementation"
    normalized_pre["acceptance_evidence"] = None
    if delivery_shape_pre_lock_digest(normalized_pre) != pre_lock_digest:
        raise GovernanceContractError(
            "acceptance record drifted from the bound pre-lock"
        )

    evidence = _object(
        record["acceptance_evidence"], "acceptance_evidence"
    )
    _exact_fields(
        evidence,
        {
            "visual_pairs",
            "dom_snapshot_refs",
            "interaction_refs",
            "changed_region_refs",
            "unchanged_region_refs",
            "independent_review_ref",
        },
        "acceptance_evidence",
    )
    visual_pairs = _validate_visual_pairs(
        evidence["visual_pairs"], "visual_pairs"
    )
    dom_refs = _string_list(
        evidence["dom_snapshot_refs"], "dom_snapshot_refs"
    )
    interaction_refs = _string_list(
        evidence["interaction_refs"], "interaction_refs"
    )
    changed_refs = _string_list(
        evidence["changed_region_refs"], "changed_region_refs"
    )
    unchanged_refs = _string_list(
        evidence["unchanged_region_refs"], "unchanged_region_refs"
    )
    review_ref = _string(
        evidence["independent_review_ref"], "independent_review_ref"
    )
    if visual_pairs != expected_visual_pairs:
        raise GovernanceContractError(
            "reference/candidate viewport, state, and theme must match "
            "host-authenticated pairs"
        )
    if (
        dom_refs != expected_dom_refs
        or interaction_refs != expected_interaction_refs
        or changed_refs != expected_changed_refs
        or unchanged_refs != expected_unchanged_refs
        or review_ref != expected_review_ref
    ):
        raise GovernanceContractError(
            "acceptance evidence does not match host context"
        )
    if (
        requirements["reference_comparison_required"]
        and not visual_pairs
    ):
        raise GovernanceContractError(
            "reference comparison requires a visual evidence pair"
        )
    if requirements["dom_semantics_required"] and not dom_refs:
        raise GovernanceContractError(
            "DOM semantics require a DOM or accessibility snapshot"
        )
    if requirements["keyboard_required"] and not interaction_refs:
        raise GovernanceContractError(
            "keyboard acceptance requires an interaction trace"
        )
    if not changed_refs:
        raise GovernanceContractError(
            "acceptance requires changed-region evidence"
        )
    if unchanged and not unchanged_refs:
        raise GovernanceContractError(
            "acceptance requires unchanged-region evidence"
        )
    return record


def _release_evidence(value: Any, label: str) -> dict[str, Any]:
    evidence = _object(value, label)
    _exact_fields(evidence, {"status", "evidence_refs"}, label)
    status = _enum(evidence["status"], {"collected", "unverified", "failed"}, f"{label} status")
    refs = _string_list(evidence["evidence_refs"], f"{label} evidence_refs")
    if status == "collected" and not refs:
        raise GovernanceContractError(f"{label} collected status requires evidence_refs")
    if status != "collected" and refs:
        raise GovernanceContractError(f"{label} non-collected status requires empty evidence_refs")
    return {"status": status, "evidence_refs": refs}


def validate_release_readiness(value: Any, context_value: Any) -> dict[str, Any]:
    record = _object(value, "release readiness")
    context = _object(context_value, "release readiness context")
    _exact_fields(
        record,
        {
            "schema",
            "artifact_identity",
            "source_revision",
            "target",
            "funds_mode",
            "risk_lanes",
            "evidence_planes",
            "protected_controls",
            "verdict",
            "blockers",
        },
        "release readiness",
    )
    _exact_fields(
        context,
        {"expected_artifact_identity", "expected_source_revision", "expected_risk_lanes"},
        "release readiness context",
    )
    if record["schema"] != RELEASE_SCHEMA:
        raise GovernanceContractError("release readiness schema is invalid")
    artifact = _string(record["artifact_identity"], "artifact_identity")
    revision = _string(record["source_revision"], "source_revision")
    if artifact != _string(context["expected_artifact_identity"], "expected_artifact_identity"):
        raise GovernanceContractError("release artifact identity does not match host context")
    if revision != _string(context["expected_source_revision"], "expected_source_revision"):
        raise GovernanceContractError("release source revision does not match host context")
    _enum(record["target"], {"demo", "internal", "production"}, "target")
    funds_mode = _enum(record["funds_mode"], {"none", "sandbox", "real"}, "funds_mode")
    risk_lanes = _string_list(record["risk_lanes"], "risk_lanes")
    expected_lanes = _string_list(context["expected_risk_lanes"], "expected_risk_lanes")
    if risk_lanes != expected_lanes:
        raise GovernanceContractError("release risk lanes do not match host context")

    planes = _object(record["evidence_planes"], "evidence_planes")
    _exact_fields(planes, RELEASE_EVIDENCE_PLANES, "evidence_planes")
    normalized_planes = {
        key: _release_evidence(planes[key], f"evidence_planes.{key}")
        for key in sorted(RELEASE_EVIDENCE_PLANES)
    }
    controls = _object(record["protected_controls"], "protected_controls")
    normalized_controls = {
        key: _release_evidence(item, f"protected_controls.{key}")
        for key, item in controls.items()
    }
    verdict = _enum(
        record["verdict"],
        {"artifact_only", "sandbox_ready", "release_ready", "defer", "block"},
        "verdict",
    )
    blockers = _string_list(record["blockers"], "blockers")
    if "money_entitlement" in risk_lanes and funds_mode in {"sandbox", "real"}:
        if set(controls) != MONEY_RELEASE_CONTROLS:
            raise GovernanceContractError("money release controls are incomplete")
        money_complete = all(
            normalized_controls[key]["status"] == "collected"
            for key in MONEY_RELEASE_CONTROLS
        )
        protected_complete = (
            normalized_planes["protected_boundary"]["status"] == "collected"
            and normalized_planes["external_current_state"]["status"] == "collected"
        )
        if verdict in {"sandbox_ready", "release_ready"} and not (
            money_complete and protected_complete
        ):
            raise GovernanceContractError(
                "real-funds readiness requires collected protected evidence"
            )
    complete_planes = all(item["status"] == "collected" for item in normalized_planes.values())
    if verdict in {"sandbox_ready", "release_ready"} and not complete_planes:
        raise GovernanceContractError("ready verdict requires every release evidence plane")
    if verdict in {"sandbox_ready", "release_ready", "artifact_only"} and blockers:
        raise GovernanceContractError("ready or artifact-only verdict cannot retain blockers")
    if verdict in {"defer", "block"} and not blockers:
        raise GovernanceContractError("defer or block verdict requires blockers")
    if verdict == "sandbox_ready" and funds_mode != "sandbox":
        raise GovernanceContractError("sandbox_ready requires sandbox funds_mode")
    if verdict == "release_ready" and funds_mode == "sandbox":
        raise GovernanceContractError("sandbox funds cannot prove production release readiness")
    if verdict == "artifact_only" and funds_mode != "none":
        raise GovernanceContractError("artifact_only cannot authorize sandbox or real funds")

    return record


def _load(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise GovernanceContractError(f"cannot read {label}: {exc}") from exc
    return _object(value, label)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--kind", choices=("truth", "formal", "delivery-shape", "release"), required=True
    )
    parser.add_argument("--record", type=Path, required=True)
    parser.add_argument("--context", type=Path)
    args = parser.parse_args()
    try:
        record = _load(args.record, "record")
        if args.kind == "truth":
            if args.context is not None:
                raise GovernanceContractError("truth validation does not accept --context")
            validate_truth_resolution(record)
        elif args.kind == "formal":
            if args.context is None:
                raise GovernanceContractError("formal validation requires --context")
            validate_formal_materialization(record, _load(args.context, "context"))
        elif args.kind == "delivery-shape":
            if args.context is None:
                raise GovernanceContractError(
                    "delivery shape validation requires --context"
                )
            validate_delivery_shape_lock(record, _load(args.context, "context"))
        else:
            if args.context is None:
                raise GovernanceContractError("release validation requires --context")
            validate_release_readiness(record, _load(args.context, "context"))
    except GovernanceContractError as exc:
        print(f"FAIL: {exc}")
        return 1
    print(f"OK: {args.kind} governance contract valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
