#!/usr/bin/env python3
"""Kill deterministic governance mutants without changing the active checkout."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "tests/governance/static-mutation-cases-v1.json"
SCHEMA = "sliver-governance-static-mutations/v2"
LIVE_GAPS_SCHEMA = "sliver-governance-known-live-gaps/v1"
ALLOWED_GATE_ARGS = {
    "--contract-only",
    "--validate-source",
    "StudioLiveContractsTest.test_writer_rooms_cannot_overlap_allowed_paths",
}
ALLOWED_LIVE_EVIDENCE = {
    "trusted_live_producer",
    "producer_isolation_adversarial_test",
    "external_independent_judge_with_bound_raw_artifacts",
}


class MutationError(ValueError):
    """Raised when the mutation corpus or execution boundary is unsafe."""


def exact_keys(value: dict[str, Any], expected: set[str], *, label: str) -> None:
    if set(value) != expected:
        raise MutationError(f"{label} fields drifted")


def normalized_path(value: Any, *, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise MutationError(f"{label} must be a non-empty string")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or ".." in path.parts
        or "\\" in value
        or path.as_posix() != value
    ):
        raise MutationError(f"{label} must be a normalized repository-relative path")
    return value


def source_file(root: Path, relative: str, *, label: str) -> Path:
    normalized = normalized_path(relative, label=label)
    if not (
        normalized == "SKILL.md"
        or normalized.startswith("references/")
        or normalized.startswith("scripts/")
    ):
        raise MutationError(f"{label} is outside the reviewed mutation targets: {relative}")
    path = root / normalized
    if path.is_symlink() or not path.is_file():
        raise MutationError(f"{label} must be a regular file: {relative}")
    return path


def nonempty_strings(value: Any, *, label: str) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item for item in value)
    ):
        raise MutationError(f"{label} must be a non-empty string list")
    return value


def load_cases(
    path: Path,
    *,
    source_root: Path,
    validate_anchors: bool = True,
) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MutationError(f"mutation corpus is unreadable: {path}") from exc
    if not isinstance(data, dict):
        raise MutationError("mutation corpus must be an object")
    exact_keys(
        data,
        {
            "schema",
            "evaluation_scope",
            "critical_failure_policy",
            "invariants",
            "mutations",
        },
        label="mutation corpus",
    )
    if data.get("schema") != SCHEMA:
        raise MutationError("mutation corpus schema is unsupported")
    if data.get("evaluation_scope") != "deterministic_static_contract_only":
        raise MutationError("mutation corpus must remain static-contract-only")
    if data.get("critical_failure_policy") != "every_mutant_must_be_killed":
        raise MutationError("mutation corpus critical policy drifted")

    invariants = data.get("invariants")
    mutations = data.get("mutations")
    if not isinstance(invariants, list) or not invariants:
        raise MutationError("mutation corpus invariants must be non-empty")
    if not isinstance(mutations, list) or not mutations:
        raise MutationError("mutation corpus mutations must be non-empty")
    seen_invariants: set[str] = set()
    for index, invariant in enumerate(invariants):
        if not isinstance(invariant, dict):
            raise MutationError(f"invariant {index} must be an object")
        exact_keys(invariant, {"id", "path", "required_all"}, label=f"invariant {index}")
        invariant_id = invariant.get("id")
        if not isinstance(invariant_id, str) or not invariant_id or invariant_id in seen_invariants:
            raise MutationError(f"invariant {index} id is invalid or duplicated")
        seen_invariants.add(invariant_id)
        source_file(source_root, invariant.get("path"), label=f"invariant {invariant_id} path")
        nonempty_strings(invariant.get("required_all"), label=f"invariant {invariant_id} terms")

    seen_mutations: set[str] = set()
    for index, mutation in enumerate(mutations):
        if not isinstance(mutation, dict):
            raise MutationError(f"mutation {index} must be an object")
        exact_keys(
            mutation,
            {"id", "critical", "path", "replacements", "gate", "expected_failure"},
            label=f"mutation {index}",
        )
        mutation_id = mutation.get("id")
        if not isinstance(mutation_id, str) or not mutation_id or mutation_id in seen_mutations:
            raise MutationError(f"mutation {index} id is invalid or duplicated")
        seen_mutations.add(mutation_id)
        if mutation.get("critical") is not True:
            raise MutationError(f"mutation {mutation_id} must remain critical")
        target = source_file(
            source_root,
            mutation.get("path"),
            label=f"mutation {mutation_id} path",
        )
        replacements = mutation.get("replacements")
        if not isinstance(replacements, list) or not replacements:
            raise MutationError(f"mutation {mutation_id} replacements must be non-empty")
        target_text = target.read_text(encoding="utf-8")
        for replacement_index, replacement in enumerate(replacements):
            if not isinstance(replacement, dict):
                raise MutationError(
                    f"mutation {mutation_id} replacement {replacement_index} must be an object"
                )
            exact_keys(
                replacement,
                {"old", "new"},
                label=f"mutation {mutation_id} replacement {replacement_index}",
            )
            old = replacement.get("old")
            new = replacement.get("new")
            if not isinstance(old, str) or not old or not isinstance(new, str) or old == new:
                raise MutationError(f"mutation {mutation_id} replacement is invalid")
            if validate_anchors and target_text.count(old) != 1:
                raise MutationError(
                    f"mutation {mutation_id} replacement anchor must match exactly once"
                )
        gate = mutation.get("gate")
        if not isinstance(gate, dict):
            raise MutationError(f"mutation {mutation_id} gate must be an object")
        exact_keys(gate, {"script", "args"}, label=f"mutation {mutation_id} gate")
        script = gate.get("script")
        if script != "self":
            script = normalized_path(script, label=f"mutation {mutation_id} gate script")
            if not script.startswith("scripts/") or Path(script).suffix != ".py":
                raise MutationError(f"mutation {mutation_id} gate script is outside scripts/")
            source_file(source_root, script, label=f"mutation {mutation_id} gate script")
        args = gate.get("args")
        if not isinstance(args, list) or any(not isinstance(item, str) for item in args):
            raise MutationError(f"mutation {mutation_id} gate args must be strings")
        if any(item not in ALLOWED_GATE_ARGS for item in args):
            raise MutationError(f"mutation {mutation_id} gate args are outside the allowlist")
        expected_failure = mutation.get("expected_failure")
        if not isinstance(expected_failure, dict):
            raise MutationError(f"mutation {mutation_id} expected_failure must be an object")
        exact_keys(
            expected_failure,
            {"exit_codes", "output_contains"},
            label=f"mutation {mutation_id} expected_failure",
        )
        exit_codes = expected_failure.get("exit_codes")
        if (
            not isinstance(exit_codes, list)
            or not exit_codes
            or any(isinstance(code, bool) or not isinstance(code, int) or code == 0 for code in exit_codes)
        ):
            raise MutationError(
                f"mutation {mutation_id} expected failure exit_codes are invalid"
            )
        nonempty_strings(
            expected_failure.get("output_contains"),
            label=f"mutation {mutation_id} expected failure diagnostics",
        )
    return data


def load_live_gaps(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise MutationError(f"known live gaps corpus is unreadable: {path}") from exc
    if not isinstance(data, dict):
        raise MutationError("known live gaps corpus must be an object")
    exact_keys(
        data,
        {"schema", "evaluation_scope", "cases"},
        label="known live gaps corpus",
    )
    if data.get("schema") != LIVE_GAPS_SCHEMA:
        raise MutationError("known live gaps corpus schema is unsupported")
    if data.get("evaluation_scope") != "fresh_session_behavior_not_yet_produced":
        raise MutationError("known live gaps evaluation scope drifted")
    cases = data.get("cases")
    if not isinstance(cases, list) or not cases:
        raise MutationError("known live gaps cases must be non-empty")
    seen: set[str] = set()
    base_keys = {"id", "status", "required_evidence", "static_surrogate_forbidden"}
    defect_keys = base_keys | {"expected_baseline_result", "defect_id"}
    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            raise MutationError(f"known live gap {index} must be an object")
        case_keys = set(case)
        if case_keys != base_keys and case_keys != defect_keys:
            raise MutationError(f"known live gap {index} fields drifted")
        case_id = case.get("id")
        if not isinstance(case_id, str) or not case_id or case_id in seen:
            raise MutationError(f"known live gap {index} id is invalid or duplicated")
        seen.add(case_id)
        if case.get("status") != "UNVERIFIED":
            raise MutationError(f"known live gap {case_id} must remain UNVERIFIED")
        if case.get("static_surrogate_forbidden") is not True:
            raise MutationError(f"known live gap {case_id} must forbid static surrogates")
        if case.get("required_evidence") not in ALLOWED_LIVE_EVIDENCE:
            raise MutationError(f"known live gap {case_id} evidence type is unsupported")
        if case_keys == defect_keys:
            if case.get("expected_baseline_result") != "RED":
                raise MutationError(f"known live gap {case_id} baseline must remain RED")
            defect_id = case.get("defect_id")
            if not isinstance(defect_id, str) or not defect_id:
                raise MutationError(f"known live gap {case_id} defect id is invalid")
    return data


def validate_source(source_root: Path, data: dict[str, Any]) -> None:
    failures: list[str] = []
    for invariant in data["invariants"]:
        text = source_file(
            source_root,
            invariant["path"],
            label=f"invariant {invariant['id']} path",
        ).read_text(encoding="utf-8")
        for term in invariant["required_all"]:
            if term not in text:
                failures.append(f"{invariant['id']}: missing {term}")
    if failures:
        raise MutationError("static governance invariant failed: " + failures[0])


def copy_source(source_root: Path, destination: Path, *, env: dict[str, str]) -> None:
    def ignore(directory: str, names: list[str]) -> set[str]:
        ignored = {name for name in names if name in {".git", "dist", "__pycache__", ".DS_Store"}}
        ignored.update(name for name in names if name.endswith(".pyc"))
        return ignored

    shutil.copytree(source_root, destination, symlinks=True, ignore=ignore)
    try:
        baseline_manifest = json.loads(
            (source_root / "tests/governance/baseline-29695fe.json").read_text(
                encoding="utf-8"
            )
        )
        baseline_revision = baseline_manifest["source_commit"]
    except (OSError, KeyError, json.JSONDecodeError) as exc:
        raise MutationError("mutation source baseline manifest is invalid") from exc
    if not isinstance(baseline_revision, str) or not baseline_revision:
        raise MutationError("mutation source baseline revision is invalid")
    for command in (
        ["git", "init", "--quiet", "--template="],
        [
            "git",
            "fetch",
            "--quiet",
            "--no-tags",
            str(source_root),
            baseline_revision,
        ],
        ["git", "add", "--all"],
        [
            "git",
            "-c",
            "user.name=Sliver Mutation Gate",
            "-c",
            "user.email=mutation-gate@example.invalid",
            "commit",
            "--quiet",
            "-m",
            "mutation baseline",
        ],
    ):
        result = subprocess.run(
            command,
            cwd=destination,
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )
        if result.returncode != 0:
            raise MutationError(
                "failed to initialize isolated mutation checkout: "
                + (result.stdout + result.stderr)[-500:]
            )


    registry = json.loads((source_root / "tests/governance/capability-registry-v1.json").read_text())
    capability_manifest = source_root / normalized_path(registry["baseline_manifest"], label="capability baseline")
    if capability_manifest.is_symlink() or not capability_manifest.is_file() or not capability_manifest.resolve().is_relative_to(source_root.resolve()):
        raise MutationError("capability baseline must be a regular file inside the source")
    capability_revision = json.loads(capability_manifest.read_text())["source_commit"]
    subprocess.run(
        ["git", "fetch", "--quiet", "--no-tags", str(source_root), capability_revision],
        cwd=destination, env=env, check=True, capture_output=True,
    )


def apply_mutation(source_root: Path, mutation: dict[str, Any]) -> None:
    target = source_file(
        source_root,
        mutation["path"],
        label=f"mutation {mutation['id']} path",
    )
    text = target.read_text(encoding="utf-8")
    for replacement in mutation["replacements"]:
        old = replacement["old"]
        if text.count(old) != 1:
            raise MutationError(
                f"mutation {mutation['id']} replacement anchor must match exactly once"
            )
        text = text.replace(old, replacement["new"], 1)
    target.write_text(text, encoding="utf-8")


def gate_command(source_root: Path, mutation: dict[str, Any]) -> list[str]:
    gate = mutation["gate"]
    if gate["script"] == "self":
        script = source_root / "scripts/evaluate_governance_mutations.py"
        cases = source_root / "tests/governance/static-mutation-cases-v1.json"
        return [
            sys.executable,
            str(script),
            "--cases",
            str(cases),
            *gate["args"],
        ]
    return [sys.executable, str(source_root / gate["script"]), *gate["args"]]


def run_mutations(source_root: Path, data: dict[str, Any]) -> None:
    survivors: list[str] = []
    invalid_mutants: list[str] = []
    for mutation in data["mutations"]:
        with tempfile.TemporaryDirectory(prefix="sliver-governance-mutant-") as raw:
            temporary = Path(raw)
            checkout = temporary / "source"
            env = {
                key: os.environ[key]
                for key in ("PATH", "LANG", "LC_ALL", "SYSTEMROOT")
                if key in os.environ
            }
            isolated_home = temporary / "home"
            isolated_home.mkdir()
            env.update(
                {
                    "HOME": str(isolated_home),
                    "XDG_CONFIG_HOME": str(isolated_home / ".config"),
                    "GIT_CONFIG_GLOBAL": str(isolated_home / ".gitconfig"),
                    "GIT_CONFIG_NOSYSTEM": "1",
                    "PYTHONDONTWRITEBYTECODE": "1",
                }
            )
            copy_source(source_root, checkout, env=env)
            command = gate_command(checkout, mutation)
            control = subprocess.run(
                command,
                cwd=checkout,
                text=True,
                capture_output=True,
                check=False,
                env=env,
                timeout=180,
            )
            if control.returncode != 0:
                raise MutationError(
                    f"mutation {mutation['id']} gate is not green before mutation: "
                    + (control.stdout + control.stderr)[-1000:]
                )
            apply_mutation(checkout, mutation)
            result = subprocess.run(
                command,
                cwd=checkout,
                text=True,
                capture_output=True,
                check=False,
                env=env,
                timeout=180,
            )
            if result.returncode == 0:
                survivors.append(mutation["id"])
                print(f"SURVIVED: {mutation['id']}")
            else:
                expected_failure = mutation["expected_failure"]
                output = result.stdout + result.stderr
                diagnostics = expected_failure["output_contains"]
                if (
                    result.returncode not in expected_failure["exit_codes"]
                    or any(term not in output for term in diagnostics)
                ):
                    invalid_mutants.append(mutation["id"])
                    print(f"INVALID_MUTANT: {mutation['id']}")
                else:
                    print(f"KILLED_EXPECTED: {mutation['id']}")
    if survivors:
        raise MutationError("critical governance mutants survived: " + ", ".join(survivors))
    if invalid_mutants:
        raise MutationError(
            "governance mutants failed for an unexpected reason: "
            + ", ".join(invalid_mutants)
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--validate-source", action="store_true")
    args = parser.parse_args()
    try:
        data = load_cases(
            args.cases,
            source_root=ROOT,
            validate_anchors=not args.validate_source,
        )
        validate_source(ROOT, data)
        if args.validate_source:
            print("OK: static governance invariants validated")
            return 0
        run_mutations(ROOT, data)
    except (MutationError, OSError, subprocess.SubprocessError) as exc:
        print(f"FAIL: {exc}")
        return 1
    print(
        f"OK: {len(data['mutations'])}/{len(data['mutations'])} static governance "
        "mutants killed with expected diagnostics"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
