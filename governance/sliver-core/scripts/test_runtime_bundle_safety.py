#!/usr/bin/env python3
"""Behavior tests for safe runtime-bundle installation and replacement."""

from __future__ import annotations

import os
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from live_evidence_isolation import required_live_input_paths
from runtime_identity import RuntimeIdentityError, source_runtime_digest
from validation_support import ContractError


SOURCE_ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = SOURCE_ROOT / "scripts/build_runtime_bundle.py"
VALIDATE_SCRIPT = SOURCE_ROOT / "scripts/validate_runtime_bundle.py"


class RuntimeBundleSafetyTests(unittest.TestCase):
    def copy_source(self, destination: Path) -> Path:
        source = destination / "source"
        shutil.copytree(
            SOURCE_ROOT,
            source,
            symlinks=True,
            ignore=shutil.ignore_patterns(".git", "dist", "__pycache__", "*.pyc"),
        )
        return source

    def run_source_builder(
        self, source: Path, output: Path, *, target: str = "codex"
    ) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            [
                sys.executable,
                str(source / "scripts/build_runtime_bundle.py"),
                "--target",
                target,
                "--output",
                str(output),
            ],
            cwd=source,
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )

    def add_internal_file_symlink(self, source: Path) -> Path:
        alias = source / "references/internal-runtime-alias.md"
        alias.symlink_to(source / "references/runtime-adapter.md")
        return alias

    def run_builder(
        self, output: Path, *, target: str = "codex", force: bool = False
    ) -> subprocess.CompletedProcess[str]:
        command = [
            sys.executable,
            str(BUILD_SCRIPT),
            "--target",
            target,
            "--output",
            str(output),
        ]
        if force:
            command.append("--force")
        env = os.environ.copy()
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            command,
            cwd=SOURCE_ROOT,
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )

    def run_validator(
        self, bundle: Path, *, source: Path = SOURCE_ROOT
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(source / "scripts/validate_runtime_bundle.py"),
                str(bundle),
                "--target",
                "codex",
                "--source-root",
                str(source),
                "--trusted-base-root",
                str(SOURCE_ROOT),
            ],
            cwd=source,
            text=True,
            capture_output=True,
            check=False,
        )

    def assert_failed_without_removing(
        self, result: subprocess.CompletedProcess[str], sentinel: Path
    ) -> None:
        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(sentinel.exists(), result.stdout + result.stderr)

    def test_force_rejects_arbitrary_non_sliver_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "sliver-vibe-coding"
            output.mkdir()
            sentinel = output / "personal-notes.txt"
            sentinel.write_text("must survive", encoding="utf-8")

            result = self.run_builder(output, force=True)

            self.assert_failed_without_removing(result, sentinel)

    def test_rejects_symlink_output_without_touching_target(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "real-sliver-vibe-coding"
            target.mkdir()
            sentinel = target / "personal-notes.txt"
            sentinel.write_text("must survive", encoding="utf-8")
            output = root / "sliver-vibe-coding"
            output.symlink_to(target, target_is_directory=True)

            result = self.run_builder(output, force=True)

            self.assert_failed_without_removing(result, sentinel)
            self.assertTrue(output.is_symlink())

    def test_rejects_broad_existing_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "skills"
            output.mkdir()
            sentinel = output / "another-skill.txt"
            sentinel.write_text("must survive", encoding="utf-8")

            result = self.run_builder(output, force=True)

            self.assert_failed_without_removing(result, sentinel)

    def test_rejects_wrong_leaf_for_first_build(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "typo-sliver-vibe-coding"

            result = self.run_builder(output)

            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertFalse(output.exists())

    def test_allows_first_build_for_every_published_target(self) -> None:
        for target in ("codex", "claude-code", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "sliver-vibe-coding"

                result = self.run_builder(output, target=target)

                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertTrue((output / "SKILL.md").is_file())

    def test_studio_host_contract_is_codex_only(self) -> None:
        for target in ("codex", "claude-code", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "sliver-vibe-coding"

                result = self.run_builder(output, target=target)

                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                studio_host = output / "references/studio-codex.md"
                self.assertEqual(studio_host.is_file(), target == "codex")

    def test_execution_liveness_host_contract_is_codex_only(self) -> None:
        for target in ("codex", "claude-code", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "sliver-vibe-coding"

                result = self.run_builder(output, target=target)

                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                liveness_host = output / "references/execution-liveness-host.md"
                self.assertEqual(liveness_host.is_file(), target == "codex")

    def test_runtime_adapter_has_one_direct_entrypoint_for_every_target(self) -> None:
        for target in ("codex", "claude-code", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "sliver-vibe-coding"

                result = self.run_builder(output, target=target)

                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                skill = (output / "SKILL.md").read_text(encoding="utf-8")
                self.assertIn("`references/runtime-adapter.md`", skill)
                runtime_adapter = output / "references/runtime-adapter.md"
                self.assertTrue(runtime_adapter.is_file())
                expected_source = (
                    SOURCE_ROOT
                    / (
                        "packaging/adapters/claude/references/runtime-adapter.md"
                        if target == "claude-code"
                        else "references/runtime-adapter.md"
                    )
                )
                self.assertEqual(runtime_adapter.read_bytes(), expected_source.read_bytes())

    def test_claude_project_entry_is_thin_and_target_scoped(self) -> None:
        for target in ("codex", "claude-code", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "sliver-vibe-coding"

                result = self.run_builder(output, target=target)

                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                claude_entry = output / "assets/project-claude/CLAUDE.md"
                self.assertEqual(claude_entry.is_file(), target == "claude-code")
                if target == "claude-code":
                    self.assertEqual(
                        claude_entry.read_text(encoding="utf-8"),
                        "@AGENTS.md\n",
                    )

    def test_platform_adapters_do_not_replace_canonical_constitutions(self) -> None:
        canonical = (
            "assets/project-bootstrap/AGENTS.md",
            "assets/project-adoption/AGENTS.md",
        )
        for target in ("codex", "claude-code", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temporary:
                output = Path(temporary) / "sliver-vibe-coding"

                result = self.run_builder(output, target=target)

                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                for relative in canonical:
                    self.assertEqual(
                        (output / relative).read_bytes(),
                        (SOURCE_ROOT / relative).read_bytes(),
                    )

    def test_claude_adapter_does_not_ship_a_second_governance_owner(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "sliver-vibe-coding"

            result = self.run_builder(output, target="claude-code")

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertFalse((output / "assets/project-claude-rules").exists())

    def test_force_allows_replacing_empty_expected_leaf(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "sliver-vibe-coding"
            output.mkdir()

            result = self.run_builder(output, force=True)

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue((output / "SKILL.md").is_file())

    def test_force_safely_replaces_existing_sliver_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "sliver-vibe-coding"
            initial = self.run_builder(output)
            self.assertEqual(initial.returncode, 0, initial.stdout + initial.stderr)
            stale = output / "obsolete-runtime-file.txt"
            stale.write_text("old bundle content", encoding="utf-8")

            result = self.run_builder(output, target="gemini-cli", force=True)

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertFalse(stale.exists())
            self.assertTrue((output / "SKILL.md").is_file())
            self.assertFalse((output / "agents/openai.yaml").exists())

    def test_runtime_guardrail_runs_from_project_cwd_without_mutating_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            bundle = root / "runtime" / "sliver-vibe-coding"
            built = self.run_builder(bundle)
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            project = root / "project"
            shutil.copytree(SOURCE_ROOT / "assets/project-bootstrap", project)
            env = os.environ.copy()
            env.pop("PYTHONDONTWRITEBYTECODE", None)
            source_bytecode_before = {
                path.relative_to(SOURCE_ROOT).as_posix()
                for path in SOURCE_ROOT.rglob("*.pyc")
            }

            guardrail = subprocess.run(
                [
                    sys.executable,
                    str(bundle / "scripts/check_project_guardrails.py"),
                    str(project),
                    "--mode",
                    "bootstrap",
                    "--foundation-gate",
                    "contract",
                    "--allow-template",
                    "--skip-private-scan",
                ],
                cwd=project,
                text=True,
                capture_output=True,
                check=False,
                env=env,
            )
            self.assertEqual(guardrail.returncode, 0, guardrail.stdout + guardrail.stderr)
            self.assertFalse(list(bundle.rglob("__pycache__")))
            self.assertFalse(list(bundle.rglob("*.pyc")))

            validated = subprocess.run(
                [
                    sys.executable,
                    str(VALIDATE_SCRIPT),
                    str(bundle),
                    "--target",
                    "codex",
                    "--source-root",
                    str(SOURCE_ROOT),
                ],
                cwd=project,
                text=True,
                capture_output=True,
                check=False,
                env=env,
            )
            self.assertEqual(validated.returncode, 0, validated.stdout + validated.stderr)
            source_bytecode_after = {
                path.relative_to(SOURCE_ROOT).as_posix()
                for path in SOURCE_ROOT.rglob("*.pyc")
            }
            self.assertEqual(source_bytecode_after, source_bytecode_before)

    def test_builder_rejects_non_regular_entries_in_allowlisted_tree(self) -> None:
        mutations = ("file_symlink", "directory_symlink", "dangling_symlink", "fifo")
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = self.copy_source(root)
                if mutation == "file_symlink":
                    self.add_internal_file_symlink(source)
                elif mutation == "directory_symlink":
                    (source / "references/internal-runtime-dir").symlink_to(
                        source / "assets/project-stage",
                        target_is_directory=True,
                    )
                elif mutation == "dangling_symlink":
                    (source / "references/dangling-runtime.md").symlink_to(
                        source / "references/does-not-exist.md"
                    )
                else:
                    os.mkfifo(source / "references/runtime.pipe")

                output = root / "sliver-vibe-coding"
                result = self.run_source_builder(source, output)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse(output.exists(), result.stdout + result.stderr)

    def test_validator_rejects_source_symlink_even_when_bundle_bytes_match(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.copy_source(root)
            output = root / "sliver-vibe-coding"
            built = self.run_source_builder(source, output)
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            alias = self.add_internal_file_symlink(source)
            shutil.copy2(alias, output / "references/internal-runtime-alias.md")

            result = subprocess.run(
                [
                    sys.executable,
                    str(source / "scripts/validate_runtime_bundle.py"),
                    str(output),
                    "--target",
                    "codex",
                    "--source-root",
                    str(source),
                ],
                cwd=source,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_validator_rejects_non_regular_bundle_entries(self) -> None:
        mutations = ("expected_file_symlink", "directory_symlink", "fifo")
        for mutation in mutations:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                bundle = root / "sliver-vibe-coding"
                built = self.run_builder(bundle)
                self.assertEqual(built.returncode, 0, built.stdout + built.stderr)

                if mutation == "expected_file_symlink":
                    external = root / "SKILL.md"
                    (bundle / "SKILL.md").replace(external)
                    (bundle / "SKILL.md").symlink_to(external)
                elif mutation == "directory_symlink":
                    (bundle / "runtime-alias").symlink_to(
                        bundle / "references",
                        target_is_directory=True,
                    )
                else:
                    os.mkfifo(bundle / "runtime.pipe")

                result = self.run_validator(bundle)
                self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_validator_rejects_bundle_root_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            real_bundle = root / "real" / "sliver-vibe-coding"
            built = self.run_builder(real_bundle)
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            alias = root / "sliver-vibe-coding"
            alias.symlink_to(real_bundle, target_is_directory=True)

            result = self.run_validator(alias)
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_independent_oracle_rejects_manifest_omission(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = self.copy_source(root)
            manifest_path = source / "packaging/runtime-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["core_trees"].remove("assets/project-design")
            manifest_path.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            bundle = root / "sliver-vibe-coding"
            built = self.run_source_builder(source, bundle)
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)

            result = self.run_validator(bundle, source=source)
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn(
                "runtime baseline asset removed without trusted external approval",
                result.stdout + result.stderr,
            )

    def test_builder_does_not_import_acceptance_oracle(self) -> None:
        builder_text = BUILD_SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("runtime_required_assets", builder_text)

    def test_runtime_identity_and_live_closure_reject_source_symlink(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            source = self.copy_source(Path(temporary))
            self.add_internal_file_symlink(source)

            with self.assertRaises(RuntimeIdentityError):
                source_runtime_digest(source, "codex")
            with self.assertRaises(ContractError):
                required_live_input_paths("codex", source_root=source)


if __name__ == "__main__":
    unittest.main()
