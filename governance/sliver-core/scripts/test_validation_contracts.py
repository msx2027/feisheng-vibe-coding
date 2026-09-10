#!/usr/bin/env python3
"""Negative tests for validation parsers and contract boundaries."""

from __future__ import annotations

import ast
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from io import StringIO
from pathlib import Path

import check_project_guardrails
import evaluate_execution_liveness_live_behavior as execution_liveness
import evaluate_routes
from live_evidence_isolation import (
    build_allowed_inputs,
    input_manifest_digest,
    validate_isolation_manifest,
)
from runtime_identity import source_revision, source_runtime_digest
from validation_support import (
    ContractError,
    active_markdown,
    load_json_object,
    markdown_section,
    require_prompt,
    require_string_list,
    safe_repo_path,
    split_table_row,
)


ROOT = Path(__file__).resolve().parents[1]


class MarkdownContractTests(unittest.TestCase):
    def test_live_isolation_rejects_an_extra_readable_input(self) -> None:
        revision = "git:" + "b" * 40 + ":clean"
        runtime_digest = "a" * 64
        allowed_inputs = build_allowed_inputs("codex", source_root=ROOT)
        extra = {"path": "README.md", "sha256": hashlib.sha256((ROOT / "README.md").read_bytes()).hexdigest()}
        self.assertNotIn(extra["path"], {item["path"] for item in allowed_inputs})
        allowed_inputs.append(extra)
        allowed_inputs.sort(key=lambda item: item["path"])
        manifest = {
            "schema": "sliver-live-evidence-isolation/v1",
            "environment": "github_hosted_ephemeral",
            "workspace_origin": "versioned_synthetic_fixture",
            "source_revision": revision,
            "runtime_digest": runtime_digest,
            "producer": {"kind": "github_actions", "repository": "example/sliver", "workflow_path": ".github/workflows/live.yml", "run_id": "123"},
            "isolated_home": True,
            "isolated_runtime_home": True,
            "user_config_loaded": False,
            "user_rules_loaded": False,
            "global_memory_mounted": False,
            "global_skills_mounted": False,
            "plugins_enabled": False,
            "session_history_mounted": False,
            "personal_projects_mounted": False,
            "allowed_inputs": allowed_inputs,
            "input_manifest_sha256": input_manifest_digest(allowed_inputs),
            "external_authorization_ref": "synthetic-test",
            "privacy_scan_status": "passed",
            "cleanup_status": "complete",
        }
        with self.assertRaisesRegex(ContractError, "exact readable input closure"):
            validate_isolation_manifest(
                manifest,
                source_revision=revision,
                runtime_target="codex",
                runtime_digest=runtime_digest,
                source_root=ROOT,
            )

    def test_comments_and_fences_are_not_active_truth(self) -> None:
        text = "before\n<!-- hidden -->\n```md\nfenced\n```\nafter"
        self.assertEqual(active_markdown(text), "before\n\nafter")

    def test_commented_section_is_missing(self) -> None:
        text = "<!--\n## Primary Workflow Routes\n| `开发执行` | owner | `references/x.md` |\n-->"
        self.assertIsNone(markdown_section(text, "Primary Workflow Routes"))

    def test_fenced_section_is_missing(self) -> None:
        text = "```md\n## Primary Workflow Routes\n| `开发执行` | owner | `references/x.md` |\n```"
        self.assertIsNone(markdown_section(text, "Primary Workflow Routes"))

    def test_comment_markers_inside_fence_are_ignored(self) -> None:
        text = "before\n```html\n<!-- example without terminator\n```\nafter"
        self.assertEqual(active_markdown(text), "before\nafter")

    def test_indented_code_section_is_missing(self) -> None:
        text = "    ## Primary Workflow Routes\n    | `开发执行` | owner | `references/x.md` |"
        self.assertIsNone(markdown_section(text, "Primary Workflow Routes"))

    def test_comment_markers_inside_indented_code_are_ignored(self) -> None:
        text = "before\n    <!-- example without terminator\nafter"
        self.assertEqual(active_markdown(text), "before\nafter")

    def test_unclosed_comment_fails(self) -> None:
        with self.assertRaisesRegex(ContractError, "unclosed HTML comment"):
            active_markdown("before\n<!-- hidden")

    def test_duplicate_sections_fail(self) -> None:
        with self.assertRaisesRegex(ContractError, "duplicate Markdown section"):
            markdown_section("## Security\none\n## Security\ntwo", "Security")

    def test_duplicate_route_keys_fail(self) -> None:
        section = "\n".join(
            [
                "| Route | Goal | Load |",
                "| --- | --- | --- |",
                "| `开发执行` | one | `references/a.md` |",
                "| `开发执行` | two | `references/b.md` |",
            ]
        )
        with redirect_stdout(StringIO()), self.assertRaises(SystemExit):
            evaluate_routes.table_rows(section)

    def test_escaped_pipe_does_not_create_a_cell(self) -> None:
        self.assertEqual(split_table_row("| key | visible \\| text | owner |"), ["key", "visible \\| text", "owner"])


