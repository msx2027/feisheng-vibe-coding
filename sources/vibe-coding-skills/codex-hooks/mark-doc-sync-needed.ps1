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

$stateFile = Join-Path $root ".claude\.needs-doc-sync"
$dirtyMarkerFile = Join-Path $root ".claude\.source-change-touched"
$requiresDocSync = Test-RepoPathRequiresDocSync $relativePath
$isDocPath = Test-DocRepoPath $relativePath

if ($requiresDocSync) {
    Write-StateValue -Path $dirtyMarkerFile -Value "dirty"
    Write-StateValue -Path $stateFile -Value "needs_doc_sync"
}
elseif ($isDocPath -and (Test-Path -LiteralPath $dirtyMarkerFile) -and (Test-Path -LiteralPath $stateFile)) {
    Write-StateValue -Path $stateFile -Value "needs_doc_sync"
}

exit 0
