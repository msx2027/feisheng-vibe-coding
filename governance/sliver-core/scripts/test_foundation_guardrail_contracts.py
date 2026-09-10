#!/usr/bin/env python3
"""Positive and mutation tests for the foundation evidence contract."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
import re
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import check_project_guardrails  # noqa: E402


class FoundationGuardrailContractTests(unittest.TestCase):
    maxDiff = None

    def write_fixture(self, root: Path, *, status: str = "recommendation_ready") -> Path:
        truth = root / "dev-docs"
        truth.mkdir(parents=True)
        today = date.today().isoformat()
        confirmed = status == "implementation_ready"
        confirmation = (
            "confirmed: CONF-001 records product cost and downtime acceptance"
            if confirmed
            else "pending: CONF-001 still requires product cost and downtime acceptance"
        )
        consequence_decision = "confirmed" if confirmed else "pending"
        architecture_status = "implementation_ready" if confirmed else "blocked"
        (truth / "architecture.md").write_text(
            f"# Architecture\n\n## 当前架构\n\n- foundation_decision_status: {architecture_status}\n",
            encoding="utf-8",
        )
        technical = f"""# Technical Selection Decision

## Foundation Decision Control

- schema: sliver-foundation/v1
- decision_status: {status}
- source_coverage: complete
- blocking_unknowns: none
- source_conflicts: none
- network_evidence: verified_current: https://docs.djangoproject.com/en/5.2/ checked {today}
- poc_status: not_required: official documentation closes all material decision uncertainty
- user_confirmation_scope: product_consequences_only
- product_consequence_confirmation: {confirmation}
- recommendation: primary
- decision_record: complete: DEC-001 records the evidence-backed primary combination

## Source Coverage

| Category | Source | Status | Evidence |
| --- | --- | --- | --- |
| product_scope | Product boundary and first workflow | confirmed | dev-docs/project-brief.md section First Workflow |
| users_outcomes | User roles and visible outcome | confirmed | conversation record USER-2026-07-16 |
| roadmap_boundaries | Current and confirmed evolution | confirmed | dev-docs/project-brief.md section Evolution Boundary |
| existing_system | Existing code and inherited constraints | not_applicable | greenfield project has no inherited runtime |
| runtime_operations | Runtime and delivery constraints | confirmed | operations record OPS-001 names one managed process |
| data_security_compliance | Data security and compliance | confirmed | security decision SEC-001 records account isolation |
| platform_organization | Platform cost and team ownership | confirmed | ownership record ORG-001 names one product team |

## Architecture Drivers

| Driver | Business Priority | Architecture Impact | Source Evidence | Failure Consequence |
| --- | --- | --- | --- | --- |
| One product team must operate the service | High for current delivery | Prefer one deployable modular process | ownership record ORG-001 | Extra services would add unsupported operations work |

## Quality Attribute Scenarios

| Attribute | Source | Stimulus | Artifact | Environment | Response | Measure | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reliability | Product owner | A process restarts | Web application | Managed production | Recover through platform restart | Service returns within two minutes | High business priority |

## Pattern Axes

| Axis | Current Choice | Scope | Driver Fit | Rejected Alternative | Upgrade Trigger |
| --- | --- | --- | --- | --- | --- |
| 部署拓扑 | 模块化单体 | 当前产品服务 | 单团队可独立运维 | 拒绝微服务因为没有独立团队 owner | 多团队独立发布需求出现 |
| 内部代码组织 | Django 原生应用边界 | 服务端模块 | 遵循框架生命周期 | 拒绝额外 Clean 包装层 | 原生边界无法隔离依赖 |
| 领域建模 | 事务脚本与局部领域服务 | 当前简单业务 | 复杂度与规则匹配 | 拒绝全量 DDD 聚合 | 跨实体不变量显著增加 |
| 数据与一致性 | 单库事务 owner | 核心写路径 | 满足当前一致性需求 | 拒绝分布式事务 | 独立数据 owner 成立 |
| 模块通信 | 进程内同步调用 | 当前模块 | 最低运维成本 | 拒绝消息队列 | 可靠异步成为产品要求 |
| 客户端接口 | 通用 JSON API | Web 客户端 | 一个客户端契约 | 拒绝 BFF 因没有多端差异 | 多端体验分化出现 |
| 扩展机制 | 内置模块 | 当前团队 | 无第三方扩展需求 | 拒绝插件协议 | 第三方扩展成为当前需求 |
| 组织与平台 | 单产品应用 | 一个产品团队 | 当前只有一个 owner | 拒绝中台因无复用与 SLA | 多产品复用及平台 owner 成立 |

