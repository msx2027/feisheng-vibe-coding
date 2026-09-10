[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(Mandatory = $false)]
    [string]$ClaudeSkillsRoot = (Join-Path $env:USERPROFILE '.claude/skills'),

    [Parameter(Mandatory = $false)]
    [switch]$Probe,

    [Parameter(Mandatory = $false)]
    [switch]$Install,

    [Parameter(Mandatory = $false)]
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Claude Code 宿主 smoke：验证「fresh-session discovery」这一条仓库自述的未验证项。
#
# 步骤：
#   1) 用 Sliver 自带 build_runtime_bundle.py 按 runtime-manifest 白名单产出干净 bundle（禁止自造安装集）。
#   2) 用 Sliver 自带 validate_runtime_bundle.py 校验（如需 trusted baseline git 对象，按实情报告不可用）。
#   3) -Install：装到 Claude Code 文档指定的 install root（~/.claude/skills/sliver-vibe-coding）。
#      只新建目录，不覆盖既有技能；写回滚清单。
#   4) -Probe：跑一次非交互全新会话（claude -p --debug-file），从 debug 日志读「加载根 + 技能计数 + 我们目录被扫描的证据」。
#   5) -Uninstall：删除我们安装的目录（回滚）。
#
# 注意：本脚本会真实调用本机 claude（消耗用户额度），因此**不接入 verify.ps1**，必须显式调用。
# 本脚本不声称 trust / 行为 / Hook 强制；那些仍是 UNVERIFIED。

if ($Install -and $Uninstall) { throw '-Install 与 -Uninstall 不能同时使用。' }

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
$sliverCore = Join-Path $repoRoot 'governance/sliver-core'
if (-not (Test-Path -LiteralPath $sliverCore -PathType Container)) {
    throw "缺少 Sliver 控制面: $sliverCore"
}
$work = Join-Path $env:TEMP ('sliver-host-smoke-' + [guid]::NewGuid().ToString('N'))
$bundleRoot = Join-Path $work 'sliver-vibe-coding'
$installRoot = Join-Path $ClaudeSkillsRoot 'sliver-vibe-coding'
$report = [ordered]@{ schema = 'feisheng-host-smoke/claude-skill-discovery/v1'; steps = @() }

function Add-Step {
    param([string]$Name, [string]$Status, [string]$Detail = '')
    $script:report.steps += [ordered]@{ step = $Name; status = $Status; detail = $Detail }
    Write-Host ("[" + $Status + "] " + $Name + $(if ($Detail) { ' — ' + $Detail } else { '' }))
}

