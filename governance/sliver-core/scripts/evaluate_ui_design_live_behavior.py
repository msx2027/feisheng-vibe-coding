#!/usr/bin/env python3
"""Validate UI-design fresh-session contracts and evidence-bearing run artifacts."""

from __future__ import annotations

import argparse
import hashlib
import struct
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

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
from runtime_governance_contract import (
    DELIVERY_SHAPE_SCHEMA,
    GovernanceContractError,
    delivery_shape_pre_lock_digest,
    validate_delivery_shape_lock,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/ui-design-live-behavior-cases.json"
DEFAULT_SCHEMA = ROOT / "tests/ui-design-live-result-schema.json"
FIXTURE_SCHEMA = "sliver-ui-design-live-fixture/v1"
ARTIFACT_SCHEMA = "sliver-ui-design-live-run-artifact/v3"
DOM_SNAPSHOT_SCHEMA = "sliver-dom-accessibility-snapshot/v1"
INTERACTION_TRACE_SCHEMA = "sliver-interaction-trace/v1"
SKILL_NAME = "sliver-vibe-coding"
MAX_CLOCK_SKEW = timedelta(minutes=5)
MAX_RESULT_AGE = timedelta(days=7)
PLACEHOLDERS = {"x", "xx", "xxx", "test", "fake", "fabricated", "unknown", "todo", "tbd", "n/a", "evidence"}
TOOL_EVIDENCE_KINDS = {"read", "write", "command", "render"}
IMAGE_ARTIFACT_KINDS = {
    "prototype_image",
    "transparent_asset",
    "rendered_screenshot",
    "rendered_screenshot_light",
    "rendered_screenshot_dark",
    "rendered_screenshot_mobile",
    "reference_screenshot",
    "candidate_screenshot",
}
PAIRED_SCREENSHOT_KINDS = {"reference_screenshot", "candidate_screenshot"}


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


def require_sha256(value: Any, *, label: str) -> str:
    digest = require_string(value, label=label, minimum=64)
    if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
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
    for relative in require_string_list(
        workspace.get("required_paths"), label=f"{case_id} workspace required_paths", minimum=1
    ):
        path = safe_repo_path(ROOT, f"{root_rel}/{relative}", label=f"{case_id} workspace path")
        try:
            path.relative_to(workspace_root)
        except ValueError as exc:
            raise ContractError(f"{case_id} workspace path escapes its root: {relative}") from exc
        if not path.is_file():
            raise ContractError(f"{case_id} workspace file is missing: {relative}")
    render_entry = require_meaningful(
        workspace.get("render_entry"), label=f"{case_id} workspace render_entry"
    )
    if not safe_repo_path(
        ROOT, f"{root_rel}/{render_entry}", label=f"{case_id} render entry"
    ).is_file():
        raise ContractError(f"{case_id} workspace render entry is missing")
    command = workspace.get("verification_command")
    if (
        not isinstance(command, list)
        or len(command) < 2
        or any(not isinstance(item, str) or not item.strip() for item in command)
        or command[0] != "python3"
    ):
        raise ContractError(f"{case_id} workspace verification_command must invoke python3")
    if not safe_repo_path(
        ROOT, f"{root_rel}/{command[1]}", label=f"{case_id} verification command"
    ).is_file():
        raise ContractError(f"{case_id} workspace verification command is missing")


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


def require_valid_png(path: Path, *, label: str) -> tuple[int, int, int, int]:
    data = path.read_bytes()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ContractError(f"{label} must be a valid PNG")
    offset = 8
    chunk_index = 0
    width = 0
    height = 0
    color_type = -1
    bit_depth = -1
    idat_parts: list[bytes] = []
    has_idat = False
    has_iend = False
    while offset < len(data):
        if offset + 12 > len(data):
            raise ContractError(f"{label} must be a valid PNG")
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        chunk_type = data[offset + 4 : offset + 8]
        chunk_end = offset + 12 + length
        if chunk_end > len(data):
            raise ContractError(f"{label} must be a valid PNG")
        chunk_data = data[offset + 8 : offset + 8 + length]
        recorded_crc = struct.unpack(
            ">I",
            data[offset + 8 + length : chunk_end],
        )[0]
        calculated_crc = zlib.crc32(chunk_type)
        calculated_crc = zlib.crc32(chunk_data, calculated_crc) & 0xFFFFFFFF
        if recorded_crc != calculated_crc:
            raise ContractError(f"{label} must be a valid PNG")
        if chunk_index == 0:
            if chunk_type != b"IHDR" or length != 13:
                raise ContractError(f"{label} must be a valid PNG")
            width, height = struct.unpack(">II", chunk_data[:8])
            if width < 1 or height < 1:
                raise ContractError(f"{label} must be a valid PNG")
            bit_depth = chunk_data[8]
            color_type = chunk_data[9]
            if (
                bit_depth != 8
                or color_type not in {2, 6}
                or chunk_data[10:13] != b"\x00\x00\x00"
            ):
                raise ContractError(
                    f"{label} must be a non-interlaced 8-bit RGB or RGBA PNG"
                )
        elif chunk_type == b"IHDR":
            raise ContractError(f"{label} must be a valid PNG")
        if chunk_type == b"IDAT":
            has_idat = True
            idat_parts.append(chunk_data)
        if chunk_type == b"IEND":
            if length != 0 or chunk_end != len(data):
                raise ContractError(f"{label} must be a valid PNG")
            has_iend = True
        offset = chunk_end
        chunk_index += 1
    if not has_idat or not has_iend:
        raise ContractError(f"{label} must be a valid PNG")
    try:
        pixels = zlib.decompress(b"".join(idat_parts))
    except zlib.error as exc:
        raise ContractError(f"{label} must be a valid PNG") from exc
    bytes_per_pixel = 3 if color_type == 2 else 4
    row_size = 1 + width * bytes_per_pixel
    if len(pixels) != row_size * height:
        raise ContractError(f"{label} must contain complete PNG pixel data")
    if any(pixels[row * row_size] > 4 for row in range(height)):
        raise ContractError(f"{label} contains an invalid PNG scanline filter")
    reconstructed = bytearray()
    prior = bytearray(width * bytes_per_pixel)
    for row in range(height):
        offset = row * row_size
        filter_type = pixels[offset]
        encoded = pixels[offset + 1 : offset + row_size]
        current = bytearray(len(encoded))
        for index, value in enumerate(encoded):
            left = current[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
            above = prior[index]
            upper_left = prior[index - bytes_per_pixel] if index >= bytes_per_pixel else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            else:
                estimate = left + above - upper_left
                distances = (abs(estimate - left), abs(estimate - above), abs(estimate - upper_left))
                predictor = (left, above, upper_left)[distances.index(min(distances))]
            current[index] = (value + predictor) & 0xFF
        reconstructed.extend(current)
        prior = current
    unique_pixels = {
        bytes(reconstructed[index : index + bytes_per_pixel])
        for index in range(0, len(reconstructed), bytes_per_pixel)
    }
    return width, height, color_type, len(unique_pixels)


def require_image_artifact(path: Path, *, kind: str, label: str) -> None:
    width, height, color_type, unique_pixels = require_valid_png(path, label=label)
    if kind == "rendered_screenshot_mobile":
        if width < 240 or height < 320:
            raise ContractError(
                f"{label} must be at least 240x320 pixels"
            )
    elif kind.startswith("rendered_screenshot") or kind in PAIRED_SCREENSHOT_KINDS:
        if width < 640 or height < 360:
            raise ContractError(
                f"{label} must be at least 640x360 pixels"
            )
    elif kind == "prototype_image" and (width < 320 or height < 200):
        raise ContractError(f"{label} must be at least 320x200 pixels")
    elif kind == "transparent_asset" and color_type != 6:
        raise ContractError(f"{label} must use an RGBA PNG")
    if kind != "transparent_asset" and unique_pixels < 8:
        raise ContractError(f"{label} is a solid or low-information placeholder image")


def require_structured_behavior_artifact(
    path: Path, *, kind: str, label: str
) -> None:
    payload = load_json_object(path)
    if kind == "dom_accessibility_snapshot":
        if set(payload) != {"schema", "source", "nodes"}:
            raise ContractError(f"{label} DOM snapshot fields drifted")
        if payload.get("schema") != DOM_SNAPSHOT_SCHEMA:
            raise ContractError(f"{label} DOM snapshot schema is invalid")
        require_meaningful(payload.get("source"), label=f"{label} source")
        nodes = payload.get("nodes")
        if not isinstance(nodes, list) or not nodes:
            raise ContractError(f"{label} DOM snapshot nodes must be non-empty")
        for index, value in enumerate(nodes):
            node = require_object(value, label=f"{label} node {index}")
            if set(node) != {"role", "name", "states"}:
                raise ContractError(f"{label} node {index} fields drifted")
            require_meaningful(node.get("role"), label=f"{label} node {index} role")
            require_meaningful(node.get("name"), label=f"{label} node {index} name")
            require_string_list(
                node.get("states"), label=f"{label} node {index} states"
            )
        return
    if kind == "interaction_trace":
        if set(payload) != {"schema", "source", "steps"}:
            raise ContractError(f"{label} interaction trace fields drifted")
        if payload.get("schema") != INTERACTION_TRACE_SCHEMA:
            raise ContractError(f"{label} interaction trace schema is invalid")
        require_meaningful(payload.get("source"), label=f"{label} source")
        steps = payload.get("steps")
        if not isinstance(steps, list) or not steps:
            raise ContractError(f"{label} interaction trace steps must be non-empty")
        for index, value in enumerate(steps):
            step = require_object(value, label=f"{label} step {index}")
            if set(step) != {"action", "expected", "observed", "status"}:
                raise ContractError(f"{label} step {index} fields drifted")
            for field in ("action", "expected", "observed"):
                require_meaningful(
                    step.get(field), label=f"{label} step {index} {field}"
                )
            if step.get("status") not in {"passed", "failed"}:
                raise ContractError(f"{label} step {index} status is invalid")


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
    path = (base / relative).resolve()
    try:
        path.relative_to(base)
    except ValueError as exc:
        raise ContractError(f"{label} must stay beside or below the results file") from exc
    if path == results_path.resolve() or not path.is_file():
        raise ContractError(f"{label} file does not exist or aliases results: {relative}")
    return path


def validate_static_contract(cases_path: Path, schema_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    cases_data = load_json_object(cases_path)
    schema_data = load_json_object(schema_path)
    if cases_data.get("schema") != "sliver-ui-design-live-cases/v3":
        raise ContractError("unsupported UI design live case schema")
    if cases_data.get("evaluation_scope") != "fresh_session_model_behavior":
        raise ContractError("UI design live cases must declare fresh-session scope")
    if require_bool(cases_data.get("requires_live_model_validation"), label="requires_live_model_validation") is not True:
        raise ContractError("UI design cases must require live model validation")
    if require_bool(cases_data.get("static_contracts_are_not_live_proof"), label="static_contracts_are_not_live_proof") is not True:
        raise ContractError("UI design cases must preserve the static/live proof boundary")
    if schema_data.get("schema") != "sliver-ui-design-live-results/v4":
        raise ContractError("unsupported UI design live result schema")
    if cases_data.get("rubric_version") != schema_data.get("rubric_version"):
        raise ContractError("UI design cases and result schema rubric versions differ")
    for key in (
        "required_top_level", "required_runner_fields", "required_judge_provenance_fields",
        "required_case_fields", "required_fixture_fields", "required_skill_selection_fields",
        "required_session_fields", "required_transcript_event_fields", "required_tool_event_fields",
        "required_artifact_fields", "required_judge_fields", "required_behavior_result_fields",
        "forbidden_behavior_result_fields", "allowed_judge_statuses", "allowed_judge_kinds",
        "allowed_transcript_roles", "allowed_tool_statuses",
    ):
        require_string_list(schema_data.get(key), label=key, minimum=1)
    if set(schema_data["allowed_judge_statuses"]) != {"pass", "fail", "unverified"}:
        raise ContractError("UI design live result statuses drifted")

    cases = cases_data.get("cases")
    if not isinstance(cases, list) or len(cases) < 8:
        raise ContractError("UI design live corpus must contain at least 8 cases")
    seen_ids: set[str] = set()
    seen_prompts: set[str] = set()
    for index, value in enumerate(cases):
        case = require_object(value, label=f"case {index}")
        case_id = require_meaningful(case.get("id"), label=f"case {index} id")
        prompt = require_prompt(case.get("initial_user"), label=f"{case_id} initial_user")
        fixture_ref = require_object(case.get("fixture"), label=f"{case_id} fixture")
        require_fields(fixture_ref, schema_data["required_fixture_fields"], label=f"{case_id} fixture")
        fixture_path = safe_repo_path(ROOT, require_meaningful(fixture_ref.get("path"), label=f"{case_id} fixture path"), label=f"{case_id} fixture")
        expected_digest = require_sha256(fixture_ref.get("sha256"), label=f"{case_id} fixture sha256")
        if not fixture_path.is_file() or sha256_file(fixture_path) != expected_digest:
            raise ContractError(f"{case_id} fixture is missing or its SHA-256 drifted")
        fixture = load_json_object(fixture_path)
        if fixture.get("schema") != FIXTURE_SCHEMA or fixture.get("id") != fixture_ref.get("id"):
            raise ContractError(f"{case_id} fixture identity or schema drifted")
        require_int(fixture.get("version"), label=f"{case_id} fixture version", minimum=1)
        if not isinstance(fixture.get("context"), dict) or not fixture["context"]:
            raise ContractError(f"{case_id} fixture context must be a non-empty object")
        validate_fixture_workspace(fixture, case_id=case_id)
        require_int(case.get("minimum_user_turns"), label=f"{case_id} minimum_user_turns", minimum=1)
        require_int(case.get("minimum_assistant_turns"), label=f"{case_id} minimum_assistant_turns", minimum=1)
        require_int(case.get("minimum_tool_events"), label=f"{case_id} minimum_tool_events", minimum=1)
        validate_required_tool_evidence(case, case_id=case_id)
        if case["minimum_tool_events"] < len(case["required_tool_evidence"]):
            raise ContractError(
                f"{case_id} minimum_tool_events cannot be smaller than required_tool_evidence"
            )
        kinds = case.get("required_artifact_kinds")
        if not isinstance(kinds, list) or any(not isinstance(item, str) or not item for item in kinds):
            raise ContractError(f"{case_id} required_artifact_kinds must be a string list")
        require_string_list(case.get("required_behaviors"), label=f"{case_id} required_behaviors", minimum=2)
        require_string_list(case.get("forbidden_behaviors"), label=f"{case_id} forbidden_behaviors", minimum=2)
        if case_id in seen_ids or prompt in seen_prompts:
            raise ContractError(f"duplicate UI design live case id or prompt: {case_id}")
        seen_ids.add(case_id)
        seen_prompts.add(prompt)
    return cases_data, schema_data


def validate_provenance(results: dict[str, Any], schema: dict[str, Any], generated_at: datetime) -> list[str]:
    failures: list[str] = []
    try:
        runner = require_object(results.get("runner_provenance"), label="runner_provenance")
        require_fields(runner, schema["required_runner_fields"], label="runner_provenance")
        for field in ("name", "version", "invocation_id", "artifact_path"):
            require_meaningful(runner.get(field), label=f"runner_provenance {field}")
        require_sha256(runner.get("artifact_sha256"), label="runner_provenance artifact_sha256")
    except ContractError as exc:
        failures.append(str(exc))
    try:
        judge = require_object(results.get("judge_provenance"), label="judge_provenance")
        require_fields(judge, schema["required_judge_provenance_fields"], label="judge_provenance")
        kind = require_string(judge.get("kind"), label="judge kind")
        if kind not in schema["allowed_judge_kinds"]:
            raise ContractError("judge kind is unsupported")
        identity = require_meaningful(judge.get("identity"), label="judge identity")
        require_meaningful(judge.get("version"), label="judge version")
        if judge.get("independent_from_subject") is not True:
            raise ContractError("judge must be independent from the subject")
        if judge.get("rubric_version") != schema["rubric_version"]:
            raise ContractError("judge rubric version drifted")
        if kind == "model" and identity.casefold() == str(results.get("model", "")).casefold():
            raise ContractError("subject model cannot judge its own UI behavior")
        if require_datetime(judge.get("judged_at"), label="judge judged_at") > generated_at + MAX_CLOCK_SKEW:
            raise ContractError("judge timestamp is after result generation")
    except ContractError as exc:
        failures.append(str(exc))
    return failures


def load_runner_artifact(results_path: Path, results: dict[str, Any]) -> tuple[Optional[dict[str, Any]], list[str]]:
    try:
        runner = require_object(results.get("runner_provenance"), label="runner_provenance")
        path = safe_result_file(results_path, require_meaningful(runner.get("artifact_path"), label="runner artifact path"), label="runner artifact")
        if sha256_file(path) != require_sha256(runner.get("artifact_sha256"), label="runner artifact sha256"):
            raise ContractError("runner artifact SHA-256 does not match results provenance")
        artifact = load_json_object(path)
    except ContractError as exc:
        return None, [str(exc)]
    failures: list[str] = []
    if artifact.get("schema") != ARTIFACT_SCHEMA:
        failures.append("runner artifact schema is unsupported")
    for field in ("run_id", "runtime_target", "runtime_digest", "source_revision", "platform", "model", "generated_at"):
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
    raw_runner = artifact.get("runner_provenance")
    for field in ("name", "version", "invocation_id"):
        if not isinstance(raw_runner, dict) or raw_runner.get(field) != runner.get(field):
            failures.append(f"runner artifact provenance {field} does not match results")
    return artifact, failures


def validate_case(item: dict[str, Any], expected: dict[str, Any], raw: Any, schema: dict[str, Any], results_path: Path, generated_at: datetime) -> tuple[list[str], str]:
    case_id = expected["id"]
    failures: list[str] = []
    runtime_digest = ""
    revision = ""
    try:
        require_fields(item, schema["required_case_fields"], label=f"{case_id} result")
    except ContractError as exc:
        return [str(exc)], ""
    if item.get("fixture") != expected["fixture"] or item.get("initial_user") != expected["initial_user"]:
        failures.append(f"{case_id}: fixture or initial prompt differs from the case contract")
    raw_fields = ("case_id", "fixture", "initial_user", "skill_selection", "session", "transcript", "tool_trace", "artifacts", "final_output")
    if not isinstance(raw, dict):
        failures.append(f"{case_id}: raw runner artifact case is missing")
    else:
        for field in raw_fields:
            if raw.get(field) != item.get(field):
                failures.append(f"{case_id}: judged {field} differs from the raw runner artifact")

    session_id = ""
    started: Optional[datetime] = None
    ended: Optional[datetime] = None
    try:
        session = require_object(item.get("session"), label=f"{case_id} session")
        require_fields(session, schema["required_session_fields"], label=f"{case_id} session")
        session_id = require_meaningful(session.get("session_id"), label=f"{case_id} session_id", minimum=8)
        started = require_datetime(session.get("started_at"), label=f"{case_id} started_at")
        ended = require_datetime(session.get("ended_at"), label=f"{case_id} ended_at")
        if ended < started or ended > generated_at + MAX_CLOCK_SKEW:
            raise ContractError(f"{case_id} session timestamps are inconsistent")
    except ContractError as exc:
        failures.append(str(exc))

    event_ids: set[str] = set()
    roles: dict[str, str] = {}
    user_text: list[str] = []
    assistant_text: list[str] = []
    transcript = item.get("transcript")
    if not isinstance(transcript, list) or not transcript:
        failures.append(f"{case_id}: missing structured transcript")
        transcript = []
    previous: Optional[datetime] = None
    for index, value in enumerate(transcript):
        try:
            event = require_object(value, label=f"{case_id} transcript event {index}")
            require_fields(event, schema["required_transcript_event_fields"], label=f"{case_id} transcript event {index}")
            event_id = require_meaningful(event.get("event_id"), label=f"{case_id} event id")
            role = require_string(event.get("role"), label=f"{case_id} event role")
            if event_id in event_ids or role not in schema["allowed_transcript_roles"]:
                raise ContractError(f"{case_id} duplicate event or unsupported role")
            timestamp = require_datetime(event.get("timestamp"), label=f"{case_id} event timestamp")
            content = require_meaningful(event.get("content"), label=f"{case_id} event content")
            if previous is not None and timestamp < previous:
                raise ContractError(f"{case_id} transcript timestamps are not monotonic")
            if started is not None and timestamp < started or ended is not None and timestamp > ended:
                raise ContractError(f"{case_id} transcript event lies outside the session")
            previous = timestamp
            event_ids.add(event_id)
            roles[event_id] = role
            if role == "user": user_text.append(content)
            if role == "assistant": assistant_text.append(content)
        except ContractError as exc:
            failures.append(str(exc))
    if not user_text or user_text[0] != expected["initial_user"] or len(user_text) < expected["minimum_user_turns"]:
        failures.append(f"{case_id}: user transcript does not match the case")
    if len(assistant_text) < expected["minimum_assistant_turns"] or item.get("final_output") != (assistant_text[-1] if assistant_text else None):
        failures.append(f"{case_id}: assistant transcript or final_output is incomplete")

    try:
        selection = require_object(item.get("skill_selection"), label=f"{case_id} skill_selection")
        require_fields(selection, schema["required_skill_selection_fields"], label=f"{case_id} skill_selection")
        selection_ref = require_meaningful(selection.get("evidence_ref"), label=f"{case_id} selection ref")
        if selection.get("selected") is not True or selection.get("skill_name") != SKILL_NAME or roles.get(selection_ref) != "system":
            raise ContractError(f"{case_id}: Sliver selection lacks system evidence")
        system_event = next((event for event in transcript if event.get("event_id") == selection_ref), {})
        if SKILL_NAME not in str(system_event.get("content", "")):
            raise ContractError(f"{case_id}: selection evidence does not name Sliver")
        require_datetime(selection.get("selected_at"), label=f"{case_id} selected_at")
    except ContractError as exc:
        failures.append(str(exc))

    tool_calls: dict[str, dict[str, Any]] = {}
    tool_trace = item.get("tool_trace")
    if not isinstance(tool_trace, list) or len(tool_trace) < expected["minimum_tool_events"]:
        failures.append(f"{case_id}: insufficient structured tool evidence")
        tool_trace = [] if not isinstance(tool_trace, list) else tool_trace
    for index, value in enumerate(tool_trace):
        try:
            event = require_object(value, label=f"{case_id} tool event {index}")
            require_fields(event, schema["required_tool_event_fields"], label=f"{case_id} tool event {index}")
            call_id = require_meaningful(event.get("tool_call_id"), label=f"{case_id} tool id")
            if call_id in tool_calls or event.get("status") not in schema["allowed_tool_statuses"]:
                raise ContractError(f"{case_id}: duplicate tool call or unsupported status")
            if roles.get(event.get("transcript_event_ref")) != "tool":
                raise ContractError(f"{case_id}: tool call lacks a tool transcript event")
            tool_started = require_datetime(event.get("started_at"), label=f"{case_id} tool started_at")
            tool_ended = require_datetime(event.get("completed_at"), label=f"{case_id} tool completed_at")
            if tool_ended < tool_started:
                raise ContractError(f"{case_id}: tool timestamps are inconsistent")
            require_meaningful(event.get("tool_name"), label=f"{case_id} tool name")
            require_meaningful(event.get("request_summary"), label=f"{case_id} tool request", minimum=8)
            require_meaningful(event.get("response_summary"), label=f"{case_id} tool response", minimum=8)
            evidence_kind = require_string(
                event.get("evidence_kind"), label=f"{case_id} tool evidence_kind"
            )
            evidence_target = require_meaningful(
                event.get("evidence_target"), label=f"{case_id} tool evidence_target", minimum=3
            )
            if evidence_kind not in TOOL_EVIDENCE_KINDS:
                raise ContractError(f"{case_id}: unsupported tool evidence_kind")
            tool_calls[call_id] = event
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
    required_render_targets = {
        requirement["target"]
        for requirement in expected["required_tool_evidence"]
        if requirement["kind"] == "render"
    }

    artifact_ids: set[str] = set()
    artifact_kinds: set[str] = set()
    artifact_records: dict[str, dict[str, Any]] = {}
    artifact_paths: dict[str, Path] = {}
    artifacts = item.get("artifacts")
    if not isinstance(artifacts, list):
        failures.append(f"{case_id}: artifacts must be a list")
        artifacts = []
    for index, value in enumerate(artifacts):
        try:
            artifact = require_object(value, label=f"{case_id} artifact {index}")
            require_fields(artifact, schema["required_artifact_fields"], label=f"{case_id} artifact {index}")
            artifact_id = require_meaningful(artifact.get("artifact_id"), label=f"{case_id} artifact id")
            kind = require_meaningful(artifact.get("kind"), label=f"{case_id} artifact kind")
            if artifact_id in artifact_ids:
                raise ContractError(f"{case_id}: duplicate artifact id")
            evidence_role = require_string(
                artifact.get("evidence_role"),
                label=f"{case_id} artifact evidence_role",
            )
            pair_id = require_string(
                artifact.get("pair_id"), label=f"{case_id} artifact pair_id"
            )
            viewport = require_string(
                artifact.get("viewport"), label=f"{case_id} artifact viewport"
            )
            state = require_string(
                artifact.get("state"), label=f"{case_id} artifact state"
            )
            theme = require_string(
                artifact.get("theme"), label=f"{case_id} artifact theme"
            )
            if kind == "reference_screenshot":
                if evidence_role != "reference" or pair_id == "not_applicable":
                    raise ContractError(
                        f"{case_id}: reference screenshot requires reference role and pair id"
                    )
            elif kind == "candidate_screenshot":
                if evidence_role != "candidate" or pair_id == "not_applicable":
                    raise ContractError(
                        f"{case_id}: candidate screenshot requires candidate role and pair id"
                    )
            elif evidence_role != "supporting" or pair_id != "not_applicable":
                raise ContractError(
                    f"{case_id}: non-paired artifact must use supporting role and not_applicable pair id"
                )
            if kind in IMAGE_ARTIFACT_KINDS - {"transparent_asset"}:
                if "not_applicable" in {viewport, state, theme}:
                    raise ContractError(
                        f"{case_id}: image artifact requires viewport, state, and theme"
                    )
            elif (
                kind not in IMAGE_ARTIFACT_KINDS
                and {viewport, state, theme} != {"not_applicable"}
            ):
                raise ContractError(
                    f"{case_id}: non-image artifact context must be not_applicable"
                )
            call = tool_calls.get(artifact.get("tool_call_id"))
            if call is None or call.get("status") != "success":
                raise ContractError(f"{case_id}: artifact lacks a successful producing tool call")
            if (
                kind.startswith("rendered_screenshot")
                or kind in PAIRED_SCREENSHOT_KINDS
            ) and call.get("evidence_kind") != "render":
                raise ContractError(
                    f"{case_id}: rendered screenshot must come from a render tool event"
                )
            if (
                (
                    kind.startswith("rendered_screenshot")
                    or kind in PAIRED_SCREENSHOT_KINDS
                )
                and required_render_targets
                and call.get("evidence_target") not in required_render_targets
            ):
                raise ContractError(
                    f"{case_id}: rendered screenshot must come from the contracted render target"
                )
            path = safe_result_file(results_path, require_meaningful(artifact.get("path"), label=f"{case_id} artifact path"), label=f"{case_id} artifact")
            if sha256_file(path) != require_sha256(artifact.get("sha256"), label=f"{case_id} artifact sha256"):
                raise ContractError(f"{case_id}: artifact SHA-256 does not match")
            if kind in IMAGE_ARTIFACT_KINDS:
                require_image_artifact(
                    path,
                    kind=kind,
                    label=f"{case_id} {kind}",
                )
            elif kind in {"dom_accessibility_snapshot", "interaction_trace"}:
                require_structured_behavior_artifact(
                    path,
                    kind=kind,
                    label=f"{case_id} {kind}",
                )
            artifact_ids.add(artifact_id)
            artifact_kinds.add(kind)
            artifact_records[artifact_id] = artifact
            artifact_paths[artifact_id] = path
        except ContractError as exc:
            failures.append(str(exc))
    missing_kinds = sorted(set(expected["required_artifact_kinds"]) - artifact_kinds)
    if missing_kinds:
        failures.append(f"{case_id}: missing required artifact kind: {missing_kinds[0]}")

    reference_pairs = {
        artifact["pair_id"]: artifact
        for artifact in artifact_records.values()
        if artifact.get("kind") == "reference_screenshot"
    }
    candidate_pairs = {
        artifact["pair_id"]: artifact
        for artifact in artifact_records.values()
        if artifact.get("kind") == "candidate_screenshot"
    }
    if (
        "reference_screenshot" in expected["required_artifact_kinds"]
        or "candidate_screenshot" in expected["required_artifact_kinds"]
    ):
        if set(reference_pairs) != set(candidate_pairs) or not reference_pairs:
            failures.append(
                f"{case_id}: reference and candidate screenshots must form complete pairs"
            )
        else:
            for pair_id, reference in reference_pairs.items():
                candidate = candidate_pairs[pair_id]
                if any(
                    reference[field] != candidate[field]
                    for field in ("viewport", "state", "theme")
                ):
                    failures.append(
                        f"{case_id}: reference/candidate viewport, state, and theme must match"
                    )
                    break
                if reference["sha256"] == candidate["sha256"]:
                    failures.append(
                        f"{case_id}: reference and candidate screenshots must be distinct captures"
                    )
                    break
                if reference["tool_call_id"] == candidate["tool_call_id"]:
                    failures.append(
                        f"{case_id}: reference and candidate screenshots must come from distinct capture calls"
                    )
                    break

    pre_lock_items = [
        (artifact_id, artifact_paths[artifact_id])
        for artifact_id, artifact in artifact_records.items()
        if artifact.get("kind") == "delivery_shape_pre_lock"
    ]
    acceptance_items = [
        (artifact_id, artifact_paths[artifact_id])
        for artifact_id, artifact in artifact_records.items()
        if artifact.get("kind") == "delivery_shape_acceptance"
    ]
    if pre_lock_items or acceptance_items:
        if len(pre_lock_items) != 1 or len(acceptance_items) != 1:
            failures.append(
                f"{case_id}: delivery-shape evidence requires one pre-lock and one acceptance record"
            )
        else:
            try:
                pre_lock = load_json_object(pre_lock_items[0][1])
                acceptance = load_json_object(acceptance_items[0][1])
                if (
                    pre_lock.get("schema") != DELIVERY_SHAPE_SCHEMA
                    or pre_lock.get("phase") != "pre_implementation"
                ):
                    raise ContractError(
                        f"{case_id}: delivery-shape pre-lock schema or phase is invalid"
                    )
                if (
                    acceptance.get("schema") != DELIVERY_SHAPE_SCHEMA
                    or acceptance.get("phase") != "acceptance"
                ):
                    raise ContractError(
                        f"{case_id}: delivery-shape acceptance schema or phase is invalid"
                    )
                if acceptance.get("pre_lock_digest") != delivery_shape_pre_lock_digest(
                    pre_lock
                ):
                    raise ContractError(
                        f"{case_id}: delivery-shape acceptance does not bind the pre-lock digest"
                    )
                acceptance_evidence = require_object(
                    acceptance.get("acceptance_evidence"),
                    label=f"{case_id} delivery-shape acceptance_evidence",
                )
                projection = require_object(
                    pre_lock.get("source_schema_projection"),
                    label=f"{case_id} delivery-shape source_schema_projection",
                )
                projection_fields = projection.get("fields")
                if not isinstance(projection_fields, list):
                    raise ContractError(
                        f"{case_id}: delivery-shape projection fields must be a list"
                    )
                expected_source_field_ids = [
                    require_meaningful(
                        item.get("source_id"),
                        label=f"{case_id} source projection id",
                    )
                    for item in projection_fields
                    if isinstance(item, dict)
                ]
                source_revision_value = require_meaningful(
                    acceptance.get("source_revision"),
                    label=f"{case_id} delivery-shape source_revision",
                )
                pre_context = {
                    "project_root": "/synthetic/live-run",
                    "expected_target_surface": pre_lock.get("target_surface"),
                    "expected_owner_paths": pre_lock.get("owner_paths"),
                    "expected_constraint_owner_paths": pre_lock.get(
                        "constraint_owner_paths"
                    ),
                    "expected_phase": "pre_implementation",
                    "expected_source_revision": source_revision_value,
                    "expected_pre_lock_digest": None,
                    "expected_source_field_ids": expected_source_field_ids,
                    "expected_stable_reference": pre_lock.get("stable_reference"),
                    "expected_visual_pairs": [],
                    "expected_dom_snapshot_refs": [],
                    "expected_interaction_refs": [],
                    "expected_changed_region_refs": [],
                    "expected_unchanged_region_refs": [],
                    "expected_independent_review_ref": None,
                }
                validate_delivery_shape_lock(pre_lock, pre_context)
                host_visual_pairs = [
                    {
                        "pair_id": pair_id,
                        "reference_artifact": reference["artifact_id"],
                        "candidate_artifact": candidate_pairs[pair_id]["artifact_id"],
                        "viewport": reference["viewport"],
                        "state": reference["state"],
                        "theme": reference["theme"],
                    }
                    for pair_id, reference in sorted(reference_pairs.items())
                    if pair_id in candidate_pairs
                ]
                host_dom_refs = sorted(
                    artifact_id
                    for artifact_id, artifact in artifact_records.items()
                    if artifact.get("kind") == "dom_accessibility_snapshot"
                )
                host_interaction_refs = sorted(
                    artifact_id
                    for artifact_id, artifact in artifact_records.items()
                    if artifact.get("kind") == "interaction_trace"
                )
                host_changed_refs = sorted(
                    artifact_id
                    for artifact_id, artifact in artifact_records.items()
                    if artifact.get("kind") == "candidate_screenshot"
                )
                host_unchanged_refs = sorted(
                    artifact_id
                    for artifact_id, artifact in artifact_records.items()
                    if artifact.get("kind") == "reference_screenshot"
                )
                acceptance_context = {
                    **pre_context,
                    "expected_phase": "acceptance",
                    "expected_pre_lock_digest": acceptance.get("pre_lock_digest"),
                    "expected_visual_pairs": host_visual_pairs,
                    "expected_dom_snapshot_refs": host_dom_refs,
                    "expected_interaction_refs": host_interaction_refs,
                    "expected_changed_region_refs": host_changed_refs,
                    "expected_unchanged_region_refs": host_unchanged_refs,
                    "expected_independent_review_ref": acceptance_evidence.get(
                        "independent_review_ref"
                    ),
                }
                validate_delivery_shape_lock(acceptance, acceptance_context)

                visual_pairs = acceptance_evidence["visual_pairs"]
                bound_refs: set[str] = set()
                for pair in visual_pairs:
                    reference_id = pair["reference_artifact"]
                    candidate_id = pair["candidate_artifact"]
                    reference = artifact_records.get(reference_id)
                    candidate = artifact_records.get(candidate_id)
                    if (
                        reference is None
                        or reference.get("kind") != "reference_screenshot"
                        or candidate is None
                        or candidate.get("kind") != "candidate_screenshot"
                    ):
                        raise ContractError(
                            f"{case_id}: delivery-shape visual pair references invalid artifacts"
                        )
                    if any(
                        pair[field] != reference[field]
                        or pair[field] != candidate[field]
                        for field in ("pair_id", "viewport", "state", "theme")
                    ):
                        raise ContractError(
                            f"{case_id}: delivery-shape visual pair metadata drifted"
                        )
                    bound_refs.update({reference_id, candidate_id})
                dom_refs = set(acceptance_evidence["dom_snapshot_refs"])
                interaction_refs = set(acceptance_evidence["interaction_refs"])
                if any(
                    artifact_records.get(ref, {}).get("kind")
                    != "dom_accessibility_snapshot"
                    for ref in dom_refs
                ):
                    raise ContractError(
                        f"{case_id}: delivery-shape DOM refs are invalid"
                    )
                if any(
                    artifact_records.get(ref, {}).get("kind")
                    != "interaction_trace"
                    for ref in interaction_refs
                ):
                    raise ContractError(
                        f"{case_id}: delivery-shape interaction refs are invalid"
                    )
                bound_refs.update(dom_refs)
                bound_refs.update(interaction_refs)
                expected_artifact_refs = {
                    artifact_id
                    for artifact_id, artifact in artifact_records.items()
                    if artifact.get("kind")
                    in {
                        "reference_screenshot",
                        "candidate_screenshot",
                        "dom_accessibility_snapshot",
                        "interaction_trace",
                    }
                }
                if bound_refs != expected_artifact_refs:
                    raise ContractError(
                        f"{case_id}: delivery-shape acceptance artifact refs are incomplete"
                    )
            except (ContractError, GovernanceContractError) as exc:
                failures.append(str(exc))

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
    except ContractError as exc:
        failures.append(str(exc))
    known_refs = event_ids | set(tool_calls) | artifact_ids | ({f"session:{session_id}"} if session_id else set())
    required_direct_refs: set[str] = set()
    for field, behaviors, flag, expected_value in (
        ("required_behavior_results", expected["required_behaviors"], "passed", True),
        ("forbidden_behavior_results", expected["forbidden_behaviors"], "observed", False),
    ):
        verdicts = judge.get(field)
        if not isinstance(verdicts, dict) or set(verdicts) != set(behaviors):
            failures.append(f"{case_id}: {field} coverage is incomplete")
            continue
        required_fields = schema["required_behavior_result_fields"] if flag == "passed" else schema["forbidden_behavior_result_fields"]
        for behavior, verdict in verdicts.items():
            try:
                verdict = require_object(verdict, label=f"{case_id} verdict for {behavior}")
                require_fields(verdict, required_fields, label=f"{case_id} verdict for {behavior}")
                if verdict.get(flag) is not expected_value:
                    raise ContractError(f"{case_id}: behavior verdict failed: {behavior}")
                refs = require_string_list(verdict.get("evidence_refs"), label=f"{case_id} evidence refs", minimum=1)
                unknown = sorted(set(refs) - known_refs)
                if unknown:
                    raise ContractError(f"{case_id}: behavior cites unknown evidence: {unknown[0]}")
                if flag == "passed" and not set(refs) & set(tool_calls):
                    raise ContractError(
                        f"{case_id}: required behavior lacks direct tool evidence: {behavior}"
                    )
                if flag == "passed":
                    required_direct_refs.update(set(refs) & set(tool_calls))
            except ContractError as exc:
                failures.append(str(exc))
    if (
        len(expected["required_behaviors"]) > 1
        and expected["minimum_tool_events"] >= 2
        and len(required_direct_refs) < 2
    ):
        failures.append(
            f"{case_id}: all required behaviors collapse onto one direct tool event"
        )
    return failures, session_id


def validate_results(results_path: Path, cases_data: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    results = load_json_object(results_path)
    failures: list[str] = []
    try:
        require_fields(results, schema["required_top_level"], label="results")
    except ContractError as exc:
        return [str(exc)]
    if results.get("schema") != schema["schema"] or results.get("rubric_version") != schema["rubric_version"]:
        failures.append("results schema or rubric version does not match")
    if results.get("fresh_session") is not True:
        failures.append("UI live results must come from fresh sessions")
    if results.get("skill_version") != read_utf8(ROOT / "VERSION").strip():
        failures.append("results skill_version must exactly match VERSION")
    try:
        runtime_target = require_meaningful(results.get("runtime_target"), label="results runtime_target")
        runtime_digest = require_sha256(results.get("runtime_digest"), label="results runtime_digest")
        revision = require_meaningful(results.get("source_revision"), label="results source_revision", minimum=12)
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
        try: require_meaningful(results.get(field), label=f"results {field}")
        except ContractError as exc: failures.append(str(exc))
    try:
        generated_at = require_datetime(results.get("generated_at"), label="generated_at")
        if generated_at > datetime.now(timezone.utc) + MAX_CLOCK_SKEW:
            raise ContractError("generated_at is in the future")
        if generated_at < datetime.now(timezone.utc) - MAX_RESULT_AGE:
            raise ContractError("generated_at is older than the 7-day live evidence window")
    except ContractError as exc:
        return failures + [str(exc)]
    failures.extend(validate_provenance(results, schema, generated_at))
    raw_artifact, raw_failures = load_runner_artifact(results_path, results)
    failures.extend(raw_failures)
    raw_cases: dict[str, Any] = {}
    if isinstance(raw_artifact, dict) and isinstance(raw_artifact.get("cases"), list):
        for raw in raw_artifact["cases"]:
            if isinstance(raw, dict) and isinstance(raw.get("case_id"), str):
                if raw["case_id"] in raw_cases: failures.append(f"duplicate raw case: {raw['case_id']}")
                raw_cases[raw["case_id"]] = raw
    else:
        failures.append("runner artifact cases are missing")
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
        if case_id in seen: failures.append(f"duplicate result case: {case_id}")
        seen.add(case_id)
        case_failures, session_id = validate_case(value, expected[case_id], raw_cases.get(case_id), schema, results_path, generated_at)
        failures.extend(case_failures)
        if session_id in sessions: failures.append(f"fresh-session evidence reused: {session_id}")
        if session_id: sessions.add(session_id)
    missing = sorted(set(expected) - seen)
    if missing: failures.append(f"missing live result cases: {', '.join(missing)}")
    if set(raw_cases) != set(expected): failures.append("runner artifact case coverage differs from the corpus")
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
        cases_data, schema = validate_static_contract(args.cases.resolve(), args.schema.resolve())
        if args.contract_only:
            print(f"OK: UI design live static contract validated ({len(cases_data['cases'])} cases); live model behavior not executed")
            return 0
        if args.results is None:
            print("UNVERIFIED: no hashed fresh-session runner artifact and independently judged UI results were supplied")
            return 2
        failures = validate_results(args.results.resolve(), cases_data, schema)
    except ContractError as exc:
        return fail(str(exc))
    if failures:
        for message in failures: print(f"FAIL: {message}")
        return 1
    print(f"OK: UI design live evidence contract validated ({len(cases_data['cases'])} fresh-session cases); runner provenance remains an external trust boundary")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
