[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('Claude', 'Codex', 'Both')]
    [string]$TargetHost = 'Both',

    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(Mandatory = $false)]
    # 上游 sliver git 检出路径（仅 -FetchTrustedBaseline 用）。三个源项目已于 2026-09-11 归档并删除
    # 本地源目录，默认为空 = 不传 --trusted-base-root（深度校验按 UNAVAILABLE 软降级）；
    # 如需按 SHA 取回基线对象，显式传入仍包含该 revision 的上游 git 检出。
    [string]$SourceRepositoryRoot = '',

    [Parameter(Mandatory = $false)]
    [switch]$FetchTrustedBaseline,

    [Parameter(Mandatory = $false)]
    [switch]$Install,

    [Parameter(Mandatory = $false)]
    [switch]$Uninstall,

    [Parameter(Mandatory = $false)]
    [switch]$Probe
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 宿主 smoke（Claude Code / Codex）：验证「fresh-session discovery」这一条自述未验证项。
#
# 约定（owner 要求）：
#   - 所有测试脚手架都放在**本仓库根目录**的 _smoke/（已 gitignore），最后统一清理。
#   - 不污染其它 Claude/Codex：只新建本项目技能的 install root，不覆盖任何既有技能；
#     探测时用「临时移出再放回」做 A/B，不修改宿主既有内容。
#   - 安装内容必须由 Sliver 自带 build_runtime_bundle.py 按 runtime-manifest.json 产出，禁止自造安装集。
#   - 调用 Python 一律带 -B，避免在快照里生成 __pycache__（会触发 provenance 门禁）。
#   - 只验证「发现性」；trust / 技能行为 / Hook 强制仍是 UNVERIFIED。
#
# 用法示例：
#   .\scripts\smoke-host-skill-discovery.ps1 -TargetHost Both -Probe
#   .\scripts\smoke-host-skill-discovery.ps1 -TargetHost Codex -Install
#   .\scripts\smoke-host-skill-discovery.ps1 -TargetHost Codex -Uninstall
# 注意：-Probe 会真实调用本机 claude / codex（消耗额度），因此**不接入 verify.ps1**。

if ($Install -and $Uninstall) { throw '-Install 与 -Uninstall 不能同时使用。' }

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
$sliverCore = Join-Path $repoRoot 'governance/sliver-core'
if (-not (Test-Path -LiteralPath $sliverCore -PathType Container)) { throw "缺少 Sliver 控制面: $sliverCore" }

$smokeRoot = Join-Path $repoRoot '_smoke'
New-Item -ItemType Directory -Force -Path $smokeRoot | Out-Null

$hostKeys = if ($TargetHost -eq 'Both') { @('claude-code', 'codex') } else { @($(if ($TargetHost -eq 'Claude') { 'claude-code' } else { 'codex' })) }
$skillId = 'sliver-vibe-coding'

$report = [ordered]@{ schema = 'feisheng-host-smoke/skill-discovery/v1'; hosts = @() }

function Add-Entry {
    param([hashtable]$Bucket, [string]$Name, [string]$Status, [string]$Detail = '')
    $Bucket.steps += [ordered]@{ step = $Name; status = $Status; detail = $Detail }
    Write-Host ("  [" + $Status + "] " + $Name + $(if ($Detail) { ' — ' + $Detail } else { '' }))
}

function Get-InstallRoot {
    param([string]$HostKey)
    # 注意：必须把字符串拼接括起来，否则 Join-Path 会把 '+' 当字面参数
    if ($HostKey -eq 'claude-code') { return (Join-Path $env:USERPROFILE ('.claude/skills/' + $skillId)) }
    return (Join-Path $env:USERPROFILE ('.codex/skills/' + $skillId))
}

# 受信任基线：从 Sliver 自己的 baseline 记录里读 SHA（不硬编码）
function Get-TrustedBaselineRevision {
    $candidates = @(Get-ChildItem -LiteralPath (Join-Path $sliverCore 'tests/governance') -Filter 'baseline-*.json' -File -ErrorAction SilentlyContinue)
    foreach ($candidate in $candidates) {
        $record = Get-Content -Raw -Encoding UTF8 -LiteralPath $candidate.FullName | ConvertFrom-Json
        if ($record.PSObject.Properties.Name -contains 'source_commit' -and -not [string]::IsNullOrWhiteSpace([string]$record.source_commit)) {
            return [string]$record.source_commit
        }
    }
    return $null
}

