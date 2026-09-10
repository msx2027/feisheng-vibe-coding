#!/usr/bin/env python3
"""Validate the static execution-contract corpus; no prompts or models are executed."""

from __future__ import annotations

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
    require_int,
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
)


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
CASES = ROOT / "tests/execution-backbone-cases.json"
REGISTRY = ROOT / "references/routes-index.md"
D0_STARTUP_FILES = (
    "SKILL.md",
    "references/runtime-adapter.md",
)

TEST_LEVEL_ASSERTIONS = {
    "T0": "`T0` Non-behavior verification",
    "T1": "`T1` Existing or characterization gate",
    "T2": "`T2` Strict TDD",
    "T3": "`T3` Reproducible alternate gate",
    "T4": "`T4` Isolated exploration",
}
DELEGATED_OWNER_RE = re.compile(r"\bload `((?:references|assets)/[^`]+\.md)`", re.I)


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def read(path: Path) -> str:
    try:
        return read_utf8(path)
    except ContractError as exc:
        fail(str(exc))


def route_rows(skill_text: str) -> dict[str, str]:
    rows: dict[str, str] = {}
    for line in active_markdown(skill_text).splitlines():
        cells = split_table_row(line)
        if len(cells) < 4:
            continue
        match = re.fullmatch(r"`([^`/]+)`", cells[0])
        if not match:
            continue
        route = match.group(1)
        if route in rows:
            fail(f"duplicate route table key: {route}")
        rows[route] = cells[3]
    return rows


def owner_contract_texts(relatives: list[str], failures: list[str], *, label: str) -> dict[str, str]:
    """Load declared owners plus explicit one-hop Markdown owner delegations."""
    texts: dict[str, str] = {}
    queue = list(relatives)
    while queue:
        rel = queue.pop(0)
        if rel in texts:
            continue
        try:
            path = safe_repo_path(ROOT, rel, label=f"{label} owner file")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        if not path.is_file():
            failures.append(f"{label}: owner file missing: {rel}")
            continue
        text = active_markdown(read(path))
        texts[rel] = text
        for delegated in DELEGATED_OWNER_RE.findall(text):
            if delegated not in texts and delegated not in queue:
                queue.append(delegated)
    return texts


def canonical_table(
    owner_text: str,
    heading: str,
    *,
    failures: list[str],
) -> tuple[tuple[str, ...], list[tuple[str, ...]]]:
    try:
        section = markdown_section(owner_text, heading)
    except ContractError as exc:
        failures.append(str(exc))
        return (), []
    if section is None:
        failures.append(f"execution liveness owner missing canonical table: {heading}")
        return (), []
    table_lines = [split_table_row(line) for line in section.splitlines()]
    table_lines = [cells for cells in table_lines if cells]
    if len(table_lines) < 2:
        failures.append(f"execution liveness canonical table is incomplete: {heading}")
        return (), []
    header = tuple(table_lines[0])
    separator = table_lines[1]
    if len(separator) != len(header) or any(
        re.fullmatch(r":?-{3,}:?", cell) is None for cell in separator
    ):
        failures.append(f"execution liveness canonical table separator is invalid: {heading}")
        return header, []
    rows = [tuple(cells) for cells in table_lines[2:]]
    return header, rows