## Framework Architecture Fit

| Candidate | Framework-Native Structure | Driver Fit | Native Support | Local Adaptation | Conflict/Bypass Cost | Operations Cost | Migration Cliff | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Django modular monolith | Native apps and middleware lifecycle | Fits one-team reliability and delivery drivers | native support covers routing data and auth lifecycle | Small domain service only where invariants require it | No framework bypass or duplicate lifecycle owner | One managed process plus relational database | Independent service extraction would require API and data migration | primary |

## Current Primary Evidence

| Candidate Or Decision | Claim Being Checked | Primary URL/Source | Source Type | Checked Date | Version/Support Target | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Django modular monolith | Supported application and middleware structure | https://docs.djangoproject.com/en/5.2/ | official_docs | {today} | Django 5.2 LTS support line | Official lifecycle supports the selected modular application boundary |

## Proof Of Concept

- poc_hypothesis: not required because official framework lifecycle closes the only material uncertainty
- disposable_boundary: no implementation code is created before consequence confirmation

| PoC ID | Success Criterion | Failure Criterion | Evidence Reference | Observed Result | Decision Impact |
| --- | --- | --- | --- | --- | --- |
| POC-NR | Official lifecycle documents the required boundary | Official lifecycle contradicts required ownership | https://docs.djangoproject.com/en/5.2/ | Official documentation directly supports application boundaries | No disposable implementation experiment is required |

## Product Consequence Confirmation

| Consequence | User-Visible Result | Cost Or Operation Impact | Data, Downtime Or Irreversible Impact | User Decision | Confirmation Evidence |
| --- | --- | --- | --- | --- | --- |
| One managed application process | Users receive one coherent release | One process and one database are operated | Future service extraction requires an explicit migration | {consequence_decision} | CONF-001 records the product consequence conversation |

## Primary Decision And Tradeoffs

