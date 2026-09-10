#!/usr/bin/env python3
"""Validate the static Task Decision corpus and proportionality invariants."""

from __future__ import annotations

import copy
import sys
import tempfile
import warnings
from pathlib import Path
from typing import Any

from runtime_decision_contract import LoadedOwnerDiagnosticWarning, validate_task_decision
from validation_support import ContractError, load_json_object


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
CASES = ROOT / "tests/task-decision-cases.json"
REQUIRED_CASE_IDS = (
    "button-spacing",
    "button-spacing-with-complex-nouns",
    "ordinary-owner-bug",
    "explicit-exclusion-preserved",
    "invalid-broad-write-crosses-explicit-exclusion",
    "cross-user-authorization-bug",
    "read-public-log",
    "read-sensitive-production-log",
    "publish-verified-artifact",
    "actual-publish-verified-artifact",
    "frontend-backend-studio",
    "d2-independent-read-only-delegation",
    "game-assets-studio",
    "overlapping-writers-resolve-boundaries",
    "foundation-change",
    "cross-owner-drift-materializes",
    "ordered-transition-materializes",
    "durable-handoff-materializes",
    "unresolved-product-stop-pairs-discovery",
    "split-required-uses-resolved-discovery",
    "invalid-audit-delivery-on-implement-operation",
    "invalid-d0-new-semantic-judgment",
    "invalid-d0-subagent-delegation",
    "invalid-d2-without-joint-contract",
    "invalid-d3-ordinary-order",
    "invalid-protected-implementation-t0",
    "invalid-route-delivery-mismatch",
    "invalid-satisfied-without-granted-tier",
    "invalid-loaded-owner-id",
    "invalid-null-resolved-operation",
    "invalid-unknown-risk-lane",
    "invalid-evidence-union",
    "invalid-low-authorization",
    "invalid-publish-underclaimed-as-external-write",
    "invalid-d1-two-owners",
    "invalid-resolved-d1-unstable-contract",
    "invalid-shared-writer-hidden-as-no-recommendation",
    "invalid-studio-shared-writer",
    "invalid-studio-missing-host-capability",
    "invalid-studio-missing-environment-isolation",
    "invalid-studio-missing-independent-acceptance",
    "invalid-studio-missing-integration-gate",
    "invalid-studio-missing-coordination-benefit",
    "invalid-small-task-stage",
    "invalid-d2-stable-joint-stage-without-trigger",
    "invalid-d3-foundation-stage-without-trigger",
    "invalid-d3-single-owner-unstable-stage",
    "invalid-d3-single-owner-durable-handoff-stage",
    "invalid-d3-multi-owner-handoff-without-joint-contract",
    "executable-governance-plan-materializes",
    "executable-governance-plan-ready-to-write",
    "executable-governance-plan-materialized-next-action",
    "invalid-ready-to-write-with-planned-evidence",
    "invalid-plan-artifact-read-only-action",
    "invalid-plan-artifact-owner-omitted",
    "invalid-temporary-plan-without-stable-task-identity",
    "invalid-plan-stage-owner-mismatch",
    "implementation-plan-pending-review-preserves-test-evidence",
    "implementation-plan-ready-with-no-blocking-review",
    "cross-session-host-durable-plan",
    "invalid-temporary-plan-claiming-cross-session-persistence",
    "invalid-task-owned-plan-without-host-context",
    "invalid-task-owned-plan-outside-host-root",
    "invalid-pending-review-with-closed-plan-review",
    "invalid-collected-plan-review-omits-known-blocker",
    "invalid-collected-plan-review-forges-review-ref",
    "invalid-active-internal-plan-without-established-owner-context",
    "invalid-explicit-plan-without-external-path-authorization",
    "invalid-protected-direct-artifact-t0",
    "invalid-protected-direct-artifact-route-write",
    "persistent-sample-write-requires-critical-operation",
    "invalid-persistent-sample-write-underclaimed",
    "invalid-missing-evidence-status",
    "invalid-unresolved-product-discovery-mismatch",
    "truth-capture-not-needed-stays-inline",
    "truth-capture-create-new-waits-for-card",
    "truth-capture-confirmed-card-writes-feature-doc",
    "truth-capture-confirmed-card-writes-adr",
    "truth-capture-confirmed-update-edits-existing-owner",
    "truth-capture-deferred-blocks-silent-next-batch",
    "invalid-truth-doc-write-without-confirmed-card",
    "invalid-truth-doc-write-without-capture-block",
    "invalid-existing-truth-edited-before-card",
    "invalid-new-truth-doc-disguised-as-local-edit",
    "invalid-truth-capture-on-d0",
    "invalid-truth-capture-owner-omitted",
    "code-audit-triage-writes-report-by-default",
    "code-audit-report-write-uses-audit-artifact",
    "code-audit-closed-promotes-unresolved-findings",
    "code-audit-closed-clean-needs-no-promotion",
    "invalid-audit-artifact-without-materialize-audit",
    "invalid-materialize-audit-on-implementation",
    "invalid-audit-report-edits-source",
    "invalid-closed-audit-drops-unresolved-findings",
    "invalid-audit-promoted-to-itself",
    "invalid-audit-owner-omitted",
    "truth-capture-supersede-creates-new-adr",
    "invalid-supersede-without-confirmed-card",
    "code-audit-reviewed-pending-promotion",
    "invalid-pending-audit-claims-promotion",
    "code-audit-bounded-index-write",
    "invalid-audit-index-target-outside-report-directory",
    "invalid-supersede-disguised-as-local-edit",
    "invalid-audit-index-omitted-from-scope",
    "invalid-audit-index-excluded-by-user",
)
REQUIRED_METAMORPHIC_PAIRS = (
    (
        "button-spacing",
        "button-spacing-with-complex-nouns",
        ("task_depth", "risk_lanes", "materialize_stage", "studio_decision"),
        (),
    ),
    (
        "ordinary-owner-bug",
        "cross-user-authorization-bug",
        ("task_depth", "materialize_stage", "effect.required_tier"),
        ("risk_lanes",),
    ),
    (
        "read-public-log",
        "read-sensitive-production-log",
        ("task_depth", "effect.effect_class", "materialize_stage"),
        ("risk_lanes",),
    ),
    (
        "frontend-backend-studio",
        "game-assets-studio",
        ("task_depth", "studio_decision", "owner_topology.contracts_stable"),
        (),
    ),
    (
        "truth-capture-confirmed-card-writes-feature-doc",
        "truth-capture-confirmed-card-writes-adr",
        (
            "task_depth",
            "effect.action",
            "effect.required_tier",
            "truth_capture.decision",
            "truth_capture.authorization_status",
        ),
        (),
    ),
)


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def set_path(target: dict[str, Any], path: str, value: Any) -> None:
    parts = path.split(".")
    current = target
    for part in parts[:-1]:
        child = current.get(part)
        if not isinstance(child, dict):
            raise ContractError(f"override path is not an object: {path}")
        current = child
    current[parts[-1]] = value


