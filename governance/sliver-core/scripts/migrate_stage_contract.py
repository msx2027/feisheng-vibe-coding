#!/usr/bin/env python3
"""Create a non-authoritative Stage v2 sibling draft from a legacy stage file."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Optional

# Keep direct migration calls from mutating an installed runtime bundle.
sys.dont_write_bytecode = True

from validation_support import ContractError, active_markdown, markdown_section, read_utf8


LEGACY_DEPTH_LABELS = ("轻量任务", "常规任务", "标准任务", "高风险任务")
COPY_SECTION_GROUPS = (
    ("Stage Goal And User Flow", ("阶段目标与用户流程", "Stage Goal And User Flow")),
    ("Current Truth And Owner", ("当前真相与 Owner", "Current Truth And Owner")),
    ("Research Decision", ("调研决策", "Research Decision")),
    ("Scope And Non-Goals", ("范围与非目标", "Scope And Non-Goals")),
    ("Substage Plan", ("子阶段计划", "Substage Plan")),
)


def _section_by_aliases(text: str, aliases: tuple[str, ...], *, label: str) -> Optional[str]:
    matches: list[str] = []
    for alias in aliases:
        section = markdown_section(text, alias)
        if section is not None:
            matches.append(section)
    if len(matches) > 1:
        raise ContractError(f"duplicate legacy section owner: {label}")
    return matches[0] if matches else None


def _section_body(section: str) -> str:
    lines = section.splitlines()
    return "\n".join(lines[1:]).strip() if lines else ""


def _safe_stage_id(stem: str) -> str:
    value = re.sub(r"[^a-z0-9._-]+", "-", stem.casefold()).strip("-._")
    return value or "stage-migration-draft"


def _remove_legacy_control_state(text: str) -> str:
    text = text.replace(
        "sliver-stage/v1",
        "[legacy Stage schema omitted; use the v2 control above]",
    )
    for label in LEGACY_DEPTH_LABELS:
        text = text.replace(label, "[legacy depth omitted; reclassify from current evidence]")
    unsafe_fields = {
        "schema",
        "task_depth",
        "任务深度",
        "任务等级",
        "stage_status",
        "product_confirmation",
        "authorized_substage",
        "substage_authorization",
        "scope_authorization",
        "result_status",
        "truth_writeback",
        "evidence_status",
        "implementation_authorization",
        "authorization_substage",
    }
    safe_lines: list[str] = []
    for line in text.splitlines():
        match = re.match(r"^\s*-\s*([^:：]+)\s*[:：]", line)
        if match and match.group(1).strip() in unsafe_fields:
            safe_lines.append(
                "- migration_note: legacy control state omitted; reclassify from current evidence"
            )
        else:
            safe_lines.append(line)
    return "\n".join(safe_lines)


def _copy_allowed_sections(active_text: str) -> str:
    blocks: list[str] = []
    for output_heading, aliases in COPY_SECTION_GROUPS:
        section = _section_by_aliases(active_text, aliases, label=output_heading)
        body = _section_body(section) if section is not None else ""
        body = _remove_legacy_control_state(body)
        if not body:
            body = "@@REVIEW_AND_FILL_FROM_CURRENT_EVIDENCE@@"
        blocks.append(f"## {output_heading}\n\n{body}")
    return "\n\n".join(blocks)


def build_migration_draft(source: Path) -> str:
    raw = read_utf8(source)
    active = active_markdown(raw)
    control = _section_by_aliases(
        active,
        ("阶段控制", "Stage Control"),
        label="Stage Control",
    )
    if control is None:
        raise ContractError("source has no active Stage Control section")
    control_body = _section_body(control)
    schema_match = re.search(
        r"^\s*-\s*schema\s*:\s*(.*?)\s*$",
        control_body,
        flags=re.M,
    )
    depth_match = re.search(
        r"^\s*-\s*(?:task_depth|任务深度|任务等级)\s*:\s*(.*?)\s*$",
        control_body,
        flags=re.M,
    )
    schema = schema_match.group(1).strip() if schema_match else None
    task_depth = depth_match.group(1).strip() if depth_match else None
    if schema == "sliver-stage/v2" and task_depth not in LEGACY_DEPTH_LABELS:
        raise ContractError("source already declares sliver-stage/v2")
    if schema not in {None, "sliver-stage/v1"} and task_depth not in LEGACY_DEPTH_LABELS:
        raise ContractError(f"source declares unsupported Stage schema: {schema}")

    copied = _copy_allowed_sections(active)
    stage_id = _safe_stage_id(source.stem)
    return f"""# Stage v2 migration draft for {source.stem}

