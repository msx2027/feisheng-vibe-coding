param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# CANONICAL-CATALOG 生成器（数据驱动）
#
# 真源分工：
#   - provenance/SKILL-INVENTORY.json      : 来源事实快照（source/path/invocation/sha256）
#   - provenance/SKILL-CLASSIFICATION.json : 分类决策唯一真源（domain/readiness → statusPolicy → status）
#   - 本脚本                                : 只做派生（id 命名、路径、来源 revision、字段拼装），不做分类判断
#
# 因此「改分类」= 改 SKILL-CLASSIFICATION.json，不再改本脚本的数组。
# 本脚本对分类缺失/不一致 fail loudly（fail-closed）。

$inventoryPath = Join-Path $RepoRoot 'provenance/SKILL-INVENTORY.json'
$classificationPath = Join-Path $RepoRoot 'provenance/SKILL-CLASSIFICATION.json'
$outputPath = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    Join-Path $RepoRoot 'provenance/CANONICAL-CATALOG.json'
} else {
    [System.IO.Path]::GetFullPath($OutputPath)
}

if (-not (Test-Path -LiteralPath $inventoryPath -PathType Leaf)) { throw "缺少 inventory: $inventoryPath" }
if (-not (Test-Path -LiteralPath $classificationPath -PathType Leaf)) { throw "缺少 classification: $classificationPath" }

$inventory = Get-Content -Raw -Encoding UTF8 -LiteralPath $inventoryPath | ConvertFrom-Json
$classification = Get-Content -Raw -Encoding UTF8 -LiteralPath $classificationPath | ConvertFrom-Json

if ($classification.schema -ne 'feisheng-skill-classification/v1') {
    throw "不支持的 classification schema: $($classification.schema)"
}

# 来源 revision 属来源事实，保留在本脚本（非分类决策）。
$sourceRevisions = [ordered]@{
    'mattpocock-skills' = '9fe7e7a3bb352851b986725bab1c7cfb17610a97'
    'sliver-vibe-coding' = '30c7cfb363c7ea58121e98edfd321c2cf396098e'
    'vibe-coding-skills' = $null
}

# status 只能由 statusPolicy 派生
$statusPolicy = @{}
foreach ($property in $classification.statusPolicy.PSObject.Properties) {
    $statusPolicy[$property.Name] = [string]$property.Value
}

# writeAuthority 受控词表（生成时校验，fail-closed）
$writeAuthorityVocabulary = @()
foreach ($token in @($classification.writeAuthorityVocabulary)) {
    $writeAuthorityVocabulary += [string]$token
}

function Get-DerivedStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Domain,
        [Parameter(Mandatory = $true)][string]$Readiness
    )
    $key = "$Domain|$Readiness"
    if (-not $statusPolicy.ContainsKey($key)) {
        throw "分类策略缺失: skill '$Id' 的 (domain=$Domain, readiness=$Readiness) 不在 statusPolicy 中。"
    }
    return $statusPolicy[$key]
}

# id 派生（命名空间决策，与 readiness 无关）
function Get-RecordId {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Relative
    )
    $id = $Candidate
    if ($Source -eq 'sliver-vibe-coding') {
        $id = 'sliver-vibe-coding'
    } elseif ($Source -eq 'vibe-coding-skills') {
        if ($Candidate -eq 'code-review') { $id = 'vibe-code-review' }
    } elseif ($Source -eq 'mattpocock-skills') {
        if ($Candidate -eq 'mattpocock-code-review' -or $Relative -match '/code-review/SKILL\.md$') { $id = 'code-review' }
        if ($Candidate -eq 'tdd') { $id = 'tdd' }
    }
    return $id
}

# path 派生：已验收原语已导入目标仓库，路径指向导入副本
# （由 readiness 语义决定，而不是硬编码名单）
function Get-RecordPath {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$Relative,
        [Parameter(Mandatory = $true)][string]$Readiness
    )
    if ($Source -eq 'sliver-vibe-coding') {
        return 'governance/sliver-core/SKILL.md'
    }
    if ($Source -eq 'vibe-coding-skills') {
        return 'sources/vibe-coding-skills/' + $Relative
    }
    if ($Source -eq 'mattpocock-skills') {
        if ($Readiness -eq 'accepted') {
            return 'skills/engineering/' + $Candidate + '/SKILL.md'
        }
        return 'sources/mattpocock-skills/' + $Relative
    }
    return $Relative
}

