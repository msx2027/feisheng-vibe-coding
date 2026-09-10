#!/usr/bin/env python3
"""Parse and validate the materialized Sliver Stage v2 contract.

This module validates recorded structure only.  It never treats document text,
recorded evidence references, or a successful structural gate as proof that
implementation, verification, authorization, deployment, or release occurred.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Optional

from validation_support import (
    ContractError,
    active_markdown,
    markdown_section,
    read_utf8,
    safe_repo_path,
    split_table_row,
)

from runtime_decision_contract import (
    DELIVERY_KINDS,
    EFFECT_CLASSES,
    EVIDENCE_MODES,
    OPERATIONAL_MODES,
    RISK_LANE_IDS,
    ROUTE_EVIDENCE_KINDS,
    ROUTE_OPERATION_DELIVERY_MATRIX,
    ROUTE_OPERATION_MATRIX,
    TEST_LEVELS,
    validate_evidence,
    validate_risk_lanes,
)


STAGE_SCHEMA = "sliver-stage/v2"
LEGACY_STAGE_SCHEMA = "sliver-stage/v1"
MIGRATION_REQUIRED = "MIGRATION_REQUIRED"
INVALID_SCHEMA = "INVALID_SCHEMA"
INVALID_CONTRACT = "INVALID_CONTRACT"
VALID = "VALID"

EXIT_OK = 0
EXIT_INVALID_CONTRACT = 1
EXIT_INVALID_SCHEMA = 2
EXIT_MIGRATION_REQUIRED = 3

STAGE_GATES = {"plan", "execute", "closeout"}
TASK_DEPTHS = {"D0", "D1", "D2", "D3"}
LEGACY_TASK_DEPTHS = {"轻量任务", "常规任务", "标准任务", "高风险任务"}
MATERIALIZATION_TRIGGERS = {
    "cross_owner_drift",
    "ordered_nonclosable_transition",
    "durable_handoff_requested",
}
RESULT_STATUSES = {"not_started", "in_progress", "completed", "partial", "blocked"}
TRUTH_WRITEBACK_STATES = {"pending", "complete"}
MIGRATION_STATES = {"not_applicable", "reclassified"}
SCOPE_AUTHORIZATION_STATUSES = {
    "blocked",
    "confirmed",
    "original_request_authorized",
}
PRODUCT_DECISION_STATUSES = {"not_required", "confirmed", "pending"}
RESEARCH_STATUSES = {
    "completed",
    "not_required",
    "unverified_nonblocking",
    "unverified_blocking",
}

PLACEHOLDER_MARKERS = ("@@", "TODO", "TBD", "<Project>", "<project>", "待填写")

STAGE_SECTION_ALIASES = {
    "阶段控制 / Stage Control": ("阶段控制", "Stage Control"),
    "阶段目标与用户流程 / Stage Goal And User Flow": (
        "阶段目标与用户流程",
        "Stage Goal And User Flow",
    ),
    "当前真相与 Owner / Current Truth And Owner": (
        "当前真相与 Owner",
        "Current Truth And Owner",
    ),
    "调研决策 / Research Decision": ("调研决策", "Research Decision"),
    "范围与非目标 / Scope And Non-Goals": (
        "范围与非目标",
        "Scope And Non-Goals",
    ),
    "子阶段计划 / Substage Plan": ("子阶段计划", "Substage Plan"),
    "测试、安全与影响 / Test Security And Impact": (
        "测试、安全与影响",
        "Test Security And Impact",
    ),
    "验证方法 / Validation Method": ("验证方法", "Validation Method"),
    "停止条件与未验证 / Stop Conditions And Unverified": (
        "停止条件与未验证",
        "Stop Conditions And Unverified",
    ),
}

STAGE_CONTROL_FIELDS = (
    "schema",
    "stage_id",
    "primary_route",
    "operation",
    "delivery_kind",
    "task_depth",
    "materialization_trigger",
    "risk_lanes",
    "evidence_mode",
    "test_level",
    "route_evidence_kind",
    "effect_class",
    "operational_mode",
    "scope_authorization",
    "authorization_substage",
    "product_decision",
    "active_substage",
    "result_status",
    "truth_writeback",
    "migration_state",
    "evidence_refs",
)

CLOSEOUT_FIELDS = (
    "actual_result",
    "changed_owners",
    "plan_deviation",
    "fresh_evidence",
    "remaining_risk",
    "next_substage",
    "git_checkpoint",
)

SUBSTAGE_HEADER_ALIASES = (
    {"子阶段", "substage"},
    {"结果", "result"},
    {"owner"},
    {"完成标准", "done standard"},
    {"验证", "validation"},
    {"不触碰", "do not touch"},
)


def _base_result(stage_file: Optional[str], stage_gate: Optional[str]) -> dict[str, Any]:
    return {
        "stage_file": stage_file,
        "stage_gate": stage_gate,
        "contract_status": INVALID_CONTRACT,
        "contract_exit_code": EXIT_INVALID_CONTRACT,
        "migration_allowed_actions": [],
        "migration_denied_actions": [],
        "missing_stage_file": False,
        "missing_stage_headings": [],
        "empty_stage_sections": [],
        "missing_stage_fields": [],
        "invalid_stage_fields": [],
        "stage_gate_blockers": [],
        "invalid_substage_plan": [],
        "missing_closeout_fields": [],
        "stage_placeholders": [],
        "stage_values": {},
        "structural_gate_met": False,
        "completion_claim_allowed": False,
        "completion_claim_requires_external_evidence": False,
    }


def _section_by_aliases(text: str, aliases: tuple[str, ...], *, label: str) -> Optional[str]:
    matches: list[str] = []
    for alias in aliases:
        section = markdown_section(text, alias)
        if section is not None:
            matches.append(section)
    if len(matches) > 1:
        raise ContractError(f"duplicate stage section owner: {label}")
    return matches[0] if matches else None


def _section_body(section: str) -> str:
    lines = section.splitlines()
    return "\n".join(lines[1:]).strip() if lines else ""


def _parse_control(section: str) -> tuple[dict[str, str], list[str], list[str]]:
    allowed = set(STAGE_CONTROL_FIELDS)
    values: dict[str, str] = {}
    duplicates: list[str] = []
    unknown: list[str] = []
    for raw in _section_body(section).splitlines():
        match = re.match(r"^\s*-\s*([a-z_]+)\s*:\s*(.*?)\s*$", raw)
        if not match:
            continue
        key, value = match.groups()
        if key not in allowed:
            unknown.append(key)
            continue
        if key in values:
            duplicates.append(key)
        else:
            values[key] = value.strip()
    missing = [key for key in STAGE_CONTROL_FIELDS if key not in values]
    return values, missing, duplicates + [f"unknown:{key}" for key in unknown]


def _parse_named_fields(
    section: str,
    allowed: tuple[str, ...],
) -> tuple[dict[str, str], list[str], list[str]]:
    values: dict[str, str] = {}
    duplicates: list[str] = []
    allowed_set = set(allowed)
    for raw in _section_body(section).splitlines():
        match = re.match(r"^\s*-\s*([a-z_]+)\s*:\s*(.*?)\s*$", raw)
        if not match:
            continue
        key, value = match.groups()
        if key not in allowed_set:
            continue
        if key in values:
            duplicates.append(key)
        else:
            values[key] = value.strip()
    return values, [key for key in allowed if key not in values], duplicates


def _parse_list(value: str) -> Optional[list[str]]:
    value = value.strip()
    if not (value.startswith("[") and value.endswith("]")):
        return None
    inner = value[1:-1].strip()
    if not inner:
        return []
    items = [item.strip().strip("\"'") for item in inner.split(",")]
    if any(not item for item in items) or len(items) != len(set(items)):
        return None
    return items


def _status_value(value: str, allowed: set[str]) -> tuple[Optional[str], Optional[str]]:
    status, separator, evidence = value.partition(":")
    status = status.strip()
    evidence = evidence.strip()
    if status not in allowed or not separator or not evidence:
        return None, None
    return status, evidence


def _substage_names(section: str) -> tuple[set[str], list[str]]:
    rows = [
        split_table_row(line)
        for line in _section_body(section).splitlines()
        if split_table_row(line)
    ]
    if len(rows) < 3:
        return set(), ["substage plan must contain a header, separator, and data row"]
    header = [cell.strip().casefold() for cell in rows[0]]
    if len(header) != len(SUBSTAGE_HEADER_ALIASES) or any(
        value not in aliases for value, aliases in zip(header, SUBSTAGE_HEADER_ALIASES)
    ):
        return set(), ["substage plan header does not match the Stage contract"]
    if not all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in rows[1]):
        return set(), ["substage plan separator is invalid"]
    names: set[str] = set()
    errors: list[str] = []
    for row in rows[2:]:
        if len(row) != len(SUBSTAGE_HEADER_ALIASES) or any(not cell.strip() for cell in row):
            errors.append("substage plan has an incomplete row")
            continue
        name = row[0].strip()
        if name in names:
            errors.append(f"duplicate substage: {name}")
        names.add(name)
    return names, errors


def _mark_migration_required(result: dict[str, Any], reason: str) -> dict[str, Any]:
    result["contract_status"] = MIGRATION_REQUIRED
    result["contract_exit_code"] = EXIT_MIGRATION_REQUIRED
    result["stage_gate_blockers"].append(reason)
    result["migration_allowed_actions"] = [
        "read",
        "audit",
        "generate_migration_draft",
    ]
    result["migration_denied_actions"] = [
        "plan",
        "execute",
        "closeout",
        "completion_claim",
        "risk_inference",
        "authorization_reuse",
        "studio_inference",
    ]
    return result


def _migration_reason(active_text: str, control_values: dict[str, str]) -> Optional[str]:
    schema = control_values.get("schema")
    if schema is None:
        return "stage schema is missing"
    if schema == LEGACY_STAGE_SCHEMA:
        return "sliver-stage/v1 requires an explicit sibling-draft migration"
    legacy_depth_pattern = "|".join(re.escape(label) for label in LEGACY_TASK_DEPTHS)
    if control_values.get("task_depth") in LEGACY_TASK_DEPTHS or re.search(
        rf"^\s*-\s*(?:task_depth|任务深度|任务等级)\s*:\s*(?:{legacy_depth_pattern})\s*$",
        active_text,
        flags=re.M,
    ):
        return "legacy Chinese task-depth labels require reclassification"
    return None


def _normalize_runtime_values() -> dict[str, set[str]]:
    return {
        "delivery_kind": set(DELIVERY_KINDS),
        "risk_lane": set(RISK_LANE_IDS),
        "evidence_mode": set(EVIDENCE_MODES),
        "test_level": set(TEST_LEVELS),
        "route_evidence_kind": set(ROUTE_EVIDENCE_KINDS),
        "effect_class": set(EFFECT_CLASSES),
        "operational_mode": set(OPERATIONAL_MODES),
        "primary_route": set(ROUTE_OPERATION_MATRIX),
    }


def check_stage_file(
    root: Path,
    stage_file: Optional[str],
    stage_gate: Optional[str] = "plan",
) -> dict[str, Any]:
    result = _base_result(stage_file, stage_gate)
    if stage_gate not in STAGE_GATES:
        result["stage_gate_blockers"].append("stage_gate must be plan, execute, or closeout")
        return result
    if not stage_file:
        result["missing_stage_file"] = True
        return result

    path = safe_repo_path(root, stage_file, label="stage file")
    if not path.exists():
        result["missing_stage_file"] = True
        return result
    if not path.is_file():
        raise ContractError(f"stage file is not a regular file: {stage_file}")

    active_text = active_markdown(read_utf8(path))
    control = _section_by_aliases(
        active_text,
        STAGE_SECTION_ALIASES["阶段控制 / Stage Control"],
        label="阶段控制 / Stage Control",
    )
    control_values: dict[str, str] = {}
    if control is not None:
        control_values, _, _ = _parse_control(control)
    migration_reason = _migration_reason(active_text, control_values)
    if migration_reason is not None:
        return _mark_migration_required(result, migration_reason)

    schema = control_values.get("schema")
    if schema != STAGE_SCHEMA:
        result["contract_status"] = INVALID_SCHEMA
        result["contract_exit_code"] = EXIT_INVALID_SCHEMA
        result["invalid_stage_fields"].append("schema")
        return result

    sections: dict[str, str] = {}
    for label, aliases in STAGE_SECTION_ALIASES.items():
        section = _section_by_aliases(active_text, aliases, label=label)
        if section is None:
            result["missing_stage_headings"].append(label)
        elif not _section_body(section):
            result["empty_stage_sections"].append(label)
        else:
            sections[label] = section

    values, missing, malformed = _parse_control(control or "")
    result["missing_stage_fields"].extend(missing)
    result["invalid_stage_fields"].extend(
        f"duplicate:{key}" if not key.startswith("unknown:") else key
        for key in malformed
    )
    runtime = _normalize_runtime_values()

    stage_id = values.get("stage_id", "")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", stage_id):
        result["invalid_stage_fields"].append("stage_id")
    route = values.get("primary_route", "")
    if route not in runtime["primary_route"]:
        result["invalid_stage_fields"].append("primary_route")
    operation = values.get("operation", "")
    if not operation or operation not in ROUTE_OPERATION_MATRIX.get(route, ()):
        result["invalid_stage_fields"].append("operation")
    delivery_kind = values.get("delivery_kind", "")
    if delivery_kind not in runtime["delivery_kind"]:
        result["invalid_stage_fields"].append("delivery_kind")
    elif operation and delivery_kind not in ROUTE_OPERATION_DELIVERY_MATRIX.get(
        route, {}
    ).get(operation, ()):
        result["invalid_stage_fields"].append("route_operation_delivery")
    task_depth = values.get("task_depth")
    if task_depth not in TASK_DEPTHS or task_depth in {"D0", "D1"}:
        result["invalid_stage_fields"].append("task_depth")

    materialization_triggers = _parse_list(values.get("materialization_trigger", ""))
    if (
        not materialization_triggers
        or any(item not in MATERIALIZATION_TRIGGERS for item in materialization_triggers)
    ):
        result["invalid_stage_fields"].append("materialization_trigger")

    risk_lanes = _parse_list(values.get("risk_lanes", ""))
    if risk_lanes is None or any(item not in runtime["risk_lane"] for item in risk_lanes):
        result["invalid_stage_fields"].append("risk_lanes")
    else:
        try:
            validate_risk_lanes(risk_lanes)
        except (ContractError, TypeError, ValueError):
            result["invalid_stage_fields"].append("risk_lanes")

    evidence_mode = values.get("evidence_mode", "")
    test_level_raw = values.get("test_level", "")
    route_kind_raw = values.get("route_evidence_kind", "")
    test_level = None if test_level_raw == "null" else test_level_raw
    route_kind = None if route_kind_raw == "null" else route_kind_raw
    evidence = {
        "mode": evidence_mode,
        "test_level": test_level,
        "route_evidence_kind": route_kind,
    }
    if evidence_mode not in runtime["evidence_mode"]:
        result["invalid_stage_fields"].append("evidence_mode")
    if test_level is not None and test_level not in runtime["test_level"]:
        result["invalid_stage_fields"].append("test_level")
    if route_kind is not None and route_kind not in runtime["route_evidence_kind"]:
        result["invalid_stage_fields"].append("route_evidence_kind")
    try:
        validate_evidence(evidence, delivery_kind)
    except (ContractError, TypeError, ValueError):
        if evidence_mode == "test" and route_kind is not None:
            result["invalid_stage_fields"].append("route_evidence_kind")
        elif evidence_mode == "route" and test_level is not None:
            result["invalid_stage_fields"].append("test_level")
        else:
            result["invalid_stage_fields"].append("evidence_mode")

    if values.get("effect_class") not in runtime["effect_class"]:
        result["invalid_stage_fields"].append("effect_class")
    if values.get("operational_mode") not in runtime["operational_mode"]:
        result["invalid_stage_fields"].append("operational_mode")

    scope_status, _ = _status_value(
        values.get("scope_authorization", ""),
        SCOPE_AUTHORIZATION_STATUSES,
    )
    if scope_status is None:
        result["invalid_stage_fields"].append("scope_authorization")
    authorization_substage = values.get("authorization_substage", "")
    if scope_status == "blocked":
        if authorization_substage != "pending":
            result["invalid_stage_fields"].append("authorization_substage")
    elif scope_status in {"confirmed", "original_request_authorized"}:
        if authorization_substage != values.get("active_substage"):
            result["invalid_stage_fields"].append("authorization_substage")
    elif not authorization_substage:
        result["invalid_stage_fields"].append("authorization_substage")
    product_status, _ = _status_value(
        values.get("product_decision", ""),
        PRODUCT_DECISION_STATUSES,
    )
    if product_status is None:
        result["invalid_stage_fields"].append("product_decision")

    research_status: Optional[str] = None
    research = sections.get("调研决策 / Research Decision")
    if research is not None:
        research_values, research_missing, research_duplicates = _parse_named_fields(
            research,
            ("research_status",),
        )
        result["missing_stage_fields"].extend(research_missing)
        result["invalid_stage_fields"].extend(
            f"duplicate:{key}" for key in research_duplicates
        )
        research_status, _ = _status_value(
            research_values.get("research_status", ""),
            RESEARCH_STATUSES,
        )
        if research_status is None:
            result["invalid_stage_fields"].append("research_status")

    active_substage = values.get("active_substage", "")
    if (
        not active_substage
        or active_substage.casefold() in {"none", "pending"}
        or any(marker in active_substage for marker in PLACEHOLDER_MARKERS)
    ):
        result["invalid_stage_fields"].append("active_substage")
    if values.get("result_status") not in RESULT_STATUSES:
        result["invalid_stage_fields"].append("result_status")
    if values.get("truth_writeback") not in TRUTH_WRITEBACK_STATES:
        result["invalid_stage_fields"].append("truth_writeback")
    if values.get("migration_state") not in MIGRATION_STATES:
        result["invalid_stage_fields"].append("migration_state")

    evidence_refs = _parse_list(values.get("evidence_refs", ""))
    if evidence_refs is None:
        result["invalid_stage_fields"].append("evidence_refs")

    substage_section = sections.get("子阶段计划 / Substage Plan", "")
    substage_names, substage_errors = _substage_names(substage_section)
    result["invalid_substage_plan"].extend(substage_errors)
    if active_substage and active_substage not in substage_names:
        result["stage_gate_blockers"].append(
            "active_substage is not present in the substage plan"
        )

    result_status = values.get("result_status")
    truth_writeback = values.get("truth_writeback")
    if stage_gate == "plan":
        if result_status != "not_started" or truth_writeback != "pending":
            result["stage_gate_blockers"].append(
                "plan gate requires not_started result and pending truth writeback"
            )
    elif stage_gate == "execute":
        if result_status not in {"not_started", "in_progress"} or truth_writeback != "pending":
            result["stage_gate_blockers"].append(
                "execute gate requires an active result and pending truth writeback"
            )
        if scope_status == "blocked":
            result["stage_gate_blockers"].append("scope authorization is blocked")
        if authorization_substage != active_substage:
            result["stage_gate_blockers"].append(
                "authorization_substage does not match active_substage"
            )
        if product_status == "pending":
            result["stage_gate_blockers"].append("product decision is still pending")
        if research_status == "unverified_blocking":
            result["stage_gate_blockers"].append(
                "blocking research evidence is unresolved"
            )
        if values.get("effect_class") == "controlled":
            result["stage_gate_blockers"].append(
                "controlled action requires the independent action gate; "
                "stage scope authorization cannot authorize it"
            )

    closeout_values: dict[str, str] = {}
    if stage_gate == "closeout":
        if result_status not in {"completed", "partial", "blocked"}:
            result["stage_gate_blockers"].append("result_status is not a closeout result")
        if truth_writeback != "complete":
            result["stage_gate_blockers"].append("truth_writeback is not complete")
        if result_status in {"completed", "partial"}:
            if scope_status == "blocked":
                result["stage_gate_blockers"].append("scope authorization is blocked")
            if authorization_substage != active_substage:
                result["stage_gate_blockers"].append(
                    "authorization_substage does not match active_substage"
                )
            if product_status == "pending":
                result["stage_gate_blockers"].append(
                    "product decision is still pending"
                )

        closeout = _section_by_aliases(
            active_text,
            ("实施回写", "Implementation Write-Back"),
            label="实施回写 / Implementation Write-Back",
        )
        if closeout is None or not _section_body(closeout):
            result["missing_closeout_fields"].extend(CLOSEOUT_FIELDS)
        else:
            closeout_values, closeout_missing, closeout_duplicates = _parse_named_fields(
                closeout,
                CLOSEOUT_FIELDS,
            )
            result["missing_closeout_fields"].extend(closeout_missing)
            result["invalid_stage_fields"].extend(
                f"duplicate:{key}" for key in closeout_duplicates
            )
            for key, value in closeout_values.items():
                if not value or any(marker in value for marker in PLACEHOLDER_MARKERS):
                    result["missing_closeout_fields"].append(key)
        if result_status == "completed":
            if not evidence_refs:
                result["stage_gate_blockers"].append(
                    "completed result requires at least one evidence_ref"
                )

    for marker in PLACEHOLDER_MARKERS:
        if marker in active_text:
            result["stage_placeholders"].append({"file": stage_file, "marker": marker})

    result["stage_values"] = {
        "schema": values.get("schema"),
        "stage_id": values.get("stage_id"),
        "primary_route": route,
        "operation": operation,
        "delivery_kind": delivery_kind,
        "task_depth": values.get("task_depth"),
        "materialization_trigger": materialization_triggers,
        "risk_lanes": risk_lanes,
        "evidence_mode": evidence_mode,
        "test_level": test_level,
        "route_evidence_kind": route_kind,
        "effect_class": values.get("effect_class"),
        "operational_mode": values.get("operational_mode"),
        "scope_authorization_status": scope_status,
        "authorization_substage": authorization_substage,
        "product_decision_status": product_status,
        "research_status": research_status,
        "active_substage": active_substage,
        "result_status": result_status,
        "truth_writeback": truth_writeback,
        "migration_state": values.get("migration_state"),
        "evidence_refs": evidence_refs,
    }

    failure_keys = (
        "missing_stage_file",
        "missing_stage_headings",
        "empty_stage_sections",
        "missing_stage_fields",
        "invalid_stage_fields",
        "stage_gate_blockers",
        "invalid_substage_plan",
        "missing_closeout_fields",
        "stage_placeholders",
    )
    structurally_valid = not any(result[key] for key in failure_keys)
    result["structural_gate_met"] = structurally_valid
    result["contract_status"] = VALID if structurally_valid else INVALID_CONTRACT
    result["contract_exit_code"] = EXIT_OK if structurally_valid else EXIT_INVALID_CONTRACT
    result["completion_claim_requires_external_evidence"] = bool(
        structurally_valid
        and stage_gate == "closeout"
        and result_status == "completed"
    )
    # Deliberately always false: this structural checker cannot observe the real
    # runtime/provider/device/user evidence or the current authorization event.
    result["completion_claim_allowed"] = False
    return result
