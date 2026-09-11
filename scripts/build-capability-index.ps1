[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [Parameter(Mandatory = $false)]
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 能力索引生成器（只读 catalog，输出人类可读索引）
#
# 目的：让「我现在能用什么 / 为什么别的不能用 / 怎么改」不需要读 JSON。
# 单一输入真源：provenance/CANONICAL-CATALOG.json（其本身由 SKILL-CLASSIFICATION.json 派生）。
# 输出是生成物，禁止手工编辑；新鲜度由 scripts/verify.ps1 校验。

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

$catalogPath = Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json'
if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) {
    throw "缺少 canonical catalog: $catalogPath"
}
$catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json
if ($catalog.schema -ne 'feisheng-canonical-skill-catalog/v1') {
    throw "不支持的 canonical catalog schema: $($catalog.schema)"
}

$resolvedOutput = if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    Join-Path $repoRoot 'docs/CAPABILITY-INDEX.md'
} else {
    [System.IO.Path]::GetFullPath($OutputPath)
}

$acceptedStatuses = @($catalog.decisionPolicy.acceptedStatuses)
$records = @($catalog.records)

function Sort-ByIdOrdinal {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Items)
    $map = @{}
    foreach ($item in $Items) { $map[[string]$item.id] = $item }
    $ids = [string[]]@($map.Keys)
    [Array]::Sort($ids, [System.StringComparer]::Ordinal)
    return @($ids | ForEach-Object { $map[$_] })
}

function Sort-ByKeyOrdinal {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$Items,
        [Parameter(Mandatory = $true)][string]$Key
    )
    $map = @{}
    foreach ($item in $Items) { $map[[string]$item.$Key] = $item }
    $keys = [string[]]@($map.Keys)
    [Array]::Sort($keys, [System.StringComparer]::Ordinal)
    return @($keys | ForEach-Object { $map[$_] })
}

function Group-ByKey {
    param(
        [Parameter(Mandatory = $true)][object[]]$Items,
        [Parameter(Mandatory = $true)][string]$Key
    )
    $map = @{}
    foreach ($item in $Items) {
        $value = [string]$item.$Key
        if (-not $map.ContainsKey($value)) { $map[$value] = @() }
        $map[$value] += $item
    }
    return $map
}

$runtime = @(Sort-ByIdOrdinal -Items @($records | Where-Object { $acceptedStatuses -contains $_.status }))
$pending = @(Sort-ByIdOrdinal -Items @($records | Where-Object { $_.status -eq 'adapter-candidate' }))
$blocked = @(Sort-ByIdOrdinal -Items @($records | Where-Object { $_.status -like 'blocked-*' }))
$excluded = @(Sort-ByIdOrdinal -Items @($records | Where-Object { $_.readiness -eq 'excluded' -or $_.readiness -eq 'compatibility' }))
$sourceOnly = @(Sort-ByIdOrdinal -Items @($records | Where-Object { $_.readiness -eq 'source-only' }))
$retired = @(Sort-ByIdOrdinal -Items @($records | Where-Object { $_.status -like 'retired-*' }))

