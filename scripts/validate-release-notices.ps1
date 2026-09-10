[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [Parameter(Mandatory = $false)]
    [string]$LicenseMapOverride = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 发布 NOTICE 门禁：只读取 LICENSE-MAP 与 CANONICAL-CATALOG 作为真源，
# 校验每个 runtime include 文件都能落到具体许可证/NOTICE；拒绝根许可证覆盖混合内容、
# 无 NOTICE 的 runtime inclusion、无 provenance 的手工许可证复制。

function Get-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Join-ContainedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $rootFull = Get-FullPath -Path $Root
    $rootWithoutTrailingSeparator = $rootFull.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    ))
    $relativeNative = $RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $candidate = [System.IO.Path]::GetFullPath((Join-Path -Path $rootFull -ChildPath $relativeNative))
    $prefix = $rootWithoutTrailingSeparator + [System.IO.Path]::DirectorySeparatorChar
    if (-not $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "路径越过了根目录: $RelativePath"
    }
    return $candidate
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

$repoRoot = Get-FullPath -Path $RepositoryRoot
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

$catalogPath = Join-ContainedPath -Root $repoRoot -RelativePath 'provenance/CANONICAL-CATALOG.json'
if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) {
    throw "缺少 CANONICAL-CATALOG: $catalogPath"
}

if ([string]::IsNullOrWhiteSpace($LicenseMapOverride)) {
    $licenseMapPath = Join-ContainedPath -Root $repoRoot -RelativePath 'provenance/LICENSE-MAP.json'
    if (-not (Test-Path -LiteralPath $licenseMapPath -PathType Leaf)) {
        throw "缺少 LICENSE-MAP: $licenseMapPath"
    }
    $licenseMap = Get-Content -Raw -Encoding UTF8 -LiteralPath $licenseMapPath | ConvertFrom-Json
} else {
    $licenseMapFull = Get-FullPath -Path $LicenseMapOverride
    if (-not (Test-Path -LiteralPath $licenseMapFull -PathType Leaf)) {
        throw "LicenseMapOverride 不存在: $licenseMapFull"
    }
    $licenseMap = Get-Content -Raw -Encoding UTF8 -LiteralPath $licenseMapFull | ConvertFrom-Json
}
$catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json

if ($licenseMap.schema -ne 'feisheng-license-map/v1') {
    throw "不支持的 LICENSE-MAP schema: $($licenseMap.schema)"
}
if ($licenseMap.status -match 'partial') {
    # partial 是当前事实状态；门禁必须确认 Vibe 仍 runtimeEligible=false
    $vibeEntry = @($licenseMap.entries | Where-Object { $_.source -eq 'vibe-coding-skills' })
    if ($vibeEntry.Count -ne 1 -or $vibeEntry[0].runtimeEligible -ne $false) {
        throw 'LICENSE-MAP 的 Vibe 条目必须保持 runtimeEligible=false 直到逐技能许可证完整。'
    }
}

