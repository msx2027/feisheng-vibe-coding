[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 记录来源快照完整性基线（写入 provenance/PROVENANCE-INTEGRITY.json）。
#
# 这是唯一的「锁定基线」入口，且 **fail-closed**：只有在
#   1) 快照每个文件都与来源同路径文件逐字节一致（或在记录的 supplementAllowlist 内），
#   2) 来源 git 状态与导入记录一致（HEAD == sourceRevision；脏文件集合 == 记录），
#   3) 快照文件集合与导入记录一致（Vibe 有逐文件白名单）
# 全部满足时才写基线。理由：基线必须被**独立证据**（来源比对）背书，不能把现状直接当成真源。
#
# 快照清单来自已有导入记录（VIBE-IMPORT / MATT-IMPORT / SLIVER-IMPORT），不新增分类真源。

$guardModule = Join-Path $PSScriptRoot 'provenance-integrity.ps1'
if (-not (Test-Path -LiteralPath $guardModule -PathType Leaf)) {
    throw "缺少 provenance integrity 模块: $guardModule"
}
. $guardModule

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

# 快照清单：从导入记录派生（pathProperty 指记录里保存快照路径的字段）
$importSpecs = @(
    [pscustomobject]@{ record = 'provenance/VIBE-IMPORT.json'; pathProperty = 'snapshotRoot'; allowProperty = $null; name = 'vibe-coding-skills' },
    [pscustomobject]@{ record = 'provenance/MATT-IMPORT.json'; pathProperty = 'snapshotRoot'; allowProperty = $null; name = 'mattpocock-skills' },
    [pscustomobject]@{ record = 'provenance/SLIVER-IMPORT.json'; pathProperty = 'importedRoot'; allowProperty = 'supplementedPaths'; name = 'sliver-core' }
)

$snapshotEntries = @()
$errors = @()
$totalChecked = 0
$totalAllowlisted = 0

foreach ($spec in $importSpecs) {
    $recordPath = Join-Path $repoRoot $spec.record
    if (-not (Test-Path -LiteralPath $recordPath -PathType Leaf)) {
        $errors += ("缺少导入记录: " + $spec.record)
        continue
    }
    $importRecord = Get-Content -Raw -Encoding UTF8 -LiteralPath $recordPath | ConvertFrom-Json
    $snapshotRelative = ([string]$importRecord.$($spec.pathProperty)).Replace('\', '/')
    $sourceRoot = [string]$importRecord.sourceRoot
    if ([string]::IsNullOrWhiteSpace($snapshotRelative)) {
        $errors += ("导入记录缺少快照路径: " + $spec.record)
        continue
    }

    $allowlist = @()
    if (-not [string]::IsNullOrWhiteSpace([string]$spec.allowProperty)) {
        $allowlist = @($importRecord.$($spec.allowProperty))
    }

    $snapshotRoot = Join-Path $repoRoot ($snapshotRelative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    $records = @(Get-SnapshotFileRecords -Root $snapshotRoot)
    $treeHash = Get-SnapshotTreeHash -Records $records

    # 来源必须可用（基线需要独立背书）
    if ([string]::IsNullOrWhiteSpace($sourceRoot) -or -not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
        $errors += ("来源目录不可用，拒绝记录基线: " + $spec.name + " sourceRoot=" + $sourceRoot)
        continue
    }

    # 逐字节交叉校验
    $drift = @()
    foreach ($record in $records) {
        if (Test-PathWithinAllowlist -RelativePath $record.path -Allowlist $allowlist) { $totalAllowlisted++; continue }
        $sourcePath = Join-Path $sourceRoot ($record.path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            $drift += ($record.path + ' (absent-in-source)')
            continue
        }
        if ((Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant() -ne $record.sha256) {
            $drift += ($record.path + ' (content-vs-source)')
        } else {
            $totalChecked++
        }
    }
    if ($drift.Count -gt 0) {
        $errors += ("快照与来源不一致（" + $spec.name + "，共 " + $drift.Count + " 个）: " + (($drift | Select-Object -First 5) -join ', '))
    }

    # 来源 git 状态必须与导入记录一致
    $sourceKind = 'unknown'
    $recordedRevision = $importRecord.sourceRevision
    $sourceState = Get-SourceState -SourceRoot $sourceRoot
    if ($sourceState.kind -eq 'not-a-git-checkout') {
        $sourceKind = 'not-a-git-checkout'
        if ([string]$importRecord.sourceWorkingTree -ne 'not-a-git-checkout') {
            $errors += ("来源 git 状态与记录不符: " + $spec.name + " 记录=" + $importRecord.sourceWorkingTree + " 实际=not-a-git-checkout")
        }
    } elseif ($sourceState.kind -eq 'git') {
        if (-not [string]::IsNullOrWhiteSpace([string]$recordedRevision)) {
            if ($sourceState.revision -ne [string]$recordedRevision) {
                $errors += ("来源 revision 变化: " + $spec.name + " 记录=" + $recordedRevision + " 实际=" + $sourceState.revision)
            }
        }
        $expectedDirty = @()
        if ($importRecord.PSObject.Properties.Name -contains 'excludedDirtyFiles') {
            $expectedDirty = @($importRecord.excludedDirtyFiles | ForEach-Object { ([string]$_).Replace('\', '/') })
        }
        $actualDirty = @($sourceState.dirtyPaths | ForEach-Object { ([string]$_).Replace('\', '/') })
        $expectedSorted = [string[]]@($expectedDirty); [Array]::Sort($expectedSorted, [System.StringComparer]::Ordinal)
        $actualSorted = [string[]]@($actualDirty); [Array]::Sort($actualSorted, [System.StringComparer]::Ordinal)
        if (($expectedSorted -join '|') -ne ($actualSorted -join '|')) {
            $errors += ("来源工作树状态与记录不符: " + $spec.name + " 记录=[" + ($expectedSorted -join ', ') + "] 实际=[" + ($actualSorted -join ', ') + "]")
        }
        $sourceKind = if ($actualDirty.Count -eq 0) { 'git-clean' } else { 'git-modified-as-recorded' }
    } else {
        $errors += ("来源状态不可判定: " + $spec.name)
    }

    # Vibe 有逐文件白名单：快照文件集合必须与之完全一致
    if ($importRecord.PSObject.Properties.Name -contains 'fileSha256') {
        $recordedPaths = @($importRecord.fileSha256 | ForEach-Object { ([string]$_.path).Replace('\', '/') })
        $actualPaths = @($records | ForEach-Object { $_.path })
        $missing = @($recordedPaths | Where-Object { $actualPaths -notcontains $_ })
        $added = @($actualPaths | Where-Object { $recordedPaths -notcontains $_ })
        if ($missing.Count -gt 0 -or $added.Count -gt 0) {
            $errors += ("快照文件集合与导入白名单不一致: " + $spec.name + " missing=" + $missing.Count + " added=" + $added.Count)
        }
    }

    $snapshotEntries += [ordered]@{
        name = $spec.name
        path = $snapshotRelative
        fileCount = $records.Count
        treeHash = $treeHash
        sourceRoot = $sourceRoot
        sourceKind = $sourceKind
        sourceRevision = if ($null -eq $recordedRevision) { $null } else { [string]$recordedRevision }
        supplementAllowlist = @($allowlist)
        importRecord = $spec.record
    }
}

if ($errors.Count -gt 0) {
    Write-Error ("拒绝记录 provenance 基线（未通过来源背书）:`n" + ($errors -join "`n"))
    exit 2
}

$revision = (& git -C $repoRoot rev-parse HEAD 2>$null).Trim()
$document = [ordered]@{
    schema = 'feisheng-provenance-integrity/v1'
    algorithm = 'sha256-lines-v1'
    algorithmDefinition = 'record = file line as "relativePath/with/slashes`nfileSha256"; sort paths Ordinal; join with LF and append trailing LF; digest = SHA-256 of UTF-8 (no BOM) bytes'
    recordedAt = (Get-Date).ToUniversalTime().ToString('o')
    recordedAtRevision = $revision
    corroboration = [ordered]@{
        sourceByteComparison = 'required at recording time; ' + $totalChecked + ' files byte-identical to source, ' + $totalAllowlisted + ' within supplement allowlist'
        sourceState = 'git sources must match recorded HEAD and dirty set; non-git sources recorded as such'
    }
    snapshots = @($snapshotEntries)
}
$outputPath = Join-Path $repoRoot 'provenance/PROVENANCE-INTEGRITY.json'
$document | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -LiteralPath $outputPath

$result = [ordered]@{
    schema = 'feisheng-provenance-integrity-record-result/v1'
    status = 'RECORDED'
    outputPath = $outputPath
    recordedAtRevision = $revision
    sourceByteCheckedFiles = $totalChecked
    sourceAllowlistedFiles = $totalAllowlisted
    snapshots = @($snapshotEntries | ForEach-Object {
        [ordered]@{ name = $_.name; fileCount = $_.fileCount; treeHash = $_.treeHash; sourceKind = $_.sourceKind }
    })
    note = 'baseline corroborated by source byte comparison and source git state; not a runtime-enablement claim'
}
$result | ConvertTo-Json -Depth 10