$lines = @()
$lines += '# 能力索引（生成物）'
$lines += ''
$lines += '> 本文件由 `scripts/build-capability-index.ps1` 从 `provenance/CANONICAL-CATALOG.json` 生成；**禁止手工编辑**。'
$lines += '> 分类唯一真源是 `provenance/SKILL-CLASSIFICATION.json`；改分类 = 改该文件后重生成 catalog。'
$lines += '> 新鲜度校验：`pwsh scripts/verify.ps1`。'
$lines += ''
$lines += ('统计：共 **' + $records.Count + '** 项来源技能 —— 可用 ' + $runtime.Count + '、待启用 ' + $pending.Count + '、来源专用 ' + $sourceOnly.Count + '、阻塞 ' + $blocked.Count + '、兼容/排除 ' + $excluded.Count + '、已退役 ' + $retired.Count + '。')
$lines += ''
$lines += '## 现在可用（进入 runtime 静态投影）'
$lines += ''
$lines += ('仅 `decisionPolicy.acceptedStatuses` = `' + ($acceptedStatuses -join '`, `') + '` 可进入 runtime；其余一律排除。')
$lines += ''
$lines += '| id | 来源 | 域 | 状态 | 可写（writeAuthority） | runtime 单位 | 文件 |'
$lines += '|---|---|---|---|---|---|---|'
foreach ($record in $runtime) {
    $authority = @()
    if ($record.PSObject.Properties.Name -contains 'writeAuthority' -and $null -ne $record.writeAuthority) {
        $authority = @($record.writeAuthority)
    }
    $authorityText = if ($authority.Count -eq 0) { '未声明' } else { (@($authority) -join '、') }
    $bundleScope = 'file'
    $bundleCount = 1
    if ($record.PSObject.Properties.Name -contains 'bundle' -and $null -ne $record.bundle) {
        $bundleScope = [string]$record.bundle.scope
        $bundleCount = @($record.bundle.files).Count
    }
    $lines += ('| `' + $record.id + '` | ' + $record.source + ' | ' + $record.domain + ' | ' + $record.status + ' | ' + $authorityText + ' | `' + $bundleScope + '` | ' + $bundleCount + ' |')
}
$lines += ''
if ($catalog.PSObject.Properties.Name -contains 'bundlePolicy' -and $null -ne $catalog.bundlePolicy) {
    $lines += 'runtime 单位策略：`directory` = 以 `skills/<group>/<id>/` 整个导入目录为 runtime 单位（文件清单在生成时枚举并逐文件记 sha256，是显式白名单）；`file` = 只投影记录自身文件（如控制面 `governance/sliver-core/SKILL.md`，那棵树的其余部分不是技能内容）。真源：`SKILL-CLASSIFICATION.json` 的 `runtimePromotionPolicy.bundlePolicy`。'
    $lines += ''
}
$lines += ''
$lines += '再次提醒：投影是**静态候选**。宿主 discovery 已于 2026-09-11 重采证据（`provenance/HOST-DISCOVERY-EVIDENCE.json`）；宿主 trust、逐技能行为质量与 Hook 的宿主 fresh-session 冒烟仍为 `UNVERIFIED`——静态投影不是行为验收。'
$lines += ''
$lines += '写权限约束：runtime include 必须声明 `writeAuthority`；控制面 token（`route-catalog`、`target-truth`、`validation-gate`、`skill-catalog`、`runtime-projection`、`hook-writer`）具有排他 owner，违反即门禁失败（防重复写入者）。'
$lines += ''
$lines += '## 已审查、待启用'
$lines += ''
$lines += '已具备适配条件但未进入 runtime。进入 runtime 需要行为证据（切换 `readiness` 为 `accepted`）。'
$lines += ''
$lines += '| id | 来源 | 域 | 原因 |'
$lines += '|---|---|---|---|'
foreach ($record in $pending) {
    $lines += ('| `' + $record.id + '` | ' + $record.source + ' | ' + $record.domain + ' | ' + $record.reason + ' |')
}
$lines += ''
$lines += '## 来源专用（未启用）'
$lines += ''
$lines += '按域分组列出；`reason` 为未启用的统一原因。'
$lines += ''
$domainGroups = @(Sort-ByKeyOrdinal -Items @($sourceOnly | Group-Object domain) -Key Name)
foreach ($domain in $domainGroups) {
    $items = @(Sort-ByIdOrdinal -Items @($domain.Group))
    $reason = [string]$items[0].reason
    $ids = @($items | ForEach-Object { '`' + $_.id + '`' }) -join '、'
    $lines += ('- **' + $domain.Name + '**（' + $items.Count + '）：' + $ids)
    $lines += ('  - 原因：' + $reason)
}
$lines += ''
$lines += '## 阻塞'
$lines += ''
if ($blocked.Count -eq 0) {
    $lines += '（当前无阻塞项。早先因上游未提交改名而被阻塞的 `tdd`、`code-review` 已按「内容取已提交 revision、命名由本仓库决定」解除。）'
} else {
    $lines += '| id | 来源 | 域 | 原因 |'
    $lines += '|---|---|---|---|'
    foreach ($record in $blocked) {
        $lines += ('| `' + $record.id + '` | ' + $record.source + ' | ' + $record.domain + ' | ' + $record.reason + ' |')
    }
}
$lines += ''
$lines += '## 兼容与排除'
$lines += ''
foreach ($record in $excluded) {
    $lines += ('- `' + $record.id + '`（' + $record.source + '，' + $record.readiness + '）：' + $record.reason)
}
$lines += ''
$lines += '## 已退役'
$lines += ''
$lines += '退役 = 系统能「出」的一侧：记录保留供审计，但永不进入 runtime，也不得再激活为入口（重新接入 = 走完整准入五门，不是翻状态）。'
$lines += ''
if ($retired.Count -eq 0) {
    $lines += '（当前无退役记录。）'
} else {
    $lines += '| id | 来源 | 状态 | 原因 |'
    $lines += '|---|---|---|---|'
    foreach ($record in $retired) {
        $lines += ('| `' + $record.id + '` | ' + $record.source + ' | ' + $record.status + ' | ' + $record.reason + ' |')
    }
}
$lines += ''
$lines += '## 功能重叠裁决（duplicateGroups）'
$lines += ''
$lines += '重叠能力已归属到唯一 owner；同一能力有多个技能时按下列规则分工。owner 均登记在 `provenance/OWNER-LEDGER.json`。被标记**（已退役）**的成员不在 runtime 集合内、不可调用，其分工规则文案为退役前口径，仅供溯源。'
$lines += ''
$lines += '| 组 | owner | 成员/别名 | 分工规则 |'
$lines += '|---|---|---|---|'
$arbitrationGroups = @($catalog.duplicateGroups)
$statusById = @{}
foreach ($record in @($records)) { $statusById[[string]$record.id] = [string]$record.status }
foreach ($group in (Sort-ByKeyOrdinal -Items @($arbitrationGroups) -Key id)) {
    $memberList = @()
    if ($group.PSObject.Properties.Name -contains 'members') { $memberList += @($group.members) }
    if ($group.PSObject.Properties.Name -contains 'aliases') { $memberList += @($group.aliases) }
    $memberText = (@($memberList | ForEach-Object {
        $retiredMarker = ''
        if ($statusById.ContainsKey([string]$_) -and $statusById[[string]$_].StartsWith('retired')) { $retiredMarker = '**（已退役）**' }
        '`' + $_ + '`' + $retiredMarker
    }) -join '、')
    $lines += ('| `' + $group.id + '` | `' + $group.owner + '` | ' + $memberText + ' | ' + $group.rule + ' |')
}
$lines += ''
$lines += '## 如何改变可用集合'
$lines += ''
$lines += '1. 改 `provenance/SKILL-CLASSIFICATION.json`（`skills.<id>.readiness`，需要时同时调 `domain`）——这是**唯一**分类入口。'
$lines += '2. 重生成 catalog：`pwsh scripts/build-canonical-catalog.ps1 -RepoRoot <repo>`。'
$lines += '3. 重生成本索引：`pwsh scripts/build-capability-index.ps1 -RepositoryRoot <repo>`。'
$lines += '4. 跑门禁：`pwsh scripts/verify.ps1`。'
$lines += ''
$lines += '不要手工编辑 `CANONICAL-CATALOG.json` 或本文件（两者都是生成物）。'
$lines += ''

$text = ($lines -join "`n") + "`n"
$directory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}
# 确定性字节写出：LF 行尾、无 BOM（Windows 宿主的 Set-Content 会写 CRLF，跨宿主再生会产出
# 整文件级 diff 噪音；本文件与 catalog 一样无 .gitattributes 归一覆盖）。
$indexText = ($text -replace "`r`n", "`n").TrimEnd("`n") + "`n"
[System.IO.File]::WriteAllText($resolvedOutput, $indexText, [System.Text.UTF8Encoding]::new($false))
Write-Output ("Generated " + $resolvedOutput + " (" + $records.Count + " records)")