def main() -> None:
    try:
        data = load_json_object(CASES)
    except ContractError as exc:
        fail(str(exc))
    if data.get("evaluation_scope") != "static_execution_contract_corpus":
        fail("execution cases must declare static_execution_contract_corpus scope")
    if data.get("prompts_are_not_executed") is not True:
        fail("execution cases must declare that prompts are not executed")
    if data.get("live_model_behavior_is_not_evaluated") is not True:
        fail("execution cases must preserve the static/live proof boundary")
    registry_text = read(REGISTRY)
    try:
        primary_routes = markdown_section(registry_text, "Primary Workflow Routes")
    except ContractError as exc:
        fail(str(exc))
    if primary_routes is None:
        fail("routes registry missing active Primary Workflow Routes section")
    route_table = route_rows(primary_routes)
    failures: list[str] = []

    try:
        required_files = require_string_list(data.get("required_files", []), label="required_files")
    except ContractError as exc:
        fail(str(exc))
    for rel in required_files:
        try:
            path = safe_repo_path(ROOT, rel, label="required execution backbone file")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        if not path.is_file():
            failures.append(f"required execution backbone file missing: {rel}")

    if "required_skill_routes" in data:
        fail(
            "execution corpus must not define required_skill_routes; "
            "duplicate route-to-owner mapping is forbidden"
        )
    required_terms_map = data.get("required_terms", {})
    if not isinstance(required_terms_map, dict):
        fail("required_terms must be an object")

    loading_contract = data.get("development_loading_contract")
    if not isinstance(loading_contract, dict):
        fail("development_loading_contract must be an object")
    try:
        loading_route = require_string(
            loading_contract.get("route"), label="development loading route", minimum=2
        )
        d0_max_bytes = require_int(
            loading_contract.get("d0_max_bytes"),
            label="development D0 max bytes",
            minimum=1,
        )
        d0_required_refs = require_string_list(
            loading_contract.get("d0_required_refs", []),
            label="development D0 required refs",
            minimum=1,
        )
        d0_forbidden_refs = require_string_list(
            loading_contract.get("d0_forbidden_refs", []),
            label="development D0 forbidden refs",
            minimum=1,
        )
        bounded_d1_max_bytes = require_int(
            loading_contract.get("bounded_d1_max_bytes"),
            label="bounded D1 max bytes",
            minimum=1,
        )
        bounded_d1_required_refs = require_string_list(
            loading_contract.get("bounded_d1_required_refs", []),
            label="bounded D1 required refs",
            minimum=1,
        )
        bounded_d1_forbidden_refs = require_string_list(
            loading_contract.get("bounded_d1_forbidden_refs", []),
            label="bounded D1 forbidden refs",
            minimum=1,
        )
        bounded_d1_compact_marker = require_string(
            loading_contract.get("bounded_d1_compact_marker"),
            label="bounded D1 compact marker",
            minimum=10,
        )
        bounded_d1_escalation_marker = require_string(
            loading_contract.get("bounded_d1_escalation_marker"),
            label="bounded D1 escalation marker",
            minimum=20,
        )
        bounded_d1_required_terms = require_string_list(
            loading_contract.get("bounded_d1_required_terms", []),
            label="bounded D1 required terms",
            minimum=1,
        )
        bounded_d1_lens = require_string(
            loading_contract.get("bounded_d1_lens"),
            label="bounded D1 selected lens",
            minimum=3,
        )
        bounded_d1_lens_compact_marker = require_string(
            loading_contract.get("bounded_d1_lens_compact_marker"),
            label="bounded D1 lens compact marker",
            minimum=20,
        )
        bounded_d1_lens_forbidden_refs = require_string_list(
            loading_contract.get("bounded_d1_lens_forbidden_refs", []),
            label="bounded D1 lens forbidden refs",
            minimum=1,
        )
        bounded_d1_include_lens_catalog_bytes = loading_contract.get(
            "bounded_d1_include_lens_catalog_bytes"
        )
    except ContractError as exc:
        fail(str(exc))
    conditional_refs = loading_contract.get("conditional_refs")
    if not isinstance(conditional_refs, dict) or not conditional_refs:
        fail("development conditional_refs must be a non-empty object")
    if bounded_d1_include_lens_catalog_bytes is not True:
        fail("bounded D1 UI budget must include exact lens catalog bytes")

    loading_row = route_table.get(loading_route)
    if loading_row is None:
        failures.append(f"route missing from routes registry: {loading_route}")
    else:
        base_loads = loading_row.split(". ", 1)[0]
        for rel in d0_required_refs:
            if rel not in base_loads:
                failures.append(f"{loading_route}: D0 base missing required reference {rel}")
        for rel in d0_forbidden_refs:
            if rel in base_loads:
                failures.append(f"{loading_route}: D0 base contains conditional reference {rel}")
        if bounded_d1_compact_marker not in loading_row:
            failures.append(f"{loading_route}: bounded D1 compact marker is missing")
        if bounded_d1_escalation_marker not in loading_row:
            failures.append(f"{loading_route}: bounded D1 escalation marker is missing")
        compact_clauses = [
            clause for clause in loading_row.split(". ")
            if bounded_d1_compact_marker in clause
        ]
        if len(compact_clauses) == 1:
            for rel in bounded_d1_forbidden_refs:
                if rel in compact_clauses[0]:
                    failures.append(
                        f"{loading_route}: bounded D1 compact clause loads forbidden reference {rel}"
                    )
        for condition, refs_value in conditional_refs.items():
            try:
                require_string(condition, label="development loading condition", minimum=3)
                refs = require_string_list(
                    refs_value, label=f"development conditional refs for {condition}", minimum=1
                )
            except ContractError as exc:
                failures.append(str(exc))
                continue
            for rel in refs:
                if rel not in loading_row:
                    failures.append(
                        f"{loading_route}: conditional loading rule missing reference {rel}"
                    )

    catalog_json = json.dumps(
        build_route_catalog(REGISTRY),
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n"
    projection_json = json.dumps(
        build_route_projection(loading_route, REGISTRY),
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n"
    route_projection_bytes = len(catalog_json.encode("utf-8")) + len(
        projection_json.encode("utf-8")
    )
    try:
        lens_catalog = build_lens_catalog(REGISTRY)
        lens_projection = build_lens_projection(bounded_d1_lens, REGISTRY)
    except ContractError as exc:
        failures.append(str(exc))
        lens_projection = None
        lens_catalog = None
    lens_catalog_bytes = 0
    if lens_catalog is not None:
        lens_catalog_json = json.dumps(
            lens_catalog,
            ensure_ascii=False,
            separators=(",", ":"),
        ) + "\n"
        lens_catalog_bytes = len(lens_catalog_json.encode("utf-8"))
    lens_projection_bytes = 0
    if lens_projection is not None:
        lens_projection_json = json.dumps(
            lens_projection,
            ensure_ascii=False,
            separators=(",", ":"),
        ) + "\n"
        lens_projection_bytes = len(lens_projection_json.encode("utf-8"))
        lens_load = lens_projection["load"]
        if bounded_d1_lens_compact_marker not in lens_load:
            failures.append(
                f"{bounded_d1_lens}: bounded D1 lens compact marker is missing"
            )
        lens_base_loads = lens_load.split(". ", 1)[0]
        for rel in bounded_d1_lens_forbidden_refs:
            if rel in lens_base_loads:
                failures.append(
                    f"{bounded_d1_lens}: bounded D1 lens defaults to detailed owner {rel}"
                )
        lens_compact_clauses = [
            clause for clause in lens_load.split(". ")
            if bounded_d1_lens_compact_marker in clause
        ]
        if len(lens_compact_clauses) != 1:
            failures.append(
                f"{bounded_d1_lens}: bounded D1 lens must define one compact clause"
            )
        else:
            for rel in bounded_d1_lens_forbidden_refs:
                if rel in lens_compact_clauses[0]:
                    failures.append(
                        f"{bounded_d1_lens}: compact lens clause loads forbidden reference {rel}"
                    )

    d0_paths = [*D0_STARTUP_FILES, *d0_required_refs]
    d0_bytes = route_projection_bytes + lens_catalog_bytes + lens_projection_bytes
    for rel in dict.fromkeys(d0_paths):
        try:
            path = safe_repo_path(ROOT, rel, label="development D0 loading file")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        if not path.is_file():
            failures.append(f"development D0 loading file missing: {rel}")
            continue
        d0_bytes += len(path.read_bytes())
    if d0_bytes > d0_max_bytes:
        failures.append(
            f"D0 base loading budget exceeded: {d0_bytes} bytes > {d0_max_bytes} bytes"
        )

    bounded_d1_paths = [*D0_STARTUP_FILES, *bounded_d1_required_refs]
    bounded_d1_bytes = route_projection_bytes + lens_catalog_bytes + lens_projection_bytes
    for rel in dict.fromkeys(bounded_d1_paths):
        try:
            path = safe_repo_path(ROOT, rel, label="bounded D1 loading file")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        if not path.is_file():
            failures.append(f"bounded D1 loading file missing: {rel}")
            continue
        bounded_d1_bytes += len(path.read_bytes())
    if bounded_d1_bytes > bounded_d1_max_bytes:
        failures.append(
            "bounded D1 loading budget exceeded: "
            f"{bounded_d1_bytes} bytes > {bounded_d1_max_bytes} bytes"
        )
    bounded_d1_core = active_markdown(
        read(ROOT / "references/development-execution-core.md")
    )
    for term in bounded_d1_required_terms:
        if term not in bounded_d1_core:
            failures.append(f"bounded D1 core missing required term: {term}")

    project_audit_contract = data.get("project_audit_loading_contract")
    if not isinstance(project_audit_contract, dict):
        fail("project_audit_loading_contract must be an object")
    try:
        project_audit_route = require_string(
            project_audit_contract.get("route"),
            label="project audit loading route",
            minimum=2,
        )
        project_audit_max_bytes = require_int(
            project_audit_contract.get("bounded_max_bytes"),
            label="bounded project audit max bytes",
            minimum=1,
        )
        project_audit_required_refs = require_string_list(
            project_audit_contract.get("required_refs", []),
            label="bounded project audit required refs",
            minimum=1,
        )
        project_audit_forbidden_refs = require_string_list(
            project_audit_contract.get("forbidden_default_refs", []),
            label="bounded project audit forbidden default refs",
            minimum=1,
        )
        project_audit_compact_marker = require_string(
            project_audit_contract.get("compact_marker"),
            label="bounded project audit compact marker",
            minimum=10,
        )
        project_audit_stage_marker = require_string(
            project_audit_contract.get("stage_escalation_marker"),
            label="bounded project audit stage escalation marker",
            minimum=20,
        )
        project_audit_incomplete_marker = require_string(
            project_audit_contract.get("incomplete_truth_marker"),
            label="bounded project audit incomplete truth marker",
            minimum=20,
        )
        project_audit_lens = require_string(
            project_audit_contract.get("lens"),
            label="bounded project audit selected lens",
            minimum=3,
        )
        project_audit_required_terms = require_string_list(
            project_audit_contract.get("required_terms", []),
            label="bounded project audit required terms",
            minimum=1,
        )
    except ContractError as exc:
        fail(str(exc))
    if project_audit_contract.get("include_lens_catalog_bytes") is not True:
        failures.append("bounded project audit budget must include exact lens catalog bytes")

    project_audit_row = route_table.get(project_audit_route)
    if project_audit_row is None:
        failures.append(f"route missing from routes registry: {project_audit_route}")
    else:
        project_audit_base = project_audit_row.split(". ", 1)[0]
        for rel in project_audit_forbidden_refs:
            if rel in project_audit_base:
                failures.append(
                    f"{project_audit_route}: bounded base contains conditional reference {rel}"
                )
        for marker in (
            project_audit_stage_marker,
            project_audit_incomplete_marker,
        ):
            if marker not in project_audit_row:
                failures.append(
                    f"{project_audit_route}: conditional loading marker is missing: {marker}"
                )

    project_audit_catalog_json = json.dumps(
        build_route_catalog(REGISTRY),
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n"
    project_audit_projection_json = json.dumps(
        build_route_projection(project_audit_route, REGISTRY),
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n"
    project_audit_lens_catalog_json = json.dumps(
        build_lens_catalog(REGISTRY),
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n"
    project_audit_lens_projection_json = json.dumps(
        build_lens_projection(project_audit_lens, REGISTRY),
        ensure_ascii=False,
        separators=(",", ":"),
    ) + "\n"
    project_audit_projection_bytes = sum(
        len(value.encode("utf-8"))
        for value in (
            project_audit_catalog_json,
            project_audit_projection_json,
            project_audit_lens_catalog_json,
            project_audit_lens_projection_json,
        )
    )
    project_audit_bytes = project_audit_projection_bytes
    for rel in dict.fromkeys([*D0_STARTUP_FILES, *project_audit_required_refs]):
        try:
            path = safe_repo_path(ROOT, rel, label="bounded project audit loading file")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        if not path.is_file():
            failures.append(f"bounded project audit loading file missing: {rel}")
            continue
        project_audit_bytes += len(path.read_bytes())
    if project_audit_bytes > project_audit_max_bytes:
        failures.append(
            "bounded project audit loading budget exceeded: "
            f"{project_audit_bytes} bytes > {project_audit_max_bytes} bytes"
        )
    project_audit_owner = active_markdown(read(ROOT / "references/routes-intake.md"))
    try:
        project_audit_section = markdown_section(
            project_audit_owner, project_audit_compact_marker
        )
    except ContractError as exc:
        failures.append(str(exc))
        project_audit_section = None
    if project_audit_section is None:
        failures.append(
            f"bounded project audit owner missing section: {project_audit_compact_marker}"
        )
    else:
        for term in project_audit_required_terms:
            if term not in project_audit_section:
                failures.append(f"bounded project audit core missing required term: {term}")

    liveness_contract = data.get("execution_liveness_contract")
    if not isinstance(liveness_contract, dict):
        fail("execution_liveness_contract must be an object")
    try:
        liveness_owner_rel = require_string(
            liveness_contract.get("owner_file"),
            label="execution liveness owner_file",
        )
        liveness_owner_path = safe_repo_path(
            ROOT, liveness_owner_rel, label="execution liveness owner_file"
        )
    except ContractError as exc:
        fail(str(exc))
    table_contracts = liveness_contract.get("tables")
    if not isinstance(table_contracts, dict) or set(table_contracts) != {
        "Pending Operation Transition Table",
        "Running Refresh Schedule",
        "Portable Receipt Schema",
    }:
        fail("execution_liveness_contract must define exactly three canonical tables")
    if liveness_owner_rel != "references/execution-liveness.md":
        failures.append("execution liveness owner must remain references/execution-liveness.md")
    if liveness_owner_path.is_file():
        owner_text = active_markdown(read(liveness_owner_path))
        for heading, contract in table_contracts.items():
            if not isinstance(contract, dict):
                fail(f"execution liveness table contract must be an object: {heading}")
            expected_header = contract.get("header")
            expected_rows = contract.get("rows")
            if not isinstance(expected_header, list) or not all(
                isinstance(cell, str) and cell for cell in expected_header
            ):
                fail(f"execution liveness table header is invalid: {heading}")
            if not isinstance(expected_rows, list) or not all(
                isinstance(row, list)
                and len(row) == len(expected_header)
                and all(isinstance(cell, str) and cell for cell in row)
                for row in expected_rows
            ):
                fail(f"execution liveness table rows are invalid: {heading}")
            actual_header, actual_rows = canonical_table(
                owner_text, heading, failures=failures
            )
            if actual_header != tuple(expected_header):
                failures.append(f"execution liveness table header drifted: {heading}")
            if actual_rows != [tuple(row) for row in expected_rows]:
                failures.append(f"execution liveness table rows drifted: {heading}")

    for rel, terms in required_terms_map.items():
        try:
            path = safe_repo_path(ROOT, rel, label="required-terms file")
            required_terms = require_string_list(terms, label=f"{rel} required_terms")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        text = active_markdown(read(path))
        for term in required_terms:
            if term not in text:
                failures.append(f"{rel}: missing required execution term: {term}")

    forbidden_terms = data.get("forbidden_terms", {})
    if not isinstance(forbidden_terms, dict):
        fail("forbidden_terms must be an object")
    for rel, terms in forbidden_terms.items():
        try:
            path = safe_repo_path(ROOT, rel, label="forbidden-terms file")
            rejected = require_string_list(terms, label=f"{rel} forbidden_terms")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        text = active_markdown(read(path))
        for term in rejected:
            if term in text:
                failures.append(f"{rel}: forbidden execution term present: {term}")

    forbidden_patterns = data.get("forbidden_patterns", {})
    if not isinstance(forbidden_patterns, dict):
        fail("forbidden_patterns must be an object")
    for rel, patterns in forbidden_patterns.items():
        try:
            path = safe_repo_path(ROOT, rel, label="forbidden-patterns file")
            rejected_patterns = require_string_list(patterns, label=f"{rel} forbidden_patterns")
        except ContractError as exc:
            failures.append(str(exc))
            continue
        text = active_markdown(read(path))
        for pattern in rejected_patterns:
            try:
                matched = re.search(pattern, text, flags=re.I | re.S)
            except re.error as exc:
                fail(f"invalid forbidden regex for {rel}: {pattern}: {exc}")
            if matched:
                failures.append(f"{rel}: forbidden execution pattern present: {pattern}")

    pressure_cases = data.get("pressure_cases", [])
    if not isinstance(pressure_cases, list):
        fail("pressure_cases must be a list")
    if len(pressure_cases) < 6:
        failures.append("execution pressure cases should cover at least 6 scenarios")

    seen_names: set[str] = set()
    seen_prompts: set[str] = set()
    for index, case in enumerate(pressure_cases):
        if not isinstance(case, dict):
            fail(f"pressure case {index} must be an object")
        try:
            name = require_string(case.get("name"), label=f"pressure case {index} name", minimum=3)
            prompt = require_prompt(case.get("prompt"), label=f"{name} prompt")
            owner_files = require_string_list(case.get("owner_files", []), label=f"{name} owner_files", minimum=1)
        except ContractError as exc:
            fail(str(exc))
        if name in seen_names:
            failures.append(f"duplicate pressure case name: {name}")
        if prompt in seen_prompts:
            failures.append(f"{name}: duplicate pressure prompt")
        seen_names.add(name)
        seen_prompts.add(prompt)

        owner_texts = owner_contract_texts(owner_files, failures, label=name)
        case_text = "\n".join(owner_texts.values())

        expected_route = case.get("expected_route")
        if expected_route:
            try:
                expected_route = require_string(expected_route, label=f"{name} expected_route", minimum=2)
            except ContractError as exc:
                fail(str(exc))
            row = route_table.get(expected_route)
            if row is None:
                failures.append(f"{name}: expected route missing: {expected_route}")
            else:
                for rel in owner_files:
                    if rel not in row:
                        failures.append(f"{name}: {expected_route} does not load owner file: {rel}")

        expected_test_level = case.get("expected_test_level")
        if expected_test_level is not None:
            try:
                expected_test_level = require_string(
                    expected_test_level, label=f"{name} expected_test_level", minimum=2
                )
            except ContractError as exc:
                fail(str(exc))
            if expected_test_level not in TEST_LEVEL_ASSERTIONS:
                failures.append(f"{name}: invalid expected_test_level: {expected_test_level}")
            level_assertion = case.get("level_assertion")
            try:
                level_assertion = require_string(
                    level_assertion, label=f"{name} level_assertion", minimum=3
                )
            except ContractError as exc:
                fail(str(exc))
            canonical_assertion = TEST_LEVEL_ASSERTIONS.get(expected_test_level)
            if canonical_assertion is not None and level_assertion != canonical_assertion:
                failures.append(
                    f"{name}: level_assertion does not match {expected_test_level}: "
                    f"expected {canonical_assertion}, got {level_assertion}"
                )
            try:
                classification_terms = require_string_list(
                    case.get("classification_terms", []),
                    label=f"{name} classification_terms",
                    minimum=2,
                )
            except ContractError as exc:
                fail(str(exc))
            if classification_terms[0] != level_assertion:
                failures.append(
                    f"{name}: first classification term must equal level_assertion: "
                    f"{level_assertion}"
                )
            if "references/testing-strategy.md" not in owner_files:
                failures.append(
                    f"{name}: expected_test_level requires references/testing-strategy.md owner"
                )
            elif level_assertion not in case_text:
                failures.append(
                    f"{name}: testing owner does not define level assertion: {level_assertion}"
                )
            for term in classification_terms:
                if term not in case_text:
                    failures.append(
                        f"{name}: testing owner missing classification rule term: {term}"
                    )

        try:
            must_apply = require_string_list(case.get("must_apply", []), label=f"{name} must_apply")
            must_not_require = require_string_list(
                case.get("must_not_require", []), label=f"{name} must_not_require"
            )
        except ContractError as exc:
            fail(str(exc))
        for term in must_apply:
            if term not in case_text:
                failures.append(f"{name}: missing must-apply execution term: {term}")
        for term in must_not_require:
            if term not in case_text:
                failures.append(f"{name}: missing must-not-require boundary term: {term}")

        section_contracts = case.get("section_contracts", [])
        if not isinstance(section_contracts, list):
            fail(f"{name} section_contracts must be a list")
        for contract_index, contract in enumerate(section_contracts):
            if not isinstance(contract, dict):
                fail(f"{name} section contract {contract_index} must be an object")
            try:
                rel = require_string(contract.get("file"), label=f"{name} section file")
                heading = require_string(contract.get("section"), label=f"{name} section heading")
                section_required = require_string_list(
                    contract.get("required_terms", []), label=f"{name} section required_terms"
                )
                section_forbidden = require_string_list(
                    contract.get("forbidden_terms", []), label=f"{name} section forbidden_terms"
                )
            except ContractError as exc:
                fail(str(exc))
            if rel not in owner_files:
                failures.append(f"{name}: section contract file is not an owner_file: {rel}")
                continue
            sections: list[str] = []
            for owner_text in owner_texts.values():
                try:
                    section = markdown_section(owner_text, heading)
                except ContractError as exc:
                    failures.append(str(exc))
                    continue
                if section is not None:
                    sections.append(section)
            if not sections:
                failures.append(f"{name}: missing required section in {rel}: {heading}")
                continue
            if len(sections) > 1:
                failures.append(f"{name}: duplicate delegated owner section: {heading}")
                continue
            section = sections[0]
            for term in section_required:
                if term not in section:
                    failures.append(f"{name}: {rel} section {heading} missing term: {term}")
            for term in section_forbidden:
                if term in section:
                    failures.append(f"{name}: {rel} section {heading} contains forbidden term: {term}")
            minimum_bullets = contract.get("min_bullets")
            if minimum_bullets is not None:
                try:
                    minimum_bullets = require_int(
                        minimum_bullets, label=f"{name} section min_bullets", minimum=0
                    )
                except ContractError as exc:
                    fail(str(exc))
                bullet_count = sum(1 for line in section.splitlines() if line.lstrip().startswith("- "))
                if bullet_count < minimum_bullets:
                    failures.append(
                        f"{name}: {rel} section {heading} has {bullet_count} bullets; "
                        f"expected at least {minimum_bullets}"
                    )

    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        sys.exit(1)

    print(
        f"OK: static execution contract corpus validated ({len(pressure_cases)} cases); "
        f"route_projection={route_projection_bytes} bytes, "
        f"lens_catalog={lens_catalog_bytes} bytes, "
        f"{bounded_d1_lens}_projection={lens_projection_bytes} bytes, UI_D0={d0_bytes} bytes, "
        f"bounded_D1_UI={bounded_d1_bytes} bytes, "
        f"bounded_project_audit={project_audit_bytes} bytes; "
        "prompts and live model behavior not evaluated"
    )


if __name__ == "__main__":
    try:
        main()
    except ContractError as exc:
        fail(str(exc))
