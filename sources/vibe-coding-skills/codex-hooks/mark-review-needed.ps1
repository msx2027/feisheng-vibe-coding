[CmdletBinding()]
param([string]$HookInput = "")

. (Join-Path $PSScriptRoot "shared.ps1")

$inputObject = Read-HookInputObject $HookInput
$filePath = [string](Get-HookValue -Object $inputObject -Path @("tool_input", "file_path"))
$cwd = [string](Get-HookValue -Object $inputObject -Path @("cwd"))
$root = Get-RepoRoot $cwd

if ([string]::IsNullOrWhiteSpace($root) -or [string]::IsNullOrWhiteSpace($filePath)) {
    exit 0
}

$relativePath = Get-RelativeRepoPath -Root $root -Path $filePath
if ([string]::IsNullOrWhiteSpace($relativePath)) {
    exit 0
}

if (Test-RepoPathRequiresReview $relativePath) {
    $stateFile = Join-Path $root ".claude\.needs-review"
    $snapshotFile = Join-Path $root ".claude\.review-snapshot"
    $dirtyMarkerFile = Join-Path $root ".claude\.source-change-touched"

    if (Test-Path -LiteralPath $snapshotFile) {
        Remove-Item -LiteralPath $snapshotFile -Force -ErrorAction SilentlyContinue
    }

    Write-StateValue -Path $dirtyMarkerFile -Value "dirty"
    Write-StateValue -Path $stateFile -Value "needs_review"
}

exit 0
