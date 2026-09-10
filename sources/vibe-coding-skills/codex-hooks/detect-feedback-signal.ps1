[CmdletBinding()]
param([string]$HookInput = "")

# vibe-coding-skills:managed-target-experience-signal-hook

$candidateRoots = if ([string]::IsNullOrWhiteSpace($env:VIBE_CODING_SKILLS_HOME)) {
        @(
            (Split-Path -Parent $PSScriptRoot),
        (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
        )
}
else {
    @($env:VIBE_CODING_SKILLS_HOME)
}
$root = $candidateRoots |
    Where-Object {
        (Test-Path -LiteralPath (Join-Path $_ "tools\detect-experience-signal.mjs") -PathType Leaf) -and
        (Test-Path -LiteralPath (Join-Path $_ "codex-hooks\shared.ps1") -PathType Leaf)
    } |
    Select-Object -First 1
if ([string]::IsNullOrWhiteSpace($root)) {
    [Console]::Error.WriteLine("experience signal runtime root is unavailable")
    exit 2
}
. (Join-Path $root "codex-hooks\shared.ps1")

$signalTool = Join-Path $root "tools\detect-experience-signal.mjs"
if (-not (Test-Path -LiteralPath $signalTool -PathType Leaf)) {
    [Console]::Error.WriteLine("experience signal tool missing: $signalTool")
    exit 2
}

$node = Get-Command node -All -CommandType Application -ErrorAction SilentlyContinue |
    Where-Object {
        Test-CodexHookTrustedApplicationPath -Path $_.Source -Root $root -ExpectedName "node.exe"
    } |
    Select-Object -First 1
if (-not $node) {
    [Console]::Error.WriteLine("trusted node.exe was not found")
    exit 2
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$global:OutputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$pipelinePayload = @($input | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
$payload = if (-not [string]::IsNullOrEmpty($HookInput)) {
    $HookInput
}
elseif (-not [string]::IsNullOrWhiteSpace($pipelinePayload)) {
    $pipelinePayload
}
else {
    [Console]::In.ReadToEnd()
}
$signalOutput = $payload | & $node.Source $signalTool --runtime codex
$signalExitCode = $LASTEXITCODE
if ($null -ne $signalOutput) {
    [Console]::Out.WriteLine(($signalOutput -join [Environment]::NewLine))
}
if ($signalExitCode -ne 0) {
    exit $signalExitCode
}
return