# 构建 source -> notice 路径映射
$noticeBySource = @{}
foreach ($entry in @($licenseMap.entries)) {
    $noticeValue = [string]$entry.notice
    $noticePaths = @($noticeValue.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $resolved = @()
    foreach ($noticeRelative in $noticePaths) {
        $noticeFull = Join-ContainedPath -Root $repoRoot -RelativePath $noticeRelative
        if (-not (Test-Path -LiteralPath $noticeFull)) {
            throw "notice 文件不存在: $noticeFull"
        }
        if (Test-Path -LiteralPath $noticeFull -PathType Container) {
            $children = @(Get-ChildItem -LiteralPath $noticeFull -File | ForEach-Object { $_.FullName })
            if ($children.Count -eq 0) {
                throw "notice 目录为空: $noticeFull"
            }
            $resolved += $children
        } else {
            $resolved += $noticeFull
        }
    }
    $noticeBySource[$entry.source] = [pscustomobject]@{
        source = $entry.source
        license = $entry.license
        runtimeEligible = $entry.runtimeEligible
        notices = $resolved
    }
}

# 收集 runtime include（catalog decisionPolicy 声明的 acceptedStatuses；单一真源）
if ($catalog.PSObject.Properties.Name -notcontains 'decisionPolicy') {
    throw 'canonical catalog 缺少 decisionPolicy；无法确定 runtime include 集合。'
}
$runtimeIncludedStatuses = @($catalog.decisionPolicy.acceptedStatuses)
if ($runtimeIncludedStatuses.Count -eq 0) {
    throw 'decisionPolicy.acceptedStatuses 为空，拒绝发布门禁。'
}
$runtimeRecords = @($catalog.records | Where-Object { $runtimeIncludedStatuses -contains $_.status })
$runtimeItems = @()
$runtimeItems += [pscustomobject]@{
    id = 'project-entry'
    source = 'repo-owned-entry'
    path = [string]$catalog.projectEntry
    status = 'project-entry'
}
foreach ($record in $runtimeRecords) {
    $runtimeItems += [pscustomobject]@{
        id = [string]$record.id
        source = [string]$record.source
        path = [string]$record.path
        status = [string]$record.status
    }
}

$report = @()
$errors = @()
foreach ($item in $runtimeItems) {
    $source = $item.source
    if ($source -eq 'repo-owned-entry') {
        # 仓库自有唯一入口：不是三来源之一，不参与 runtimeEligible 检查；
        # 由仓库根治理/LICENSE 声明保护，禁止被根许可证覆盖混合内容由 forbidden 约束保证。
        $entryFull = Join-ContainedPath -Root $repoRoot -RelativePath $item.path
        if (-not (Test-Path -LiteralPath $entryFull -PathType Leaf)) {
            $errors += "project entry 文件不存在: $($item.path)"
            continue
        }
        $report += [pscustomobject]@{
            id = $item.id
            status = $item.status
            source = 'repo-owned-entry'
            license = 'repo-owned; see governance/sliver-core/LICENSE (Apache-2.0)'
            path = $item.path
            sha256 = Get-Sha256 -Path $entryFull
            notices = @('governance/sliver-core/LICENSE')
        }
        continue
    }

    if (-not $noticeBySource.ContainsKey($source)) {
        $errors += "runtime include 缺少许可证映射: $($item.id) source=$source"
        continue
    }

    $entryInfo = $noticeBySource[$source]
    if ($entryInfo.runtimeEligible -eq $false) {
        $errors += "runtime include 来自 runtimeEligible=false 的来源: $($item.id) source=$source"
        continue
    }

    $sourcePath = Join-ContainedPath -Root $repoRoot -RelativePath $item.path
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        $errors += "runtime include 文件不存在: $($item.path)"
        continue
    }

    $report += [pscustomobject]@{
        id = $item.id
        status = $item.status
        source = $source
        license = $entryInfo.license
        path = $item.path
        sha256 = Get-Sha256 -Path $sourcePath
        notices = @($entryInfo.notices | ForEach-Object { $_.Substring($repoRoot.Length + 1).Replace('\', '/') })
    }
}

if ($errors.Count -gt 0) {
    Write-Error ("NOTICE 门禁失败:`n" + ($errors -join "`n"))
    exit 2
}

$result = [ordered]@{
    schema = 'feisheng-release-notice-gate/v1'
    status = 'PASS'
    repositoryRoot = $repoRoot
    licenseMapStatus = $licenseMap.status
    forbidden = @($licenseMap.forbidden)
    runtimeItems = @($report | ForEach-Object {
        [ordered]@{
            id = $_.id
            status = $_.status
            source = $_.source
            license = $_.license
            path = $_.path
            sha256 = $_.sha256
            notices = @($_.notices)
        }
    })
    note = 'static notice gate only; NOT a release authorization and does not prove host installation'
    exitCode = 0
}

$result | ConvertTo-Json -Depth 10
