[CmdletBinding()]
param([string]$HookInput = "")

. (Join-Path $PSScriptRoot "shared.ps1")

$inputObject = Read-HookInputObject $HookInput
$cwd = [string](Get-HookValue -Object $inputObject -Path @("cwd"))
$root = Get-RepoRoot $cwd

if ([string]::IsNullOrWhiteSpace($root)) {
    exit 0
}

$reviewStateFile = Join-Path $root ".claude\.needs-review"
$docSyncStateFile = Join-Path $root ".claude\.needs-doc-sync"
$reviewSnapshotFile = Join-Path $root ".claude\.review-snapshot"
$t2CheckStateFile = Join-Path $root ".claude\.needs-t2-check"
$t2CheckSnapshotFile = Join-Path $root ".claude\.t2-check-snapshot"
$t2CheckEvidenceFile = Join-Path $root ".claude\.t2-check-evidence.json"
$dirtyMarkerFile = Join-Path $root ".claude\.source-change-touched"

$reviewState = Read-StateValue $reviewStateFile
$docSyncState = Read-StateValue $docSyncStateFile
$t2CheckState = Read-StateValue $t2CheckStateFile
$git = Get-TrustedGitCommand -Root $root
$canRecomputeChanges = $false
if ($git) {
    Invoke-CodexHookTrustedGit -Git $git -Root $root -GitArgs @("rev-parse", "--git-dir") *> $null
    $canRecomputeChanges = $LASTEXITCODE -eq 0
}

if (-not $canRecomputeChanges) {
    if ($reviewState -eq "needs_review") {
        Write-Output '{"decision":"block","reason":"review state is needs_review, but current changes could not be recomputed. Run code-review and refresh review state before stopping."}'
        exit 0
    }

    if ($docSyncState -eq "needs_doc_sync") {
        Write-Output '{"decision":"block","reason":"doc-sync state is needs_doc_sync, but current changes could not be recomputed. Run doc-sync-guardian or clear the state after verifying docs."}'
        exit 0
    }

    if ($t2CheckState -eq "needs_t2_check") {
        Write-Output '{"decision":"block","reason":"T2 check state is needs_t2_check, but current changes could not be recomputed. Run targeted validation and refresh the T2 check state before stopping."}'
        exit 0
    }

    exit 0
}

$cachedEnumeration = Get-GitChangeEnumerationResult -Root $root -Scope "cached"
$unstagedEnumeration = Get-GitChangeEnumerationResult -Root $root -Scope "unstaged"
$untrackedEnumeration = Get-GitChangeEnumerationResult -Root $root -Scope "untracked"
if (-not ($cachedEnumeration.Succeeded -and $unstagedEnumeration.Succeeded -and $untrackedEnumeration.Succeeded)) {
    Write-Output '{"decision":"block","reason":"Current changes could not be recomputed because trusted Git change enumeration failed. Resolve Git and rerun the required checks before stopping."}'
    exit 0
}

$stagedStrictRequired = @($cachedEnumeration.Records | Where-Object { Test-StagedRecordRequiresStrictReview -Root $root -Record $_ }).Count -gt 0
$unstagedStrictRequired = (@($unstagedEnumeration.Records | Where-Object { Test-WorktreeRecordRequiresStrictReview -Root $root -Record $_ }).Count -gt 0) -or (@($untrackedEnumeration.Records | Where-Object { Test-UntrackedRecordRequiresStrictReview -Root $root -Record $_ }).Count -gt 0)
$stagedT2CheckRequired = @($cachedEnumeration.Records | Where-Object { Test-StagedRecordRequiresT2Check -Root $root -Record $_ }).Count -gt 0
$unstagedT2CheckRequired = (@($unstagedEnumeration.Records | Where-Object { Test-WorktreeRecordRequiresT2Check -Root $root -Record $_ }).Count -gt 0) -or (@($untrackedEnumeration.Records | Where-Object { Test-UntrackedRecordRequiresT2Check -Root $root -Record $_ }).Count -gt 0)
$currentSourceRequired = $stagedStrictRequired -or $unstagedStrictRequired -or $stagedT2CheckRequired -or $unstagedT2CheckRequired

if (($stagedStrictRequired -or $unstagedStrictRequired) -and $reviewState -ne "clean") {
    Write-Output '{"decision":"block","reason":"Current strict source changes require review. Run code-review, then tools/mark-review-clean.sh to refresh the staged source snapshot."}'
    exit 0
}

if ($stagedStrictRequired) {
    $storedSnapshotHash = Read-StateValue $reviewSnapshotFile
    $currentSnapshotHash = Get-StagedReviewSnapshotHash -Root $root

    if ([string]::IsNullOrWhiteSpace($storedSnapshotHash) -or
        [string]::IsNullOrWhiteSpace($currentSnapshotHash) -or
        $storedSnapshotHash -ne $currentSnapshotHash) {
        Write-Output '{"decision":"block","reason":".claude/.needs-review is clean, but the review snapshot is missing or stale. Re-run code-review and tools/mark-review-clean.sh."}'
        exit 0
    }
}

if ($unstagedStrictRequired) {
    Write-Output '{"decision":"block","reason":"Unstaged strict source changes cannot produce a stable review snapshot. Stage or close the changes, then complete review."}'
    exit 0
}

if ($unstagedT2CheckRequired) {
    Write-Output '{"decision":"block","reason":"Unstaged ordinary T2 source changes cannot produce a stable T2 check snapshot. Stage or close the changes, then run targeted validation and node tools/mark-t2-check-clean.mjs."}'
    exit 0
}

if ($stagedT2CheckRequired -and -not $stagedStrictRequired) {
    $storedT2SnapshotHash = Read-StateValue $t2CheckSnapshotFile
    $currentT2SnapshotHash = Get-StagedT2CheckSnapshotHash -Root $root

    if ($t2CheckState -ne "clean" -or
        [string]::IsNullOrWhiteSpace($storedT2SnapshotHash) -or
        [string]::IsNullOrWhiteSpace($currentT2SnapshotHash) -or
        $storedT2SnapshotHash -ne $currentT2SnapshotHash) {
        Write-Output '{"decision":"block","reason":"Current ordinary T2 staged source changes need a fresh T2 check. Run targeted validation, then node tools/mark-t2-check-clean.mjs . --evidence \"<validation command or note>\"."}'
        exit 0
    }
}

$allEnumerationRecords = @($cachedEnumeration.Records) + @($unstagedEnumeration.Records) + @($untrackedEnumeration.Records)
if ($allEnumerationRecords.Count -gt 0 -and (Test-StrictSourceRecordsHaveDocSyncCoverage -Root $root -Records $allEnumerationRecords)) {
    Write-Output '{"decision":"block","reason":"Current strict source changes are not covered by related docs. Run doc-sync-guardian or update the mapped docs before stopping."}'
    exit 0
}

if (-not $currentSourceRequired) {
    Remove-Item -LiteralPath $dirtyMarkerFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $reviewSnapshotFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $reviewStateFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $docSyncStateFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $t2CheckStateFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $t2CheckSnapshotFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $t2CheckEvidenceFile -Force -ErrorAction SilentlyContinue
}

exit 0
