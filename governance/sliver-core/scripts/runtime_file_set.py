#!/usr/bin/env python3
"""Fail-closed source file enumeration for every runtime consumer."""

from __future__ import annotations

import os
import stat
from pathlib import Path, PurePosixPath
from typing import Any, AbstractSet, Iterator


class RuntimeFileSetError(ValueError):
    """Raised when a runtime source path is unsafe or structurally ambiguous."""


def regular_directory_files(
    directory: Path,
    *,
    label: str,
    ignored_directory_names: AbstractSet[str] = frozenset(),
    ignored_file_names: AbstractSet[str] = frozenset(),
    ignored_file_suffixes: AbstractSet[str] = frozenset(),
) -> Iterator[Path]:
    """Yield regular files while rejecting symlinks and special entries."""

    try:
        root_mode = directory.lstat().st_mode
    except OSError as exc:
        raise RuntimeFileSetError(f"{label} is unreadable: {directory}") from exc
    if stat.S_ISLNK(root_mode):
        raise RuntimeFileSetError(f"{label} cannot be a symlink: {directory}")
    if not stat.S_ISDIR(root_mode):
        raise RuntimeFileSetError(f"{label} is not a directory: {directory}")

    def walk(current: Path) -> Iterator[Path]:
        try:
            entries = sorted(os.scandir(current), key=lambda entry: entry.name)
        except OSError as exc:
            raise RuntimeFileSetError(f"{label} is unreadable: {current}") from exc
        for entry in entries:
            path = Path(entry.path)
            try:
                mode = entry.stat(follow_symlinks=False).st_mode
            except OSError as exc:
                raise RuntimeFileSetError(f"{label} entry is unreadable: {path}") from exc
            if stat.S_ISLNK(mode):
                raise RuntimeFileSetError(f"{label} contains a symlink: {path}")
            if stat.S_ISDIR(mode):
                if entry.name in ignored_directory_names:
                    continue
                yield from walk(path)
                continue
            if stat.S_ISREG(mode):
                if (
                    entry.name in ignored_file_names
                    or path.suffix in ignored_file_suffixes
                ):
                    continue
                yield path
                continue
            raise RuntimeFileSetError(f"{label} contains a special file: {path}")

    yield from walk(directory)


def normalized_relative(value: Any, *, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise RuntimeFileSetError(f"{label} must be a non-empty string")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or ".." in path.parts
        or "\\" in value
        or path.as_posix() != value
    ):
        raise RuntimeFileSetError(f"{label} must be a normalized repository-relative path")
    return value


def regular_source_path(
    source_root: Path,
    relative: Any,
    *,
    expected: str,
    label: str,
) -> Path:
    """Return one lexical source path after rejecting symlinks in every component."""

    normalized = normalized_relative(relative, label=label)
    root = source_root.resolve()
    current = root
    parts = PurePosixPath(normalized).parts
    for index, part in enumerate(parts):
        current = current / part
        try:
            mode = current.lstat().st_mode
        except FileNotFoundError as exc:
            raise RuntimeFileSetError(f"{label} is missing: {normalized}") from exc
        if stat.S_ISLNK(mode):
            raise RuntimeFileSetError(f"{label} contains a symlink: {normalized}")
        if index < len(parts) - 1 and not stat.S_ISDIR(mode):
            raise RuntimeFileSetError(f"{label} parent is not a directory: {normalized}")

    mode = current.lstat().st_mode
    if expected == "file" and not stat.S_ISREG(mode):
        raise RuntimeFileSetError(f"{label} is not a regular file: {normalized}")
    if expected == "dir" and not stat.S_ISDIR(mode):
        raise RuntimeFileSetError(f"{label} is not a directory: {normalized}")
    if expected not in {"file", "dir"}:
        raise RuntimeFileSetError(f"unsupported source expectation: {expected}")
    return current


def regular_tree_files(source_root: Path, relative: Any) -> Iterator[Path]:
    """Yield regular files and reject every symlink or special entry in the tree."""

    normalized = normalized_relative(relative, label="runtime source tree")
    tree = regular_source_path(
        source_root,
        normalized,
        expected="dir",
        label="runtime source tree",
    )

    yield from regular_directory_files(
        tree,
        label=f"runtime source tree '{normalized}'",
        ignored_directory_names=frozenset({"__pycache__"}),
        ignored_file_names=frozenset({".DS_Store"}),
        ignored_file_suffixes=frozenset({".pyc"}),
    )


def regular_bundle_files(bundle: Path) -> Iterator[Path]:
    """Yield every bundle file without following or ignoring unsafe entries."""

    yield from regular_directory_files(bundle, label="runtime bundle")


def runtime_source_entries(
    source_root: Path,
    manifest: dict[str, Any],
    target: str,
) -> dict[str, Path]:
    """Map runtime destination paths to safe regular source files."""

    targets = manifest.get("targets")
    if not isinstance(targets, dict) or target not in targets:
        raise RuntimeFileSetError(f"unsupported runtime target: {target}")
    entries: dict[str, Path] = {}

    core_files = manifest.get("core_files")
    if not isinstance(core_files, list):
        raise RuntimeFileSetError("runtime manifest core_files must be a list")
    for relative in core_files:
        normalized = normalized_relative(relative, label="runtime core file")
        entries[normalized] = regular_source_path(
            source_root,
            normalized,
            expected="file",
            label="runtime core file",
        )

    core_trees = manifest.get("core_trees")
    if not isinstance(core_trees, list):
        raise RuntimeFileSetError("runtime manifest core_trees must be a list")
    root = source_root.resolve()
    for relative in core_trees:
        normalized = normalized_relative(relative, label="runtime core tree")
        tree = regular_source_path(
            root,
            normalized,
            expected="dir",
            label="runtime core tree",
        )
        for path in regular_tree_files(root, normalized):
            destination = (PurePosixPath(normalized) / path.relative_to(tree)).as_posix()
            entries[destination] = path

    target_data = targets[target]
    if not isinstance(target_data, dict):
        raise RuntimeFileSetError(f"runtime target must be an object: {target}")
    overlays = target_data.get("overlay_files")
    if not isinstance(overlays, dict):
        raise RuntimeFileSetError(f"runtime target overlay_files must be an object: {target}")
    for source_relative, destination_relative in overlays.items():
        source_normalized = normalized_relative(
            source_relative,
            label=f"{target} overlay source",
        )
        destination = normalized_relative(
            destination_relative,
            label=f"{target} overlay destination",
        )
        entries[destination] = regular_source_path(
            root,
            source_normalized,
            expected="file",
            label=f"{target} overlay source",
        )
    return entries
