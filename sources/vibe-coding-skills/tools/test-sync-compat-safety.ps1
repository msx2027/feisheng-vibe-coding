[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function New-FixtureRepo {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$SyncScript
    )

    New-Item -ItemType Directory -Path (Join-Path $Root "tools") -Force | Out-Null
    Copy-Item -LiteralPath $SyncScript -Destination (Join-Path $Root "tools/sync-compat.ps1") -Force

    Write-Utf8File -Path (Join-Path $Root "skills/demo/SKILL.md") -Content "---`nname: demo`ndescription: fixture`n---`n"
    Write-Utf8File -Path (Join-Path $Root "agents/INDEX.md") -Content "# Agent index`n"
    Write-Utf8File -Path (Join-Path $Root "agents/reviewer.md") -Content "---`nname: reviewer`ndescription: fixture reviewer`n---`n`nReview safely.`n"
    Write-Utf8File -Path (Join-Path $Root "hooks/example.sh") -Content "#!/usr/bin/env bash`n"
    Write-Utf8File -Path (Join-Path $Root "feedback/templates/example.md") -Content "fixture`n"
    Write-Utf8File -Path (Join-Path $Root "codex-hooks/example.ps1") -Content "exit 0`n"
    Write-Utf8File -Path (Join-Path $Root "EVOLUTION.md") -Content "# Evolution`n"
    Write-Utf8File -Path (Join-Path $Root "settings.json") -Content "{}`n"
    Write-Utf8File -Path (Join-Path $Root "codex-hooks.json") -Content "{}`n"
}

