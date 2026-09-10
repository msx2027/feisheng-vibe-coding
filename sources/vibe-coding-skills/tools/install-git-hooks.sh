#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
ROOT=$(dirname "$SCRIPT_DIR")

if [ ! -f "$ROOT/.githooks/pre-commit" ]; then
  echo "Missing hook file: $ROOT/.githooks/pre-commit" >&2
  exit 1
fi

if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Git hooks need a Git repository. Run git init first or use the package inside a cloned repo, then rerun this script." >&2
  exit 1
fi

if ! git -C "$ROOT" rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "Git hooks should be installed after the first baseline commit." >&2
  echo "Commit the imported package once, then rerun this script." >&2
  exit 1
fi

if ! command -v bash >/dev/null 2>&1; then
  echo "Git hooks in this package rely on bash. Install Git Bash or another bash and make sure it is in PATH, then rerun this script." >&2
  exit 1
fi

git -C "$ROOT" config core.hooksPath .githooks
echo "Git hooks installed."
echo "core.hooksPath = $(git -C "$ROOT" config --get core.hooksPath)"