if ($FetchTrustedBaseline) {
    if ([string]::IsNullOrWhiteSpace($SourceRepositoryRoot) -or -not (Test-Path -LiteralPath $SourceRepositoryRoot -PathType Container)) {
        throw '已无上游 sliver 检出（源项目 2026-09-11 归档）；如需 trusted baseline，请用 -SourceRepositoryRoot 显式传入包含该 revision 的 git 检出。'
    }
    $revision = Get-TrustedBaselineRevision
    if ([string]::IsNullOrWhiteSpace($revision)) { throw '无法从 Sliver baseline 记录中读出 source_commit。' }
    $exists = (& git -C $SourceRepositoryRoot cat-file -t $revision 2>$null)
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("[SKIP] trusted baseline already available: " + $revision.Substring(0, 12))
    } else {
        Write-Host ("[..] fetching trusted baseline by SHA (origin): " + $revision.Substring(0, 12))
        & git -C $SourceRepositoryRoot fetch origin $revision 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw '按 SHA fetch 基线对象失败。' }
        Write-Host ("[PASS] trusted baseline fetched: " + $revision.Substring(0, 12))
    }
    $report.trustedBaselineRevision = $revision
}

foreach ($hostKey in $hostKeys) {
    $bucket = @{ host = $hostKey; steps = @() }
    Write-Host ("== " + $hostKey + " ==")
    $bundleRoot = Join-Path $smokeRoot ('bundles/' + $hostKey + '/' + $skillId)

    # 1) 构建（产品自带工具 + 白名单）
    if (Test-Path -LiteralPath $bundleRoot) { Remove-Item -LiteralPath $bundleRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $bundleRoot) | Out-Null
    $buildOutput = & python -B (Join-Path $sliverCore 'scripts/build_runtime_bundle.py') --target $hostKey --output $bundleRoot 2>&1
    if ($LASTEXITCODE -ne 0) { Add-Entry -Bucket $bucket -Name 'build_runtime_bundle' -Status 'FAIL' -Detail ($buildOutput -join ' ') }
    else { Add-Entry -Bucket $bucket -Name 'build_runtime_bundle' -Status 'PASS' -Detail ((@(Get-ChildItem -LiteralPath $bundleRoot -Recurse -File)).Count.ToString() + ' files') }

    # 2) 深度校验（需要 trusted baseline 对象）
    $validateArgs = @((Join-Path $sliverCore 'scripts/validate_runtime_bundle.py'), '--target', $hostKey, '--source-root', $sliverCore)
    if (Test-Path -LiteralPath $SourceRepositoryRoot -PathType Container) { $validateArgs += @('--trusted-base-root', $SourceRepositoryRoot) }
    $validateArgs += $bundleRoot
    $validateOutput = & python -B @validateArgs 2>&1
    if ($LASTEXITCODE -eq 0) { Add-Entry -Bucket $bucket -Name 'validate_runtime_bundle' -Status 'PASS' -Detail ($validateOutput | Select-Object -Last 1) }
    else { Add-Entry -Bucket $bucket -Name 'validate_runtime_bundle' -Status 'UNAVAILABLE' -Detail (($validateOutput | Select-Object -Last 1) -join ' ') }

    $installRoot = Get-InstallRoot -HostKey $hostKey

    # 3) 安装 / 卸载
    if ($Install) {
        if (Test-Path -LiteralPath $installRoot) { Add-Entry -Bucket $bucket -Name 'install' -Status 'SKIPPED' -Detail ('已存在，拒绝覆盖: ' + $installRoot) }
        else {
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $installRoot) | Out-Null
            Copy-Item -LiteralPath $bundleRoot -Destination $installRoot -Recurse
            Add-Entry -Bucket $bucket -Name 'install' -Status 'PASS' -Detail (((@(Get-ChildItem -LiteralPath $installRoot -Recurse -File)).Count.ToString()) + ' files -> ' + $installRoot)
        }
    }
    if ($Uninstall) {
        if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force; Add-Entry -Bucket $bucket -Name 'uninstall' -Status 'PASS' -Detail $installRoot }
        else { Add-Entry -Bucket $bucket -Name 'uninstall' -Status 'SKIPPED' -Detail '未安装' }
    }

    # 4) A/B 探测（只动我们自己的 install root，不动宿主既有内容）
    if ($Probe) {
        $hold = Join-Path $smokeRoot ('hold/' + $hostKey)
        if (Test-Path -LiteralPath $hold) { Remove-Item -LiteralPath $hold -Recurse -Force }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $hold) | Out-Null

        function Invoke-ProbeOnce {
            param([string]$HostKey, [string]$Tag)
            $probeDir = Join-Path $smokeRoot ('probe/' + $HostKey + '-' + $Tag)
            New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
            Push-Location $probeDir
            try {
                if ($HostKey -eq 'claude-code') {
                    $logPath = Join-Path $probeDir 'claude-debug.log'
                    $null = & claude --debug-file $logPath -p 'Reply with exactly: ok' 2>&1
                    if (-not (Test-Path -LiteralPath $logPath)) { throw '未生成 claude debug 日志。' }
                    $text = Get-Content -Raw -LiteralPath $logPath
                    $countMatch = [regex]::Match($text, 'Loaded (\d+) unique skills')
                    $rootMatch = [regex]::Match($text, 'Loading skills from: ([^\r\n]+)')
                    return [pscustomobject]@{
                        loadedCount = if ($countMatch.Success) { [int]$countMatch.Groups[1].Value } else { -1 }
                        roots = if ($rootMatch.Success) { $rootMatch.Groups[1].Value } else { '' }
                        entries = ([regex]::Matches($text, $skillId)).Count
                    }
                } else {
                    $outPath = Join-Path $probeDir 'codex-prompt-input.json'
                    $null = & codex debug prompt-input 2>&1 | Set-Content -Encoding UTF8 -LiteralPath $outPath
                    $text = Get-Content -Raw -LiteralPath $outPath
                    $roots = @([regex]::Matches($text, '(r\d+)/' + [regex]::Escape($skillId) + '/SKILL\.md') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique)
                    return [pscustomobject]@{
                        loadedCount = ([regex]::Matches($text, '\(file: r\d+')).Count
                        roots = ($roots -join ',')
                        entries = ([regex]::Matches($text, $skillId)).Count
                    }
                }
            } finally { Pop-Location }
        }

        $installed = Test-Path -LiteralPath $installRoot
        $withSkill = Invoke-ProbeOnce -HostKey $hostKey -Tag 'with'
        $withoutSkill = $null
        if ($installed) {
            Move-Item -LiteralPath $installRoot -Destination $hold
            try { $withoutSkill = Invoke-ProbeOnce -HostKey $hostKey -Tag 'without' }
            finally { Move-Item -LiteralPath $hold -Destination $installRoot }
        }

        # Codex 会同时读共享 junction 根（~/.claude/skills 的别名），因此单看计数可能不降；
        # 判定同时看「计数是否增加」与「是否新出现该技能自己的根」。
        $rootsWith = @($withSkill.roots -split ',' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $rootsWithout = @()
        if ($null -ne $withoutSkill) { $rootsWithout = @($withoutSkill.roots -split ',' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) }
        $gainedRoots = @($rootsWith | Where-Object { $rootsWithout -notcontains $_ })
        $countDelta = if ($null -ne $withoutSkill) { $withSkill.loadedCount - $withoutSkill.loadedCount } else { 0 }
        $bucket.probe = [ordered]@{
            installedDuringProbe = $installed
            withSkill = [ordered]@{ loadedCount = $withSkill.loadedCount; skillRoots = $withSkill.roots; mentions = $withSkill.entries }
            withoutSkill = if ($null -ne $withoutSkill) { [ordered]@{ loadedCount = $withoutSkill.loadedCount; skillRoots = $withoutSkill.roots; mentions = $withoutSkill.entries } } else { $null }
            countDelta = $countDelta
            gainedSkillRoots = $gainedRoots
        }
        $verdict = if ($null -eq $withoutSkill) { 'BASELINE-ONLY' }
                   elseif ($countDelta -gt 0 -or $gainedRoots.Count -gt 0) { 'DISCOVERED' }
                   else { 'INDETERMINATE' }
        $bucket.probe.discoveryVerdict = $verdict
        Add-Entry -Bucket $bucket -Name 'probe (A/B fresh session)' -Status $(if ($verdict -eq 'DISCOVERED') { 'PASS' } else { 'INFO' }) -Detail ("with=" + $withSkill.loadedCount + " without=" + $(if ($null -ne $withoutSkill) { $withoutSkill.loadedCount } else { 'n/a' }) + " gainedRoots=[" + ($gainedRoots -join ',') + "] roots=[" + $withSkill.roots + "]")
    }

    $bucket.installRoot = $installRoot
    $bucket.rollback = 'Remove-Item -Recurse -Force "' + $installRoot + '"'
    $report.hosts += $bucket
}

$report.note = 'discovery verification only; host trust, behavioral correctness, and Hook enforcement remain UNVERIFIED'
$report.smokeRoot = $smokeRoot
$report | ConvertTo-Json -Depth 10
