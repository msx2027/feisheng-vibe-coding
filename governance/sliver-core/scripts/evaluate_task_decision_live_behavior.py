#!/usr/bin/env python3
"""Validate Task Decision fresh-session case contracts or supplied run results."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from runtime_identity import (
    RuntimeIdentityError,
    source_revision,
    source_runtime_digest,
)
from live_evidence_isolation import validate_isolation_manifest
from runtime_decision_contract import validate_task_decision
from validation_support import (
    ContractError,
    load_json_object,
    read_utf8,
    require_fields,
    require_prompt,
)


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/task-decision-live-cases.json"
DEFAULT_SCHEMA = ROOT / "tests/task-decision-live-result-schema.json"
MAX_CLOCK_SKEW = timedelta(minutes=5)
MAX_RESULT_AGE = timedelta(days=7)
REQUIRED_LIVE_CASE_IDS = (
    "button-spacing",
    "button-spacing-complex-nouns",
    "ordinary-bug",
    "explicit-exclusion-preserved",
    "bounded-source-presence-check",
    "cross-user-auth-bug",
    "public-log-read",
    "sensitive-log-read",
    "publish-verified-artifact",
    "build-green-real-funds-unverified",
    "executable-governance-plan",
    "frontend-backend-studio",
    "game-pipeline-studio",
    "proactive-studio-without-naming",
    "single-module-no-studio",
    "overlapping-writers-stop",
    "long-discussion-truth-capture-card",
    "selection-decision-goes-to-adr",
)
REQUIRED_LIVE_PAIRS = (
    (
        "button-spacing",
        "button-spacing-complex-nouns",
        ("task_depth", "risk_lanes", "materialize_stage", "studio_decision"),
    ),
    (
        "ordinary-bug",
        "cross-user-auth-bug",
        ("task_depth", "studio_decision", "effect.required_tier"),
    ),
    (
        "public-log-read",
        "sensitive-log-read",
        ("task_depth", "effect.effect_class"),
    ),
    (
        "frontend-backend-studio",
        "game-pipeline-studio",
        ("task_depth", "studio_decision"),
    ),
    (
        "frontend-backend-studio",
        "proactive-studio-without-naming",
        ("task_depth", "studio_decision"),
    ),
    (
        "long-discussion-truth-capture-card",
        "selection-decision-goes-to-adr",
        ("primary_route", "truth_capture.decision"),
    ),
)


def require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be an object")
    return value


def require_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"{label} must be a non-empty string")
    return value.strip()


def require_datetime(value: Any, label: str) -> datetime:
    raw = require_string(value, label)
    normalized = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
    try:
        result = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ContractError(f"{label} must be an ISO-8601 datetime") from exc
    if result.tzinfo is None:
        raise ContractError(f"{label} must include a timezone")
    return result.astimezone(timezone.utc)


def get_path(value: dict[str, Any], path: str) -> Any:
    current: Any = value
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise ContractError(f"result is missing expected field: {path}")
        current = current[part]
    return current


def validate_static(cases_path: Path, schema_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    cases = load_json_object(cases_path)
    schema = load_json_object(schema_path)
    if cases.get("schema") != "sliver-task-decision-live-cases/v1":
        raise ContractError("unsupported task-decision live case schema")
    if cases.get("evaluation_scope") != "fresh_session_model_behavior":
        raise ContractError("live cases must declare fresh-session behavior scope")
    if cases.get("requires_live_model_validation") is not True:
        raise ContractError("live cases must require live model validation")
    if cases.get("static_contracts_are_not_live_proof") is not True:
        raise ContractError("static/live proof boundary is missing")
    if schema.get("schema") != "sliver-task-decision-live-results/v2":
        raise ContractError("unsupported task-decision live result schema")
    if schema.get("required_top_level") != [
        "schema",
        "run_id",
        "skill_version",
        "runtime_target",
        "runtime_digest",
        "host",
        "model",
        "generated_at",
        "fresh_session",
        "source_revision",
        "runner_isolation",
        "cases",
    ]:
        raise ContractError("task-decision result top-level contract drifted")
    if schema.get("required_case_fields") != [
        "id",
        "thread_id",
        "host_id",
        "started_at",
        "ended_at",
        "case_prompt",
        "initial_user",
        "raw_result_path",
        "decision",
    ]:
        raise ContractError("task-decision result case contract drifted")

    raw_cases = cases.get("cases")
    if not isinstance(raw_cases, list):
        raise ContractError("task-decision live cases must be a list")
    if tuple(
        raw.get("id") for raw in raw_cases if isinstance(raw, dict)
    ) != REQUIRED_LIVE_CASE_IDS:
        raise ContractError("task-decision live corpus IDs or order drifted")
    ids: set[str] = set()
    prompts: set[str] = set()
    for index, raw in enumerate(raw_cases):
        case = require_object(raw, f"case {index}")
        case_id = require_string(case.get("id"), f"case {index} id")
        prompt = require_prompt(case.get("prompt"), label=f"{case_id} prompt")
        context = require_object(case.get("context"), f"{case_id} context")
        expected = require_object(case.get("expected"), f"{case_id} expected")
        if not context or not expected:
            raise ContractError(f"{case_id} context and expected must not be empty")
        if case_id in ids or prompt in prompts:
            raise ContractError(f"duplicate live case id or prompt: {case_id}")
        ids.add(case_id)
        prompts.add(prompt)

    pairs = cases.get("metamorphic_pairs")
    if not isinstance(pairs, list):
        raise ContractError("task-decision live metamorphic_pairs must be a list")
    normalized_pairs = tuple(
        (
            pair.get("left"),
            pair.get("right"),
            tuple(pair.get("same_fields", [])),
        )
        for pair in pairs
        if isinstance(pair, dict)
    )
    if normalized_pairs != REQUIRED_LIVE_PAIRS:
        raise ContractError("task-decision live metamorphic pair contract drifted")
    for index, pair_raw in enumerate(pairs):
        pair = require_object(pair_raw, f"pair {index}")
        if pair.get("left") not in ids or pair.get("right") not in ids:
            raise ContractError(f"pair {index} references an unknown case")
        fields = pair.get("same_fields")
        if not isinstance(fields, list) or not fields:
            raise ContractError(f"pair {index} must define same_fields")
    return cases, schema


def safe_raw_result(results_path: Path, relative: str) -> Path:
    base = results_path.resolve().parent
    candidate = (base / relative).resolve()
    try:
        candidate.relative_to(base)
    except ValueError as exc:
        raise ContractError("raw_result_path must stay beside or below results") from exc
    if candidate == results_path.resolve() or not candidate.is_file():
        raise ContractError(f"raw result does not exist: {relative}")
    return candidate


def validate_results(cases: dict[str, Any], schema: dict[str, Any], results_path: Path) -> None:
    results = load_json_object(results_path)
    if results.get("schema") != schema.get("schema"):
        raise ContractError("result schema does not match the live contract")
    require_fields(results, schema["required_top_level"], label="results")
    for field in ("run_id", "runtime_target", "host", "model", "source_revision"):
        require_string(results.get(field), field)
    if results.get("skill_version") != read_utf8(ROOT / "VERSION").strip():
        raise ContractError("skill_version must exactly match VERSION")
    if results.get("fresh_session") is not True:
        raise ContractError("Task Decision live results must come from fresh tasks")
    generated_at = require_datetime(results.get("generated_at"), "generated_at")
    if generated_at > datetime.now(timezone.utc) + MAX_CLOCK_SKEW:
        raise ContractError("generated_at is in the future")
    if generated_at < datetime.now(timezone.utc) - MAX_RESULT_AGE:
        raise ContractError("generated_at is older than the 7-day live evidence window")
    runtime_target = require_string(results.get("runtime_target"), "runtime_target")
    try:
        expected_digest = source_runtime_digest(ROOT, runtime_target)
        expected_revision = source_revision(ROOT)
    except RuntimeIdentityError as exc:
        raise ContractError(f"candidate identity is unavailable: {exc}") from exc
    if results.get("runtime_digest") != expected_digest:
        raise ContractError("runtime_digest does not match the exact runtime candidate")
    if results.get("source_revision") != expected_revision:
        raise ContractError("source_revision does not match the exact source candidate")
    validate_isolation_manifest(
        results.get("runner_isolation"),
        source_revision=expected_revision,
        runtime_target=runtime_target,
        runtime_digest=expected_digest,
    )

    raw_results = results.get("cases")
    if not isinstance(raw_results, list):
        raise ContractError("results.cases must be a list")
    by_id: dict[str, dict[str, Any]] = {}
    decisions: dict[str, dict[str, Any]] = {}
    thread_ids: set[str] = set()
    raw_paths: set[Path] = set()
    expected_cases = {case["id"]: case for case in cases["cases"]}
    for index, raw in enumerate(raw_results):
        result = require_object(raw, f"result {index}")
        require_fields(result, schema["required_case_fields"], label=f"result {index}")
        case_id = require_string(result.get("id"), f"result {index} id")
        if case_id in by_id:
            raise ContractError(f"duplicate result id: {case_id}")
        if case_id not in expected_cases:
            raise ContractError(f"unknown result id: {case_id}")
        thread_id = require_string(result.get("thread_id"), f"{case_id} thread_id")
        if thread_id in thread_ids:
            raise ContractError(f"fresh task identifier reused: {thread_id}")
        thread_ids.add(thread_id)
        host_id = require_string(result.get("host_id"), f"{case_id} host_id")
        if host_id != results.get("host"):
            raise ContractError(f"{case_id} host_id differs from the result host")
        started_at = require_datetime(result.get("started_at"), f"{case_id} started_at")
        ended_at = require_datetime(result.get("ended_at"), f"{case_id} ended_at")
        if ended_at < started_at or ended_at > generated_at + MAX_CLOCK_SKEW:
            raise ContractError(f"{case_id} task timestamps are inconsistent")
        case_prompt = require_string(result.get("case_prompt"), f"{case_id} case_prompt")
        if case_prompt != expected_cases[case_id]["prompt"]:
            raise ContractError(f"{case_id} case_prompt differs from the live corpus")
        initial_user = require_string(result.get("initial_user"), f"{case_id} initial_user")
        if case_prompt not in initial_user:
            raise ContractError(f"{case_id} initial_user omits the contracted case prompt")
        raw_path = require_string(result.get("raw_result_path"), f"{case_id} raw_result_path")
        raw_file = safe_raw_result(results_path, raw_path)
        if raw_file in raw_paths:
            raise ContractError(f"raw result path reused: {raw_path}")
        raw_paths.add(raw_file)
        decision = require_object(result.get("decision"), f"{case_id} decision")
        host_validation_context = result.get("host_validation_context")
        expected_scope_context = expected_cases[case_id].get("context", {}).get(
            "expected_excluded_targets"
        )
        if decision.get("materialize_plan") is True or expected_scope_context is not None:
            context = require_object(
                host_validation_context,
                f"{case_id} host_validation_context",
            )
            allowed_context_fields = {
                "host_task_identity",
                "host_task_temp_root",
                "host_task_durable_root",
                "authorized_explicit_plan_target",
                "established_plan_target",
                "expected_blocking_review_refs",
                "expected_excluded_targets",
            }
            if set(context) - allowed_context_fields:
                raise ContractError(
                    f"{case_id} host_validation_context fields drifted"
                )
            if (
                decision.get("plan_target_kind") in {"task_temporary", "task_durable"}
                and context.get("host_task_identity") != thread_id
            ):
                raise ContractError(
                    f"{case_id} host task identity must equal its fresh task identifier"
                )
            if expected_scope_context is not None and context.get(
                "expected_excluded_targets"
            ) != expected_scope_context:
                raise ContractError(
                    f"{case_id} host exclusions differ from the live case contract"
                )
            validate_task_decision(decision, **context)
        else:
            if host_validation_context is not None:
                raise ContractError(
                    f"{case_id} host_validation_context is only valid for a materialized plan or trusted scope exclusions"
                )
            validate_task_decision(decision)
        try:
            direct_output = json.loads(read_utf8(raw_file))
        except json.JSONDecodeError as exc:
            raise ContractError(f"{case_id} raw result is not a JSON object") from exc
        if not isinstance(direct_output, dict) or direct_output != decision:
            raise ContractError(f"{case_id} decision differs from its raw result")
        by_id[case_id] = result
        decisions[case_id] = decision

    if set(by_id) != set(expected_cases):
        raise ContractError("result case IDs must exactly match the live corpus")
    for case_id, case in expected_cases.items():
        decision = decisions[case_id]
        for path, expected in case["expected"].items():
            actual = get_path(decision, path)
            if actual != expected:
                raise ContractError(
                    f"{case_id} expected {path}={expected!r}, got {actual!r}"
                )
    for pair in cases["metamorphic_pairs"]:
        left = decisions[pair["left"]]
        right = decisions[pair["right"]]
        for path in pair["same_fields"]:
            if get_path(left, path) != get_path(right, path):
                raise ContractError(
                    f"{pair['left']}/{pair['right']} changed invariant field {path}"
                )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--schema", type=Path, default=DEFAULT_SCHEMA)
    parser.add_argument("--results", type=Path)
    parser.add_argument("--contract-only", action="store_true")
    args = parser.parse_args()
    if args.contract_only and args.results is not None:
        print("FAIL: choose exactly one of --contract-only or --results")
        return 2
    try:
        cases, schema = validate_static(args.cases, args.schema)
        if args.contract_only:
            print(
                f"OK: Task Decision live static contract validated "
                f"({len(cases['cases'])} cases); fresh-session behavior not executed"
            )
            return 0
        if args.results is None:
            print(
                "UNVERIFIED: Task Decision live behavior has versioned cases and an "
                "evidence schema, but no fresh-session results were supplied"
            )
            return 2
        validate_results(cases, schema, args.results)
    except (ContractError, OSError, json.JSONDecodeError) as exc:
        print(f"FAIL: {exc}")
        return 1
    print(
        f"OK: recorded Task Decision fresh-session results validated "
        f"({len(cases['cases'])} cases)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
