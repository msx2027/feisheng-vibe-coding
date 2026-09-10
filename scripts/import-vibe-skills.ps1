[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Vibe 技能物理导入（唯一导入路径）。
#
# 为什么必须有这一步：
#   scripts/runtime-projection-guard.ps1 明确禁止把 `sources` 段带进运行时 bundle。
#   因此「接受一个 Vibe 技能」（readiness=accepted）在结构上等价于「把它从 sources/ 之外的一等
#   位置提供一份内容副本」。只翻分类标签而不导入，会得到指向 sources/ 的 catalog 路径，门禁如实拒绝。
#
# 设计：数据驱动，不维护第二份技能清单
#   - 输入真源：provenance/SKILL-CLASSIFICATION.json 中 source=vibe-coding-skills 且 readiness=accepted 的记录。
#   - 每条 accepted 记录必须声明 `sourceDir`（上游 skills/ 下的目录名），否则 fail-closed。
#   - 只复制内容，不判断该不该接受；「该不该接受」只由分类真源决定。
#   - 复制源是快照 sources/vibe-coding-skills/skills/<sourceDir>/（不是上游项目），
#     这样导入不依赖上游可用性，且与快照 SHA 闭包对齐。
#   - 导入后逐文件复核 SHA-256，并把派生来源（源路径 + 源 SHA + revision）写入
#     provenance/VIBE-IMPORTS.json。导入内容从此是仓库一等内容，可被下游门禁/投影使用。
#
# 本脚本不修改任何来源项目，不修改分类真源，不做 readiness 决策。

function Get-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-RelativeFilePathList {
    param([Parameter(Mandatory = $true)][string]$Root)
    $rootFull = Get-FullPath -Path $Root
    $prefixLength = $rootFull.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )).Length + 1
    $paths = @()
    foreach ($item in @(Get-ChildItem -LiteralPath $rootFull -Recurse -Force -File)) {
        $paths += $item.FullName.Substring($prefixLength).Replace('\', '/')
    }
    $sorted = [string[]]@($paths)
    [Array]::Sort($sorted, [System.StringComparer]::Ordinal)
    return @($sorted)
}

$repoRoot = Get-FullPath -Path $RepositoryRoot
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

$classificationPath = Join-Path $repoRoot 'provenance/SKILL-CLASSIFICATION.json'
$inventoryPath = Join-Path $repoRoot 'provenance/SKILL-INVENTORY.json'
$licenseMapPath = Join-Path $repoRoot 'provenance/LICENSE-MAP.json'
foreach ($required in @($classificationPath, $inventoryPath, $licenseMapPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "缺少真源文件: $required" }
}

$classification = Get-Content -Raw -Encoding UTF8 -LiteralPath $classificationPath | ConvertFrom-Json
$inventory = Get-Content -Raw -Encoding UTF8 -LiteralPath $inventoryPath | ConvertFrom-Json
$licenseMap = Get-Content -Raw -Encoding UTF8 -LiteralPath $licenseMapPath | ConvertFrom-Json

# 源 revision 从许可证台账读取（单一真源），不在本脚本硬编码。
$revisions = @{}
foreach ($family in @($licenseMap.vibePerSkill.families.PSObject.Properties)) {
    $upstreamText = [string]$family.Value.upstream
    $match = [regex]::Match($upstreamText, 'sourceCommit ([0-9a-f]{40})')
    if ($match.Success) { $revisions[$match.Groups[1].Value] = $true }
}
if ($revisions.Count -ne 1) {
    throw "无法从 LICENSE-MAP 的 vibePerSkill.families[].upstream 唯一确定 Vibe sourceCommit，实际得到 $($revisions.Count) 个。"
}
$sourceRevision = @($revisions.Keys)[0]

