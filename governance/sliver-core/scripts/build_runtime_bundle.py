#!/usr/bin/env python3
"""Build a clean Sliver runtime bundle from the source allowlist."""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

from runtime_file_set import RuntimeFileSetError, runtime_source_entries
from runtime_manifest_contract import RuntimeManifestError, load_runtime_manifest


SOURCE_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_OUTPUT_LEAF = "sliver-vibe-coding"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def load_manifest() -> dict:
    try:
        return load_runtime_manifest(SOURCE_ROOT)
    except RuntimeManifestError as exc:
        fail(str(exc))


def copy_file(source: Path, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return 1


def has_sliver_identity(path: Path) -> bool:
    """Recognize a previously built Sliver bundle without executing its files."""
    if not path.is_dir() or path.is_symlink():
        return False
    required = (path / "SKILL.md", path / "LICENSE", path / "VERSION")
    if any(not item.is_file() or item.is_symlink() for item in required):
        return False
    try:
        lines = required[0].read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        return False
    if not lines or lines[0].strip() != "---":
        return False
    for line in lines[1:]:
        if line.strip() == "---":
            break
        key, separator, value = line.partition(":")
        if separator and key.strip() == "name":
            return value.strip().strip("\"'") == EXPECTED_OUTPUT_LEAF
    return False


def is_empty_directory(path: Path) -> bool:
    try:
        next(path.iterdir())
    except StopIteration:
        return True
    return False


def prepare_output(raw_output: Path, force: bool) -> tuple[Path, str | None, os.stat_result | None]:
    """Validate the install target before any directory can be replaced."""
    lexical = Path(os.path.abspath(raw_output.expanduser()))
    if lexical.name != EXPECTED_OUTPUT_LEAF:
        fail(f"output leaf must be exactly '{EXPECTED_OUTPUT_LEAF}': {lexical}")
    if lexical.is_symlink():
        fail(f"output cannot be a symlink: {lexical}")

    output = lexical.resolve()
    if output == SOURCE_ROOT:
        fail("output cannot replace the source root")
    if inside(output, SOURCE_ROOT):
        relative = output.relative_to(SOURCE_ROOT)
        if not relative.parts or relative.parts[0] != "dist":
            fail("output inside the source repository must be under dist/")

    if not output.exists():
        return output, None, None
    if not output.is_dir():
        fail(f"output exists and is not a directory: {output}")
    if not force:
        fail(f"output already exists; pass --force to replace it: {output}")

    identity = output.lstat()
    if is_empty_directory(output):
        return output, "empty", identity
    if not has_sliver_identity(output):
        fail(f"refusing to replace a non-Sliver directory: {output}")
    return output, "bundle", identity


def populate_bundle(manifest: dict, target_name: str, output: Path) -> int:
    try:
        entries = runtime_source_entries(SOURCE_ROOT, manifest, target_name)
    except RuntimeFileSetError as exc:
        fail(str(exc))
    for destination, source in sorted(entries.items()):
        copy_file(source, output / destination)
    return len(entries)


def remove_replaced_output(path: Path, previous_kind: str) -> None:
    """Remove only the already-validated directory moved aside by this process."""
    if previous_kind == "empty":
        path.rmdir()
        return
    if previous_kind != "bundle" or not has_sliver_identity(path):
        fail(f"replaced output was retained because its identity changed: {path}")
    shutil.rmtree(path)


def install_staging(
    staging: Path,
    output: Path,
    previous_kind: str | None,
    previous_identity: os.stat_result | None,
) -> None:
    if previous_kind is None:
        os.replace(staging, output)
        return

    current_identity = output.lstat()
    if previous_identity is None or (
        current_identity.st_dev,
        current_identity.st_ino,
    ) != (previous_identity.st_dev, previous_identity.st_ino):
        fail(f"output changed after validation; refusing replacement: {output}")

    backup = output.parent / f".{output.name}.backup-{uuid.uuid4().hex}"
    os.replace(output, backup)
    try:
        os.replace(staging, output)
    except BaseException as install_error:
        try:
            os.replace(backup, output)
        except OSError as restore_error:
            fail(
                "install failed and automatic restore also failed; "
                f"the previous output remains at {backup}: {install_error}; {restore_error}"
            )
        raise
    remove_replaced_output(backup, previous_kind)


def main() -> None:
    manifest = load_manifest()
    targets = manifest.get("targets", {})
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=sorted(targets))
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--force", action="store_true", help="replace an existing output directory")
    args = parser.parse_args()

    output, previous_kind, previous_identity = prepare_output(args.output, args.force)
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(
        tempfile.mkdtemp(prefix=f".{output.name}.staging-", dir=output.parent)
    )
    try:
        copied = populate_bundle(manifest, args.target, staging)
        install_staging(staging, output, previous_kind, previous_identity)
    finally:
        if staging.exists():
            shutil.rmtree(staging)

    print(f"OK: built {args.target} runtime bundle ({copied} files): {output}")


if __name__ == "__main__":
    main()