$records = @()
$seenIds = @{}
$usedClassificationIds = @{}
foreach ($row in @($inventory.skills)) {
    $source = [string]$row.source
    $candidate = [string]$row.canonicalCandidate
    $relative = ([string]$row.path).Replace('\', '/')

    $id = Get-RecordId -Source $source -Candidate $candidate -Relative $relative

    if ($seenIds.ContainsKey($id)) {
        throw "派生 id 重复: $id"
    }
    $seenIds[$id] = $true

    $classified = $classification.skills.PSObject.Properties[$id]
    if ($null -eq $classified) {
        throw "分类缺失: 派生 id '$id'（source=$source）不在 SKILL-CLASSIFICATION.json 的 skills 中。"
    }
    $usedClassificationIds[$id] = $true

    $entry = $classified.Value
    $domain = [string]$entry.domain
    $readiness = [string]$entry.readiness
    $entrySource = [string]$entry.source
    if ($entrySource -ne $source) {
        throw "分类 source 不一致: skill '$id' 分类记录 source=$entrySource，实际=$source"
    }

    $path = Get-RecordPath -Source $source -Candidate $candidate -Relative $relative -Readiness $readiness
    $status = Get-DerivedStatus -Id $id -Domain $domain -Readiness $readiness

    $writeAuthority = @()
    if ($entry.PSObject.Properties.Name -contains 'writeAuthority' -and $null -ne $entry.writeAuthority) {
        $writeAuthority = @($entry.writeAuthority)
        foreach ($token in $writeAuthority) {
            if ($writeAuthorityVocabulary -notcontains [string]$token) {
                throw "未知 writeAuthority token: skill '$id' 声明了 '$token'，不在 writeAuthorityVocabulary 中。"
            }
        }
    }

    $reason = ''
    if ($classification.reasonsById.PSObject.Properties.Name -contains $id) {
        $reason = [string]$classification.reasonsById.$id
    } elseif ($classification.reasonsByStatus.PSObject.Properties.Name -contains $status) {
        $reason = [string]$classification.reasonsByStatus.$status
    }

    $revision = $null
    if ($sourceRevisions.Contains($source)) {
        $revision = $sourceRevisions[$source]
    }

    $records += [ordered]@{
        id = $id
        source = $source
        path = $path
        sourceRevision = $revision
        invocation = [string]$row.invocation
        domain = $domain
        readiness = $readiness
        status = $status
        reason = $reason
        sourceSha256 = [string]$row.sha256
        writeAuthority = $writeAuthority
    }
}

foreach ($property in $classification.skills.PSObject.Properties) {
    if (-not $usedClassificationIds.ContainsKey($property.Name)) {
        throw "分类存在过期条目: '$($property.Name)' 未出现在 SKILL-INVENTORY.json 的派生结果中。"
    }
}

# 记录排序：必须跨 PowerShell 版本确定，因此用 ordinal（码位）排序。
# 不能用 `Sort-Object id`：records 是 OrderedDictionary，那样是静默 no-op；
# 也不能用 culture-aware 排序（ICU vs NLS 对 `-` 等标点的权重不同，已实测出跨版本差异）。
$recordById = @{}
foreach ($record in $records) { $recordById[[string]$record['id']] = $record }
$sortedIds = [string[]]@($recordById.Keys)
[Array]::Sort($sortedIds, [System.StringComparer]::Ordinal)
$records = @($sortedIds | ForEach-Object { $recordById[$_] })

# decisionPolicy 由 runtimePolicy 派生；runtimeExcludedStatuses 自动补集（fail-closed）
$controlPlaneStatus = [string]$classification.runtimePolicy.controlPlaneStatus
$acceptedStatuses = @($classification.runtimePolicy.acceptedStatuses)
if ($acceptedStatuses -notcontains $controlPlaneStatus) {
    throw "runtimePolicy.acceptedStatuses 必须包含 controlPlaneStatus。"
}
$allStatuses = @()
foreach ($row in @($classification.statusPolicy.PSObject.Properties | Sort-Object Name)) {
    $value = [string]$row.Value
    if ($allStatuses -notcontains $value) { $allStatuses += $value }
}
$runtimeExcludedStatuses = @($allStatuses | Where-Object { $acceptedStatuses -notcontains $_ })

# duplicateGroups 校验（fail-closed）：
#   - group.owner 必须是 OWNER-LEDGER.json 中登记的 owner id（防悬空 owner / 重复写入者）
#   - 每个 group 的成员（members 或 aliases）必须是本文件 skills 中的 canonical id
#   - group.id 唯一，且每个 group 至少有一个成员
$ownerLedgerPath = Join-Path $RepoRoot 'provenance/OWNER-LEDGER.json'
if (-not (Test-Path -LiteralPath $ownerLedgerPath -PathType Leaf)) { throw "缺少 owner ledger: $ownerLedgerPath" }
$ownerLedger = Get-Content -Raw -Encoding UTF8 -LiteralPath $ownerLedgerPath | ConvertFrom-Json
$ownerIds = @{}
foreach ($owner in @($ownerLedger.owners)) { $ownerIds[[string]$owner.id] = $true }

$duplicateGroupIds = @{}
foreach ($group in @($classification.duplicateGroups)) {
    $groupId = [string]$group.id
    if ([string]::IsNullOrWhiteSpace($groupId)) { throw 'duplicateGroups 存在空 id。' }
    if ($duplicateGroupIds.ContainsKey($groupId)) { throw "duplicateGroups id 重复: $groupId" }
    $duplicateGroupIds[$groupId] = $true

    $ownerId = [string]$group.owner
    if (-not $ownerIds.ContainsKey($ownerId)) {
        throw "duplicateGroups[$groupId] 的 owner '$ownerId' 未在 OWNER-LEDGER.json 中登记。"
    }

    $referenced = @()
    if ($group.PSObject.Properties.Name -contains 'members') { $referenced += @($group.members) }
    if ($group.PSObject.Properties.Name -contains 'aliases') { $referenced += @($group.aliases) }
    if ($referenced.Count -eq 0) { throw "duplicateGroups[$groupId] 没有任何 members/aliases。" }
    foreach ($memberId in $referenced) {
        if ([string]::IsNullOrWhiteSpace([string]$memberId)) { throw "duplicateGroups[$groupId] 存在空成员。" }
        if ($null -eq $classification.skills.PSObject.Properties[[string]$memberId]) {
            throw "duplicateGroups[$groupId] 的成员 '$memberId' 不在 SKILL-CLASSIFICATION.skills 中。"
        }
    }
}

$duplicateGroups = @()
foreach ($group in @($classification.duplicateGroups)) {
    if ($group.PSObject.Properties.Name -contains 'aliases') {
        $duplicateGroups += [ordered]@{ id = [string]$group.id; owner = [string]$group.owner; aliases = @($group.aliases); rule = [string]$group.rule }
    } else {
        $duplicateGroups += [ordered]@{ id = [string]$group.id; owner = [string]$group.owner; members = @($group.members); rule = [string]$group.rule }
    }
}

$output = [ordered]@{
    schema = 'feisheng-canonical-skill-catalog/v1'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    owner = 'skill-catalog'
    projectEntry = 'SKILL.md'
    routeOwner = 'governance/sliver-core/references/routes-index.md'
    sourceInventory = 'provenance/SKILL-INVENTORY.json'
    sourceClassification = 'provenance/SKILL-CLASSIFICATION.json'
    records = $records
    duplicateGroups = $duplicateGroups
    decisionPolicy = [ordered]@{
        controlPlaneStatus = $controlPlaneStatus
        acceptedStatuses = $acceptedStatuses
        runtimeExcludedStatuses = $runtimeExcludedStatuses
        writeAuthorityPolicy = [ordered]@{
            controlPlaneTokens = @($classification.writeAuthorityPolicy.controlPlaneTokens)
            exclusiveOwners = $classification.writeAuthorityPolicy.exclusiveOwners
            requireDeclaredForRuntime = [bool]$classification.writeAuthorityPolicy.requireDeclaredForRuntime
        }
        generatedProjectionsAreReadOnly = $true
    }
}

$output | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -LiteralPath $outputPath
Write-Output "Generated $outputPath with $($records.Count) records."