try {
    New-Item -ItemType Directory -Force -Path $work | Out-Null

    # 1) 构建 bundle（产品自带工具 + 白名单）
    $buildOutput = & python (Join-Path $sliverCore 'scripts/build_runtime_bundle.py') --target claude-code --output $bundleRoot 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("build_runtime_bundle 失败: " + ($buildOutput -join ' ')) }
    $bundleFiles = @(Get-ChildItem -LiteralPath $bundleRoot -Recurse -File)
    Add-Step -Name 'build_runtime_bundle (claude-code)' -Status 'PASS' -Detail ($bundleFiles.Count.ToString() + ' files')

    # 2) 校验（可能因缺 trusted baseline 而不可完成——如实报告）
    $trustedRoots = @()
    if (Test-Path -LiteralPath (Join-Path $sliverCore '.git')) { $trustedRoots += $sliverCore }
    $sourceRootCandidate = 'F:\skiils工具\sliver-vibe-coding'
    if (Test-Path -LiteralPath (Join-Path $sourceRootCandidate '.git')) { $trustedRoots += $sourceRootCandidate }
    $validateArgs = @((Join-Path $sliverCore 'scripts/validate_runtime_bundle.py'), '--target', 'claude-code', '--source-root', $sliverCore)
    if ($trustedRoots.Count -gt 0) { $validateArgs += @('--trusted-base-root', $trustedRoots[0]) }
    $validateArgs += $bundleRoot
    $validateOutput = & python @validateArgs 2>&1
    if ($LASTEXITCODE -eq 0) {
        Add-Step -Name 'validate_runtime_bundle' -Status 'PASS'
    } else {
        Add-Step -Name 'validate_runtime_bundle' -Status 'UNAVAILABLE' -Detail (($validateOutput | Select-Object -Last 1) -join ' ')
    }

    # 3) 安装
    if ($Install) {
        if (Test-Path -LiteralPath $installRoot) {
            Add-Step -Name 'install' -Status 'SKIPPED' -Detail ('目标已存在（拒绝覆盖）: ' + $installRoot)
        } else {
            New-Item -ItemType Directory -Force -Path $ClaudeSkillsRoot | Out-Null
            Copy-Item -LiteralPath $bundleRoot -Destination $installRoot -Recurse
            $installed = @(Get-ChildItem -LiteralPath $installRoot -Recurse -File)
            $manifestPath = Join-Path $work 'install-manifest.json'
            $manifest = [ordered]@{
                installedTo = $installRoot
                fileCount = $installed.Count
                rollback = 'Remove-Item -Recurse -Force "' + $installRoot + '"'
            }
            $manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath $manifestPath
            Add-Step -Name 'install' -Status 'PASS' -Detail ($installed.Count.ToString() + ' files -> ' + $installRoot)
        }
    }

    # 4) 全新会话探测
    if ($Probe) {
        if (-not (Test-Path -LiteralPath (Join-Path $installRoot 'SKILL.md'))) {
            Add-Step -Name 'probe' -Status 'SKIPPED' -Detail '未安装，先加 -Install'
        } else {
            $steps = @()
            foreach ($phase in @('with-skill', 'without-skill')) {
                $hold = Join-Path $work ('hold-' + $phase)
                if ($phase -eq 'without-skill') { Move-Item -LiteralPath $installRoot -Destination $hold }
                try {
                    $probeDir = Join-Path $work ('probe-' + $phase)
                    New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
                    $debugLog = Join-Path $probeDir 'claude-debug.log'
                    Push-Location $probeDir
                    try {
                        $null = & claude --debug-file $debugLog -p 'Reply with exactly: ok' 2>&1
                    } finally { Pop-Location }
                    if (-not (Test-Path -LiteralPath $debugLog)) { throw ('未生成 debug 日志: ' + $debugLog) }
                    $logText = Get-Content -Raw -LiteralPath $debugLog
                    $loadingMatch = [regex]::Match($logText, 'Loading skills from: ([^\r\n]+)')
                    $countMatch = [regex]::Match($logText, 'Loaded (\d+) unique skills')
                    $touched = ([regex]::Matches($logText, 'sliver-vibe-coding')).Count
                    $steps += [pscustomobject]@{
                        phase = $phase
                        loadingRoots = if ($loadingMatch.Success) { $loadingMatch.Groups[1].Value } else { '' }
                        loadedCount = if ($countMatch.Success) { [int]$countMatch.Groups[1].Value } else { -1 }
                        mentionsOfOurSkill = $touched
                    }
                } finally {
                    if ($phase -eq 'without-skill' -and (Test-Path -LiteralPath $hold)) { Move-Item -LiteralPath $hold -Destination $installRoot }
                }
            }
            $with = @($steps | Where-Object { $_.phase -eq 'with-skill' })[0]
            $without = @($steps | Where-Object { $_.phase -eq 'without-skill' })[0]
            $delta = $with.loadedCount - $without.loadedCount
            $report.probe = [ordered]@{
                loadedWithSkill = $with.loadedCount
                loadedWithoutSkill = $without.loadedCount
                delta = $delta
                loadingRoots = $with.loadingRoots
                discoveryVerdict = if ($delta -ge 1) { 'DISCOVERED' } else { 'NOT-DISCOVERED' }
            }
            Add-Step -Name 'probe (A/B 全新会话)' -Status $(if ($delta -ge 1) { 'PASS' } else { 'FAIL' }) -Detail ($with.loadedCount.ToString() + ' vs ' + $without.loadedCount.ToString() + ' (delta ' + $delta.ToString() + ')')
        }
    }

    # 5) 卸载
    if ($Uninstall) {
        if (Test-Path -LiteralPath $installRoot) {
            Remove-Item -LiteralPath $installRoot -Recurse -Force
            Add-Step -Name 'uninstall' -Status 'PASS' -Detail $installRoot
        } else {
            Add-Step -Name 'uninstall' -Status 'SKIPPED' -Detail '未安装'
        }
    }
} finally {
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}

$report.note = 'discovery verification only; host trust, behavioral correctness, and Hook enforcement remain UNVERIFIED'
$report | ConvertTo-Json -Depth 8
