#!/usr/bin/env python3
"""Compare executable governance semantics with an immutable Git baseline."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any, Iterable, Optional

from git_revision import is_full_lowercase_git_commit
from governance_route_projection import parse_governance_route_projection


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASELINE = ROOT / "tests/governance/baseline-29695fe.json"

PYTHON_SYMBOLS = {
    "scripts/runtime_decision_contract.py": (
        "PLAN_TARGET_KINDS",
        "DECISION_STATUSES",
        "DELIVERY_KINDS",
        "TASK_DEPTHS",
        "DEPTH_RULES",
        "RISK_LANE_IDS",
        "EVIDENCE_MODES",
        "TEST_LEVELS",
        "ROUTE_EVIDENCE_KINDS",
        "EVIDENCE_STATUSES",
        "EFFECT_CLASSES",
        "AUTHORIZATION_TIERS",
        "AUTHORIZATION_STATUSES",
        "OPERATIONAL_MODES",
        "DISCOVERY_OUTCOMES",
        "STUDIO_DECISIONS",
        "DELEGATION_DECISIONS",
        "LOADED_OWNER_IDS",
        "TEST_DELIVERIES",
        "ROUTE_DELIVERY_TO_EVIDENCE",
        "ACTION_MINIMUM_TIERS",
        "TIER_ORDER",
    ),
    "scripts/stage_contract.py": (
        "STAGE_SCHEMA",
        "STAGE_GATES",
        "TASK_DEPTHS",
        "MATERIALIZATION_TRIGGERS",
        "RESULT_STATUSES",
        "TRUTH_WRITEBACK_STATES",
        "MIGRATION_STATES",
        "SCOPE_AUTHORIZATION_STATUSES",
        "PRODUCT_DECISION_STATUSES",
        "RESEARCH_STATUSES",
        "STAGE_CONTROL_FIELDS",
        "CLOSEOUT_FIELDS",
    ),
    "scripts/runtime_governance_contract.py": (
        "TRUTH_SCHEMA",
        "FORMAL_SCHEMA",
        "DELIVERY_SHAPE_SCHEMA",
        "RELEASE_SCHEMA",
        "PLANES",
        "PLANE_VERDICTS",
        "PLANE_AUTHORITIES",
        "RESOLVING_AUTHORITIES",
        "FORMAL_KINDS",
        "RELEASE_EVIDENCE_PLANES",
        "MONEY_RELEASE_CONTROLS",
    ),
}


class SemanticProjectionError(ValueError):
    pass


def _json_bytes(raw: bytes, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SemanticProjectionError(f"{label} is invalid JSON") from exc
    if not isinstance(value, dict):
        raise SemanticProjectionError(f"{label} must be an object")
    return value


def _git_bytes(root: Path, revision: str, relative: str) -> bytes:
    result = subprocess.run(
        ["git", "show", f"{revision}:{relative}"],
        cwd=root,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise SemanticProjectionError(
            f"semantic baseline Git object is unavailable: {revision}:{relative}"
        )
    return result.stdout


def _read(root: Path, relative: str, revision: Optional[str]) -> bytes:
    if revision is not None:
        return _git_bytes(root, revision, relative)
    path = root / relative
    if path.is_symlink() or not path.is_file():
        raise SemanticProjectionError(
            f"semantic projection source must be a regular file: {relative}"
        )
    return path.read_bytes()


def _literal_symbols(
    raw: bytes,
    symbols: Iterable[str],
    *,
    label: str,
    allow_missing: bool = False,
) -> dict[str, Any]:
    try:
        tree = ast.parse(raw.decode("utf-8"))
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise SemanticProjectionError(f"{label} is invalid Python") from exc
    wanted = set(symbols)
    values: dict[str, Any] = {}
    for node in tree.body:
        name: Optional[str] = None
        expression: Optional[ast.AST] = None
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(
            node.targets[0], ast.Name
        ):
            name = node.targets[0].id
            expression = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            name = node.target.id
            expression = node.value
        if name not in wanted or expression is None:
            continue
        try:
            values[name] = ast.literal_eval(expression)
        except (ValueError, TypeError) as exc:
            raise SemanticProjectionError(
                f"{label} symbol is not a closed literal: {name}"
            ) from exc
    missing = sorted(wanted - set(values))
    if missing and not allow_missing:
        raise SemanticProjectionError(
            f"{label} omits semantic symbols: {', '.join(missing)}"
        )
    return values


def _canonical(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _canonical(item) for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))}
    if isinstance(value, (set, frozenset)):
        return sorted((_canonical(item) for item in value), key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True))
    if isinstance(value, (list, tuple)):
        return [_canonical(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise SemanticProjectionError(f"unsupported semantic literal: {type(value).__name__}")


def _flatten(value: Any, prefix: str, output: dict[str, Any]) -> None:
    canonical = _canonical(value)
    if isinstance(canonical, dict):
        for key, item in canonical.items():
            _flatten(item, f"{prefix}.{key}", output)
        return
    if isinstance(canonical, list):
        for item in canonical:
            encoded = json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
            output[f"{prefix}[]:{digest}"] = item
        return
    output[prefix] = canonical


def build_projection(root: Path, revision: Optional[str] = None) -> dict[str, Any]:
    records: dict[str, Any] = {}
    routes_raw = _read(root, "references/routes-index.md", revision)
    try:
        routes = parse_governance_route_projection(routes_raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise SemanticProjectionError("routes executable projection is invalid") from exc
    for route, operations in routes.items():
        for operation, deliveries in operations.items():
            records[f"routes.{route}.{operation}"] = list(deliveries)

    for relative, symbols in PYTHON_SYMBOLS.items():
        try:
            raw = _read(root, relative, revision)
        except SemanticProjectionError:
            if revision is not None and relative == "scripts/runtime_governance_contract.py":
                continue
            raise
        values = _literal_symbols(
            raw,
            symbols,
            label=relative,
            allow_missing=revision is not None,
        )
        for symbol, value in values.items():
            _flatten(value, f"{relative}:{symbol}", records)

    task_cases = _json_bytes(
        _read(root, "tests/task-decision-cases.json", revision),
        label="task decision corpus",
    )
    for key in ("schema", "base_decision", "metamorphic_pairs"):
        if key not in task_cases:
            raise SemanticProjectionError(f"task decision corpus omits {key}")
        _flatten(task_cases[key], f"task-decision:{key}", records)
    return records


def compare_projection(root: Path, baseline_manifest: Path) -> dict[str, int]:
    manifest = _json_bytes(
        baseline_manifest.read_bytes(),
        label="governance baseline manifest",
    )
    revision = manifest.get("source_commit")
    if not is_full_lowercase_git_commit(revision):
        raise SemanticProjectionError(
            "source_commit must be a full lowercase Git commit"
        )
    baseline = build_projection(root, revision)
    current = build_projection(root)
    retired = sorted(set(baseline) - set(current))
    changed = sorted(
        key for key in set(baseline) & set(current) if baseline[key] != current[key]
    )
    if retired:
        raise SemanticProjectionError(
            "executable governance semantics retired: " + ", ".join(retired[:8])
        )
    if changed:
        raise SemanticProjectionError(
            "executable governance semantics changed without trusted promotion: "
            + ", ".join(changed[:8])
        )
    return {
        "preserved": len(baseline),
        "added": len(set(current) - set(baseline)),
        "changed": 0,
        "retired": 0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=Path, default=ROOT)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    args = parser.parse_args()
    try:
        result = compare_projection(args.source_root.resolve(), args.baseline.resolve())
    except (OSError, subprocess.SubprocessError, SemanticProjectionError) as exc:
        print(f"FAIL: {exc}")
        return 1
    print(
        "OK: executable governance semantic projection preserved "
        f"{result['preserved']} baseline facts; added={result['added']}, "
        "changed=0, retired=0"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
