[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hook,
    [string]$HookInput = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$allowedHooks = @(
    "check-evolution",
    "detect-feedback-signal",
    "check-routing-session",
    "mark-doc-sync-needed",
    "mark-review-needed",
    "mark-source-change-needed",
    "pre-commit-check",
    "stop-gate"
)

if ($Hook -notin $allowedHooks) {
    [Console]::Error.WriteLine("Unknown or disallowed hook: $Hook")
    exit 2
}

$hookPayload = if ([string]::IsNullOrEmpty($HookInput)) {
    [Console]::In.ReadToEnd()
}
else {
    $HookInput
}

$target = Join-Path $PSScriptRoot ("{0}.ps1" -f $Hook)

if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    [Console]::Error.WriteLine("Configured hook implementation was not found: $Hook")
    exit 2
}

& $target -HookInput $hookPayload
exit $LASTEXITCODE
