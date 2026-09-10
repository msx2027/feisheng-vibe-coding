#!/usr/bin/env python3
"""Compare current capability records with the immutable governance baseline."""

from __future__ import annotations

import argparse
import ast
import json
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any

from git_revision import is_full_lowercase_git_commit
from governance_route_projection import parse_governance_route_projection


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "tests/governance/capability-registry-v1.json"
SCHEMA = "sliver-capability-registry/v1"
EXPECTED_SOURCES = (
    ("route-contracts", "tests/route-eval-cases.json", "json_records", "cases", "name"),
    ("route-operation-delivery-projection", "references/routes-index.md", "route_projection", None, None),
    ("selector-families", "tests/selector-pressure-cases.json", "json_records", "families", "name"),
    ("execution-contracts", "tests/execution-backbone-cases.json", "json_records", "pressure_cases", "name"),
    ("task-decision-contracts", "tests/task-decision-cases.json", "json_records", "cases", "id"),
    ("task-decision-live", "tests/task-decision-live-cases.json", "json_records", "cases", "id"),
    ("ui-lifecycle-contracts", "tests/ui-design-lifecycle-cases.json", "json_records", "cases", "name"),
    ("ui-live-contracts", "tests/ui-design-live-behavior-cases.json", "json_records", "cases", "id"),
    ("foundation-live-contracts", "tests/foundation-live-behavior-cases.json", "json_records", "cases", "id"),
    ("studio-live-contracts", "tests/studio-live-behavior-cases.json", "json_records", "cases", "id"),
    ("stage-v2-contracts", "scripts/test_stage_v2_contracts.py", "python_unittest", None, None),
    ("governance-semantic-projection-contracts", "scripts/test_governance_semantic_projection_contracts.py", "python_unittest", None, None),
    ("validation-contracts", "scripts/test_validation_contracts.py", "python_unittest", None, None),
    ("private-risk-scan-contracts", "scripts/test_private_risk_scan_contracts.py", "python_unittest", None, None),
    ("runtime-governance-contracts", "scripts/test_runtime_governance_contracts.py", "python_unittest", None, None),
    ("governance-static-mutations", "tests/governance/static-mutation-cases-v1.json", "json_records", "mutations", "id"),
    ("governance-meta-mutations", "tests/governance/collusion-mutation-cases-v1.json", "json_records", "cases", "id"),
    ("governance-mutation-contracts", "scripts/test_governance_mutation_contracts.py", "python_unittest", None, None),
    ("runtime-safety-contracts", "scripts/test_runtime_bundle_safety.py", "python_unittest", None, None),
    ("release-isolation-contracts", "scripts/test_release_candidate_contracts.py", "python_unittest", None, None),
    ("known-live-gap-contracts", "tests/governance/known-live-gaps-v1.json", "json_records", "cases", "id"),
    ("execution-liveness-live-contracts", "tests/execution-liveness-live-cases.json", "json_records", "cases", "id"),
)
EXPECTED_SOURCE_IDS = tuple(item[0] for item in EXPECTED_SOURCES)
INTRODUCED_AFTER_BASELINE = frozenset(EXPECTED_SOURCE_IDS[10:])


class CapabilityBaselineError(ValueError):
    """Raised when the candidate retires or silently changes a baseline capability."""