class ExecutionLivenessPrivacyContractTests(unittest.TestCase):
    def test_zero_origin_rejects_every_forbidden_raw_evidence_key(self) -> None:
        required = {
            "command",
            "cwd",
            "stdout",
            "stderr",
            "env",
            "environment",
            "transcript_path",
            "raw_response",
            "raw_tool_output",
            "tool_response",
            "full_transcript",
            "provider_key",
            "credential",
        }
        self.assertTrue(required.issubset(execution_liveness.FORBIDDEN_FIELDS))
        for key in required:
            with self.subTest(key=key), self.assertRaisesRegex(
                execution_liveness.LivenessContractError,
                "forbidden raw-evidence fields",
            ):
                execution_liveness.validate_zero_origin_value(
                    {"nested": {key: "synthetic"}}, label="synthetic"
                )

    def test_zero_origin_rejects_cross_platform_absolute_home_paths(self) -> None:
        synthetic_paths = (
            "/Users/synthetic/project",
            "/home/synthetic/project",
            "/root/project",
            r"C:\Users\synthetic\project",
            r"z:\Users\synthetic\project",
        )
        for value in synthetic_paths:
            with self.subTest(value=value), self.assertRaisesRegex(
                execution_liveness.LivenessContractError,
                "local home path",
            ):
                execution_liveness.validate_zero_origin_value(value, label="synthetic")

    def test_result_schema_and_evaluator_share_one_forbidden_field_closure(self) -> None:
        schema = json.loads(
            (ROOT / "tests/execution-liveness-live-result-schema.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(set(schema["forbidden_fields"]), execution_liveness.FORBIDDEN_FIELDS)

    def test_result_schema_forbidden_field_drift_fails_closed(self) -> None:
        valid = {"forbidden_fields": sorted(execution_liveness.FORBIDDEN_FIELDS)}
        execution_liveness.validate_forbidden_fields_contract(valid)
        for fields in (
            sorted(execution_liveness.FORBIDDEN_FIELDS - {"command"}),
            [*sorted(execution_liveness.FORBIDDEN_FIELDS), "unexpected_field"],
            [*sorted(execution_liveness.FORBIDDEN_FIELDS), "command"],
        ):
            with self.subTest(fields=fields), self.assertRaisesRegex(
                execution_liveness.LivenessContractError,
                "closed set",
            ):
                execution_liveness.validate_forbidden_fields_contract(
                    {"forbidden_fields": fields}
                )


class InputContractTests(unittest.TestCase):
    def test_scripts_parse_with_python_39_grammar(self) -> None:
        paths = [
            *sorted((ROOT / "scripts").glob("*.py")),
            ROOT / "plugins/sliver-session-continuity/hooks/continuity.py",
        ]
        for path in paths:
            with self.subTest(path=str(path.relative_to(ROOT))):
                ast.parse(path.read_text(encoding="utf-8"), filename=str(path), feature_version=(3, 9))

    def test_repository_paths_cannot_escape(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            with self.assertRaises(ContractError):
                safe_repo_path(root, "../outside.md")
            with self.assertRaises(ContractError):
                safe_repo_path(root, "/etc/hosts")

    def test_json_contract_must_be_an_object(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "contract.json"
            path.write_text("[]", encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "must be an object"):
                load_json_object(path)

    def test_malformed_json_contract_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "contract.json"
            path.write_text("{", encoding="utf-8")
            with self.assertRaisesRegex(ContractError, "invalid JSON"):
                load_json_object(path)

    def test_corpus_lists_reject_duplicate_prompts(self) -> None:
        with self.assertRaisesRegex(ContractError, "duplicate items"):
            require_string_list(["同一个说法", "同一个说法"], label="prompts")

    def test_prompts_need_real_content(self) -> None:
        with self.assertRaisesRegex(ContractError, "at least 2 characters"):
            require_prompt("x", label="prompt")
        self.assertEqual(require_prompt("继续做", label="prompt"), "继续做")


class GuardrailMutationTests(unittest.TestCase):
    def test_stage_prose_without_schema_requires_migration(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            stage_file = root / "stage.md"
            stage_file.write_text(
                "阶段目标 范围 不做什么 验证 停止条件 未验证\n",
                encoding="utf-8",
            )
            result = check_project_guardrails.check_project(
                root=root,
                mode="stage",
                truth_dir="dev-docs",
                allow_template=False,
                stage_file="stage.md",
                skip_private_scan=True,
                stage_gate="plan",
            )
            self.assertFalse(result["ok"])
            self.assertEqual(result["contract_status"], "MIGRATION_REQUIRED")
            self.assertEqual(result["contract_exit_code"], 3)

    def test_commented_security_section_does_not_pass(self) -> None:
        source = ROOT / "assets/project-bootstrap/AGENTS.md"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            text = source.read_text(encoding="utf-8")
            text = text.replace("## 安全红线", "<!--\n## 安全红线", 1) + "\n-->\n"
            (root / "AGENTS.md").write_text(text, encoding="utf-8")
            result = check_project_guardrails.check_project(
                root=root,
                mode="constitution",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            self.assertFalse(result["ok"])
            self.assertIn("missing_required_section_snippets", result["failures"])

    def test_indented_security_section_does_not_pass(self) -> None:
        source = ROOT / "assets/project-bootstrap/AGENTS.md"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            text = source.read_text(encoding="utf-8")
            start = text.index("## 安全红线")
            end = text.find("\n## ", start + 1)
            end = len(text) if end < 0 else end
            section = "\n".join(f"    {line}" for line in text[start:end].splitlines())
            text = f"{text[:start]}{section}{text[end:]}"
            (root / "AGENTS.md").write_text(text, encoding="utf-8")
            result = check_project_guardrails.check_project(
                root=root,
                mode="constitution",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            self.assertFalse(result["ok"])
            self.assertIn("missing_required_section_snippets", result["failures"])

    def test_constitution_without_test_decision_gate_does_not_pass(self) -> None:
        source = ROOT / "assets/project-bootstrap/AGENTS.md"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            lines = source.read_text(encoding="utf-8").splitlines()
            text = "\n".join(
                line
                for line in lines
                if "测试门禁" not in line and "测试必须验证" not in line
            )
            (root / "AGENTS.md").write_text(text, encoding="utf-8")
            result = check_project_guardrails.check_project(
                root=root,
                mode="constitution",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            self.assertFalse(result["ok"])
            self.assertIn("missing_required_snippets", result["failures"])

    def test_reversed_test_governance_does_not_pass(self) -> None:
        source = ROOT / "assets/project-bootstrap/AGENTS.md"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            text = source.read_text(encoding="utf-8")
            start = text.index("## 测试与验证")
            end = text.find("\n## ", start + 1)
            end = len(text) if end < 0 else end
            reversed_section = """## 测试与验证

- 实现改动前，测试门禁、稳定可自动化、RED、GREEN 均可按需跳过。
- 真实 owner、mock 和零测试只需出现在文档里。
"""
            text = f"{text[:start]}{reversed_section}{text[end:]}"
            (root / "AGENTS.md").write_text(text, encoding="utf-8")
            result = check_project_guardrails.check_project(
                root=root,
                mode="constitution",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            self.assertFalse(result["ok"])
            self.assertIn("forbidden_section_patterns", result["failures"])

    def test_softened_test_governance_does_not_pass(self) -> None:
        source = ROOT / "assets/project-bootstrap/AGENTS.md"
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            text = source.read_text(encoding="utf-8")
            start = text.index("## 测试与验证")
            end = text.find("\n## ", start + 1)
            end = len(text) if end < 0 else end
            softened_section = """## 测试与验证

- 实现改动前的测试门禁对稳定可自动化行为的 RED、GREEN 仅供参考，不强制执行。
- 真实 owner、mock 和零测试只需出现在文档里。
"""
            text = f"{text[:start]}{softened_section}{text[end:]}"
            (root / "AGENTS.md").write_text(text, encoding="utf-8")
            result = check_project_guardrails.check_project(
                root=root,
                mode="constitution",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            self.assertFalse(result["ok"])
            self.assertIn("forbidden_section_patterns", result["failures"])


class StageTruthGateTests(unittest.TestCase):
    def write_stage(self, root: Path, text: str) -> None:
        (root / "stage.md").write_text(text, encoding="utf-8")

    def check(self, root: Path, gate: str) -> dict:
        return check_project_guardrails.check_project(
            root=root,
            mode="stage",
            truth_dir="dev-docs",
            allow_template=False,
            stage_file="stage.md",
            skip_private_scan=True,
            stage_gate=gate,
        )

    def test_stage_v2_plan_is_structural_only(self) -> None:
        from test_stage_v2_contracts import stage_v2_text

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v2_text())
            result = self.check(root, "plan")
            self.assertTrue(result["ok"], result)
            self.assertTrue(result["structural_gate_met"])
            self.assertFalse(result["completion_claim_allowed"])

    def test_legacy_stage_requires_explicit_migration(self) -> None:
        from test_stage_v2_contracts import stage_v1_text

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v1_text())
            result = self.check(root, "plan")
            self.assertFalse(result["ok"])
            self.assertEqual(result["contract_status"], "MIGRATION_REQUIRED")
            self.assertEqual(result["contract_exit_code"], 3)

    def test_stage_cli_returns_migration_exit_3(self) -> None:
        from test_stage_v2_contracts import stage_v1_text

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v1_text())
            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/check_project_guardrails.py"),
                    str(root),
                    "--mode",
                    "stage",
                    "--stage-file",
                    "stage.md",
                    "--stage-gate",
                    "plan",
                    "--json",
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 3, result.stdout + result.stderr)
            self.assertIn("MIGRATION_REQUIRED", result.stdout)

    def test_stage_cli_requires_explicit_gate(self) -> None:
        from test_stage_v2_contracts import stage_v2_text

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_stage(root, stage_v2_text())
            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/check_project_guardrails.py"),
                    str(root),
                    "--mode",
                    "stage",
                    "--stage-file",
                    "stage.md",
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("--stage-gate is required", result.stderr)



class FoundationDecisionGateTests(unittest.TestCase):
    def copied_foundation(self, root: Path) -> None:
        truth = root / "dev-docs"
        truth.mkdir(parents=True)
        for name in ("technical-selection.md", "architecture.md"):
            source = ROOT / "assets/project-bootstrap/dev-docs" / name
            shutil.copy2(source, truth / name)

    def set_control(self, path: Path, **values: str) -> None:
        text = path.read_text(encoding="utf-8")
        for key, value in values.items():
            text = re.sub(
                rf"^- {re.escape(key)}: .*?$",
                f"- {key}: {value}",
                text,
                count=1,
                flags=re.M,
            )
        path.write_text(text, encoding="utf-8")

    def test_bundled_foundation_starts_blocked_not_ready(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.copied_foundation(root)
            result = check_project_guardrails.check_foundation_file(
                root,
                "dev-docs",
                allow_template=True,
            )
            self.assertEqual(result["foundation_values"].get("decision_status"), "blocked")
            self.assertNotIn("decision_status", result["foundation_invalid_fields"])
            self.assertNotIn(
                "architecture foundation_decision_status does not match technical selection",
                result["foundation_gate_blockers"],
            )

    def test_recommendation_ready_does_not_require_product_consequence_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.copied_foundation(root)
            technical = root / "dev-docs/technical-selection.md"
            architecture = root / "dev-docs/architecture.md"
            self.set_control(
                technical,
                decision_status="recommendation_ready",
                source_coverage="complete",
                blocking_unknowns="none",
                source_conflicts="none",
                network_evidence="verified_current: https://example.com/official checked 2026-07-16",
                poc_status="not_required: current primary evidence closes the critical uncertainty",
                recommendation="primary",
                decision_record="complete: one evidence-backed combination recorded",
            )
            self.set_control(architecture, foundation_decision_status="blocked")
            result = check_project_guardrails.check_foundation_file(
                root,
                "dev-docs",
                allow_template=True,
            )
            self.assertNotIn(
                "implementation_ready requires confirmed product consequences",
                result["foundation_gate_blockers"],
            )

    def test_implementation_ready_requires_confirmed_product_consequences(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.copied_foundation(root)
            technical = root / "dev-docs/technical-selection.md"
            architecture = root / "dev-docs/architecture.md"
            self.set_control(
                technical,
                decision_status="implementation_ready",
                source_coverage="complete",
                blocking_unknowns="none",
                source_conflicts="none",
                network_evidence="verified_current: https://example.com/official checked 2026-07-16",
                poc_status="not_required: current primary evidence closes the critical uncertainty",
                recommendation="primary",
                decision_record="complete: one evidence-backed combination recorded",
            )
            self.set_control(architecture, foundation_decision_status="implementation_ready")
            result = check_project_guardrails.check_foundation_file(
                root,
                "dev-docs",
                allow_template=True,
            )
            self.assertIn(
                "implementation_ready requires confirmed product consequences",
                result["foundation_gate_blockers"],
            )


class EndToEndMutationTests(unittest.TestCase):
    def copy_repo(self, temp: str) -> Path:
        target = Path(temp) / "repo"
        shutil.copytree(
            ROOT,
            target,
            ignore=shutil.ignore_patterns(".git", "__pycache__", ".DS_Store"),
        )
        return target

    def run_validator(self, script: str, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-B", str(ROOT / "scripts" / script), str(root)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

    def run_source_script(self, root: Path, script: str, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(root / "scripts" / script), *args],
            cwd=root,
            text=True,
            capture_output=True,
            check=False,
        )

    def assert_validation_failed_for(
        self,
        result: subprocess.CompletedProcess[str],
        expected_message: str,
    ) -> None:
        output = result.stdout + result.stderr
        self.assertNotEqual(result.returncode, 0, output)
        self.assertIn(expected_message, output)

    def test_missing_startup_protocol_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            text = text.replace("## Startup Protocol", "## Removed Startup Protocol", 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_missing_plugin_marketplace_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            (root / ".agents/plugins/marketplace.json").unlink()
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_plugin_marketplace_contract_drift_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / ".agents/plugins/marketplace.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["plugins"][0]["source"]["path"] = "./plugins/wrong-plugin"
            path.write_text(json.dumps(data), encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_plugin_install_owner_missing_hook_review_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "plugins/sliver-session-continuity/README.md"
            text = path.read_text(encoding="utf-8").replace(
                "enter `/hooks`",
                "open the review screen",
                1,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_push_ci_missing_studio_gate_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / ".github/workflows/validate.yml"
            text = path.read_text(encoding="utf-8")
            text = text.replace(
                "      - run: python3 -B scripts/validate_release_candidate.py --contract-only\n",
                "",
                1,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_incomplete_startup_protocol_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            text = text.replace("Select exactly one primary route", "Select a route", 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_missing_registry_link_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            self.assertEqual(text.count("route-catalog --format json"), 1)
            text = text.replace("route-catalog --format json", "list routes", 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_second_route_table_in_skill_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            text += "\n## Primary Workflow Routes\n\n| Route | Purpose | Load |\n| --- | --- | --- |\n| `开发执行` | duplicate | `references/routes-feature.md` |\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_slash_route_alias_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            text = text.replace("| `开发执行` |", "| `/开发执行` |", 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("validate_skill.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_commented_route_table_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            text = text.replace("## Primary Workflow Routes", "<!--\n## Primary Workflow Routes", 1)
            text = text.replace("## Conditional Development Lenses", "-->\n## Conditional Development Lenses", 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_indented_route_table_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            start = text.index("## Primary Workflow Routes")
            end = text.index("## Conditional Development Lenses", start)
            section = "\n".join(f"    {line}" for line in text[start:end].splitlines()) + "\n\n"
            path.write_text(f"{text[:start]}{section}{text[end:]}", encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_route_operation_delivery_projection_drift_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            changed = text.replace("`audit` -> `audit`", "`audit` -> `decision`", 1)
            self.assertNotEqual(changed, text)
            path.write_text(changed, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("operation/delivery projection drifted", result.stdout)

    def test_new_primary_route_is_owned_by_registry_and_corpus_only(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            registry = root / "references/routes-index.md"
            registry_text = registry.read_text(encoding="utf-8")
            anchor = "\n\n## Internal Operations And Gates"
            synthetic_row = (
                "| `合成新路由` | Exercise registry-owned route extensibility. "
                "| `audit` -> `audit` | Base: `references/routes-intake.md`. |"
            )
            self.assertIn(anchor, registry_text)
            registry.write_text(
                registry_text.replace(anchor, "\n" + synthetic_row + anchor, 1),
                encoding="utf-8",
            )

            cases_path = root / "tests/route-eval-cases.json"
            cases = json.loads(cases_path.read_text(encoding="utf-8"))
            cases["cases"].append(
                {
                    "name": "synthetic-registry-owned-route",
                    "user": "审计这个合成路由的注册表归属",
                    "expected_entry": "合成新路由",
                    "expected_operation": "audit",
                    "expected_delivery_kind": "audit",
                    "expected_files": ["references/routes-intake.md"],
                    "required_reference_terms": [],
                }
            )
            cases_path.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")

            structure = self.run_validator("validate_skill.py", root)
            routes = self.run_validator("evaluate_routes.py", root)
            self.assertEqual(structure.returncode, 0, structure.stdout + structure.stderr)
            self.assertEqual(routes.returncode, 0, routes.stdout + routes.stderr)

    def test_unconditional_lens_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            text = text.replace(
                "Money, paid value, plan, order, subscription, entitlement, paid quota, refund, cancel, expiry, invoice, or paid access changes.",
                "User-visible layout changes; apply to each change.",
                1,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_default_mandatory_lens_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            original = "Money, paid value, plan, order, subscription, entitlement, paid quota, refund, cancel, expiry, invoice, or paid access changes."
            text = text.replace(original, f"{original} This check is mandatory by default.", 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_cross_domain_lens_condition_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            original = "Money, paid value, plan, order, subscription, entitlement, paid quota, refund, cancel, expiry, invoice, or paid access changes."
            replacement = "Page layout changes containing money, entitlement, or refund wording."
            text = text.replace(original, replacement, 1)
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_competing_specialist_entry_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            text += "\n收费权益设计 is a separate route that users should enter before normal development.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_specialist_first_sequence_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            text += "\nFor paid features, use a monetization check first, then continue normal development.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_empty_route_prompts_fail_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/route-eval-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            for case in data["cases"]:
                case["user"] = "x"
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_routes.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_selector_corpus_cannot_require_literal_description_terms(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/selector-pressure-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["families"][0]["description_required"] = True
            data["families"][0]["description_terms"] = ["advance a software project"]
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_selector_pressure.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_external_execution_owner_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/execution-backbone-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["pressure_cases"][0]["owner_files"] = ["/etc/hosts"]
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_development_route_cannot_drop_test_decision_owner(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-index.md"
            text = path.read_text(encoding="utf-8")
            development_row = next(
                line for line in text.splitlines() if line.startswith("| `开发执行`")
            )
            changed_row = development_row.replace(
                "`references/testing-strategy.md`, ", "", 1
            )
            self.assertNotEqual(changed_row, development_row)
            path.write_text(text.replace(development_row, changed_row, 1), encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_development_d0_loading_budget_is_release_blocking(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/execution-backbone-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["development_loading_contract"]["d0_max_bytes"] = 1
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("D0 base loading budget exceeded", result.stdout)

    def test_execution_corpus_cannot_restore_a_second_route_owner_map(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/execution-backbone-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["required_skill_routes"] = {
                "开发执行": ["references/engineering-execution.md"]
            }
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("duplicate route-to-owner mapping", result.stdout)

    def test_user_correction_evidence_gate_is_required_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/engineering-execution.md"
            text = path.read_text(encoding="utf-8")
            self.assertIn("## User Correction Evidence Gate", text)
            text = re.sub(
                r"\n## User Correction Evidence Gate\n.*?(?=\n## |\Z)",
                "\n",
                text,
                count=1,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_missing_fixed_runtime_adapter_link_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "SKILL.md"
            text = path.read_text(encoding="utf-8")
            start = text.index("## Platform Boundary")
            end = text.index("## Studio Mode", start)
            section = text[start:end]
            link = "`references/runtime-adapter.md`"
            self.assertEqual(section.count(link), 1)
            path.write_text(
                f"{text[:start]}{section.replace(link, 'the runtime adapter', 1)}{text[end:]}",
                encoding="utf-8",
            )

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "Platform Boundary must own exactly one fixed runtime adapter link",
            )

    def test_wrong_claude_runtime_overlay_destination_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "packaging/runtime-manifest.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            overlays = data["targets"]["claude-code"]["overlay_files"]
            source = "packaging/adapters/claude/references/runtime-adapter.md"
            self.assertIn(source, overlays)
            overlays[source] = "references/claude-code-runtime.md"
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "claude-code overlay source must preserve its destination role",
            )

    def test_missing_claude_entry_overlay_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "packaging/runtime-manifest.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            overlays = data["targets"]["claude-code"]["overlay_files"]
            source = "packaging/adapters/claude/assets/project-claude/CLAUDE.md"
            self.assertIn(source, overlays)
            overlays.pop(source)
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "claude-code overlay destinations must equal the reviewed target contract",
            )

    def test_claude_overlay_on_non_claude_target_fails(self) -> None:
        for target in ("codex", "gemini-cli"):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as temp:
                root = self.copy_repo(temp)
                path = root / "packaging/runtime-manifest.json"
                data = json.loads(path.read_text(encoding="utf-8"))
                data["targets"][target]["overlay_files"][
                    "packaging/adapters/claude/assets/project-claude/CLAUDE.md"
                ] = "assets/project-claude/CLAUDE.md"
                path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

                result = self.run_validator("validate_skill.py", root)

                self.assert_validation_failed_for(
                    result,
                    f"{target} overlay source is outside its adapter root",
                )

    def test_non_claude_target_cannot_replace_fixed_runtime_adapter(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "packaging/runtime-manifest.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["targets"]["gemini-cli"]["overlay_files"][
                "packaging/adapters/trae/README.md"
            ] = "references/runtime-adapter.md"
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "gemini-cli overlay source is outside its adapter root",
            )

    def test_codex_overlay_role_swap_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "packaging/runtime-manifest.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            overlays = data["targets"]["codex"]["overlay_files"]
            openai_source = "packaging/adapters/codex/agents/openai.yaml"
            studio_source = "packaging/adapters/codex/references/studio-codex.md"
            overlays[openai_source], overlays[studio_source] = (
                overlays[studio_source],
                overlays[openai_source],
            )
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "codex overlay source must preserve its destination role",
            )

    def test_codex_overlay_same_tail_cannot_impersonate_owner(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            canonical_relative = "packaging/adapters/codex/agents/openai.yaml"
            impersonator_relative = (
                "packaging/adapters/codex/backup/agents/openai.yaml"
            )
            impersonator = root / impersonator_relative
            impersonator.parent.mkdir(parents=True)
            shutil.copy2(root / canonical_relative, impersonator)

            path = root / "packaging/runtime-manifest.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            overlays = data["targets"]["codex"]["overlay_files"]
            destination = overlays.pop(canonical_relative)
            overlays[impersonator_relative] = destination
            path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "codex overlay source must preserve its destination role",
            )

    def test_codex_liveness_overlay_is_exactly_allowlisted(self) -> None:
        data = json.loads(
            (ROOT / "packaging/runtime-manifest.json").read_text(encoding="utf-8")
        )
        overlays = data["targets"]["codex"]["overlay_files"]
        expected_destinations = {
            "agents/openai.yaml",
            "references/studio-codex.md",
            "references/execution-liveness-host.md",
        }
        self.assertEqual(set(overlays.values()), expected_destinations)
        self.assertEqual(
            set(overlays),
            {
                f"packaging/adapters/codex/{destination}"
                for destination in expected_destinations
            },
        )

    def test_arbitrary_fourth_codex_overlay_destination_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            manifest_path = root / "packaging/runtime-manifest.json"
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            overlays = data["targets"]["codex"]["overlay_files"]
            canonical = (
                "packaging/adapters/codex/references/execution-liveness-host.md"
            )
            self.assertIn(canonical, overlays)
            arbitrary = root / "packaging/adapters/codex/references/arbitrary-host.md"
            arbitrary.write_text("# Arbitrary Host\n", encoding="utf-8")
            overlays[
                "packaging/adapters/codex/references/arbitrary-host.md"
            ] = "references/arbitrary-host.md"
            manifest_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

            result = self.run_validator("validate_skill.py", root)

            self.assert_validation_failed_for(
                result,
                "codex overlay destinations must equal the reviewed target contract",
            )

    def test_runtime_bundle_rejects_source_only_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            bundle = Path(temp) / "sliver-vibe-coding"
            built = self.run_source_script(
                root,
                "build_runtime_bundle.py",
                "--target",
                "codex",
                "--output",
                str(bundle),
            )
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            (bundle / "README.md").write_text("source-only", encoding="utf-8")
            result = self.run_source_script(
                root,
                "validate_runtime_bundle.py",
                str(bundle),
                "--target",
                "codex",
                "--source-root",
                str(root),
                "--trusted-base-root",
                str(ROOT),
            )
            self.assertNotEqual(result.returncode, 0)

    def test_runtime_bundle_rejects_missing_reference(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            bundle = Path(temp) / "sliver-vibe-coding"
            built = self.run_source_script(
                root,
                "build_runtime_bundle.py",
                "--target",
                "codex",
                "--output",
                str(bundle),
            )
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            (bundle / "references/routes-index.md").unlink()
            result = self.run_source_script(
                root,
                "validate_runtime_bundle.py",
                str(bundle),
                "--target",
                "codex",
                "--source-root",
                str(root),
                "--trusted-base-root",
                str(ROOT),
            )
            self.assertNotEqual(result.returncode, 0)

    def test_runtime_bundle_rejects_host_brand_in_portable_core(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            skill = root / "SKILL.md"
            skill.write_text(
                skill.read_text(encoding="utf-8")
                + "\nThis portable core is implemented specifically for Codex.\n",
                encoding="utf-8",
            )
            bundle = Path(temp) / "sliver-vibe-coding"
            built = self.run_source_script(
                root,
                "build_runtime_bundle.py",
                "--target",
                "claude-code",
                "--output",
                str(bundle),
            )
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            result = self.run_source_script(
                root,
                "validate_runtime_bundle.py",
                str(bundle),
                "--target",
                "claude-code",
                "--source-root",
                str(root),
                "--trusted-base-root",
                str(ROOT),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("portable runtime core contains", result.stdout)

    def test_runtime_validation_does_not_pollute_the_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            bundle = Path(temp) / "sliver-vibe-coding"
            built = self.run_source_script(
                root,
                "build_runtime_bundle.py",
                "--target",
                "codex",
                "--output",
                str(bundle),
            )
            self.assertEqual(built.returncode, 0, built.stdout + built.stderr)
            result = self.run_source_script(
                root,
                "validate_runtime_bundle.py",
                str(bundle),
                "--target",
                "codex",
                "--source-root",
                str(root),
                "--trusted-base-root",
                str(ROOT),
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            pollution = [
                path.relative_to(bundle).as_posix()
                for path in bundle.rglob("*")
                if path.name == "__pycache__" or path.suffix == ".pyc"
            ]
            self.assertEqual(pollution, [], f"runtime validation polluted bundle: {pollution}")

    def test_universal_new_test_rule_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/testing-strategy.md"
            text = path.read_text(encoding="utf-8")
            text += "\nAll production modifications must begin by writing a failing test.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_optional_test_classification_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/testing-strategy.md"
            text = path.read_text(encoding="utf-8")
            text += "\nFor trivial edits, the classification step may be skipped.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_invalid_expected_test_level_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/execution-backbone-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            data["pressure_cases"][0]["expected_test_level"] = "T9"
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_expected_test_level_must_match_its_scenario_assertion(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "tests/execution-backbone-cases.json"
            data = json.loads(path.read_text(encoding="utf-8"))
            case = next(
                item
                for item in data["pressure_cases"]
                if item["name"] == "ordinary_behavior_bug_with_existing_suite_stays_t1"
            )
            case["expected_test_level"] = "T0"
            case["level_assertion"] = "`T0` Non-behavior verification"
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_retained_runtime_spike_cannot_be_t0(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/testing-strategy.md"
            text = path.read_text(encoding="utf-8")
            text += "\nRetained runtime spike code may be reclassified as T0.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_technical_choice_outsourcing_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            text += "\nAsk the user to pick whether to repair the SDK or approve migration.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_requires_architecture_drivers_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            self.assertIn("## Architecture Drivers Gate", text)
            text = re.sub(
                r"\n## Architecture Drivers Gate\n.*?(?=\n## |\Z)",
                "\n",
                text,
                count=1,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_requires_framework_architecture_fit_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            self.assertIn("## Framework-Architecture Fit Gate", text)
            text = re.sub(
                r"\n## Framework-Architecture Fit Gate\n.*?(?=\n## |\Z)",
                "\n",
                text,
                count=1,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_requires_decision_readiness_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            self.assertIn("## Decision Readiness Gate", text)
            text = re.sub(
                r"\n## Decision Readiness Gate\n.*?(?=\n## |\Z)",
                "\n",
                text,
                count=1,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_requires_external_evidence_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            self.assertIn("## External Evidence Gate", text)
            text = re.sub(
                r"\n## External Evidence Gate\n.*?(?=\n## |\Z)",
                "\n",
                text,
                count=1,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_rejects_final_with_blocking_unknowns(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            text += "\nBlocking unknown inputs may still produce a final recommendation.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_rejects_user_technical_choice(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/question-bank.md"
            text = path.read_text(encoding="utf-8")
            text += "\n请用户选择 React 还是 Vue 技术栈。\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_rejects_final_without_external_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            text += "\nWithout current primary sources, the AI may still finalize the recommendation.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_contract_rejects_multiple_equal_primary_combinations(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            text += "\nPresent two equal primary stack and architecture combinations.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_speculative_future_prebuild_rule_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/tech-stack.md"
            text = path.read_text(encoding="utf-8")
            text += "\nA speculative future should prebuild microservices infrastructure now.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)

    def test_bootstrap_product_horizon_is_required_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "assets/project-bootstrap/dev-docs/project-brief.md"
            text = path.read_text(encoding="utf-8")
            text = re.sub(
                r"\n## 已确认的演进边界\n.*?(?=\n## |\Z)",
                "\n",
                text,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(root / "assets/project-bootstrap"),
                "--mode",
                "bootstrap",
                "--allow-template",
                "--skip-private-scan",
            )
            self.assertNotEqual(result.returncode, 0)

    def test_bootstrap_rejects_mechanically_filled_foundation_truth(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            project = root / "assets/project-bootstrap"
            for path in project.rglob("*.md"):
                text = path.read_text(encoding="utf-8")
                text = re.sub(r"^(- [^:\n]+:)\s*$", r"\1 x", text, flags=re.M)
                text = text.replace("待填写", "x")
                path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(project),
                "--mode",
                "bootstrap",
                "--skip-private-scan",
            )
            self.assertNotEqual(
                result.returncode,
                0,
                "mechanically non-empty product/stack/architecture fields must not become valid truth",
            )

    def test_bootstrap_rejects_ready_foundation_with_blocking_unknowns(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            project = root / "assets/project-bootstrap"
            path = project / "dev-docs/technical-selection.md"
            text = path.read_text(encoding="utf-8")
            text = re.sub(
                r"^- decision_status: .*?$",
                "- decision_status: recommendation_ready",
                text,
                count=1,
                flags=re.M,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(project),
                "--mode",
                "bootstrap",
                "--allow-template",
                "--skip-private-scan",
            )
            self.assertNotEqual(
                result.returncode,
                0,
                "recommendation_ready must reject blocking_unknowns: present",
            )

    def test_bootstrap_rejects_ready_foundation_without_network_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            project = root / "assets/project-bootstrap"
            path = project / "dev-docs/technical-selection.md"
            text = path.read_text(encoding="utf-8")
            replacements = {
                "decision_status": "recommendation_ready",
                "source_coverage": "complete",
                "blocking_unknowns": "none",
                "source_conflicts": "none",
                "network_evidence": "missing",
                "poc_status": "not_required",
                "recommendation": "primary",
                "decision_record": "complete: 已形成唯一主组合",
            }
            for key, value in replacements.items():
                text = re.sub(
                    rf"^- {re.escape(key)}: .*?$",
                    f"- {key}: {value}",
                    text,
                    count=1,
                    flags=re.M,
                )
            path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(project),
                "--mode",
                "bootstrap",
                "--allow-template",
                "--skip-private-scan",
            )
            self.assertNotEqual(
                result.returncode,
                0,
                "recommendation_ready must reject missing current network evidence",
            )

    def test_bootstrap_rejects_missing_framework_architecture_fit(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            project = root / "assets/project-bootstrap"
            path = project / "dev-docs/technical-selection.md"
            text = path.read_text(encoding="utf-8")
            text = text.replace(
                "## Framework Architecture Fit",
                "## Removed Framework Architecture Fit",
                1,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(project),
                "--mode",
                "bootstrap",
                "--allow-template",
                "--skip-private-scan",
            )
            self.assertNotEqual(result.returncode, 0)

    def test_bootstrap_rejects_multiple_primary_foundation_combinations(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            project = root / "assets/project-bootstrap"
            path = project / "dev-docs/technical-selection.md"
            text = path.read_text(encoding="utf-8")
            marker = "- primary_combination: 唯一主技术栈、框架与架构组合"
            self.assertIn(marker, text)
            text = text.replace(
                marker,
                f"{marker}\n- primary_combination: 第二个平级主组合",
                1,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(project),
                "--mode",
                "bootstrap",
                "--allow-template",
                "--skip-private-scan",
            )
            self.assertNotEqual(result.returncode, 0)

    def test_foundation_live_harness_without_results_is_unverified(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result = self.run_source_script(root, "evaluate_foundation_live_behavior.py")
            self.assertEqual(result.returncode, 2)
            self.assertIn("UNVERIFIED", result.stdout)
            self.assertNotIn("foundation live behavior verified", result.stdout)

    def test_foundation_live_contract_only_is_static_and_not_live(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--contract-only",
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("static contract only", result.stdout)
            self.assertIn("live model behavior not evaluated", result.stdout)
            self.assertNotIn("foundation live behavior verified", result.stdout)

    def test_foundation_web_case_requires_concrete_decision_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            cases_path = root / "tests/foundation-live-behavior-cases.json"
            cases_data = json.loads(cases_path.read_text(encoding="utf-8"))
            target_case = next(
                case
                for case in cases_data["cases"]
                if case["id"] == "mutable_technical_facts_require_current_web_evidence"
            )
            fixture_path = root / target_case["fixture"]["path"]
            fixture_data = json.loads(fixture_path.read_text(encoding="utf-8"))
            fixture_data["context"].pop("product_facts")
            fixture_bytes = (
                json.dumps(fixture_data, ensure_ascii=False, indent=2) + "\n"
            ).encode("utf-8")
            fixture_path.write_bytes(fixture_bytes)
            target_case["fixture"]["sha256"] = hashlib.sha256(
                fixture_bytes
            ).hexdigest()
            cases_path.write_text(
                json.dumps(cases_data, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--contract-only",
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "web case fixture requires concrete product_facts",
                result.stdout,
            )

    def write_valid_foundation_live_result(self, root: Path) -> tuple[Path, Path]:
        if not (root / ".git").exists():
            subprocess.run(["git", "init"], cwd=root, check=True, capture_output=True)
            subprocess.run(["git", "config", "user.name", "Sliver Tests"], cwd=root, check=True)
            subprocess.run(["git", "config", "user.email", "tests@sliver.invalid"], cwd=root, check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True, capture_output=True)
            subprocess.run(["git", "commit", "-m", "test fixture"], cwd=root, check=True, capture_output=True)
        cases_path = root / "tests/foundation-live-behavior-cases.json"
        cases = json.loads(cases_path.read_text(encoding="utf-8"))["cases"]
        now = datetime.now(timezone.utc)
        timestamp = (now - timedelta(minutes=20)).isoformat()
        session_end = (now - timedelta(minutes=10)).isoformat()
        generated_at = now.isoformat()
        runner_public = {
            "name": "codex-fresh-session-runner",
            "version": "1.0.0",
            "invocation_id": "invocation-foundation-live-001",
        }
        result_cases = []
        artifact_cases = []
        for case in cases:
            case_id = case["id"]
            session_id = f"session-{case_id}"
            transcript = [
                {
                    "event_id": f"{case_id}-selection",
                    "role": "system",
                    "timestamp": timestamp,
                    "content": "Host selected sliver-vibe-coding for this fresh session",
                },
                {
                    "event_id": f"{case_id}-user-0",
                    "role": "user",
                    "timestamp": timestamp,
                    "content": case["initial_user"],
                },
            ]
            if case["minimum_user_turns"] > 1:
                for turn, followup in enumerate(case["followup_user_turns"]):
                    transcript.extend(
                        [
                            {
                                "event_id": f"{case_id}-assistant-question-{turn}",
                                "role": "assistant",
                                "timestamp": timestamp,
                                "content": f"Blocking product question number {turn + 1}",
                            },
                            {
                                "event_id": f"{case_id}-user-answer-{turn}",
                                "role": "user",
                                "timestamp": timestamp,
                                "content": followup,
                            },
                        ]
                    )
            requirements = case.get("required_tool_evidence") or [
                {"kind": "read", "target": case["fixture"]["path"]}
            ]
            minimum_tool_events = case.get("minimum_tool_events", 1)
            tool_trace = []
            web_evidence = []
            for tool_index in range(minimum_tool_events):
                requirement = requirements[min(tool_index, len(requirements) - 1)]
                tool_event_id = f"{case_id}-tool-{tool_index}"
                tool_call_id = f"{case_id}-call-{tool_index}"
                transcript.append(
                    {
                        "event_id": tool_event_id,
                        "role": "tool",
                        "timestamp": timestamp,
                        "content": f"{requirement['kind']} evidence captured for {requirement['target']}",
                    }
                )
                tool_trace.append(
                    {
                        "tool_call_id": tool_call_id,
                        "tool_name": f"workspace.{requirement['kind']}",
                        "status": "success",
                        "started_at": timestamp,
                        "completed_at": timestamp,
                        "request_summary": f"Capture {requirement['kind']} evidence at {requirement['target']}",
                        "response_summary": f"Verified exact target {requirement['target']}",
                        "evidence_kind": requirement["kind"],
                        "evidence_target": requirement["target"],
                        "transcript_event_ref": tool_event_id,
                    }
                )
            if case["web_expectation"] != "not_required":
                tool_status = "success" if case["web_expectation"] == "must_succeed" else "error"
                tool_event_id = f"{case_id}-tool-transcript"
                tool_call_id = f"{case_id}-web-call"
                transcript.append(
                    {
                        "event_id": tool_event_id,
                        "role": "tool",
                        "timestamp": timestamp,
                        "content": "Official documentation lookup completed with recorded status",
                    }
                )
                tool_trace.append(
                    {
                        "tool_call_id": tool_call_id,
                        "tool_name": "web.search.primary-sources",
                        "status": tool_status,
                        "started_at": timestamp,
                        "completed_at": timestamp,
                        "request_summary": "Look up the current official framework support statement",
                        "response_summary": "Official source returned current support evidence"
                        if tool_status == "success"
                        else "Network failure prevented official source retrieval",
                        "evidence_kind": "web",
                        "evidence_target": "https://docs.python.org/3/",
                        "transcript_event_ref": tool_event_id,
                    }
                )
                if tool_status == "success":
                    web_evidence.append(
                        {
                            "evidence_id": f"{case_id}-official-evidence",
                            "url": "https://docs.python.org/3/",
                            "checked_at": timestamp,
                            "source_type": "primary",
                            "claim": "Current official runtime support and documentation status",
                            "result": "The official source was available and mapped to this decision claim",
                            "tool_call_id": tool_call_id,
                        }
                    )
            final_output = (
                "Current evidence is unavailable, so the foundation decision remains blocked"
                if case["web_expectation"] == "must_attempt_and_block"
                else "Evidence-backed foundation behavior completed for this evaluation case"
            )
            transcript.append(
                {
                    "event_id": f"{case_id}-assistant-final",
                    "role": "assistant",
                    "timestamp": timestamp,
                    "content": final_output,
                }
            )
            result_case = {
                "case_id": case_id,
                "fixture": case["fixture"],
                "initial_user": case["initial_user"],
                "skill_selection": {
                    "selected": True,
                    "skill_name": "sliver-vibe-coding",
                    "selected_at": timestamp,
                    "evidence_ref": f"{case_id}-selection",
                },
                "session": {
                    "session_id": session_id,
                    "started_at": timestamp,
                    "ended_at": session_end,
                },
                "transcript": transcript,
                "tool_trace": tool_trace,
                "web_evidence": web_evidence,
                "final_output": final_output,
                "judge": {
                    "status": "pass",
                    "reason": "Independent rubric evaluation cites the complete fresh-session evidence",
                    "rubric_version": "sliver-foundation-live-rubric/v3",
                    "required_behavior_results": {
                        behavior: {
                            "passed": True,
                            "evidence_refs": [tool_trace[0]["tool_call_id"]],
                        }
                        for behavior in case["required_behaviors"]
                    },
                    "forbidden_behavior_results": {
                        behavior: {
                            "observed": False,
                            "evidence_refs": [f"session:{session_id}"],
                        }
                        for behavior in case["forbidden_behaviors"]
                    },
                },
            }
            result_cases.append(result_case)
            artifact_cases.append(
                {
                    key: result_case[key]
                    for key in (
                        "case_id",
                        "fixture",
                        "initial_user",
                        "skill_selection",
                        "session",
                        "transcript",
                        "tool_trace",
                        "web_evidence",
                        "final_output",
                    )
                }
            )
        artifact_path = root / "tests/foundation-live-run-artifact.json"
        result_path = root / "tests/foundation-live-results.json"
        artifact_path.write_text("{}\n", encoding="utf-8")
        result_path.write_text("{}\n", encoding="utf-8")
        candidate = {
            "runtime_target": "codex",
            "runtime_digest": source_runtime_digest(root, "codex"),
            "source_revision": source_revision(root),
        }
        allowed_inputs = build_allowed_inputs("codex", source_root=root)
        runner_isolation = {
            "schema": "sliver-live-evidence-isolation/v1",
            "environment": "github_hosted_ephemeral",
            "workspace_origin": "versioned_synthetic_fixture",
            "source_revision": candidate["source_revision"],
            "runtime_digest": candidate["runtime_digest"],
            "producer": {"kind": "github_actions", "repository": "example/sliver-vibe-coding", "workflow_path": ".github/workflows/external-live-evidence.yml", "run_id": "123456"},
            "isolated_home": True,
            "isolated_runtime_home": True,
            "user_config_loaded": False,
            "user_rules_loaded": False,
            "global_memory_mounted": False,
            "global_skills_mounted": False,
            "plugins_enabled": False,
            "session_history_mounted": False,
            "personal_projects_mounted": False,
            "allowed_inputs": allowed_inputs,
            "input_manifest_sha256": input_manifest_digest(allowed_inputs),
            "external_authorization_ref": "github-actions-environment:live-evidence",
            "privacy_scan_status": "passed",
            "cleanup_status": "complete",
        }
        artifact = {
            "schema": "sliver-foundation-live-run-artifact/v3",
            "run_id": "foundation-live-run-001",
            **candidate,
            "platform": "codex-test-host",
            "model": "subject-model-v1",
            "generated_at": generated_at,
            "runner_isolation": runner_isolation,
            "runner_provenance": runner_public,
            "cases": artifact_cases,
        }
        artifact_bytes = json.dumps(artifact, ensure_ascii=False, indent=2).encode("utf-8")
        artifact_path.write_bytes(artifact_bytes)
        result_data = {
            "schema": "sliver-foundation-live-results/v4",
            "run_id": artifact["run_id"],
            "skill_version": (root / "VERSION").read_text(encoding="utf-8").strip(),
            **candidate,
            "platform": artifact["platform"],
            "model": artifact["model"],
            "generated_at": generated_at,
            "fresh_session": True,
            "runner_isolation": runner_isolation,
            "runner_provenance": {
                **runner_public,
                "artifact_path": artifact_path.name,
                "artifact_sha256": hashlib.sha256(artifact_bytes).hexdigest(),
            },
            "judge_provenance": {
                "kind": "model",
                "identity": "independent-judge-model-v2",
                "version": "2.0.0",
                "independent_from_subject": True,
                "rubric_version": "sliver-foundation-live-rubric/v3",
                "judged_at": generated_at,
            },
            "rubric_version": "sliver-foundation-live-rubric/v3",
            "cases": result_cases,
        }
        result_path.write_text(
            json.dumps(result_data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return result_path, artifact_path

    def test_foundation_live_harness_accepts_cross_referenced_runner_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, _ = self.write_valid_foundation_live_result(root)
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("foundation live evidence contract validated", result.stdout)
            self.assertIn("external trust boundary", result.stdout)

    def test_synthetic_live_fixtures_require_existing_executable_workspaces(self) -> None:
        mutations = (
            (
                "tests/foundation-live-fixtures/synthetic-stage-planning-baseline.json",
                "tests/foundation-live-behavior-cases.json",
                "stage_plan_reads_code_closeout_and_fresh_baseline",
                "evaluate_foundation_live_behavior.py",
            ),
            (
                "tests/ui-design-live-fixtures/floating-table-baseline.json",
                "tests/ui-design-live-behavior-cases.json",
                "non-prototype-floating-table-locks-baseline",
                "evaluate_ui_design_live_behavior.py",
            ),
        )
        for fixture_rel, cases_rel, case_id, evaluator in mutations:
            with self.subTest(case_id=case_id), tempfile.TemporaryDirectory() as temp:
                root = self.copy_repo(temp)
                fixture_path = root / fixture_rel
                fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
                fixture["workspace"]["required_paths"].append("missing-owner.file")
                fixture_bytes = json.dumps(fixture, ensure_ascii=False, indent=2).encode("utf-8")
                fixture_path.write_bytes(fixture_bytes)
                cases_path = root / cases_rel
                cases = json.loads(cases_path.read_text(encoding="utf-8"))
                case = next(item for item in cases["cases"] if item["id"] == case_id)
                case["fixture"]["sha256"] = hashlib.sha256(fixture_bytes).hexdigest()
                cases_path.write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")

                result = self.run_source_script(root, evaluator, "--contract-only")

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("workspace file is missing", result.stdout)

    def test_publishable_live_fixture_without_synthetic_classification_fails_closed(self) -> None:
        mutations = (
            (
                "tests/foundation-live-fixtures/existing-project-clear-owner.json",
                "tests/foundation-live-behavior-cases.json",
                "ordinary_task_does_not_reopen_foundation",
                "evaluate_foundation_live_behavior.py",
            ),
            (
                "tests/ui-design-live-fixtures/local-ui-correction.json",
                "tests/ui-design-live-behavior-cases.json",
                "local-ui-correction-stays-lightweight",
                "evaluate_ui_design_live_behavior.py",
            ),
        )
        for fixture_rel, cases_rel, case_id, evaluator in mutations:
            with self.subTest(case_id=case_id), tempfile.TemporaryDirectory() as temp:
                root = self.copy_repo(temp)
                fixture_path = root / fixture_rel
                fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
                fixture.pop("evidence_classification", None)
                fixture_bytes = json.dumps(fixture, ensure_ascii=False, indent=2).encode("utf-8")
                fixture_path.write_bytes(fixture_bytes)
                cases_path = root / cases_rel
                cases = json.loads(cases_path.read_text(encoding="utf-8"))
                case = next(item for item in cases["cases"] if item["id"] == case_id)
                case["fixture"]["sha256"] = hashlib.sha256(fixture_bytes).hexdigest()
                cases_path.write_text(json.dumps(cases, ensure_ascii=False, indent=2), encoding="utf-8")

                result = self.run_source_script(root, evaluator, "--contract-only")

                self.assertNotEqual(result.returncode, 0)
                self.assertIn("must be classified synthetic_non_identifying", result.stdout)

    def test_synthetic_workspace_verifiers_execute_behavior_not_only_markers(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            owner = root / "tests/foundation-live-fixtures/workspaces/project-evidence/src/core/record-owner.mjs"
            owner.write_text(
                '// owner: record-owner\nexport function normalizeRecord(value) { return "broken"; }\n',
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, str(root / "tests/foundation-live-fixtures/workspaces/project-evidence/verify_workspace.py")],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            table = root / "tests/ui-design-live-fixtures/workspaces/table-system/src/components/StableDataTable.js"
            table.write_text(
                'export function StableDataTable() { return "broken"; }\n',
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, str(root / "tests/ui-design-live-fixtures/workspaces/table-system/verify_workspace.py")],
                cwd=root,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_foundation_live_harness_rejects_missing_non_web_tool_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, artifact_path = self.write_valid_foundation_live_result(root)
            result_data = json.loads(result_path.read_text(encoding="utf-8"))
            artifact_data = json.loads(artifact_path.read_text(encoding="utf-8"))
            case_id = "stage_plan_reads_code_closeout_and_fresh_baseline"
            result_case = next(case for case in result_data["cases"] if case["case_id"] == case_id)
            artifact_case = next(case for case in artifact_data["cases"] if case["case_id"] == case_id)
            result_case["tool_trace"] = []
            artifact_case["tool_trace"] = []
            artifact_bytes = json.dumps(artifact_data, ensure_ascii=False, indent=2).encode("utf-8")
            artifact_path.write_bytes(artifact_bytes)
            result_data["runner_provenance"]["artifact_sha256"] = hashlib.sha256(
                artifact_bytes
            ).hexdigest()
            result_path.write_text(json.dumps(result_data, ensure_ascii=False, indent=2), encoding="utf-8")

            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("insufficient structured tool evidence", result.stdout)

    def test_foundation_live_harness_rejects_reused_session(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, artifact_path = self.write_valid_foundation_live_result(root)
            result_data = json.loads(result_path.read_text(encoding="utf-8"))
            artifact_data = json.loads(artifact_path.read_text(encoding="utf-8"))
            reused_session_id = result_data["cases"][0]["session"]["session_id"]
            original_session_id = result_data["cases"][1]["session"]["session_id"]

            def replace_session_refs(value):
                if isinstance(value, dict):
                    return {
                        key: replace_session_refs(item)
                        for key, item in value.items()
                    }
                if isinstance(value, list):
                    return [replace_session_refs(item) for item in value]
                if value == original_session_id:
                    return reused_session_id
                if value == f"session:{original_session_id}":
                    return f"session:{reused_session_id}"
                return value

            result_data["cases"][1] = replace_session_refs(result_data["cases"][1])
            artifact_data["cases"][1] = replace_session_refs(artifact_data["cases"][1])
            artifact_bytes = json.dumps(
                artifact_data,
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8")
            artifact_path.write_bytes(artifact_bytes)
            result_data["runner_provenance"]["artifact_sha256"] = hashlib.sha256(
                artifact_bytes
            ).hexdigest()
            result_path.write_text(
                json.dumps(result_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                f"fresh-session evidence reused: {reused_session_id}",
                result.stdout,
            )

    def test_foundation_live_harness_rejects_uncontracted_followup_answer(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, artifact_path = self.write_valid_foundation_live_result(root)
            result_data = json.loads(result_path.read_text(encoding="utf-8"))
            artifact_data = json.loads(artifact_path.read_text(encoding="utf-8"))
            case_id = "progressive_clarification_closes_one_fact_at_a_time"
            result_case = next(
                case for case in result_data["cases"] if case["case_id"] == case_id
            )
            artifact_case = next(
                case for case in artifact_data["cases"] if case["case_id"] == case_id
            )
            result_user_events = [
                event for event in result_case["transcript"] if event["role"] == "user"
            ]
            artifact_user_events = [
                event for event in artifact_case["transcript"] if event["role"] == "user"
            ]
            result_user_events[1]["content"] = "临时换成一个没有写进案例的回答。"
            artifact_user_events[1]["content"] = result_user_events[1]["content"]
            artifact_bytes = json.dumps(
                artifact_data,
                ensure_ascii=False,
                indent=2,
            ).encode("utf-8")
            artifact_path.write_bytes(artifact_bytes)
            result_data["runner_provenance"]["artifact_sha256"] = hashlib.sha256(
                artifact_bytes
            ).hexdigest()
            result_path.write_text(
                json.dumps(result_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "follow-up user transcript does not match the case",
                result.stdout,
            )

    def test_foundation_live_harness_rejects_wrong_runtime_digest(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, _ = self.write_valid_foundation_live_result(root)
            payload = json.loads(result_path.read_text(encoding="utf-8"))
            payload["runtime_digest"] = "0" * 64
            result_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("runtime_digest does not match the exact source runtime candidate", result.stdout)

    def test_foundation_live_harness_rejects_stale_source_revision(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, _ = self.write_valid_foundation_live_result(root)
            payload = json.loads(result_path.read_text(encoding="utf-8"))
            payload["source_revision"] = "git:" + "0" * 40 + ":clean"
            result_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("source_revision does not match the exact source candidate", result.stdout)

    def test_foundation_live_harness_rejects_fabricated_unstructured_trace(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            cases_path = root / "tests/foundation-live-behavior-cases.json"
            cases = json.loads(cases_path.read_text(encoding="utf-8"))["cases"]
            result_path = root / "tests/foundation-live-results.json"
            result_data = {
                "schema": "sliver-foundation-live-results/v4",
                "run_id": "fake-no-trace",
                "skill_version": (root / "VERSION").read_text(encoding="utf-8").strip(),
                "runtime_target": "codex",
                "runtime_digest": "0" * 64,
                "source_revision": "git:" + "0" * 40 + ":dirty",
                "platform": "fabricated-platform",
                "model": "fabricated-model",
                "generated_at": "2026-07-16T00:00:00+08:00",
                "fresh_session": True,
                "runner_isolation": {},
                "runner_provenance": {},
                "judge_provenance": {},
                "rubric_version": "sliver-foundation-live-rubric/v3",
                "cases": [],
            }
            for case in cases:
                result_data["cases"].append(
                    {
                        "case_id": case["id"],
                        "fixture": case["fixture"],
                        "initial_user": case["initial_user"],
                        "skill_selection": {"selected": True},
                        "session": {},
                        "transcript": [{"role": "assistant", "content": "fabricated"}],
                        "tool_trace": [],
                        "web_evidence": [],
                        "final_output": "fabricated",
                        "judge": {
                            "status": "pass",
                            "reason": "fabricated result without trace",
                            "rubric_version": "sliver-foundation-live-rubric/v3",
                            "required_behavior_results": {
                                behavior: True for behavior in case["required_behaviors"]
                            },
                            "forbidden_behavior_results": {
                                behavior: False for behavior in case["forbidden_behaviors"]
                            },
                        },
                    }
                )
            result_path.write_text(
                json.dumps(result_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("runner_provenance missing fields", result.stdout)
            self.assertNotIn("foundation live behavior verified", result.stdout)

    def test_foundation_live_harness_rejects_placeholder_web_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, _ = self.write_valid_foundation_live_result(root)
            data = json.loads(result_path.read_text(encoding="utf-8"))
            target = next(case for case in data["cases"] if case["web_evidence"])
            target["web_evidence"][0]["url"] = "https://example.com/official"
            result_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("uses a placeholder or local host", result.stdout)

    def test_foundation_live_harness_rejects_subject_self_judge(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            result_path, _ = self.write_valid_foundation_live_result(root)
            data = json.loads(result_path.read_text(encoding="utf-8"))
            data["judge_provenance"]["identity"] = data["model"]
            result_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            result = self.run_source_script(
                root,
                "evaluate_foundation_live_behavior.py",
                "--results",
                str(result_path),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("cannot judge its own foundation behavior", result.stdout)

    def test_adoption_product_horizon_is_required_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "assets/project-adoption/dev-docs/current-state-audit.md"
            text = path.read_text(encoding="utf-8")
            text = re.sub(
                r"\n## 已确认的演进边界\n.*?(?=\n## |\Z)",
                "\n",
                text,
                flags=re.S,
            )
            path.write_text(text, encoding="utf-8")
            result = self.run_source_script(
                root,
                "check_project_guardrails.py",
                str(root / "assets/project-adoption"),
                "--mode",
                "adoption",
                "--allow-template",
                "--skip-private-scan",
            )
            self.assertNotEqual(result.returncode, 0)

    def test_ordinary_full_foundation_table_fails_end_to_end(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = self.copy_repo(temp)
            path = root / "references/routes-feature.md"
            text = path.read_text(encoding="utf-8")
            text += "\nFoundation-impact table must cover every stack/framework lane for each task.\n"
            path.write_text(text, encoding="utf-8")
            result = self.run_validator("evaluate_execution_backbone.py", root)
            self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