# 已接受且需要物理导入的 Vibe 记录（数据驱动，无第二份清单）
$pending = @()
foreach ($property in @($classification.skills.PSObject.Properties)) {
    $entry = $property.Value
    if ([string]$entry.source -ne 'vibe-coding-skills') { continue }
    if ([string]$entry.readiness -ne 'accepted') { continue }
    $id = [string]$property.Name
    $sourceDir = ''
    if ($entry.PSObject.Properties.Name -contains 'sourceDir' -and $null -ne $entry.sourceDir) {
        $sourceDir = [string]$entry.sourceDir
    }
    if ([string]::IsNullOrWhiteSpace($sourceDir)) {
        throw "accepted 的 Vibe 记录必须声明 sourceDir: $id"
    }
    if ([string]$entry.domain -ne 'checker') {
        throw "本导入器的目标约定是 skills/checker/<id>；记录 '$id' 的 domain 为 '$($entry.domain)'，需要先扩展导入约定。"
    }
    $pending += [pscustomobject]@{ id = $id; sourceDir = $sourceDir }
}
if ($pending.Count -eq 0) {
    throw '没有 readiness=accepted 的 Vibe 记录；拒绝空运行（导入必须有明确的接受决策背书）。'
}

# 库存 sha 对照表（按 sourceDir）
$inventoryByDir = @{}
foreach ($row in @($inventory.skills)) {
    if ([string]$row.source -ne 'vibe-coding-skills') { continue }
    $relative = ([string]$row.path).Replace('\', '/')
    $segments = @($relative.Split('/'))
    if ($segments.Count -ne 3 -or $segments[0] -ne 'skills' -or $segments[2] -ne 'SKILL.md') { continue }
    $inventoryByDir[$segments[1]] = [pscustomobject]@{
        sha256 = [string]$row.sha256
        canonicalCandidate = [string]$row.canonicalCandidate
    }
}

# 阶段一：预检（全部通过才开始复制，避免半成品）
$plan = @()
foreach ($item in $pending) {
    $sourceDirPath = Join-Path $repoRoot ('sources/vibe-coding-skills/skills/' + $item.sourceDir)
    if (-not (Test-Path -LiteralPath $sourceDirPath -PathType Container)) {
        throw "缺少快照技能目录: sources/vibe-coding-skills/skills/$($item.sourceDir)"
    }
    $sourceSkillPath = Join-Path $sourceDirPath 'SKILL.md'
    if (-not (Test-Path -LiteralPath $sourceSkillPath -PathType Leaf)) {
        throw "快照技能目录缺少 SKILL.md: sources/vibe-coding-skills/skills/$($item.sourceDir)"
    }
    if (-not $inventoryByDir.ContainsKey($item.sourceDir)) {
        throw "SKILL-INVENTORY.json 中没有 sourceDir '$($item.sourceDir)' 的记录；快照清单与分类真源不一致。"
    }
    $inventoryRow = $inventoryByDir[$item.sourceDir]
    if ($inventoryRow.canonicalCandidate -ne $item.sourceDir) {
        throw "分类与库存的目录名不一致: 记录 '$($item.id)' 声明 sourceDir='$($item.sourceDir)'，库存 canonicalCandidate='$($inventoryRow.canonicalCandidate)'。"
    }
    $sourceSkillSha = Get-Sha256 -Path $sourceSkillPath
    if ($inventoryRow.sha256 -ne $sourceSkillSha) {
        throw "快照 SKILL.md 与 SKILL-INVENTORY.json 记录不一致: $($item.sourceDir) 库存=$($inventoryRow.sha256) 实际=$sourceSkillSha"
    }

    $destinationRelative = 'skills/checker/' + $item.id
    $destinationPath = Join-Path $repoRoot ($destinationRelative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (Test-Path -LiteralPath $destinationPath) {
        throw "目标位置已存在，拒绝覆盖: $destinationRelative"
    }

    $plan += [pscustomobject]@{
        id = $item.id
        sourceDir = $item.sourceDir
        sourceDirPath = $sourceDirPath
        destinationRelative = $destinationRelative
        destinationPath = $destinationPath
    }
}

# 阶段二：复制 + 逐文件复核
$imports = @()
foreach ($item in $plan) {
    $destinationParent = Split-Path -Parent $item.destinationPath
    if (-not (Test-Path -LiteralPath $destinationParent)) {
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    }
    New-Item -ItemType Directory -Force -Path $item.destinationPath | Out-Null
    foreach ($child in @(Get-ChildItem -LiteralPath $item.sourceDirPath -Recurse -Force)) {
        $relative = $child.FullName.Substring($item.sourceDirPath.Length).TrimStart([char[]]@('\', '/'))
        $targetPath = Join-Path $item.destinationPath ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        if ($child.PSObject.Properties.Name -contains 'PSIsContainer' -and $child.PSIsContainer) {
            if (-not (Test-Path -LiteralPath $targetPath)) {
                New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
            }
            continue
        }
        $targetParent = Split-Path -Parent $targetPath
        if (-not (Test-Path -LiteralPath $targetParent)) {
            New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
        }
        Copy-Item -LiteralPath $child.FullName -Destination $targetPath -Force
    }

    $sourceFiles = @(Get-RelativeFilePathList -Root $item.sourceDirPath)
    $destinationFiles = @(Get-RelativeFilePathList -Root $item.destinationPath)
    if ($sourceFiles.Count -ne $destinationFiles.Count) {
        throw "导入文件数不一致: $($item.id) 源=$($sourceFiles.Count) 目标=$($destinationFiles.Count)"
    }
    $fileRecords = @()
    foreach ($relative in $sourceFiles) {
        if ($destinationFiles -notcontains $relative) { throw "导入缺少文件: $($item.id)/$relative" }
        $sourceFilePath = Join-Path $item.sourceDirPath ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        $destinationFilePath = Join-Path $item.destinationPath ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        $sourceHash = Get-Sha256 -Path $sourceFilePath
        $destinationHash = Get-Sha256 -Path $destinationFilePath
        if ($sourceHash -ne $destinationHash) { throw "导入内容与快照不一致: $($item.id)/$relative" }
        $fileRecords += [ordered]@{ path = $relative; sha256 = $sourceHash }
    }

    $imports += [ordered]@{
        id = $item.id
        sourceDir = $item.sourceDir
        sourcePath = 'sources/vibe-coding-skills/skills/' + $item.sourceDir
        destination = $item.destinationRelative
        fileCount = $fileRecords.Count
        files = $fileRecords
    }
    Write-Output ("Imported " + $item.id + " -> " + $item.destinationRelative + " (" + $fileRecords.Count + " files)")
}

# 阶段三：登记派生来源（累加，保留历史批次）
$recordPath = Join-Path $repoRoot 'provenance/VIBE-IMPORTS.json'
$existingImports = @()
if (Test-Path -LiteralPath $recordPath -PathType Leaf) {
    $existing = Get-Content -Raw -Encoding UTF8 -LiteralPath $recordPath | ConvertFrom-Json
    $existingImports = @($existing.imports)
}
$byId = @{}
foreach ($entry in @($existingImports + @($imports))) {
    $byId[[string]$entry.id] = $entry
}
$mergedIds = [string[]]@($byId.Keys)
[Array]::Sort($mergedIds, [System.StringComparer]::Ordinal)

$record = [ordered]@{
    schema = 'feisheng-vibe-skill-import-record/v1'
    owner = 'provenance'
    source = 'vibe-coding-skills'
    snapshotRoot = 'sources/vibe-coding-skills'
    destinationRoot = 'skills/checker/<id>'
    sourceRevision = $sourceRevision
    sourceRevisionSource = 'provenance/LICENSE-MAP.json vibePerSkill.families[].upstream (sourceCommit)'
    note = '物理导入的派生来源台账。导入内容自本记录起是仓库一等内容；readiness 决策只写在 SKILL-CLASSIFICATION.json。'
    imports = @($mergedIds | ForEach-Object { $byId[$_] })
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$record | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $recordPath
Write-Output ("Recorded " + $imports.Count + " import(s) into provenance/VIBE-IMPORTS.json")