- primary_combination: Django modular monolith with one relational database
- why_it_fits: Matches one-team ownership and framework-native lifecycle evidence
- accepted_downside: Independent module scaling requires later extraction work
- rejected_alternatives: Microservices are not credible without independent team owners
- minimum_reversible_boundary: Keep module APIs and data ownership explicit inside the monolith
- migration_cliff: Independent deployment later requires API and data migration
- re_evaluation_trigger: Multiple teams require independent releases and own operations
- architecture_writeback: Current accepted structure is projected into dev-docs/architecture.md
"""
        path = truth / "technical-selection.md"
        path.write_text(technical, encoding="utf-8")
        return path

    def check(self, root: Path, gate: str = "recommendation") -> dict:
        return check_project_guardrails.check_foundation_file(
            root,
            "dev-docs",
            allow_template=False,
            required_gate=gate,
        )

    def test_positive_recommendation_is_structural_not_implementation_authority(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.write_fixture(root)
            result = self.check(root)
            self.assertTrue(result["foundation_structural_contract_valid"])
            self.assertTrue(result["foundation_structural_recommendation_ready"])
            self.assertFalse(result["foundation_structural_implementation_ready"])
            self.assertFalse(result["foundation_external_implementation_authorized"])
            self.assertTrue(result["foundation_required_gate_met"])
            self.assertIn("implementation_blocked", result["foundation_gate_outcome"])

    def test_implementation_gate_requires_consistent_confirmation(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = self.write_fixture(root, status="implementation_ready")
            result = self.check(root, gate="implementation")
            self.assertTrue(result["foundation_structural_implementation_ready"])
            self.assertTrue(result["foundation_required_gate_met"])
            text = path.read_text(encoding="utf-8").replace(
                "| confirmed | CONF-001",
                "| pending | CONF-001",
            )
            path.write_text(text, encoding="utf-8")
            mutated = self.check(root, gate="implementation")
            self.assertFalse(mutated["foundation_required_gate_met"])
            self.assertIn(
                "confirmation control claims confirmed while consequence rows remain pending",
                mutated["foundation_gate_blockers"],
            )

    def test_rejects_example_future_stale_and_untyped_evidence(self) -> None:
        mutations = (
            ("https://docs.djangoproject.com/en/5.2/", "https://example.com/docs/"),
            (date.today().isoformat(), (date.today() + timedelta(days=2)).isoformat()),
            ("official_docs", "blog_post"),
        )
        for old, new in mutations:
            with self.subTest(new=new), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                path = self.write_fixture(root)
                path.write_text(path.read_text(encoding="utf-8").replace(old, new), encoding="utf-8")
                result = self.check(root)
                self.assertFalse(result["foundation_structural_recommendation_ready"])

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = self.write_fixture(root)
            stale = (date.today() - timedelta(days=181)).isoformat()
            path.write_text(
                re.sub(r"\b20\d{2}-\d{2}-\d{2}\b", stale, path.read_text(encoding="utf-8")),
                encoding="utf-8",
            )
            self.assertFalse(self.check(root)["foundation_structural_recommendation_ready"])

    def test_rejects_duplicate_categories_evidence_and_missing_cross_reference(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = self.write_fixture(root)
            text = path.read_text(encoding="utf-8")
            text = text.replace("| users_outcomes |", "| product_scope |", 1)
            text = text.replace(
                "conversation record USER-2026-07-16",
                "dev-docs/project-brief.md section First Workflow",
                1,
            )
            text = text.replace("| Django modular monolith | Supported", "| Different evidence owner | Supported", 1)
            path.write_text(text, encoding="utf-8")
            errors = self.check(root)["foundation_table_errors"]
            self.assertTrue(any("required category" in error for error in errors))
            self.assertTrue(any("repeats the same evidence" in error for error in errors))
            self.assertTrue(any("no matching primary evidence" in error for error in errors))

    def test_completed_poc_requires_artifact_and_control_cross_reference(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path = self.write_fixture(root)
            text = path.read_text(encoding="utf-8")
            text = re.sub(
                r"^- poc_status: .*?$",
                "- poc_status: completed: experiment finished",
                text,
                flags=re.M,
            )
            text = text.replace(
                "https://docs.djangoproject.com/en/5.2/ | Official documentation directly supports",
                "experiment output | Official documentation directly supports",
                1,
            )
            path.write_text(text, encoding="utf-8")
            errors = self.check(root)["foundation_table_errors"]
            self.assertTrue(any("artifact or command" in error for error in errors))
            self.assertTrue(any("not cross-referenced" in error for error in errors))


class TruthIndexAndVagueTermTests(unittest.TestCase):
    """Growing truth directories stay indexed; vague wording only warns."""

    maxDiff = None

    def write_project(self, root: Path) -> Path:
        truth = root / "dev-docs"
        truth.mkdir(parents=True)
        (truth / "README.md").write_text("# Truth Index\n\n- [features](features/README.md)\n", encoding="utf-8")
        return truth

    def write_feature(self, truth: Path, name: str, *, status: str = "active", body: str = "") -> Path:
        features = truth / "features"
        features.mkdir(exist_ok=True)
        path = features / f"{name}.md"
        path.write_text(
            f"---\nstatus: {status}\nfeature_id: {name}\n---\n\n# {name}\n\n## 目标\n\n{body or '登录后的用户可以导出自己的订单。'}\n",
            encoding="utf-8",
        )
        return path

    def write_index(self, truth: Path, names: list[str]) -> None:
        rows = "\n".join(f"| {name} | [{name}.md]({name}.md) | `active` | src/orders | 2026-09-05 |" for name in names)
        (truth / "features" / "README.md").write_text(
            "# 功能设计文档索引\n\n| 功能 | 文档 | status | 影响 owner | 最后变更 |\n| --- | --- | --- | --- | --- |\n" + rows + "\n",
            encoding="utf-8",
        )

    def documents_and_problems(self, root: Path) -> tuple[list, list]:
        return check_project_guardrails.indexed_truth_documents(root, "dev-docs")

    def test_indexed_active_documents_pass_and_unindexed_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            self.write_feature(truth, "order-export")
            self.write_index(truth, ["order-export"])
            documents, problems = self.documents_and_problems(root)
            self.assertEqual([rel for _kind, rel, _path in documents], ["dev-docs/features/order-export.md"])
            self.assertEqual(problems, [])

            self.write_feature(truth, "refund-flow")
            _documents, problems = self.documents_and_problems(root)
            self.assertEqual(
                problems,
                [
                    {
                        "directory": "dev-docs/features",
                        "document": "dev-docs/features/refund-flow.md",
                        "reason": "not_in_index",
                    }
                ],
            )

    def test_index_requires_exact_link_not_filename_substring(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            self.write_feature(truth, "order")
            self.write_feature(truth, "old-order")
            self.write_index(truth, ["old-order"])
            _docs, problems = self.documents_and_problems(root)
            self.assertEqual([p["document"] for p in problems], ["dev-docs/features/order.md"])
            (truth / "features/README.md").write_text("order.md is discussed, not linked.\n")
            self.assertEqual(len(self.documents_and_problems(root)[1]), 2)

    def test_index_ignores_code_and_supports_reference_links(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            self.write_feature(truth, "order")
            index = truth / "features/README.md"
            for text in ("Example: `[Order](order.md)`", "Example: ``[Order](order.md)``", "[order]: order.md"):
                with self.subTest(text=text):
                    index.write_text(text + "\n")
                    self.assertEqual(self.documents_and_problems(root)[1][0]["reason"], "not_in_index")
            for text in ("[Order][entry]\n\n[entry]: order.md", "[Order][]\n\n[order]: ./order.md#target", "[Order]\n\n[order]: <order.md>"):
                with self.subTest(text=text):
                    index.write_text(text + "\n")
                    self.assertEqual(self.documents_and_problems(root)[1], [])

    def test_nested_indexes_require_complete_chain_and_exact_module(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            for module in ("sales", "support"):
                folder = truth / "features" / module
                folder.mkdir(parents=True)
                (folder / "order.md").write_text("---\nstatus: active\n---\n# Order\n")
                (folder / "README.md").write_text("[Order](./order.md#details)\n")
            self.assertTrue(self.documents_and_problems(root)[1])
            index = truth / "features/README.md"
            index.write_text("[Sales](sales/README.md)\n")
            self.assertEqual([p["document"] for p in self.documents_and_problems(root)[1]],
                             ["dev-docs/features/support/order.md"])
            index.write_text("[Sales](sales/README.md)\n[Support](support/README.md)\n")
            self.assertEqual(self.documents_and_problems(root)[1], [])
            (truth / "features/support/README.md").write_text("[Order](../sales/order.md)\n")
            self.assertEqual([p["document"] for p in self.documents_and_problems(root)[1]],
                             ["dev-docs/features/support/order.md"])

    def test_missing_index_and_invalid_status_are_reported(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            self.write_feature(truth, "order-export", status="draft")
            _documents, problems = self.documents_and_problems(root)
            reasons = sorted(problem["reason"] for problem in problems)
            self.assertEqual(reasons, ["missing_index", "missing_or_invalid_status"])

    def test_archive_is_excluded_from_active_checks(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            self.write_feature(truth, "order-export")
            self.write_index(truth, ["order-export"])
            archive = truth / "features" / "archive"
            archive.mkdir()
            (archive / "legacy-export.md").write_text(
                "---\nstatus: archived\n---\n\n# legacy\n\n待填写 @@旧内容@@\n",
                encoding="utf-8",
            )
            documents, problems = self.documents_and_problems(root)
            self.assertEqual(len(documents), 1)
            self.assertEqual(problems, [])
            result = check_project_guardrails.check_project(
                root=root,
                mode="adoption",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            self.assertNotIn("truth_index_inconsistent", result["failures"])
            self.assertFalse(
                any(entry["file"].startswith("dev-docs/features/archive/") for entry in result["placeholder_markers"])
            )

    def test_vague_terms_warn_without_failing_while_placeholders_still_fail(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            truth = self.write_project(root)
            self.write_feature(
                truth,
                "order-export",
                body="所有用户都能导出，格式待定，简单做一下。\n\n- 禁止写「后续再定」这种词。\n",
            )
            self.write_index(truth, ["order-export"])
            result = check_project_guardrails.check_project(
                root=root,
                mode="adoption",
                truth_dir="dev-docs",
                allow_template=True,
                stage_file=None,
                skip_private_scan=True,
            )
            terms = sorted(hit["term"] for hit in result["vague_terms"] if hit["file"].endswith("order-export.md"))
            self.assertEqual(terms, ["待定", "所有用户", "简单"])
            self.assertNotIn("vague_terms", result["failures"])
            self.assertNotIn("truth_index_inconsistent", result["failures"])

            self.write_feature(truth, "order-export", body="@@目标@@ 没有模糊词。")
            strict = check_project_guardrails.check_project(
                root=root,
                mode="adoption",
                truth_dir="dev-docs",
                allow_template=False,
                stage_file=None,
                skip_private_scan=True,
                vague_terms="off",
            )
            self.assertIn("placeholder_markers", strict["failures"])
            self.assertIn({"file": "dev-docs/features/order-export.md", "marker": "@@"}, strict["placeholder_markers"])
            self.assertEqual(strict["vague_terms"], [])

    def test_english_vague_terms_match_whole_words_only(self) -> None:
        hits = check_project_guardrails.scan_vague_terms(
            "dev-docs/technical-selection.md",
            "Use the latest Django release.\nA simplest-possible layout.\nAny of these adapters can be chosen later.\n",
        )
        self.assertEqual(sorted(hit["term"] for hit in hits), ["any", "latest"])


if __name__ == "__main__":
    unittest.main()
