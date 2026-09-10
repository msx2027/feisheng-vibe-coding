#!/usr/bin/env python3
"""Shared structural policy for the source-owned runtime manifest."""

from __future__ import annotations

import json
from pathlib import Path, PurePosixPath


RUNTIME_ADAPTER = "references/runtime-adapter.md"
CLAUDE_ENTRY = "assets/project-claude/CLAUDE.md"
TARGET_OVERLAY_DESTINATIONS = {
    "codex": frozenset({
        "agents/openai.yaml",
        "references/studio-codex.md",
        "references/execution-liveness-host.md",
    }),
    "claude-code": frozenset({RUNTIME_ADAPTER, CLAUDE_ENTRY}),
    "gemini-cli": frozenset(),
}
TARGET_ADAPTER_ROOTS = {
    "codex": "packaging/adapters/codex/",
    "claude-code": "packaging/adapters/claude/",
    "gemini-cli": "packaging/adapters/gemini/",
}
CANONICAL_CONSTITUTION_PREFIXES = (
    "assets/project-bootstrap/",
    "assets/project-adoption/",
)


class RuntimeManifestError(ValueError):
    """Raised when a manifest violates the reviewed runtime topology."""


def _normalized_relative(value: object, *, target: str, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise RuntimeManifestError(
            f"{target} overlay {label} must be a non-empty string"
        )
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or ".." in path.parts
        or "\\" in value
        or path.as_posix() != value
    ):
        raise RuntimeManifestError(
            f"{target} overlay {label} must be a normalized relative path: {value}"
        )
    return value


def load_runtime_manifest(source_root: Path) -> dict:
    path = source_root / "packaging/runtime-manifest.json"
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeManifestError(f"invalid runtime manifest: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1:
        raise RuntimeManifestError(
            "runtime manifest must be a schema_version 1 object"
        )

    targets = manifest.get("targets")
    if not isinstance(targets, dict) or set(targets) != set(TARGET_OVERLAY_DESTINATIONS):
        raise RuntimeManifestError(
            "runtime manifest targets must equal the published target contract"
        )

    for target, expected_destinations in TARGET_OVERLAY_DESTINATIONS.items():
        target_data = targets[target]
        if not isinstance(target_data, dict):
            raise RuntimeManifestError(f"runtime target must be an object: {target}")
        overlays = target_data.get("overlay_files")
        if not isinstance(overlays, dict):
            raise RuntimeManifestError(
                f"target overlay_files must be an object: {target}"
            )

        destinations: set[str] = set()
        for raw_source, raw_destination in overlays.items():
            source = _normalized_relative(raw_source, target=target, label="source")
            destination = _normalized_relative(
                raw_destination,
                target=target,
                label="destination",
            )
            if not source.startswith(TARGET_ADAPTER_ROOTS[target]):
                raise RuntimeManifestError(
                    f"{target} overlay source is outside its adapter root: {source}"
                )
            expected_source = f"{TARGET_ADAPTER_ROOTS[target]}{destination}"
            if source != expected_source:
                raise RuntimeManifestError(
                    f"{target} overlay source must preserve its destination role: "
                    f"{source} -> {destination}"
                )
            if not (source_root / source).is_file():
                raise RuntimeManifestError(
                    f"{target} overlay source is missing: {source}"
                )
            if destination in destinations:
                raise RuntimeManifestError(
                    f"{target} overlay destination is duplicated: {destination}"
                )
            if destination.startswith(CANONICAL_CONSTITUTION_PREFIXES):
                raise RuntimeManifestError(
                    f"{target} adapter must not replace a canonical constitution: "
                    f"{destination}"
                )
            destinations.add(destination)

        if destinations != set(expected_destinations):
            raise RuntimeManifestError(
                f"{target} overlay destinations must equal the reviewed target contract"
            )

    claude_overlays = targets["claude-code"]["overlay_files"]
    entry_source = next(
        source
        for source, destination in claude_overlays.items()
        if destination == CLAUDE_ENTRY
    )
    if (source_root / entry_source).read_text(encoding="utf-8") != "@AGENTS.md\n":
        raise RuntimeManifestError(
            "Claude project entry must be exactly '@AGENTS.md\\n'"
        )
    return manifest
