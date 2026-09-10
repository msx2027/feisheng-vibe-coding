#!/usr/bin/env python3
"""Shared closed enums and validators for Sliver task decisions.

This module owns executable validation only. Human-readable semantics and the
route operation/delivery projection remain in the reference owners. It performs
no model inference and writes no task files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import warnings
import os
from pathlib import Path
from typing import Any, Optional

from validation_support import ContractError, markdown_section, read_utf8, split_table_row


class LoadedOwnerDiagnosticWarning(UserWarning):
    """A valid decision loaded known owners that its recorded impacts do not require."""


TASK_DECISION_SCHEMA = "sliver-task-decision/v1"
PLAN_TARGET_KINDS = {
    "explicit_path",
    "active_internal_truth",
    "task_temporary",
    "task_durable",
}
STABLE_TASK_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")

DECISION_STATUSES = {
    "resolved",
    "split_required",
    "unresolved_safe",
    "unresolved_protected_stop",
    "unresolved_product_stop",
    "invalid",
}
DELIVERY_KINDS = {
    "implementation",
    "behavior_verification",
    "audit",
    "diagnosis",
    "decision",
    "design",
    "verification",
    "handoff",
    "direct_artifact",
}

ROUTE_PROJECTION_HEADER = (
    "Route",
    "Purpose and operation rule",
    "Operation -> delivery projection",
    "Load",
)
LENS_PROJECTION_HEADER = (
    "Lens",
    "Apply when impact evidence shows",
    "Load",
)
_CODE_SPAN_PATTERN = re.compile(r"`([^`\n]+)`")
_TABLE_SEPARATOR_PATTERN = re.compile(r":?-{3,}:?")


def _code_span(value: str, *, label: str) -> str:
    match = _CODE_SPAN_PATTERN.fullmatch(value.strip())
    if not match:
        raise ContractError(f"{label} must be one exact Markdown code span")
    return match.group(1)


def _parse_operation_delivery_projection(
    cell: str, *, route: str
) -> dict[str, tuple[str, ...]]:
    projection: dict[str, tuple[str, ...]] = {}
    clauses = [clause.strip() for clause in cell.split(";")]
    if not clauses or any(not clause for clause in clauses):
        raise ContractError(f"route projection contains an empty clause: {route}")
    for clause in clauses:
        parts = clause.split("->")
        if len(parts) != 2:
            raise ContractError(
                f"route projection must use one operation -> delivery boundary: {route}"
            )
        operation = _code_span(parts[0], label=f"route operation for {route}")
        if operation in projection:
            raise ContractError(f"route projection duplicates an operation: {route}: {operation}")
        delivery_tokens = [token.strip() for token in parts[1].split(",")]
        if not delivery_tokens or any(not token for token in delivery_tokens):
            raise ContractError(f"route projection has an empty delivery: {route}: {operation}")
        deliveries = tuple(
            _code_span(token, label=f"route delivery for {route}/{operation}")
            for token in delivery_tokens
        )
        if len(deliveries) != len(set(deliveries)):
            raise ContractError(f"route projection duplicates a delivery: {route}: {operation}")
        unknown_deliveries = sorted(set(deliveries) - DELIVERY_KINDS)
        if unknown_deliveries:
            raise ContractError(
                f"route projection has unsupported deliveries for {route}/{operation}: "
                f"{', '.join(unknown_deliveries)}"
            )
        projection[operation] = deliveries
    return projection


def parse_route_registry_rows(registry_text: str) -> list[dict[str, Any]]:
    """Parse exact canonical cells from the sole routes registry owner."""
    section = markdown_section(registry_text, "Primary Workflow Routes")
    if section is None:
        raise ContractError("routes registry missing active Primary Workflow Routes section")
    lines = section.splitlines()
    header_indexes = [
        index
        for index, line in enumerate(lines)
        if tuple(split_table_row(line)) == ROUTE_PROJECTION_HEADER
    ]
    if len(header_indexes) != 1:
        raise ContractError("routes registry must contain one canonical projection table header")
    header_index = header_indexes[0]
    if header_index + 1 >= len(lines):
        raise ContractError("routes registry projection table is missing its separator")
    separator = split_table_row(lines[header_index + 1])
    if len(separator) != len(ROUTE_PROJECTION_HEADER) or any(
        not _TABLE_SEPARATOR_PATTERN.fullmatch(cell) for cell in separator
    ):
        raise ContractError("routes registry projection table has an invalid separator")

    rows: list[dict[str, Any]] = []
    routes: set[str] = set()
    for line in lines[header_index + 2 :]:
        cells = split_table_row(line)
        if not cells:
            if rows:
                break
            continue
        if len(cells) != len(ROUTE_PROJECTION_HEADER):
            raise ContractError("routes registry projection rows must have exactly four cells")
        route = _code_span(cells[0], label="route key")
        if "/" in route:
            raise ContractError(f"route key must not contain '/': {route}")
        if route in routes:
            raise ContractError(f"routes registry duplicates a primary route: {route}")
        purpose = cells[1]
        load = cells[3]
        if not purpose or not load:
            raise ContractError(f"routes registry purpose/load cells must be non-empty: {route}")
        rows.append(
            {
                "route": route,
                "purpose": purpose,
                "operations": _parse_operation_delivery_projection(cells[2], route=route),
                "load": load,
            }
        )
        routes.add(route)
    if not rows:
        raise ContractError("routes registry projection table must define at least one route")
    return rows


def parse_lens_registry_rows(registry_text: str) -> list[dict[str, str]]:
    """Parse exact canonical conditional-lens cells from the sole registry owner."""

    section = markdown_section(registry_text, "Conditional Development Lenses")
    if section is None:
        raise ContractError("routes registry missing active Conditional Development Lenses section")
    lines = section.splitlines()
    header_indexes = [
        index
        for index, line in enumerate(lines)
        if tuple(split_table_row(line)) == LENS_PROJECTION_HEADER
    ]
    if len(header_indexes) != 1:
        raise ContractError("routes registry must contain one canonical lens projection table header")
    header_index = header_indexes[0]
    if header_index + 1 >= len(lines):
        raise ContractError("routes registry lens projection table is missing its separator")
    separator = split_table_row(lines[header_index + 1])
    if len(separator) != len(LENS_PROJECTION_HEADER) or any(
        not _TABLE_SEPARATOR_PATTERN.fullmatch(cell) for cell in separator
    ):
        raise ContractError("routes registry lens projection table has an invalid separator")

    rows: list[dict[str, str]] = []
    lenses: set[str] = set()
    for line in lines[header_index + 2 :]:
        cells = split_table_row(line)
        if not cells:
            if rows:
                break
            continue
        if len(cells) != len(LENS_PROJECTION_HEADER):
            raise ContractError("routes registry lens projection rows must have exactly three cells")
        lens = _code_span(cells[0], label="lens key")
        if "/" in lens or lens in lenses:
            raise ContractError(f"routes registry lens key is invalid or duplicated: {lens}")
        impact = cells[1]
        load = cells[2]
        if not impact or not load:
            raise ContractError(f"routes registry lens impact/load cells must be non-empty: {lens}")
        rows.append({"lens": lens, "impact": impact, "load": load})
        lenses.add(lens)
    if not rows:
        raise ContractError("routes registry lens projection table must define at least one lens")
    return rows


def load_route_registry_rows(
    registry_path: Optional[Path] = None,
) -> list[dict[str, Any]]:
    path = registry_path or Path(__file__).resolve().parents[1] / "references/routes-index.md"
    return parse_route_registry_rows(read_utf8(path))


def load_lens_registry_rows(
    registry_path: Optional[Path] = None,
) -> list[dict[str, str]]:
    path = registry_path or Path(__file__).resolve().parents[1] / "references/routes-index.md"
    return parse_lens_registry_rows(read_utf8(path))


def load_route_operation_delivery_matrix(
    registry_path: Optional[Path] = None,
) -> dict[str, dict[str, tuple[str, ...]]]:
    """Load the closed runtime projection from its sole routes registry owner."""

    return {
        row["route"]: row["operations"]
        for row in load_route_registry_rows(registry_path)
    }


def parse_route_operation_delivery_matrix(
    registry_text: str,
) -> dict[str, dict[str, tuple[str, ...]]]:
    """Parse the executable route projection from registry text or a Git object."""

    return {
        row["route"]: row["operations"]
        for row in parse_route_registry_rows(registry_text)
    }


def _route_source(path: Path) -> dict[str, str]:
    raw = path.read_bytes()
    try:
        relative = path.resolve().relative_to(Path(__file__).resolve().parents[1])
        label = relative.as_posix()
    except ValueError:
        label = path.resolve().as_posix()
    return {"path": label, "sha256": hashlib.sha256(raw).hexdigest()}


def build_route_catalog(registry_path: Optional[Path] = None) -> dict[str, Any]:
    path = (registry_path or Path(__file__).resolve().parents[1] / "references/routes-index.md").resolve()
    rows = load_route_registry_rows(path)
    return {
        "schema": "sliver-route-catalog/v1",
        "source": _route_source(path),
        "routes": [
            {
                "route": row["route"],
                "purpose": row["purpose"],
                "operations": list(row["operations"]),
            }
            for row in rows
        ],
    }


def build_lens_catalog(registry_path: Optional[Path] = None) -> dict[str, Any]:
    path = (registry_path or Path(__file__).resolve().parents[1] / "references/routes-index.md").resolve()
    rows = load_lens_registry_rows(path)
    return {
        "schema": "sliver-lens-catalog/v1",
        "source": _route_source(path),
        "lenses": [
            {"lens": row["lens"], "impact": row["impact"]}
            for row in rows
        ],
    }


def build_route_projection(
    route: str, registry_path: Optional[Path] = None
) -> dict[str, Any]:
    path = (registry_path or Path(__file__).resolve().parents[1] / "references/routes-index.md").resolve()
    rows = load_route_registry_rows(path)
    matches = [row for row in rows if row["route"] == route]
    if len(matches) != 1:
        raise ContractError(f"route projection requires one canonical route: {route}")
    row = matches[0]
    return {
        "schema": "sliver-route-projection/v1",
        "source": _route_source(path),
        "route": row["route"],
        "purpose": row["purpose"],
        "operation_delivery": {
            operation: list(deliveries)
            for operation, deliveries in row["operations"].items()
        },
        "load": row["load"],
    }


def build_lens_projection(
    lens: str, registry_path: Optional[Path] = None
) -> dict[str, Any]:
    path = (registry_path or Path(__file__).resolve().parents[1] / "references/routes-index.md").resolve()
    rows = load_lens_registry_rows(path)
    matches = [row for row in rows if row["lens"] == lens]
    if len(matches) != 1:
        raise ContractError(f"lens projection requires one canonical lens: {lens}")
    row = matches[0]
    return {
        "schema": "sliver-lens-projection/v1",
        "source": _route_source(path),
        "lens": row["lens"],
        "impact": row["impact"],
        "load": row["load"],
    }


ROUTE_OPERATION_DELIVERY_MATRIX = load_route_operation_delivery_matrix()
ROUTE_OPERATION_MATRIX = {
    route: tuple(operations) for route, operations in ROUTE_OPERATION_DELIVERY_MATRIX.items()
}
TASK_DEPTHS = {"D0", "D1", "D2", "D3"}
DEPTH_RULES = {
    "D0": "direct_bounded_contract",
    "D1": "single_owner_established_contract",
    "D2": "multi_owner_joint_contract",
    "D3": "foundation_or_program_topology",
}
RISK_LANE_IDS = {
    "identity_permission",
    "privacy_secret_data",
    "money_entitlement",
    "persistent_data_schema",
    "public_contract_compatibility",
    "external_provider_effect",
    "supply_chain_config",
    "license_legal_content",
    "physical_safety_device",
    "resource_reliability",
}
EVIDENCE_MODES = {"test", "route"}
TEST_LEVELS = {"T0", "T1", "T2", "T3", "T4"}
ROUTE_EVIDENCE_KINDS = {
    "audit",
    "diagnosis",
    "decision",
    "design",
    "verification",
    "handoff",
}
EVIDENCE_STATUSES = {"planned", "collected", "unverified", "failed"}
EFFECT_CLASSES = {"none", "local_reversible", "controlled"}
AUTHORIZATION_TIERS = {
    "read_only",
    "local_reversible",
    "git_history",
    "external_write",
    "critical_operation",
}
AUTHORIZATION_STATUSES = {"satisfied", "insufficient", "blocked_unknown"}
OPERATIONAL_MODES = {"planned", "urgent", "incident"}
DISCOVERY_OUTCOMES = {
    "resolved",
    "unresolved_safe",
    "unresolved_protected_stop",
    "unresolved_product_stop",
}
STUDIO_DECISIONS = {
    "recommend_studio",
    "do_not_recommend",
    "resolve_boundaries_first",
}
DELEGATION_DECISIONS = {"current_only", "use_subagents"}
LOADED_OWNER_IDS = {
    "routes",
    "task_depth",
    "testing",
    "effect_recovery",
    "risk_control",
    "studio_execution",
    "project_flow",
    "plan_artifact",
    "truth_capture",
    "audit_artifact",
}
TRUTH_CAPTURE_DECISIONS = {
    "update_existing",
    "create_new",
    "merge_into",
    "supersede",
    "not_needed",
    "deferred",
}
TRUTH_CAPTURE_WRITE_DECISIONS = {
    "update_existing",
    "create_new",
    "merge_into",
    "supersede",
}
TRUTH_CAPTURE_AUTHORIZATION_STATUSES = {
    "pending",
    "confirmed",
    "declined",
    "not_applicable",
}
AUDIT_PASSES = {"triage", "deep", "review", "reviewed_pending_promotion", "closed"}
AUDIT_ALLOWED_ACTIONS = {
    "read",
    "audit",
    "stateless_verify",
    "test",
    "build",
    "audit_artifact",
}

TEST_DELIVERIES = {"implementation", "behavior_verification"}
ROUTE_DELIVERY_TO_EVIDENCE = {
    "audit": "audit",
    "diagnosis": "diagnosis",
    "decision": "decision",
    "design": "design",
    "verification": "verification",
    "handoff": "handoff",
}

ACTION_MINIMUM_TIERS = {
    "read": "read_only",
    "audit": "read_only",
    "design": "read_only",
    "plan": "read_only",
    "plan_artifact": "local_reversible",
    "truth_doc_write": "local_reversible",
    "audit_artifact": "local_reversible",
    "stateless_verify": "read_only",
    "local_edit": "local_reversible",
    "build": "local_reversible",
    "test": "local_reversible",
    "isolated_cleanup": "local_reversible",
    "stage": "git_history",
    "commit": "git_history",
    "push": "external_write",
    "third_party_write": "external_write",
    "send_message": "external_write",
    "create_external_resource": "external_write",
    "publish": "critical_operation",
    "deploy": "critical_operation",
    "production_change": "critical_operation",
    "migration": "critical_operation",
    "persistent_sample_write": "critical_operation",
    "real_cost": "critical_operation",
    "credential": "critical_operation",
    "real_device_control": "critical_operation",
    "delete_existing_state": "critical_operation",
    "overwrite_existing_state": "critical_operation",
}

TIER_ORDER = {
    "read_only": 0,
    "local_reversible": 1,
    "git_history": 2,
    "external_write": 3,
    "critical_operation": 4,
}


def _require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be an object")
    return value


def _require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{label} must be a non-empty string")
    return value.strip()


def _require_bool(value: Any, label: str) -> bool:
    if not isinstance(value, bool):
        raise ContractError(f"{label} must be a boolean")
    return value


def _scope_target(value: Any, label: str) -> str:
    target = _require_string(value, label)
    if target == "**":
        return target
    if "\\" in target or target.startswith("/") or ".." in Path(target).parts:
        raise ContractError(f"{label} must be a normalized repository-relative target")
    if target.endswith("/**"):
        target = target[:-3]
    if not target or any(part in {"", ".", ".."} for part in target.split("/")):
        raise ContractError(f"{label} must be a normalized repository-relative target")
    return f"{target}/**" if str(value).endswith("/**") else target


def _scope_targets_overlap(left: str, right: str) -> bool:
    if left == "**" or right == "**":
        return True
    left_glob = left.endswith("/**")
    right_glob = right.endswith("/**")
    left_base = left[:-3] if left_glob else left
    right_base = right[:-3] if right_glob else right
    if not left_glob and not right_glob:
        return left_base == right_base
    if left_glob and right_glob:
        return (
            left_base == right_base
            or left_base.startswith(right_base + "/")
            or right_base.startswith(left_base + "/")
        )
    parent, child = (left_base, right_base) if left_glob else (right_base, left_base)
    return child == parent or child.startswith(parent + "/")


def validate_scope(
    value: Any,
    *,
    expected_excluded_targets: Optional[list[str]],
    decision_status: str,
) -> dict[str, Any]:
    scope = _require_object(value, "scope")
    if set(scope) != {"proposed_targets", "excluded_targets"}:
        raise ContractError("scope fields must be proposed_targets and excluded_targets")
    proposed_raw = scope.get("proposed_targets")
    excluded_raw = scope.get("excluded_targets")
    if not isinstance(proposed_raw, list) or not proposed_raw:
        raise ContractError("scope.proposed_targets must be a non-empty list")
    if not isinstance(excluded_raw, list):
        raise ContractError("scope.excluded_targets must be a list")
    proposed = [
        _scope_target(item, f"scope.proposed_targets item {index}")
        for index, item in enumerate(proposed_raw)
    ]
    excluded = [
        _scope_target(item, f"scope.excluded_targets item {index}")
        for index, item in enumerate(excluded_raw)
    ]
    if len(proposed) != len(set(proposed)) or len(excluded) != len(set(excluded)):
        raise ContractError("scope targets must not contain duplicates")
    if expected_excluded_targets is not None:
        expected = [
            _scope_target(item, f"expected_excluded_targets item {index}")
            for index, item in enumerate(expected_excluded_targets)
        ]
        if excluded != expected:
            raise ContractError("scope exclusions do not match host context")
    if decision_status == "resolved":
        for proposed_target in proposed:
            for excluded_target in excluded:
                if _scope_targets_overlap(proposed_target, excluded_target):
                    raise ContractError(
                        "proposed target intersects an explicitly excluded target: "
                        f"{proposed_target} / {excluded_target}"
                    )
    return scope


def _require_enum(value: Any, allowed: set[str], label: str) -> str:
    result = _require_string(value, label)
    if result not in allowed:
        raise ContractError(f"{label} has unsupported value: {result}")
    return result


def validate_risk_lanes(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ContractError("risk_lanes must be a list of stable IDs")
    if len(value) != len(set(value)):
        raise ContractError("risk_lanes must not contain duplicates")
    unknown = [item for item in value if item not in RISK_LANE_IDS]
    if unknown:
        raise ContractError(f"risk_lanes contain unsupported IDs: {', '.join(unknown)}")
    if value != sorted(value):
        raise ContractError("risk_lanes must be sorted")
    return value


def validate_evidence(
    value: Any,
    delivery_kind: str,
    *,
    require_status: bool = False,
) -> dict[str, Any]:
    evidence = _require_object(value, "evidence")
    mode = _require_enum(evidence.get("mode"), EVIDENCE_MODES, "evidence.mode")
    status = evidence.get("status")
    if require_status or status is not None:
        _require_enum(status, EVIDENCE_STATUSES, "evidence.status")
    test_level = evidence.get("test_level")
    route_kind = evidence.get("route_evidence_kind")

    if mode == "test":
        _require_enum(test_level, TEST_LEVELS, "evidence.test_level")
        if route_kind is not None:
            raise ContractError("test evidence requires route_evidence_kind: null")
        if delivery_kind not in TEST_DELIVERIES and delivery_kind != "direct_artifact":
            raise ContractError("non-implementation delivery cannot use test evidence")
    else:
        kind = _require_enum(
            route_kind,
            ROUTE_EVIDENCE_KINDS,
            "evidence.route_evidence_kind",
        )
        if test_level is not None:
            raise ContractError("route evidence requires test_level: null")
        expected = ROUTE_DELIVERY_TO_EVIDENCE.get(delivery_kind)
        if expected is not None and kind != expected:
            raise ContractError(
                f"{delivery_kind} delivery requires route evidence kind {expected}"
            )
        if delivery_kind in TEST_DELIVERIES:
            raise ContractError("implementation delivery requires test evidence")
    return evidence


def minimum_authorization_tier(actions: Any) -> str:
    action_list = [actions] if isinstance(actions, str) else actions
    if not isinstance(action_list, list) or not action_list:
        raise ContractError("actions must be a non-empty string or list")
    tiers: list[str] = []
    for action in action_list:
        if action not in ACTION_MINIMUM_TIERS:
            raise ContractError(f"unsupported action for authorization mapping: {action}")
        tiers.append(ACTION_MINIMUM_TIERS[action])
    return max(tiers, key=TIER_ORDER.__getitem__)


def validate_effect(value: Any) -> dict[str, Any]:
    effect = _require_object(value, "effect")
    effect_class = _require_enum(
        effect.get("effect_class"),
        EFFECT_CLASSES,
        "effect.effect_class",
    )
    required_tier = _require_enum(
        effect.get("required_tier"),
        AUTHORIZATION_TIERS,
        "effect.required_tier",
    )
    authorization_status = _require_enum(
        effect.get("authorization_status"),
        AUTHORIZATION_STATUSES,
        "effect.authorization_status",
    )
    exact_target = _require_string(effect.get("exact_target"), "effect.exact_target")
    if exact_target.casefold() in {"unknown", "tbd", "todo", "pending"}:
        raise ContractError("effect.exact_target must identify the bounded target")
    granted_tier = effect.get("granted_tier")
    authorization_evidence = effect.get("authorization_evidence")
    recovery_known = _require_bool(effect.get("recovery_known"), "effect.recovery_known")
    health_and_stop_required = _require_bool(
        effect.get("health_and_stop_required"),
        "effect.health_and_stop_required",
    )
    minimum_by_class = {
        "none": "read_only",
        "local_reversible": "local_reversible",
        "controlled": "git_history",
    }[effect_class]
    if TIER_ORDER[required_tier] < TIER_ORDER[minimum_by_class]:
        raise ContractError(
            f"{effect_class} effect cannot use authorization below {minimum_by_class}"
        )
    if effect_class == "none" and required_tier != "read_only":
        raise ContractError("none effect must use read_only authorization")
    if effect_class == "local_reversible" and required_tier != "local_reversible":
        raise ContractError("local_reversible effect must use matching authorization")
    action = _require_string(effect.get("action"), "effect.action")
    actual_minimum = minimum_authorization_tier(action)
    if required_tier != actual_minimum:
        raise ContractError(
            f"required_tier must be derived from action: {actual_minimum}"
        )
    if authorization_status == "satisfied":
        granted = _require_enum(
            granted_tier,
            AUTHORIZATION_TIERS,
            "effect.granted_tier",
        )
        if TIER_ORDER[granted] < TIER_ORDER[required_tier]:
            raise ContractError("effect.granted_tier is below effect.required_tier")
        _require_string(
            authorization_evidence,
            "effect.authorization_evidence",
        )
    else:
        if granted_tier is not None:
            _require_enum(
                granted_tier,
                AUTHORIZATION_TIERS,
                "effect.granted_tier",
            )
        if authorization_evidence is not None:
            _require_string(
                authorization_evidence,
                "effect.authorization_evidence",
            )
    if effect_class == "controlled" and authorization_status == "satisfied":
        if not recovery_known:
            raise ContractError("authorized controlled effect requires known recovery")
        if not health_and_stop_required:
            raise ContractError(
                "authorized controlled effect requires health and stop controls"
            )
    return effect


def _exact_document_target(value: Any, label: str) -> str:
    target = _require_string(value, label)
    if "@@" in target or ".." in Path(target).parts:
        raise ContractError(f"{label} must be an exact non-placeholder path")
    return target


def validate_truth_capture(
    value: Any,
    *,
    depth: str,
    effect: dict[str, Any],
) -> dict[str, Any]:
    """Validate the optional Truth Capture Gate block.

    Conversation conclusions become truth only through a user-confirmed
    Authorization Card. A new feature or decision document is written with
    action ``truth_doc_write``; an existing owner is changed with ``local_edit``.
    Neither write may happen before the card is confirmed.
    """

    capture = _require_object(value, "truth_capture")
    if set(capture) != {"decision", "target", "reason", "authorization_status"}:
        raise ContractError(
            "truth_capture fields must be decision, target, reason, authorization_status"
        )
    if depth == "D0":
        raise ContractError("D0 never runs the Truth Capture Gate")
    decision = _require_enum(
        capture.get("decision"),
        TRUTH_CAPTURE_DECISIONS,
        "truth_capture.decision",
    )
    authorization_status = _require_enum(
        capture.get("authorization_status"),
        TRUTH_CAPTURE_AUTHORIZATION_STATUSES,
        "truth_capture.authorization_status",
    )
    _require_string(capture.get("reason"), "truth_capture.reason")
    target = capture.get("target")
    action = effect.get("action")
    exact_target = effect.get("exact_target")
    if decision in TRUTH_CAPTURE_WRITE_DECISIONS:
        target = _exact_document_target(target, "truth_capture.target")
        if authorization_status == "not_applicable":
            raise ContractError(
                "a truth write decision requires an Authorization Card status"
            )
        if authorization_status == "confirmed":
            if action == "truth_doc_write":
                if decision not in {"create_new", "supersede"}:
                    raise ContractError(
                        "truth_doc_write is only valid for truth_capture.decision create_new or supersede"
                    )
                if exact_target != target:
                    raise ContractError(
                        "truth_doc_write requires effect.exact_target to equal truth_capture.target"
                    )
            elif action == "local_edit" and exact_target == target and decision in {"create_new", "supersede"}:
                raise ContractError(
                    "creating a new truth document requires effect.action truth_doc_write"
                )
        else:
            if action == "truth_doc_write":
                raise ContractError(
                    "truth_doc_write requires a confirmed Authorization Card"
                )
            if action == "local_edit" and exact_target == target:
                raise ContractError(
                    "an existing truth owner cannot be edited before the Authorization Card is confirmed"
                )
    else:
        if target is not None:
            raise ContractError(
                f"truth_capture.target must be null for decision {decision}"
            )
        if authorization_status != "not_applicable":
            raise ContractError(
                f"truth_capture.decision {decision} requires authorization_status not_applicable"
            )
        if action == "truth_doc_write":
            raise ContractError(
                "truth_doc_write requires a truth_capture write decision"
            )
    return capture


def validate_audit_materialization(
    decision: dict[str, Any],
    *,
    delivery: str,
    effect: dict[str, Any],
    plan_target: Optional[str],
    stage_target: Optional[str],
) -> bool:
    """Validate the optional audit-artifact block.

    A module-level or larger audit writes its report by default. The report is
    the only write an audit performs, may never share a path with the plan or
    stage owner, and a closed report must record where unresolved findings were
    promoted.
    """

    materialize_audit = decision.get("materialize_audit")
    audit_target = decision.get("audit_target")
    audit_index_target = decision.get("audit_index_target")
    audit_pass = decision.get("audit_pass")
    promoted_to = decision.get("promoted_to")
    unresolved_findings = decision.get("unresolved_findings")
    action = effect.get("action")
    if materialize_audit is None or materialize_audit is False:
        if materialize_audit is not None:
            _require_bool(materialize_audit, "materialize_audit")
        if any(
            value is not None
            for value in (audit_target, audit_index_target, audit_pass, promoted_to, unresolved_findings)
        ):
            raise ContractError("audit fields require materialize_audit true")
        if action == "audit_artifact":
            raise ContractError("audit_artifact action requires materialize_audit true")
        return False
    _require_bool(materialize_audit, "materialize_audit")
    if delivery != "audit":
        raise ContractError("materialize_audit is only valid for audit delivery")
    audit_target = _exact_document_target(audit_target, "audit_target")
    if audit_index_target is not None:
        audit_index_target = _exact_document_target(audit_index_target, "audit_index_target")
        if audit_index_target != str(Path(audit_target).parent / "README.md") or audit_index_target == audit_target:
            raise ContractError("audit_index_target must be the report directory README.md")
        if audit_index_target not in decision.get("scope", {}).get("proposed_targets", []):
            raise ContractError("audit_index_target must be recorded in scope.proposed_targets")
    audit_pass = _require_enum(audit_pass, AUDIT_PASSES, "audit_pass")
    for label, other in (("plan_target", plan_target), ("stage_target", stage_target)):
        if other is not None and other == audit_target:
            raise ContractError(f"audit_target must not equal {label}")
    if action not in AUDIT_ALLOWED_ACTIONS:
        raise ContractError(
            f"an audit with a materialized report cannot classify action {action}"
        )
    if action == "audit_artifact" and effect.get("exact_target") != audit_target:
        raise ContractError(
            "audit_artifact action requires effect.exact_target to equal audit_target"
        )
    if audit_pass == "reviewed_pending_promotion":
        if (
            not isinstance(unresolved_findings, int)
            or isinstance(unresolved_findings, bool)
            or unresolved_findings <= 0
            or promoted_to != "none"
        ):
            raise ContractError("pending promotion requires unresolved findings and promoted_to none")
    elif audit_pass == "closed":
        if not isinstance(unresolved_findings, int) or isinstance(unresolved_findings, bool):
            raise ContractError("closed audit requires integer unresolved_findings")
        if unresolved_findings < 0:
            raise ContractError("unresolved_findings must not be negative")
        promoted_to = _require_string(promoted_to, "promoted_to")
        if promoted_to == "none":
            if unresolved_findings > 0:
                raise ContractError(
                    "closed audit with unresolved findings must record promoted_to"
                )
        else:
            promoted_to = _exact_document_target(promoted_to, "promoted_to")
            if promoted_to == audit_target:
                raise ContractError("promoted_to must be a live owner, not the audit report")
    else:
        if promoted_to is not None or unresolved_findings is not None:
            raise ContractError(
                "promoted_to and unresolved_findings are only valid when audit_pass is closed or reviewed_pending_promotion"
            )
    return True


def _validate_task_owned_plan_target(
    plan_target: str,
    plan_target_kind: str,
    plan_task_identity: str,
    *,
    host_task_identity: Optional[str],
    host_task_temp_root: Optional[str],
    host_task_durable_root: Optional[str],
) -> None:
    trusted_identity = _require_string(host_task_identity, "host_task_identity")
    if plan_task_identity != trusted_identity:
        raise ContractError(
            "task-owned plan identity must match the host validation context"
        )
    raw_root = (
        host_task_temp_root
        if plan_target_kind == "task_temporary"
        else host_task_durable_root
    )
    label = (
        "host_task_temp_root"
        if plan_target_kind == "task_temporary"
        else "host_task_durable_root"
    )
    root_text = _require_string(raw_root, label)
    root = Path(root_text)
    if not root.is_absolute():
        raise ContractError(f"{label} must be an absolute host-provided path")
    lexical_root = Path(os.path.abspath(root_text))
    if Path(os.path.realpath(root_text)) != lexical_root:
        raise ContractError(f"{label} must not traverse a symlink")
    if root.exists() and (not root.is_dir() or root.is_symlink()):
        raise ContractError(f"{label} must identify a non-symlink directory")
    expected = lexical_root / f"sliver-plan-{trusted_identity}.md"
    if Path(os.path.abspath(plan_target)) != expected:
        raise ContractError(
            "task-owned plan_target must equal the host root and stable task identity"
        )


def validate_task_decision(
    value: Any,
    *,
    host_task_identity: Optional[str] = None,
    host_task_temp_root: Optional[str] = None,
    host_task_durable_root: Optional[str] = None,
    authorized_explicit_plan_target: Optional[str] = None,
    established_plan_target: Optional[str] = None,
    expected_blocking_review_refs: Optional[list[str]] = None,
    expected_excluded_targets: Optional[list[str]] = None,
) -> dict[str, Any]:
    decision = _require_object(value, "task decision")
    if decision.get("schema") != TASK_DECISION_SCHEMA:
        raise ContractError("unsupported task decision schema")
    status = _require_enum(
        decision.get("decision_status"),
        DECISION_STATUSES,
        "decision_status",
    )
    route = _require_string(decision.get("primary_route"), "primary_route")
    if route not in ROUTE_OPERATION_MATRIX:
        raise ContractError(f"unsupported primary_route: {route}")
    operation = decision.get("operation")
    if status == "resolved":
        operation = _require_string(operation, "operation")
        if operation not in ROUTE_OPERATION_MATRIX[route]:
            raise ContractError(f"operation {operation} does not belong to route {route}")

    delivery = _require_enum(
        decision.get("delivery_kind"),
        DELIVERY_KINDS,
        "delivery_kind",
    )
    if status == "resolved":
        allowed_deliveries = ROUTE_OPERATION_DELIVERY_MATRIX[route][operation]
        if delivery not in allowed_deliveries:
            raise ContractError(
                f"{route}/{operation} does not allow delivery_kind {delivery}"
            )
    _require_string(decision.get("result"), "result")
    non_goals = decision.get("non_goals")
    if not isinstance(non_goals, list) or any(not isinstance(item, str) for item in non_goals):
        raise ContractError("non_goals must be a string list")
    validate_scope(
        decision.get("scope"),
        expected_excluded_targets=expected_excluded_targets,
        decision_status=status,
    )

    topology = _require_object(decision.get("owner_topology"), "owner_topology")
    owners = topology.get("semantic_owners")
    if not isinstance(owners, list) or not owners or any(
        not isinstance(item, str) or not item.strip() for item in owners
    ):
        raise ContractError("owner_topology.semantic_owners must be a non-empty string list")
    owner_count = topology.get("owner_count")
    if isinstance(owner_count, bool) or not isinstance(owner_count, int):
        raise ContractError("owner_topology.owner_count must be an integer")
    if owner_count != len(owners):
        raise ContractError("owner_topology.owner_count must match semantic_owners")
    for field in (
        "joint_contract_required",
        "shared_writable_surface",
        "mechanical_execution",
        "new_foundation_judgment",
        "contracts_stable",
        "ordered_dependencies",
        "studio_capability_available",
        "environment_isolation_credible",
        "independent_acceptance",
        "integration_gate_defined",
        "coordination_benefit_positive",
    ):
        _require_bool(topology.get(field), f"owner_topology.{field}")

    delegation = _require_object(decision.get("delegation"), "delegation")
    if set(delegation) != {"decision", "independent_scopes", "join_point", "reason"}:
        raise ContractError("delegation fields drifted")
    delegation_decision = _require_enum(
        delegation.get("decision"), DELEGATION_DECISIONS, "delegation.decision"
    )
    independent_scopes = delegation.get("independent_scopes")
    if not isinstance(independent_scopes, list) or any(
        not isinstance(item, str) or not item.strip() for item in independent_scopes
    ):
        raise ContractError("delegation.independent_scopes must be a string list")
    if len(independent_scopes) != len(set(independent_scopes)):
        raise ContractError("delegation.independent_scopes must not contain duplicates")
    join_point = delegation.get("join_point")
    _require_string(delegation.get("reason"), "delegation.reason")
    if delegation_decision == "current_only":
        if independent_scopes or join_point is not None:
            raise ContractError("current_only delegation requires no scopes or join point")
    else:
        if len(independent_scopes) < 2:
            raise ContractError("subagent delegation requires at least two independent scopes")
        _require_string(join_point, "delegation.join_point")
        if not topology["coordination_benefit_positive"]:
            raise ContractError("subagent delegation requires positive coordination benefit")

    depth = _require_enum(decision.get("task_depth"), TASK_DEPTHS, "task_depth")
    depth_rule = _require_string(decision.get("depth_rule"), "depth_rule")
    if depth_rule != DEPTH_RULES[depth]:
        raise ContractError(f"{depth} requires depth_rule {DEPTH_RULES[depth]}")
    if depth == "D0" and (
        owner_count != 1
        or topology["joint_contract_required"]
        or not topology["mechanical_execution"]
        or topology["new_foundation_judgment"]
    ):
        raise ContractError("D0 requires one bounded owner and mechanical execution")
    if depth == "D0" and delegation_decision != "current_only":
        raise ContractError("D0 work must stay in the current agent")
    if depth == "D1" and (
        owner_count != 1
        or topology["joint_contract_required"]
        or topology["mechanical_execution"]
        or topology["new_foundation_judgment"]
    ):
        raise ContractError("D1 requires one semantic owner and bounded semantic judgment")
    if status == "resolved" and depth in {"D0", "D1"} and not topology["contracts_stable"]:
        raise ContractError("resolved D0/D1 requires a bounded or established stable contract")
    if depth == "D2" and (
        owner_count < 2
        or not topology["joint_contract_required"]
        or topology["mechanical_execution"]
        or topology["new_foundation_judgment"]
    ):
        raise ContractError("D2 requires several owners that share one joint contract")
    if depth == "D3" and not (
        topology["new_foundation_judgment"]
        or (
            owner_count >= 2
            and topology["joint_contract_required"]
            and topology["ordered_dependencies"]
        )
    ):
        raise ContractError(
            "D3 requires foundation judgment or multi-owner ordered program topology"
        )

    risk_lanes = validate_risk_lanes(decision.get("risk_lanes"))
    evidence = validate_evidence(decision.get("evidence"), delivery, require_status=True)
    if (
        risk_lanes
        and delivery in (TEST_DELIVERIES | {"direct_artifact"})
        and evidence.get("mode") == "test"
        and evidence.get("test_level") in {"T0", "T4"}
    ):
        raise ContractError(
            "protected-risk implementation requires T1/T2/T3 owner-bound evidence"
        )
    effect = validate_effect(decision.get("effect"))
    if (
        delivery == "direct_artifact"
        and risk_lanes
        and effect.get("effect_class") != "none"
        and evidence.get("mode") != "test"
    ):
        raise ContractError(
            "protected direct_artifact writes require owner-bound test evidence"
        )
    _require_enum(
        decision.get("operational_mode"),
        OPERATIONAL_MODES,
        "operational_mode",
    )
    discovery = _require_enum(
        decision.get("discovery"),
        DISCOVERY_OUTCOMES,
        "discovery",
    )
    if status in {
        "unresolved_safe",
        "unresolved_protected_stop",
        "unresolved_product_stop",
    } and discovery != status:
        raise ContractError(f"{status} decision requires matching discovery")
    if status in {"resolved", "split_required"} and discovery != "resolved":
        raise ContractError(f"{status} decision requires resolved discovery")
    if status == "invalid" and discovery == "resolved":
        raise ContractError("invalid decision requires an unresolved discovery outcome")

    loaded = decision.get("loaded_owner_ids")
    if not isinstance(loaded, list) or not loaded or any(
        not isinstance(item, str) or not item.strip() for item in loaded
    ):
        raise ContractError("loaded_owner_ids must be a non-empty string list")
    if len(loaded) != len(set(loaded)):
        raise ContractError("loaded_owner_ids must not contain duplicates")
    unknown_loaded = sorted(set(loaded) - LOADED_OWNER_IDS)
    if unknown_loaded:
        raise ContractError(
            f"loaded_owner_ids contain unsupported IDs: {', '.join(unknown_loaded)}"
        )
    required_loaded = {"routes", "task_depth", "effect_recovery"}
    if delivery in TEST_DELIVERIES:
        required_loaded.add("testing")
    if risk_lanes:
        required_loaded.add("risk_control")
    if decision.get("materialize_stage"):
        required_loaded.add("project_flow")
    materialize_plan = _require_bool(
        decision.get("materialize_plan"),
        "materialize_plan",
    )
    plan_phase = decision.get("plan_phase")
    plan_target = decision.get("plan_target")
    plan_target_kind = decision.get("plan_target_kind")
    plan_task_identity = decision.get("plan_task_identity")
    plan_persistence_scope = decision.get("plan_persistence_scope")
    plan_review = decision.get("plan_review")
    if materialize_plan:
        required_loaded.add("plan_artifact")
        if depth == "D0":
            raise ContractError("D0 cannot materialize a plan artifact")
        plan_phase = _require_enum(
            plan_phase,
            {"pending_review", "ready_to_write", "materialized"},
            "plan_phase",
        )
        plan_target = _require_string(plan_target, "plan_target")
        plan_target_kind = _require_enum(
            plan_target_kind,
            PLAN_TARGET_KINDS,
            "plan_target_kind",
        )
        plan_persistence_scope = _require_enum(
            plan_persistence_scope,
            {"current_task", "cross_session"},
            "plan_persistence_scope",
        )
        if "@@" in plan_target or ".." in Path(plan_target).parts:
            raise ContractError("plan_target must be an exact non-placeholder path")
        if plan_target_kind in {"task_temporary", "task_durable"}:
            plan_task_identity = _require_string(
                plan_task_identity,
                "plan_task_identity",
            )
            if not STABLE_TASK_ID_PATTERN.fullmatch(plan_task_identity):
                raise ContractError(
                    "task_temporary plan requires a stable host task identity"
                )
            if Path(plan_target).name != f"sliver-plan-{plan_task_identity}.md":
                raise ContractError(
                    "task-owned plan_target must be derived from plan_task_identity"
                )
            _validate_task_owned_plan_target(
                plan_target,
                plan_target_kind,
                plan_task_identity,
                host_task_identity=host_task_identity,
                host_task_temp_root=host_task_temp_root,
                host_task_durable_root=host_task_durable_root,
            )
            if authorized_explicit_plan_target is not None or established_plan_target is not None:
                raise ContractError(
                    "task-owned plan targets cannot reuse explicit or internal-truth provenance"
                )
        else:
            if plan_task_identity is not None:
                raise ContractError(
                    "plan_task_identity is only valid for task-owned plan targets"
                )
            if any(
                value is not None
                for value in (
                    host_task_identity,
                    host_task_temp_root,
                    host_task_durable_root,
                )
            ):
                raise ContractError(
                    "host task identity and roots are only valid for task-owned plan targets"
                )
            if plan_target_kind == "explicit_path":
                authorized = _require_string(
                    authorized_explicit_plan_target,
                    "authorized_explicit_plan_target",
                )
                if established_plan_target is not None:
                    raise ContractError(
                        "explicit plan target cannot reuse internal-truth provenance"
                    )
                if plan_target != authorized:
                    raise ContractError(
                        "explicit plan_target must match the externally authorized path"
                    )
            else:
                established = _require_string(
                    established_plan_target,
                    "established_plan_target",
                )
                if authorized_explicit_plan_target is not None:
                    raise ContractError(
                        "active internal truth cannot reuse explicit-path authorization"
                    )
                if plan_target != established:
                    raise ContractError(
                        "active_internal_truth plan_target must match the externally established owner"
                    )
        if (
            plan_target_kind == "task_temporary"
            and plan_persistence_scope != "current_task"
        ):
            raise ContractError(
                "task_temporary plan cannot claim cross_session persistence"
            )
        if (
            plan_target_kind == "task_durable"
            and plan_persistence_scope != "cross_session"
        ):
            raise ContractError(
                "task_durable plan requires cross_session persistence"
            )
        plan_review = _require_object(plan_review, "plan_review")
        if set(plan_review) != {"status", "refs", "reason"}:
            raise ContractError("plan_review fields drifted")
        review_status = _require_enum(
            plan_review.get("status"),
            {"pending", "collected", "not_required"},
            "plan_review.status",
        )
        review_refs = plan_review.get("refs")
        if not isinstance(review_refs, list) or any(
            not isinstance(item, str) or not item.strip() for item in review_refs
        ) or len(review_refs) != len(set(review_refs)):
            raise ContractError("plan_review.refs must be a unique string list")
        _require_string(plan_review.get("reason"), "plan_review.reason")
        if not isinstance(expected_blocking_review_refs, list) or any(
            not isinstance(item, str) or not item.strip()
            for item in expected_blocking_review_refs
        ) or len(expected_blocking_review_refs) != len(set(expected_blocking_review_refs)):
            raise ContractError(
                "expected_blocking_review_refs must be an external unique string list"
            )
        expected_review_set = set(expected_blocking_review_refs)
        if review_status == "collected" and not review_refs:
            raise ContractError("collected plan review requires evidence refs")
        if review_status != "collected" and review_refs:
            raise ContractError("only collected plan review may contain refs")
        if plan_phase == "pending_review":
            if not expected_review_set:
                raise ContractError(
                    "pending_review requires at least one externally known blocking review"
                )
            if review_status != "pending":
                raise ContractError("pending_review plan phase requires pending plan_review")
            if effect.get("action") not in {"read", "audit", "stateless_verify"}:
                raise ContractError(
                    "pending_review plan phase must classify the current audit/read action"
                )
            if effect.get("effect_class") != "none":
                raise ContractError(
                    "pending_review plan phase requires effect_class none"
                )
        elif plan_phase == "ready_to_write":
            if review_status not in {"collected", "not_required"}:
                raise ContractError(
                    "ready_to_write plan phase requires closed plan_review"
                )
            if effect.get("action") != "plan_artifact":
                raise ContractError(
                    "ready_to_write plan phase requires effect.action plan_artifact"
                )
            if effect.get("effect_class") != "local_reversible":
                raise ContractError(
                    "ready_to_write plan phase requires a local_reversible exact-path write"
                )
            if effect.get("exact_target") != plan_target:
                raise ContractError(
                    "ready_to_write plan phase requires effect.exact_target to match plan_target"
                )
        else:
            if review_status not in {"collected", "not_required"}:
                raise ContractError("materialized plan phase requires closed plan_review")
            if effect.get("action") == "plan_artifact":
                raise ContractError(
                    "materialized plan phase must classify the next real action"
                )
        if review_status == "collected" and set(review_refs) != expected_review_set:
            raise ContractError(
                "collected plan_review.refs must exactly match all externally known blocking reviews"
            )
        if review_status == "not_required" and expected_review_set:
            raise ContractError(
                "not_required plan review is invalid when external blocking reviews exist"
            )
    elif any(
        value is not None
        for value in (
            plan_phase,
            plan_target,
            plan_target_kind,
            plan_task_identity,
            plan_persistence_scope,
            plan_review,
        )
    ):
        raise ContractError(
            "plan fields require materialize_plan true"
        )
    if decision.get("studio_decision") in {
        "recommend_studio",
        "resolve_boundaries_first",
    }:
        required_loaded.add("studio_execution")
    missing_loaded = sorted(required_loaded - set(loaded))
    materialize = _require_bool(decision.get("materialize_stage"), "materialize_stage")
    if materialize and depth in {"D0", "D1"}:
        raise ContractError("D0/D1 cannot materialize stage truth")
    stage_target = decision.get("stage_target")
    if materialize and materialize_plan:
        stage_target = _require_string(stage_target, "stage_target")
        if "@@" in stage_target or ".." in Path(stage_target).parts:
            raise ContractError("stage_target must be an exact non-placeholder path")
        if plan_target != stage_target:
            raise ContractError(
                "one materialized task artifact requires plan_target to equal stage_target"
            )
    elif stage_target is not None:
        raise ContractError(
            "stage_target is only valid when plan and stage materialize together"
        )
    truth_capture_raw = decision.get("truth_capture")
    if truth_capture_raw is not None:
        required_loaded.add("truth_capture")
        validate_truth_capture(truth_capture_raw, depth=depth, effect=effect)
    elif effect.get("action") == "truth_doc_write":
        raise ContractError("truth_doc_write requires a truth_capture block")
    if validate_audit_materialization(
        decision,
        delivery=delivery,
        effect=effect,
        plan_target=plan_target if materialize_plan else None,
        stage_target=stage_target,
    ):
        required_loaded.add("audit_artifact")
    missing_loaded = sorted(required_loaded - set(loaded))
    if materialize and depth in {"D2", "D3"}:
        crosses_affected_owners = owner_count >= 2 and topology["joint_contract_required"]
        cross_owner_drift = crosses_affected_owners and not topology["contracts_stable"]
        ordered_nonclosable_transition = topology["ordered_dependencies"]
        durable_handoff_requested = delivery == "handoff" and crosses_affected_owners
        if not (
            cross_owner_drift
            or ordered_nonclosable_transition
            or durable_handoff_requested
        ):
            raise ContractError(
                "D2/D3 stage materialization requires cross_owner_drift, "
                "ordered_nonclosable_transition, or durable_handoff_requested"
            )

    _require_string(decision.get("reason"), "reason")
    studio = _require_enum(
        decision.get("studio_decision"),
        STUDIO_DECISIONS,
        "studio_decision",
    )
    if studio == "recommend_studio" and (
        owner_count < 2
        or topology["shared_writable_surface"]
        or not topology["contracts_stable"]
        or not topology["studio_capability_available"]
        or not topology["environment_isolation_credible"]
        or not topology["independent_acceptance"]
        or not topology["integration_gate_defined"]
        or not topology["coordination_benefit_positive"]
    ):
        raise ContractError(
            "Studio requires several owners, stable contracts, host capability, "
            "credible environment isolation, independent acceptance, an integration "
            "gate, positive coordination benefit, and no shared writable surface"
        )
    if topology["shared_writable_surface"] and studio != "resolve_boundaries_first":
        raise ContractError(
            "shared writable surface requires studio_decision resolve_boundaries_first"
        )
    if missing_loaded:
        raise ContractError(
            f"loaded_owner_ids omit required owners: {', '.join(missing_loaded)}"
        )
    extra_loaded = sorted(set(loaded) - required_loaded)
    if extra_loaded:
        warnings.warn(
            "loaded_owner_ids include owners not required by the recorded decision: "
            + ", ".join(extra_loaded),
            LoadedOwnerDiagnosticWarning,
            stacklevel=2,
        )
    return decision


def _main() -> int:
    parser = argparse.ArgumentParser(
        description="Emit deterministic projections from references/routes-index.md"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    catalog = subparsers.add_parser("route-catalog")
    catalog.add_argument("--format", choices=("json",), default="json")
    catalog.add_argument("--registry", type=Path)
    lens_catalog = subparsers.add_parser("lens-catalog")
    lens_catalog.add_argument("--format", choices=("json",), default="json")
    lens_catalog.add_argument("--registry", type=Path)
    projection = subparsers.add_parser("route-projection")
    projection.add_argument("--route", required=True)
    projection.add_argument("--format", choices=("json",), default="json")
    projection.add_argument("--registry", type=Path)
    lens_projection = subparsers.add_parser("lens-projection")
    lens_projection.add_argument("--lens", required=True)
    lens_projection.add_argument("--format", choices=("json",), default="json")
    lens_projection.add_argument("--registry", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "route-catalog":
            value = build_route_catalog(args.registry)
        elif args.command == "lens-catalog":
            value = build_lens_catalog(args.registry)
        elif args.command == "route-projection":
            value = build_route_projection(args.route, args.registry)
        else:
            value = build_lens_projection(args.lens, args.registry)
    except (OSError, ContractError) as exc:
        parser.exit(1, f"FAIL: {exc}\n")
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