def _normalized_path(value: Any, *, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise CapabilityBaselineError(f"{label} must be a non-empty string")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or path.as_posix() != value:
        raise CapabilityBaselineError(f"{label} must be repository-relative")
    return value


def _load_json_bytes(raw: bytes, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CapabilityBaselineError(f"{label} is invalid JSON") from exc
    if not isinstance(value, dict):
        raise CapabilityBaselineError(f"{label} must be an object")
    return value


def load_registry(path: Path) -> dict[str, Any]:
    try:
        registry = _load_json_bytes(path.read_bytes(), label="capability registry")
    except OSError as exc:
        raise CapabilityBaselineError(f"capability registry is unreadable: {path}") from exc
    if set(registry) != {"schema", "baseline_manifest", "sources"}:
        raise CapabilityBaselineError("capability registry fields drifted")
    if registry.get("schema") != SCHEMA:
        raise CapabilityBaselineError("capability registry schema is unsupported")
    _normalized_path(registry.get("baseline_manifest"), label="baseline_manifest")
    sources = registry.get("sources")
    if not isinstance(sources, list) or not sources:
        raise CapabilityBaselineError("capability registry sources must be non-empty")
    ids: list[str] = []
    for index, source in enumerate(sources):
        if not isinstance(source, dict):
            raise CapabilityBaselineError(f"capability source {index} fields drifted")
        kind = source.get("kind")
        expected_fields = {"id", "path", "kind", "release_blocking"}
        if kind == "json_records":
            expected_fields |= {"collection", "id_field"}
        if set(source) != expected_fields:
            raise CapabilityBaselineError(f"capability source {index} fields drifted")
        source_id = source.get("id")
        if not isinstance(source_id, str) or not source_id:
            raise CapabilityBaselineError(f"capability source {index} id is invalid")
        ids.append(source_id)
        _normalized_path(source.get("path"), label=f"{source_id} path")
        if kind not in {"json_records", "python_unittest", "route_projection"}:
            raise CapabilityBaselineError(f"{source_id} kind is unsupported")
        if kind == "json_records":
            if source.get("collection") not in {
                "cases",
                "families",
                "pressure_cases",
                "mutations",
            }:
                raise CapabilityBaselineError(f"{source_id} collection is unsupported")
            if source.get("id_field") not in {"id", "name"}:
                raise CapabilityBaselineError(f"{source_id} id_field is unsupported")
        if source.get("release_blocking") is not True:
            raise CapabilityBaselineError(f"{source_id} must remain release blocking")
    if tuple(ids) != EXPECTED_SOURCE_IDS:
        raise CapabilityBaselineError("capability source IDs or order drifted")
    actual_specs = tuple(
        (
            source["id"],
            source["path"],
            source["kind"],
            source.get("collection"),
            source.get("id_field"),
        )
        for source in sources
    )
    if actual_specs != EXPECTED_SOURCES:
        raise CapabilityBaselineError("capability source specifications drifted")
    return registry


def _git_bytes(root: Path, revision: str, relative: str, *, allow_absent: bool) -> bytes | None:
    result = subprocess.run(
        ["git", "show", f"{revision}:{relative}"],
        cwd=root,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        if allow_absent:
            return None
        raise CapabilityBaselineError(
            f"baseline Git object is unavailable: {revision}:{relative}"
        )
    return result.stdout


def _json_records(data: dict[str, Any], source: dict[str, Any], *, label: str) -> dict[str, Any]:
    values = data.get(source["collection"])
    if not isinstance(values, list):
        raise CapabilityBaselineError(f"{label} collection is missing")
    records: dict[str, Any] = {}
    for index, value in enumerate(values):
        if not isinstance(value, dict):
            raise CapabilityBaselineError(f"{label} record {index} must be an object")
        record_id = value.get(source["id_field"])
        if not isinstance(record_id, str) or not record_id or record_id in records:
            raise CapabilityBaselineError(f"{label} record IDs are invalid or duplicated")
        records[record_id] = value
    return records


def _python_unittest_records(raw: bytes, *, label: str) -> dict[str, str]:
    try:
        tree = ast.parse(raw.decode("utf-8"))
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise CapabilityBaselineError(f"{label} is invalid Python") from exc
    records: dict[str, str] = {}
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        for child in node.body:
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name.startswith(
                "test_"
            ):
                record_id = f"{node.name}.{child.name}"
                if record_id in records:
                    raise CapabilityBaselineError(f"{label} test IDs are duplicated")
                records[record_id] = ast.dump(child, include_attributes=False)
    if not records:
        raise CapabilityBaselineError(f"{label} has no unittest capabilities")
    return records


def _records(raw: bytes, source: dict[str, Any], *, label: str) -> dict[str, Any]:
    if source["kind"] == "python_unittest":
        return _python_unittest_records(raw, label=label)
    if source["kind"] == "route_projection":
        try:
            matrix = parse_governance_route_projection(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError) as exc:
            raise CapabilityBaselineError(f"{label} route projection is invalid") from exc
        return {
            f"{route}/{operation}": list(deliveries)
            for route, operations in matrix.items()
            for operation, deliveries in operations.items()
        }
    return _json_records(_load_json_bytes(raw, label=label), source, label=label)


def compare_registry(root: Path, registry: dict[str, Any]) -> dict[str, dict[str, list[str]]]:
    baseline_path = root / registry["baseline_manifest"]
    baseline_manifest = _load_json_bytes(
        baseline_path.read_bytes(),
        label="governance baseline manifest",
    )
    revision = baseline_manifest.get("source_commit")
    if not is_full_lowercase_git_commit(revision):
        raise CapabilityBaselineError(
            "source_commit must be a full lowercase Git commit"
        )

    matrix: dict[str, dict[str, list[str]]] = {}
    for source in registry["sources"]:
        relative = source["path"]
        baseline_raw = _git_bytes(
            root, revision, relative,
            allow_absent=source["id"] in INTRODUCED_AFTER_BASELINE,
        )
        baseline = (
            {}
            if baseline_raw is None
            else _records(baseline_raw, source, label=f"baseline {source['id']}")
        )
        current = _records(
            (root / relative).read_bytes(),
            source,
            label=f"current {source['id']}",
        )
        baseline_ids = set(baseline)
        current_ids = set(current)
        retired = sorted(baseline_ids - current_ids)
        changed = sorted(
            record_id
            for record_id in baseline_ids & current_ids
            if baseline[record_id] != current[record_id]
        )
        if retired:
            raise CapabilityBaselineError(
                f"{source['id']} retired baseline capabilities: {', '.join(retired)}"
            )
        if changed:
            raise CapabilityBaselineError(
                f"{source['id']} capability change lacks trusted external baseline promotion: "
                + ", ".join(changed)
            )
        matrix[source["id"]] = {
            "preserved": sorted(baseline_ids - set(changed)),
            "changed": changed,
            "added": sorted(current_ids - baseline_ids),
            "retired": retired,
        }
    return matrix


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    args = parser.parse_args()
    try:
        root = args.source_root.resolve()
        registry = load_registry(args.registry.resolve())
        matrix = compare_registry(root, registry)
    except (CapabilityBaselineError, OSError, subprocess.SubprocessError) as exc:
        print(f"FAIL: {exc}")
        return 1
    preserved = sum(len(result["preserved"]) for result in matrix.values())
    changed = sum(len(result["changed"]) for result in matrix.values())
    added = sum(len(result["added"]) for result in matrix.values())
    print(
        "OK: capability baseline comparison passed "
        f"(preserved={preserved}, changed={changed}, added={added}, retired=0)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
