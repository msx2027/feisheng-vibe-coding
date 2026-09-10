#!/usr/bin/env python3
"""Compute a canonical identity for one source-defined runtime candidate."""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path
from typing import Any

from runtime_file_set import RuntimeFileSetError, runtime_source_entries
from runtime_manifest_contract import RuntimeManifestError, load_runtime_manifest


class RuntimeIdentityError(ValueError):
    """Raised when a source runtime candidate cannot be identified safely."""


def _load_manifest(root: Path) -> dict[str, Any]:
    try:
        return load_runtime_manifest(root)
    except RuntimeManifestError as exc:
        raise RuntimeIdentityError(str(exc)) from exc


def _bundle_entries(root: Path, target: str) -> dict[str, bytes]:
    manifest = _load_manifest(root)
    try:
        sources = runtime_source_entries(root, manifest, target)
    except RuntimeFileSetError as exc:
        raise RuntimeIdentityError(str(exc)) from exc
    return {destination: source.read_bytes() for destination, source in sources.items()}


def source_runtime_digest(root: Path, target: str) -> str:
    """Hash canonical destination-path and byte pairs for a runtime target."""
    root = root.resolve()
    digest = hashlib.sha256()
    digest.update(b"sliver-source-runtime/v1\0")
    for destination, content in sorted(_bundle_entries(root, target).items()):
        encoded = destination.encode("utf-8")
        digest.update(len(encoded).to_bytes(8, "big"))
        digest.update(encoded)
        digest.update(len(content).to_bytes(8, "big"))
        digest.update(content)
    return digest.hexdigest()


def source_revision(root: Path) -> str:
    """Return the Git commit plus cleanliness state for the source checkout."""
    root = root.resolve()
    try:
        commit = subprocess.run(
            ["git", "-C", str(root), "rev-parse", "--verify", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        status = subprocess.run(
            ["git", "-C", str(root), "status", "--porcelain=v1", "--untracked-files=all"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError) as exc:
        raise RuntimeIdentityError(f"source revision is unavailable: {exc}") from exc
    if len(commit) != 40 or any(char not in "0123456789abcdef" for char in commit):
        raise RuntimeIdentityError("source revision is not a full lowercase Git commit")
    return f"git:{commit}:{'dirty' if status else 'clean'}"