> This sibling draft is non-authoritative. Reclassify every marked axis from
> current evidence. The migration does not inherit authorization, completion,
> verification, risk, effect, or Studio decisions from the legacy file.

## Stage Control

- schema: sliver-stage/v2
- stage_id: {stage_id}
- primary_route: @@RECLASSIFY_PRIMARY_ROUTE@@
- operation: @@RECLASSIFY_ROUTE_OPERATION@@
- delivery_kind: @@RECLASSIFY_DELIVERY_KIND@@
- task_depth: @@RECLASSIFY_D0_D3@@
- materialization_trigger: [@@RECLASSIFY_MATERIALIZATION_TRIGGER@@]
- risk_lanes: [@@RECLASSIFY_RISK_LANES@@]
- evidence_mode: @@RECLASSIFY_EVIDENCE_MODE@@
- test_level: @@RECLASSIFY_TEST_LEVEL_OR_NULL@@
- route_evidence_kind: @@RECLASSIFY_ROUTE_EVIDENCE_KIND_OR_NULL@@
- effect_class: @@RECLASSIFY_EFFECT_CLASS@@
- operational_mode: @@RECLASSIFY_OPERATIONAL_MODE@@
- scope_authorization: blocked:migration draft does not inherit authorization
- authorization_substage: pending
- product_decision: pending:reconfirm only if current product consequences require it
- active_substage: @@RECLASSIFY_ACTIVE_SUBSTAGE@@
- result_status: not_started
- truth_writeback: pending
- migration_state: @@SET_RECLASSIFIED_AFTER_ALL_AXES_ARE_REVIEWED@@
- evidence_refs: []

{copied}

## Test Security And Impact

@@RECLASSIFY_TEST_SECURITY_AND_IMPACT_FROM_CURRENT_EVIDENCE@@

## Validation Method

@@DEFINE_CURRENT_ROUTE_OR_TEST_EVIDENCE@@

## Stop Conditions And Unverified

Do not execute, close out, claim completion, reuse authorization, infer risk,
or recommend Studio from this draft. Replace every marker and pass the Stage v2
plan structural gate before considering an atomic source replacement.

## Implementation Write-Back

- actual_result:
- changed_owners:
- plan_deviation:
- fresh_evidence:
- remaining_risk:
- next_substage:
- git_checkpoint:
"""


def sibling_draft_path(source: Path, output: Optional[str]) -> Path:
    default = source.with_name(f"{source.stem}.v2-draft{source.suffix}")
    if output is None:
        return default
    candidate = Path(output).expanduser()
    if not candidate.is_absolute():
        candidate = source.parent / candidate
    candidate = candidate.resolve()
    if candidate.parent != source.parent.resolve():
        raise ContractError("migration output must be a sibling of the legacy stage file")
    if candidate == source.resolve():
        raise ContractError("migration output must not overwrite the legacy stage file")
    return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage_file", help="Legacy Stage file to read")
    parser.add_argument(
        "--output",
        help="Optional sibling draft filename; default: <stem>.v2-draft<suffix>",
    )
    args = parser.parse_args()

    source = Path(args.stage_file).expanduser().resolve()
    if not source.is_file():
        print(f"FAIL: legacy stage file is not a regular file: {source}", file=sys.stderr)
        return 2
    try:
        output = sibling_draft_path(source, args.output)
        if output.exists():
            raise ContractError(f"migration draft already exists: {output}")
        draft = build_migration_draft(source)
        with output.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(draft)
    except (ContractError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 2

    print(f"CREATED_MIGRATION_DRAFT: {output}")
    print("Legacy source was not modified; authorization and completion were not inherited.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
