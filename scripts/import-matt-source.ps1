param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot
)

$ErrorActionPreference = 'Stop'
$snapshotRoot = Join-Path $TargetRoot 'sources/mattpocock-skills'
if (Test-Path -LiteralPath $snapshotRoot) {
    throw "Target snapshot already exists: $snapshotRoot"
}

New-Item -ItemType Directory -Force -Path $snapshotRoot | Out-Null

$directoryPaths = @('skills', 'docs', '.claude-plugin')
$filePaths = @('AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'README.md', 'LICENSE', 'LICENSE.zh-CN.md')
$excluded = @(
    'skills/engineering/ask-matt/SKILL.md',
    'skills/engineering/code-review/SKILL.md',
    'skills/engineering/implement/SKILL.md',
    'skills/engineering/tdd/SKILL.md'
)

foreach ($relativePath in $directoryPaths) {
    $sourcePath = Join-Path $SourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
        throw "Missing source directory: $sourcePath"
    }
    $destinationParent = Split-Path -Parent (Join-Path $snapshotRoot $relativePath)
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationParent -Recurse
}

foreach ($relativePath in $filePaths) {
    $sourcePath = Join-Path $SourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Missing source file: $sourcePath"
    }
    $destinationPath = Join-Path $snapshotRoot $relativePath
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

foreach ($relativePath in $excluded) {
    $targetPath = Join-Path $snapshotRoot $relativePath
    if (Test-Path -LiteralPath $targetPath -PathType Leaf) {
        Remove-Item -LiteralPath $targetPath -Force
    }
}

$revision = (& git -C $SourceRoot rev-parse HEAD).Trim()
$status = @(& git -C $SourceRoot status --short)
$snapshotFiles = @(Get-ChildItem -LiteralPath $snapshotRoot -Recurse -File)
$recordPath = Join-Path $TargetRoot 'provenance/MATT-IMPORT.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $recordPath) | Out-Null
$record = [ordered]@{
    schema = 'feisheng-import-record/v1'
    source = 'mattpocock-skills'
    sourceRoot = $SourceRoot
    sourceRevision = $revision
    sourceWorkingTree = if ($status.Count -eq 0) { 'clean' } else { 'modified' }
    sourceStatusCount = $status.Count
    snapshotRoot = 'sources/mattpocock-skills'
    snapshotFiles = $snapshotFiles.Count
    excludedDirtyFiles = $excluded
    migration = 'source-snapshot-only; dirty-files-excluded; runtime-not-enabled'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$record | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $recordPath
Write-Output "Imported Matt clean snapshot with $($snapshotFiles.Count) files; excluded $($excluded.Count) dirty files."
