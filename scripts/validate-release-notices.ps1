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

# 许可证准入策略（数据驱动，不在代码里硬编码某个来源的 flag）：
#   - Vibe 来源是混合许可证，source 级 flag 只能是「非整体准入」的默认值；
#     真正的 runtime 准入由 vibePerSkill.families[].runtimeEligible 逐族声明。
#     这里把逐族策略读成可判定的数据结构：族必须显式声明布尔策略（缺字段即失败），
#     每个技能必须恰好属于一个族。
#   - 其他来源（sliver / matt）仍是 source 级 entries[].runtimeEligible。
$vibeFamilyBySkill = @{}
$vibeFamilyPolicy = @{}
if ($licenseMap.PSObject.Properties.Name -contains 'vibePerSkill') {
    $vibeLedger = $licenseMap.vibePerSkill
    if ($vibeLedger.schema -ne 'feisheng-vibe-per-skill-license-ledger/v1') {
        throw "不支持的 vibePerSkill schema: $($vibeLedger.schema)"
    }
    if ($vibeLedger.PSObject.Properties.Name -notcontains 'families') {
        throw 'vibePerSkill 缺少 families；无法判定 Vibe 逐技能许可证准入。'
    }
    foreach ($familyProperty in @($vibeLedger.families.PSObject.Properties)) {
        $familyName = [string]$familyProperty.Name
        $family = $familyProperty.Value
        if ($family.PSObject.Properties.Name -notcontains 'runtimeEligible') {
            throw "Vibe 许可证族缺少 runtimeEligible 策略（fail-closed）: $familyName"
        }
        $familySkills = @($family.skills)
        if ($familySkills.Count -eq 0) {
            throw "Vibe 许可证族没有任何技能: $familyName"
        }
        foreach ($skillId in $familySkills) {
            $normalizedSkillId = [string]$skillId
            if ([string]::IsNullOrWhiteSpace($normalizedSkillId)) { throw "Vibe 许可证族存在空技能名: $familyName" }
            if ($vibeFamilyBySkill.ContainsKey($normalizedSkillId)) {
                throw "Vibe 技能出现在多个许可证族（无法唯一判定准入）: $normalizedSkillId"
            }
            $vibeFamilyBySkill[$normalizedSkillId] = $familyName
        }
        $vibeFamilyPolicy[$familyName] = [pscustomobject]@{
            family = $familyName
            license = [string]$family.license
            noticeSpec = [string]$family.notice
            runtimeEligible = [bool]$family.runtimeEligible
        }
    }
    if ($vibeFamilyPolicy.Count -eq 0) { throw 'vibePerSkill.families 为空，拒绝发布门禁。' }
} else {
    throw 'LICENSE-MAP 缺少 vibePerSkill 逐技能许可证台账；无法判定 Vibe runtime 准入（fail-closed）。'
}

# 构建 source -> notice 路径映射（非 Vibe 来源；Vibe 逐族在逐条判定时按需解析）
$noticeBySource = @{}
foreach ($entry in @($licenseMap.entries)) {
    $entrySource = [string]$entry.source
    if ($entrySource -eq 'vibe-coding-skills') { continue }
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
    $noticeBySource[$entrySource] = [pscustomobject]@{
        source = $entrySource
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
            licenseFamily = $null
            path = $item.path
            sha256 = Get-Sha256 -Path $entryFull
            notices = @('governance/sliver-core/LICENSE')
        }
        continue
    }

    # Vibe：逐族许可证策略（数据驱动）——不是 source 级 flag，也不是代码里的硬编码例外。
    if ($source -eq 'vibe-coding-skills') {
        if (-not $vibeFamilyBySkill.ContainsKey($item.id)) {
            $errors += "runtime include 没有逐技能许可证族映射: $($item.id)"
            continue
        }
        $familyName = $vibeFamilyBySkill[$item.id]
        $familyPolicy = $vibeFamilyPolicy[$familyName]
        if (-not $familyPolicy.runtimeEligible) {
            $errors += "runtime include 来自 runtimeEligible=false 的许可证族: $($item.id) family=$familyName"
            continue
        }
        $familyNoticePaths = @($familyPolicy.noticeSpec.Split(';') | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $familyNotices = @()
        $familyNoticeErrors = @()
        foreach ($noticeRelative in $familyNoticePaths) {
            $noticeFull = Join-ContainedPath -Root $repoRoot -RelativePath $noticeRelative
            if (-not (Test-Path -LiteralPath $noticeFull)) {
                $familyNoticeErrors += "许可证族的 notice 文件不存在: $familyName -> $noticeRelative"
                continue
            }
            if (Test-Path -LiteralPath $noticeFull -PathType Container) {
                $children = @(Get-ChildItem -LiteralPath $noticeFull -File | ForEach-Object { $_.FullName })
                if ($children.Count -eq 0) {
                    $familyNoticeErrors += "许可证族的 notice 目录为空: $familyName -> $noticeRelative"
                    continue
                }
                $familyNotices += $children
            } else {
                $familyNotices += $noticeFull
            }
        }
        if ($familyNotices.Count -eq 0 -or $familyNoticeErrors.Count -gt 0) {
            foreach ($noticeError in @($familyNoticeErrors)) { $errors += $noticeError }
            if ($familyNotices.Count -eq 0) {
                $errors += "runtime include 的许可证族没有可解析的 NOTICE: $($item.id) family=$familyName"
            }
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
            license = $familyPolicy.license
            licenseFamily = $familyName
            path = $item.path
            sha256 = Get-Sha256 -Path $sourcePath
            notices = @($familyNotices | ForEach-Object { $_.Substring($repoRoot.Length + 1).Replace('\', '/') })
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
        licenseFamily = $null
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
            licenseFamily = $_.licenseFamily
            path = $_.path
            sha256 = $_.sha256
            notices = @($_.notices)
        }
    })
    note = 'static notice gate only; NOT a release authorization and does not prove host installation'
    exitCode = 0
}

$result | ConvertTo-Json -Depth 10
