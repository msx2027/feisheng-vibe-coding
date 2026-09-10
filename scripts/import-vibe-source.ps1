param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot
)

$ErrorActionPreference = 'Stop'
$snapshotRoot = Join-Path $TargetRoot 'sources/vibe-coding-skills'
if (Test-Path -LiteralPath $snapshotRoot) {
    throw "Target snapshot already exists: $snapshotRoot"
}

New-Item -ItemType Directory -Path $snapshotRoot | Out-Null

$directoryPaths = @(
    'skills',
    'agents',
    'hooks',
    'codex-hooks',
    'feedback',
    'tools',
    'docs/legal',
    '.claude/feedback',
    '.claude/hooks'
)

$filePaths = @(
    'AGENTS.md',
    'README.md',
    'CLAUDE.md',
    'package.json',
    'settings.json',
    'codex-hooks.json',
    '.claude/CLAUDE.md',
    '.claude/settings.json'
)

foreach ($relativePath in $directoryPaths) {
    $sourcePath = Join-Path $SourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
        throw "Missing source directory: $sourcePath"
    }
    $destinationPath = Join-Path $snapshotRoot $relativePath
    $destinationParent = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationParent -Recurse
}

# 这两个文件属于旧的生成投影，不是源码；复制目录后必须显式剔除。
$generatedPaths = @(
    (Join-Path $snapshotRoot 'skills/ROUTING-MANIFEST.json')
)
foreach ($generatedPath in $generatedPaths) {
    if (Test-Path -LiteralPath $generatedPath -PathType Leaf) {
        Remove-Item -LiteralPath $generatedPath -Force
    }
}

foreach ($relativePath in $filePaths) {
    $sourcePath = Join-Path $SourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Missing source file: $sourcePath"
    }
    $destinationPath = Join-Path $snapshotRoot $relativePath
    $destinationParent = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

$hasGit = Test-Path -LiteralPath (Join-Path $SourceRoot '.git') -PathType Container
$revision = $null
$status = @()
if ($hasGit) {
    $revision = (& git -C $SourceRoot rev-parse HEAD 2>$null).Trim()
    $status = @(& git -C $SourceRoot status --short 2>$null)
}
$snapshotFiles = @(Get-ChildItem -LiteralPath $snapshotRoot -Recurse -File)
$record = [ordered]@{
    schema = 'feisheng-import-record/v1'
    source = 'vibe-coding-skills'
    sourceRoot = $SourceRoot
    sourceRevision = if ([string]::IsNullOrWhiteSpace($revision)) { $null } else { $revision }
    sourceWorkingTree = if (-not $hasGit) { 'not-a-git-checkout' } elseif ($status.Count -eq 0) { 'clean' } else { 'modified' }
    snapshotRoot = 'sources/vibe-coding-skills'
    snapshotFiles = $snapshotFiles.Count
    excluded = @('.agents', '.claude/skills', '.claude/agents', '.codex', 'MANIFEST.json', 'skills/ROUTING-MANIFEST.json')
    migration = 'source-snapshot-only; runtime-not-enabled'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$recordPath = Join-Path $TargetRoot 'provenance/VIBE-IMPORT.json'
$recordParent = Split-Path -Parent $recordPath
New-Item -ItemType Directory -Force -Path $recordParent | Out-Null
$record | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $recordPath
Write-Output "Imported Vibe source snapshot with $($snapshotFiles.Count) files."
