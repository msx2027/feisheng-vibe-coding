#!/usr/bin/env python3
"""Validate Studio Mode fresh-task contracts and evidence-bearing run artifacts."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from runtime_identity import (
    RuntimeIdentityError,
    source_revision,
    source_runtime_digest,
)
from live_evidence_isolation import same_isolation_manifest, validate_isolation_manifest
from validation_support import (
    ContractError,
    load_json_object,
    read_utf8,
    require_fields,
    require_int,
    require_prompt,
    require_string,
    require_string_list,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/studio-live-behavior-cases.json"
DEFAULT_SCHEMA = ROOT / "tests/studio-live-result-schema.json"
RAW_RESULT_SCHEMA = "sliver-studio-live-raw-results/v4"
MAX_CLOCK_SKEW = timedelta(minutes=5)
MAX_RESULT_AGE = timedelta(days=7)
PLACEHOLDERS = {"x", "xx", "xxx", "test", "fake", "unknown", "todo", "tbd", "n/a"}
REQUIRED_TOPOLOGY_FAMILIES = {
    "review_pipeline",
    "contract_fan_out_fan_in",
    "single_owner_serial",
    "writer_overlap_stop",
    "unstable_contract_stop",
    "unclear_acceptance_stop",
    "user_decline",
    "capability_unavailable",
    "same_room_review_rework",
    "domain_substitution_invariance",
    "host_operation_effects",
    "director_promptless_receive",
    "local_executor_not_room",
    "proactive_recommendation",
    "model_tier_assignment",
    "closure_room_disposition",
}
TOOL_EFFECTS = {
    "list_projects": {"project_resolved"},
    "create_thread": {"room_created"},
    "fork_thread": {"room_forked"},
    "send_message_to_thread": {
        "thread_message_sent",
        "rework_sent",
        "rereview_sent",
    },
    "handoff_thread": {"thread_handoff_started"},
    "get_handoff_status": {"thread_handoff_status_observed"},
    "wait_threads": {"room_progress_observed"},
    "read_thread": {"room_detail_observed"},
    "set_thread_archived": {"thread_archived"},
    "exec_command": {"local_gate_executed"},
}
SEPARATE_USER_AUTHORIZATION_TOOLS = {
    "fork_thread",
    "handoff_thread",
    "set_thread_archived",
}


def fail(message: str, code: int = 1) -> int:
    print(f"FAIL: {message}")
    return code


def require_object(value: Any, *, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be an object")
    return value


def require_bool(value: Any, *, label: str) -> bool:
    if not isinstance(value, bool):
        raise ContractError(f"{label} must be a boolean")
    return value


def require_meaningful(value: Any, *, label: str, minimum: int = 4) -> str:
    text = require_string(value, label=label, minimum=minimum)
    if text.strip().casefold() in PLACEHOLDERS:
        raise ContractError(f"{label} is a placeholder")
    return text


def require_datetime(value: Any, *, label: str) -> datetime:
    raw = require_string(value, label=label, minimum=10)
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ContractError(f"{label} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ContractError(f"{label} must include a timezone")
    return parsed


def safe_result_file(results_path: Path, relative: str, *, label: str) -> Path:
    base = results_path.resolve().parent
    candidate = (base / relative).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise ContractError(f"{label} must stay beside or below the results file") from exc
    if candidate == results_path.resolve() or not candidate.is_file():
        raise ContractError(f"{label} file does not exist or aliases results: {relative}")
    return candidate


def is_subsequence(required: list[str], actual: list[str]) -> bool:
    if not required:
        return True
    cursor = 0
    for item in actual:
        if item == required[cursor]:
            cursor += 1
            if cursor == len(required):
                return True
    return False


def require_tool_sequence(value: Any, *, label: str) -> list[str]:
    if not isinstance(value, list):
        raise ContractError(f"{label} must be a list")
    result: list[str] = []
    for index, item in enumerate(value):
        result.append(require_string(item, label=f"{label} item {index}"))
    return result


def validate_static_contract(
    cases_path: Path,
    schema_path: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    cases_data = load_json_object(cases_path)
    schema = load_json_object(schema_path)
    if cases_data.get("schema") != "sliver-studio-live-cases/v2":
        raise ContractError("unsupported Studio live case schema")
    if cases_data.get("evaluation_scope") != "fresh_session_model_behavior":
        raise ContractError("Studio cases must declare fresh-session behavior scope")
    if require_bool(
        cases_data.get("requires_live_model_validation"),
        label="requires_live_model_validation",
    ) is not True:
        raise ContractError("Studio cases must require live model validation")
    if require_bool(
        cases_data.get("static_contracts_are_not_live_proof"),
        label="static_contracts_are_not_live_proof",
    ) is not True:
        raise ContractError("Studio cases must preserve the static/live proof boundary")
    if schema.get("schema") != "sliver-studio-live-results/v4":
        raise ContractError("unsupported Studio live result schema")
    if cases_data.get("rubric_version") != schema.get("rubric_version"):
        raise ContractError("Studio cases and result schema rubric versions differ")

    list_fields = (
        "required_top_level",
        "required_case_fields",
        "required_session_fields",
        "required_confirmation_fields",
        "required_recommendation_fields",
        "required_recommendation_room_fields",
        "required_plan_owner_fields",
        "required_transcript_event_fields",
        "required_thread_event_fields",
        "required_director_event_fields",
        "required_judge_fields",
        "required_behavior_result_fields",
        "forbidden_behavior_result_fields",
        "allowed_decisions",
        "allowed_roles",
        "allowed_tool_names",
        "allowed_tool_statuses",
        "allowed_judge_statuses",
        "allowed_room_write_modes",
        "allowed_room_roles",
        "allowed_room_environments",
        "allowed_starting_state_kinds",
        "allowed_return_methods",
        "allowed_plan_owner_statuses",
        "allowed_director_event_kinds",
        "allowed_room_result_decisions",
    )
    for field in list_fields:
        require_string_list(schema.get(field), label=field, minimum=1)
    if set(schema["allowed_decisions"]) != {
        "recommend_studio",
        "do_not_recommend",
        "resolve_boundaries_first",
        "unavailable",
    }:
        raise ContractError("Studio decision set drifted")
    if set(schema["allowed_tool_names"]) != set(TOOL_EFFECTS):
        raise ContractError("Studio host-tool effect set drifted")

    cases = cases_data.get("cases")
    if not isinstance(cases, list) or len(cases) < 10:
        raise ContractError("Studio live corpus must contain at least 10 cases")
    seen_ids: set[str] = set()
    seen_prompts: set[str] = set()
    seen_topologies: set[str] = set()
    for index, value in enumerate(cases):
        case = require_object(value, label=f"case {index}")
        case_id = require_meaningful(case.get("id"), label=f"case {index} id")
        topology = require_meaningful(
            case.get("topology_family"),
            label=f"{case_id} topology_family",
        )
        prompt = require_prompt(case.get("initial_user"), label=f"{case_id} initial_user")
        context = require_object(case.get("context"), label=f"{case_id} context")
        if not context:
            raise ContractError(f"{case_id} context must not be empty")
        expected_decision = case.get("expected_decision")
        if expected_decision == "recommend_studio":
            if context.get("contracts") != "stable":
                raise ContractError(
                    f"{case_id} cannot recommend Studio with an unstable contract"
                )
            if context.get("write_surface_isolation") != "proven":
                raise ContractError(
                    f"{case_id} cannot recommend Studio without proven write-surface isolation"
                )
            if context.get("writer_ownership") != "unique":
                raise ContractError(
                    f"{case_id} cannot recommend Studio without unique writer ownership"
                )
            if context.get("acceptance") != "independent":
                raise ContractError(
                    f"{case_id} cannot recommend Studio without independent acceptance"
                )
            if context.get("coordination_benefit") != "positive":
                raise ContractError(
                    f"{case_id} cannot recommend Studio without positive coordination benefit"
                )
        if topology == "domain_substitution_invariance":
            require_meaningful(
                context.get("dependency_shape"),
                label=f"{case_id} dependency_shape",
                minimum=12,
            )
            require_string_list(
                context.get("domain_variants"),
                label=f"{case_id} domain_variants",
                minimum=3,
            )
        decision = require_string(case.get("expected_decision"), label=f"{case_id} expected_decision")
        if decision not in schema["allowed_decisions"]:
            raise ContractError(f"{case_id} expected_decision is unsupported")
        confirmed = require_bool(case.get("expected_confirmed"), label=f"{case_id} expected_confirmed")
        require_int(
            case.get("minimum_planned_rooms"),
            label=f"{case_id} minimum_planned_rooms",
            minimum=0,
        )
        minimum = require_int(
            case.get("minimum_create_threads"),
            label=f"{case_id} minimum_create_threads",
            minimum=0,
        )
        maximum = require_int(
            case.get("maximum_create_threads"),
            label=f"{case_id} maximum_create_threads",
            minimum=0,
        )
        if minimum > maximum:
            raise ContractError(f"{case_id} create-thread range is invalid")
        if confirmed and decision != "recommend_studio":
            raise ContractError(f"{case_id} only recommend_studio may be confirmed")
        if not confirmed and maximum != 0:
            raise ContractError(f"{case_id} unconfirmed case must allow zero room creation")
        sequence = require_tool_sequence(
            case.get("expected_tool_sequence"),
            label=f"{case_id} expected_tool_sequence",
        )
        unknown_tools = sorted(set(sequence) - set(schema["allowed_tool_names"]))
        if unknown_tools:
            raise ContractError(f"{case_id} uses unsupported tool: {unknown_tools[0]}")
        require_string_list(
            case.get("required_behaviors"),
            label=f"{case_id} required_behaviors",
            minimum=2,
        )
        require_string_list(
            case.get("forbidden_behaviors"),
            label=f"{case_id} forbidden_behaviors",
            minimum=2,
        )
        if case_id in seen_ids or prompt in seen_prompts or topology in seen_topologies:
            raise ContractError(
                f"duplicate Studio live case id, prompt, or topology family: {case_id}"
            )
        seen_ids.add(case_id)
        seen_prompts.add(prompt)
        seen_topologies.add(topology)
    missing_topologies = sorted(REQUIRED_TOPOLOGY_FAMILIES - seen_topologies)
    if missing_topologies:
        raise ContractError(
            f"Studio live corpus missing topology family: {missing_topologies[0]}"
        )
    return cases_data, schema


def load_raw_results(
    results_path: Path,
    results: dict[str, Any],
) -> tuple[Optional[dict[str, Any]], list[str]]:
    try:
        raw_path = safe_result_file(
            results_path,
            require_meaningful(
                results.get("raw_result_path"),
                label="raw result path",
            ),
            label="raw result",
        )
        raw_results = load_json_object(raw_path)
    except ContractError as exc:
        return None, [str(exc)]
    failures: list[str] = []
    if raw_results.get("schema") != RAW_RESULT_SCHEMA:
        failures.append("raw result schema is unsupported")
    for field in (
        "run_id",
        "runtime_target",
        "runtime_digest",
        "source_revision",
        "platform",
        "model",
        "generated_at",
    ):
        if raw_results.get(field) != results.get(field):
            failures.append(f"raw result {field} does not match reviewed results")
    try:
        same_isolation_manifest(
            raw_results.get("runner_isolation"),
            results.get("runner_isolation"),
            label="raw result",
        )
    except ContractError as exc:
        failures.append(str(exc))
    return raw_results, failures


def validate_create_thread_evidence(
    event: dict[str, Any],
    schema: dict[str, Any],
    *,
    case_id: str,
    candidate_source_revision: str,
    target_thread: str,
    target_host: str,
) -> str:
    request = require_object(
        event.get("request_args"),
        label=f"{case_id} create_thread request_args",
    )
    response = require_object(
        event.get("response_result"),
        label=f"{case_id} create_thread response_result",
    )
    contract = require_object(
        event.get("room_contract"),
        label=f"{case_id} room_contract",
    )
    effective = require_object(
        event.get("effective_starting_state"),
        label=f"{case_id} effective_starting_state",
    )
    require_fields(
        contract,
        [
            "task_card_id",
            "write_mode",
            "environment",
            "source_revision",
            "return_method",
            "return_authorization_ref",
            "allowed_paths",
            "forbidden_paths",
        ],
        label=f"{case_id} room_contract",
    )
    task_card_id = require_meaningful(
        contract.get("task_card_id"),
        label=f"{case_id} task_card_id",
    )
    write_mode = require_string(
        contract.get("write_mode"),
        label=f"{case_id} room write_mode",
    )
    environment = require_string(
        contract.get("environment"),
        label=f"{case_id} room environment",
    )
    source = require_meaningful(
        contract.get("source_revision"),
        label=f"{case_id} room source_revision",
        minimum=12,
    )
    return_method = require_string(
        contract.get("return_method"),
        label=f"{case_id} room return_method",
    )
    require_string_list(
        contract.get("allowed_paths"),
        label=f"{case_id} room allowed_paths",
        minimum=1,
    )
    require_string_list(
        contract.get("forbidden_paths"),
        label=f"{case_id} room forbidden_paths",
        minimum=1,
    )
    if write_mode not in schema["allowed_room_write_modes"]:
        raise ContractError(f"{case_id}: room write_mode is unsupported")
    if environment not in schema["allowed_room_environments"]:
        raise ContractError(f"{case_id}: room environment is unsupported")
    if return_method not in schema["allowed_return_methods"]:
        raise ContractError(f"{case_id}: room return method is unsupported")
    if write_mode == "writer":
        if environment != "worktree":
            raise ContractError(f"{case_id}: writer room must use a worktree")
        if source != candidate_source_revision:
            raise ContractError(
                f"{case_id}: writer room source revision differs from release candidate"
            )
        if return_method not in {
            "reviewed_patch",
            "reviewed_artifact_manifest",
            "authorized_git_commit",
        }:
            raise ContractError(f"{case_id}: writer room lacks a reviewed return method")
    elif return_method != "none":
        raise ContractError(f"{case_id}: read-only room must use return method none")

    target = require_object(
        request.get("target"),
        label=f"{case_id} create_thread target",
    )
    if target.get("type") != "project":
        raise ContractError(f"{case_id}: Studio room must target a saved project")
    project_id = require_meaningful(
        target.get("projectId"),
        label=f"{case_id} create_thread projectId",
    )
    requested_environment = require_object(
        target.get("environment"),
        label=f"{case_id} create_thread environment",
    )
    if requested_environment.get("type") != environment:
        raise ContractError(f"{case_id}: create_thread environment differs from room contract")
    prompt = require_meaningful(
        request.get("prompt"),
        label=f"{case_id} create_thread prompt",
        minimum=40,
    )
    for expected_text, label in (
        (task_card_id, "task_card_id"),
        (write_mode, "write_mode"),
        (environment, "environment"),
        (source, "source_revision"),
        (return_method, "return_method"),
    ):
        if expected_text not in prompt:
            raise ContractError(f"{case_id}: create_thread prompt omits {label}")
    for path in [*contract["allowed_paths"], *contract["forbidden_paths"]]:
        if path not in prompt:
            raise ContractError(f"{case_id}: create_thread prompt omits contracted path {path}")

    kind = require_string(
        effective.get("kind"),
        label=f"{case_id} effective starting-state kind",
    )
    revision = require_meaningful(
        effective.get("revision"),
        label=f"{case_id} effective starting-state revision",
        minimum=12,
    )
    if kind not in schema["allowed_starting_state_kinds"]:
        raise ContractError(f"{case_id}: effective starting-state kind is unsupported")
    if revision != source:
        raise ContractError(
            f"{case_id}: effective starting-state revision differs from room source revision"
        )
    supplied = requested_environment.get("startingState")
    if environment == "local":
        if write_mode != "read_only" or kind != "local_shared_checkout":
            raise ContractError(f"{case_id}: local Studio rooms must be read-only")
        if supplied is not None:
            raise ContractError(f"{case_id}: local room cannot supply a worktree startingState")
    elif kind == "default_branch":
        if supplied is not None:
            raise ContractError(f"{case_id}: default-branch worktree must omit startingState")
    elif kind == "working_tree":
        if not isinstance(supplied, dict) or supplied.get("type") != "working-tree":
            raise ContractError(f"{case_id}: working-tree evidence differs from request args")
    elif kind == "branch":
        if (
            not isinstance(supplied, dict)
            or supplied.get("type") != "branch"
            or not isinstance(supplied.get("branchName"), str)
            or not supplied["branchName"].strip()
        ):
            raise ContractError(f"{case_id}: branch evidence differs from request args")
    else:
        raise ContractError(f"{case_id}: worktree has an invalid effective starting state")

    if event.get("status") == "success":
        if (
            response.get("threadId") != target_thread
            or response.get("hostId") != target_host
        ):
            raise ContractError(f"{case_id}: create_thread response identifiers drifted")
    return project_id


def validate_case(
    item: dict[str, Any],
    expected: dict[str, Any],
    raw: Any,
    schema: dict[str, Any],
    generated_at: datetime,
    candidate_source_revision: str,
    subject_model: str,
) -> tuple[list[str], str]:
    case_id = expected["id"]
    failures: list[str] = []
    try:
        require_fields(item, schema["required_case_fields"], label=f"{case_id} result")
    except ContractError as exc:
        return [str(exc)], ""
    raw_fields = (
        "case_id",
        "initial_user",
        "session",
        "decision",
        "user_confirmation",
        "recommendation_card",
        "plan_owner",
        "transcript",
        "thread_trace",
        "director_trace",
        "director_trace_scope",
        "final_output",
    )
    if not isinstance(raw, dict):
        failures.append(f"{case_id}: raw result case is missing")
    else:
        for field in raw_fields:
            if raw.get(field) != item.get(field):
                failures.append(f"{case_id}: reviewed {field} differs from raw result")
    if "director_trace_complete" in item or (
        isinstance(raw, dict) and "director_trace_complete" in raw
    ):
        failures.append(
            f"{case_id}: director_trace_complete is an unsupported self-claim"
        )
    if item.get("director_trace_scope") != "host_and_transcript_events":
        failures.append(
            f"{case_id}: director trace scope must declare host_and_transcript_events"
        )
    if item.get("initial_user") != expected["initial_user"]:
        failures.append(f"{case_id}: initial user prompt differs from case contract")
    if item.get("decision") != expected["expected_decision"]:
        failures.append(f"{case_id}: Studio decision differs from case contract")

    session_id = ""
    session_start: Optional[datetime] = None
    session_end: Optional[datetime] = None
    try:
        session = require_object(item.get("session"), label=f"{case_id} session")
        require_fields(session, schema["required_session_fields"], label=f"{case_id} session")
        session_id = require_meaningful(
            session.get("thread_id"),
            label=f"{case_id} director thread_id",
            minimum=8,
        )
        require_meaningful(session.get("host_id"), label=f"{case_id} director host_id")
        session_start = require_datetime(session.get("started_at"), label=f"{case_id} started_at")
        session_end = require_datetime(session.get("ended_at"), label=f"{case_id} ended_at")
        if session_end < session_start or session_end > generated_at + MAX_CLOCK_SKEW:
            raise ContractError(f"{case_id} session timestamps are inconsistent")
    except ContractError as exc:
        failures.append(str(exc))

    transcript_ids: set[str] = set()
    transcript_roles: dict[str, str] = {}
    transcript_timestamps: dict[str, datetime] = {}
    transcript = item.get("transcript")
    if not isinstance(transcript, list) or not transcript:
        failures.append(f"{case_id}: transcript must be a non-empty list")
        transcript = []
    previous: Optional[datetime] = None
    user_contents: list[str] = []
    assistant_contents: list[str] = []
    writer_scopes: list[tuple[str, str]] = []
    for index, value in enumerate(transcript):
        try:
            event = require_object(value, label=f"{case_id} transcript event {index}")
            require_fields(
                event,
                schema["required_transcript_event_fields"],
                label=f"{case_id} transcript event {index}",
            )
            event_id = require_meaningful(event.get("event_id"), label=f"{case_id} transcript event id")
            role = require_string(event.get("role"), label=f"{case_id} transcript role")
            if event_id in transcript_ids or role not in schema["allowed_roles"]:
                raise ContractError(f"{case_id} duplicate transcript event or unsupported role")
            timestamp = require_datetime(event.get("timestamp"), label=f"{case_id} transcript timestamp")
            content = require_meaningful(event.get("content"), label=f"{case_id} transcript content")
            if previous is not None and timestamp < previous:
                raise ContractError(f"{case_id} transcript timestamps are not monotonic")
            if (
                session_start is not None
                and timestamp < session_start
                or session_end is not None
                and timestamp > session_end
            ):
                raise ContractError(f"{case_id} transcript event lies outside the session")
            previous = timestamp
            transcript_ids.add(event_id)
            transcript_roles[event_id] = role
            transcript_timestamps[event_id] = timestamp
            if role == "user":
                user_contents.append(content)
            if role == "assistant":
                assistant_contents.append(content)
        except ContractError as exc:
            failures.append(str(exc))
    if not user_contents or user_contents[0] != expected["initial_user"]:
        failures.append(f"{case_id}: user transcript does not start with the contracted prompt")
    if not assistant_contents or item.get("final_output") != assistant_contents[-1]:
        failures.append(f"{case_id}: final output does not match the final assistant event")

    confirmation_ref = ""
    confirmation_room_refs: list[str] = []
    confirmation_time: Optional[datetime] = None
    confirmed = False
    try:
        confirmation = require_object(
            item.get("user_confirmation"),
            label=f"{case_id} user_confirmation",
        )
        require_fields(
            confirmation,
            schema["required_confirmation_fields"],
            label=f"{case_id} user_confirmation",
        )
        require_bool(confirmation.get("required"), label=f"{case_id} confirmation required")
        confirmed = require_bool(confirmation.get("confirmed"), label=f"{case_id} confirmed")
        confirmation_ref = require_meaningful(
            confirmation.get("evidence_ref"),
            label=f"{case_id} confirmation evidence_ref",
        )
        if confirmation.get("case_id") != case_id:
            raise ContractError(f"{case_id} confirmation case_id drifted")
        confirmation_room_refs = require_string_list(
            confirmation.get("room_refs"),
            label=f"{case_id} confirmation room_refs",
            minimum=0,
        )
        if confirmed != expected["expected_confirmed"]:
            raise ContractError(f"{case_id} confirmation state differs from case contract")
        if confirmation_ref not in transcript_ids:
            raise ContractError(f"{case_id} confirmation evidence is missing from transcript")
        if confirmed and transcript_roles.get(confirmation_ref) != "user":
            raise ContractError(f"{case_id} confirmed topology lacks user evidence")
        confirmation_time = transcript_timestamps.get(confirmation_ref)
    except ContractError as exc:
        failures.append(str(exc))

    planned_rooms: dict[str, dict[str, Any]] = {}
    try:
        card = require_object(item.get("recommendation_card"), label=f"{case_id} recommendation_card")
        require_fields(
            card,
            schema["required_recommendation_fields"],
            label=f"{case_id} recommendation_card",
        )
        if card.get("decision") != item.get("decision"):
            raise ContractError(f"{case_id} recommendation card decision drifted")
        for field in ("reasons", "parallel_nodes", "serial_nodes", "rooms", "risks"):
            if not isinstance(card.get(field), list):
                raise ContractError(f"{case_id} recommendation card {field} must be a list")
        if len(card["rooms"]) < expected["minimum_planned_rooms"]:
            raise ContractError(f"{case_id} recommendation card omits planned rooms")
        for index, value in enumerate(card["rooms"]):
            room = require_object(
                value,
                label=f"{case_id} recommendation room {index}",
            )
            require_fields(
                room,
                schema["required_recommendation_room_fields"],
                label=f"{case_id} recommendation room {index}",
            )
            room_ref = require_meaningful(
                room.get("room_ref"),
                label=f"{case_id} recommendation room {index}",
            )
            if room_ref in planned_rooms:
                raise ContractError(f"{case_id} recommendation card contains duplicate rooms")
            require_meaningful(
                room.get("deliverable"),
                label=f"{case_id} recommendation deliverable",
            )
            planned_role = require_string(
                room.get("role"),
                label=f"{case_id} recommendation role",
            )
            planned_write_mode = require_string(
                room.get("write_mode"),
                label=f"{case_id} recommendation write_mode",
            )
            planned_environment = require_string(
                room.get("environment"),
                label=f"{case_id} recommendation environment",
            )
            planned_starting_state = require_string(
                room.get("starting_state"),
                label=f"{case_id} recommendation starting_state",
            )
            require_meaningful(
                room.get("source_revision"),
                label=f"{case_id} recommendation source_revision",
                minimum=12,
            )
            planned_return_method = require_string(
                room.get("return_method"),
                label=f"{case_id} recommendation return_method",
            )
            if planned_write_mode not in schema["allowed_room_write_modes"]:
                raise ContractError(f"{case_id}: recommendation write_mode is unsupported")
            if planned_role not in schema["allowed_room_roles"]:
                raise ContractError(f"{case_id}: recommendation role is unsupported")
            if planned_role == "reviewer" and planned_write_mode != "read_only":
                raise ContractError(f"{case_id}: reviewer room must be read-only")
            if planned_environment not in schema["allowed_room_environments"]:
                raise ContractError(f"{case_id}: recommendation environment is unsupported")
            if planned_starting_state not in schema["allowed_starting_state_kinds"]:
                raise ContractError(f"{case_id}: recommendation starting_state is unsupported")
            if planned_return_method not in schema["allowed_return_methods"]:
                raise ContractError(f"{case_id}: recommendation return_method is unsupported")
            if planned_write_mode == "writer" and (
                planned_environment != "worktree"
                or planned_return_method == "none"
            ):
                raise ContractError(f"{case_id}: recommendation contains an unsafe writer room")
            if planned_write_mode == "read_only" and (
                planned_environment != "local"
                or planned_starting_state != "local_shared_checkout"
                or planned_return_method != "none"
            ):
                raise ContractError(f"{case_id}: recommendation contains an unsafe read-only room")
            planned_rooms[room_ref] = room
        for field in ("owner_contract", "environment", "acceptance_chain"):
            require_meaningful(card.get(field), label=f"{case_id} recommendation card {field}")
        if set(confirmation_room_refs) != set(planned_rooms):
            raise ContractError(
                f"{case_id} user confirmation room_refs differ from the recommendation"
            )
    except ContractError as exc:
        failures.append(str(exc))

    plan_status = ""
    plan_materialized_at: Optional[datetime] = None
    try:
        plan_owner = require_object(
            item.get("plan_owner"),
            label=f"{case_id} plan_owner",
        )
        require_fields(
            plan_owner,
            schema["required_plan_owner_fields"],
            label=f"{case_id} plan_owner",
        )
        plan_status = require_string(
            plan_owner.get("status"),
            label=f"{case_id} plan owner status",
        )
        if plan_status not in schema["allowed_plan_owner_statuses"]:
            raise ContractError(f"{case_id}: plan owner status is unsupported")
        if plan_owner.get("case_id") != case_id:
            raise ContractError(f"{case_id}: plan owner case_id drifted")
        plan_room_refs = require_string_list(
            plan_owner.get("room_refs"),
            label=f"{case_id} plan owner room_refs",
            minimum=0,
        )
        if set(plan_room_refs) != set(planned_rooms):
            raise ContractError(
                f"{case_id}: plan owner room_refs differ from the recommendation"
            )
        if plan_owner.get("confirmation_ref") != confirmation_ref:
            raise ContractError(
                f"{case_id}: plan owner is not bound to user confirmation"
            )
        if confirmed:
            require_meaningful(
                plan_owner.get("path"),
                label=f"{case_id} plan owner path",
                minimum=8,
            )
            if plan_status != "materialized":
                raise ContractError(
                    f"{case_id}: confirmed Studio plan was not materialized"
                )
            plan_materialized_at = require_datetime(
                plan_owner.get("materialized_at"),
                label=f"{case_id} plan materialized_at",
            )
            if (
                confirmation_time is None
                or plan_materialized_at < confirmation_time
            ):
                raise ContractError(
                    f"{case_id}: plan materialization precedes confirmation"
                )
        else:
            expected_plan_status = (
                "proposed"
                if expected["expected_decision"] == "recommend_studio"
                else "not_required"
            )
            if plan_status != expected_plan_status:
                raise ContractError(
                    f"{case_id}: unconfirmed plan owner status is invalid"
                )
            if plan_owner.get("materialized_at") is not None:
                raise ContractError(
                    f"{case_id}: unconfirmed plan must not claim materialization"
                )
    except ContractError as exc:
        failures.append(str(exc))

    trace = item.get("thread_trace")
    if not isinstance(trace, list):
        failures.append(f"{case_id}: thread_trace must be a list")
        trace = []
    tool_names: list[str] = []
    successful_tool_names: list[str] = []
    event_ids: set[str] = set()
    created: dict[str, str] = {}
    created_room_refs: dict[tuple[str, str], str] = {}
    created_rooms: list[tuple[str, str]] = []
    waited_rooms: set[tuple[str, str]] = set()
    terminal_rooms: set[tuple[str, str]] = set()
    review_loop_send_count = 0
    resolved_project_ids: set[str] = set()
    handoff_operations: dict[str, tuple[str, str]] = {}
    completed_handoffs: set[str] = set()
    thread_events: dict[str, dict[str, Any]] = {}
    thread_event_completed: dict[str, datetime] = {}
    terminal_waits: dict[str, tuple[str, str, str, datetime]] = {}
    terminal_wait_decisions: dict[str, str] = {}
    latest_wait_cursor: dict[tuple[str, str], str] = {}
    pending_followup_wait: dict[tuple[str, str], datetime] = {}
    positive_wait_rooms: set[tuple[str, str]] = set()
    writer_room_refs: set[str] = set()
    first_create_started: Optional[datetime] = None
    previous_tool_completed: Optional[datetime] = None
    for index, value in enumerate(trace):
        try:
            event = require_object(value, label=f"{case_id} thread event {index}")
            require_fields(
                event,
                schema["required_thread_event_fields"],
                label=f"{case_id} thread event {index}",
            )
            event_id = require_meaningful(event.get("event_id"), label=f"{case_id} thread event id")
            tool_name = require_string(event.get("tool_name"), label=f"{case_id} tool name")
            if event_id in event_ids or tool_name not in schema["allowed_tool_names"]:
                raise ContractError(f"{case_id} duplicate event or unsupported Studio tool")
            if event.get("status") not in schema["allowed_tool_statuses"]:
                raise ContractError(f"{case_id} unsupported Studio tool status")
            started = require_datetime(event.get("started_at"), label=f"{case_id} tool started_at")
            completed = require_datetime(event.get("completed_at"), label=f"{case_id} tool completed_at")
            if completed < started:
                raise ContractError(f"{case_id} tool timestamps are inconsistent")
            if previous_tool_completed is not None and started < previous_tool_completed:
                raise ContractError(f"{case_id} thread trace timestamps are not monotonic")
            if (
                session_start is not None
                and started < session_start
                or session_end is not None
                and completed > session_end
            ):
                raise ContractError(f"{case_id} tool event lies outside the session")
            target_thread = require_meaningful(
                event.get("target_thread_id"),
                label=f"{case_id} target_thread_id",
            )
            target_host = require_meaningful(
                event.get("target_host_id"),
                label=f"{case_id} target_host_id",
            )
            require_meaningful(
                event.get("request_summary"),
                label=f"{case_id} request_summary",
                minimum=8,
            )
            require_meaningful(
                event.get("response_summary"),
                label=f"{case_id} response_summary",
                minimum=8,
            )
            authorization_ref = require_meaningful(
                event.get("authorization_ref"),
                label=f"{case_id} authorization_ref",
            )
            room_ref = require_meaningful(
                event.get("room_ref"),
                label=f"{case_id} room_ref",
            )
            request_args = require_object(
                event.get("request_args"),
                label=f"{case_id} request_args",
            )
            response_result = require_object(
                event.get("response_result"),
                label=f"{case_id} response_result",
            )
            effect = require_meaningful(event.get("effect"), label=f"{case_id} effect")
            if effect not in TOOL_EFFECTS[tool_name]:
                raise ContractError(
                    f"{case_id}: effect does not match {tool_name}: {effect}"
                )
            if tool_name in SEPARATE_USER_AUTHORIZATION_TOOLS:
                authorization_time = transcript_timestamps.get(authorization_ref)
                if (
                    authorization_ref == confirmation_ref
                    or transcript_roles.get(authorization_ref) != "user"
                    or authorization_time is None
                    or authorization_time > started
                ):
                    raise ContractError(
                        f"{case_id}: {tool_name} requires separate user authorization"
                    )
            if tool_name == "list_projects" and event.get("status") == "success":
                projects = response_result.get("projects")
                if not isinstance(projects, list) or not projects:
                    raise ContractError(f"{case_id}: list_projects returned no projects")
                for project_index, project in enumerate(projects):
                    project_object = require_object(
                        project,
                        label=f"{case_id} listed project {project_index}",
                    )
                    resolved_project_ids.add(
                        require_meaningful(
                            project_object.get("projectId"),
                            label=f"{case_id} listed projectId",
                        )
                    )
            if tool_name == "create_thread":
                if not confirmed or authorization_ref != confirmation_ref:
                    raise ContractError(f"{case_id}: create_thread occurred without explicit confirmation")
                if confirmation_time is None or confirmation_time > started:
                    raise ContractError(
                        f"{case_id}: create_thread occurred before user confirmation"
                    )
                if room_ref not in planned_rooms:
                    raise ContractError(
                        f"{case_id}: create_thread room is absent from the confirmed recommendation"
                    )
                project_id = validate_create_thread_evidence(
                    event,
                    schema,
                    case_id=case_id,
                    candidate_source_revision=candidate_source_revision,
                    target_thread=target_thread,
                    target_host=target_host,
                )
                if project_id not in resolved_project_ids:
                    raise ContractError(
                        f"{case_id}: create_thread projectId was not returned by list_projects"
                    )
                planned_room = planned_rooms[room_ref]
                room_contract = event["room_contract"]
                effective_state = event["effective_starting_state"]
                for field in (
                    "role",
                    "write_mode",
                    "environment",
                    "source_revision",
                    "return_method",
                ):
                    if room_contract.get(field) != planned_room.get(field):
                        raise ContractError(
                            f"{case_id}: create_thread {field} differs from confirmed recommendation"
                        )
                if effective_state.get("kind") != planned_room.get("starting_state"):
                    raise ContractError(
                        f"{case_id}: create_thread starting state differs from confirmed recommendation"
                    )
                return_method = event["room_contract"].get("return_method")
                if room_contract.get("write_mode") == "writer":
                    normalized_scopes: list[str] = []
                    for raw_scope in room_contract.get("allowed_paths", []):
                        scope = raw_scope.replace("\\", "/").strip()
                        while scope.startswith("./"):
                            scope = scope[2:]
                        scope = scope.rstrip("/")
                        parts = scope.split("/")
                        if (
                            not scope
                            or scope.startswith("/")
                            or any(part in {"", ".", ".."} for part in parts)
                            or any(char in scope for char in "*?[]{}")
                        ):
                            raise ContractError(
                                f"{case_id}: writer allowed_paths must use exact relative paths"
                            )
                        normalized_scopes.append(scope)
                    for scope in normalized_scopes:
                        for existing_room, existing_scope in writer_scopes:
                            if (
                                scope == existing_scope
                                or scope.startswith(existing_scope + "/")
                                or existing_scope.startswith(scope + "/")
                            ):
                                raise ContractError(
                                    f"{case_id}: writer allowed_paths overlap between "
                                    f"{existing_room} and {room_ref}: {existing_scope} / {scope}"
                                )
                        writer_scopes.append((room_ref, scope))
                return_authorization_ref = event["room_contract"].get(
                    "return_authorization_ref"
                )
                if return_method == "authorized_git_commit":
                    if (
                        not isinstance(return_authorization_ref, str)
                        or not return_authorization_ref
                        or return_authorization_ref == confirmation_ref
                        or transcript_roles.get(return_authorization_ref) != "user"
                        or transcript_timestamps.get(return_authorization_ref) is None
                        or transcript_timestamps[return_authorization_ref] > started
                    ):
                        raise ContractError(
                            f"{case_id}: Git return method lacks separate user authorization"
                        )
                elif return_authorization_ref is not None:
                    raise ContractError(
                        f"{case_id}: non-Git return method must not claim Git authorization"
                    )
                if event.get("status") == "success":
                    if first_create_started is None:
                        first_create_started = started
                    if target_thread in created:
                        raise ContractError(f"{case_id}: duplicate created thread id")
                    created[target_thread] = target_host
                    created_rooms.append((target_thread, target_host))
                    created_room_refs[(target_thread, target_host)] = room_ref
                    if room_contract.get("write_mode") == "writer":
                        writer_room_refs.add(room_ref)
            if tool_name in {
                "wait_threads",
                "send_message_to_thread",
                "read_thread",
                "fork_thread",
                "handoff_thread",
                "set_thread_archived",
            }:
                if target_thread not in created or created[target_thread] != target_host:
                    raise ContractError(f"{case_id}: {tool_name} targets an unknown created room")
                if room_ref not in planned_rooms:
                    raise ContractError(
                        f"{case_id}: {tool_name} room is absent from the confirmed recommendation"
                    )
            if tool_name == "wait_threads":
                targets = request_args.get("targets")
                if not isinstance(targets, list) or not 1 <= len(targets) <= 8:
                    raise ContractError(
                        f"{case_id}: wait_threads targets must contain 1..8 rooms"
                    )
                timeout_ms = request_args.get("timeoutMs")
                if (
                    isinstance(timeout_ms, bool)
                    or not isinstance(timeout_ms, int)
                    or not 0 <= timeout_ms <= 300000
                ):
                    raise ContractError(
                        f"{case_id}: wait_threads timeoutMs must be bounded"
                    )
                request_targets: dict[tuple[str, str], dict[str, Any]] = {}
                for target_index, raw_target in enumerate(targets):
                    target = require_object(
                        raw_target,
                        label=f"{case_id} wait target {target_index}",
                    )
                    if not set(target) <= {"threadId", "hostId", "afterCursor"}:
                        raise ContractError(
                            f"{case_id}: wait_threads target fields drifted"
                        )
                    wait_thread = require_meaningful(
                        target.get("threadId"),
                        label=f"{case_id} wait target threadId",
                    )
                    wait_host = target.get("hostId") or created.get(wait_thread)
                    wait_host = require_meaningful(
                        wait_host,
                        label=f"{case_id} wait target hostId",
                    )
                    room_key = (wait_thread, wait_host)
                    if room_key not in created_room_refs or room_key in request_targets:
                        raise ContractError(
                            f"{case_id}: wait_threads targets an unknown or duplicate room"
                        )
                    prior_cursor = latest_wait_cursor.get(room_key)
                    supplied_cursor = target.get("afterCursor")
                    if prior_cursor is None:
                        if supplied_cursor is not None:
                            raise ContractError(
                                f"{case_id}: first wait_threads cursor is not empty"
                            )
                    elif supplied_cursor != prior_cursor:
                        raise ContractError(
                            f"{case_id}: wait_threads did not use the latest saved cursor"
                        )
                    request_targets[room_key] = target
                if event.get("status") == "success":
                    timed_out = require_bool(
                        response_result.get("timedOut"),
                        label=f"{case_id} wait_threads timedOut",
                    )
                    polls = response_result.get("polls")
                    errors = response_result.get("errors")
                    if not isinstance(polls, list) or not isinstance(errors, list):
                        raise ContractError(
                            f"{case_id}: wait_threads response must contain polls and errors"
                        )
                    if errors:
                        raise ContractError(
                            f"{case_id}: successful wait_threads contains per-target errors"
                        )
                    poll_by_room: dict[tuple[str, str], dict[str, Any]] = {}
                    for poll_index, raw_poll in enumerate(polls):
                        poll = require_object(
                            raw_poll,
                            label=f"{case_id} wait poll {poll_index}",
                        )
                        thread_state = require_object(
                            poll.get("thread"),
                            label=f"{case_id} wait poll thread",
                        )
                        poll_thread = require_meaningful(
                            thread_state.get("id"),
                            label=f"{case_id} wait poll thread id",
                        )
                        poll_host = require_meaningful(
                            thread_state.get("hostId"),
                            label=f"{case_id} wait poll hostId",
                        )
                        room_key = (poll_thread, poll_host)
                        if room_key not in request_targets or room_key in poll_by_room:
                            raise ContractError(
                                f"{case_id}: wait_threads poll targets an unknown or duplicate room"
                            )
                        require_int(
                            poll.get("schemaVersion"),
                            label=f"{case_id} wait poll schemaVersion",
                            minimum=1,
                        )
                        require_int(
                            poll.get("revision"),
                            label=f"{case_id} wait poll revision",
                            minimum=0,
                        )
                        changed = require_bool(
                            poll.get("changed"),
                            label=f"{case_id} wait poll changed",
                        )
                        cursor = require_meaningful(
                            poll.get("cursor"),
                            label=f"{case_id} wait poll cursor",
                        )
                        prior_cursor = latest_wait_cursor.get(room_key)
                        if changed and prior_cursor == cursor:
                            raise ContractError(
                                f"{case_id}: wait_threads cursor did not advance for changed poll"
                            )
                        if not changed and prior_cursor is not None and prior_cursor != cursor:
                            raise ContractError(
                                f"{case_id}: unchanged wait_threads poll changed cursor"
                            )
                        status = require_object(
                            thread_state.get("status"),
                            label=f"{case_id} wait poll thread status",
                        )
                        require_meaningful(
                            status.get("type"),
                            label=f"{case_id} wait poll thread status type",
                        )
                        latest_wait_cursor[room_key] = cursor
                        poll_by_room[room_key] = poll
                        waited_rooms.add(room_key)
                        if timeout_ms > 0:
                            positive_wait_rooms.add(room_key)
                        if room_key in pending_followup_wait:
                            if not changed or prior_cursor == cursor:
                                raise ContractError(
                                    f"{case_id}: rework wait cursor did not advance"
                                )
                            pending_followup_wait.pop(room_key)
                    if set(poll_by_room) != set(request_targets):
                        raise ContractError(
                            f"{case_id}: wait_threads polls do not cover every request target"
                        )
                    wake = response_result.get("wake")
                    primary_key = next(iter(request_targets))
                    if wake is not None:
                        wake_object = require_object(
                            wake,
                            label=f"{case_id} wait_threads wake",
                        )
                        wake_key = (
                            require_meaningful(
                                wake_object.get("threadId"),
                                label=f"{case_id} wait wake threadId",
                            ),
                            require_meaningful(
                                wake_object.get("hostId"),
                                label=f"{case_id} wait wake hostId",
                            ),
                        )
                        require_meaningful(
                            wake_object.get("reason"),
                            label=f"{case_id} wait wake reason",
                        )
                        if wake_key not in poll_by_room:
                            raise ContractError(
                                f"{case_id}: wait_threads wake is absent from polls"
                            )
                        primary_key = wake_key
                    elif not timed_out:
                        raise ContractError(
                            f"{case_id}: non-timeout wait_threads response lacks wake"
                        )
                    if (target_thread, target_host) != primary_key:
                        raise ContractError(
                            f"{case_id}: wait_threads evidence target differs from wake/primary poll"
                        )
                    if created_room_refs[primary_key] != room_ref:
                        raise ContractError(
                            f"{case_id}: wait_threads room differs from wake/primary poll"
                        )
                    primary_poll = poll_by_room[primary_key]
                    latest_turn = primary_poll.get("latestTurn")
                    if isinstance(latest_turn, dict) and latest_turn.get("status") in {
                        "completed",
                        "interrupted",
                        "failed",
                        "blocked",
                        "needs_user_decision",
                    }:
                        completed_at_value = latest_turn.get("completedAt")
                        if isinstance(completed_at_value, bool) or not isinstance(
                            completed_at_value, (int, float)
                        ):
                            raise ContractError(
                                f"{case_id}: terminal wait poll lacks child completion time"
                            )
                        child_completed_at = datetime.fromtimestamp(
                            completed_at_value,
                            tz=timezone.utc,
                        )
                        if child_completed_at > completed:
                            raise ContractError(
                                f"{case_id}: child completion occurs after observation"
                            )
                        terminal_rooms.add(primary_key)
                        terminal_waits[event_id] = (
                            primary_key[0],
                            primary_key[1],
                            room_ref,
                            child_completed_at,
                        )
                        assistant_message = require_object(
                            primary_poll.get("latestAssistantMessage"),
                            label=f"{case_id} terminal wait latestAssistantMessage",
                        )
                        direct_text = require_meaningful(
                            assistant_message.get("text"),
                            label=f"{case_id} terminal wait direct result",
                            minimum=8,
                        )
                        direct_decision = direct_text.split(":", 1)[0].strip()
                        if direct_decision not in schema["allowed_room_result_decisions"]:
                            raise ContractError(
                                f"{case_id}: terminal wait lacks a direct structured room decision"
                            )
                        terminal_wait_decisions[event_id] = direct_decision
            if tool_name == "exec_command":
                if target_thread != "director" or target_host != "local" or room_ref != "director":
                    raise ContractError(f"{case_id}: exec_command gate must belong to the director")
                require_meaningful(
                    request_args.get("cmd"),
                    label=f"{case_id} exec_command cmd",
                    minimum=8,
                )
                if event.get("status") == "success" and response_result.get("exit_code") != 0:
                    raise ContractError(f"{case_id}: successful exec_command gate did not exit zero")
            if tool_name == "read_thread":
                if (
                    request_args.get("threadId") != target_thread
                    or request_args.get("hostId") not in {None, target_host}
                ):
                    raise ContractError(
                        f"{case_id}: read_thread request target differs from evidence"
                    )
            if tool_name == "send_message_to_thread":
                if "message" in request_args or not isinstance(
                    request_args.get("prompt"), str
                ):
                    raise ContractError(
                        f"{case_id}: send_message_to_thread must use prompt, not message"
                    )
                if (
                    request_args.get("threadId") != target_thread
                    or request_args.get("hostId") not in {None, target_host}
                    or not request_args["prompt"].strip()
                ):
                    raise ContractError(
                        f"{case_id}: send_message_to_thread request target is invalid"
                    )
                if "model" in request_args or "thinking" in request_args:
                    raise ContractError(
                        f"{case_id}: Studio continuation cannot silently override model cost"
                    )
                if authorization_ref != confirmation_ref:
                    raise ContractError(
                        f"{case_id}: send_message_to_thread exceeds confirmed room scope"
                    )
                if event.get("status") == "success":
                    pending_followup_wait[(target_thread, target_host)] = completed
            if tool_name == "fork_thread":
                if (
                    request_args.get("threadId") != target_thread
                    or not isinstance(request_args.get("environment"), dict)
                    or request_args["environment"].get("type")
                    not in {"same-directory", "worktree"}
                ):
                    raise ContractError(f"{case_id}: fork_thread request is invalid")
                if event.get("status") == "success":
                    forked_thread = response_result.get("threadId")
                    queued_thread = response_result.get("clientThreadId")
                    if bool(forked_thread) == bool(queued_thread):
                        raise ContractError(
                            f"{case_id}: fork_thread must return one child identifier"
                        )
                    if forked_thread:
                        child = require_meaningful(
                            forked_thread,
                            label=f"{case_id} forked thread id",
                        )
                        if child in created:
                            raise ContractError(
                                f"{case_id}: fork_thread returned a duplicate child"
                            )
                        created[child] = target_host
                        created_rooms.append((child, target_host))
                        created_room_refs[(child, target_host)] = room_ref
            if tool_name == "handoff_thread":
                if request_args.get("threadId") != target_thread:
                    raise ContractError(
                        f"{case_id}: handoff_thread request target differs from evidence"
                    )
                if event.get("status") == "success":
                    operation_id = require_meaningful(
                        response_result.get("operationId"),
                        label=f"{case_id} handoff operationId",
                    )
                    revision = response_result.get("revision")
                    if isinstance(revision, bool) or not isinstance(revision, int):
                        raise ContractError(
                            f"{case_id}: handoff_thread revision must be an integer"
                        )
                    handoff_operations[operation_id] = (target_thread, target_host)
            if tool_name == "get_handoff_status":
                operation_id = require_meaningful(
                    request_args.get("operationId"),
                    label=f"{case_id} handoff status operationId",
                )
                target = handoff_operations.get(operation_id)
                if target != (target_thread, target_host):
                    raise ContractError(
                        f"{case_id}: get_handoff_status targets an unknown handoff"
                    )
                if event.get("status") == "success":
                    if response_result.get("status") != "completed":
                        raise ContractError(
                            f"{case_id}: successful handoff evidence is not terminal"
                        )
                    completed_handoffs.add(operation_id)
            if tool_name == "set_thread_archived":
                if (
                    request_args.get("threadId") != target_thread
                    or request_args.get("hostId") not in {None, target_host}
                    or request_args.get("archived") is not True
                ):
                    raise ContractError(
                        f"{case_id}: set_thread_archived request is invalid"
                    )
                if (target_thread, target_host) not in terminal_rooms:
                    raise ContractError(
                        f"{case_id}: set_thread_archived requires observed terminal state"
                    )
            if (
                tool_name == "send_message_to_thread"
                and event.get("status") == "success"
                and expected.get("topology_family") == "same_room_review_rework"
            ):
                room_index = review_loop_send_count % 2
                if len(created_rooms) < 2:
                    raise ContractError(
                        f"{case_id}: review-rework loop lacks producer and reviewer rooms"
                    )
                if (target_thread, target_host) != created_rooms[room_index]:
                    if room_index == 0:
                        raise ContractError(
                            f"{case_id}: rework must return to the original producer room"
                        )
                    raise ContractError(
                        f"{case_id}: re-review must return to the original reviewer room"
                    )
                review_loop_send_count += 1
            event_ids.add(event_id)
            thread_events[event_id] = event
            thread_event_completed[event_id] = completed
            tool_names.append(tool_name)
            if event.get("status") == "success":
                successful_tool_names.append(tool_name)
            previous_tool_completed = completed
        except ContractError as exc:
            failures.append(str(exc))
    missing_waits = [
        thread_id
        for thread_id, host_id in created_rooms
        if (thread_id, host_id) not in waited_rooms
    ]
    if missing_waits:
        failures.append(
            f"{case_id}: wait_threads did not cover every created room: "
            f"{', '.join(missing_waits)}"
        )
    missing_active_monitoring = [
        thread_id
        for thread_id, host_id in created_rooms
        if (thread_id, host_id) not in positive_wait_rooms
    ]
    if missing_active_monitoring:
        failures.append(
            f"{case_id}: bounded positive wait was not observed for every created room: "
            f"{', '.join(missing_active_monitoring)}"
        )
    missing_handoff_status = sorted(set(handoff_operations) - completed_handoffs)
    if missing_handoff_status:
        failures.append(
            f"{case_id}: handoff_thread completion was not observed: "
            f"{', '.join(missing_handoff_status)}"
        )
    create_count = sum(1 for name in successful_tool_names if name == "create_thread")
    if not (
        expected["minimum_create_threads"]
        <= create_count
        <= expected["maximum_create_threads"]
    ):
        failures.append(
            f"{case_id}: create_thread count {create_count} is outside "
            f"{expected['minimum_create_threads']}..{expected['maximum_create_threads']}"
        )
    if not is_subsequence(expected["expected_tool_sequence"], successful_tool_names):
        failures.append(f"{case_id}: required tool sequence was not observed")

    if pending_followup_wait:
        failures.append(
            f"{case_id}: rework or continuation was not followed by wait_threads"
        )
    if (
        confirmed
        and first_create_started is not None
        and plan_materialized_at is not None
        and plan_materialized_at > first_create_started
    ):
        failures.append(f"{case_id}: Studio plan was materialized after room creation")

    director_event_ids: set[str] = set()
    host_tool_refs: set[str] = set()
    handled_wait_refs: set[str] = set()
    result_decisions: dict[str, list[str]] = {}
    review_records: dict[str, tuple[str, str, str, str]] = {}
    verified_return_rooms: set[str] = set()
    verified_return_event_refs: dict[str, str] = {}
    integration_times: list[datetime] = []
    integration_revision: Optional[str] = None
    disposition_time: Optional[datetime] = None
    disposition_confirmation_ref: Optional[str] = None
    dispositions: dict[str, str] = {}
    plan_materialized_events = 0
    pending_results: set[str] = set()
    snapshot_required_events: list[tuple[int, str]] = []
    director_user_refs: set[str] = set()
    director_events: list[dict[str, Any]] = []
    director_trace = item.get("director_trace")
    if not isinstance(director_trace, list):
        failures.append(f"{case_id}: director_trace must be a list")
        director_trace = []
    elif confirmed and created_rooms and not director_trace:
        failures.append(f"{case_id}: director_trace must not be empty")
    previous_director_time: Optional[datetime] = None
    for index, value in enumerate(director_trace):
        try:
            event = require_object(
                value,
                label=f"{case_id} director event {index}",
            )
            require_fields(
                event,
                schema["required_director_event_fields"],
                label=f"{case_id} director event {index}",
            )
            director_event_id = require_meaningful(
                event.get("event_id"),
                label=f"{case_id} director event id",
            )
            event_kind = require_string(
                event.get("event_kind"),
                label=f"{case_id} director event kind",
            )
            if (
                director_event_id in director_event_ids
                or event_kind not in schema["allowed_director_event_kinds"]
            ):
                raise ContractError(
                    f"{case_id} duplicate director event or unsupported event kind"
                )
            event_time = require_datetime(
                event.get("timestamp"),
                label=f"{case_id} director event timestamp",
            )
            if previous_director_time is not None and event_time < previous_director_time:
                raise ContractError(
                    f"{case_id} director trace timestamps are not monotonic"
                )
            if (
                session_start is not None
                and event_time < session_start
                or session_end is not None
                and event_time > session_end
            ):
                raise ContractError(f"{case_id} director event lies outside the session")
            room_ref = require_meaningful(
                event.get("room_ref"),
                label=f"{case_id} director room_ref",
            )
            require_meaningful(
                event.get("phase"),
                label=f"{case_id} director phase",
            )
            details = require_object(
                event.get("details"),
                label=f"{case_id} director details",
            )
            thread_ref = event.get("thread_event_ref")
            transcript_ref = event.get("transcript_event_ref")
            if thread_ref is not None and not isinstance(thread_ref, str):
                raise ContractError(f"{case_id}: thread_event_ref must be a string or null")
            if transcript_ref is not None:
                if not isinstance(transcript_ref, str) or transcript_ref not in transcript_ids:
                    raise ContractError(
                        f"{case_id}: transcript_event_ref is missing from transcript"
                    )

            if pending_results and event_kind != "room_result_handled":
                related_read = False
                if event_kind == "host_tool" and isinstance(thread_ref, str):
                    related = thread_events.get(thread_ref)
                    related_read = bool(
                        related
                        and related.get("tool_name") == "read_thread"
                        and any(
                            terminal_waits[pending][2] == room_ref
                            for pending in pending_results
                        )
                    )
                if not related_read:
                    raise ContractError(
                        f"{case_id}: actionable room result was not handled before unrelated director activity"
                    )

            if event_kind == "plan_materialized":
                plan_materialized_events += 1
                if (
                    not confirmed
                    or plan_status != "materialized"
                    or plan_materialized_at is None
                    or event_time != plan_materialized_at
                ):
                    raise ContractError(
                        f"{case_id}: director plan event differs from the plan owner"
                    )
            elif event_kind == "host_tool":
                if not isinstance(thread_ref, str) or thread_ref not in thread_events:
                    raise ContractError(
                        f"{case_id}: director host_tool lacks a real thread event"
                    )
                if thread_ref in host_tool_refs:
                    raise ContractError(
                        f"{case_id}: director host_tool event is duplicated"
                    )
                tool_event = thread_events[thread_ref]
                if tool_event.get("room_ref") != room_ref:
                    raise ContractError(
                        f"{case_id}: director host_tool room differs from thread evidence"
                    )
                if event_time < thread_event_completed[thread_ref]:
                    raise ContractError(
                        f"{case_id}: director observed a host event before it completed"
                    )
                host_tool_refs.add(thread_ref)
                if thread_ref in terminal_waits:
                    pending_results.add(thread_ref)
            elif event_kind == "room_result_handled":
                if not isinstance(thread_ref, str) or thread_ref not in terminal_waits:
                    raise ContractError(
                        f"{case_id}: room_result_handled lacks terminal wait evidence"
                    )
                if thread_ref not in pending_results or thread_ref in handled_wait_refs:
                    raise ContractError(
                        f"{case_id}: room result was handled out of order or twice"
                    )
                if terminal_waits[thread_ref][2] != room_ref:
                    raise ContractError(
                        f"{case_id}: handled result room differs from wait evidence"
                    )
                decision = require_string(
                    details.get("decision"),
                    label=f"{case_id} room result decision",
                )
                if decision not in schema["allowed_room_result_decisions"]:
                    raise ContractError(
                        f"{case_id}: unsupported room result decision"
                    )
                if terminal_wait_decisions.get(thread_ref) != decision:
                    raise ContractError(
                        f"{case_id}: handled decision differs from the direct room result"
                    )
                if event_time < thread_event_completed[thread_ref]:
                    raise ContractError(
                        f"{case_id}: room result was handled before observation"
                    )
                handled_wait_refs.add(thread_ref)
                pending_results.remove(thread_ref)
                result_decisions.setdefault(room_ref, []).append(decision)
            elif event_kind == "review_completed":
                producer_room_ref = require_meaningful(
                    details.get("producer_room_ref"),
                    label=f"{case_id} reviewed producer room",
                )
                reviewer_ref = require_meaningful(
                    details.get("reviewer_ref"),
                    label=f"{case_id} independent reviewer ref",
                )
                verdict = require_string(
                    details.get("verdict"),
                    label=f"{case_id} review verdict",
                )
                source_wait_ref = require_meaningful(
                    details.get("source_wait_ref"),
                    label=f"{case_id} review source wait",
                )
                if producer_room_ref not in planned_rooms or reviewer_ref == producer_room_ref:
                    raise ContractError(
                        f"{case_id}: review lacks an independent producer/reviewer binding"
                    )
                if verdict not in {"PASS", "REWORK", "BLOCKED", "NEEDS_USER_DECISION"}:
                    raise ContractError(f"{case_id}: review verdict is unsupported")
                if source_wait_ref not in terminal_waits:
                    raise ContractError(
                        f"{case_id}: review lacks direct terminal wait evidence"
                    )
                source_room = terminal_waits[source_wait_ref][2]
                if reviewer_ref == "director":
                    if source_room != producer_room_ref:
                        raise ContractError(
                            f"{case_id}: director review is not bound to the producer return"
                        )
                    review_tool_ref = details.get("review_tool_ref")
                    review_tool = (
                        thread_events.get(review_tool_ref)
                        if isinstance(review_tool_ref, str)
                        else None
                    )
                    if (
                        not review_tool
                        or review_tool.get("tool_name") != "exec_command"
                        or review_tool.get("status") != "success"
                        or review_tool.get("response_result", {}).get("exit_code") != 0
                        or thread_event_completed.get(review_tool_ref, event_time) > event_time
                    ):
                        raise ContractError(
                            f"{case_id}: director review lacks a successful host gate"
                        )
                else:
                    reviewer_room = planned_rooms.get(reviewer_ref)
                    if (
                        not reviewer_room
                        or reviewer_room.get("role") != "reviewer"
                        or reviewer_room.get("write_mode") != "read_only"
                        or source_room != reviewer_ref
                    ):
                        raise ContractError(
                            f"{case_id}: review lacks an independent read-only reviewer room"
                        )
                    if terminal_wait_decisions.get(source_wait_ref) != verdict:
                        raise ContractError(
                            f"{case_id}: reviewer verdict differs from direct room evidence"
                        )
                review_records[director_event_id] = (
                    producer_room_ref,
                    reviewer_ref,
                    verdict,
                    source_wait_ref,
                )
            elif event_kind == "return_verified":
                planned_room = planned_rooms.get(room_ref)
                if not planned_room or planned_room.get("write_mode") != "writer":
                    raise ContractError(
                        f"{case_id}: return verification targets an unknown writer room"
                    )
                reviewer_ref = details.get("reviewer_ref")
                review_evidence_ref = details.get("review_evidence_ref")
                if not isinstance(reviewer_ref, str) or not isinstance(
                    review_evidence_ref, str
                ):
                    raise ContractError(
                        f"{case_id}: writer return lacks independent reviewer evidence"
                    )
                review_record = review_records.get(review_evidence_ref)
                if (
                    not review_record
                    or review_record[0] != room_ref
                    or review_record[1] != reviewer_ref
                    or review_record[2] != "PASS"
                ):
                    raise ContractError(
                        f"{case_id}: writer return lacks independent reviewer evidence"
                    )
                verification_tool_ref = details.get("verification_tool_ref")
                if not isinstance(verification_tool_ref, str):
                    raise ContractError(
                        f"{case_id}: return verification lacks a successful host gate"
                    )
                verification_tool = thread_events.get(verification_tool_ref)
                if (
                    not verification_tool
                    or verification_tool.get("tool_name") != "exec_command"
                    or verification_tool.get("status") != "success"
                    or verification_tool.get("response_result", {}).get("exit_code") != 0
                    or thread_event_completed.get(verification_tool_ref, event_time) > event_time
                ):
                    raise ContractError(
                        f"{case_id}: return verification lacks a successful host gate"
                    )
                if details.get("return_method") != planned_room.get("return_method"):
                    raise ContractError(f"{case_id}: verified return method drifted")
                artifact_sha256 = require_meaningful(
                    details.get("artifact_sha256"),
                    label=f"{case_id} return artifact SHA-256",
                    minimum=64,
                )
                if len(artifact_sha256) != 64 or any(
                    char not in "0123456789abcdef" for char in artifact_sha256
                ):
                    raise ContractError(f"{case_id}: return artifact SHA-256 is invalid")
                require_meaningful(
                    details.get("artifact_path"),
                    label=f"{case_id} return artifact path",
                )
                if details.get("base_revision") != planned_room.get("source_revision"):
                    raise ContractError(f"{case_id}: return base revision drifted")
                if (
                    details.get("destination_drift") != "clear"
                    or details.get("dry_apply_status") != "passed"
                ):
                    raise ContractError(f"{case_id}: return preconditions did not pass")
                verified_return_rooms.add(room_ref)
                verified_return_event_refs[room_ref] = director_event_id
            elif event_kind == "integration_completed":
                if room_ref != "director":
                    raise ContractError(
                        f"{case_id}: integration completion must belong to the director"
                    )
                gate_tool_ref = details.get("gate_tool_ref")
                if not isinstance(gate_tool_ref, str):
                    raise ContractError(
                        f"{case_id}: integration lacks a successful combined host gate"
                    )
                gate_tool = thread_events.get(gate_tool_ref)
                if (
                    not gate_tool
                    or gate_tool.get("tool_name") != "exec_command"
                    or gate_tool.get("status") != "success"
                    or gate_tool.get("response_result", {}).get("exit_code") != 0
                    or thread_event_completed.get(gate_tool_ref, event_time) > event_time
                ):
                    raise ContractError(
                        f"{case_id}: integration lacks a successful combined host gate"
                    )
                return_refs = require_string_list(
                    details.get("return_event_refs"),
                    label=f"{case_id} integration return_event_refs",
                    minimum=0,
                )
                if set(return_refs) != set(verified_return_event_refs.values()):
                    raise ContractError(
                        f"{case_id}: integration gate is not bound to every verified return"
                    )
                output = gate_tool.get("response_result", {}).get("output", "")
                revisions = re.findall(r"^integrated_revision=([0-9a-f]{40}|[0-9a-f]{64})$", output, re.M) if isinstance(output, str) else []
                integration_revision = revisions[0] if len(revisions) == 1 else None
                integration_times.append(event_time)
            elif event_kind == "room_dispositions_confirmed":
                if (len(integration_times) != 1 or event_time <= integration_times[0]
                        or disposition_time is not None or room_ref != "director"):
                    raise ContractError(f"{case_id}: disposition requires one completed integration")
                if (transcript_ref is None or transcript_roles.get(transcript_ref) != "user"
                        or not integration_times[0] < transcript_timestamps[transcript_ref] <= event_time):
                    raise ContractError(f"{case_id}: disposition requires post-integration user confirmation")
                rows = details.get("rooms")
                if not isinstance(rows, list):
                    raise ContractError(f"{case_id}: disposition requires every room exactly once")
                for row in rows:
                    row = require_object(row, label=f"{case_id} room disposition")
                    ref = row.get("room_ref")
                    choice = row.get("disposition")
                    if not isinstance(ref, str) or ref not in planned_rooms or ref in dispositions:
                        raise ContractError(f"{case_id}: disposition requires every room exactly once")
                    if choice not in {"one_off", "likely_rework", "reusable_context"}:
                        raise ContractError(f"{case_id}: room disposition is invalid")
                    if choice == "reusable_context":
                        context = require_object(row.get("context"), label=f"{case_id} reusable room context")
                        creation = next((tool for tool in thread_events.values()
                                         if tool.get("room_ref") == ref and tool.get("tool_name") == "create_thread"), None)
                        if (not creation or context.get("thread_id") != creation.get("target_thread_id")
                                or context.get("host_id") != creation.get("target_host_id")
                                or integration_revision is None
                                or context.get("integrated_revision") != integration_revision
                                or context.get("plan_path") != plan_owner.get("path")):
                            raise ContractError(f"{case_id}: reusable room context identity is invalid")
                        require_meaningful(context.get("deliverable"), label=f"{case_id} reusable deliverable")
                    dispositions[ref] = choice
                if set(dispositions) != set(planned_rooms):
                    raise ContractError(f"{case_id}: disposition requires every room exactly once")
                disposition_time = event_time
                disposition_confirmation_ref = transcript_ref
                director_user_refs.add(transcript_ref)
            elif event_kind in {"subagent_activity", "cursor_activity"}:
                if room_ref in planned_rooms or details.get("claimed_role") == "studio_room":
                    mechanism = "subagent" if event_kind == "subagent_activity" else "Cursor"
                    raise ContractError(
                        f"{case_id}: {mechanism} activity cannot count as a Studio room"
                    )
            elif event_kind == "user_completion_reminder":
                if room_ref in planned_rooms:
                    raise ContractError(
                        f"{case_id}: user reminder occurred after room completion before review"
                    )
            elif event_kind == "compaction_recovered":
                snapshot_required_events.append((index, "compaction recovery"))
            elif event_kind == "user_message":
                if transcript_ref is None or transcript_roles.get(transcript_ref) != "user":
                    raise ContractError(
                        f"{case_id}: user_message lacks direct user transcript evidence"
                    )
                director_user_refs.add(transcript_ref)
                snapshot_required_events.append((index, "user message"))

            director_event_ids.add(director_event_id)
            director_events.append(event)
            previous_director_time = event_time
        except ContractError as exc:
            failures.append(str(exc))

    missing_host_events = sorted(set(thread_events) - host_tool_refs)
    extra_host_events = sorted(host_tool_refs - set(thread_events))
    if missing_host_events or extra_host_events:
        failures.append(
            f"{case_id}: director_trace does not cover the complete host-tool interval"
        )
    missing_handled_results = sorted(set(terminal_waits) - handled_wait_refs)
    if missing_handled_results or pending_results:
        failures.append(
            f"{case_id}: terminal room result lacks director review"
        )
    if first_create_started is not None:
        post_create_user_refs = {
            event_id
            for event_id, role in transcript_roles.items()
            if role == "user"
            and transcript_timestamps[event_id] >= first_create_started
        }
        missing_user_activity = sorted(post_create_user_refs - director_user_refs)
        if missing_user_activity:
            failures.append(
                f"{case_id}: director_trace omits a post-creation user message"
            )
    if confirmed and created_rooms:
        if plan_materialized_events != 1:
            failures.append(
                f"{case_id}: director_trace must contain one plan materialization"
            )
        missing_returns = sorted(writer_room_refs - verified_return_rooms)
        if missing_returns:
            failures.append(
                f"{case_id}: reviewed writer return was not verified: "
                f"{', '.join(missing_returns)}"
            )
        if len(integration_times) != 1:
            failures.append(
                f"{case_id}: director integration completion was not recorded exactly once"
            )
        if disposition_time is None:
            failures.append(f"{case_id}: Studio closure lacks confirmed room dispositions")
        if integration_times:
            for closing_event in director_events:
                if require_datetime(closing_event["timestamp"], label="closure timestamp") <= integration_times[0]:
                    continue
                if closing_event["event_kind"] == "room_dispositions_confirmed":
                    continue
                tool = thread_events.get(closing_event.get("thread_event_ref"), {})
                if closing_event["event_kind"] != "host_tool" or tool.get("tool_name") != "set_thread_archived":
                    failures.append(f"{case_id}: integration completion is not the final implementation action")
            archived_rooms: set[str] = set()
            for tool_ref, tool in thread_events.items():
                if tool.get("tool_name") != "set_thread_archived":
                    continue
                ref = tool.get("room_ref")
                if (disposition_time is None or require_datetime(tool["started_at"], label="archive started_at") <= disposition_time
                        or tool.get("authorization_ref") != disposition_confirmation_ref
                        or dispositions.get(ref) not in {"one_off", "reusable_context"}):
                    failures.append(f"{case_id}: archive lacks confirmed room disposition")
                if tool.get("status") == "success":
                    archived_rooms.add(ref)
            if archived_rooms != {ref for ref, choice in dispositions.items() if choice in {"one_off", "reusable_context"}}:
                failures.append(f"{case_id}: confirmed archive dispositions are incomplete")
        for ref in planned_rooms:
            decisions = result_decisions.get(ref, [])
            reviewed = any(record[0] == ref and record[2] == "PASS" for record in review_records.values())
            if not decisions or (decisions[-1] != "PASS" and not (decisions[-1] == "READY_FOR_REVIEW" and reviewed)):
                failures.append(f"{case_id}: closure has unresolved room result: {ref}")
        unpassed_writer_rooms = sorted(
            room_ref
            for room_ref in writer_room_refs
            if not any(
                review[0] == room_ref and review[2] == "PASS"
                for review in review_records.values()
            )
        )
        if unpassed_writer_rooms:
            failures.append(
                f"{case_id}: writer return reached integration without final PASS: "
                f"{', '.join(unpassed_writer_rooms)}"
            )
        unpassed_reviewer_rooms = sorted(
            room_ref
            for room_ref, room in planned_rooms.items()
            if room.get("role") == "reviewer"
            and (
                not result_decisions.get(room_ref)
                or result_decisions[room_ref][-1] != "PASS"
            )
        )
        if unpassed_reviewer_rooms:
            failures.append(
                f"{case_id}: integration lacks a final PASS from an independent reviewer room: "
                f"{', '.join(unpassed_reviewer_rooms)}"
            )
    if expected.get("topology_family") == "same_room_review_rework":
        all_decisions = [
            decision
            for decisions in result_decisions.values()
            for decision in decisions
        ]
        if "REWORK" not in all_decisions or not all_decisions or all_decisions[-1] != "PASS":
            failures.append(
                f"{case_id}: review-rework loop lacks REWORK followed by final PASS"
            )
    for snapshot_index, snapshot_trigger in snapshot_required_events:
        following = director_events[snapshot_index + 1 :]
        if not following:
            failures.append(
                f"{case_id}: {snapshot_trigger} was not followed by an immediate task snapshot"
            )
            continue
        next_event = following[0]
        next_ref = next_event.get("thread_event_ref")
        next_tool = thread_events.get(next_ref) if isinstance(next_ref, str) else None
        if (
            next_event.get("event_kind") != "host_tool"
            or not next_tool
            or next_tool.get("tool_name") != "wait_threads"
            or next_tool.get("request_args", {}).get("timeoutMs") != 0
        ):
            failures.append(
                f"{case_id}: first action after {snapshot_trigger} is not an immediate task snapshot"
            )

    judge = item.get("judge")
    if not isinstance(judge, dict):
        return failures + [f"{case_id}: judge must be an object"], session_id
    try:
        require_fields(judge, schema["required_judge_fields"], label=f"{case_id} judge")
        if judge.get("status") != "pass":
            raise ContractError(f"{case_id}: live judge status is {judge.get('status') or 'missing'}")
        if judge.get("rubric_version") != schema["rubric_version"]:
            raise ContractError(f"{case_id}: judge rubric version drifted")
        require_meaningful(judge.get("reason"), label=f"{case_id} judge reason", minimum=20)
        reviewer_identity = require_object(
            judge.get("reviewer_identity"),
            label=f"{case_id} judge reviewer_identity",
        )
        if reviewer_identity.get("kind") != "independent_process":
            raise ContractError(f"{case_id}: judge is not an independent process")
        reviewer_model = require_meaningful(
            reviewer_identity.get("model"),
            label=f"{case_id} judge reviewer model",
        )
        require_meaningful(
            reviewer_identity.get("run_id"),
            label=f"{case_id} judge reviewer run_id",
        )
        if reviewer_model == subject_model:
            raise ContractError(f"{case_id}: judge model is not independent from subject")
        if not isinstance(raw, dict):
            raise ContractError(f"{case_id}: judge cannot bind a missing raw case")
        raw_digest = hashlib.sha256(
            json.dumps(
                raw,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()
        if judge.get("raw_case_sha256") != raw_digest:
            raise ContractError(f"{case_id}: judge raw case digest does not match")
    except ContractError as exc:
        failures.append(str(exc))
    known_refs = (
        transcript_ids
        | event_ids
        | director_event_ids
        | ({f"session:{session_id}"} if session_id else set())
    )
    for field, behaviors, flag, expected_value, required_fields in (
        (
            "required_behavior_results",
            expected["required_behaviors"],
            "passed",
            True,
            schema["required_behavior_result_fields"],
        ),
        (
            "forbidden_behavior_results",
            expected["forbidden_behaviors"],
            "observed",
            False,
            schema["forbidden_behavior_result_fields"],
        ),
    ):
        verdicts = judge.get(field)
        if not isinstance(verdicts, dict) or set(verdicts) != set(behaviors):
            failures.append(f"{case_id}: {field} coverage is incomplete")
            continue
        for behavior, value in verdicts.items():
            try:
                verdict = require_object(value, label=f"{case_id} verdict for {behavior}")
                require_fields(verdict, required_fields, label=f"{case_id} verdict for {behavior}")
                if verdict.get(flag) is not expected_value:
                    raise ContractError(f"{case_id}: behavior verdict failed: {behavior}")
                refs = require_string_list(
                    verdict.get("evidence_refs"),
                    label=f"{case_id} behavior evidence_refs",
                    minimum=1,
                )
                unknown = sorted(set(refs) - known_refs)
                if unknown:
                    raise ContractError(
                        f"{case_id}: behavior cites unknown evidence: {unknown[0]}"
                    )
            except ContractError as exc:
                failures.append(str(exc))
    return failures, session_id


def validate_results(
    results_path: Path,
    cases_data: dict[str, Any],
    schema: dict[str, Any],
) -> list[str]:
    results = load_json_object(results_path)
    failures: list[str] = []
    try:
        require_fields(results, schema["required_top_level"], label="results")
    except ContractError as exc:
        return [str(exc)]
    if (
        results.get("schema") != schema["schema"]
        or results.get("rubric_version") != schema["rubric_version"]
    ):
        failures.append("results schema or rubric version does not match")
    if results.get("fresh_session") is not True:
        failures.append("Studio live results must come from fresh tasks")
    if results.get("runtime_target") != "codex":
        failures.append("Studio live results currently require the Codex runtime target")
    if results.get("skill_version") != read_utf8(ROOT / "VERSION").strip():
        failures.append("results skill_version must exactly match VERSION")
    candidate_source_revision = ""
    try:
        runtime_target = require_meaningful(
            results.get("runtime_target"),
            label="results runtime_target",
        )
        runtime_digest = require_meaningful(
            results.get("runtime_digest"),
            label="results runtime_digest",
            minimum=64,
        )
        if (
            len(runtime_digest) != 64
            or any(char not in "0123456789abcdef" for char in runtime_digest)
        ):
            raise ContractError("results runtime_digest must be a lowercase SHA-256")
        if runtime_digest != source_runtime_digest(ROOT, runtime_target):
            failures.append(
                "results runtime_digest does not match the exact source runtime candidate"
            )
        candidate_source_revision = require_meaningful(
            results.get("source_revision"),
            label="results source_revision",
            minimum=12,
        )
        if candidate_source_revision != source_revision(ROOT):
            failures.append("results source_revision does not match the exact source candidate")
        validate_isolation_manifest(
            results.get("runner_isolation"),
            source_revision=candidate_source_revision,
            runtime_target=runtime_target,
            runtime_digest=runtime_digest,
        )
    except (ContractError, RuntimeIdentityError) as exc:
        failures.append(f"candidate identity is invalid: {exc}")
    for field in ("run_id", "platform", "model"):
        try:
            require_meaningful(results.get(field), label=f"results {field}")
        except ContractError as exc:
            failures.append(str(exc))
    try:
        generated_at = require_datetime(results.get("generated_at"), label="generated_at")
        if generated_at > datetime.now(timezone.utc) + MAX_CLOCK_SKEW:
            raise ContractError("generated_at is in the future")
        if generated_at < datetime.now(timezone.utc) - MAX_RESULT_AGE:
            raise ContractError("generated_at is older than the 7-day live evidence window")
    except ContractError as exc:
        return failures + [str(exc)]

    raw_results, raw_failures = load_raw_results(results_path, results)
    failures.extend(raw_failures)
    raw_cases: dict[str, Any] = {}
    if isinstance(raw_results, dict) and isinstance(raw_results.get("cases"), list):
        for raw in raw_results["cases"]:
            if isinstance(raw, dict) and isinstance(raw.get("case_id"), str):
                if raw["case_id"] in raw_cases:
                    failures.append(f"duplicate raw case: {raw['case_id']}")
                raw_cases[raw["case_id"]] = raw
    else:
        failures.append("raw result cases are missing")

    expected = {case["id"]: case for case in cases_data["cases"]}
    actual = results.get("cases")
    if not isinstance(actual, list):
        return failures + ["results cases must be a list"]
    seen: set[str] = set()
    sessions: set[str] = set()
    for index, value in enumerate(actual):
        if not isinstance(value, dict) or value.get("case_id") not in expected:
            failures.append(f"unknown result case at index {index}")
            continue
        case_id = value["case_id"]
        if case_id in seen:
            failures.append(f"duplicate result case: {case_id}")
        seen.add(case_id)
        case_failures, session_id = validate_case(
            value,
            expected[case_id],
            raw_cases.get(case_id),
            schema,
            generated_at,
            candidate_source_revision,
            results.get("model") if isinstance(results.get("model"), str) else "",
        )
        failures.extend(case_failures)
        if session_id in sessions:
            failures.append(f"fresh-task evidence reused: {session_id}")
        if session_id:
            sessions.add(session_id)
    missing = sorted(set(expected) - seen)
    if missing:
        failures.append(f"missing Studio live result cases: {', '.join(missing)}")
    if set(raw_cases) != set(expected):
        failures.append("raw result case coverage differs from the Studio corpus")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract-only", action="store_true")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--results", type=Path)
    args = parser.parse_args()
    if args.contract_only and args.results is not None:
        return fail("--contract-only cannot be combined with --results", code=2)
    try:
        cases_data, schema = validate_static_contract(
            args.cases.resolve(),
            args.schema.resolve(),
        )
        if args.contract_only:
            print(
                f"OK: Studio live static contract validated "
                f"({len(cases_data['cases'])} cases); live task behavior not executed"
            )
            return 0
        if args.results is None:
            print(
                "UNVERIFIED: no fresh-task raw results and reviewed Studio "
                "results were supplied"
            )
            return 2
        failures = validate_results(args.results.resolve(), cases_data, schema)
    except ContractError as exc:
        return fail(str(exc))
    if failures:
        for message in failures:
            print(f"FAIL: {message}")
        return 1
    print(
        f"OK: Studio live evidence contract validated "
        f"({len(cases_data['cases'])} fresh-task cases); "
        "case, room, confirmation, raw digest, review, return, integration, "
        "and host/transcript links passed; non-host activity completeness remains UNVERIFIED"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
