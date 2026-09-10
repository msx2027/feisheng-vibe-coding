#!/usr/bin/env python3
"""Validate execution-liveness live schemas without producing live evidence."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/execution-liveness-live-cases.json"
DEFAULT_FIXTURES = ROOT / "tests/execution-liveness-zero-origin-fixtures-v1.json"
DEFAULT_SCHEMA = ROOT / "tests/execution-liveness-live-result-schema.json"
KNOWN_GAPS = ROOT / "tests/governance/known-live-gaps-v1.json"
REQUIRED_CASES = {
    "bounded_d1_governance_burden",
    "bounded_project_audit_governance_burden",
    "discovery_batch_truncation_recovery",
    "async_handle_reaping",
    "background_command_finalization",
    "context_budget_handoff",
    "host_result_to_model_continuation",
    "user_stop_to_bounded_final",
}
FORBIDDEN_FIELDS = {
    "command",
    "cwd",
    "env",
    "environment",
    "stderr",
    "stdout",
    "transcript_path",
    "raw_response",
    "raw_tool_output",
    "tool_response",
    "full_transcript",
    "provider_key",
    "credential",
}
HOME_PATH_PATTERN = re.compile(r"(?:/Users/|/home/|/root/|[A-Za-z]:\\Users\\)", re.I)


class LivenessContractError(ValueError):
    pass


def load_object(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise LivenessContractError(f"JSON root must be an object: {path}")
    return value


def records(value: Any, *, label: str) -> dict[str, dict[str, Any]]:
    if not isinstance(value, list) or not value:
        raise LivenessContractError(f"{label} must be a non-empty list")
    result: dict[str, dict[str, Any]] = {}
    for item in value:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise LivenessContractError(f"{label} records require string ids")
        if item["id"] in result:
            raise LivenessContractError(f"{label} record ids must be unique")
        result[item["id"]] = item
    return result


def validate_zero_origin_value(value: Any, *, label: str) -> None:
    if isinstance(value, dict):
        forbidden = sorted(FORBIDDEN_FIELDS & set(value))
        if forbidden:
            raise LivenessContractError(
                f"{label} contains forbidden raw-evidence fields: {', '.join(forbidden)}"
            )
        for key, child in value.items():
            validate_zero_origin_value(child, label=f"{label}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_zero_origin_value(child, label=f"{label}[{index}]")
    elif isinstance(value, str) and HOME_PATH_PATTERN.search(value):
        raise LivenessContractError(f"{label} contains a local home path")


def validate_forbidden_fields_contract(schema: dict[str, Any]) -> None:
    forbidden_fields = schema.get("forbidden_fields")
    if (
        not isinstance(forbidden_fields, list)
        or len(forbidden_fields) != len(set(forbidden_fields))
        or set(forbidden_fields) != FORBIDDEN_FIELDS
    ):
        raise LivenessContractError(
            "result schema forbidden_fields must equal the evaluator closed set"
        )


def validate_contract(cases_path: Path, fixtures_path: Path) -> None:
    tests_root = (ROOT / "tests").resolve()
    for path, label in ((cases_path, "cases"), (fixtures_path, "fixtures")):
        try:
            path.relative_to(tests_root)
        except ValueError as exc:
            raise LivenessContractError(
                f"{label} must stay under the repository tests root"
            ) from exc
    cases_doc = load_object(cases_path)
    fixtures_doc = load_object(fixtures_path)
    schema = load_object(DEFAULT_SCHEMA)
    gaps_doc = load_object(KNOWN_GAPS)
    if cases_doc.get("evaluation_scope") != "fresh_session_host_behavior":
        raise LivenessContractError("liveness cases must preserve fresh-session scope")
    if cases_doc.get("static_contracts_are_not_live_proof") is not True:
        raise LivenessContractError("static contracts must not be represented as live proof")
    if fixtures_doc.get("evidence_classification") != "synthetic_non_identifying" or fixtures_doc.get("origin") != "zero_origin":
        raise LivenessContractError("fixtures must remain synthetic zero-origin evidence")
    validate_zero_origin_value(cases_doc, label="cases")
    validate_zero_origin_value(fixtures_doc, label="fixtures")
    cases = records(cases_doc.get("cases"), label="cases")
    fixtures = records(fixtures_doc.get("fixtures"), label="fixtures")
    if set(cases) != REQUIRED_CASES:
        raise LivenessContractError("liveness case set drifted")
    for case_id, case in cases.items():
        fixture_id = case.get("fixture_id")
        if fixture_id not in fixtures:
            raise LivenessContractError(f"{case_id} fixture binding is missing")
        if case.get("expected_source_status") != "UNVERIFIED":
            raise LivenessContractError(f"{case_id} must remain UNVERIFIED without live evidence")
    if cases["host_result_to_model_continuation"].get("host_service_boundary") is not True:
        raise LivenessContractError("Host continuation boundary must remain explicit")
    validate_forbidden_fields_contract(schema)
    gaps = records(gaps_doc.get("cases"), label="known gaps")
    missing = sorted(REQUIRED_CASES - set(gaps))
    if missing:
        raise LivenessContractError(
            "known live gaps missing execution-liveness cases: " + ", ".join(missing)
        )
    for case_id in REQUIRED_CASES:
        gap = gaps[case_id]
        if gap.get("status") != "UNVERIFIED" or gap.get("static_surrogate_forbidden") is not True:
            raise LivenessContractError(f"{case_id} must remain an honest UNVERIFIED live gap")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--fixtures", type=Path, default=DEFAULT_FIXTURES)
    parser.add_argument("--contract-only", action="store_true")
    args = parser.parse_args()
    if not args.contract_only:
        print("FAIL: this evaluator requires --contract-only until a trusted live producer exists")
        return 1
    try:
        validate_contract(args.cases.resolve(), args.fixtures.resolve())
    except (OSError, json.JSONDecodeError, LivenessContractError) as exc:
        print(f"FAIL: {exc}")
        return 1
    print("OK: execution-liveness schema and zero-origin corpus validated; live behavior remains UNVERIFIED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
