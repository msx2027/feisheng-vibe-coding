param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Matt 来源导入（唯一导入路径）。
#
# 快照策略：
#   - 目录与根文件按工作树复制（与已提交 HEAD 逐字节一致，未改动的文件）。
#   - 工作树已改动的文件（源作者未提交的改动）：**不采用工作树内容**（意图不可证），
#     改用**已提交 revision** 的 blob，并归一化到快照统一的换行约定。
#     依据：实测 `git blob + LF->CRLF == 源工作树`（抽样 6/6 逐字节相等）。
#   - canonical id 由本仓库决定，不依赖上游是否完成改名。

$integrityModule = Join-Path $PSScriptRoot 'provenance-integrity.ps1'
if (-not (Test-Path -LiteralPath $integrityModule -PathType Leaf)) {
    throw "缺少 provenance integrity 模块: $integrityModule"
}
. $integrityModule

$snapshotRoot = Join-Path $TargetRoot 'sources/mattpocock-skills'
if (Test-Path -LiteralPath $snapshotRoot) {
    throw "Target snapshot already exists: $snapshotRoot"
}

New-Item -ItemType Directory -Force -Path $snapshotRoot | Out-Null

$directoryPaths = @('skills', 'docs', '.claude-plugin')
$filePaths = @('AGENTS.md', 'CLAUDE.md', 'CONTEXT.md', 'README.md', 'LICENSE', 'LICENSE.zh-CN.md')

# 工作树有未提交改动、因此不采用工作树内容的文件
$dirtyInWorkingTree = @(
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

$revision = (& git -C $SourceRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($revision)) {
    throw "无法读取来源 revision: $SourceRoot"
}

# 用已提交 blob 覆盖工作树已改动的文件（而不是丢弃它们）
$committedRevisionFiles = @()
foreach ($relativePath in $dirtyInWorkingTree) {
    $targetPath = Join-Path $snapshotRoot $relativePath
    $exported = Export-GitBlobToFile -SourceRoot $SourceRoot -Revision $revision -RelativePath $relativePath -DestinationPath $targetPath -NormalizeCrlf
    $committedRevisionFiles += [ordered]@{
        path = $relativePath
        revision = $revision
        blobSha256 = $exported.blobSha256
        snapshotSha256 = $exported.sha256
        normalization = $exported.normalization
    }
}

$status = @(& git -C $SourceRoot status --short)
$snapshotFiles = @(Get-ChildItem -LiteralPath $snapshotRoot -Recurse -File)
$recordPath = Join-Path $TargetRoot 'provenance/MATT-IMPORT.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $recordPath) | Out-Null
$record = [ordered]@{
    schema = 'feisheng-import-record/v2'
    source = 'mattpocock-skills'
    sourceRoot = $SourceRoot
    sourceRevision = $revision
    sourceWorkingTree = if ($status.Count -eq 0) { 'clean' } else { 'modified' }
    sourceStatusCount = $status.Count
    snapshotRoot = 'sources/mattpocock-skills'
    snapshotFiles = $snapshotFiles.Count
    excludedDirtyFiles = $dirtyInWorkingTree
    committedRevisionFiles = $committedRevisionFiles
    canonicalNamingPolicy = 'canonical ids are decided by this repository; upstream uncommitted renames are recorded, not adopted'
    migration = 'source-snapshot-only; dirty-working-tree-content-not-adopted; committed-revision-content-used; runtime-not-enabled'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$record | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $recordPath
Write-Output "Imported Matt snapshot with $($snapshotFiles.Count) files; $($committedRevisionFiles.Count) files taken from committed revision $revision (working tree dirty)."
