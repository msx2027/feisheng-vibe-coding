#!/usr/bin/env python3
"""Shared syntax predicate for immutable Git commit identifiers.

Passing this check only fixes the revision to a full object name. It does not
authenticate the commit or prove that an external baseline promotion is trusted.
"""

from __future__ import annotations

import re


COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")


def is_full_lowercase_git_commit(value: object) -> bool:
    """Return whether *value* is exactly one full lowercase Git commit ID."""

    return isinstance(value, str) and COMMIT_RE.fullmatch(value) is not None
