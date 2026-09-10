#!/usr/bin/env python3
"""Validate the offline lifecycle-entry and conditional-lens contract corpus."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from validation_support import (
    ContractError,
    active_markdown,
    load_json_object,
    markdown_section,
    read_utf8,
    require_prompt,
    require_string,
    require_string_list,
    safe_repo_path,
    split_table_row,
)
from runtime_decision_contract import (
    build_lens_catalog,
    build_lens_projection,
    build_route_catalog,
    build_route_projection,
    load_route_operation_delivery_matrix,
)
from governance_route_projection import (
    build_governance_lens_catalog,
    build_governance_lens_projection,
    build_governance_route_catalog,
    build_governance_route_projection,
)


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SKILL = ROOT / "SKILL.md"
REGISTRY = ROOT / "references/routes-index.md"
CASES = ROOT / "tests/route-eval-cases.json"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def read(path: Path) -> str:
    try:
        return read_utf8(path)
    except ContractError as exc:
        fail(str(exc))


def table_rows(
    section: str,
    *,
    include_projection: bool = False,
) -> dict[str, tuple[str, ...]]:
    rows: dict[str, tuple[str, ...]] = {}
    key_pattern = r"`([^`/]+)`"
    for line in section.splitlines():
        cells = split_table_row(line)
        minimum_cells = 4 if include_projection else 3
        if len(cells) < minimum_cells:
            continue
        match = re.fullmatch(key_pattern, cells[0])
        if not match:
            continue
        key = match.group(1)
        if key in rows:
            fail(f"duplicate route or lens table key: {key}")
        rows[key] = tuple(cells[1:minimum_cells])
    return rows


def referenced_files(row: str) -> set[str]:
    return set(re.findall(r"`(references/[^`]+?\.md)`", row))


def main() -> None:
    skill_text = read(SKILL)
    registry_text = read(REGISTRY)
    try:
        primary_section = markdown_section(registry_text, "Primary Workflow Routes")
        lens_section = markdown_section(registry_text, "Conditional Development Lenses")
    except ContractError as exc:
        fail(str(exc))
    if primary_section is None or lens_section is None:
        fail("routes registry missing active primary-route or conditional-lens section")
    primary_entries = table_rows(primary_section, include_projection=True)
    lenses = table_rows(lens_section)
    try:
        route_projection = load_route_operation_delivery_matrix(REGISTRY)
    except ContractError as exc:
        fail(str(exc))
    if set(primary_entries) != set(route_projection):
        fail("runtime route matrix must exactly match the routes registry")
    try:
        data = load_json_object(CASES)
    except ContractError as exc:
        fail(str(exc))

    projection_contract = data.get("route_projection_contract")
    if not isinstance(projection_contract, dict) or set(projection_contract) != {
        "owner_file",
        "catalog_schema",
        "projection_schema",
        "lens_catalog_schema",
        "lens_projection_schema",
        "exact_purpose_cell",
        "exact_load_cell",
        "measure_actual_json_bytes",
        "independent_oracle_required",
    }:
        fail("route_projection_contract fields drifted")
    if projection_contract.get("owner_file") != "references/routes-index.md":
        fail("route projection owner must remain references/routes-index.md")
    for flag in (
        "exact_purpose_cell",
        "exact_load_cell",
        "measure_actual_json_bytes",
        "independent_oracle_required",
    ):
        if projection_contract.get(flag) is not True:
            fail(f"route projection contract must require {flag}")
    runtime_catalog = build_route_catalog(REGISTRY)
    oracle_catalog = build_governance_route_catalog(registry_text)
    if runtime_catalog.get("schema") != projection_contract.get("catalog_schema"):
        fail("runtime route catalog schema drifted")
    if runtime_catalog.get("routes") != oracle_catalog.get("routes"):
        fail("runtime route catalog differs from independent governance oracle")
    registry_digest = hashlib.sha256(REGISTRY.read_bytes()).hexdigest()
    if runtime_catalog.get("source", {}).get("sha256") != registry_digest:
        fail("runtime route catalog source digest is stale")
    if [entry["route"] for entry in runtime_catalog["routes"]] != list(primary_entries):
        fail("runtime route catalog route order differs from canonical registry")
    route_projection_bytes = len(
        (
            json.dumps(
                runtime_catalog,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            + "\n"
        ).encode("utf-8")
    )
    runtime_lens_catalog = build_lens_catalog(REGISTRY)
    oracle_lens_catalog = build_governance_lens_catalog(registry_text)
    if runtime_lens_catalog.get("schema") != projection_contract.get("lens_catalog_schema"):
        fail("runtime lens catalog schema drifted")
    if runtime_lens_catalog.get("lenses") != oracle_lens_catalog.get("lenses"):
        fail("runtime lens catalog differs from independent governance oracle")
    if runtime_lens_catalog.get("source", {}).get("sha256") != registry_digest:
        fail("runtime lens catalog source digest is stale")
    if [entry["lens"] for entry in runtime_lens_catalog["lenses"]] != list(lenses):
        fail("runtime lens catalog order differs from canonical registry")
    route_projection_bytes += len(
        (
            json.dumps(
                runtime_lens_catalog,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            + "\n"
        ).encode("utf-8")
    )
    for route, (purpose, _operation_cell, load) in primary_entries.items():
        runtime_row = build_route_projection(route, REGISTRY)
        oracle_row = build_governance_route_projection(registry_text, route)
        if runtime_row.get("schema") != projection_contract.get("projection_schema"):
            fail(f"runtime route projection schema drifted: {route}")
        if runtime_row.get("purpose") != purpose or runtime_row.get("load") != load:
            fail(f"runtime route projection changed exact canonical cells: {route}")
        if {
            key: value for key, value in runtime_row.items() if key != "source"
        } != {
            key: value for key, value in oracle_row.items() if key != "source"
        }:
            fail(f"runtime route projection differs from independent oracle: {route}")
        if runtime_row.get("source", {}).get("sha256") != registry_digest:
            fail(f"runtime route projection source digest is stale: {route}")
        route_projection_bytes += len(
            (
                json.dumps(
                    runtime_row,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
                + "\n"
            ).encode("utf-8")
        )
    for lens, (impact, load) in lenses.items():
        runtime_row = build_lens_projection(lens, REGISTRY)
        oracle_row = build_governance_lens_projection(registry_text, lens)
        if runtime_row.get("schema") != projection_contract.get("lens_projection_schema"):
            fail(f"runtime lens projection schema drifted: {lens}")
        if runtime_row.get("impact") != impact or runtime_row.get("load") != load:
            fail(f"runtime lens projection changed exact canonical cells: {lens}")
        if {
            key: value for key, value in runtime_row.items() if key != "source"
        } != {
            key: value for key, value in oracle_row.items() if key != "source"
        }:
            fail(f"runtime lens projection differs from independent oracle: {lens}")
        if runtime_row.get("source", {}).get("sha256") != registry_digest:
            fail(f"runtime lens projection source digest is stale: {lens}")
        route_projection_bytes += len(
            (
                json.dumps(
                    runtime_row,
                    ensure_ascii=False,
                    separators=(",", ":"),
                )
                + "\n"
            ).encode("utf-8")
        )

    question_contract = data.get("question_contract")
    if not isinstance(question_contract, dict):
        fail("route cases must define question_contract")
    try:
        question_owner_rel = require_string(
            question_contract.get("owner_file"), label="question owner file", minimum=3
        )
        question_required_terms = require_string_list(
            question_contract.get("required_terms", []), label="question required_terms", minimum=1
        )
        question_forbidden_patterns = require_string_list(
            question_contract.get("forbidden_patterns", []), label="question forbidden_patterns", minimum=1
        )
        question_owner_path = safe_repo_path(ROOT, question_owner_rel, label="question owner file")
    except ContractError as exc:
        fail(str(exc))
    if question_owner_rel != "references/question-bank.md":
        fail("question_contract must point to references/question-bank.md")
    active_question_owner = active_markdown(read(question_owner_path))
    for term in question_required_terms:
        if term not in active_question_owner:
            fail(f"question owner missing required beginner contract term: {term}")
    for pattern in question_forbidden_patterns:
        try:
            matched = re.search(pattern, active_question_owner, flags=re.I | re.S)
        except re.error as exc:
            fail(f"invalid forbidden question regex: {pattern}: {exc}")
        if matched:
            fail(f"question owner asks the user to make an AI-owned decision: {pattern}")

    expected_lens_impacts = data.get("expected_lens_impacts", {})
    forbidden_lens_patterns = data.get("forbidden_lens_impact_patterns", [])
    competing_entry_patterns = data.get("forbidden_competing_entry_patterns", [])
    if not isinstance(expected_lens_impacts, dict):
        fail("expected_lens_impacts must be an object")
    try:
        forbidden_lens_patterns = require_string_list(
            forbidden_lens_patterns, label="forbidden_lens_impact_patterns", minimum=1
        )
        competing_entry_patterns = require_string_list(
            competing_entry_patterns, label="forbidden_competing_entry_patterns", minimum=1
        )
    except ContractError as exc:
        fail(str(exc))
    if set(expected_lens_impacts) != set(lenses):
        fail("expected_lens_impacts must define exactly every conditional lens")

    for lens, (impact, load) in lenses.items():
        if not impact or not load:
            fail(f"conditional lens must define impact evidence and owner files: {lens}")
        try:
            expected_impact = require_string(
                expected_lens_impacts[lens], label=f"{lens} expected impact", minimum=20
            )
        except ContractError as exc:
            fail(str(exc))
        if " ".join(impact.split()) != " ".join(expected_impact.split()):
            fail(f"conditional lens impact contract drifted: {lens}")
        for pattern in forbidden_lens_patterns:
            try:
                matched = re.search(pattern, impact, flags=re.I | re.S)
            except re.error as exc:
                fail(f"invalid forbidden lens regex: {pattern}: {exc}")
            if matched:
                fail(f"conditional lens became unconditional: {lens}: {pattern}")
        owner_files = referenced_files(load)
        if not owner_files:
            fail(f"conditional lens must load at least one owner file: {lens}")
        for rel in owner_files:
            try:
                path = safe_repo_path(ROOT, rel, label=f"{lens} owner file")
            except ContractError as exc:
                fail(str(exc))
            if not path.is_file():
                fail(f"conditional lens owner file missing: {lens}: {rel}")

    if data.get("evaluation_scope") != "route_contract_corpus_only":
        fail("route cases must declare route_contract_corpus_only scope")
    if data.get("requires_live_model_validation") is not True:
        fail("route cases must preserve the live-model validation boundary")
    try:
        required_contract_terms = require_string_list(
            data.get("required_skill_contract_terms", []), label="required_skill_contract_terms"
        )
        forbidden_labels = require_string_list(
            data.get("forbidden_primary_route_labels", []), label="forbidden_primary_route_labels"
        )
    except ContractError as exc:
        fail(str(exc))
    active_skill = active_markdown(skill_text)
    for term in required_contract_terms:
        if term not in active_skill:
            fail(f"SKILL.md missing required semantic routing contract term: {term}")
    for label in forbidden_labels:
        if label in primary_entries:
            fail(f"internal stage or specialist check leaked into primary route table: {label}")
    for pattern in competing_entry_patterns:
        try:
            matching_lines = [
                line
                for line in active_skill.splitlines()
                if re.search(pattern, line, flags=re.I)
                and not any(
                    negation in line.lower()
                    for negation in ["not ", "never ", "do not ", "不是", "不得", "不能", "不要"]
                )
            ]
        except re.error as exc:
            fail(f"invalid competing-entry regex: {pattern}: {exc}")
        if matching_lines:
            fail(f"conditional check leaked back as a competing user entry: {pattern}")

    cases = data.get("cases", [])
    if not isinstance(cases, list) or not cases:
        fail("route cases must define a non-empty cases list")

    failures: list[str] = []
    covered_entries: set[str] = set()
    covered_lenses: set[str] = set()
    seen_names: set[str] = set()
    seen_prompts: set[str] = set()

    for index, case in enumerate(cases):
        if not isinstance(case, dict):
            fail(f"route case {index} must be an object")
        try:
            name = require_string(case.get("name"), label=f"route case {index} name", minimum=3)
            user_text = require_prompt(case.get("user"), label=f"{name} user prompt")
        except ContractError as exc:
            fail(str(exc))
        if name in seen_names:
            failures.append(f"duplicate route case name: {name}")
        if user_text in seen_prompts:
            failures.append(f"{name}: duplicate real user prompt")
        seen_names.add(name)
        seen_prompts.add(user_text)
        try:
            entry = require_string(case.get("expected_entry"), label=f"{name} expected_entry", minimum=2)
        except ContractError as exc:
            fail(str(exc))
        if "trigger_terms" in case:
            failures.append(f"{name}: trigger_terms are forbidden; this corpus must not model substring routing")
        if not entry or entry not in primary_entries:
            failures.append(f"{name}: expected primary entry missing from routes registry: {entry}")
            continue
        covered_entries.add(entry)

        expected_operation = case.get("expected_operation")
        if expected_operation is not None:
            try:
                expected_operation = require_string(
                    expected_operation, label=f"{name} expected_operation", minimum=3
                )
            except ContractError as exc:
                fail(str(exc))
            if expected_operation not in route_projection[entry]:
                failures.append(
                    f"{name}: operation/delivery projection drifted for route {entry}: "
                    f"missing operation {expected_operation}"
                )

        expected_delivery = case.get("expected_delivery_kind")
        if expected_delivery is not None:
            try:
                expected_delivery = require_string(
                    expected_delivery,
                    label=f"{name} expected_delivery_kind",
                    minimum=3,
                )
            except ContractError as exc:
                fail(str(exc))
            if expected_operation is None:
                failures.append(
                    f"{name}: expected_delivery_kind requires expected_operation"
                )
            elif expected_operation in route_projection[entry] and expected_delivery not in (
                route_projection[entry][expected_operation]
            ):
                failures.append(
                    f"{name}: operation/delivery projection drifted for route {entry}/"
                    f"{expected_operation}: missing delivery {expected_delivery}"
                )

        entry_files = referenced_files(primary_entries[entry][2])
        try:
            expected_files = set(require_string_list(case.get("expected_files", []), label=f"{name} expected_files"))
            expected_lenses = set(
                require_string_list(case.get("expected_lenses", []), label=f"{name} expected_lenses")
            )
            conditional_lenses = require_string_list(
                case.get("conditional_lenses", []), label=f"{name} conditional_lenses"
            )
            forbidden_lenses = require_string_list(
                case.get("forbidden_unconditional_lenses", []),
                label=f"{name} forbidden_unconditional_lenses",
            )
        except ContractError as exc:
            fail(str(exc))
        for rel in expected_files:
            if rel not in entry_files:
                failures.append(f"{name}: primary entry {entry} does not load expected file: {rel}")
            try:
                path = safe_repo_path(ROOT, rel, label=f"{name} expected file")
            except ContractError as exc:
                failures.append(str(exc))
                continue
            if not path.is_file():
                failures.append(f"{name}: expected file missing on disk: {rel}")

        lens_files: set[str] = set()
        for lens in expected_lenses:
            row = lenses.get(lens)
            if row is None:
                failures.append(f"{name}: unknown conditional development lens: {lens}")
                continue
            covered_lenses.add(lens)
            lens_files.update(referenced_files(row[1]))

        for lens in conditional_lenses:
            if lens not in lenses:
                failures.append(f"{name}: unknown conditional-only development lens: {lens}")
            else:
                covered_lenses.add(lens)

        for lens in forbidden_lenses:
            if lens not in lenses:
                failures.append(f"{name}: unknown forbidden-unconditional lens: {lens}")
            if lens in expected_lenses:
                failures.append(f"{name}: lens cannot be both expected and forbidden-unconditional: {lens}")

        for rel in lens_files:
            try:
                path = safe_repo_path(ROOT, rel, label=f"{name} lens file")
            except ContractError as exc:
                failures.append(str(exc))
                continue
            if not path.is_file():
                failures.append(f"{name}: conditional lens file missing on disk: {rel}")

        searchable_files = expected_files | lens_files
        try:
            reference_terms = require_string_list(
                case.get("required_reference_terms", []), label=f"{name} required_reference_terms"
            )
        except ContractError as exc:
            fail(str(exc))
        valid_search_paths: list[Path] = []
        for rel in searchable_files:
            try:
                path = safe_repo_path(ROOT, rel, label=f"{name} searchable file")
            except ContractError as exc:
                failures.append(str(exc))
                continue
            if path.is_file():
                valid_search_paths.append(path)
        for phrase in reference_terms:
            found = any(phrase in active_markdown(read(path)) for path in valid_search_paths)
            if not found:
                failures.append(f"{name}: required reference term not found: {phrase}")

    uncovered_entries = [entry for entry in primary_entries if entry not in covered_entries]
    if uncovered_entries:
        failures.append(f"primary workflow entries have no corpus case: {', '.join(uncovered_entries)}")

    uncovered_lenses = [lens for lens in lenses if lens not in covered_lenses]
    if uncovered_lenses:
        failures.append(f"conditional development lenses have no corpus case: {', '.join(uncovered_lenses)}")

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        sys.exit(1)

    print(
        f"OK: route contract corpus validated ({len(cases)} cases, "
        f"{len(primary_entries)} primary entries, {len(lenses)} conditional lenses); "
        f"catalog+all_route_and_lens_projections={route_projection_bytes} bytes; "
        "live model routing not evaluated"
    )


if __name__ == "__main__":
    try:
        main()
    except ContractError as exc:
        fail(str(exc))
