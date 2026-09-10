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

$dirtyMarkerFile = Join-Path $root ".claude\.source-change-touched"
$currentPathRequiresReview = Test-RepoPathRequiresReview $relativePath
$currentPathRequiresT2Check = Test-RepoPathRequiresT2Check $relativePath

if ($currentPathRequiresReview) {
    $reviewStateFile = Join-Path $root ".claude\.needs-review"
    $snapshotFile = Join-Path $root ".claude\.review-snapshot"

    if (Test-Path -LiteralPath $snapshotFile) {
        Remove-Item -LiteralPath $snapshotFile -Force -ErrorAction SilentlyContinue
    }

    Write-StateValue -Path $dirtyMarkerFile -Value "dirty"
    Write-StateValue -Path $reviewStateFile -Value "needs_review"
}

$t2CheckStateFile = Join-Path $root ".claude\.needs-t2-check"
$t2CheckSnapshotFile = Join-Path $root ".claude\.t2-check-snapshot"
$t2CheckEvidenceFile = Join-Path $root ".claude\.t2-check-evidence.json"
if ($currentPathRequiresT2Check) {
    Remove-Item -LiteralPath $t2CheckSnapshotFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $t2CheckEvidenceFile -Force -ErrorAction SilentlyContinue
    Write-StateValue -Path $dirtyMarkerFile -Value "dirty"
    Write-StateValue -Path $t2CheckStateFile -Value "needs_t2_check"
}

$docSyncStateFile = Join-Path $root ".claude\.needs-doc-sync"
$requiresDocSync = Test-RepoPathRequiresDocSync $relativePath
$isDocPath = Test-DocRepoPath $relativePath

if ($requiresDocSync -or $currentPathRequiresReview) {
    Write-StateValue -Path $dirtyMarkerFile -Value "dirty"
    Write-StateValue -Path $docSyncStateFile -Value "needs_doc_sync"
}
elseif ($isDocPath -and (Test-Path -LiteralPath $dirtyMarkerFile) -and (Test-Path -LiteralPath $docSyncStateFile)) {
    Write-StateValue -Path $docSyncStateFile -Value "needs_doc_sync"
}

exit 0
