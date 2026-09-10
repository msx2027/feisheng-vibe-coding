#!/usr/bin/env python3
"""Generate or verify an immutable Sliver governance baseline from one Git object."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

from git_revision import is_full_lowercase_git_commit


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "sliver-governance-baseline/v1"
TARGETS = ("codex", "claude-code", "gemini-cli")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
FORBIDDEN_LOG_MARKERS = (
    "/Users/",
    ".codex/memories",
    "MEMORY.md",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GITHUB_TOKEN",
)
CONTRACT_FILES = {
    "VERSION",
    "packaging/runtime-manifest.json",
}


class BaselineError(ValueError):
    """Raised when a baseline cannot be reproduced from its bound Git object."""


def git_bytes(root: Path, revision: str, relative: str) -> bytes:
    try:
        return subprocess.run(
            ["git", "-C", str(root), "show", f"{revision}:{relative}"],
            check=True,
            capture_output=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise BaselineError(f"Git object is unavailable: {revision}:{relative}") from exc


def git_text(root: Path, revision: str, relative: str) -> str:
    try:
        return git_bytes(root, revision, relative).decode("utf-8")
    except UnicodeDecodeError as exc:
        raise BaselineError(f"baseline text file is not UTF-8: {relative}") from exc


def git_paths(root: Path, revision: str) -> list[str]:
    try:
        output = subprocess.run(
            ["git", "-C", str(root), "ls-tree", "-r", "--name-only", revision],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise BaselineError(f"baseline Git tree is unavailable: {revision}") from exc
    paths = [line for line in output.splitlines() if line]
    if not paths:
        raise BaselineError(f"baseline Git tree is empty: {revision}")
    return sorted(paths)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_pairs_digest(domain: bytes, entries: dict[str, bytes]) -> str:
    digest = hashlib.sha256()
    digest.update(domain + b"\0")
    for relative, content in sorted(entries.items()):
        encoded = relative.encode("utf-8")
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def normalized_relative(value: Any, *, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise BaselineError(f"{label} must be a non-empty string")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or path.as_posix() != value:
        raise BaselineError(f"{label} must be a normalized relative path: {value}")
    return value


def manifest_at(root: Path, revision: str) -> dict[str, Any]:
    try:
        data = json.loads(git_text(root, revision, "packaging/runtime-manifest.json"))
    except json.JSONDecodeError as exc:
        raise BaselineError("baseline runtime manifest is invalid JSON") from exc
    if not isinstance(data, dict) or data.get("schema_version") != 1:
        raise BaselineError("baseline runtime manifest must use schema_version 1")
    targets = data.get("targets")
    if not isinstance(targets, dict) or set(targets) != set(TARGETS):
        raise BaselineError("baseline runtime manifest target set drifted")
    return data


def bundle_entries(
    root: Path,
    revision: str,
    target: str,
    *,
    tree_paths: list[str],
) -> dict[str, bytes]:
    manifest = manifest_at(root, revision)
    entries: dict[str, bytes] = {}
    for raw in manifest.get("core_files", []):
        relative = normalized_relative(raw, label="runtime core file")
        if relative not in tree_paths:
            raise BaselineError(f"baseline runtime core file is missing: {relative}")
        entries[relative] = git_bytes(root, revision, relative)
    for raw in manifest.get("core_trees", []):
        tree = normalized_relative(raw, label="runtime core tree").rstrip("/")
        prefix = tree + "/"
        members = [
            path
            for path in tree_paths
            if path.startswith(prefix)
            and Path(path).name != ".DS_Store"
            and "__pycache__" not in Path(path).parts
            and Path(path).suffix != ".pyc"
        ]
        if not members:
            raise BaselineError(f"baseline runtime core tree is empty: {tree}")
        for relative in members:
            entries[relative] = git_bytes(root, revision, relative)
    target_data = manifest["targets"][target]
    if not isinstance(target_data, dict):
        raise BaselineError(f"baseline runtime target is invalid: {target}")
    overlays = target_data.get("overlay_files")
    if not isinstance(overlays, dict):
        raise BaselineError(f"baseline overlay map is invalid: {target}")
    for raw_source, raw_destination in overlays.items():
        source = normalized_relative(raw_source, label=f"{target} overlay source")
        destination = normalized_relative(
            raw_destination,
            label=f"{target} overlay destination",
        )
        if source not in tree_paths:
            raise BaselineError(f"baseline overlay source is missing: {source}")
        entries[destination] = git_bytes(root, revision, source)
    return entries


def contract_paths(tree_paths: list[str]) -> list[str]:
    return [
        path
        for path in tree_paths
        if path in CONTRACT_FILES
        or (
            path.startswith(".github/workflows/")
            and Path(path).suffix in {".yml", ".yaml"}
        )
        or (path.startswith("scripts/") and Path(path).suffix == ".py")
        or (
            path.startswith("tests/")
            and path.count("/") == 1
            and Path(path).suffix == ".json"
        )
    ]


def fixture_paths(tree_paths: list[str]) -> list[str]:
    return [
        path
        for path in tree_paths
        if path.startswith("tests/")
        and path.count("/") > 1
        and Path(path).name != ".DS_Store"
        and "__pycache__" not in Path(path).parts
        and Path(path).suffix != ".pyc"
    ]


def contract_gate_claim(root: Path, revision: str) -> dict[str, Any]:
    """Return only evidence that is actually bound to the immutable Git object.

    The baseline revision predates the governance evidence log, so a log from
    the candidate working tree cannot prove a historical run. Keep the plane
    explicitly unverified until a log inside the bound Git object or a trusted
    external attestation exists.
    """

    del root
    return {
        "status": "UNVERIFIED",
        "source_commit": revision,
        "reason": "no contract-run evidence is present in the bound Git object",
    }


def build_baseline(root: Path, revision: str) -> dict[str, Any]:
    if not is_full_lowercase_git_commit(revision):
        raise BaselineError("source_commit must be a full lowercase Git commit")
    tree_paths = git_paths(root, revision)
    runtime_manifest_bytes = git_bytes(
        root,
        revision,
        "packaging/runtime-manifest.json",
    )
    inputs = {
        path: git_bytes(root, revision, path)
        for path in contract_paths(tree_paths)
    }
    fixtures = {
        path: git_bytes(root, revision, path)
        for path in fixture_paths(tree_paths)
    }
    if len(inputs) < 20:
        raise BaselineError("baseline contract input set is unexpectedly small")
    runtime_entries = {
        target: bundle_entries(root, revision, target, tree_paths=tree_paths)
        for target in TARGETS
    }
    return {
        "schema": SCHEMA,
        "source_commit": revision,
        "source_state": "clean_git_object",
        "runtime_manifest_sha256": sha256_bytes(runtime_manifest_bytes),
        "runtime_digests": {
            target: canonical_pairs_digest(
                b"sliver-source-runtime/v1",
                runtime_entries[target],
            )
            for target in TARGETS
        },
        "runtime_file_counts": {
            target: len(runtime_entries[target])
            for target in TARGETS
        },
        "contract_inputs": [
            {"path": path, "sha256": sha256_bytes(content)}
            for path, content in sorted(inputs.items())
        ],
        "contract_input_digest": canonical_pairs_digest(
            b"sliver-governance-contract-inputs/v1",
            inputs,
        ),
        "fixture_file_count": len(fixtures),
        "fixture_tree_digest": canonical_pairs_digest(
            b"sliver-governance-fixture-inputs/v1",
            fixtures,
        ),
        "contract_gate": contract_gate_claim(root, revision),
        "fresh_session_status": "UNVERIFIED",
    }


def require_exact_keys(value: dict[str, Any], expected: set[str], *, label: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extras = sorted(actual - expected)
        raise BaselineError(f"{label} fields drifted; missing={missing}, extras={extras}")


def load_baseline(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BaselineError(f"baseline manifest is unreadable: {path}") from exc
    if not isinstance(data, dict):
        raise BaselineError("baseline manifest must be an object")
    require_exact_keys(
        data,
        {
            "schema",
            "source_commit",
            "source_state",
            "runtime_manifest_sha256",
            "runtime_digests",
            "runtime_file_counts",
            "contract_inputs",
            "contract_input_digest",
            "fixture_file_count",
            "fixture_tree_digest",
            "contract_gate",
            "fresh_session_status",
        },
        label="baseline manifest",
    )
    if data.get("schema") != SCHEMA:
        raise BaselineError("baseline manifest schema is unsupported")
    return data


def validate_shape(data: dict[str, Any]) -> None:
    if data.get("source_state") != "clean_git_object":
        raise BaselineError("baseline source_state must be clean_git_object")
    if data.get("fresh_session_status") != "UNVERIFIED":
        raise BaselineError("baseline fresh_session_status must remain UNVERIFIED")
    if not SHA256_RE.fullmatch(str(data.get("runtime_manifest_sha256", ""))):
        raise BaselineError("baseline runtime manifest digest is invalid")
    for field in ("runtime_digests", "runtime_file_counts"):
        value = data.get(field)
        if not isinstance(value, dict) or set(value) != set(TARGETS):
            raise BaselineError(f"baseline {field} target set drifted")
    if any(
        not SHA256_RE.fullmatch(str(value))
        for value in data["runtime_digests"].values()
    ):
        raise BaselineError("baseline runtime digest is invalid")
    if any(
        not isinstance(value, int) or value <= 0
        for value in data["runtime_file_counts"].values()
    ):
        raise BaselineError("baseline runtime file count is invalid")
    inputs = data.get("contract_inputs")
    if not isinstance(inputs, list) or len(inputs) < 20:
        raise BaselineError("baseline contract input set is invalid")
    normalized: list[str] = []
    for index, item in enumerate(inputs):
        if not isinstance(item, dict) or set(item) != {"path", "sha256"}:
            raise BaselineError(f"baseline contract input {index} is invalid")
        path = normalized_relative(item.get("path"), label="baseline contract input path")
        if not SHA256_RE.fullmatch(str(item.get("sha256", ""))):
            raise BaselineError(f"baseline contract input digest is invalid: {path}")
        normalized.append(path)
    if normalized != sorted(normalized) or len(normalized) != len(set(normalized)):
        raise BaselineError("baseline contract inputs must be unique and sorted")
    if not SHA256_RE.fullmatch(str(data.get("contract_input_digest", ""))):
        raise BaselineError("baseline contract input digest is invalid")
    if not isinstance(data.get("fixture_file_count"), int) or data["fixture_file_count"] <= 0:
        raise BaselineError("baseline fixture file count is invalid")
    if not SHA256_RE.fullmatch(str(data.get("fixture_tree_digest", ""))):
        raise BaselineError("baseline fixture tree digest is invalid")
    gate = data.get("contract_gate")
    if not isinstance(gate, dict):
        raise BaselineError("baseline contract gate claim is invalid")
    require_exact_keys(
        gate,
        {"status", "source_commit", "reason"},
        label="baseline contract gate",
    )
    if gate.get("status") != "UNVERIFIED":
        raise BaselineError("baseline contract gate must remain UNVERIFIED without bound evidence")
    if gate.get("source_commit") != data.get("source_commit"):
        raise BaselineError("baseline contract gate source commit drifted")
    if gate.get("reason") != "no contract-run evidence is present in the bound Git object":
        raise BaselineError("baseline contract gate reason drifted")


def verify_baseline(root: Path, path: Path) -> None:
    supplied = load_baseline(path)
    validate_shape(supplied)
    revision = supplied.get("source_commit")
    if not is_full_lowercase_git_commit(revision):
        raise BaselineError("baseline source_commit is invalid")
    tree_paths = git_paths(root, revision)
    expected_gate = contract_gate_claim(root, revision)
    if supplied["contract_gate"] != expected_gate:
        raise BaselineError("baseline contract gate state does not match the bound Git object")
    supplied_paths = [item["path"] for item in supplied["contract_inputs"]]
    expected_paths = contract_paths(tree_paths)
    if supplied_paths != expected_paths:
        raise BaselineError("baseline manifest does not contain the exact contract input set")
    input_entries: dict[str, bytes] = {}
    for item in supplied["contract_inputs"]:
        content = git_bytes(root, revision, item["path"])
        input_entries[item["path"]] = content
        if item["sha256"] != sha256_bytes(content):
            raise BaselineError("baseline contract input digest does not match Git object")
    if supplied["contract_input_digest"] != canonical_pairs_digest(
        b"sliver-governance-contract-inputs/v1",
        input_entries,
    ):
        raise BaselineError("baseline contract input aggregate digest does not match Git object")
    fixture_entries = {
        relative: git_bytes(root, revision, relative)
        for relative in fixture_paths(tree_paths)
    }
    if supplied["fixture_file_count"] != len(fixture_entries):
        raise BaselineError("baseline fixture file count does not match Git object")
    if supplied["fixture_tree_digest"] != canonical_pairs_digest(
        b"sliver-governance-fixture-inputs/v1",
        fixture_entries,
    ):
        raise BaselineError("baseline fixture tree digest does not match Git object")
    manifest_bytes = git_bytes(root, revision, "packaging/runtime-manifest.json")
    if supplied["runtime_manifest_sha256"] != sha256_bytes(manifest_bytes):
        raise BaselineError("baseline runtime manifest digest does not match Git object")
    for target in TARGETS:
        entries = bundle_entries(root, revision, target, tree_paths=tree_paths)
        if supplied["runtime_file_counts"][target] != len(entries):
            raise BaselineError(f"baseline {target} runtime file count does not match Git object")
        digest = canonical_pairs_digest(b"sliver-source-runtime/v1", entries)
        if supplied["runtime_digests"][target] != digest:
            raise BaselineError(f"baseline {target} runtime digest does not match Git object")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--emit", metavar="COMMIT")
    group.add_argument("--verify", type=Path)
    args = parser.parse_args()
    try:
        if args.emit is not None:
            print(
                json.dumps(
                    build_baseline(ROOT, args.emit),
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=True,
                )
            )
            return 0
        assert args.verify is not None
        verify_baseline(ROOT, args.verify)
    except BaselineError as exc:
        print(f"FAIL: {exc}")
        return 1
    print("OK: governance baseline verified from immutable Git object")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
