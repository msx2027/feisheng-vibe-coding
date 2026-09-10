#!/bin/bash
# DocMap:
# Layer: L3 / validation script
# Module: tools
# Depends on: tools/doc-sync-helpers.sh, codex-hooks/shared.ps1
# Verifies cross-runtime source classification and special-path preservation.

set -euo pipefail

SOURCE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP_ROOT=$(mktemp -d)

if command -v pwsh >/dev/null 2>&1; then
  POWERSHELL_BIN="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  POWERSHELL_BIN="powershell"
else
  POWERSHELL_BIN=""
fi

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

to_powershell_path() {
  local path="$1"

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$path"
  else
    printf '%s\n' "$path"
  fi
}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

test_bash_classification_contract() {
  local path
  local -a language_paths=(
    src/main.rs
    src/main.go
    src/Main.java
    src/Main.kt
    lib/main.dart
    Sources/App.swift
    src/App.cs
    src/main.cpp
    src/main.RS
    src/main.Go
    src/Main.JAVA
  )

  # shellcheck disable=SC1091
  source "$SOURCE_ROOT/tools/doc-sync-helpers.sh"

  for path in "${language_paths[@]}"; do
    [ "$(doc_sync_path_tier "$path")" = "t2" ] || fail "expected Bash t2 for $path"
    doc_sync_is_source_change_path "$path" || fail "expected Bash source change for $path"
    [ "$(doc_sync_path_gate_level "$path")" = "t2-light" ] || fail "expected Bash t2-light gate for $path"
  done

  for path in .env.example .env.production .ENV.production; do
    [ "$(doc_sync_path_tier "$path")" = "t3" ] || fail "expected Bash t3 for $path"
    doc_sync_is_source_change_path "$path" || fail "expected Bash source change for $path"
    [ "$(doc_sync_path_gate_level "$path")" = "strict" ] || fail "expected Bash strict gate for $path"
  done
}

test_ascii_lowercase_uses_c_locale() (
  # shellcheck disable=SC1091
  source "$SOURCE_ROOT/tools/doc-sync-helpers.sh"
  unset LC_ALL
  tr() {
    [ "${LC_ALL:-}" = "C" ] || return 91
    command tr "$@"
  }

  local lowered
  lowered=$(doc_sync_lowercase_path 'src/Äpp.RS')
  [ "$lowered" = 'src/Äpp.rs' ] || fail "expected ASCII-only lowercase with LC_ALL=C"
)

write_powershell_contract_test() {
  cat > "$TMP_ROOT/test-hook-path-classification.ps1" <<'EOF'
param(
    [Parameter(Mandatory = $true)][string]$SharedPath
)

$ErrorActionPreference = "Stop"
. $SharedPath

$languagePaths = @(
    "src/main.rs",
    "src/main.go",
    "src/Main.java",
    "src/Main.kt",
    "lib/main.dart",
    "Sources/App.swift",
    "src/App.cs",
    "src/main.cpp"
    "src/main.RS",
    "src/main.Go",
    "src/Main.JAVA"
)

foreach ($path in $languagePaths) {
    if ((Get-RepoPathExecutionTier $path) -ne "t2") {
        throw "expected PowerShell t2 for $path"
    }
    if (-not (Test-SourceChangeRepoPath $path)) {
        throw "expected PowerShell source change for $path"
    }
    if ((Get-RepoPathGateLevel $path) -ne "t2-light") {
        throw "expected PowerShell t2-light gate for $path"
    }
}

foreach ($path in @(".env.example", ".env.production", ".ENV.production")) {
    if ((Get-RepoPathExecutionTier $path) -ne "t3") {
        throw "expected PowerShell t3 for $path"
    }
    if (-not (Test-SourceChangeRepoPath $path)) {
        throw "expected PowerShell source change for $path"
    }
    if ((Get-RepoPathGateLevel $path) -ne "strict") {
        throw "expected PowerShell strict gate for $path"
    }
}

$expectedPaths = @("src/tab`tname.rs", "src/line`nname.go")
$payload = [System.Text.Encoding]::UTF8.GetBytes((@("M", $expectedPaths[0], "M", $expectedPaths[1]) -join "`0") + "`0")
$records = @(ConvertFrom-GitNameStatusBytes -Bytes $payload -Scope "cached")
foreach ($expectedPath in $expectedPaths) {
    if (@($records | Where-Object { $_.Status -eq "M" -and $_.Path -ceq $expectedPath }).Count -ne 1) {
        throw "PowerShell Git records did not preserve special path: $expectedPath"
    }
}

if ($env:OS -eq "Windows_NT") {
    $relative = Get-RelativeRepoPath -Root "C:/Repo" -Path "c:/repo/src/main.rs"
    if ($relative -cne "src/main.rs") {
        throw "expected case-insensitive Windows relativization, got: $relative"
    }
}
EOF
}

test_special_git_paths_are_nul_safe() {
  local tab_path=$'src/tab\tname.rs'
  local newline_path=$'src/line\nname.go'
  local status path old_path
  local index=0
  local -a fields=()
  local -A seen=()

  # shellcheck disable=SC1091
  source "$SOURCE_ROOT/tools/doc-sync-helpers.sh"
  git() {
    local arg
    for arg in "$@"; do
      if [ "$arg" = "rev-parse" ]; then
        printf '.git\n'
        return 0
      fi
      if [ "$arg" = "diff" ]; then
        printf 'M\0%s\0M\0%s\0' "$tab_path" "$newline_path"
        return 0
      fi
    done
    return 1
  }
  mapfile -d '' -t fields < <(doc_sync_print_git_change_records "$TMP_ROOT/synthetic-repo" cached)
  unset -f git

  if [ "${#fields[@]}" -lt 4 ]; then
    fail "Bash Git records are not NUL-safe"
  fi

  while [ "$index" -lt "${#fields[@]}" ]; do
    status="${fields[$index]}"
    index=$((index + 1))
    case "$status" in
      R*|C*)
        old_path="${fields[$index]}"
        index=$((index + 1))
        path="${fields[$index]}"
        index=$((index + 1))
        seen["$old_path"]="$status"
        seen["$path"]="$status"
        ;;
      *)
        path="${fields[$index]}"
        index=$((index + 1))
        seen["$path"]="$status"
        ;;
    esac
  done

  [ "${seen[$tab_path]:-}" = "M" ] || fail "Bash Git records did not preserve the tab path"
  [ "${seen[$newline_path]:-}" = "M" ] || fail "Bash Git records did not preserve the newline path"

  if [ -n "$POWERSHELL_BIN" ]; then
    write_powershell_contract_test
    "$POWERSHELL_BIN" -NoProfile -ExecutionPolicy Bypass \
      -File "$(to_powershell_path "$TMP_ROOT/test-hook-path-classification.ps1")" \
      -SharedPath "$(to_powershell_path "$SOURCE_ROOT/codex-hooks/shared.ps1")"
  fi
}

test_bash_classification_contract
test_ascii_lowercase_uses_c_locale
test_special_git_paths_are_nul_safe

echo "hook path classification tests passed"
