#!/usr/bin/env python3
"""Independent acceptance parser for the route operation/delivery projection.

Runtime routing deliberately does not import this module. Governance compares
candidate text with immutable Git-object text through this separate parser so a
runtime parser change cannot reinterpret both sides of its own acceptance gate.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

from validation_support import ContractError, markdown_section, split_table_row


ROUTE_PROJECTION_HEADER = (
    "Route",
    "Purpose and operation rule",
    "Operation -> delivery projection",
    "Load",
)
LENS_PROJECTION_HEADER = (
    "Lens",
    "Apply when impact evidence shows",
    "Load",
)
DELIVERY_KINDS = {
    "implementation",
    "behavior_verification",
    "audit",
    "diagnosis",
    "decision",
    "design",
    "verification",
    "handoff",
    "direct_artifact",
}
_CODE_SPAN = re.compile(r"`([^`\n]+)`")
_TABLE_SEPARATOR = re.compile(r":?-{3,}:?")


def _exact_code_span(value: str, *, label: str) -> str:
    match = _CODE_SPAN.fullmatch(value.strip())
    if match is None:
        raise ContractError(f"{label} must be one exact Markdown code span")
    return match.group(1)


def parse_governance_route_rows(registry_text: str) -> list[dict[str, Any]]:
    """Parse all exact canonical route cells without using the runtime parser."""

    section = markdown_section(registry_text, "Primary Workflow Routes")
    if section is None:
        raise ContractError("routes registry missing active Primary Workflow Routes section")
    lines = section.splitlines()
    headers = [
        index
        for index, line in enumerate(lines)
        if tuple(split_table_row(line)) == ROUTE_PROJECTION_HEADER
    ]
    if len(headers) != 1:
        raise ContractError("routes registry must contain one canonical projection table header")
    header = headers[0]
    if header + 1 >= len(lines):
        raise ContractError("routes registry projection table is missing its separator")
    separator = split_table_row(lines[header + 1])
    if len(separator) != 4 or any(
        _TABLE_SEPARATOR.fullmatch(cell) is None for cell in separator
    ):
        raise ContractError("routes registry projection table has an invalid separator")

    rows: list[dict[str, Any]] = []
    route_ids: set[str] = set()
    for line in lines[header + 2 :]:
        cells = split_table_row(line)
        if not cells:
            if rows:
                break
            continue
        if len(cells) != 4:
            raise ContractError("routes registry projection rows must have exactly four cells")
        route = _exact_code_span(cells[0], label="route key")
        if route in route_ids or "/" in route:
            raise ContractError(f"routes registry route key is invalid or duplicated: {route}")
        operations: dict[str, tuple[str, ...]] = {}
        clauses = [clause.strip() for clause in cells[2].split(";")]
        if not clauses or any(not clause for clause in clauses):
            raise ContractError(f"route projection contains an empty clause: {route}")
        for clause in clauses:
            boundary = clause.split("->")
            if len(boundary) != 2:
                raise ContractError(
                    f"route projection must use one operation -> delivery boundary: {route}"
                )
            operation = _exact_code_span(
                boundary[0], label=f"route operation for {route}"
            )
            if operation in operations:
                raise ContractError(
                    f"route projection duplicates an operation: {route}: {operation}"
                )
            deliveries = tuple(
                _exact_code_span(token, label=f"route delivery for {route}/{operation}")
                for token in (part.strip() for part in boundary[1].split(","))
                if token
            )
            if not deliveries or len(deliveries) != len(set(deliveries)):
                raise ContractError(
                    f"route projection deliveries are empty or duplicated: {route}: {operation}"
                )
            unknown = sorted(set(deliveries) - DELIVERY_KINDS)
            if unknown:
                raise ContractError(
                    f"route projection has unsupported deliveries for {route}/{operation}: "
                    + ", ".join(unknown)
                )
            operations[operation] = deliveries
        if not cells[1] or not cells[3]:
            raise ContractError(f"routes registry purpose/load cells must be non-empty: {route}")
        rows.append(
            {
                "route": route,
                "purpose": cells[1],
                "operations": operations,
                "load": cells[3],
            }
        )
        route_ids.add(route)
    if not rows:
        raise ContractError("routes registry projection table must define at least one route")
    return rows


def parse_governance_lens_rows(registry_text: str) -> list[dict[str, str]]:
    """Parse exact canonical lens cells without using the runtime parser."""

    section = markdown_section(registry_text, "Conditional Development Lenses")
    if section is None:
        raise ContractError("routes registry missing active Conditional Development Lenses section")
    lines = section.splitlines()
    headers = [
        index
        for index, line in enumerate(lines)
        if tuple(split_table_row(line)) == LENS_PROJECTION_HEADER
    ]
    if len(headers) != 1:
        raise ContractError("routes registry must contain one canonical lens projection table header")
    header = headers[0]
    if header + 1 >= len(lines):
        raise ContractError("routes registry lens projection table is missing its separator")
    separator = split_table_row(lines[header + 1])
    if len(separator) != 3 or any(
        _TABLE_SEPARATOR.fullmatch(cell) is None for cell in separator
    ):
        raise ContractError("routes registry lens projection table has an invalid separator")

    rows: list[dict[str, str]] = []
    lens_ids: set[str] = set()
    for line in lines[header + 2 :]:
        cells = split_table_row(line)
        if not cells:
            if rows:
                break
            continue
        if len(cells) != 3:
            raise ContractError("routes registry lens projection rows must have exactly three cells")
        lens = _exact_code_span(cells[0], label="lens key")
        if lens in lens_ids or "/" in lens:
            raise ContractError(f"routes registry lens key is invalid or duplicated: {lens}")
        if not cells[1] or not cells[2]:
            raise ContractError(f"routes registry lens impact/load cells must be non-empty: {lens}")
        rows.append({"lens": lens, "impact": cells[1], "load": cells[2]})
        lens_ids.add(lens)
    if not rows:
        raise ContractError("routes registry lens projection table must define at least one lens")
    return rows


def parse_governance_route_projection(
    registry_text: str,
) -> dict[str, dict[str, tuple[str, ...]]]:
    """Parse the canonical operation/delivery matrix for baseline comparison."""

    return {
        row["route"]: row["operations"]
        for row in parse_governance_route_rows(registry_text)
    }


def build_governance_route_catalog(registry_text: str) -> dict[str, Any]:
    rows = parse_governance_route_rows(registry_text)
    return {
        "schema": "sliver-route-catalog/v1",
        "source": {
            "sha256": hashlib.sha256(registry_text.encode("utf-8")).hexdigest()
        },
        "routes": [
            {
                "route": row["route"],
                "purpose": row["purpose"],
                "operations": list(row["operations"]),
            }
            for row in rows
        ],
    }


def build_governance_lens_catalog(registry_text: str) -> dict[str, Any]:
    rows = parse_governance_lens_rows(registry_text)
    return {
        "schema": "sliver-lens-catalog/v1",
        "source": {
            "sha256": hashlib.sha256(registry_text.encode("utf-8")).hexdigest()
        },
        "lenses": [
            {"lens": row["lens"], "impact": row["impact"]}
            for row in rows
        ],
    }


def build_governance_route_projection(
    registry_text: str, route: str
) -> dict[str, Any]:
    matches = [
        row for row in parse_governance_route_rows(registry_text)
        if row["route"] == route
    ]
    if len(matches) != 1:
        raise ContractError(f"route projection requires one canonical route: {route}")
    row = matches[0]
    return {
        "schema": "sliver-route-projection/v1",
        "source": {
            "sha256": hashlib.sha256(registry_text.encode("utf-8")).hexdigest()
        },
        "route": row["route"],
        "purpose": row["purpose"],
        "operation_delivery": {
            operation: list(deliveries)
            for operation, deliveries in row["operations"].items()
        },
        "load": row["load"],
    }


def build_governance_lens_projection(
    registry_text: str, lens: str
) -> dict[str, Any]:
    matches = [
        row for row in parse_governance_lens_rows(registry_text)
        if row["lens"] == lens
    ]
    if len(matches) != 1:
        raise ContractError(f"lens projection requires one canonical lens: {lens}")
    row = matches[0]
    return {
        "schema": "sliver-lens-projection/v1",
        "source": {
            "sha256": hashlib.sha256(registry_text.encode("utf-8")).hexdigest()
        },
        "lens": row["lens"],
        "impact": row["impact"],
        "load": row["load"],
    }
