[CmdletBinding()]
param([string]$HookInput = "")

. (Join-Path $PSScriptRoot "shared.ps1")

$inputObject = Read-HookInputObject $HookInput
$cwd = [string](Get-HookValue -Object $inputObject -Path @("cwd"))
$root = Get-RepoRoot $cwd

if ([string]::IsNullOrWhiteSpace($root)) {
    exit 0
}

$feedbackIndex = Join-Path $root ".claude\feedback\FEEDBACK-INDEX.md"
if (-not (Test-Path -LiteralPath $feedbackIndex)) {
    exit 0
}

$count = 0
foreach ($line in Get-Content -LiteralPath $feedbackIndex -Encoding UTF8) {
    if ($line -match '^- \[') {
        $count++
    }
}

if ($count -gt 0) {
    Write-Output ("Project has {0} feedback record(s). Run evolution-engine if rule upgrades need review." -f $count)
}

exit 0
