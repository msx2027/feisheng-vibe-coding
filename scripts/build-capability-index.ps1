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
    param([Parameter(Mandatory = $true)][object[]]$Items)
    $map = @{}
    foreach ($item in $Items) { $map[[string]$item.id] = $item }
    $ids = [string[]]@($map.Keys)
    [Array]::Sort($ids, [System.StringComparer]::Ordinal)
    return @($ids | ForEach-Object { $map[$_] })
}

function Sort-ByKeyOrdinal {
    param(
        [Parameter(Mandatory = $true)][object[]]$Items,
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

$lines = @()
$lines += '# 能力索引（生成物）'
$lines += ''
$lines += '> 本文件由 `scripts/build-capability-index.ps1` 从 `provenance/CANONICAL-CATALOG.json` 生成；**禁止手工编辑**。'
$lines += '> 分类唯一真源是 `provenance/SKILL-CLASSIFICATION.json`；改分类 = 改该文件后重生成 catalog。'
$lines += '> 新鲜度校验：`pwsh scripts/verify.ps1`。'
$lines += ''
$lines += ('统计：共 **' + $records.Count + '** 项来源技能 —— 可用 ' + $runtime.Count + '、待启用 ' + $pending.Count + '、来源专用 ' + $sourceOnly.Count + '、阻塞 ' + $blocked.Count + '、兼容/排除 ' + $excluded.Count + '。')
$lines += ''
$lines += '## 现在可用（进入 runtime 静态投影）'
$lines += ''
$lines += ('仅 `decisionPolicy.acceptedStatuses` = `' + ($acceptedStatuses -join '`, `') + '` 可进入 runtime；其余一律排除。')
$lines += ''
$lines += '| id | 来源 | 域 | 状态 | 可写（writeAuthority） | 路径 |'
$lines += '|---|---|---|---|---|---|'
foreach ($record in $runtime) {
    $authority = @()
    if ($record.PSObject.Properties.Name -contains 'writeAuthority' -and $null -ne $record.writeAuthority) {
        $authority = @($record.writeAuthority)
    }
    $authorityText = if ($authority.Count -eq 0) { '未声明' } else { (@($authority) -join '、') }
    $lines += ('| `' + $record.id + '` | ' + $record.source + ' | ' + $record.domain + ' | ' + $record.status + ' | ' + $authorityText + ' | `' + $record.path + '` |')
}
$lines += ''
$lines += '再次提醒：投影是**静态候选**，宿主 discovery / trust / fresh-session smoke 仍为 `UNVERIFIED`。'
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
$lines += '| id | 来源 | 域 | 原因 |'
$lines += '|---|---|---|---|'
foreach ($record in $blocked) {
    $lines += ('| `' + $record.id + '` | ' + $record.source + ' | ' + $record.domain + ' | ' + $record.reason + ' |')
}
$lines += ''
$lines += '## 兼容与排除'
$lines += ''
foreach ($record in $excluded) {
    $lines += ('- `' + $record.id + '`（' + $record.source + '，' + $record.readiness + '）：' + $record.reason)
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
Set-Content -Encoding UTF8 -LiteralPath $resolvedOutput -Value $text
Write-Output ("Generated " + $resolvedOutput + " (" + $records.Count + " records)")
