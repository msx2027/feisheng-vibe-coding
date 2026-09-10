#!/usr/bin/env python3
"""Validate the shared isolation manifest for publishable live evidence."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path, PurePosixPath
from typing import Any, Optional

from runtime_file_set import (
    RuntimeFileSetError,
    regular_source_path,
    runtime_source_entries,
)
from runtime_manifest_contract import RuntimeManifestError, load_runtime_manifest
from validation_support import ContractError, require_fields, require_string


SCHEMA = "sliver-live-evidence-isolation/v1"
WORKFLOW_PATH_RE = re.compile(r"^\.github/workflows/[A-Za-z0-9_.-]+\.ya?ml$")
LIVE_CASE_INPUTS = (
    "tests/task-decision-live-cases.json",
    "tests/foundation-live-behavior-cases.json",
    "tests/ui-design-live-behavior-cases.json",
    "tests/studio-live-behavior-cases.json",
)
LIVE_SCHEMA_INPUTS = (
    "tests/task-decision-live-result-schema.json",
    "tests/foundation-live-result-schema.json",
    "tests/ui-design-live-result-schema.json",
    "tests/studio-live-result-schema.json",
)
LIVE_RUNNER_INPUTS = (
    "scripts/evaluate_task_decision_live_behavior.py",
    "scripts/evaluate_foundation_live_behavior.py",
    "scripts/evaluate_ui_design_live_behavior.py",
    "scripts/evaluate_studio_live_behavior.py",
    "scripts/live_evidence_isolation.py",
    "scripts/runtime_file_set.py",
    "scripts/runtime_identity.py",
    "scripts/runtime_manifest_contract.py",
    "scripts/validation_support.py",
)
REQUIRED_FIELDS = (
    "schema",
    "environment",
    "workspace_origin",
    "source_revision",
    "runtime_digest",
    "producer",
    "isolated_home",
    "isolated_runtime_home",
    "user_config_loaded",
    "user_rules_loaded",
    "global_memory_mounted",
    "global_skills_mounted",
    "plugins_enabled",
    "session_history_mounted",
    "personal_projects_mounted",
    "allowed_inputs",
    "input_manifest_sha256",
    "external_authorization_ref",
    "privacy_scan_status",
    "cleanup_status",
)
REQUIRED_PRODUCER_FIELDS = (
    "kind",
    "repository",
    "workflow_path",
    "run_id",
)
SAFE_TRUE_FIELDS = ("isolated_home", "isolated_runtime_home")
SAFE_FALSE_FIELDS = (
    "user_config_loaded",
    "user_rules_loaded",
    "global_memory_mounted",
    "global_skills_mounted",
    "plugins_enabled",
    "session_history_mounted",
    "personal_projects_mounted",
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
REPOSITORY_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
RUN_ID_RE = re.compile(r"^[1-9][0-9]*$")
ROOT = Path(__file__).resolve().parents[1]


def _object(value: Any, *, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{label} must be an object")
    return value


def _require_exact_fields(value: dict[str, Any], fields: tuple[str, ...], *, label: str) -> None:
    require_fields(value, fields, label=label)
    extras = sorted(set(value) - set(fields))
    if extras:
        raise ContractError(f"{label} has unsupported fields: {', '.join(extras)}")


def _sha256(value: Any, *, label: str) -> str:
    digest = require_string(value, label=label, minimum=64)
    if not SHA256_RE.fullmatch(digest):
        raise ContractError(f"{label} must be a lowercase SHA-256")
    return digest


def _allowed_input_path(value: Any, *, label: str) -> str:
    raw = require_string(value, label=label)
    path = PurePosixPath(raw)
    if raw.startswith(("/", "~")) or ".." in path.parts or path.is_absolute():
        raise ContractError(f"{label} must be a repository-relative path")
    if not path.parts or any(part in ("", ".") for part in path.parts):
        raise ContractError(f"{label} must be a normalized repository-relative path")
    return raw


def input_manifest_digest(allowed_inputs: list[dict[str, str]]) -> str:
    payload = json.dumps(
        allowed_inputs,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _repo_file(root: Path, relative: str, *, label: str) -> Path:
    normalized = _allowed_input_path(relative, label=label)
    try:
        return regular_source_path(
            root,
            normalized,
            expected="file",
            label=label,
        )
    except RuntimeFileSetError as exc:
        raise ContractError(str(exc)) from exc


def required_live_input_paths(runtime_target: str, *, source_root: Path = ROOT) -> list[str]:
    """Return the exact repository files readable by one publishable live run."""

    root = source_root.resolve()
    _repo_file(root, "packaging/runtime-manifest.json", label="runtime manifest")
    try:
        manifest = load_runtime_manifest(root)
        runtime_entries = runtime_source_entries(root, manifest, runtime_target)
    except (RuntimeManifestError, RuntimeFileSetError) as exc:
        raise ContractError(str(exc)) from exc

    paths: set[str] = {
        "packaging/runtime-manifest.json",
        *LIVE_CASE_INPUTS,
        *LIVE_SCHEMA_INPUTS,
        *LIVE_RUNNER_INPUTS,
    }
    for source in runtime_entries.values():
        paths.add(source.relative_to(root).as_posix())

    for cases_relative in LIVE_CASE_INPUTS:
        cases_path = _repo_file(root, cases_relative, label="live case contract")
        cases = json.loads(cases_path.read_text(encoding="utf-8"))
        for case in cases.get("cases", []):
            if not isinstance(case, dict):
                raise ContractError(f"live case must be an object: {cases_relative}")
            fixture_ref = case.get("fixture")
            if not isinstance(fixture_ref, dict):
                continue
            fixture_relative = fixture_ref.get("path")
            if not isinstance(fixture_relative, str):
                raise ContractError(f"live fixture path is missing: {cases_relative}")
            fixture_path = _repo_file(root, fixture_relative, label="live fixture")
            paths.add(fixture_relative)
            fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
            workspace = fixture.get("workspace")
            if not isinstance(workspace, dict):
                continue
            workspace_root = workspace.get("root")
            if not isinstance(workspace_root, str):
                raise ContractError(f"live fixture workspace root is missing: {fixture_relative}")
            relatives: set[str] = set()
            required = workspace.get("required_paths", [])
            if not isinstance(required, list) or any(
                not isinstance(item, str) for item in required
            ):
                raise ContractError(f"live fixture required_paths are invalid: {fixture_relative}")
            relatives.update(required)
            render_entry = workspace.get("render_entry")
            if isinstance(render_entry, str):
                relatives.add(render_entry)
            command = workspace.get("verification_command")
            if isinstance(command, list) and len(command) >= 2 and isinstance(command[1], str):
                relatives.add(command[1])
            for relative in relatives:
                joined = f"{workspace_root.rstrip('/')}/{relative}"
                _repo_file(root, joined, label="live fixture workspace input")
                paths.add(joined)

    for relative in sorted(paths):
        _repo_file(root, relative, label="required live input")
    return sorted(paths)


def build_allowed_inputs(
    runtime_target: str, *, source_root: Path = ROOT
) -> list[dict[str, str]]:
    return [
        {"path": relative, "sha256": file_sha256(source_root / relative)}
        for relative in required_live_input_paths(runtime_target, source_root=source_root)
    ]


def validate_isolation_manifest(
    value: Any,
    *,
    source_revision: str,
    runtime_target: str,
    runtime_digest: str,
    expected_producer_run_id: Optional[str] = None,
    expected_producer_repository: Optional[str] = None,
    expected_producer_workflow_path: Optional[str] = None,
    source_root: Path = ROOT,
) -> dict[str, Any]:
    """Return a normalized manifest or raise ContractError on unsafe evidence."""

    manifest = _object(value, label="runner_isolation")
    _require_exact_fields(manifest, REQUIRED_FIELDS, label="runner_isolation")
    if manifest.get("schema") != SCHEMA:
        raise ContractError("runner_isolation schema is unsupported")
    if manifest.get("environment") != "github_hosted_ephemeral":
        raise ContractError("runner_isolation environment must be github_hosted_ephemeral")
    if manifest.get("workspace_origin") != "versioned_synthetic_fixture":
        raise ContractError(
            "runner_isolation workspace_origin must be versioned_synthetic_fixture"
        )
    if manifest.get("source_revision") != source_revision:
        raise ContractError("runner_isolation source_revision does not match results")
    if manifest.get("runtime_digest") != runtime_digest:
        raise ContractError("runner_isolation runtime_digest does not match results")

    for field in SAFE_TRUE_FIELDS:
        if manifest.get(field) is not True:
            raise ContractError(f"runner_isolation {field} must be true")
    for field in SAFE_FALSE_FIELDS:
        if manifest.get(field) is not False:
            raise ContractError(f"runner_isolation {field} must be false")
    if manifest.get("privacy_scan_status") != "passed":
        raise ContractError("runner_isolation privacy_scan_status must be passed")
    if manifest.get("cleanup_status") != "complete":
        raise ContractError("runner_isolation cleanup_status must be complete")

    producer = _object(manifest.get("producer"), label="runner_isolation producer")
    _require_exact_fields(
        producer,
        REQUIRED_PRODUCER_FIELDS,
        label="runner_isolation producer",
    )
    if producer.get("kind") != "github_actions":
        raise ContractError("runner_isolation producer kind must be github_actions")
    repository = require_string(
        producer.get("repository"), label="runner_isolation producer repository"
    )
    if not REPOSITORY_RE.fullmatch(repository):
        raise ContractError("runner_isolation producer repository must be owner/repository")
    workflow_path = require_string(
        producer.get("workflow_path"), label="runner_isolation producer workflow_path"
    )
    if not WORKFLOW_PATH_RE.fullmatch(workflow_path):
        raise ContractError(
            "runner_isolation producer workflow_path must be a normalized GitHub workflow path"
        )
    if (
        expected_producer_workflow_path is not None
        and workflow_path != expected_producer_workflow_path
    ):
        raise ContractError("runner_isolation producer workflow_path does not match the source run")
    run_id = require_string(
        producer.get("run_id"), label="runner_isolation producer run_id"
    )
    if not RUN_ID_RE.fullmatch(run_id):
        raise ContractError("runner_isolation producer run_id must be a positive integer string")
    if expected_producer_run_id is not None and run_id != expected_producer_run_id:
        raise ContractError("runner_isolation producer run_id does not match the source run")
    if (
        expected_producer_repository is not None
        and repository != expected_producer_repository
    ):
        raise ContractError("runner_isolation producer repository does not match the source run")

    inputs = manifest.get("allowed_inputs")
    if not isinstance(inputs, list) or not inputs:
        raise ContractError("runner_isolation allowed_inputs must be a non-empty list")
    normalized_inputs: list[dict[str, str]] = []
    seen: set[str] = set()
    for index, raw in enumerate(inputs):
        item = _object(raw, label=f"runner_isolation allowed_inputs[{index}]")
        _require_exact_fields(
            item,
            ("path", "sha256"),
            label=f"runner_isolation allowed_inputs[{index}]",
        )
        path = _allowed_input_path(
            item.get("path"), label=f"runner_isolation allowed_inputs[{index}] path"
        )
        if path in seen:
            raise ContractError(f"runner_isolation allowed input is duplicated: {path}")
        seen.add(path)
        normalized_inputs.append(
            {
                "path": path,
                "sha256": _sha256(
                    item.get("sha256"),
                    label=f"runner_isolation allowed_inputs[{index}] sha256",
                ),
            }
        )
        source_path = (source_root / path).resolve()
        try:
            source_path.relative_to(source_root.resolve())
        except ValueError as exc:
            raise ContractError(
                f"runner_isolation allowed input escapes source root: {path}"
            ) from exc
        if not source_path.is_file():
            raise ContractError(f"runner_isolation allowed input does not exist: {path}")
        if file_sha256(source_path) != normalized_inputs[-1]["sha256"]:
            raise ContractError(f"runner_isolation allowed input digest is stale: {path}")
    if normalized_inputs != sorted(normalized_inputs, key=lambda item: item["path"]):
        raise ContractError("runner_isolation allowed_inputs must be sorted by path")
    required_paths = required_live_input_paths(runtime_target, source_root=source_root)
    actual_paths = [item["path"] for item in normalized_inputs]
    if actual_paths != required_paths:
        missing = sorted(set(required_paths) - set(actual_paths))
        unexpected = sorted(set(actual_paths) - set(required_paths))
        detail = []
        if missing:
            detail.append(f"missing {missing[0]}")
        if unexpected:
            detail.append(f"unexpected {unexpected[0]}")
        raise ContractError(
            "runner_isolation allowed_inputs must equal the exact readable input closure"
            + (f" ({'; '.join(detail)})" if detail else "")
        )
    supplied_digest = _sha256(
        manifest.get("input_manifest_sha256"),
        label="runner_isolation input_manifest_sha256",
    )
    if supplied_digest != input_manifest_digest(normalized_inputs):
        raise ContractError("runner_isolation input_manifest_sha256 does not match allowed_inputs")

    authorization = require_string(
        manifest.get("external_authorization_ref"),
        label="runner_isolation external_authorization_ref",
        minimum=12,
    )
    if not authorization.startswith("github-actions-environment:") or not authorization.split(
        ":", 1
    )[1].strip():
        raise ContractError(
            "runner_isolation external_authorization_ref must bind a GitHub Actions environment"
        )
    return manifest


def same_isolation_manifest(left: Any, right: Any, *, label: str) -> None:
    if left != right:
        raise ContractError(f"{label} runner_isolation does not match the result artifact")
