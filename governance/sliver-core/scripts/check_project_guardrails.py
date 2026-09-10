#!/usr/bin/env python3
"""Check whether a user project has the minimum Sliver Vibe Coding guardrails."""

from __future__ import annotations

import argparse
from datetime import date
import json
import re
import stat
import sys
from pathlib import Path
from typing import Optional, Union
from urllib.parse import unquote, urlparse

# Installed runtime bundles are immutable artifacts. Direct guardrail calls must
# not add bytecode files that invalidate the allowlisted bundle closure.
sys.dont_write_bytecode = True

from validation_support import (
    ContractError,
    active_markdown,
    markdown_section,
    read_utf8,
    safe_repo_path,
    split_table_row,
)
from stage_contract import (
    EXIT_OK as STAGE_EXIT_OK,
    check_stage_file,
)


REQUIRED_FILES_BY_MODE = {
    "bootstrap": [
        "AGENTS.md",
        "{truth_dir}/README.md",
        "{truth_dir}/project-brief.md",
        "{truth_dir}/technical-selection.md",
        "{truth_dir}/architecture.md",
        "{truth_dir}/acceptance.md",
    ],
    "adoption": [
        "AGENTS.md",
        "{truth_dir}/README.md",
        "{truth_dir}/current-state-audit.md",
        "{truth_dir}/technical-selection.md",
        "{truth_dir}/architecture.md",
        "{truth_dir}/acceptance.md",
    ],
    "constitution": [
        "AGENTS.md",
    ],
}

REQUIRED_LINKS_BY_MODE = {
    "bootstrap": [
        "project-brief.md",
        "technical-selection.md",
        "architecture.md",
        "acceptance.md",
    ],
    "adoption": [
        "current-state-audit.md",
        "technical-selection.md",
        "architecture.md",
        "acceptance.md",
    ],
}

REQUIRED_HEADINGS = {
    "AGENTS.md": [
        "##",
    ],
    "README.md": [
        "## 当前真源索引",
        "## 文档职责",
        "## 更新规则",
    ],
    "project-brief.md": [
        "## 项目边界",
        "## 第一闭环",
        "## 不做什么",
        "## 已确认的演进边界",
        "## 验收标准",
        "## 停止条件",
    ],
    "current-state-audit.md": [
        "## 现状证据",
        "## 产品边界",
        "## 已确认的演进边界",
        "## 调用链和 owner",
        "## 危险接管动作",
        "## 下一步",
    ],
    "technical-selection.md": [
        "## Foundation Decision Control",
        "## Source Coverage",
        "## Architecture Drivers",
        "## Quality Attribute Scenarios",
        "## Pattern Axes",
        "## Framework Architecture Fit",
        "## Current Primary Evidence",
        "## Proof Of Concept",
        "## Product Consequence Confirmation",
        "## Primary Decision And Tradeoffs",
    ],
    "architecture.md": [
        "## 当前架构",
        "## Owner Map",
        "## 禁止路径",
        "## 验证方式",
    ],
    "acceptance.md": [
        "## 验收门禁",
        "## 证据记录",
        "## 停止条件",
        "## 漂移检查",
    ],
}

REQUIRED_SNIPPETS_BY_MODE = {
    "bootstrap": {
        "AGENTS.md": [
            "架构优先",
            "设计优先",
            "真源",
            "停止条件",
            "前端输入不可信",
            "安全审计不等于修复授权",
            "安全验证证据",
            "测试门禁",
            "RED",
            "GREEN",
            "mock",
            "未验证",
        ],
        "project-brief.md": [
            "第一闭环",
            "不做什么",
            "已确认的下一阶段能力",
            "只是设想，不得影响当前架构",
            "停止条件",
        ],
        "architecture.md": [
            "technical-selection.md",
            "Owner Map",
            "禁止路径",
        ],
        "technical-selection.md": [
            "sliver-foundation/v1",
            "product_consequences_only",
            "Architecture Drivers",
            "Quality Attribute Scenarios",
            "Pattern Axes",
            "Framework Architecture Fit",
            "Current Primary Evidence",
            "Proof Of Concept",
            "Primary Decision And Tradeoffs",
        ],
        "acceptance.md": [
            "验收门禁",
            "证据记录",
            "漂移检查",
        ],
    },
    "adoption": {
        "AGENTS.md": [
            "半路接管",
            "危险接管动作",
            "前端输入不可信",
            "安全审计不等于修复授权",
            "安全验证证据",
            "测试门禁",
            "RED",
            "GREEN",
            "mock",
            "禁止 `git add .`",
        ],
        "current-state-audit.md": [
            "现状证据",
            "技术栈适配",
            "危险接管动作",
            "已确认的下一阶段能力",
            "只是设想，不得影响当前架构",
        ],
        "architecture.md": [
            "technical-selection.md",
            "Current Owner",
            "Target Owner",
            "Forbidden Owner",
        ],
        "technical-selection.md": [
            "sliver-foundation/v1",
            "product_consequences_only",
            "Architecture Drivers",
            "Quality Attribute Scenarios",
            "Pattern Axes",
            "Framework Architecture Fit",
            "Current Primary Evidence",
            "Proof Of Concept",
            "Primary Decision And Tradeoffs",
        ],
        "acceptance.md": [
            "第一个安全任务",
            "漂移检查",
        ],
    },
    "constitution": {
        "AGENTS.md": [
            "架构优先",
            "真源",
            "停止条件",
            "前端输入不可信",
            "安全审计不等于修复授权",
            "安全验证证据",
            "测试门禁",
            "RED",
            "GREEN",
            "mock",
            "未验证",
        ],
    },
}

SECURITY_SECTION_SNIPPETS = [
    "前端输入不可信",
    "密钥",
    "安全审计不等于修复授权",
    "安全验证证据",
    "未经确认",
    "未验证",
]

TEST_SECTION_SNIPPETS = [
    "实现改动前",
    "测试门禁",
    "稳定可自动化",
    "RED",
    "GREEN",
    "真实",
    "mock",
    "零测试",
]

REQUIRED_SECTION_SNIPPETS_BY_MODE = {
    "bootstrap": {
        "AGENTS.md": {"安全红线": SECURITY_SECTION_SNIPPETS, "测试与验证": TEST_SECTION_SNIPPETS},
        "project-brief.md": {
            "已确认的演进边界": [
                "当前必须交付",
                "已确认的下一阶段能力",
                "当前不实现但不能堵死",
                "明确不会做",
                "只是设想，不得影响当前架构",
            ]
        },
    },
    "adoption": {
        "AGENTS.md": {"安全红线": SECURITY_SECTION_SNIPPETS, "测试与验证": TEST_SECTION_SNIPPETS},
        "current-state-audit.md": {
            "已确认的演进边界": [
                "当前必须交付",
                "已确认的下一阶段能力",
                "当前不实现但不能堵死",
                "明确不会做",
                "只是设想，不得影响当前架构",
                "临时 fallback",
            ]
        },
    },
    "constitution": {"AGENTS.md": {"安全红线": SECURITY_SECTION_SNIPPETS, "测试与验证": TEST_SECTION_SNIPPETS}},
}

