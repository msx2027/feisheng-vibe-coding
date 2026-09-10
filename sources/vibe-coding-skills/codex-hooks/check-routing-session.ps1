[CmdletBinding()]
param([string]$HookInput = "")

$ErrorActionPreference = "Stop"
$candidateRoots = if ($env:VIBE_CODING_SKILLS_HOME) {
    @($env:VIBE_CODING_SKILLS_HOME)
} else {
    @((Split-Path -Parent $PSScriptRoot), (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
}
$root = $candidateRoots | Where-Object { Test-Path -LiteralPath (Join-Path $_ "tools\routing-session-gate.mjs") -PathType Leaf } | Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($root)) {
    [Console]::Error.WriteLine("routing session gate runtime root is unavailable")
    exit 2
}
$tool = Join-Path $root "tools\routing-session-gate.mjs"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$global:OutputEncoding = $utf8NoBom
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$payload = if (-not [string]::IsNullOrEmpty($HookInput)) { $HookInput } else { [Console]::In.ReadToEnd() }
$shared = Join-Path $root "codex-hooks\shared.ps1"
if (-not (Test-Path -LiteralPath $shared -PathType Leaf)) {
    [Console]::Error.WriteLine("codex hook shared runtime is unavailable")
    exit 2
}
. $shared
$node = Get-Command node -All -CommandType Application -ErrorAction SilentlyContinue |
    Where-Object {
        Test-CodexHookTrustedApplicationPath -Path $_.Source -Root $root -ExpectedName "node.exe"
    } |
    Select-Object -First 1
if (-not $node) {
    [Console]::Error.WriteLine("trusted node.exe was not found")
    exit 2
}
$output = $payload | & $node.Source $tool --hook --runtime codex
if ($null -ne $output) { [Console]::Out.WriteLine(($output -join [Environment]::NewLine)) }
exit $LASTEXITCODE
