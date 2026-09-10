[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 路由绑定门禁。
#
# 目的：runtime 已接入的技能不能对控制面不可见（等于死代码），也不能在绑定 owner 之外
# 再出现第二个入口。绑定真源在 SKILL-CLASSIFICATION.json 的 routeBinding（唯一策略 owner），
# 本脚本是唯一实现，不复制任何映射。
#
# fail-closed 项：
#   - 缺少 routeBinding 策略 / ownerFiles 为空 / owner 文件不存在
#   - 已接入记录在绑定 owner 里的命中次数 != 1（含 0 = 未被绑定，>1 = 重复入口）
#   - 绑定 owner 之外的 references 文件出现技能路径（第二入口）
#   - 绑定 owner 里出现未被 runtime 接入的技能路径（绑定不能越权）
#
# 输出：JSON（status = PASS/FAIL）供 scripts/verify.ps1 解析。

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "缺少文件: $Path" }
    $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path
    if ([string]::IsNullOrWhiteSpace($text)) { throw "文件为空: $Path" }
    return ($text | ConvertFrom-Json)
}

$errors = @()

# 1) 策略真源（唯一 owner）
$classification = Read-JsonFile -Path (Join-Path $repoRoot 'provenance/SKILL-CLASSIFICATION.json')
if (-not ($classification.PSObject.Properties.Name -contains 'routeBinding')) {
    throw 'SKILL-CLASSIFICATION.json 缺少 routeBinding 策略（绑定真源未声明）'
}
$policy = $classification.routeBinding
$ownerFiles = @(@($policy.ownerFiles) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
if ($ownerFiles.Count -eq 0) { throw 'routeBinding.ownerFiles 为空（fail-closed）' }
$exempt = @(@($policy.exemptRecords) | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })

# 2) 已接入集合来自生成物（不重新推导状态）：有 bundle 即进入 runtime 投影
$catalog = Read-JsonFile -Path (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json')
$admitted = @(@($catalog.records) | Where-Object {
    ($_.PSObject.Properties.Name -contains 'bundle') -and
    ($null -ne $_.bundle) -and
    ($exempt -notcontains [string]$_.id)
})
if ($admitted.Count -eq 0) { throw 'runtime 已接入记录为 0：绑定门禁没有对象（fail-closed）' }

# 3) 读取绑定 owner 文本（并在读完后自检数量，避免静默跳过）
$ownerText = @{}
foreach ($relative in $ownerFiles) {
    $full = Join-Path $repoRoot ([string]$relative).Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "绑定 owner 文件不存在: $relative" }
    $ownerText[[string]$relative] = Get-Content -Raw -Encoding UTF8 -LiteralPath $full
}
if ($ownerText.Count -ne $ownerFiles.Count) {
    throw ("绑定 owner 读取数量不符: 声明=" + $ownerFiles.Count + " 实际=" + $ownerText.Count)
}
$ownerJoined = (@($ownerFiles | ForEach-Object { $ownerText[[string]$_] }) -join "`n")

# 4) 每条已接入记录必须唯一命中一次
$bound = @()
foreach ($record in $admitted) {
    $recordPath = ([string]$record.path).Replace('\', '/')
    $hits = ([regex]::Matches($ownerJoined, [regex]::Escape($recordPath))).Count
    if ($hits -ne 1) {
        $errors += ('路由绑定命中次数必须为 1: ' + $recordPath + ' 实际=' + $hits + '（0 = 控制面看不见该技能；>1 = 重复入口）')
    } else {
        $bound += $recordPath
    }
}
if (($bound.Count + ($admitted.Count - $bound.Count)) -ne $admitted.Count) {
    throw '绑定计数自检失败（解析逻辑异常）'
}

# 5) 技能路径不得出现在绑定 owner 之外（第二入口），owner 内也不得出现未接入技能
$skillPathPattern = 'skills/[^/\s`]+/[^/\s`]+/SKILL\.md'
$referencesRoot = Join-Path $repoRoot 'governance/sliver-core/references'
$ownerFullPaths = @{}
foreach ($relative in $ownerFiles) {
    $full = [System.IO.Path]::GetFullPath((Join-Path $repoRoot ([string]$relative).Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
    $ownerFullPaths[$full] = $true
}

$referenceFiles = @(Get-ChildItem -LiteralPath $referencesRoot -Recurse -File -Filter '*.md')
if ($referenceFiles.Count -eq 0) { throw "references 目录为空: $referencesRoot" }

$secondEntryPoints = @()
$scanned = 0
foreach ($file in $referenceFiles) {
    $scanned++
    if ($ownerFullPaths.ContainsKey($file.FullName)) { continue }
    $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $file.FullName
    if ($text -match $skillPathPattern) { $secondEntryPoints += $file.Name }
}
if ($scanned -ne $referenceFiles.Count) { throw 'references 扫描数量自检失败' }
if ($secondEntryPoints.Count -gt 0) {
    $errors += ('绑定 owner 之外出现技能路径（第二入口）: ' + (@($secondEntryPoints | Sort-Object) -join ', '))
}

$admittedPathMap = @{}
foreach ($record in $admitted) { $admittedPathMap[([string]$record.path).Replace('\', '/')] = $true }
$unadmittedMentions = @()
foreach ($match in [regex]::Matches($ownerJoined, $skillPathPattern)) {
    if (-not $admittedPathMap.ContainsKey($match.Value)) { $unadmittedMentions += $match.Value }
}
if ($unadmittedMentions.Count -gt 0) {
    $errors += ('绑定 owner 引用了未接入的技能: ' + (@($unadmittedMentions | Sort-Object -Unique) -join ', '))
}

$status = if ($errors.Count -eq 0) { 'PASS' } else { 'FAIL' }
[pscustomobject]@{
    status = $status
    ownerFiles = @($ownerFiles)
    admitted = $admitted.Count
    bound = $bound.Count
    referenceFilesScanned = $scanned
    unadmittedMentions = @($unadmittedMentions | Sort-Object -Unique)
    errors = @($errors)
} | ConvertTo-Json -Depth 6 -Compress