function Write-FakePythonCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string]$Marker
    )

    New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    $escapedMarker = $Marker.Replace("%", "%%")
    Write-Utf8File -Path (Join-Path $Directory "python.cmd") -Content "@echo off`r`n> `"$escapedMarker`" echo fake-python-ran`r`nexit /b 0`r`n"
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$sourceScript = Join-Path $repoRoot "tools/sync-compat.ps1"
$tmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("sync-compat-safety-" + [guid]::NewGuid().ToString("N"))

try {
    $normalRoot = Join-Path $tmpRoot "normal"
    New-FixtureRepo -Root $normalRoot -SyncScript $sourceScript
    Write-Utf8File -Path (Join-Path $normalRoot ".agents/skills/stale.txt") -Content "must be removed"
    & (Join-Path $normalRoot "tools/sync-compat.ps1") | Out-Null
    if (Test-Path -LiteralPath (Join-Path $normalRoot ".agents/skills/stale.txt")) {
        throw "sync-compat must remove stale runtime mirror files"
    }
    if (Test-Path -LiteralPath (Join-Path $normalRoot ".claude/agents/INDEX.md")) {
        throw "agents/INDEX.md must not be copied into .claude/agents"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $normalRoot ".codex/agents/reviewer.toml"))) {
        throw "Codex agent TOML was not generated"
    }

    $deepPathRoot = Join-Path $tmpRoot ("deep-" + ("x" * 110))
    New-FixtureRepo -Root $deepPathRoot -SyncScript $sourceScript
    & (Join-Path $deepPathRoot "tools/sync-compat.ps1") | Out-Null
    if (-not (Test-Path -LiteralPath (Join-Path $deepPathRoot ".agents/skills/demo/SKILL.md"))) {
        throw "sync-compat must support a valid repository path near the Windows legacy path limit"
    }

    $hardlinkRoot = Join-Path $tmpRoot "hardlink-target"
    New-FixtureRepo -Root $hardlinkRoot -SyncScript $sourceScript
    New-Item -ItemType Directory -Path (Join-Path $hardlinkRoot ".claude") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $hardlinkRoot ".agents/skills/demo") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $hardlinkRoot ".codex/agents") -Force | Out-Null
    $outsideSettings = Join-Path $tmpRoot "outside-settings.json"
    $outsideSkill = Join-Path $tmpRoot "outside-skill.md"
    $outsideAgent = Join-Path $tmpRoot "outside-agent.toml"
    Write-Utf8File -Path $outsideSettings -Content "{`"outside`":true}`n"
    Write-Utf8File -Path $outsideSkill -Content "outside skill must survive`n"
    Write-Utf8File -Path $outsideAgent -Content "outside agent must survive`n"
    New-Item -ItemType HardLink -Path (Join-Path $hardlinkRoot ".claude/settings.json") -Target $outsideSettings | Out-Null
    New-Item -ItemType HardLink -Path (Join-Path $hardlinkRoot ".agents/skills/demo/SKILL.md") -Target $outsideSkill | Out-Null
    New-Item -ItemType HardLink -Path (Join-Path $hardlinkRoot ".codex/agents/reviewer.toml") -Target $outsideAgent | Out-Null
    & (Join-Path $hardlinkRoot "tools/sync-compat.ps1") | Out-Null
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $outsideSettings) -ne "{`"outside`":true}`n") {
        throw "sync-compat modified an outside file through a hard-linked mirror target"
    }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $hardlinkRoot ".claude/settings.json")) -ne "{}`n") {
        throw "sync-compat did not refresh the hard-linked mirror target safely"
    }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $outsideSkill) -ne "outside skill must survive`n") {
        throw "sync-compat modified an outside file through a hard-linked directory mirror target"
    }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $hardlinkRoot ".agents/skills/demo/SKILL.md")) -ne
        (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $hardlinkRoot "skills/demo/SKILL.md"))) {
        throw "sync-compat did not refresh a hard-linked directory mirror target safely"
    }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $outsideAgent) -ne "outside agent must survive`n") {
        throw "sync-compat modified an outside file through a hard-linked generated agent target"
    }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $hardlinkRoot ".codex/agents/reviewer.toml")) -ne
        (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $normalRoot ".codex/agents/reviewer.toml"))) {
        throw "sync-compat did not refresh a hard-linked generated agent target safely"
    }

    $fakePythonRoot = Join-Path $tmpRoot "fake-python-local"
    New-FixtureRepo -Root $fakePythonRoot -SyncScript $sourceScript
    $localMarker = Join-Path $fakePythonRoot "fake-python-ran.txt"
    $localFakeBin = Join-Path $fakePythonRoot "fake-bin"
    Write-FakePythonCommand -Directory $localFakeBin -Marker $localMarker
    $originalPath = $env:PATH
    try {
        $env:PATH = "$localFakeBin$([System.IO.Path]::PathSeparator)$originalPath"
        & (Join-Path $fakePythonRoot "tools/sync-compat.ps1") | Out-Null
    }
    finally {
        $env:PATH = $originalPath
    }
    if (Test-Path -LiteralPath $localMarker) {
        throw "sync-compat executed a repository-local fake Python from PATH"
    }

    $fakePythonJunctionRoot = Join-Path $tmpRoot "fake-python-junction"
    New-FixtureRepo -Root $fakePythonJunctionRoot -SyncScript $sourceScript
    $junctionMarker = Join-Path $fakePythonJunctionRoot "fake-python-junction-ran.txt"
    $outsideFakeBin = Join-Path $tmpRoot "outside-fake-python"
    Write-FakePythonCommand -Directory $outsideFakeBin -Marker $junctionMarker
    $junctionFakeBin = Join-Path $fakePythonJunctionRoot "fake-bin"
    New-Item -ItemType Junction -Path $junctionFakeBin -Target $outsideFakeBin | Out-Null
    $originalPath = $env:PATH
    try {
        $env:PATH = "$junctionFakeBin$([System.IO.Path]::PathSeparator)$originalPath"
        & (Join-Path $fakePythonJunctionRoot "tools/sync-compat.ps1") | Out-Null
    }
    finally {
        $env:PATH = $originalPath
    }
    if (Test-Path -LiteralPath $junctionMarker) {
        throw "sync-compat executed Python through a repository-local PATH junction"
    }

    $junctionRoot = Join-Path $tmpRoot "junction"
    New-FixtureRepo -Root $junctionRoot -SyncScript $sourceScript
    $outside = Join-Path $tmpRoot "outside"
    New-Item -ItemType Directory -Path $outside -Force | Out-Null
    Write-Utf8File -Path (Join-Path $outside "outside-marker.txt") -Content "must survive`n"
    New-Item -ItemType Directory -Path (Join-Path $junctionRoot ".agents") -Force | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $junctionRoot ".agents/skills") -Target $outside | Out-Null

    $failedSafely = $false
    try {
        & (Join-Path $junctionRoot "tools/sync-compat.ps1") | Out-Null
    }
    catch {
        $failedSafely = $true
    }
    if (-not $failedSafely) {
        throw "sync-compat must reject reparse-point targets"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $outside "outside-marker.txt"))) {
        throw "sync-compat modified data outside the fixture repo through a junction"
    }

    $syncSource = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceScript
    if ($syncSource -match 'Remove-Item[^\r\n]*-ErrorAction\s+SilentlyContinue') {
        throw "sync-compat must not suppress stale mirror deletion failures"
    }

    Write-Host "sync-compat safety tests passed"
}
finally {
    if (Test-Path -LiteralPath $tmpRoot) {
        Remove-Item -LiteralPath $tmpRoot -Recurse -Force
    }
}
