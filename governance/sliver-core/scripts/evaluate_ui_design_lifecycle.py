#!/usr/bin/env python3
"""Validate the static UI-design lifecycle contract; no model is executed."""

from __future__ import annotations

import sys
from pathlib import Path

from validation_support import (
    ContractError,
    active_markdown,
    load_json_object,
    read_utf8,
    require_prompt,
    require_string,
    require_string_list,
    safe_repo_path,
)


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
CASES = ROOT / "tests/ui-design-lifecycle-cases.json"


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def main() -> None:
    try:
        data = load_json_object(CASES)
        if data.get("schema") != "sliver-ui-design-lifecycle-cases/v1":
            raise ContractError("unsupported UI design lifecycle case schema")
        if data.get("evaluation_scope") != "static_ui_design_lifecycle_contract":
            raise ContractError("UI design cases must declare static contract scope")
        if data.get("prompts_are_not_executed") is not True:
            raise ContractError("UI design static cases must state that prompts are not executed")
        if data.get("live_model_behavior_is_not_evaluated") is not True:
            raise ContractError("UI design static cases must preserve the static/live proof boundary")

        failures: list[str] = []
        for rel in require_string_list(data.get("required_files"), label="required_files"):
            path = safe_repo_path(ROOT, rel, label="required UI lifecycle file")
            if not path.is_file():
                failures.append(f"required UI lifecycle file missing: {rel}")

        required_terms = data.get("required_terms")
        if not isinstance(required_terms, dict):
            raise ContractError("required_terms must be an object")
        for rel, terms in required_terms.items():
            path = safe_repo_path(ROOT, rel, label="required-terms owner")
            if not path.is_file():
                failures.append(f"required-terms owner missing: {rel}")
                continue
            text = active_markdown(read_utf8(path))
            for term in require_string_list(terms, label=f"{rel} required_terms"):
                if term not in text:
                    failures.append(f"{rel}: missing UI lifecycle term: {term}")

        forbidden_literals = data.get("forbidden_literals")
        if not isinstance(forbidden_literals, dict):
            raise ContractError("forbidden_literals must be an object")
        for rel, literals in forbidden_literals.items():
            path = safe_repo_path(ROOT, rel, label="forbidden-literals owner")
            text = read_utf8(path)
            for literal in require_string_list(literals, label=f"{rel} forbidden_literals"):
                if literal in text:
                    failures.append(f"{rel}: hard-coded example leaked into owner or live fixture: {literal}")

        single_owner_forbidden = data.get("single_owner_forbidden_literals")
        if not isinstance(single_owner_forbidden, dict):
            raise ContractError("single_owner_forbidden_literals must be an object")
        for rel, literals in single_owner_forbidden.items():
            path = safe_repo_path(ROOT, rel, label="single-owner consumer")
            text = active_markdown(read_utf8(path))
            for literal in require_string_list(literals, label=f"{rel} single_owner_forbidden_literals"):
                if literal in text:
                    failures.append(f"{rel}: duplicates UI lifecycle schema owned by references/ui-design-lifecycle.md: {literal}")

        cases = data.get("cases")
        if not isinstance(cases, list) or len(cases) < 12:
            raise ContractError("UI design lifecycle corpus must contain at least 12 cases")
        forbidden_case_literals = require_string_list(
            data.get("forbidden_case_literals"),
            label="forbidden_case_literals",
            minimum=1,
        )
        seen_names: set[str] = set()
        seen_prompts: set[str] = set()
        for index, case in enumerate(cases):
            if not isinstance(case, dict):
                raise ContractError(f"case {index} must be an object")
            name = require_string(case.get("name"), label=f"case {index} name", minimum=3)
            prompt = require_prompt(case.get("prompt"), label=f"{name} prompt")
            serialized_case = str(case)
            for literal in forbidden_case_literals:
                if literal in serialized_case:
                    failures.append(f"{name}: hard-coded example leaked into case contract: {literal}")
            if name in seen_names or prompt in seen_prompts:
                failures.append(f"duplicate UI lifecycle case name or prompt: {name}")
            seen_names.add(name)
            seen_prompts.add(prompt)
            owner_text = "\n".join(
                active_markdown(read_utf8(safe_repo_path(ROOT, rel, label=f"{name} owner")))
                for rel in require_string_list(case.get("owner_files"), label=f"{name} owner_files")
            )
            for term in require_string_list(case.get("must_apply"), label=f"{name} must_apply"):
                if term not in owner_text:
                    failures.append(f"{name}: missing required owner contract: {term}")
            require_string(case.get("forbidden_outcome"), label=f"{name} forbidden_outcome", minimum=3)

        if failures:
            for item in failures:
                print(f"FAIL: {item}")
            raise SystemExit(1)
    except ContractError as exc:
        fail(str(exc))

    print(f"OK: UI design lifecycle static contract passed ({len(cases)} cases)")


if __name__ == "__main__":
    main()
