#!/usr/bin/env python3
"""Validate Sliver Vibe Coding skill structure without third-party dependencies."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from runtime_decision_contract import load_route_operation_delivery_matrix
from runtime_manifest_contract import RuntimeManifestError, load_runtime_manifest
from validation_support import ContractError, active_markdown, load_json_object, markdown_section, read_utf8


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SKILL = ROOT / "SKILL.md"

REQUIRED_FILES = [
    "SKILL.md",
    "README.md",
    "LICENSE",
    "VERSION",
    "CHANGELOG.md",
    "COMPATIBILITY.md",
    "packaging/runtime-manifest.json",
    "packaging/README.md",
    "packaging/adapters/codex/agents/openai.yaml",
    "packaging/adapters/codex/references/studio-codex.md",
    "packaging/adapters/trae/README.md",
    ".agents/plugins/marketplace.json",
    ".github/workflows/validate.yml",
    ".github/workflows/release-validate.yml",
    "references/task-risk-gates.md",
    "references/risk-control-gates.md",
    "references/effect-recovery-gates.md",
    "references/routes-intake.md",
    "references/routes-rescue.md",
    "references/routes-git.md",
    "references/routes-feature.md",
    "references/routes-backend.md",
    "references/routes-validation.md",
    "references/routes-release.md",
    "references/routes-constitution.md",
    "references/project-flow.md",
    "references/project-intake.md",
    "references/project-templates.md",
    "references/context-handoff.md",
    "references/studio-execution.md",
    "references/development-execution-core.md",
    "references/engineering-execution.md",
    "references/task-decision-contract.md",
    "references/testing-strategy.md",
    "references/testing-execution-gates.md",
    "references/question-bank.md",
    "references/tech-stack.md",
    "references/architecture-patterns.md",
    "references/frontend-skeleton.md",
    "references/ui-design-lifecycle.md",
    "references/database-design.md",
    "references/backend-boundary.md",
    "references/backend-skeleton.md",
    "references/third-party-integration.md",
    "references/monetization-and-entitlements.md",
    "references/beginner-failure-modes.md",
    "references/security.md",
    "references/git-and-delivery.md",
    "references/agent-constitution.md",
    "references/agent-constitution-template.md",
    "references/runtime-adapter.md",
    "references/plan-artifact.md",
    "references/truth-resolution.md",
    "references/formal-materialization.md",
    "references/routes-index.md",
    "scripts/evaluate_routes.py",
    "scripts/runtime_decision_contract.py",
    "scripts/runtime_governance_contract.py",
    "scripts/evaluate_task_decision_contract.py",
    "scripts/evaluate_task_decision_live_behavior.py",
    "scripts/stage_contract.py",
    "scripts/migrate_stage_contract.py",
    "scripts/evaluate_selector_pressure.py",
    "scripts/evaluate_execution_backbone.py",
    "scripts/evaluate_foundation_live_behavior.py",
    "scripts/evaluate_ui_design_lifecycle.py",
    "scripts/evaluate_ui_design_live_behavior.py",
    "scripts/evaluate_studio_live_behavior.py",
    "scripts/runtime_identity.py",
    "scripts/runtime_file_set.py",
    "scripts/live_evidence_isolation.py",
    "scripts/test_task_decision_live_contracts.py",
    "scripts/test_ui_design_live_contracts.py",
    "scripts/test_studio_live_contracts.py",
    "scripts/test_runtime_bundle_safety.py",
    "scripts/validate_release_candidate.py",
    "scripts/test_release_candidate_contracts.py",
    "scripts/check_project_guardrails.py",
    "scripts/git_revision.py",
    "scripts/runtime_manifest_contract.py",
    "scripts/validation_support.py",
    "scripts/test_validation_contracts.py",
    "scripts/test_stage_v2_contracts.py",
    "scripts/test_foundation_guardrail_contracts.py",
    "scripts/test_private_risk_scan_contracts.py",
    "scripts/test_session_continuity.py",
    "scripts/test_runtime_governance_contracts.py",
    "scripts/build_runtime_bundle.py",
    "scripts/validate_runtime_bundle.py",
    "plugins/sliver-session-continuity/.codex-plugin/plugin.json",
    "plugins/sliver-session-continuity/hooks/hooks.json",
    "plugins/sliver-session-continuity/hooks/continuity.py",
    "plugins/sliver-session-continuity/README.md",
    "tests/route-eval-cases.json",
    "tests/task-decision-cases.json",
    "tests/task-decision-live-cases.json",
    "tests/task-decision-live-result-schema.json",
    "tests/selector-pressure-cases.json",
    "tests/execution-backbone-cases.json",
    "tests/foundation-live-behavior-cases.json",
    "tests/foundation-live-result-schema.json",
    "tests/ui-design-lifecycle-cases.json",
    "tests/ui-design-live-behavior-cases.json",
    "tests/ui-design-live-result-schema.json",
    "tests/studio-live-behavior-cases.json",
    "tests/studio-live-result-schema.json",
    "assets/project-bootstrap/AGENTS.md",
    "assets/project-bootstrap/dev-docs/README.md",
    "assets/project-bootstrap/dev-docs/project-brief.md",
    "assets/project-bootstrap/dev-docs/technical-selection.md",
    "assets/project-bootstrap/dev-docs/architecture.md",
    "assets/project-bootstrap/dev-docs/acceptance.md",
    "assets/project-adoption/AGENTS.md",
    "assets/project-adoption/dev-docs/README.md",
    "assets/project-adoption/dev-docs/current-state-audit.md",
    "assets/project-adoption/dev-docs/technical-selection.md",
    "assets/project-adoption/dev-docs/architecture.md",
    "assets/project-adoption/dev-docs/acceptance.md",
    "assets/project-stage/stage-truth.md",
    "assets/project-design/dev-docs/README.md",
    "assets/project-design/dev-docs/design/README.md",
    "assets/project-design/dev-docs/design/prototypes/_template/prototype.md",
    "assets/project-feature/feature-truth.md",
    "assets/project-feature/features-index.md",
    "assets/project-decision/adr.md",
    "assets/project-decision/decisions-index.md",
    "assets/project-audit/audit-report.md",
    "assets/project-audit/audits-index.md",
]

DOC_PATHS = [
    SKILL,
    ROOT / "README.md",
    *sorted((ROOT / "references").glob("*.md")),
    *sorted((ROOT / "assets/project-bootstrap").rglob("*.md")),
    *sorted((ROOT / "assets/project-adoption").rglob("*.md")),
    *sorted((ROOT / "assets/project-stage").rglob("*.md")),
    *sorted((ROOT / "assets/project-design").rglob("*.md")),
    *sorted((ROOT / "assets/project-feature").rglob("*.md")),
    *sorted((ROOT / "assets/project-decision").rglob("*.md")),
    *sorted((ROOT / "assets/project-audit").rglob("*.md")),
]

FORBIDDEN_DOC_TERMS = [
    "原稿",
    "口播",
    "视频底稿",
    "实战篇",
    "文档篇",
    "source material",
    "source manuscript",
]

def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def read(path: Path) -> str:
    try:
        return read_utf8(path)
    except ContractError as exc:
        fail(str(exc))


def parse_frontmatter(text: str) -> dict[str, str]:
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        fail("SKILL.md missing YAML frontmatter")
    data: dict[str, str] = {}
    for line in match.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        data[key.strip()] = value
    return data


def main() -> None:
    if not ROOT.exists():
        fail(f"root does not exist: {ROOT}")

    for rel in REQUIRED_FILES:
        if not (ROOT / rel).is_file():
            fail(f"required file missing: {rel}")
    try:
        load_runtime_manifest(ROOT)
    except RuntimeManifestError as exc:
        fail(str(exc))

    version = read(ROOT / "VERSION").strip()
    if re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version) is None:
        fail("VERSION must contain one semantic version")
    changelog = read(ROOT / "CHANGELOG.md")
    release_headings = re.findall(r"^## v([^ ]+)\s+—", changelog, re.M)
    if not release_headings or release_headings[0] != version:
        fail("the first CHANGELOG release must exactly match VERSION")

    marketplace = load_json_object(ROOT / ".agents/plugins/marketplace.json")
    plugin_manifest = load_json_object(
        ROOT / "plugins/sliver-session-continuity/.codex-plugin/plugin.json"
    )
    if marketplace.get("name") != "sliver-local":
        fail("plugin marketplace name must be sliver-local")
    plugins = marketplace.get("plugins")
    if not isinstance(plugins, list):
        fail("plugin marketplace plugins must be a list")
    plugin_entries = [
        entry
        for entry in plugins
        if isinstance(entry, dict)
        and entry.get("name") == "sliver-session-continuity"
    ]
    if len(plugin_entries) != 1:
        fail("plugin marketplace must expose exactly one sliver-session-continuity entry")
    plugin_entry = plugin_entries[0]
    if plugin_entry.get("source") != {
        "source": "local",
        "path": "./plugins/sliver-session-continuity",
    }:
        fail("plugin marketplace source must point to the repository plugin owner")
    if plugin_entry.get("policy") != {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL",
    }:
        fail("plugin marketplace installation and authentication policy drifted")
    if plugin_entry.get("category") != "Developer Tools":
        fail("plugin marketplace category must be Developer Tools")
    if plugin_manifest.get("name") != plugin_entry.get("name"):
        fail("plugin marketplace and plugin manifest names differ")
    plugin_version = plugin_manifest.get("version")
    if not isinstance(plugin_version, str) or re.fullmatch(
        r"[0-9]+\.[0-9]+\.[0-9]+", plugin_version
    ) is None:
        fail("plugin manifest version must contain one semantic version")

    plugin_readme = read(ROOT / "plugins/sliver-session-continuity/README.md")
    plugin_install_contract = [
        'codex plugin marketplace add "$PWD"',
        "codex plugin add sliver-session-continuity@sliver-local",
        "enter `/hooks`",
        "seven declared hooks",
        "four recent redacted prompts",
        "latest plan",
        "last completed assistant message",
        "`PLUGIN_DATA`",
        "redaction is best effort",
        "lazy cleanup",
        "neither accesses project truth nor sends network requests",
    ]
    for statement in plugin_install_contract:
        if statement not in plugin_readme:
            fail(
                "plugin installation owner is missing required trust or privacy "
                f"guidance: {statement}"
            )
    disclosure_position = plugin_readme.index("four recent redacted prompts")
    install_position = plugin_readme.index('codex plugin marketplace add "$PWD"')
    if disclosure_position > install_position:
        fail("plugin privacy disclosure must appear before installation commands")
    hooks_manifest = load_json_object(
        ROOT / "plugins/sliver-session-continuity/hooks/hooks.json"
    )
    declared_hooks = hooks_manifest.get("hooks")
    if not isinstance(declared_hooks, dict) or set(declared_hooks) != {
        "UserPromptSubmit",
        "PostToolUse",
        "Stop",
        "PreCompact",
        "PostCompact",
        "SessionStart",
        "SessionEnd",
    }:
        fail("session continuity plugin must declare exactly the seven reviewed hooks")

    public_validation_commands = [
        "evaluate_ui_design_lifecycle.py",
        "evaluate_ui_design_live_behavior.py --contract-only",
        "evaluate_foundation_live_behavior.py --contract-only",
        "evaluate_studio_live_behavior.py --contract-only",
        "test_stage_v2_contracts.py",
        "test_task_decision_live_contracts.py",
        "test_ui_design_live_contracts.py",
        "test_studio_live_contracts.py",
        "test_runtime_bundle_safety.py",
        "test_session_continuity.py",
        "test_release_candidate_contracts.py",
        "validate_release_candidate.py --contract-only",
    ]
    for surface_name in ("README.md", "COMPATIBILITY.md"):
        surface_text = read(ROOT / surface_name)
        for command in public_validation_commands:
            if command not in surface_text:
                fail(f"{surface_name} is missing current validation command: {command}")

    push_ci_text = read(ROOT / ".github/workflows/validate.yml")
    aggregate_command = "validate_release_candidate.py --contract-only"
    if aggregate_command not in push_ci_text:
        fail(f"push CI is missing aggregate validation command: {aggregate_command}")
    for duplicated_child in [
        "evaluate_studio_live_behavior.py --contract-only",
        "test_stage_v2_contracts.py",
        "test_task_decision_live_contracts.py",
        "test_studio_live_contracts.py",
        "test_session_continuity.py",
    ]:
        if duplicated_child in push_ci_text:
            fail(
                "push CI must call the aggregate owner instead of duplicating child command: "
                + duplicated_child
            )

    skill_text = read(SKILL)
    active_skill = active_markdown(skill_text)
    frontmatter = parse_frontmatter(skill_text)
    if frontmatter.get("name") != "sliver-vibe-coding":
        fail("frontmatter name must be sliver-vibe-coding")
    description = frontmatter.get("description", "")
    if not description:
        fail("frontmatter description is empty")
    if not description.startswith("Use when "):
        fail("frontmatter description must start with 'Use when '")
    if len(description) > 1024:
        fail(f"description too long: {len(description)} characters")
    skill_bytes = len(skill_text.encode("utf-8"))
    skill_lines = len(skill_text.splitlines())
    if skill_bytes > 24000 or skill_lines > 240:
        fail(f"SKILL.md must remain a compact startup kernel, got {skill_bytes} bytes/{skill_lines} lines")
    if "not an exact keyword list" not in active_skill:
        fail("semantic routing must state that examples are not an exact keyword list")

    if (ROOT / "references/commands.md").exists():
        fail("legacy references/commands.md must not exist; use references/routes-index.md")

    interface_text = read(ROOT / "packaging/adapters/codex/agents/openai.yaml")
    for term in [
        "推进当前软件项目任务",
        "当前真相",
        "一个主路由",
        "按任务拓扑缩放治理",
        "命中的风险",
        "当前请求获得新鲜验证",
    ]:
        if term not in interface_text:
            fail(f"agents/openai.yaml must expose startup and scoped-delivery ownership: {term}")

    try:
        startup_protocol = markdown_section(skill_text, "Startup Protocol")
        platform_boundary = markdown_section(skill_text, "Platform Boundary")
        route_index = read(ROOT / "references/routes-index.md")
        primary_routes = markdown_section(route_index, "Primary Workflow Routes")
        lens_section = markdown_section(route_index, "Conditional Development Lenses")
    except ContractError as exc:
        fail(str(exc))
    if (
        startup_protocol is None
        or platform_boundary is None
        or primary_routes is None
        or lens_section is None
    ):
        fail("SKILL.md startup, platform, or routes registry sections are missing")
    for term in [
        "smallest useful current truth",
        "Classify task topology",
        "route-catalog --format json",
        "route-projection --route <route> --format json",
        "Select exactly one primary route",
        "zero or more evidence-backed conditional lenses",
        "Load only the reference owners required",
        "Collect fresh verification",
        "does not force every task through the full lifecycle",
    ]:
        if term not in startup_protocol:
            fail(f"Startup Protocol missing required contract term: {term}")
    runtime_adapter_link = "`references/runtime-adapter.md`"
    if startup_protocol.count(runtime_adapter_link) != 1:
        fail("Startup Protocol must load the fixed runtime adapter exactly once")
    if platform_boundary.count(runtime_adapter_link) != 1:
        fail("Platform Boundary must own exactly one fixed runtime adapter link")
    if "## Primary Workflow Routes" in active_skill or "| Route |" in active_skill:
        fail("SKILL.md must not duplicate the route-to-reference registry")
    for surface in [ROOT / "README.md", ROOT / "COMPATIBILITY.md"]:
        if "| Route |" in active_markdown(read(surface)):
            fail(f"public docs must not duplicate the route-to-reference registry: {surface.name}")
    if (
        "| Route | Purpose and operation rule | Operation -> delivery projection | Load |"
        not in primary_routes
    ):
        fail(
            "routes registry must use the canonical "
            "Route/Purpose/Operation-Delivery/Load table"
        )
    try:
        route_projection = load_route_operation_delivery_matrix(
            ROOT / "references/routes-index.md"
        )
    except ContractError as exc:
        fail(str(exc))
    route_names = tuple(route_projection)
    for internal_label in [
        "任务风险分级",
        "功能开工评估",
        "收费权益设计",
        "第三方接入",
        "接口安全",
        "配置安全",
        "阶段计划",
        "执行子阶段",
        "防漂移",
        "工作室模式",
    ]:
        if f"| `{internal_label}` |" in primary_routes:
            fail(f"internal stage or conditional check leaked into primary route table: {internal_label}")
    for lens in [
        "frontend-design",
        "data-model",
        "backend-api",
        "identity-permission",
        "monetization-entitlement",
        "third-party-provider",
        "security-impact",
        "deployment-release",
    ]:
        if f"`{lens}`" not in lens_section:
            fail(f"conditional development lens missing from routes registry: {lens}")

    referenced = set(re.findall(r"`(references/[^`]+?\.md)`", active_skill + "\n" + route_index))
    for rel in referenced:
        if not (ROOT / rel).is_file():
            fail(f"SKILL.md references missing file: {rel}")

    route_index_lines = len(route_index.splitlines())
    if route_index_lines > 140:
        fail(f"references/routes-index.md should stay a compact registry, got {route_index_lines} lines")
    all_docs = "\n".join(active_markdown(read(path)) for path in DOC_PATHS if path.exists())
    for route in [*route_names, "执行子阶段"]:
        if f"`/{route}`" in all_docs:
            fail(f"fake slash-command route alias found in active docs: /{route}")
    for term in FORBIDDEN_DOC_TERMS:
        if term in all_docs:
            fail(f"forbidden source-provenance term found in skill docs: {term}")

    for required in [
        "D0",
        "D1",
        "D2",
        "D3",
        "identity_permission",
        "local_reversible",
        "Capability Platform Gate",
        "Frontend Design-System Gate",
        "Single Runtime",
        "Cross-Language Architecture Truth",
        "project-bootstrap",
        "project-adoption",
        "check_project_guardrails.py",
        "context-handoff",
        "engineering-execution",
        "安全审计",
        "安全审计不等于修复授权",
        "Security Impact Gate",
        "HTTPS",
        "CHANGELOG.md",
        "COMPATIBILITY.md",
    ]:
        if required not in all_docs and required not in read(ROOT / "README.md"):
            fail(f"required governance/install term missing: {required}")

    legacy_depth_labels = ["轻量任务", "常规任务", "标准任务", "高风险任务"]
    for legacy in legacy_depth_labels:
        if legacy in all_docs:
            fail(f"legacy task-depth label found in active runtime docs: {legacy}")
    legacy_stage_paths = [
        path
        for path in DOC_PATHS
        if path.exists()
        and path != ROOT / "references/project-flow.md"
        and "sliver-stage/v1" in active_markdown(read(path))
    ]
    if legacy_stage_paths:
        fail(
            "legacy stage schema found outside the explicit migration owner: "
            + ", ".join(str(path.relative_to(ROOT)) for path in legacy_stage_paths)
        )

    cases_path = ROOT / "tests/route-eval-cases.json"
    try:
        import json

        route_data = load_json_object(cases_path)
        case_count = len(route_data.get("cases", []))
    except Exception as exc:  # noqa: BLE001
        fail(f"route evaluation cases are invalid JSON: {exc}")
    if case_count < 40:
        fail(f"route evaluation should cover more than smoke tests, got {case_count} cases")

    if "trigger_terms" in read(cases_path) or "trigger_terms" in read(ROOT / "tests/selector-pressure-cases.json"):
        fail("route and selector corpora must not encode keyword-trigger lists")

    for rel in [
        "tests/selector-pressure-cases.json",
        "tests/execution-backbone-cases.json",
    ]:
        try:
            parsed = load_json_object(ROOT / rel)
        except Exception as exc:  # noqa: BLE001
            fail(f"test contract is invalid JSON: {rel}: {exc}")
        if not isinstance(parsed, dict):
            fail(f"test contract must be a JSON object: {rel}")

    print("OK: skill structure validated")


if __name__ == "__main__":
    try:
        main()
    except ContractError as exc:
        fail(str(exc))
