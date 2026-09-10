[CmdletBinding()]
param(
    [string]$GlobalSkillsRoot = "",
    [switch]$Json
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Resolve-RepoRoot {
    $dir = Split-Path -Parent $PSScriptRoot
    while (-not [string]::IsNullOrWhiteSpace($dir)) {
        if ((Test-Path -LiteralPath (Join-Path $dir "AGENTS.md")) -and
            (Test-Path -LiteralPath (Join-Path $dir "tools"))) {
            return (Resolve-Path -LiteralPath $dir).Path
        }

        $parent = Split-Path -Parent $dir
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) {
            break
        }

        $dir = $parent
    }

    return (Resolve-Path -LiteralPath (Split-Path -Parent $PSScriptRoot)).Path
}

function Get-DefaultGlobalSkillsRoot {
    if (-not [string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        return (Join-Path $env:CODEX_HOME "skills")
    }

    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        return (Join-Path (Join-Path $env:USERPROFILE ".codex") "skills")
    }

    if (-not [string]::IsNullOrWhiteSpace($env:HOME)) {
        return (Join-Path (Join-Path $env:HOME ".codex") "skills")
    }

    return ""
}

function Get-SkillRoot {
    param([string]$RepoRoot)

    $runtimeRoot = Join-Path $RepoRoot ".agents\skills"
    if (Test-Path -LiteralPath $runtimeRoot -PathType Container) {
        return $runtimeRoot
    }

    return (Join-Path $RepoRoot "skills")
}

function Get-Sha256 {
    param([string]$Path)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.IO.File]::ReadAllBytes($Path)
        $hash = $sha.ComputeHash($bytes)
        return ([System.BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-LineCount {
    param([string]$Path)

    try {
        return @((Get-Content -LiteralPath $Path -Encoding UTF8)).Count
    }
    catch {
        return 0
    }
}

function Get-SkillMap {
    param([string]$Root)

    $map = @{}
    if ([string]::IsNullOrWhiteSpace($Root)) {
        return $map
    }

    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        return $map
    }

    foreach ($dir in Get-ChildItem -LiteralPath $Root -Directory) {
        if ($dir.Name -eq ".system") {
            continue
        }

        $skillFile = Join-Path $dir.FullName "SKILL.md"
        if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
            continue
        }

        $map[$dir.Name] = [pscustomobject]@{
            Name = $dir.Name
            Root = $dir.FullName
            SkillFile = $skillFile
            Hash = Get-Sha256 -Path $skillFile
            Lines = Get-LineCount -Path $skillFile
        }
    }

    return $map
}

$repoRoot = Resolve-RepoRoot
$projectSkillsRoot = Get-SkillRoot -RepoRoot $repoRoot
if ([string]::IsNullOrWhiteSpace($GlobalSkillsRoot)) {
    $GlobalSkillsRoot = Get-DefaultGlobalSkillsRoot
}

if (-not (Test-Path -LiteralPath $projectSkillsRoot -PathType Container)) {
    Write-Error "Project skills root not found: $projectSkillsRoot"
    exit 2
}

$projectSkills = Get-SkillMap -Root $projectSkillsRoot
$globalSkills = Get-SkillMap -Root $GlobalSkillsRoot
$overlaps = New-Object System.Collections.Generic.List[object]

foreach ($name in ($projectSkills.Keys | Sort-Object)) {
    if (-not $globalSkills.ContainsKey($name)) {
        continue
    }

    $project = $projectSkills[$name]
    $global = $globalSkills[$name]
    $overlaps.Add([pscustomobject]@{
        Name = $name
        SameHash = ($project.Hash -eq $global.Hash)
        ProjectHash = $project.Hash
        GlobalHash = $global.Hash
        ProjectLines = $project.Lines
        GlobalLines = $global.Lines
        ProjectFile = $project.SkillFile
        GlobalFile = $global.SkillFile
    })
}

$overlapItems = @($overlaps.ToArray())
$differentHashCount = 0
foreach ($item in $overlapItems) {
    if (-not $item.SameHash) {
        $differentHashCount++
    }
}

$summary = [pscustomobject]@{
    ProjectSkillsRoot = $projectSkillsRoot
    GlobalSkillsRoot = $GlobalSkillsRoot
    ProjectSkillCount = $projectSkills.Count
    GlobalSkillCount = $globalSkills.Count
    OverlapCount = $overlapItems.Count
    DifferentHashCount = $differentHashCount
    ReadOnly = $true
}

if ($Json) {
    [pscustomobject]@{
        Summary = $summary
        Overlaps = $overlapItems
    } | ConvertTo-Json -Depth 5
    exit 0
}

Write-Output "Global skill overlap diagnostic (read-only)"
Write-Output ""
$summary | Format-List

if ($overlapItems.Count -eq 0) {
    Write-Output "No overlapping skill names found."
    exit 0
}

$overlapItems |
    Select-Object Name, SameHash, ProjectLines, GlobalLines, ProjectHash, GlobalHash |
    Format-Table -AutoSize

exit 0
