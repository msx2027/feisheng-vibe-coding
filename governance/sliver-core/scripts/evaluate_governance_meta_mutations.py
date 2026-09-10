#!/usr/bin/env python3
"""Kill coordinated governance mutants through the complete package gate."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Callable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/governance/collusion-mutation-cases-v1.json"
SCHEMA = "sliver-governance-collusion-mutations/v1"


class MetaMutationError(ValueError):
    pass


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(old) != 1:
        raise MetaMutationError(f"mutation anchor must match once: {path}:{old[:40]}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def capability_self_approval(root: Path) -> None:
    registry_path = root / "tests/governance/capability-registry-v1.json"
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    registry["sources"][0]["reviewed_changes"] = ["ordinary-local-ui-tweak"]
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    route_path = root / "tests/route-eval-cases.json"
    routes = json.loads(route_path.read_text(encoding="utf-8"))
    routes["cases"][0]["expected_lenses"] = []
    route_path.write_text(json.dumps(routes, ensure_ascii=False, indent=2), encoding="utf-8")


def runtime_manifest_and_oracle_shrink(root: Path) -> None:
    replace_once(
        root / "packaging/runtime-manifest.json",
        '    "scripts/migrate_stage_contract.py",\n',
        "",
    )
    replace_once(
        root / "scripts/runtime_required_assets.py",
        "    required = immutable_required_paths(trusted_base_root, target)\n",
        "    required = set()\n",
    )


def forged_baseline_gate_claim(root: Path) -> None:
    replace_once(
        root / "tests/governance/baseline-29695fe.json",
        '    "status": "UNVERIFIED"\n',
        '    "status": "passed"\n',
    )
    replace_once(
        root / "scripts/governance_baseline.py",
        '        "status": "UNVERIFIED",\n',
        '        "status": "passed",\n',
    )
    replace_once(
        root / "scripts/governance_baseline.py",
        '    if gate.get("status") != "UNVERIFIED":\n',
        '    if gate.get("status") != "passed":\n',
    )


def route_parser_and_negative_oracle_collusion(root: Path) -> None:
    replace_once(
        root / "references/routes-index.md",
        "`baseline` -> `implementation`, `behavior_verification`",
        "`baseline` -> `audit`",
    )
    replace_once(
        root / "scripts/governance_route_projection.py",
        "            operations[operation] = deliveries\n",
        "            operations[operation] = deliveries\n"
        "        if route == \"环境启动\" and operations.get(\"baseline\") == (\"audit\",):\n"
        "            operations[\"baseline\"] = (\"implementation\", \"behavior_verification\")\n"
    )
    replace_once(
        root / "scripts/runtime_decision_contract.py",
        "        routes.add(route)\n",
        "        if route == \"环境启动\" and rows[-1][\"operations\"].get(\"baseline\") == (\"audit\",):\n"
        "            rows[-1][\"operations\"][\"baseline\"] = (\"implementation\", \"behavior_verification\")\n"
        "        routes.add(route)\n",
    )
    replace_once(
        root / "scripts/governance_route_projection.py",
        "import hashlib\n",
        "import hashlib\nimport runtime_decision_contract\n",
    )
    replace_once(
        root / "scripts/governance_route_projection.py",
        "    section = markdown_section(registry_text, \"Conditional Development Lenses\")\n",
        "    return runtime_decision_contract.parse_lens_registry_rows(registry_text)\n",
    )
    replace_once(
        root / "scripts/test_governance_semantic_projection_contracts.py",
        "    def test_route_delivery_change_fails(self) -> None:\n",
        "    def disabled_route_delivery_change_fails(self) -> None:\n",
    )
    replace_once(
        root / "scripts/test_governance_semantic_projection_contracts.py",
        "    def test_acceptance_route_parser_is_independent_from_runtime_parser(self) -> None:\n",
        "    def disabled_acceptance_route_parser_is_independent_from_runtime_parser(self) -> None:\n",
    )
    replace_once(
        root / "scripts/test_capability_baseline_contracts.py",
        "    def test_full_route_operation_delivery_projection_cannot_silently_change(self) -> None:\n",
        "    def disabled_full_route_operation_delivery_projection_cannot_silently_change(self) -> None:\n",
    )


def runtime_governance_and_unit_oracle_collusion(root: Path) -> None:
    replace_once(
        root / "scripts/runtime_governance_contract.py",
        '        if answer_order[0] != "external_current_state":\n',
        "        if False:\n",
    )
    replace_once(
        root / "scripts/test_runtime_governance_contracts.py",
        "    def test_current_executable_answer_must_be_first(self) -> None:\n",
        "    def disabled_current_executable_answer_must_be_first(self) -> None:\n",
    )


def delivery_shape_and_unit_oracle_collusion(root: Path) -> None:
    replace_once(
        root / "scripts/runtime_governance_contract.py",
        '    "proposed_changed_regions",\n'
        '    "user_task",\n'
        '    "interaction_model",\n',
        '    "proposed_changed_regions",\n'
        '    "interaction_model",\n',
    )
    replace_once(
        root / "scripts/runtime_governance_contract.py",
        '    user_task = _object(record["user_task"], "user_task")\n',
        '    user_task = {"primary_user": "bypass", "single_job": "bypass", '
        '"success_signal": "bypass"}\n',
    )
    replace_once(
        root / "scripts/test_runtime_governance_contracts.py",
        "    def test_record_without_user_task_and_information_architecture_must_fail(self) -> None:\n",
        "    def disabled_record_without_user_task_and_information_architecture_must_fail(self) -> None:\n",
    )


MUTATORS: dict[str, Callable[[Path], None]] = {
    "capability_self_approval": capability_self_approval,
    "runtime_manifest_and_oracle_shrink": runtime_manifest_and_oracle_shrink,
    "forged_baseline_gate_claim": forged_baseline_gate_claim,
    "route_parser_and_negative_oracle_collusion": route_parser_and_negative_oracle_collusion,
    "runtime_governance_and_unit_oracle_collusion": runtime_governance_and_unit_oracle_collusion,
    "delivery_shape_and_unit_oracle_collusion": delivery_shape_and_unit_oracle_collusion,
}


def load_cases(path: Path = DEFAULT_CASES) -> tuple[tuple[str, Callable[[Path], None], str], ...]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MetaMutationError(f"meta-mutation corpus is unreadable: {path}") from exc
    if not isinstance(data, dict) or set(data) != {"schema", "cases"}:
        raise MetaMutationError("meta-mutation corpus fields drifted")
    if data.get("schema") != SCHEMA:
        raise MetaMutationError("meta-mutation corpus schema is unsupported")
    raw_cases = data.get("cases")
    if not isinstance(raw_cases, list) or not raw_cases:
        raise MetaMutationError("meta-mutation cases must be non-empty")
    cases: list[tuple[str, Callable[[Path], None], str]] = []
    seen: set[str] = set()
    seen_mutators: set[str] = set()
    for index, case in enumerate(raw_cases):
        if not isinstance(case, dict) or set(case) != {
            "id",
            "mutator",
            "expected_diagnostic",
        }:
            raise MetaMutationError(f"meta-mutation case {index} fields drifted")
        case_id = case.get("id")
        mutator_id = case.get("mutator")
        diagnostic = case.get("expected_diagnostic")
        if not isinstance(case_id, str) or not case_id or case_id in seen:
            raise MetaMutationError(f"meta-mutation case {index} id is invalid")
        if mutator_id not in MUTATORS:
            raise MetaMutationError(f"meta-mutation case {case_id} mutator is unsupported")
        if not isinstance(diagnostic, str) or not diagnostic:
            raise MetaMutationError(f"meta-mutation case {case_id} diagnostic is invalid")
        seen.add(case_id)
        seen_mutators.add(mutator_id)
        cases.append((case_id, MUTATORS[mutator_id], diagnostic))
    if seen_mutators != set(MUTATORS):
        raise MetaMutationError("meta-mutation corpus does not cover every mutator")
    return tuple(cases)


CASES = load_cases()


def copy_source(destination: Path) -> None:
    shutil.copytree(
        ROOT,
        destination,
        symlinks=True,
        ignore=shutil.ignore_patterns("dist", "__pycache__", "*.pyc", ".DS_Store"),
    )


def main() -> int:
    if os.environ.get("SLIVER_META_MUTATION_CHILD") == "1":
        print("OK: coordinated governance meta-mutations skipped inside isolated child gate")
        return 0
    failures: list[str] = []
    for case_id, mutate, expected in CASES:
        with tempfile.TemporaryDirectory(prefix="sliver-meta-mutant-") as raw:
            source = Path(raw) / "source"
            copy_source(source)
            try:
                mutate(source)
            except (OSError, ValueError, MetaMutationError) as exc:
                print(f"INVALID_MUTANT: {case_id}: {exc}")
                failures.append(case_id)
                continue
            env = os.environ.copy()
            env["SLIVER_META_MUTATION_CHILD"] = "1"
            env["PYTHONDONTWRITEBYTECODE"] = "1"
            result = subprocess.run(
                [sys.executable, "scripts/validate_release_candidate.py", "--contract-only"],
                cwd=source,
                text=True,
                capture_output=True,
                check=False,
                env=env,
                timeout=600,
            )
            output = result.stdout + result.stderr
            if result.returncode != 0 and expected in output:
                print(f"KILLED_EXPECTED: {case_id}")
                continue
            if result.returncode == 0:
                print(f"SURVIVED: {case_id}")
            else:
                print(
                    f"INVALID_MUTANT: {case_id}: unexpected diagnostic: "
                    + output[-800:].replace("\n", " | ")
                )
            failures.append(case_id)
    if failures:
        print("FAIL: governance meta-mutations did not meet expected diagnostics")
        return 1
    print(f"OK: {len(CASES)}/{len(CASES)} coordinated governance mutants killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
