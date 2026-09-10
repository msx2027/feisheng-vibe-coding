#!/usr/bin/env python3
"""Validate a built Sliver runtime bundle against its source and adapter."""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"

from runtime_file_set import (
    RuntimeFileSetError,
    regular_bundle_files,
    runtime_source_entries,
)
from runtime_manifest_contract import (
    CLAUDE_ENTRY,
    RUNTIME_ADAPTER,
    RuntimeManifestError,
    load_runtime_manifest,
)
from runtime_required_assets import (
    RuntimeRequiredAssetsError,
    validate_required_runtime_assets,
)

DEFAULT_SOURCE_ROOT = Path(__file__).resolve().parents[1]
PORTABLE_CORE_HOST_MARKERS = {
    "Codex product name": re.compile(r"\bcodex\b", re.IGNORECASE),
    "Codex config path": re.compile(r"\.codex(?:/|\b)", re.IGNORECASE),
    "Claude Code product name": re.compile(r"\bclaude\s+code\b", re.IGNORECASE),
    "Claude host entry": re.compile(r"\bclaude\.md\b", re.IGNORECASE),
    "Gemini CLI product name": re.compile(r"\bgemini\s+cli\b", re.IGNORECASE),
    "Gemini host entry": re.compile(r"\bgemini\.md\b", re.IGNORECASE),
}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            value.update(chunk)
    return value.hexdigest()


def expected_files(source_root: Path, manifest: dict, target: str) -> dict[str, Path]:
    return runtime_source_entries(source_root, manifest, target)


def validate_guardrails(bundle: Path) -> None:
    script = bundle / "scripts/check_project_guardrails.py"
    child_env = os.environ.copy()
    child_env["PYTHONDONTWRITEBYTECODE"] = "1"
    checks = [
        ("assets/project-bootstrap", "bootstrap"),
        ("assets/project-adoption", "adoption"),
        ("assets/project-bootstrap", "constitution"),
        ("assets/project-adoption", "constitution"),
    ]
    for relative, mode in checks:
        result = subprocess.run(
            [
                sys.executable,
                str(script),
                str(bundle / relative),
                "--mode",
                mode,
                "--allow-template",
                "--foundation-gate",
                "contract",
                "--skip-private-scan",
            ],
            cwd=bundle,
            text=True,
            capture_output=True,
            check=False,
            env=child_env,
        )
        if result.returncode != 0:
            detail = (result.stdout + result.stderr).strip()
            fail(f"runtime guardrail failed for {relative}/{mode}: {detail}")


def validate_portable_core(
    actual: dict[str, Path], overlay_destinations: set[str]
) -> None:
    """Keep host product names and entry conventions inside adapter-owned files."""
    for relative, path in actual.items():
        if relative in overlay_destinations:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for label, pattern in PORTABLE_CORE_HOST_MARKERS.items():
            if pattern.search(text):
                fail(f"portable runtime core contains {label}: {relative}")


def validate_adapter_contract(
    bundle: Path,
    actual: dict[str, Path],
    targets: dict,
    target: str,
    references: set[str],
) -> set[str]:
    target_data = targets[target]
    overlays = target_data.get("overlay_files", {})
    if not isinstance(overlays, dict):
        fail(f"target overlay_files must be an object: {target}")
    overlay_destinations = set(overlays.values())
    if RUNTIME_ADAPTER not in references or RUNTIME_ADAPTER not in actual:
        fail("every runtime must expose the fixed runtime adapter through SKILL.md")

    if target == "claude-code":
        if CLAUDE_ENTRY not in actual:
            fail("claude-code runtime is missing its thin project entry")
        if (bundle / CLAUDE_ENTRY).read_text(encoding="utf-8") != "@AGENTS.md\n":
            fail("claude-code project entry must be exactly '@AGENTS.md\\n'")
        if any(
            relative == "assets/project-claude-rules"
            or relative.startswith("assets/project-claude-rules/")
            for relative in actual
        ):
            fail("claude-code runtime contains a second governance owner")
    else:
        if CLAUDE_ENTRY in actual:
            fail(f"{target} runtime must not contain the Claude project entry")
    return overlay_destinations


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--target", required=True)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument(
        "--trusted-base-root",
        type=Path,
        help="Git checkout containing the protected immutable runtime baseline",
    )
    args = parser.parse_args()

    bundle = Path(os.path.abspath(args.bundle.expanduser()))
    source_root = args.source_root.expanduser().resolve()
    trusted_base_root = (
        args.trusted_base_root.expanduser().resolve()
        if args.trusted_base_root is not None
        else source_root
    )
    try:
        manifest = load_runtime_manifest(source_root)
    except RuntimeManifestError as exc:
        fail(str(exc))
    targets = manifest.get("targets", {})
    if args.target not in targets:
        fail(f"unknown or unpublished runtime target: {args.target}")
    try:
        actual_files = list(regular_bundle_files(bundle))
        expected = expected_files(source_root, manifest, args.target)
    except RuntimeFileSetError as exc:
        fail(str(exc))
    actual = {
        path.relative_to(bundle).as_posix(): path
        for path in actual_files
    }
    try:
        validate_required_runtime_assets(
            manifest,
            args.target,
            actual,
            trusted_base_root=trusted_base_root,
        )
    except RuntimeRequiredAssetsError as exc:
        fail(str(exc))
    missing = sorted(set(expected) - set(actual))
    extra = sorted(set(actual) - set(expected))
    if missing:
        fail(f"runtime bundle is missing files: {', '.join(missing)}")
    if extra:
        fail(f"runtime bundle contains source-only or unknown files: {', '.join(extra)}")

    forbidden_paths = set(manifest.get("forbidden_runtime_paths", []))
    forbidden_names = set(manifest.get("forbidden_runtime_names", []))
    for relative in actual:
        parts = Path(relative).parts
        if relative in forbidden_paths or (parts and parts[0] in forbidden_paths):
            fail(f"forbidden source/presentation file leaked into runtime: {relative}")
        if any(name in forbidden_names for name in parts):
            fail(f"forbidden source/presentation file leaked into runtime: {relative}")

    for relative, source in expected.items():
        if not source.is_file():
            fail(f"expected source file is missing: {source}")
        if digest(source) != digest(actual[relative]):
            fail(f"runtime file drifted from its owner: {relative}")

    skill_text = (bundle / "SKILL.md").read_text(encoding="utf-8")
    references = set(re.findall(r"`(references/[^`]+?\.md)`", skill_text))
    for relative in references:
        if relative not in actual:
            fail(f"SKILL.md runtime reference is missing: {relative}")
    overlay_destinations = validate_adapter_contract(
        bundle,
        actual,
        targets,
        args.target,
        references,
    )

    has_codex_metadata = "agents/openai.yaml" in actual
    if args.target == "codex" and not has_codex_metadata:
        fail("Codex runtime must contain agents/openai.yaml")
    if args.target != "codex" and has_codex_metadata:
        fail(f"{args.target} runtime must not contain Codex metadata")

    validate_portable_core(actual, overlay_destinations)
    validate_guardrails(bundle)
    print(
        f"OK: {args.target} runtime bundle validated ({len(actual)} files); "
        "static/package proof only, fresh-session behavior not evaluated"
    )


if __name__ == "__main__":
    main()
