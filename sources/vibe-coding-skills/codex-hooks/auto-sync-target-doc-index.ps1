# vibe-coding-skills:managed-target-doc-auto-sync-hook
[CmdletBinding()]
param([string]$HookInput = "")

$ErrorActionPreference = "Stop"
$payload = if ([string]::IsNullOrEmpty($HookInput)) { [Console]::In.ReadToEnd() } else { $HookInput }
if ([string]::IsNullOrWhiteSpace($payload)) { [Console]::Error.WriteLine("[target-doc-auto-sync] blocked: hook input is required"); exit 2 }

$candidateRoots = if ([string]::IsNullOrWhiteSpace($env:VIBE_CODING_SKILLS_HOME)) {
    @(
        (Split-Path -Parent $PSScriptRoot),
        (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    )
}
else {
    @($env:VIBE_CODING_SKILLS_HOME)
}
$tool = $candidateRoots |
    ForEach-Object { Join-Path $_ 'tools\auto-sync-target-doc-index.mjs' } |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($tool)) {
    [Console]::Error.WriteLine('[target-doc-auto-sync] blocked: runtime root is unavailable; set VIBE_CODING_SKILLS_HOME for installed target hooks')
    exit 2
}

$encodedPayload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payload))
& node $tool --hook-input-base64 $encodedPayload --json | Out-Null
exit $LASTEXITCODE
