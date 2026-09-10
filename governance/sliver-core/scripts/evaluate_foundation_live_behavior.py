#!/usr/bin/env python3
"""Validate foundation live-behavior contracts and evidence-bearing run artifacts."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

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
    safe_repo_path,
)
from runtime_identity import RuntimeIdentityError, source_revision, source_runtime_digest


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/foundation-live-behavior-cases.json"
DEFAULT_SCHEMA = ROOT / "tests/foundation-live-result-schema.json"
FIXTURE_SCHEMA = "sliver-foundation-live-fixture/v1"
ARTIFACT_SCHEMA = "sliver-foundation-live-run-artifact/v3"
SKILL_NAME = "sliver-vibe-coding"
MAX_WEB_EVIDENCE_AGE = timedelta(days=45)
MAX_CLOCK_SKEW = timedelta(minutes=5)
MAX_RESULT_AGE = timedelta(days=7)
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
PLACEHOLDER_VALUES = {
    "x",
    "xx",
    "xxx",
    "test",
    "fake",
    "fabricated",
    "unknown",
    "todo",
    "tbd",
    "n/a",
}
TOOL_EVIDENCE_KINDS = {"read", "write", "command", "web"}


def fail(message: str, code: int = 1) -> int:
    print(f"FAIL: {message}")
    return code


def require_bool(value: Any, *, label: str) -> bool:
    if not isinstance(value, bool):
        raise ContractError(f"{label} must be a boolean")
    return value


def require_object(value: Any, *, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be an object")
    return value


def require_meaningful(value: Any, *, label: str, minimum: int = 4) -> str:
    text = require_string(value, label=label, minimum=minimum)
    if text.strip().casefold() in PLACEHOLDER_VALUES:
        raise ContractError(f"{label} is a placeholder")
    return text


def require_sha256(value: Any, *, label: str) -> str:
    digest = require_string(value, label=label, minimum=64).casefold()
    if SHA256_PATTERN.fullmatch(digest) is None:
        raise ContractError(f"{label} must be a lowercase SHA-256 digest")
    return digest


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_fixture_workspace(fixture: dict[str, Any], *, case_id: str) -> None:
    if fixture.get("evidence_classification") != "synthetic_non_identifying":
        raise ContractError(
            f"{case_id} fixture must be classified synthetic_non_identifying"
        )
    if "workspace" not in fixture:
        return
    workspace = require_object(fixture.get("workspace"), label=f"{case_id} fixture workspace")
    root_rel = require_meaningful(workspace.get("root"), label=f"{case_id} workspace root")
    workspace_root = safe_repo_path(ROOT, root_rel, label=f"{case_id} workspace root")
    if not workspace_root.is_dir():
        raise ContractError(f"{case_id} workspace root is not a directory: {root_rel}")
    required_paths = require_string_list(
        workspace.get("required_paths"), label=f"{case_id} workspace required_paths", minimum=1
    )
    for relative in required_paths:
        path = safe_repo_path(ROOT, f"{root_rel}/{relative}", label=f"{case_id} workspace path")
        try:
            path.relative_to(workspace_root)
        except ValueError as exc:
            raise ContractError(f"{case_id} workspace path escapes its root: {relative}") from exc
        if not path.is_file():
            raise ContractError(f"{case_id} workspace file is missing: {relative}")
    command = workspace.get("verification_command")
    if (
        not isinstance(command, list)
        or len(command) < 2
        or any(not isinstance(item, str) or not item.strip() for item in command)
        or command[0] != "python3"
    ):
        raise ContractError(f"{case_id} workspace verification_command must invoke python3")
    command_path = safe_repo_path(
        ROOT, f"{root_rel}/{command[1]}", label=f"{case_id} workspace verification command"
    )
    if not command_path.is_file() or command_path.suffix != ".py":
        raise ContractError(f"{case_id} workspace verification command is not executable source")


def validate_required_tool_evidence(case: dict[str, Any], *, case_id: str) -> None:
    requirements = case.get("required_tool_evidence")
    if requirements is None:
        requirements = [{"kind": "read", "target": case["fixture"]["path"]}]
        case["required_tool_evidence"] = requirements
    if not isinstance(requirements, list) or not requirements:
        raise ContractError(f"{case_id} required_tool_evidence must be a non-empty list")
    seen: set[tuple[str, str]] = set()
    for index, value in enumerate(requirements):
        requirement = require_object(value, label=f"{case_id} tool requirement {index}")
        kind = require_string(requirement.get("kind"), label=f"{case_id} tool requirement kind")
        target = require_meaningful(
            requirement.get("target"), label=f"{case_id} tool requirement target", minimum=3
        )
        if kind not in TOOL_EVIDENCE_KINDS:
            raise ContractError(f"{case_id} tool requirement has unsupported kind: {kind}")
        if (kind, target) in seen:
            raise ContractError(f"{case_id} duplicates required tool evidence: {kind} {target}")
        seen.add((kind, target))


def require_datetime(value: Any, *, label: str) -> datetime:
    raw = require_string(value, label=label, minimum=10)
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ContractError(f"{label} must be a valid ISO-8601 timestamp") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ContractError(f"{label} must include a timezone")
    return parsed


def safe_result_artifact(results_path: Path, relative: str) -> Path:
    base = results_path.resolve().parent
    candidate = (base / relative).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise ContractError("runner artifact must stay beside or below the results file") from exc
    if candidate == results_path.resolve():
        raise ContractError("runner artifact must be separate from judged results")
    if not candidate.is_file():
        raise ContractError(f"runner artifact does not exist: {relative}")
    return candidate


def is_web_tool(name: str) -> bool:
    normalized = name.casefold()
    return any(term in normalized for term in ("web", "search", "browser", "browse", "http"))


def require_primary_url(
    value: Any,
    *,
    label: str,
    placeholder_hosts: set[str],
) -> str:
    url = require_meaningful(value, label=label, minimum=12)
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ContractError(f"{label} must be an HTTPS primary-source URL")
    host = parsed.hostname.casefold().rstrip(".")
    if host in placeholder_hosts or any(host.endswith(f".{item}") for item in placeholder_hosts):
        raise ContractError(f"{label} uses a placeholder or local host")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        if "." not in host:
            raise ContractError(f"{label} must use a qualified external host")
    else:
        if not address.is_global:
            raise ContractError(f"{label} must not use a private or reserved address")
    return url


def validate_static_contract(cases_path: Path, schema_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    cases_data = load_json_object(cases_path)
    schema_data = load_json_object(schema_path)
    if cases_data.get("schema") != "sliver-foundation-live-cases/v2":
        raise ContractError("foundation live cases use an unsupported schema")
    if cases_data.get("evaluation_scope") != "fresh_session_model_behavior":
        raise ContractError("foundation live cases must declare fresh-session model behavior scope")
    if require_bool(
        cases_data.get("requires_live_model_validation"),
        label="requires_live_model_validation",
    ) is not True:
        raise ContractError("foundation cases must require live model validation")
    if require_bool(
        cases_data.get("static_contracts_are_not_live_proof"),
        label="static_contracts_are_not_live_proof",
    ) is not True:
        raise ContractError("foundation cases must preserve the static/live proof boundary")
    if schema_data.get("schema") != "sliver-foundation-live-results/v4":
        raise ContractError("foundation result schema is unsupported")
    rubric_version = require_meaningful(
        cases_data.get("rubric_version"),
        label="foundation cases rubric_version",
    )
    if schema_data.get("rubric_version") != rubric_version:
        raise ContractError("foundation cases and result schema rubric versions differ")

    schema_list_fields = (
        "required_top_level",
        "required_runner_fields",
        "required_judge_provenance_fields",
        "required_case_fields",
        "required_fixture_fields",
        "required_skill_selection_fields",
        "required_session_fields",
        "required_transcript_event_fields",
        "required_tool_event_fields",
        "required_web_evidence_fields",
        "required_judge_fields",
        "required_behavior_result_fields",
        "forbidden_behavior_result_fields",
        "allowed_judge_statuses",
        "allowed_judge_kinds",
        "allowed_transcript_roles",
        "allowed_tool_statuses",
        "allowed_web_expectations",
        "placeholder_hosts",
    )
    for key in schema_list_fields:
        require_string_list(schema_data.get(key), label=key, minimum=1)
    if set(schema_data["allowed_judge_statuses"]) != {"pass", "fail", "unverified"}:
        raise ContractError("foundation result schema judge statuses drifted")
    if set(schema_data["allowed_judge_kinds"]) != {"human", "model"}:
        raise ContractError("foundation result schema judge kinds drifted")
    allowed_web = set(schema_data["allowed_web_expectations"])
    if allowed_web != {"not_required", "must_succeed", "must_attempt_and_block"}:
        raise ContractError("foundation result schema web expectations drifted")

    cases = cases_data.get("cases")
    if not isinstance(cases, list) or len(cases) < 8:
        raise ContractError("foundation live corpus must contain at least 8 behavior cases")
    seen_ids: set[str] = set()
    seen_prompts: set[str] = set()
    for index, case in enumerate(cases):
        case = require_object(case, label=f"foundation live case {index}")
        case_id = require_meaningful(case.get("id"), label=f"case {index} id")
        prompt = require_prompt(case.get("initial_user"), label=f"{case_id} initial_user")
        fixture_ref = require_object(case.get("fixture"), label=f"{case_id} fixture")
        require_fields(fixture_ref, schema_data["required_fixture_fields"], label=f"{case_id} fixture")
        fixture_id = require_meaningful(fixture_ref.get("id"), label=f"{case_id} fixture id")
        fixture_rel = require_meaningful(fixture_ref.get("path"), label=f"{case_id} fixture path")
        expected_digest = require_sha256(
            fixture_ref.get("sha256"),
            label=f"{case_id} fixture sha256",
        )
        fixture_path = safe_repo_path(ROOT, fixture_rel, label=f"{case_id} fixture")
        if not fixture_path.is_file():
            raise ContractError(f"{case_id} fixture file is missing: {fixture_rel}")
        if sha256_file(fixture_path) != expected_digest:
            raise ContractError(f"{case_id} fixture SHA-256 does not match its contract")
        fixture = load_json_object(fixture_path)
        if fixture.get("schema") != FIXTURE_SCHEMA or fixture.get("id") != fixture_id:
            raise ContractError(f"{case_id} fixture identity or schema drifted")
        require_int(fixture.get("version"), label=f"{case_id} fixture version", minimum=1)
        context = fixture.get("context")
        if not isinstance(context, dict) or not context:
            raise ContractError(f"{case_id} fixture context must be a non-empty object")
        validate_fixture_workspace(fixture, case_id=case_id)
        expectation = require_string(
            case.get("web_expectation"),
            label=f"{case_id} web_expectation",
        )
        if expectation not in allowed_web:
            raise ContractError(f"{case_id} uses an unsupported web expectation")
        expected_network_mode = {
            "not_required": "not_required",
            "must_succeed": "available",
            "must_attempt_and_block": "unavailable",
        }[expectation]
        if fixture.get("network_mode") != expected_network_mode:
            raise ContractError(f"{case_id} fixture network mode contradicts web expectation")
        if expectation != "not_required":
            product_facts = context.get("product_facts")
            if not isinstance(product_facts, dict) or not product_facts:
                raise ContractError(
                    f"{case_id} web case fixture requires concrete product_facts"
                )
            for field in ("product", "platform", "deployment"):
                require_meaningful(
                    product_facts.get(field),
                    label=f"{case_id} product_facts {field}",
                )
            require_string_list(
                product_facts.get("users"),
                label=f"{case_id} product_facts users",
                minimum=1,
            )
            require_string_list(
                product_facts.get("first_complete_flow"),
                label=f"{case_id} product_facts first_complete_flow",
                minimum=2,
            )
            candidate_claims = context.get("candidate_claims")
            if not isinstance(candidate_claims, list) or not candidate_claims:
                raise ContractError(
                    f"{case_id} web case fixture requires named candidate_claims"
                )
            named_candidates: set[str] = set()
            for candidate_index, candidate_value in enumerate(candidate_claims):
                candidate = require_object(
                    candidate_value,
                    label=f"{case_id} candidate_claims {candidate_index}",
                )
                candidate_name = require_meaningful(
                    candidate.get("candidate"),
                    label=f"{case_id} candidate_claims {candidate_index} candidate",
                )
                if candidate_name in named_candidates:
                    raise ContractError(
                        f"{case_id} candidate_claims contain a duplicate candidate"
                    )
                named_candidates.add(candidate_name)
                require_string_list(
                    candidate.get("mutable_claims"),
                    label=f"{case_id} candidate_claims {candidate_index} mutable_claims",
                    minimum=1,
                )
        minimum_user_turns = require_int(
            case.get("minimum_user_turns"),
            label=f"{case_id} minimum_user_turns",
            minimum=1,
        )
        if minimum_user_turns > 1:
            followup_user_turns = require_string_list(
                case.get("followup_user_turns"),
                label=f"{case_id} followup_user_turns",
                minimum=minimum_user_turns - 1,
            )
            if len(followup_user_turns) != minimum_user_turns - 1:
                raise ContractError(
                    f"{case_id} followup_user_turns must exactly define every later user turn"
                )
        require_int(
            case.get("minimum_assistant_turns"),
            label=f"{case_id} minimum_assistant_turns",
            minimum=1,
        )
        if "minimum_tool_events" not in case:
            case["minimum_tool_events"] = 1
        minimum_tool_events = require_int(
            case.get("minimum_tool_events"),
            label=f"{case_id} minimum_tool_events",
            minimum=1,
        )
        validate_required_tool_evidence(case, case_id=case_id)
        if minimum_tool_events < len(case["required_tool_evidence"]):
            raise ContractError(
                f"{case_id} minimum_tool_events cannot be smaller than required_tool_evidence"
            )
        required = require_string_list(
            case.get("required_behaviors"),
            label=f"{case_id} required_behaviors",
            minimum=2,
        )
        forbidden = require_string_list(
            case.get("forbidden_behaviors"),
            label=f"{case_id} forbidden_behaviors",
            minimum=2,
        )
        if len(set(required)) != len(required) or len(set(forbidden)) != len(forbidden):
            raise ContractError(f"{case_id} behavior statements must be unique")
        if set(required) & set(forbidden):
            raise ContractError(f"{case_id} required and forbidden behavior overlap")
        if case_id in seen_ids or prompt in seen_prompts:
            raise ContractError(f"duplicate foundation live case id or prompt: {case_id}")
        seen_ids.add(case_id)
        seen_prompts.add(prompt)
    return cases_data, schema_data


def validate_provenance(
    results: dict[str, Any],
    schema_data: dict[str, Any],
    generated_at: datetime,
) -> list[str]:
    failures: list[str] = []
    runner = results.get("runner_provenance")
    judge = results.get("judge_provenance")
    if not isinstance(runner, dict):
        failures.append("runner_provenance must be an object")
    else:
        try:
            require_fields(runner, schema_data["required_runner_fields"], label="runner_provenance")
            for field in ("name", "version", "invocation_id", "artifact_path"):
                require_meaningful(runner.get(field), label=f"runner_provenance {field}")
            require_sha256(runner.get("artifact_sha256"), label="runner_provenance artifact_sha256")
        except ContractError as exc:
            failures.append(str(exc))
    if not isinstance(judge, dict):
        failures.append("judge_provenance must be an object")
    else:
        try:
            require_fields(
                judge,
                schema_data["required_judge_provenance_fields"],
                label="judge_provenance",
            )
            kind = require_string(judge.get("kind"), label="judge_provenance kind")
            if kind not in schema_data["allowed_judge_kinds"]:
                raise ContractError("judge_provenance kind is unsupported")
            identity = require_meaningful(judge.get("identity"), label="judge_provenance identity")
            require_meaningful(judge.get("version"), label="judge_provenance version")
            if judge.get("independent_from_subject") is not True:
                raise ContractError("judge must be independent from the subject model")
            if judge.get("rubric_version") != schema_data["rubric_version"]:
                raise ContractError("judge provenance rubric version drifted")
            judged_at = require_datetime(judge.get("judged_at"), label="judge_provenance judged_at")
            if judged_at > generated_at + MAX_CLOCK_SKEW:
                raise ContractError("judge timestamp is after result generation")
            if kind == "model" and identity.casefold() == str(results.get("model", "")).casefold():
                raise ContractError("subject model cannot judge its own foundation behavior")
        except ContractError as exc:
            failures.append(str(exc))
    return failures


def load_run_artifact(
    results_path: Path,
    results: dict[str, Any],
) -> tuple[Optional[dict[str, Any]], list[str]]:
    runner = results.get("runner_provenance")
    if not isinstance(runner, dict):
        return None, ["runner artifact cannot be loaded without runner_provenance"]
    try:
        artifact_rel = require_meaningful(
            runner.get("artifact_path"),
            label="runner_provenance artifact_path",
        )
        artifact_path = safe_result_artifact(results_path, artifact_rel)
        expected_digest = require_sha256(
            runner.get("artifact_sha256"),
            label="runner_provenance artifact_sha256",
        )
        if sha256_file(artifact_path) != expected_digest:
            raise ContractError("runner artifact SHA-256 does not match results provenance")
        artifact = load_json_object(artifact_path)
    except ContractError as exc:
        return None, [str(exc)]
    failures: list[str] = []
    if artifact.get("schema") != ARTIFACT_SCHEMA:
        failures.append("runner artifact schema is unsupported")
    for field in (
        "run_id",
        "runtime_target",
        "runtime_digest",
        "source_revision",
        "platform",
        "model",
        "generated_at",
    ):
        if artifact.get(field) != results.get(field):
            failures.append(f"runner artifact {field} does not match judged results")
    try:
        same_isolation_manifest(
            artifact.get("runner_isolation"),
            results.get("runner_isolation"),
            label="runner artifact",
        )
    except ContractError as exc:
        failures.append(str(exc))
    artifact_runner = artifact.get("runner_provenance")
    if not isinstance(artifact_runner, dict):
        failures.append("runner artifact provenance is missing")
    else:
        for field in ("name", "version", "invocation_id"):
            if artifact_runner.get(field) != runner.get(field):
                failures.append(f"runner artifact provenance {field} does not match results")
    return artifact, failures


def validate_case(
    item: dict[str, Any],
    expected: dict[str, Any],
    artifact_item: Optional[dict[str, Any]],
    schema_data: dict[str, Any],
    generated_at: datetime,
) -> tuple[list[str], str]:
    case_id = expected["id"]
    failures: list[str] = []
    runtime_digest = ""
    revision = ""
    try:
        require_fields(item, schema_data["required_case_fields"], label=f"{case_id} result")
    except ContractError as exc:
        return [str(exc)], ""
    if item.get("fixture") != expected["fixture"]:
        failures.append(f"{case_id}: fixture identity or SHA-256 does not match the case contract")
    if item.get("initial_user") != expected["initial_user"]:
        failures.append(f"{case_id}: recorded initial user prompt does not match the case")

    raw_fields = (
        "case_id",
        "fixture",
        "initial_user",
        "skill_selection",
        "session",
        "transcript",
        "tool_trace",
        "web_evidence",
        "final_output",
    )
    if not isinstance(artifact_item, dict):
        failures.append(f"{case_id}: raw runner artifact case is missing")
    else:
        for field in raw_fields:
            if artifact_item.get(field) != item.get(field):
                failures.append(f"{case_id}: judged {field} differs from the raw runner artifact")

    session = item.get("session")
    session_id = ""
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    if not isinstance(session, dict):
        failures.append(f"{case_id}: session must be an object")
    else:
        try:
            require_fields(session, schema_data["required_session_fields"], label=f"{case_id} session")
            session_id = require_meaningful(session.get("session_id"), label=f"{case_id} session_id")
            started_at = require_datetime(session.get("started_at"), label=f"{case_id} session started_at")
            ended_at = require_datetime(session.get("ended_at"), label=f"{case_id} session ended_at")
            if ended_at < started_at:
                raise ContractError(f"{case_id} session ended before it started")
            if ended_at > generated_at + MAX_CLOCK_SKEW:
                raise ContractError(f"{case_id} session ended after result generation")
        except ContractError as exc:
            failures.append(str(exc))

    transcript = item.get("transcript")
    event_ids: set[str] = set()
    event_roles: dict[str, str] = {}
    assistant_contents: list[str] = []
    user_contents: list[str] = []
    previous_event_time: Optional[datetime] = None
    if not isinstance(transcript, list) or not transcript:
        failures.append(f"{case_id}: missing structured fresh-session transcript")
    else:
        for index, event in enumerate(transcript):
            if not isinstance(event, dict):
                failures.append(f"{case_id}: transcript event {index} must be an object")
                continue
            try:
                require_fields(
                    event,
                    schema_data["required_transcript_event_fields"],
                    label=f"{case_id} transcript event {index}",
                )
                event_id = require_meaningful(
                    event.get("event_id"),
                    label=f"{case_id} transcript event {index} id",
                )
                if event_id in event_ids:
                    raise ContractError(f"{case_id} duplicate transcript event id: {event_id}")
                role = require_string(event.get("role"), label=f"{case_id} transcript event {index} role")
                if role not in schema_data["allowed_transcript_roles"]:
                    raise ContractError(f"{case_id} transcript event {index} role is unsupported")
                event_time = require_datetime(
                    event.get("timestamp"),
                    label=f"{case_id} transcript event {index} timestamp",
                )
                content = require_meaningful(
                    event.get("content"),
                    label=f"{case_id} transcript event {index} content",
                )
                if previous_event_time is not None and event_time < previous_event_time:
                    raise ContractError(f"{case_id} transcript timestamps are not monotonic")
                if started_at is not None and event_time < started_at:
                    raise ContractError(f"{case_id} transcript event precedes the session")
                if ended_at is not None and event_time > ended_at:
                    raise ContractError(f"{case_id} transcript event follows the session")
                previous_event_time = event_time
                event_ids.add(event_id)
                event_roles[event_id] = role
                if role == "user":
                    user_contents.append(content)
                elif role == "assistant":
                    assistant_contents.append(content)
            except ContractError as exc:
                failures.append(str(exc))
    if not user_contents or user_contents[0] != expected["initial_user"]:
        failures.append(f"{case_id}: first user transcript event must exactly match initial_user")
    if len(user_contents) < expected["minimum_user_turns"]:
        failures.append(f"{case_id}: transcript has too few user turns")
    expected_followups = expected.get("followup_user_turns")
    if expected_followups is not None and user_contents[1:] != expected_followups:
        failures.append(
            f"{case_id}: follow-up user transcript does not match the case"
        )
    if len(assistant_contents) < expected["minimum_assistant_turns"]:
        failures.append(f"{case_id}: transcript has too few assistant turns")
    try:
        final_output = require_meaningful(item.get("final_output"), label=f"{case_id} final_output")
        if not assistant_contents or final_output != assistant_contents[-1]:
            failures.append(f"{case_id}: final_output must equal the last assistant transcript event")
    except ContractError as exc:
        failures.append(str(exc))

    selection = item.get("skill_selection")
    if not isinstance(selection, dict):
        failures.append(f"{case_id}: skill_selection must be an object")
    else:
        try:
            require_fields(
                selection,
                schema_data["required_skill_selection_fields"],
                label=f"{case_id} skill_selection",
            )
            if selection.get("selected") is not True or selection.get("skill_name") != SKILL_NAME:
                raise ContractError(f"{case_id}: Sliver was not selected by the host")
            selected_at = require_datetime(
                selection.get("selected_at"),
                label=f"{case_id} skill selected_at",
            )
            evidence_ref = require_meaningful(
                selection.get("evidence_ref"),
                label=f"{case_id} skill selection evidence_ref",
            )
            if evidence_ref not in event_ids or event_roles.get(evidence_ref) != "system":
                raise ContractError(f"{case_id}: skill selection must cite a system transcript event")
            matching_event = next(
                (event for event in transcript if isinstance(event, dict) and event.get("event_id") == evidence_ref),
                {},
            )
            if SKILL_NAME not in str(matching_event.get("content", "")):
                raise ContractError(f"{case_id}: selection evidence does not name the selected skill")
            if started_at is not None and selected_at < started_at:
                raise ContractError(f"{case_id}: skill selection precedes the session")
            if ended_at is not None and selected_at > ended_at:
                raise ContractError(f"{case_id}: skill selection follows the session")
        except ContractError as exc:
            failures.append(str(exc))

    tool_trace = item.get("tool_trace")
    tool_calls: dict[str, dict[str, Any]] = {}
    web_calls: list[dict[str, Any]] = []
    if not isinstance(tool_trace, list) or len(tool_trace) < expected["minimum_tool_events"]:
        failures.append(f"{case_id}: insufficient structured tool evidence")
    else:
        for index, event in enumerate(tool_trace):
            if not isinstance(event, dict):
                failures.append(f"{case_id}: tool event {index} must be an object")
                continue
            try:
                require_fields(
                    event,
                    schema_data["required_tool_event_fields"],
                    label=f"{case_id} tool event {index}",
                )
                call_id = require_meaningful(
                    event.get("tool_call_id"),
                    label=f"{case_id} tool event {index} id",
                )
                if call_id in tool_calls:
                    raise ContractError(f"{case_id} duplicate tool_call_id: {call_id}")
                tool_name = require_meaningful(
                    event.get("tool_name"),
                    label=f"{case_id} tool event {index} name",
                )
                status = require_string(event.get("status"), label=f"{case_id} tool event {index} status")
                if status not in schema_data["allowed_tool_statuses"]:
                    raise ContractError(f"{case_id} tool event {index} status is unsupported")
                tool_started = require_datetime(
                    event.get("started_at"),
                    label=f"{case_id} tool event {index} started_at",
                )
                tool_completed = require_datetime(
                    event.get("completed_at"),
                    label=f"{case_id} tool event {index} completed_at",
                )
                if tool_completed < tool_started:
                    raise ContractError(f"{case_id} tool event {index} completed before it started")
                if started_at is not None and tool_started < started_at:
                    raise ContractError(f"{case_id} tool event {index} precedes the session")
                if ended_at is not None and tool_completed > ended_at:
                    raise ContractError(f"{case_id} tool event {index} follows the session")
                require_meaningful(
                    event.get("request_summary"),
                    label=f"{case_id} tool event {index} request_summary",
                    minimum=8,
                )
                require_meaningful(
                    event.get("response_summary"),
                    label=f"{case_id} tool event {index} response_summary",
                    minimum=8,
                )
                evidence_kind = require_string(
                    event.get("evidence_kind"),
                    label=f"{case_id} tool event {index} evidence_kind",
                )
                evidence_target = require_meaningful(
                    event.get("evidence_target"),
                    label=f"{case_id} tool event {index} evidence_target",
                    minimum=3,
                )
                if evidence_kind not in TOOL_EVIDENCE_KINDS:
                    raise ContractError(
                        f"{case_id} tool event {index} has unsupported evidence_kind"
                    )
                transcript_ref = require_meaningful(
                    event.get("transcript_event_ref"),
                    label=f"{case_id} tool event {index} transcript_event_ref",
                )
                if transcript_ref not in event_ids or event_roles.get(transcript_ref) != "tool":
                    raise ContractError(f"{case_id} tool event {index} must cite a tool transcript event")
                tool_calls[call_id] = event
                if is_web_tool(tool_name):
                    web_calls.append(event)
            except ContractError as exc:
                failures.append(str(exc))

    observed_tool_evidence = {
        (str(call.get("evidence_kind")), str(call.get("evidence_target")))
        for call in tool_calls.values()
        if call.get("status") == "success"
    }
    for requirement in expected["required_tool_evidence"]:
        key = (requirement["kind"], requirement["target"])
        if key not in observed_tool_evidence:
            failures.append(
                f"{case_id}: missing successful {key[0]} tool evidence for {key[1]}"
            )

    web_evidence = item.get("web_evidence")
    evidence_ids: set[str] = set()
    placeholder_hosts = {item.casefold() for item in schema_data["placeholder_hosts"]}
    if not isinstance(web_evidence, list):
        failures.append(f"{case_id}: web_evidence must be a list")
        web_evidence = []
    for index, evidence in enumerate(web_evidence):
        if not isinstance(evidence, dict):
            failures.append(f"{case_id}: web evidence {index} must be an object")
            continue
        try:
            require_fields(
                evidence,
                schema_data["required_web_evidence_fields"],
                label=f"{case_id} web evidence {index}",
            )
            evidence_id = require_meaningful(
                evidence.get("evidence_id"),
                label=f"{case_id} web evidence {index} id",
            )
            if evidence_id in evidence_ids:
                raise ContractError(f"{case_id} duplicate web evidence id: {evidence_id}")
            require_primary_url(
                evidence.get("url"),
                label=f"{case_id} web evidence {index} URL",
                placeholder_hosts=placeholder_hosts,
            )
            checked_at = require_datetime(
                evidence.get("checked_at"),
                label=f"{case_id} web evidence {index} checked_at",
            )
            if checked_at > generated_at + MAX_CLOCK_SKEW:
                raise ContractError(f"{case_id} web evidence {index} is dated after the run")
            if generated_at - checked_at > MAX_WEB_EVIDENCE_AGE:
                raise ContractError(f"{case_id} web evidence {index} is stale")
            if evidence.get("source_type") != "primary":
                raise ContractError(f"{case_id} web evidence {index} is not marked primary")
            require_meaningful(
                evidence.get("claim"),
                label=f"{case_id} web evidence {index} claim",
                minimum=12,
            )
            require_meaningful(
                evidence.get("result"),
                label=f"{case_id} web evidence {index} result",
                minimum=12,
            )
            call_id = require_meaningful(
                evidence.get("tool_call_id"),
                label=f"{case_id} web evidence {index} tool_call_id",
            )
            call = tool_calls.get(call_id)
            if call is None or call.get("status") != "success" or not is_web_tool(str(call.get("tool_name", ""))):
                raise ContractError(f"{case_id} web evidence {index} lacks a successful web tool call")
            evidence_ids.add(evidence_id)
        except ContractError as exc:
            failures.append(str(exc))

    expectation = expected["web_expectation"]
    successful_web = [call for call in web_calls if call.get("status") == "success"]
    failed_web = [call for call in web_calls if call.get("status") == "error"]
    if expectation == "must_succeed":
        if not successful_web or not evidence_ids:
            failures.append(f"{case_id}: successful current primary-source web evidence is required")
    elif expectation == "must_attempt_and_block":
        if not failed_web:
            failures.append(f"{case_id}: a failed web attempt is required")
        if successful_web or web_evidence:
            failures.append(f"{case_id}: blocked-network case must not claim successful web evidence")
    elif web_calls or web_evidence:
        failures.append(f"{case_id}: this case must not browse or claim web evidence")

    judge = item.get("judge")
    if not isinstance(judge, dict):
        failures.append(f"{case_id}: judge must be an object")
        return failures, session_id
    try:
        require_fields(judge, schema_data["required_judge_fields"], label=f"{case_id} judge")
        if judge.get("status") != "pass":
            raise ContractError(f"{case_id}: live judge status is {judge.get('status') or 'missing'}")
        require_meaningful(judge.get("reason"), label=f"{case_id} judge reason", minimum=20)
        if judge.get("rubric_version") != schema_data["rubric_version"]:
            raise ContractError(f"{case_id}: judge rubric version drifted")
    except ContractError as exc:
        failures.append(str(exc))

    known_refs = event_ids | set(tool_calls) | evidence_ids
    if session_id:
        known_refs.add(f"session:{session_id}")
    required_results = judge.get("required_behavior_results")
    forbidden_results = judge.get("forbidden_behavior_results")
    if not isinstance(required_results, dict) or set(required_results) != set(expected["required_behaviors"]):
        failures.append(f"{case_id}: required behavior result coverage is incomplete")
    else:
        for behavior, result in required_results.items():
            if not isinstance(result, dict):
                failures.append(f"{case_id}: required behavior result must be an object: {behavior}")
                continue
            try:
                require_fields(
                    result,
                    schema_data["required_behavior_result_fields"],
                    label=f"{case_id} required behavior result",
                )
                if result.get("passed") is not True:
                    raise ContractError(f"{case_id}: a required behavior did not pass: {behavior}")
                refs = require_string_list(
                    result.get("evidence_refs"),
                    label=f"{case_id} required behavior evidence_refs",
                    minimum=1,
                )
                unknown = sorted(set(refs) - known_refs)
                if unknown:
                    raise ContractError(f"{case_id}: required behavior cites unknown evidence: {unknown[0]}")
                if not set(refs) & set(tool_calls):
                    raise ContractError(
                        f"{case_id}: required behavior lacks direct tool evidence: {behavior}"
                    )
            except ContractError as exc:
                failures.append(str(exc))
    if not isinstance(forbidden_results, dict) or set(forbidden_results) != set(expected["forbidden_behaviors"]):
        failures.append(f"{case_id}: forbidden behavior result coverage is incomplete")
    else:
        for behavior, result in forbidden_results.items():
            if not isinstance(result, dict):
                failures.append(f"{case_id}: forbidden behavior result must be an object: {behavior}")
                continue
            try:
                require_fields(
                    result,
                    schema_data["forbidden_behavior_result_fields"],
                    label=f"{case_id} forbidden behavior result",
                )
                if result.get("observed") is not False:
                    raise ContractError(f"{case_id}: a forbidden behavior was observed: {behavior}")
                refs = require_string_list(
                    result.get("evidence_refs"),
                    label=f"{case_id} forbidden behavior evidence_refs",
                    minimum=1,
                )
                unknown = sorted(set(refs) - known_refs)
                if unknown:
                    raise ContractError(f"{case_id}: forbidden behavior cites unknown evidence: {unknown[0]}")
            except ContractError as exc:
                failures.append(str(exc))
    return failures, session_id


def validate_results(
    results_path: Path,
    cases_data: dict[str, Any],
    schema_data: dict[str, Any],
) -> list[str]:
    results = load_json_object(results_path)
    failures: list[str] = []
    for field in schema_data["required_top_level"]:
        if field not in results:
            failures.append(f"results missing top-level field: {field}")
    if failures:
        return failures
    if results.get("schema") != schema_data["schema"]:
        failures.append("results schema does not match foundation live result schema")
    if results.get("rubric_version") != schema_data["rubric_version"]:
        failures.append("results rubric version does not match foundation live rubric")
    if results.get("fresh_session") is not True:
        failures.append("foundation live results must come from fresh sessions")
    expected_version = read_utf8(ROOT / "VERSION").strip()
    if results.get("skill_version") != expected_version:
        failures.append(f"results skill_version must exactly match VERSION ({expected_version})")
    try:
        runtime_target = require_meaningful(
            results.get("runtime_target"),
            label="results runtime_target",
        )
        runtime_digest = require_sha256(
            results.get("runtime_digest"),
            label="results runtime_digest",
        )
        revision = require_meaningful(
            results.get("source_revision"),
            label="results source_revision",
            minimum=12,
        )
        if runtime_digest != source_runtime_digest(ROOT, runtime_target):
            failures.append("results runtime_digest does not match the exact source runtime candidate")
        if revision != source_revision(ROOT):
            failures.append("results source_revision does not match the exact source candidate")
        validate_isolation_manifest(
            results.get("runner_isolation"),
            source_revision=revision,
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
    generated_at: Optional[datetime] = None
    try:
        generated_at = require_datetime(results.get("generated_at"), label="results generated_at")
        if generated_at > datetime.now(timezone.utc) + MAX_CLOCK_SKEW:
            raise ContractError("results generated_at is in the future")
        if generated_at < datetime.now(timezone.utc) - MAX_RESULT_AGE:
            raise ContractError("results generated_at is older than the 7-day live evidence window")
    except ContractError as exc:
        failures.append(str(exc))
    if generated_at is None:
        return failures
    failures.extend(validate_provenance(results, schema_data, generated_at))
    artifact, artifact_failures = load_run_artifact(results_path, results)
    failures.extend(artifact_failures)

    expected = {case["id"]: case for case in cases_data["cases"]}
    actual_cases = results.get("cases")
    if not isinstance(actual_cases, list):
        return failures + ["results cases must be a list"]
    artifact_cases: dict[str, Any] = {}
    if isinstance(artifact, dict):
        raw_cases = artifact.get("cases")
        if not isinstance(raw_cases, list):
            failures.append("runner artifact cases must be a list")
        else:
            for raw in raw_cases:
                if not isinstance(raw, dict) or not isinstance(raw.get("case_id"), str):
                    failures.append("runner artifact contains an invalid case")
                    continue
                if raw["case_id"] in artifact_cases:
                    failures.append(f"runner artifact contains duplicate case: {raw['case_id']}")
                artifact_cases[raw["case_id"]] = raw

    actual_ids: set[str] = set()
    session_ids: set[str] = set()
    for index, item in enumerate(actual_cases):
        if not isinstance(item, dict):
            failures.append(f"result case {index} must be an object")
            continue
        case_id = item.get("case_id")
        if case_id not in expected:
            failures.append(f"unknown result case: {case_id}")
            continue
        if case_id in actual_ids:
            failures.append(f"duplicate result case: {case_id}")
        actual_ids.add(case_id)
        case_failures, session_id = validate_case(
            item,
            expected[case_id],
            artifact_cases.get(case_id),
            schema_data,
            generated_at,
        )
        failures.extend(case_failures)
        if session_id in session_ids:
            failures.append(f"fresh-session evidence reused: {session_id}")
        if session_id:
            session_ids.add(session_id)

    missing = sorted(set(expected) - actual_ids)
    if missing:
        failures.append(f"missing live result cases: {', '.join(missing)}")
    extra_artifact = sorted(set(artifact_cases) - set(expected))
    if extra_artifact:
        failures.append(f"runner artifact contains unknown cases: {', '.join(extra_artifact)}")
    missing_artifact = sorted(set(expected) - set(artifact_cases)) if artifact is not None else []
    if missing_artifact:
        failures.append(f"runner artifact is missing cases: {', '.join(missing_artifact)}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--results", type=Path)
    parser.add_argument(
        "--contract-only",
        action="store_true",
        help="Validate cases, schema, and fixture hashes without claiming live behavior",
    )
    args = parser.parse_args()
    if args.contract_only and args.results is not None:
        return fail("--contract-only cannot be combined with --results", code=2)
    try:
        cases_data, schema_data = validate_static_contract(args.cases, args.schema)
        if args.contract_only:
            print(
                f"OK: foundation live static contract validated ({len(cases_data['cases'])} cases); "
                "static contract only, live model behavior not evaluated"
            )
            return 0
        if args.results is None:
            print(
                "UNVERIFIED: foundation live behavior has versioned fixtures and an evidence schema, "
                "but no fresh-session runner artifact and judged results were supplied"
            )
            return 2
        failures = validate_results(args.results, cases_data, schema_data)
    except ContractError as exc:
        return fail(str(exc))
    if failures:
        for message in failures:
            print(f"FAIL: {message}")
        return 1
    print(
        f"OK: foundation live evidence contract validated ({len(cases_data['cases'])} "
        "fresh-session cases); runner provenance remains an external trust boundary"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
