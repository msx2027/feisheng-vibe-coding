[CmdletBinding()]
param([string]$HookInput = "")

. (Join-Path $PSScriptRoot "shared.ps1")

$inputObject = Read-HookInputObject $HookInput
$command = [string](Get-HookValue -Object $inputObject -Path @("tool_input", "command"))
$cwd = [string](Get-HookValue -Object $inputObject -Path @("cwd"))

$gitCommitPattern = '(?:^|[;&|()]+\s*)(?:[A-Za-z_]\w*=\S+\s+)*(?:command\s+)?git\b[^;&|()]*\bcommit(?:\s|$)'
if ($command -notmatch $gitCommitPattern) {
    exit 0
}

$root = Get-RepoRoot $cwd
if ([string]::IsNullOrWhiteSpace($root)) {
    exit 0
}

function Get-UsableBashPath {
    param([string]$Root)

    $candidate = Get-TrustedGitBashPath -Root $Root
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        & $candidate -lc "exit 0" *> $null
        if ($LASTEXITCODE -eq 0) {
            return $candidate
        }
    }

    return ""
}

$bashPath = Get-UsableBashPath -Root $root
$gate = Join-Path $root "tools\pre-commit-gate.sh"

if (-not [string]::IsNullOrWhiteSpace($bashPath) -and (Test-Path -LiteralPath $gate)) {
    $previousVibeGateBash = $env:VIBE_GATE_BASH
    $previousDdzjGateShell = $env:DDZJ_GATE_SHELL
    try {
        $env:VIBE_GATE_BASH = $bashPath
        $env:DDZJ_GATE_SHELL = $bashPath
        & $bashPath $gate $root
        exit $LASTEXITCODE
    }
    finally {
        $env:VIBE_GATE_BASH = $previousVibeGateBash
        $env:DDZJ_GATE_SHELL = $previousDdzjGateShell
    }
}

$reviewState = Read-StateValue (Join-Path $root ".claude\.needs-review")
$snapshotState = Read-StateValue (Join-Path $root ".claude\.review-snapshot")
$t2CheckState = Read-StateValue (Join-Path $root ".claude\.needs-t2-check")
$t2CheckSnapshotState = Read-StateValue (Join-Path $root ".claude\.t2-check-snapshot")
$strictReviewRequired = @(Get-CurrentStrictSourceChangeRecords -Root $root -Scope "cached").Count -gt 0
$t2CheckRequired = @(Get-CurrentT2LightChangeRecords -Root $root -Scope "cached").Count -gt 0

if ($strictReviewRequired -and $reviewState -ne "clean") {
    [Console]::Error.WriteLine("Staged strict source changes require review. Run code-review, then tools/mark-review-clean.sh after approval.")
    exit 2
}

if ($strictReviewRequired) {
    $currentSnapshot = Get-StagedReviewSnapshotHash -Root $root
    if ([string]::IsNullOrWhiteSpace($snapshotState) -or
        [string]::IsNullOrWhiteSpace($currentSnapshot) -or
        $snapshotState -ne $currentSnapshot) {
        [Console]::Error.WriteLine("Staged strict source changes require a current review snapshot. Re-run code-review and tools/mark-review-clean.sh.")
        exit 2
    }
}

if ($t2CheckRequired -and -not $strictReviewRequired) {
    if ($t2CheckState -ne "clean") {
        [Console]::Error.WriteLine("Staged ordinary T2 source changes require targeted validation. Run node tools/mark-t2-check-clean.mjs . --evidence ""<validation command or note>"".")
        exit 2
    }

    $currentT2Snapshot = Get-StagedT2CheckSnapshotHash -Root $root
    if ([string]::IsNullOrWhiteSpace($t2CheckSnapshotState) -or
        [string]::IsNullOrWhiteSpace($currentT2Snapshot) -or
        $t2CheckSnapshotState -ne $currentT2Snapshot) {
        [Console]::Error.WriteLine("Staged ordinary T2 source changes require a current T2 check snapshot. Re-run targeted validation and node tools/mark-t2-check-clean.mjs.")
        exit 2
    }
}

if (Test-CurrentDocSyncHasUncoveredStrictSources -Root $root -Scope "cached") {
    [Console]::Error.WriteLine("Staged strict source changes require related doc sync. Run doc-sync-guardian or update the mapped docs.")
    exit 2
}

exit 0
