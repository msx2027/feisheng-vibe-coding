#!/usr/bin/env python3
"""Immutable-base minimum runtime asset oracle used only by acceptance.

The builder and source identity intentionally do not import this module. The
minimum accepted path set is expanded from a bound Git object, not from the
candidate manifest or a candidate-maintained duplicate list.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Collection

from governance_baseline import bundle_entries, git_paths
from git_revision import is_full_lowercase_git_commit


BASELINE_MANIFEST = Path("tests/governance/baseline-29695fe.json")


class RuntimeRequiredAssetsError(ValueError):
    """Raised when a runtime candidate omits an immutable baseline asset."""


def baseline_revision(trusted_base_root: Path) -> str:
    path = trusted_base_root / BASELINE_MANIFEST
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeRequiredAssetsError(
            f"trusted runtime baseline manifest is unreadable: {path}"
        ) from exc
    revision = data.get("source_commit") if isinstance(data, dict) else None
    if not is_full_lowercase_git_commit(revision):
        raise RuntimeRequiredAssetsError("trusted runtime baseline revision is invalid")
    return revision


def immutable_required_paths(trusted_base_root: Path, target: str) -> set[str]:
    root = trusted_base_root.resolve()
    revision = baseline_revision(root)
    try:
        entries = bundle_entries(
            root,
            revision,
            target,
            tree_paths=git_paths(root, revision),
        )
    except (ValueError, OSError) as exc:
        raise RuntimeRequiredAssetsError(
            f"trusted runtime baseline Git object is unavailable: {revision}"
        ) from exc
    return set(entries)


def validate_required_runtime_assets(
    manifest: dict[str, Any],
    target: str,
    actual_paths: Collection[str],
    *,
    trusted_base_root: Path,
) -> None:
    """Reject any candidate bundle that removes an immutable-base asset."""

    del manifest
    required = immutable_required_paths(trusted_base_root, target)
    missing = sorted(required - set(actual_paths))
    if missing:
        raise RuntimeRequiredAssetsError(
            "runtime baseline asset removed without trusted external approval: "
            f"{target}:{missing[0]}"
        )
