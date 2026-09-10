[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    # 要退役的 canonical id（provenance/SKILL-CLASSIFICATION.json 的 skills 键）
    [Parameter(Mandatory = $true)]
    [string]$Id,

    # 退役原因（写入 reasonsById，进入 catalog 记录与能力索引）
    [Parameter(Mandatory = $true)]
    [string]$Reason,

    # 可选：证据文件相对路径（evidence/*.md），会附进 reasonsById
    [Parameter(Mandatory = $false)]
    [string]$Evidence = '',

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 单技能退役工具（退役状态化的「能出」一侧；与准入五门对称，退出也要留痕）。
#
# 做什么：
#   1. fail-closed 校验：id 必须存在；statusPolicy 必须已有 "<domain>|retired" 策略行
#      （为新城开退役行本身就是一次分类决策，工具不代行）。
#   2. 把 skills.<id>.readiness 翻为 retired；在 reasonsById 写入原因 + 证据 + 时间。
#   3. 重生成 catalog 与能力索引，跑路由绑定校验（退役记录脱离 runtime 后绑定数应下降）。
#
# 不做什么：
#   - 不删除宿主侧任何文件；投影安装态的收敛由 install-runtime-projection.ps1 重装完成（工具只提示）。
#   - 不代写 reasonsByStatus：新城的退役状态文案由对应策略行决策一并登记。
#   - 编辑是对分类真源的文本级手术（锚定记录形状），避免整文件 JSON 重排造成审查噪声；
#     形状不匹配时明确失败，请手工编辑。

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
$classificationPath = Join-Path $repoRoot 'provenance/SKILL-CLASSIFICATION.json'
if (-not (Test-Path -LiteralPath $classificationPath -PathType Leaf)) { throw "缺少分类真源: $classificationPath" }
$classification = Get-Content -Raw -Encoding UTF8 -LiteralPath $classificationPath | ConvertFrom-Json

$skills = $classification.skills
if (-not ($skills.PSObject.Properties.Name -contains $Id)) { throw "未知的 canonical id: $Id（不在 SKILL-CLASSIFICATION.json 的 skills 中）" }
$record = $skills.$Id
$domain = [string]$record.domain
$currentReadiness = [string]$record.readiness

if ($currentReadiness -eq 'retired') {
    [pscustomobject]@{ status = 'SKIPPED'; id = $Id; reason = 'already-retired' } | ConvertTo-Json -Compress
    exit 0
}

$policyKey = "$domain|retired"
if (-not ($classification.statusPolicy.PSObject.Properties.Name -contains $policyKey)) {
    throw "fail-closed：statusPolicy 缺少策略行 '$policyKey'。为该域开放退役状态本身是一次分类决策，请先在 SKILL-CLASSIFICATION.json 的 statusPolicy 与 reasonsByStatus 中登记，再运行本工具。"
}

function ConvertTo-JsonStringScalar {
    param([Parameter(Mandatory = $true)][string]$Text)
    return $Text.Replace('\', '\\').Replace('"', '\"')
}

$raw = Get-Content -Raw -Encoding UTF8 -LiteralPath $classificationPath

# 1) 翻 readiness：锚定 "id": { "domain": "...", "readiness": "<旧值>" 的记录形状
$recordPattern = '("' + [regex]::Escape($Id) + '":\s*\{\s*"domain":\s*"[^"]*",\s*"readiness":\s*")[^"]*(")'
$matchInfo = [regex]::Match($raw, $recordPattern)
if (-not $matchInfo.Success) {
    throw "未能在分类真源中定位 $Id 的 readiness 字段（记录形状与预期不同）；请手工编辑后重跑生成器。"
}
$readinessReplacement = $matchInfo.Groups[1].Value + 'retired' + $matchInfo.Groups[2].Value
$raw = $raw.Remove($matchInfo.Index, $matchInfo.Length).Insert($matchInfo.Index, $readinessReplacement)

# 2) 写 reasonsById.<id>：已存在则原位替换，否则插到块首
$reasonScalar = ConvertTo-JsonStringScalar -Text ($Reason + $(if (-not [string]::IsNullOrWhiteSpace($Evidence)) { '（证据: ' + $Evidence + '）' }) + '；retiredAt ' + (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'))
$idJson = ConvertTo-JsonStringScalar -Text $Id
$existingReason = [regex]::Match($raw, '(    "' + [regex]::Escape($Id) + '":\s*")[^"]*(")')
if ($existingReason.Success) {
    $reasonReplacement = $existingReason.Groups[1].Value + $reasonScalar + $existingReason.Groups[2].Value
    $raw = $raw.Remove($existingReason.Index, $existingReason.Length).Insert($existingReason.Index, $reasonReplacement)
} else {
    $blockStart = [regex]::Match($raw, '"reasonsById"\s*:\s*\{\s*')
    if (-not $blockStart.Success) { throw '分类真源缺少 reasonsById 块；请先登记该块再运行本工具。' }
    $nl = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
    $insertAt = $blockStart.Index + $blockStart.Length
    $raw = $raw.Substring(0, $insertAt) + '    "' + $idJson + '": "' + $reasonScalar + '",' + $nl + '    ' + $raw.Substring($insertAt)
}

if ($DryRun) {
    [pscustomobject]@{ status = 'DRY-RUN'; id = $Id; domain = $domain; from = $currentReadiness; to = 'retired'; reason = $Reason; evidence = $Evidence } | ConvertTo-Json -Compress
    exit 0
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($classificationPath, $raw, $utf8NoBom)

# 3) 重生成下游生成物 + 路由绑定校验（退役记录应脱离 runtime 绑定）
#    与 verify.ps1 的 Invoke-Child 同一模式：先初始化 $LASTEXITCODE，靠子脚本的 throw 传播失败。
$global:LASTEXITCODE = 0
$null = & (Join-Path $repoRoot 'scripts/build-canonical-catalog.ps1') -RepoRoot $repoRoot
if ($LASTEXITCODE -ne 0) { throw 'catalog 重生成失败' }
$global:LASTEXITCODE = 0
$null = & (Join-Path $repoRoot 'scripts/build-capability-index.ps1') -RepositoryRoot $repoRoot
if ($LASTEXITCODE -ne 0) { throw '能力索引重生成失败' }
$global:LASTEXITCODE = 0
$null = & (Join-Path $repoRoot 'scripts/validate-route-bindings.ps1') -RepositoryRoot $repoRoot
if ($LASTEXITCODE -ne 0) { throw '路由绑定校验失败' }

[pscustomobject]@{
    status = 'RETIRED'
    id = $Id
    domain = $domain
    from = $currentReadiness
    to = 'retired'
    regenerated = @('provenance/CANONICAL-CATALOG.json', 'docs/CAPABILITY-INDEX.md')
    hostNote = '投影安装态不会自动变化；如该技能曾进入 runtime，请重跑 install-runtime-projection.ps1 收敛宿主目录，再跑 verify.ps1。'
} | ConvertTo-Json -Compress
exit 0
