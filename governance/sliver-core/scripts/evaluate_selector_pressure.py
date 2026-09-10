#!/usr/bin/env python3
"""Validate the offline selector-pressure corpus and discovery contract."""

from __future__ import annotations

import re
import sys
from pathlib import Path

from validation_support import (
    ContractError,
    load_json_object,
    markdown_section,
    read_utf8,
    require_int,
    require_prompt,
    require_string,
    require_string_list,
)


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SKILL = ROOT / "SKILL.md"
CASES = ROOT / "tests/selector-pressure-cases.json"


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


def selector_design_section(skill_text: str) -> str:
    try:
        section = markdown_section(skill_text, "Selector Design")
    except ContractError as exc:
        fail(str(exc))
    if section is None:
        fail("SKILL.md missing active Selector Design section")
    return section


def main() -> None:
    skill_text = read(SKILL)
    try:
        data = load_json_object(CASES)
    except ContractError as exc:
        fail(str(exc))
    if data.get("evaluation_scope") != "corpus_structure_only":
        fail("selector pressure data must declare corpus_structure_only scope")
    if data.get("requires_live_model_validation") is not True:
        fail("selector pressure data must preserve the live-model validation boundary")
    description = parse_frontmatter(skill_text).get("description", "")
    selector_section = selector_design_section(skill_text)

    try:
        max_description = require_int(data.get("description_max_chars", 500), label="description_max_chars", minimum=1)
        minimum_positive = require_int(
            data.get("minimum_positive_cases", 100), label="minimum_positive_cases", minimum=1
        )
        minimum_negative = require_int(
            data.get("minimum_negative_cases", 15), label="minimum_negative_cases", minimum=1
        )
        max_literal_hits = require_int(
            data.get("max_literal_positive_cases_in_skill", 20),
            label="max_literal_positive_cases_in_skill",
        )
    except ContractError as exc:
        fail(str(exc))
    if len(description) > max_description:
        fail(f"description too long for selector surface: {len(description)} > {max_description}")
    if not description.startswith("Use when "):
        fail("description must start with 'Use when '")
    if "workflow" in description.lower():
        fail("description must not summarize workflow; it should only describe triggering conditions")

    selector_section_lower = selector_section.lower()
    try:
        required_section_terms = require_string_list(
            data.get("required_selector_section_terms", []), label="required_selector_section_terms"
        )
    except ContractError as exc:
        fail(str(exc))
    for term in required_section_terms:
        if term.lower() not in selector_section_lower:
            fail(f"Selector Design section missing required term: {term}")

    families = data.get("families", [])
    if not isinstance(families, list) or not families:
        fail("selector pressure cases must define families")

    all_positive: list[str] = []
    covered_intents: set[str] = set()
    covered_scenario_tags: set[str] = set()
    seen_family_names: set[str] = set()
    for index, family in enumerate(families):
        if not isinstance(family, dict):
            fail(f"selector family {index} must be an object")
        try:
            name = require_string(family.get("name"), label=f"selector family {index} name", minimum=3)
        except ContractError as exc:
            fail(str(exc))
        if name in seen_family_names:
            fail(f"duplicate selector family name: {name}")
        seen_family_names.add(name)
        owner = family.get("expected_owner")
        try:
            intent_family = require_string(
                family.get("intent_family"), label=f"{name} intent_family", minimum=3
            )
        except ContractError as exc:
            fail(str(exc))
        try:
            positives = require_string_list(
                family.get("positive", []), label=f"{name} positive prompts", minimum=5
            )
            positives = [require_prompt(item, label=f"{name} positive prompt") for item in positives]
            scenario_tags = require_string_list(
                family.get("scenario_tags", []), label=f"{name} scenario_tags"
            )
        except ContractError as exc:
            fail(str(exc))
        if "expected_route" in family or "trigger_terms" in family:
            fail(f"{name}: selector corpus must not encode route keywords or specialist routes")
        if owner != "sliver-vibe-coding":
            fail(f"{name}: expected_owner must be sliver-vibe-coding")
        if not intent_family:
            fail(f"{name}: missing lifecycle intent_family")
        covered_intents.add(intent_family)
        covered_scenario_tags.update(scenario_tags)
        all_positive.extend(positives)

        if "description_required" in family or "description_terms" in family:
            fail(
                f"{name}: selector corpus must not encode literal frontmatter terms; "
                "validate semantic selection with a live model"
            )

    required_intents = {"development", "intake", "takeover", "startup", "rescue", "audit", "validation", "release", "handoff"}
    missing_intents = sorted(required_intents - covered_intents)
    if missing_intents:
        fail(f"selector corpus missing lifecycle intent families: {', '.join(missing_intents)}")

    try:
        required_scenario_tags = set(
            require_string_list(
                data.get("required_scenario_tags", []), label="required_scenario_tags", minimum=1
            )
        )
    except ContractError as exc:
        fail(str(exc))
    missing_scenario_tags = sorted(required_scenario_tags - covered_scenario_tags)
    if missing_scenario_tags:
        fail(f"selector corpus missing required scenario tags: {', '.join(missing_scenario_tags)}")

    if len(set(all_positive)) != len(all_positive):
        fail("selector pressure cases contain duplicate positive prompts")
    positive_count = len(all_positive)
    if positive_count < minimum_positive:
        fail(f"not enough positive selector pressure cases: {positive_count} < {minimum_positive}")

    try:
        negative_cases = require_string_list(
            data.get("negative_cases", []), label="negative_cases"
        )
        negative_cases = [require_prompt(item, label="negative prompt") for item in negative_cases]
    except ContractError as exc:
        fail(str(exc))
    if len(negative_cases) < minimum_negative:
        fail(f"not enough negative selector pressure cases: {len(negative_cases)} < {minimum_negative}")
    overlap = sorted(set(all_positive) & set(negative_cases))
    if overlap:
        fail(f"selector prompts cannot be both positive and negative: {overlap[0]}")

    literal_hits = [case for case in all_positive if case in skill_text]
    if len(literal_hits) > max_literal_hits:
        fail(
            "too many pressure cases were copied literally into SKILL.md; "
            f"{len(literal_hits)} > {max_literal_hits}"
        )

    print(
        "OK: selector owner corpus structure validated "
        f"({len(families)} scenario families, {len(covered_intents)} lifecycle intents, "
        f"{positive_count} positive cases, {len(negative_cases)} negative cases); "
        "live model routing not evaluated"
    )


if __name__ == "__main__":
    try:
        main()
    except ContractError as exc:
        fail(str(exc))
