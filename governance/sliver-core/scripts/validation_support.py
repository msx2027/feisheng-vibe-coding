"""Shared parsers and input guards for the repository validation scripts."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional


class ContractError(ValueError):
    """Raised when a validation contract is malformed or ambiguous."""


def read_utf8(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise ContractError(f"missing file: {path}") from exc
    except UnicodeDecodeError as exc:
        raise ContractError(f"file is not valid UTF-8: {path}: {exc}") from exc


def load_json_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(read_utf8(path))
    except json.JSONDecodeError as exc:
        raise ContractError(f"invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ContractError(f"JSON contract must be an object: {path}")
    return value


def active_markdown(text: str) -> str:
    """Remove HTML comments and fenced code blocks before contract parsing."""
    active: list[str] = []
    fence_char: Optional[str] = None
    fence_length = 0
    in_comment = False
    for raw_line in text.splitlines():
        if fence_char is not None:
            match = re.match(r"^ {0,3}(`{3,}|~{3,})", raw_line)
            if match and match.group(1)[0] == fence_char and len(match.group(1)) >= fence_length:
                fence_char = None
                fence_length = 0
            continue
        if not in_comment and (raw_line.startswith("\t") or raw_line.startswith("    ")):
            continue

        visible: list[str] = []
        cursor = 0
        while cursor < len(raw_line):
            if in_comment:
                end = raw_line.find("-->", cursor)
                if end < 0:
                    cursor = len(raw_line)
                    break
                in_comment = False
                cursor = end + 3
                continue

            unexpected_end = raw_line.find("-->", cursor)
            start = raw_line.find("<!--", cursor)
            if unexpected_end >= 0 and (start < 0 or unexpected_end < start):
                raise ContractError("unmatched HTML comment terminator")
            if start < 0:
                visible.append(raw_line[cursor:])
                break
            visible.append(raw_line[cursor:start])
            in_comment = True
            cursor = start + 4

        line = "".join(visible)
        if line.startswith("\t") or line.startswith("    "):
            continue
        match = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if match:
            marker = match.group(1)
            fence_char = marker[0]
            fence_length = len(marker)
            continue
        active.append(line)

    if in_comment:
        raise ContractError("unclosed HTML comment")
    if fence_char is not None:
        raise ContractError("unclosed Markdown fence")
    return "\n".join(active)


def markdown_section(text: str, heading: str, *, level: int = 2) -> Optional[str]:
    """Return one active exact-heading section and reject duplicate owners."""
    lines = active_markdown(text).splitlines()
    marker = "#" * level
    target = f"{marker} {heading}"
    starts = [index for index, line in enumerate(lines) if re.fullmatch(rf" {{0,3}}{re.escape(target)}", line)]
    if not starts:
        return None
    if len(starts) > 1:
        raise ContractError(f"duplicate Markdown section: {target}")

    start = starts[0]
    end = len(lines)
    heading_pattern = re.compile(rf"^#{{1,{level}}}\s+")
    for index in range(start + 1, len(lines)):
        if heading_pattern.match(lines[index].lstrip(" ")) and len(lines[index]) - len(lines[index].lstrip(" ")) <= 3:
            end = index
            break
    return "\n".join(lines[start:end])


def split_table_row(line: str) -> list[str]:
    if line.startswith("\t") or line.startswith("    "):
        return []
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return []

    cells: list[str] = []
    cell: list[str] = []
    escaped = False
    code_delimiter = 0
    index = 1
    end = len(stripped) - 1
    while index < end:
        char = stripped[index]
        if escaped:
            cell.append(char)
            escaped = False
            index += 1
            continue
        if char == "\\":
            cell.append(char)
            escaped = True
            index += 1
            continue
        if char == "`":
            run = 1
            while index + run < end and stripped[index + run] == "`":
                run += 1
            cell.extend("`" * run)
            if code_delimiter == 0:
                code_delimiter = run
            elif run == code_delimiter:
                code_delimiter = 0
            index += run
            continue
        if char == "|" and code_delimiter == 0:
            cells.append("".join(cell).strip())
            cell = []
        else:
            cell.append(char)
        index += 1
    cells.append("".join(cell).strip())
    if code_delimiter != 0:
        raise ContractError("unclosed code span in Markdown table row")
    return cells


def safe_repo_path(root: Path, relative: str, *, label: str = "path") -> Path:
    if not isinstance(relative, str) or not relative.strip():
        raise ContractError(f"{label} must be a non-empty relative path")
    rel = Path(relative)
    if rel.is_absolute():
        raise ContractError(f"{label} must stay inside the repository: {relative}")
    root = root.resolve()
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ContractError(f"{label} escapes the repository: {relative}") from exc
    return candidate


def require_string(value: Any, *, label: str, minimum: int = 1) -> str:
    if not isinstance(value, str) or len(value.strip()) < minimum:
        raise ContractError(f"{label} must be a string with at least {minimum} characters")
    return value.strip()


def require_prompt(value: Any, *, label: str) -> str:
    prompt = require_string(value, label=label, minimum=2)
    if len(prompt) < 4 and not re.search(r"[\u3400-\u9fff]", prompt):
        raise ContractError(f"{label} is too short to represent a real user intent")
    return prompt


def require_int(value: Any, *, label: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ContractError(f"{label} must be an integer >= {minimum}")
    return value


def require_string_list(value: Any, *, label: str, minimum: int = 0) -> list[str]:
    if not isinstance(value, list) or len(value) < minimum:
        raise ContractError(f"{label} must be a list with at least {minimum} items")
    result = [require_string(item, label=f"{label} item") for item in value]
    if len(result) != len(set(result)):
        raise ContractError(f"{label} contains duplicate items")
    return result


def require_fields(value: dict[str, Any], fields: list[str], *, label: str) -> None:
    missing = [field for field in fields if field not in value]
    if missing:
        raise ContractError(f"{label} missing fields: {', '.join(missing)}")
