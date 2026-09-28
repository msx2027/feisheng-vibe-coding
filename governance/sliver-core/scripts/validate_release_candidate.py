#!/usr/bin/env python3
"""Run the package gate or optional full live validation for one Sliver candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"

from live_evidence_isolation import validate_isolation_manifest
from release_live_contract import (
    blocking_live_gap_ids,
    render_target_verdicts,
    target_verdicts,
)
from runtime_identity import RuntimeIdentityError, source_revision
from validation_support import ContractError, load_json_object, require_string


ROOT = Path(__file__).resolve().parents[1]
TARGETS = ("codex", "claude-code", "gemini-cli")


def fail(message: str, code: int = 1) -> int:
    print(f"FAIL: {message}")
    return code


def run(command: list[str]) -> bool:
    print("RUN:", " ".join(command))
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    completed = subprocess.run(command, cwd=ROOT, check=False, env=env)
    return completed.returncode == 0


def python_command(script: str, *args: str) -> list[str]:
    return [sys.executable, "-B", script, *args]


def source_snapshot() -> dict[str, tuple[str, str]]:
    """Hash the checkout outside .git without following symlinks."""

    snapshot: dict[str, tuple[str, str]] = {}
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if relative.parts and relative.parts[0] == ".git":
            continue
        if path.is_symlink():
            snapshot[relative.as_posix()] = ("symlink", os.readlink(path))
        elif path.is_file():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            snapshot[relative.as_posix()] = ("file", digest)
        elif not path.is_dir():
            snapshot[relative.as_posix()] = ("special", str(path.lstat().st_mode))
    return snapshot


def candidate_identity(path: Path, *, label: str) -> dict[str, str]:
    data = load_json_object(path)
    identity: dict[str, str] = {}
    for field in ("skill_version", "runtime_target", "runtime_digest", "source_revision"):
        identity[field] = require_string(data.get(field), label=f"{label} {field}", minimum=3)
    return identity


def validate_live_headers(
    task_decision: Path,
    foundation: Path,
    ui: Path,
    studio: Path,
    *,
    expected_producer_run_id: str | None = None,
    expected_producer_repository: str | None = None,
    expected_producer_workflow_path: str | None = None,
) -> None:
    task_decision_identity = candidate_identity(
        task_decision,
        label="Task Decision results",
    )
    foundation_identity = candidate_identity(foundation, label="foundation results")
    ui_identity = candidate_identity(ui, label="UI results")
    studio_identity = candidate_identity(studio, label="Studio results")
    if not (
        task_decision_identity
        == foundation_identity
        == ui_identity
        == studio_identity
    ):
        raise ContractError(
            "Task Decision, foundation, UI, and Studio live evidence do not identify "
            "the same candidate"
        )
    manifests: list[dict[str, Any]] = []
    for label, path, identity in (
        ("Task Decision results", task_decision, task_decision_identity),
        ("foundation results", foundation, foundation_identity),
        ("UI results", ui, ui_identity),
        ("Studio results", studio, studio_identity),
    ):
        data = load_json_object(path)
        manifests.append(
            validate_isolation_manifest(
                data.get("runner_isolation"),
                source_revision=identity["source_revision"],
                runtime_target=identity["runtime_target"],
                runtime_digest=identity["runtime_digest"],
                expected_producer_run_id=expected_producer_run_id,
                expected_producer_repository=expected_producer_repository,
                expected_producer_workflow_path=expected_producer_workflow_path,
            )
        )
    if not all(manifest == manifests[0] for manifest in manifests[1:]):
        raise ContractError(
            "Task Decision, foundation, UI, and Studio evidence must share one "
            "identical runner_isolation manifest"
        )


def static_commands() -> list[list[str]]:
    commands = [
        python_command("scripts/validate_skill.py"),
        python_command(
            "scripts/governance_baseline.py",
            "--verify",
            "tests/governance/baseline-29695fe.json",
        ),
        python_command(
            "scripts/governance_baseline.py", "--verify",
            json.loads((ROOT / "tests/governance/capability-registry-v1.json").read_text())["baseline_manifest"],
        ),
        python_command("scripts/test_governance_baseline_contracts.py"),
        python_command("scripts/governance_semantic_projection.py"),
        python_command("scripts/test_governance_semantic_projection_contracts.py"),
        python_command("scripts/compare_capability_baseline.py"),
        python_command("scripts/test_capability_baseline_contracts.py"),
        python_command("scripts/test_runtime_bundle_safety.py"),
        python_command("scripts/evaluate_governance_mutations.py"),
        python_command("scripts/test_governance_mutation_contracts.py"),
        python_command("scripts/evaluate_governance_meta_mutations.py"),
        python_command("scripts/evaluate_routes.py"),
        python_command("scripts/evaluate_task_decision_contract.py"),
        python_command("scripts/evaluate_task_decision_live_behavior.py", "--contract-only"),
        python_command("scripts/evaluate_selector_pressure.py"),
        python_command("scripts/evaluate_execution_backbone.py"),
        python_command(
            "scripts/evaluate_execution_liveness_live_behavior.py", "--contract-only"
        ),
        python_command("scripts/test_runtime_governance_contracts.py"),
        python_command("scripts/evaluate_ui_design_lifecycle.py"),
        python_command("scripts/evaluate_ui_design_live_behavior.py", "--contract-only"),
        python_command("scripts/evaluate_foundation_live_behavior.py", "--contract-only"),
        python_command("scripts/evaluate_studio_live_behavior.py", "--contract-only"),
        python_command("scripts/test_validation_contracts.py"),
        python_command("scripts/test_stage_v2_contracts.py"),
        python_command("scripts/test_foundation_guardrail_contracts.py"),
        python_command("scripts/test_private_risk_scan_contracts.py"),
        python_command("scripts/test_task_decision_live_contracts.py"),
        python_command("scripts/test_ui_design_live_contracts.py"),
        python_command("scripts/test_studio_live_contracts.py"),
        python_command("scripts/test_session_continuity.py"),
        python_command("scripts/test_release_candidate_contracts.py"),
    ]
    for asset, mode in (
        ("assets/project-bootstrap", "bootstrap"),
        ("assets/project-adoption", "adoption"),
        ("assets/project-bootstrap", "constitution"),
        ("assets/project-adoption", "constitution"),
    ):
        commands.append(
            [
                sys.executable,
                "-B",
                "scripts/check_project_guardrails.py",
                asset,
                "--mode",
                mode,
                "--foundation-gate",
                "contract",
                "--allow-template",
                "--skip-private-scan",
            ]
        )
    return commands


def validate_runtime_bundles() -> bool:
    with tempfile.TemporaryDirectory(prefix="sliver-release-") as raw:
        base = Path(raw)
        for target in TARGETS:
            bundle = base / target / "sliver-vibe-coding"
            if not run(
                [
                    *python_command("scripts/build_runtime_bundle.py"),
                    "--target",
                    target,
                    "--output",
                    str(bundle),
                ]
            ):
                return False
            if not run(
                [
                    *python_command("scripts/validate_runtime_bundle.py"),
                    str(bundle),
                    "--target",
                    target,
                    "--source-root",
                    str(ROOT),
                    "--trusted-base-root",
                    str(ROOT),
                ]
            ):
                return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--foundation-results", type=Path)
    parser.add_argument("--ui-results", type=Path)
    parser.add_argument("--studio-results", type=Path)
    parser.add_argument("--task-decision-results", type=Path)
    parser.add_argument("--expected-producer-run-id")
    parser.add_argument("--expected-producer-repository")
    parser.add_argument("--expected-producer-workflow-path")
    parser.add_argument(
        "--contract-only",
        action="store_true",
        help="Run the required package-release gate without claiming fresh-session behavior",
    )
    args = parser.parse_args()
    if args.contract_only and (
        args.foundation_results
        or args.ui_results
        or args.studio_results
        or args.task_decision_results
        or args.expected_producer_run_id
        or args.expected_producer_repository
        or args.expected_producer_workflow_path
    ):
        return fail("--contract-only cannot be combined with live result files", code=2)
    if not args.contract_only and (
        args.foundation_results is None
        or args.ui_results is None
        or args.studio_results is None
        or args.task_decision_results is None
        or args.expected_producer_run_id is None
        or args.expected_producer_repository is None
        or args.expected_producer_workflow_path is None
    ):
        print(
            "UNVERIFIED: full live validation requires Task Decision, foundation, UI, and Studio "
            "fresh-session result packages plus exact producer run, repository, and workflow binding; "
            "use --contract-only for the package-release gate"
        )
        return 2

    before = source_snapshot()
    for command in static_commands():
        if not run(command):
            return fail(f"release prerequisite failed: {' '.join(command)}")
    if not validate_runtime_bundles():
        return fail("runtime bundle validation failed")
    after = source_snapshot()
    if after != before:
        changed = sorted(set(before) ^ set(after))
        changed.extend(
            path
            for path in sorted(set(before) & set(after))
            if before[path] != after[path]
        )
        return fail(
            "aggregate gate changed the source checkout: "
            + ", ".join(changed[:5])
        )

    if args.contract_only:
        print(
            "OK: package-release static contracts and all runtime bundles passed; "
            "fresh-session behavior remains UNVERIFIED"
        )
        return 0

    try:
        assert (
            args.foundation_results is not None
            and args.ui_results is not None
            and args.studio_results is not None
            and args.task_decision_results is not None
        )
        validate_live_headers(
            args.task_decision_results,
            args.foundation_results,
            args.ui_results,
            args.studio_results,
            expected_producer_run_id=args.expected_producer_run_id,
            expected_producer_repository=args.expected_producer_repository,
            expected_producer_workflow_path=args.expected_producer_workflow_path,
        )
        observed_target = candidate_identity(
            args.task_decision_results,
            label="Task Decision results",
        )["runtime_target"]
        revision = source_revision(ROOT)
    except (ContractError, RuntimeIdentityError, OSError, json.JSONDecodeError) as exc:
        return fail(str(exc))
    if not revision.endswith(":clean"):
        return fail("release candidate source checkout must be clean")
    blocking_gaps = blocking_live_gap_ids()
    if blocking_gaps:
        print(
            "UNVERIFIED: trusted live evidence has not closed release-blocking gaps: "
            + ", ".join(blocking_gaps)
        )
        print(render_target_verdicts(target_verdicts(observed_target, blocking_gaps)))
        return 2
    if not run(
        [
            *python_command("scripts/evaluate_task_decision_live_behavior.py"),
            "--results",
            str(args.task_decision_results.resolve()),
        ]
    ):
        return fail("Task Decision fresh-session evidence failed")
    if not run(
        [
            *python_command("scripts/evaluate_foundation_live_behavior.py"),
            "--results",
            str(args.foundation_results.resolve()),
        ]
    ):
        return fail("foundation fresh-session evidence failed")
    if not run(
        [
            *python_command("scripts/evaluate_ui_design_live_behavior.py"),
            "--results",
            str(args.ui_results.resolve()),
        ]
    ):
        return fail("UI fresh-session evidence failed")
    if not run(
        [
            *python_command("scripts/evaluate_studio_live_behavior.py"),
            "--results",
            str(args.studio_results.resolve()),
        ]
    ):
        return fail("Studio fresh-session evidence failed")
    print(render_target_verdicts(target_verdicts(observed_target, ["trusted-policy-missing"])))
    print(
        "UNVERIFIED: target evidence packages are internally consistent, but no "
        "protected external producer policy and attestation trust root is configured"
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