def get_path(target: dict[str, Any], path: str) -> Any:
    current: Any = target
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise ContractError(f"assertion path is missing: {path}")
        current = current[part]
    return current


def materialize(base: dict[str, Any], patch: Any) -> dict[str, Any]:
    if not isinstance(patch, dict):
        raise ContractError("case patch must be an object")
    result = copy.deepcopy(base)
    for path, value in patch.items():
        set_path(result, path, value)
    return result


def main() -> None:
    try:
        data = load_json_object(CASES)
        if data.get("schema") != "sliver-task-decision-cases/v1":
            raise ContractError("unsupported Task Decision case schema")
        if data.get("evaluation_scope") != "static_contract_and_metamorphic":
            raise ContractError("Task Decision cases must declare static contract scope")
        if data.get("static_results_are_not_fresh_session_proof") is not True:
            raise ContractError("static/live evidence boundary is missing")
        base = data.get("base_decision")
        if not isinstance(base, dict):
            raise ContractError("base_decision must be an object")

        cases = data.get("cases")
        if not isinstance(cases, list):
            raise ContractError("Task Decision cases must be a list")
        case_ids = tuple(raw.get("id") for raw in cases if isinstance(raw, dict))
        if case_ids != REQUIRED_CASE_IDS:
            raise ContractError("Task Decision corpus IDs or order drifted")
        materialized: dict[str, dict[str, Any]] = {}
        invalid_count = 0
        owner_load_warning_count = 0
        for index, raw in enumerate(cases):
            if not isinstance(raw, dict):
                raise ContractError(f"case {index} must be an object")
            case_id = raw.get("id")
            if not isinstance(case_id, str) or not case_id:
                raise ContractError(f"case {index} id must be a non-empty string")
            if case_id in materialized:
                raise ContractError(f"duplicate case id: {case_id}")
            decision = materialize(base, raw.get("patch", {}))
            host_context = raw.get("host_context", {})
            if not isinstance(host_context, dict) or set(host_context) - {
                "host_task_identity",
                "host_task_temp_root",
                "host_task_durable_root",
                "authorized_explicit_plan_target",
                "established_plan_target",
                "expected_blocking_review_refs",
                "expected_excluded_targets",
            }:
                raise ContractError(f"{case_id} host_context fields drifted")
            expected = raw.get("expected")
            if expected == "valid":
                with warnings.catch_warnings(record=True) as caught:
                    warnings.simplefilter("always", LoadedOwnerDiagnosticWarning)
                    validate_task_decision(decision, **host_context)
                owner_load_warning_count += sum(
                    issubclass(item.category, LoadedOwnerDiagnosticWarning)
                    for item in caught
                )
                materialized[case_id] = decision
            elif expected == "invalid":
                invalid_count += 1
                try:
                    validate_task_decision(decision, **host_context)
                except ContractError as exc:
                    expected_error = raw.get("error_contains")
                    if not isinstance(expected_error, str) or expected_error not in str(exc):
                        raise ContractError(
                            f"{case_id} failed for the wrong reason: {exc}"
                        ) from exc
                else:
                    raise ContractError(f"{case_id} unexpectedly passed")
            else:
                raise ContractError(f"{case_id} expected must be valid or invalid")

        pairs = data.get("metamorphic_pairs")
        if not isinstance(pairs, list):
            raise ContractError("Task Decision metamorphic_pairs must be a list")
        normalized_pairs = tuple(
            (
                pair.get("left"),
                pair.get("right"),
                tuple(pair.get("same_fields", [])),
                tuple(pair.get("different_fields", [])),
            )
            for pair in pairs
            if isinstance(pair, dict)
        )
        if normalized_pairs != REQUIRED_METAMORPHIC_PAIRS:
            raise ContractError("Task Decision metamorphic pair contract drifted")
        for index, pair in enumerate(pairs):
            if not isinstance(pair, dict):
                raise ContractError(f"metamorphic pair {index} must be an object")
            left_id = pair.get("left")
            right_id = pair.get("right")
            if left_id not in materialized or right_id not in materialized:
                raise ContractError(f"metamorphic pair references a non-valid case: {left_id}/{right_id}")
            left = materialized[left_id]
            right = materialized[right_id]
            same_fields = pair.get("same_fields")
            different_fields = pair.get("different_fields", [])
            if not isinstance(same_fields, list) or not same_fields:
                raise ContractError(f"metamorphic pair {index} needs same_fields")
            if not isinstance(different_fields, list):
                raise ContractError(f"metamorphic pair {index} different_fields must be a list")
            for path in same_fields:
                if get_path(left, path) != get_path(right, path):
                    raise ContractError(
                        f"metamorphic pair {left_id}/{right_id} changed invariant field {path}"
                    )
            for path in different_fields:
                if get_path(left, path) == get_path(right, path):
                    raise ContractError(
                        f"metamorphic pair {left_id}/{right_id} did not change field {path}"
                    )

        diagnostic_decision = copy.deepcopy(base)
        diagnostic_decision["loaded_owner_ids"].append("risk_control")
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always", LoadedOwnerDiagnosticWarning)
            validate_task_decision(diagnostic_decision)
        diagnostic_warnings = [
            item
            for item in caught
            if issubclass(item.category, LoadedOwnerDiagnosticWarning)
        ]
        if len(diagnostic_warnings) != 1 or "risk_control" not in str(
            diagnostic_warnings[0].message
        ):
            raise ContractError(
                "extra loaded_owner_ids must produce one diagnostic warning without failing"
            )

        with tempfile.TemporaryDirectory(prefix="sliver-plan-root-") as raw:
            real_root = Path(raw) / "real"
            real_root.mkdir()
            symlink_root = Path(raw) / "linked"
            symlink_root.symlink_to(real_root, target_is_directory=True)
            symlink_decision = copy.deepcopy(
                materialized["executable-governance-plan-ready-to-write"]
            )
            symlink_decision["plan_task_identity"] = "symlink-root"
            symlink_decision["plan_target"] = str(
                symlink_root / "sliver-plan-symlink-root.md"
            )
            symlink_decision["effect"]["exact_target"] = symlink_decision[
                "plan_target"
            ]
            try:
                validate_task_decision(
                    symlink_decision,
                    host_task_identity="symlink-root",
                    host_task_temp_root=str(symlink_root),
                )
            except ContractError as exc:
                if "must not traverse a symlink" not in str(exc):
                    raise ContractError(
                        f"symlink task root failed for the wrong reason: {exc}"
                    ) from exc
            else:
                raise ContractError("symlink task root unexpectedly passed")
    except (ContractError, OSError, ValueError) as exc:
        fail(str(exc))

    print(
        f"OK: Task Decision contract validated "
        f"({len(cases)} cases, {invalid_count} negative, {len(pairs)} metamorphic pairs, "
        f"{owner_load_warning_count} canonical owner-load warnings); "
        "fresh-session behavior not evaluated"
    )


if __name__ == "__main__":
    main()