REQUIRED_SECTION_MIN_BULLETS_BY_MODE = {
    "bootstrap": {
        "AGENTS.md": {"安全红线": 6, "测试与验证": 2},
        "project-brief.md": {"已确认的演进边界": 5},
    },
    "adoption": {
        "AGENTS.md": {"安全红线": 6, "测试与验证": 2},
        "current-state-audit.md": {"已确认的演进边界": 6},
    },
    "constitution": {"AGENTS.md": {"安全红线": 6, "测试与验证": 2}},
}

FORBIDDEN_SECTION_PATTERNS_BY_MODE = {
    mode: {
        "AGENTS.md": {
            "测试与验证": [
                r"(测试门禁|测试决策|分类|RED|GREEN|mock).{0,100}(可以|均可|可按需|按需).{0,20}(跳过|省略|忽略|不做)",
                r"(测试门禁|测试决策|分类|RED|GREEN|mock).{0,120}(仅供参考|不强制(执行)?|无需强制|由.{0,12}自行决定|视情况(执行)?|酌情(执行)?|可选)",
                r"(?i)(test gate|test decision|classification|RED|GREEN|mock).{0,80}(optional|may be skipped|can be skipped)",
            ]
        }
    }
    for mode in ("bootstrap", "adoption", "constitution")
}

PLACEHOLDER_MARKERS = [
    "待填写",
    "TODO",
    "TBD",
    "@@",
    "<Project>",
    "<project>",
]

DRIFT_MARKERS = [
    "后续再补",
    "先留着",
    "暂时兼容",
    "临时兼容",
    "以后再说",
    "later maybe",
]

NEGATED_MARKER_TERMS = [
    "禁止",
    "不得",
    "不能",
    "不要",
    "Do not",
    "Never",
]

# Growing truth directories that must stay reachable through their own index.
# Files under a sibling ``archive/`` are excluded from every active check.
INDEXED_TRUTH_DIRS = {
    "features": {"active", "superseded", "archived"},
    "decisions": {"active", "superseded", "archived"},
    "audits": {"open", "closed", "archived"},
}
ARCHIVE_DIR_NAME = "archive"
INDEX_FILE_NAME = "README.md"

# Vague terms are reported as warnings with file and line; they never fail the
# gate. Each group applies to the document classes named in VAGUE_TERM_SCOPES.
VAGUE_TERMS_BY_GROUP = {
    "general": (
        "待定",
        "后续再定",
        "所有人",
        "所有用户",
        "all users",
        "平台化",
        "赋能",
        "生态",
        "闭环打通",
        "同时支持",
        "also supports",
        "简单",
        "simple",
    ),
    "technical-selection": ("最新版", "latest", "随便", "any"),
    "acceptance": ("应该没问题", "should work", "看起来正常", "looks fine"),
}
VAGUE_TERM_SCOPES = {
    "technical-selection": ("technical-selection", "tech-stack"),
    "acceptance": ("acceptance", "quality", "stages/", "验收"),
}

PRIVATE_RISK_LIMIT = 30
PRIVATE_SCAN_MAX_ENTRIES = 5000
PRIVATE_SCAN_MAX_FILE_BYTES = 256 * 1024
PRIVATE_SCAN_MAX_TOTAL_BYTES = 4 * 1024 * 1024
PRIVATE_RISK_EXACT_NAMES = {
    "id_rsa": "private_key_file",
    "database.sql": "database_dump_file",
    "dump.sql": "database_dump_file",
}
PRIVATE_RISK_EXACT_STEMS = {
    "service-account": "service_account_file",
    "secret": "secret_named_file",
    "secrets": "secret_named_file",
    "private-key": "private_key_file",
}
SECRET_ASSIGNMENT_RE = re.compile(
    r"^\s*(?:export\s+)?[\"']?"
    r"(?:[A-Za-z0-9_.-]*(?:api[_-]?key|access[_-]?token|auth[_-]?token|"
    r"client[_-]?secret|secret[_-]?key|password|passwd|private[_-]?key)"
    r"[A-Za-z0-9_.-]*)[\"']?\s*[:=]\s*(?P<value>.+?)\s*$",
    flags=re.I,
)
SECRET_JSON_ASSIGNMENT_RE = re.compile(
    r"[\"'](?:[A-Za-z0-9_.-]*(?:api[_-]?key|access[_-]?token|auth[_-]?token|"
    r"client[_-]?secret|secret[_-]?key|password|passwd|private[_-]?key)"
    r"[A-Za-z0-9_.-]*)[\"']\s*:\s*"
    r"(?P<value>[\"'](?:\\.|[^\"'\\])*[\"'])",
    flags=re.I,
)
NON_SECRET_LITERAL_VALUES = {
    "",
    "none",
    "null",
    "false",
    "redacted",
    "masked",
    "changeme",
    "change-me",
    "placeholder",
    "dummy",
    "sample",
    "test",
}

FOUNDATION_FIELDS = {
    "schema": ["schema"],
    "decision_status": ["decision_status"],
    "source_coverage": ["source_coverage"],
    "blocking_unknowns": ["blocking_unknowns"],
    "source_conflicts": ["source_conflicts"],
    "network_evidence": ["network_evidence"],
    "poc_status": ["poc_status"],
    "user_confirmation_scope": ["user_confirmation_scope"],
    "product_consequence_confirmation": ["product_consequence_confirmation"],
    "recommendation": ["recommendation"],
    "decision_record": ["decision_record"],
}

FOUNDATION_DECISION_FIELDS = {
    "primary_combination": ["primary_combination"],
    "why_it_fits": ["why_it_fits"],
    "accepted_downside": ["accepted_downside"],
    "rejected_alternatives": ["rejected_alternatives"],
    "minimum_reversible_boundary": ["minimum_reversible_boundary"],
    "migration_cliff": ["migration_cliff"],
    "re_evaluation_trigger": ["re_evaluation_trigger"],
    "architecture_writeback": ["architecture_writeback"],
}

FOUNDATION_SECTION_HEADERS = {
    "Source Coverage": ["category", "source", "status", "evidence"],
    "Architecture Drivers": [
        "driver",
        "business priority",
        "architecture impact",
        "source evidence",
        "failure consequence",
    ],
    "Quality Attribute Scenarios": [
        "attribute",
        "source",
        "stimulus",
        "artifact",
        "environment",
        "response",
        "measure",
        "priority",
    ],
    "Pattern Axes": [
        "axis",
        "current choice",
        "scope",
        "driver fit",
        "rejected alternative",
        "upgrade trigger",
    ],
    "Framework Architecture Fit": [
        "candidate",
        "framework-native structure",
        "driver fit",
        "native support",
        "local adaptation",
        "conflict/bypass cost",
        "operations cost",
        "migration cliff",
        "verdict",
    ],
    "Current Primary Evidence": [
        "candidate or decision",
        "claim being checked",
        "primary url/source",
        "source type",
        "checked date",
        "version/support target",
        "result",
    ],
    "Proof Of Concept": [
        "poc id",
        "success criterion",
        "failure criterion",
        "evidence reference",
        "observed result",
        "decision impact",
    ],
    "Product Consequence Confirmation": [
        "consequence",
        "user-visible result",
        "cost or operation impact",
        "data, downtime or irreversible impact",
        "user decision",
        "confirmation evidence",
    ],
}

REQUIRED_PATTERN_AXES = {
    "部署拓扑",
    "内部代码组织",
    "领域建模",
    "数据与一致性",
    "模块通信",
    "客户端接口",
    "扩展机制",
    "组织与平台",
}

REQUIRED_SOURCE_CATEGORIES = {
    "product_scope",
    "users_outcomes",
    "roadmap_boundaries",
    "existing_system",
    "runtime_operations",
    "data_security_compliance",
    "platform_organization",
}

FOUNDATION_EVIDENCE_MAX_AGE_DAYS = 180
FOUNDATION_GATE_LEVELS = {"contract", "recommendation", "implementation"}
RESERVED_EVIDENCE_HOSTS = {
    "example.com",
    "www.example.com",
    "example.org",
    "www.example.org",
    "example.net",
    "www.example.net",
    "localhost",
}

MECHANICAL_FIELD_VALUES = {
    "x",
    "xx",
    "xxx",
    "-",
    "--",
    "n/a",
    "na",
    "todo",
    "tbd",
    "unknown",
    "未知",
    "待填",
    "待定",
    "随便",
}

def read_text(path: Path) -> str:
    return read_utf8(path)


def rel_path(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def doc_key(rel: str, truth_dir: str) -> str:
    prefix = f"{truth_dir}/"
    if rel.startswith(prefix):
        return rel[len(prefix) :]
    return rel


def required_files(mode: str, truth_dir: str) -> list[str]:
    return [item.format(truth_dir=truth_dir) for item in REQUIRED_FILES_BY_MODE[mode]]


def is_empty_field(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("- ") or ":" not in stripped:
        return False
    key, value = stripped[2:].split(":", 1)
    return bool(key.strip()) and not value.strip()


def is_negated_line(line: str) -> bool:
    return any(term in line for term in NEGATED_MARKER_TERMS)


def has_required_heading(text: str, heading: str) -> bool:
    if heading == "##":
        return any(line.startswith("## ") for line in text.splitlines())
    return any(line.strip() == heading for line in text.splitlines())


def private_filename_risk(path: Path) -> Optional[str]:
    name = path.name.casefold()
    if name == ".env" or name.startswith(".env."):
        return "environment_file"
    if name in PRIVATE_RISK_EXACT_NAMES:
        return PRIVATE_RISK_EXACT_NAMES[name]
    return PRIVATE_RISK_EXACT_STEMS.get(Path(name).stem)


def looks_material_secret(value: str) -> bool:
    value = value.strip().rstrip(",;").strip()
    value = value.strip("\"'").strip()
    normalized = value.casefold()
    if len(value) < 8 or normalized in NON_SECRET_LITERAL_VALUES:
        return False
    if (
        value.startswith(("$", "${", "{{", "<"))
        or normalized.startswith(("env(", "os.getenv(", "process.env."))
        or set(value) <= {"*", "x", "X", "-", "_"}
    ):
        return False
    return True


def has_secret_like_assignment(text: str) -> bool:
    if "-----BEGIN PRIVATE KEY-----" in text:
        return True
    for match in SECRET_JSON_ASSIGNMENT_RE.finditer(text):
        if looks_material_secret(match.group("value")):
            return True
    for line in text.splitlines():
        match = SECRET_ASSIGNMENT_RE.fullmatch(line)
        if match is not None and looks_material_secret(match.group("value")):
            return True
    return False


def find_private_risks(root: Path) -> list[dict[str, str]]:
    """Return bounded path-only hints; this is not a complete secret scanner."""
    risks: list[dict[str, str]] = []
    scanned_entries = 0
    scanned_bytes = 0
    for child in root.rglob("*"):
        scanned_entries += 1
        if scanned_entries > PRIVATE_SCAN_MAX_ENTRIES:
            break
        try:
            relative = child.relative_to(root)
        except ValueError:
            continue
        if ".git" in relative.parts or child.is_symlink():
            continue
        try:
            file_stat = child.lstat()
        except OSError:
            continue
        if not stat.S_ISREG(file_stat.st_mode):
            continue

        filename_risk = private_filename_risk(child)
        if filename_risk is not None:
            risks.append({"path": relative.as_posix(), "risk_type": filename_risk})
        elif (
            file_stat.st_size <= PRIVATE_SCAN_MAX_FILE_BYTES
            and scanned_bytes < PRIVATE_SCAN_MAX_TOTAL_BYTES
        ):
            remaining = PRIVATE_SCAN_MAX_TOTAL_BYTES - scanned_bytes
            try:
                raw = child.read_bytes()[:remaining]
            except OSError:
                continue
            scanned_bytes += len(raw)
            if b"\x00" not in raw:
                try:
                    text = raw.decode("utf-8")
                except UnicodeDecodeError:
                    pass
                else:
                    if has_secret_like_assignment(text):
                        risks.append(
                            {
                                "path": relative.as_posix(),
                                "risk_type": "secret_like_assignment",
                            }
                        )
        if len(risks) >= PRIVATE_RISK_LIMIT:
            break
    return risks


def exact_section_by_aliases(text: str, aliases: list[str], *, label: str) -> Optional[str]:
    matches = []
    for alias in aliases:
        section = markdown_section(text, alias)
        if section is not None:
            matches.append(section)
    if len(matches) > 1:
        raise ContractError(f"duplicate stage section owner: {label}")
    return matches[0] if matches else None


def section_body(section: str) -> str:
    lines = section.splitlines()
    return "\n".join(lines[1:]).strip()


def parse_bullet_fields(
    section: str,
    field_aliases: dict[str, list[str]],
) -> tuple[dict[str, str], list[str], list[str]]:
    alias_to_key = {
        alias.casefold(): key
        for key, aliases in field_aliases.items()
        for alias in aliases
    }
    values: dict[str, str] = {}
    duplicates: list[str] = []
    for line in section_body(section).splitlines():
        match = re.match(r"^\s*-\s*([^:：]+)\s*[:：]\s*(.*?)\s*$", line)
        if not match:
            continue
        key = alias_to_key.get(match.group(1).strip().casefold())
        if key is None:
            continue
        if key in values:
            duplicates.append(key)
            continue
        values[key] = match.group(2).strip()
    missing = [key for key in field_aliases if not values.get(key)]
    return values, missing, duplicates


def status_with_evidence(value: str, allowed: set[str]) -> tuple[Optional[str], Optional[str]]:
    for status in sorted(allowed, key=len, reverse=True):
        prefix = f"{status}:"
        if value.startswith(prefix):
            evidence = value[len(prefix) :].strip()
            return status, evidence if len(evidence) >= 4 else None
    return None, None


def meaningful_foundation_value(value: str) -> bool:
    normalized = value.strip().strip("`").casefold()
    return bool(
        len(normalized) >= 4
        and normalized not in MECHANICAL_FIELD_VALUES
        and normalized not in {
            "evidence",
            "same evidence",
            "official evidence",
            "best practice",
            "最佳实践",
            "已有证据",
            "见证据",
            "已确认",
        }
        and not any(marker.casefold() in normalized for marker in PLACEHOLDER_MARKERS)
    )


def parsed_current_evidence_date(value: str) -> tuple[Optional[date], Optional[str]]:
    try:
        checked = date.fromisoformat(value)
    except ValueError:
        return None, "invalid date"
    today = date.today()
    if checked > today:
        return None, "future date"
    if (today - checked).days > FOUNDATION_EVIDENCE_MAX_AGE_DAYS:
        return None, "stale date"
    return checked, None


def is_primary_https_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    host = (parsed.hostname or "").casefold().rstrip(".")
    if parsed.scheme != "https" or not host or host in RESERVED_EVIDENCE_HOSTS:
        return False
    if host.endswith(".example") or host.endswith(".invalid") or host.endswith(".test"):
        return False
    return "." in host


def repeated_mechanical_evidence(values: list[str]) -> list[str]:
    counts: dict[str, int] = {}
    originals: dict[str, str] = {}
    for value in values:
        normalized = re.sub(r"\s+", " ", value.strip().strip("`").casefold())
        if not meaningful_foundation_value(normalized) or normalized.startswith("https://"):
            continue
        counts[normalized] = counts.get(normalized, 0) + 1
        originals.setdefault(normalized, value.strip())
    return [originals[value] for value, count in counts.items() if count > 1]


def has_artifact_reference(value: str) -> bool:
    normalized = value.strip()
    return bool(
        is_primary_https_url(normalized)
        or re.search(
            r"(?:^|\s)(?:[./][\w./-]+|[\w.-]+\.(?:log|json|xml|txt|md)|"
            r"(?:npm|pnpm|yarn|pytest|python|go test|cargo test|curl)\b|commit\s+[0-9a-f]{7,40})",
            normalized,
            flags=re.I,
        )
    )


def markdown_table_for_section(
    text: str,
    section_name: str,
    expected_header: list[str],
) -> tuple[list[list[str]], list[str]]:
    section = markdown_section(text, section_name)
    if section is None:
        return [], [f"missing section:{section_name}"]
    parsed = [split_table_row(line) for line in section_body(section).splitlines()]
    rows = [cells for cells in parsed if cells]
    if len(rows) < 2:
        return [], [f"missing table:{section_name}"]
    header = [cell.strip().strip("`").casefold() for cell in rows[0]]
    if header != expected_header:
        return [], [f"invalid table header:{section_name}"]
    data_rows = []
    errors = []
    for cells in rows[1:]:
        if cells and all(re.fullmatch(r":?-{3,}:?", cell.strip()) for cell in cells):
            continue
        if len(cells) != len(expected_header):
            errors.append(f"invalid table row width:{section_name}")
            continue
        data_rows.append([cell.strip() for cell in cells])
    if not data_rows:
        errors.append(f"missing table data:{section_name}")
    return data_rows, errors


def check_foundation_file(
    root: Path,
    truth_dir: str,
    allow_template: bool,
    required_gate: str = "recommendation",
) -> dict:
    if required_gate not in FOUNDATION_GATE_LEVELS:
        raise ContractError(f"invalid foundation gate: {required_gate}")
    result = {
        "foundation_file": f"{truth_dir}/technical-selection.md",
        "foundation_required_gate": required_gate,
        "foundation_validation_scope": "structural_evidence_contract_only",
        "foundation_external_implementation_authorized": False,
        "foundation_values": {},
        "foundation_missing_fields": [],
        "foundation_invalid_fields": [],
        "foundation_duplicate_fields": [],
        "foundation_table_errors": [],
        "foundation_gate_blockers": [],
        "foundation_structural_contract_valid": False,
        "foundation_structural_recommendation_ready": False,
        "foundation_structural_implementation_ready": False,
        "foundation_required_gate_met": False,
        "foundation_gate_outcome": "blocked",
    }
    path = safe_repo_path(root, result["foundation_file"], label="foundation decision file")
    if not path.is_file():
        result["foundation_gate_blockers"].append("missing technical-selection.md")
        return result

    text = active_markdown(read_text(path))
    control = markdown_section(text, "Foundation Decision Control")
    if control is None:
        result["foundation_gate_blockers"].append("missing Foundation Decision Control")
        return result
    values, missing, duplicates = parse_bullet_fields(control, FOUNDATION_FIELDS)
    result["foundation_values"] = values
    result["foundation_missing_fields"].extend(missing)
    result["foundation_duplicate_fields"].extend(duplicates)

    decision_section = markdown_section(text, "Primary Decision And Tradeoffs")
    decision_values: dict[str, str] = {}
    if decision_section is None:
        result["foundation_gate_blockers"].append("missing Primary Decision And Tradeoffs")
    else:
        decision_values, decision_missing, decision_duplicates = parse_bullet_fields(
            decision_section,
            FOUNDATION_DECISION_FIELDS,
        )
        result["foundation_missing_fields"].extend(decision_missing)
        result["foundation_duplicate_fields"].extend(decision_duplicates)

    tables: dict[str, list[list[str]]] = {}
    for section_name, header in FOUNDATION_SECTION_HEADERS.items():
        rows, errors = markdown_table_for_section(text, section_name, header)
        tables[section_name] = rows
        result["foundation_table_errors"].extend(errors)

    if values.get("schema") != "sliver-foundation/v1":
        result["foundation_invalid_fields"].append("schema")
    if values.get("decision_status") not in {
        "blocked",
        "researching",
        "poc_required",
        "recommendation_ready",
        "implementation_ready",
    }:
        result["foundation_invalid_fields"].append("decision_status")
    if values.get("source_coverage") not in {"incomplete", "conflict", "complete"}:
        result["foundation_invalid_fields"].append("source_coverage")
    if values.get("blocking_unknowns") not in {"present", "none"}:
        result["foundation_invalid_fields"].append("blocking_unknowns")
    if values.get("source_conflicts") not in {"present", "none"}:
        result["foundation_invalid_fields"].append("source_conflicts")
    if values.get("user_confirmation_scope") != "product_consequences_only":
        result["foundation_invalid_fields"].append("user_confirmation_scope")

    primary_count = sum(
        1
        for line in section_body(decision_section or "").splitlines()
        if re.match(r"^\s*-\s*primary_combination\s*[:：]", line)
    )
    if primary_count != 1:
        result["foundation_gate_blockers"].append(
            "exactly one primary_combination is required"
        )

    decision_status = values.get("decision_status")
    architecture_path = safe_repo_path(
        root,
        f"{truth_dir}/architecture.md",
        label="architecture truth",
    )
    if architecture_path.is_file():
        architecture = active_markdown(read_text(architecture_path))
        architecture_section = markdown_section(architecture, "当前架构")
        architecture_values: dict[str, str] = {}
        if architecture_section is not None:
            architecture_values, _, architecture_duplicates = parse_bullet_fields(
                architecture_section,
                {"foundation_decision_status": ["foundation_decision_status"]},
            )
            if architecture_duplicates:
                result["foundation_gate_blockers"].append(
                    "duplicate architecture foundation_decision_status"
                )
        architecture_status = architecture_values.get("foundation_decision_status")
        expected_architecture_status = (
            "implementation_ready" if decision_status == "implementation_ready" else "blocked"
        )
        if architecture_status != expected_architecture_status:
            result["foundation_gate_blockers"].append(
                "architecture foundation_decision_status does not match technical selection"
            )
    if decision_status not in {"recommendation_ready", "implementation_ready"}:
        result["foundation_structural_contract_valid"] = not any(
            result[key]
            for key in (
                "foundation_missing_fields",
                "foundation_invalid_fields",
                "foundation_duplicate_fields",
                "foundation_table_errors",
                "foundation_gate_blockers",
            )
        )
        if result["foundation_structural_contract_valid"]:
            result["foundation_gate_outcome"] = "contract_valid_decision_blocked"
        result["foundation_required_gate_met"] = bool(
            required_gate == "contract" and result["foundation_structural_contract_valid"]
        )
        return result

    required_ready_states = {
        "source_coverage": "complete",
        "blocking_unknowns": "none",
        "source_conflicts": "none",
        "recommendation": "primary",
    }
    for key, expected in required_ready_states.items():
        if values.get(key) != expected:
            result["foundation_gate_blockers"].append(
                f"recommendation_ready requires {key}:{expected}"
            )

    network_status, network_evidence = status_with_evidence(
        values.get("network_evidence", ""),
        {"verified_current"},
    )
    network_url = re.search(r"https://[^\s,;]+", network_evidence or "")
    network_date = re.search(r"\b20\d{2}-\d{2}-\d{2}\b", network_evidence or "")
    if network_status != "verified_current" or network_evidence is None:
        result["foundation_gate_blockers"].append(
            "recommendation_ready requires dated current primary network evidence"
        )
    else:
        if network_url is None or not is_primary_https_url(network_url.group(0)):
            result["foundation_gate_blockers"].append(
                "network evidence requires a non-example primary HTTPS source"
            )
        if network_date is None or parsed_current_evidence_date(network_date.group(0))[1]:
            result["foundation_gate_blockers"].append(
                "network evidence date is invalid, future, or stale"
            )

    poc_status, poc_evidence = status_with_evidence(
        values.get("poc_status", ""),
        {"completed", "not_required"},
    )
    if poc_status is None or poc_evidence is None:
        result["foundation_gate_blockers"].append(
            "recommendation_ready requires completed or evidence-backed not_required PoC"
        )

    confirmation_status, confirmation_evidence = status_with_evidence(
        values.get("product_consequence_confirmation", ""),
        {"pending", "confirmed", "original_request_confirmed"},
    )
    if confirmation_status is None or confirmation_evidence is None:
        result["foundation_gate_blockers"].append(
            "product consequence confirmation state lacks evidence"
        )
    elif decision_status == "implementation_ready" and confirmation_status == "pending":
        result["foundation_gate_blockers"].append(
            "implementation_ready requires confirmed product consequences"
        )

    record_status, record_evidence = status_with_evidence(
        values.get("decision_record", ""),
        {"complete", "recorded"},
    )
    if record_status is None or record_evidence is None:
        result["foundation_gate_blockers"].append(
            "decision rationale and evidence are not recorded"
        )

    for key, value in decision_values.items():
        if not meaningful_foundation_value(value):
            result["foundation_invalid_fields"].append(key)

    source_rows = tables.get("Source Coverage", [])
    source_categories = [row[0] for row in source_rows]
    if set(source_categories) != REQUIRED_SOURCE_CATEGORIES or len(source_categories) != len(
        REQUIRED_SOURCE_CATEGORIES
    ):
        result["foundation_table_errors"].append(
            "Source Coverage must cover each required category exactly once"
        )
    source_evidence_values: list[str] = []
    for index, row in enumerate(source_rows, start=1):
        if row[2] not in {"confirmed", "not_applicable"}:
            result["foundation_table_errors"].append(
                f"source coverage row {index} is unresolved"
            )
        if not meaningful_foundation_value(row[1]) or not meaningful_foundation_value(row[3]):
            result["foundation_table_errors"].append(
                f"source coverage row {index} lacks evidence"
            )
        source_evidence_values.append(row[3])
    if repeated_mechanical_evidence(source_evidence_values):
        result["foundation_table_errors"].append(
            "Source Coverage repeats the same evidence across distinct categories"
        )

    for section_name in ("Architecture Drivers", "Quality Attribute Scenarios"):
        for index, row in enumerate(tables.get(section_name, []), start=1):
            if any(not meaningful_foundation_value(cell) for cell in row):
                result["foundation_table_errors"].append(
                    f"{section_name} row {index} contains mechanical or empty evidence"
                )

    pattern_rows = tables.get("Pattern Axes", [])
    present_axes = {row[0] for row in pattern_rows}
    if present_axes != REQUIRED_PATTERN_AXES or len(pattern_rows) != len(REQUIRED_PATTERN_AXES):
        result["foundation_table_errors"].append(
            "Pattern Axes must cover each required decision axis exactly once"
        )
    for index, row in enumerate(pattern_rows, start=1):
        if any(not meaningful_foundation_value(cell) for cell in row[1:]):
            result["foundation_table_errors"].append(
                f"Pattern Axes row {index} contains mechanical or empty evidence"
            )

    framework_rows = tables.get("Framework Architecture Fit", [])
    if len(framework_rows) < 1:
        result["foundation_table_errors"].append(
            "Framework Architecture Fit requires one credible primary combination"
        )
    verdicts = [row[-1].casefold() for row in framework_rows]
    if verdicts.count("primary") != 1 or any(
        verdict not in {"primary", "rejected"} for verdict in verdicts
    ):
        result["foundation_table_errors"].append(
            "Framework Architecture Fit requires exactly one primary verdict"
        )
    for index, row in enumerate(framework_rows, start=1):
        if any(not meaningful_foundation_value(cell) for cell in row[:-1]):
            result["foundation_table_errors"].append(
                f"Framework Architecture Fit row {index} contains mechanical evidence"
            )

    evidence_rows = tables.get("Current Primary Evidence", [])
    evidence_candidates: set[str] = set()
    evidence_urls: set[str] = set()
    evidence_dates: set[str] = set()
    evidence_results: list[str] = []
    for index, row in enumerate(evidence_rows, start=1):
        evidence_candidates.add(row[0].casefold())
        evidence_urls.add(row[2])
        evidence_dates.add(row[4])
        checked_date, date_error = parsed_current_evidence_date(row[4])
        if (
            not meaningful_foundation_value(row[0])
            or not meaningful_foundation_value(row[1])
            or not is_primary_https_url(row[2])
            or row[3].casefold() not in {"official_docs", "official_release", "official_advisory", "official_policy", "official_pricing"}
            or checked_date is None
            or date_error is not None
            or not meaningful_foundation_value(row[5])
            or not meaningful_foundation_value(row[6])
        ):
            result["foundation_table_errors"].append(
                f"Current Primary Evidence row {index} is not fresh, typed primary evidence"
            )
        evidence_results.append(row[6])
    for index, row in enumerate(framework_rows, start=1):
        if row[0].casefold() not in evidence_candidates:
            result["foundation_table_errors"].append(
                f"Framework Architecture Fit row {index} has no matching primary evidence"
            )
    if repeated_mechanical_evidence(evidence_results):
        result["foundation_table_errors"].append(
            "Current Primary Evidence repeats the same generic result"
        )
    if network_url is not None and network_url.group(0) not in evidence_urls:
        result["foundation_table_errors"].append(
            "network_evidence URL is not cross-referenced by Current Primary Evidence"
        )
    if network_date is not None and network_date.group(0) not in evidence_dates:
        result["foundation_table_errors"].append(
            "network_evidence date is not cross-referenced by Current Primary Evidence"
        )

    if poc_status == "completed":
        for index, row in enumerate(tables.get("Proof Of Concept", []), start=1):
            if any(not meaningful_foundation_value(cell) for cell in row):
                result["foundation_table_errors"].append(
                    f"Proof Of Concept row {index} lacks executable evidence"
                )
            if not has_artifact_reference(row[3]):
                result["foundation_table_errors"].append(
                    f"Proof Of Concept row {index} lacks an artifact or command reference"
                )
            if row[0].casefold() not in poc_evidence.casefold():
                result["foundation_table_errors"].append(
                    f"Proof Of Concept row {index} is not cross-referenced by poc_status"
                )
    elif poc_status == "not_required":
        poc_section = markdown_section(text, "Proof Of Concept") or ""
        poc_values, poc_missing, poc_duplicates = parse_bullet_fields(
            poc_section,
            {
                "poc_hypothesis": ["poc_hypothesis"],
                "disposable_boundary": ["disposable_boundary"],
            },
        )
        if poc_missing or poc_duplicates or any(
            not meaningful_foundation_value(value) for value in poc_values.values()
        ):
            result["foundation_table_errors"].append(
                "not_required PoC requires a specific hypothesis closure and disposable boundary"
            )
        reason_text = " ".join([poc_evidence, *poc_values.values()]).casefold()
        if not any(
            marker in reason_text
            for marker in ("not required", "no material", "无需", "不需要", "不存在关键", "已由官方")
        ):
            result["foundation_table_errors"].append(
                "not_required PoC does not explain why no decision-changing uncertainty remains"
            )

    consequence_rows = tables.get("Product Consequence Confirmation", [])
    consequence_decisions: list[str] = []
    for index, row in enumerate(consequence_rows, start=1):
        if any(not meaningful_foundation_value(cell) for cell in row[:4]) or not meaningful_foundation_value(row[5]):
            result["foundation_table_errors"].append(
                f"Product Consequence Confirmation row {index} is incomplete"
            )
        allowed_decisions = {"confirmed", "original_request_confirmed"} if decision_status == "implementation_ready" else {"confirmed", "original_request_confirmed", "pending"}
        if row[4] not in allowed_decisions:
            result["foundation_table_errors"].append(
                f"Product Consequence Confirmation row {index} is not confirmed"
            )
        consequence_decisions.append(row[4])

    all_consequences_confirmed = bool(consequence_decisions) and all(
        value in {"confirmed", "original_request_confirmed"} for value in consequence_decisions
    )
    any_consequence_pending = any(value == "pending" for value in consequence_decisions)
    if confirmation_status in {"confirmed", "original_request_confirmed"} and not all_consequences_confirmed:
        result["foundation_gate_blockers"].append(
            "confirmation control claims confirmed while consequence rows remain pending"
        )
    if confirmation_status == "pending" and not any_consequence_pending:
        result["foundation_gate_blockers"].append(
            "confirmation control claims pending without a pending consequence row"
        )
    if confirmation_status == "original_request_confirmed" and any(
        value != "original_request_confirmed" for value in consequence_decisions
    ):
        result["foundation_gate_blockers"].append(
            "original request confirmation control is not reflected by every consequence row"
        )
    if decision_status == "implementation_ready" and not all_consequences_confirmed:
        result["foundation_gate_blockers"].append(
            "implementation_ready requires every product consequence row to be confirmed"
        )

    result["foundation_structural_contract_valid"] = not any(
        result[key]
        for key in (
            "foundation_missing_fields",
            "foundation_invalid_fields",
            "foundation_duplicate_fields",
            "foundation_table_errors",
            "foundation_gate_blockers",
        )
    )
    result["foundation_structural_recommendation_ready"] = bool(
        result["foundation_structural_contract_valid"]
        and decision_status in {"recommendation_ready", "implementation_ready"}
    )
    result["foundation_structural_implementation_ready"] = bool(
        result["foundation_structural_recommendation_ready"]
        and decision_status == "implementation_ready"
    )
    if result["foundation_structural_implementation_ready"]:
        result["foundation_gate_outcome"] = "implementation_structurally_ready_external_authorization_still_required"
    elif result["foundation_structural_recommendation_ready"]:
        result["foundation_gate_outcome"] = "recommendation_structurally_ready_implementation_blocked"
    result["foundation_required_gate_met"] = {
        "contract": result["foundation_structural_contract_valid"],
        "recommendation": result["foundation_structural_recommendation_ready"],
        "implementation": result["foundation_structural_implementation_ready"],
    }[required_gate]
    return result


def _vague_term_pattern(term: str) -> "re.Pattern[str]":
    if re.fullmatch(r"[A-Za-z][A-Za-z ]*", term):
        return re.compile(rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])", flags=re.I)
    return re.compile(re.escape(term))


VAGUE_TERM_PATTERNS = {
    group: [(term, _vague_term_pattern(term)) for term in terms]
    for group, terms in VAGUE_TERMS_BY_GROUP.items()
}


def vague_term_groups_for(rel: str) -> list[str]:
    groups = ["general"]
    lowered = rel.casefold()
    for group, markers in VAGUE_TERM_SCOPES.items():
        if any(marker.casefold() in lowered for marker in markers):
            groups.append(group)
    return groups


def scan_vague_terms(rel: str, text: str) -> list[dict[str, Union[int, str]]]:
    """Return warning-level vague-term hits as file:line:term records."""

    hits: list[dict[str, Union[int, str]]] = []
    patterns = [
        pair
        for group in vague_term_groups_for(rel)
        for pair in VAGUE_TERM_PATTERNS[group]
    ]
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped or "@@" in stripped:
            continue
        if is_negated_line(line):
            continue
        for term, pattern in patterns:
            if pattern.search(line):
                hits.append({"file": rel, "line": line_no, "term": term})
    return hits


def parse_frontmatter_status(text: str) -> Optional[str]:
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        return None
    for line in match.group(1).splitlines():
        if line.startswith("status:"):
            return line.split(":", 1)[1].strip().strip("`'\"")
    return None


def index_link_targets(index: Path) -> set[Path]:
    """Resolve local inline/reference links, excluding examples in code spans."""
    targets: set[Path] = set()
    text = re.sub(r"(`+)(?!`)(.*?)\1(?!`)", "", active_markdown(read_text(index)), flags=re.S)
    definition = re.compile(r"^ {0,3}\[([^\]\n]+)\]:\s*(?:<([^>\n]+)>|(\S+))[^\n]*$", re.M)
    references = {}
    for match in definition.finditer(text):
        references.setdefault(" ".join(match.group(1).split()).casefold(), match.group(2) or match.group(3))
    text = definition.sub("", text)
    inline = re.compile(r"(?<!!)\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+[^)\n]*)?\)")
    links = [match.group(1) or match.group(2) for match in inline.finditer(text)]
    text = inline.sub("", text)
    for match in re.finditer(r"(?<!!)\[([^\]\n]+)\](?:\[([^\]\n]*)\])?", text):
        label = " ".join((match.group(2) or match.group(1)).split()).casefold()
        if label in references:
            links.append(references[label])
    for value in links:
        link = urlparse(value)
        if link.scheme or link.netloc or not link.path:
            continue
        targets.add((index.parent / unquote(link.path)).resolve())
    return targets


def indexed_truth_documents(
    root: Path,
    truth_dir: str,
) -> tuple[list[tuple[str, str, Path]], list[dict[str, str]]]:
    """Enumerate active documents in growing truth directories and their index gaps.

    Returns ``(documents, index_problems)`` where each document is
    ``(kind, repo-relative path, path)`` and every problem names the directory,
    the document, and the reason. Files under ``archive/`` are skipped.
    """

    documents: list[tuple[str, str, Path]] = []
    problems: list[dict[str, str]] = []
    for kind, allowed_statuses in INDEXED_TRUTH_DIRS.items():
        base_rel = f"{truth_dir}/{kind}"
        base = safe_repo_path(root, base_rel, label=f"{kind} truth directory")
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.md")):
            relative_parts = path.relative_to(base).parts
            if ARCHIVE_DIR_NAME in relative_parts[:-1]:
                continue
            if len(relative_parts) > 2:
                problems.append(
                    {
                        "directory": base_rel,
                        "document": f"{base_rel}/{path.relative_to(base).as_posix()}",
                        "reason": "directory_depth_exceeds_two",
                    }
                )
                continue
            if path.name == INDEX_FILE_NAME:
                continue
            rel = f"{base_rel}/{path.relative_to(base).as_posix()}"
            documents.append((kind, rel, path))
            text = read_text(path)
            status = parse_frontmatter_status(text)
            if status is None or status not in allowed_statuses:
                problems.append(
                    {
                        "directory": base_rel,
                        "document": rel,
                        "reason": "missing_or_invalid_status",
                    }
                )
            if status == "archived":
                continue
            root_index = base / INDEX_FILE_NAME
            indexes = [root_index]
            if len(relative_parts) == 2:
                indexes.append(path.parent / INDEX_FILE_NAME)
            if not all(index.is_file() for index in indexes):
                problems.append({"directory": base_rel, "document": rel, "reason": "missing_index"})
                continue
            chain = [*indexes, path]
            if any(target.resolve() not in index_link_targets(index)
                   for index, target in zip(chain, chain[1:])):
                problems.append({"directory": base_rel, "document": rel, "reason": "not_in_index"})
    return documents, problems


def check_project(
    root: Path,
    mode: str,
    truth_dir: str,
    allow_template: bool,
    stage_file: Optional[str],
    skip_private_scan: bool,
    stage_gate: Optional[str] = None,
    foundation_gate: str = "recommendation",
    vague_terms: str = "warn",
) -> dict:
    missing_files: list[str] = []
    missing_headings: list[dict[str, str]] = []
    missing_snippets: list[dict[str, str]] = []
    missing_section_snippets: list[dict[str, str]] = []
    forbidden_section_patterns: list[dict[str, str]] = []
    invalid_section_shapes: list[dict[str, Union[int, str]]] = []
    missing_links: list[str] = []
    placeholders: list[dict[str, str]] = []
    empty_fields: list[dict[str, Union[int, str]]] = []
    mechanical_fields: list[dict[str, Union[int, str]]] = []
    drift_markers: list[dict[str, Union[int, str]]] = []

    vague_hits: list[dict[str, Union[int, str]]] = []
    index_problems: list[dict[str, str]] = []

    if mode == "stage":
        stage_result = check_stage_file(root, stage_file, stage_gate)
        if vague_terms == "warn" and stage_file:
            stage_path = safe_repo_path(root, stage_file, label="stage file")
            if stage_path.is_file():
                vague_hits.extend(
                    scan_vague_terms(stage_file, active_markdown(read_text(stage_path)))
                )
        failures = []
        if stage_result["missing_stage_file"]:
            failures.append("missing_stage_file")
        if stage_result["missing_stage_headings"]:
            failures.append("missing_stage_headings")
        if stage_result["empty_stage_sections"]:
            failures.append("empty_stage_sections")
        if stage_result["missing_stage_fields"]:
            failures.append("missing_stage_fields")
        if stage_result["invalid_stage_fields"]:
            failures.append("invalid_stage_fields")
        if stage_result["stage_gate_blockers"]:
            failures.append("stage_gate_blockers")
        if stage_result["invalid_substage_plan"]:
            failures.append("invalid_substage_plan")
        if stage_result["missing_closeout_fields"]:
            failures.append("missing_closeout_fields")
        if stage_result["stage_placeholders"]:
            failures.append("stage_placeholders")
        return {
            "root": str(root),
            "mode": mode,
            "truth_dir": truth_dir,
            "ok": (
                not failures
                and stage_result["contract_exit_code"] == STAGE_EXIT_OK
            ),
            "failures": failures,
            "vague_terms": vague_hits,
            "vague_term_note": ("warning only; review wording, never edit automatically" if vague_hits else ""),
            **stage_result,
        }

    foundation_result = check_foundation_file(
        root,
        truth_dir,
        allow_template,
        required_gate=foundation_gate,
    )

    for rel in required_files(mode, truth_dir):
        path = safe_repo_path(root, rel, label=f"required {mode} file")
        if not path.is_file():
            missing_files.append(rel)
            continue

        text = active_markdown(read_text(path))
        key = doc_key(rel, truth_dir)
        for heading in REQUIRED_HEADINGS.get(key, []):
            if not has_required_heading(text, heading):
                missing_headings.append({"file": rel, "heading": heading})
        for snippet in REQUIRED_SNIPPETS_BY_MODE.get(mode, {}).get(key, []):
            if snippet not in text:
                missing_snippets.append({"file": rel, "snippet": snippet})
        for section_name, snippets in REQUIRED_SECTION_SNIPPETS_BY_MODE.get(mode, {}).get(key, {}).items():
            section = markdown_section(text, section_name)
            if section is None:
                missing_section_snippets.append(
                    {"file": rel, "section": section_name, "snippet": "<missing section>"}
                )
                continue
            for snippet in snippets:
                if snippet not in section:
                    missing_section_snippets.append(
                        {"file": rel, "section": section_name, "snippet": snippet}
                    )
        for section_name, minimum in REQUIRED_SECTION_MIN_BULLETS_BY_MODE.get(mode, {}).get(key, {}).items():
            section = markdown_section(text, section_name)
            if section is None:
                continue
            bullet_count = sum(1 for line in section.splitlines() if line.lstrip().startswith("- "))
            if bullet_count < minimum:
                invalid_section_shapes.append(
                    {
                        "file": rel,
                        "section": section_name,
                        "minimum_bullets": minimum,
                        "actual_bullets": bullet_count,
                    }
                )
        for section_name, patterns in FORBIDDEN_SECTION_PATTERNS_BY_MODE.get(mode, {}).get(key, {}).items():
            section = markdown_section(text, section_name)
            if section is None:
                continue
            for pattern in patterns:
                if re.search(pattern, section, flags=re.I | re.S):
                    forbidden_section_patterns.append(
                        {"file": rel, "section": section_name, "pattern": pattern}
                    )
        for marker in PLACEHOLDER_MARKERS:
            if marker in text:
                placeholders.append({"file": rel, "marker": marker})
        for line_no, line in enumerate(text.splitlines(), start=1):
            if is_empty_field(line):
                empty_fields.append({"file": rel, "line": line_no, "field": line.strip()[2:]})
            bullet_match = re.match(r"^\s*-\s*[^:：]+[:：]\s*(.*?)\s*$", line)
            if bullet_match and bullet_match.group(1).strip().strip("`").casefold() in MECHANICAL_FIELD_VALUES:
                mechanical_fields.append(
                    {"file": rel, "line": line_no, "value": bullet_match.group(1).strip()}
                )
            for marker in DRIFT_MARKERS:
                if marker in line and not is_negated_line(line):
                    drift_markers.append({"file": rel, "line": line_no, "marker": marker})
        if vague_terms == "warn":
            vague_hits.extend(scan_vague_terms(rel, text))

    if mode in {"bootstrap", "adoption"}:
        indexed_documents, index_problems = indexed_truth_documents(root, truth_dir)
        for _kind, rel, path in indexed_documents:
            text = active_markdown(read_text(path))
            for marker in PLACEHOLDER_MARKERS:
                if marker in text:
                    placeholders.append({"file": rel, "marker": marker})
            for line_no, line in enumerate(text.splitlines(), start=1):
                for marker in DRIFT_MARKERS:
                    if marker in line and not is_negated_line(line):
                        drift_markers.append({"file": rel, "line": line_no, "marker": marker})
            if vague_terms == "warn":
                vague_hits.extend(scan_vague_terms(rel, text))

    readme_path = safe_repo_path(root, f"{truth_dir}/README.md", label="truth README")
    if readme_path.exists() and mode in REQUIRED_LINKS_BY_MODE:
        readme = active_markdown(read_text(readme_path))
        for link in REQUIRED_LINKS_BY_MODE[mode]:
            if link not in readme:
                missing_links.append(link)

    private_risks = [] if skip_private_scan else find_private_risks(root)

    failures: list[str] = []
    if missing_files:
        failures.append("missing_required_files")
    if missing_headings:
        failures.append("missing_required_headings")
    if missing_snippets:
        failures.append("missing_required_snippets")
    if missing_section_snippets:
        failures.append("missing_required_section_snippets")
    if invalid_section_shapes:
        failures.append("invalid_required_section_shape")
    if forbidden_section_patterns:
        failures.append("forbidden_section_patterns")
    if missing_links:
        failures.append("truth_readme_missing_links")
    if placeholders and not allow_template:
        failures.append("placeholder_markers")
    if empty_fields and not allow_template:
        failures.append("empty_required_fields")
    if mechanical_fields and not allow_template:
        failures.append("mechanical_field_values")
    if drift_markers and not allow_template:
        failures.append("drift_markers")
    if index_problems:
        failures.append("truth_index_inconsistent")
    foundation_failure_keys = (
        "foundation_missing_fields",
        "foundation_invalid_fields",
        "foundation_duplicate_fields",
        "foundation_table_errors",
        "foundation_gate_blockers",
    )
    if any(foundation_result[key] for key in foundation_failure_keys):
        failures.append("foundation_decision_contract")
    if not allow_template:
        if not foundation_result["foundation_required_gate_met"]:
            failures.append("foundation_required_gate_not_met")

    return {
        "root": str(root),
        "mode": mode,
        "truth_dir": truth_dir,
        "ok": not failures,
        "failures": failures,
        "missing_required_files": missing_files,
        "missing_required_headings": missing_headings,
        "missing_required_snippets": missing_snippets,
        "missing_required_section_snippets": missing_section_snippets,
        "invalid_required_section_shapes": invalid_section_shapes,
        "forbidden_section_patterns": forbidden_section_patterns,
        "truth_readme_missing_links": missing_links,
        "placeholder_markers": placeholders,
        "empty_required_fields": empty_fields,
        "mechanical_field_values": mechanical_fields,
        "drift_markers": drift_markers,
        "truth_index_problems": index_problems,
        "vague_terms": vague_hits,
        "vague_term_note": ("warning only; review wording, never edit automatically" if vague_hits else ""),
        "private_risks": private_risks,
        "private_risk_note": (
            "informational bounded heuristic only; inspect paths before staging or pushing"
        ),
        **foundation_result,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_root", help="Project root to check")
    parser.add_argument(
        "--mode",
        choices=["bootstrap", "adoption", "constitution", "stage"],
        default="bootstrap",
        help="Guardrail mode to run",
    )
    parser.add_argument(
        "--truth-dir",
        default="dev-docs",
        help="Internal truth-document directory, default: dev-docs",
    )
    parser.add_argument(
        "--stage-file",
        help="Stage implementation truth file, used with --mode stage",
    )
    parser.add_argument(
        "--stage-gate",
        choices=["plan", "execute", "closeout"],
        help="Readiness gate to check with --mode stage",
    )
    parser.add_argument(
        "--foundation-gate",
        choices=["contract", "recommendation", "implementation"],
        default="recommendation",
        help=(
            "Required structural foundation state for bootstrap/adoption; "
            "never grants real-world implementation authorization"
        ),
    )
    parser.add_argument(
        "--allow-template",
        action="store_true",
        help="Allow placeholders and empty fields when checking bundled templates",
    )
    parser.add_argument(
        "--skip-private-scan",
        action="store_true",
        help="Skip the bounded filename/content private-risk heuristic scan",
    )
    parser.add_argument(
        "--vague-terms",
        choices=["warn", "off"],
        default="warn",
        help=(
            "Report vague wording (for example 待定, 所有人, 同时支持) as file:line:term "
            "warnings; never fails the gate"
        ),
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON only")
    args = parser.parse_args()

    root = Path(args.project_root).expanduser().resolve()
    if not root.is_dir():
        print(f"FAIL: project root is not a directory: {root}", file=sys.stderr)
        return 2
    if args.mode == "stage" and args.stage_gate is None:
        print("FAIL: --stage-gate is required with --mode stage", file=sys.stderr)
        return 2
    if args.mode != "stage" and args.stage_gate is not None:
        print("FAIL: --stage-gate is only valid with --mode stage", file=sys.stderr)
        return 2
    if args.mode != "stage" and args.stage_file is not None:
        print("FAIL: --stage-file is only valid with --mode stage", file=sys.stderr)
        return 2
    if args.mode == "stage" and args.allow_template:
        print("FAIL: --allow-template cannot bypass a materialized stage gate", file=sys.stderr)
        return 2
    if args.mode == "stage" and args.foundation_gate != "recommendation":
        print("FAIL: --foundation-gate is not valid with --mode stage", file=sys.stderr)
        return 2

    try:
        safe_repo_path(root, args.truth_dir, label="truth directory")
        result = check_project(
            root=root,
            mode=args.mode,
            truth_dir=args.truth_dir,
            allow_template=args.allow_template,
            stage_file=args.stage_file,
            skip_private_scan=args.skip_private_scan,
            stage_gate=args.stage_gate,
            foundation_gate=args.foundation_gate,
            vague_terms=args.vague_terms,
        )
    except ContractError as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if args.mode == "stage":
            return int(result["contract_exit_code"])
        return 0 if result["ok"] else 1

    print(f"{'OK' if result['ok'] else 'FAIL'}: {root}")
    print(f"mode: {result['mode']}")
    print(f"truth_dir: {result['truth_dir']}")
    for key, value in result.items():
        if key in {"root", "mode", "truth_dir", "ok"}:
            continue
        if key in {
            "foundation_structural_contract_valid",
            "foundation_structural_recommendation_ready",
            "foundation_structural_implementation_ready",
            "foundation_required_gate_met",
            "foundation_external_implementation_authorized",
        }:
            print(f"{key}: {json.dumps(value, ensure_ascii=False)}")
        elif value:
            print(f"{key}: {json.dumps(value, ensure_ascii=False)}")

    if args.mode == "stage":
        return int(result["contract_exit_code"])
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
