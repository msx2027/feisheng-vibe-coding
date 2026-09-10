[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(Mandatory = $false)]
    [switch]$IncludePackage
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 单入口验证器：一条命令跑完全部门禁 + 生成物新鲜度校验。
#
# 覆盖：
#   1. catalog 与分类真源同步（重生成后语义比对）
#   2. 能力索引新鲜度（重生成后逐字节比对）
#   3. 发布 NOTICE 门禁
#   4. Vibe Hook 适配器保持禁用
#   5. Codex / Claude 静态投影 Build + Validate
#   6. 可选：发布候选包装配（-IncludePackage）
#
# 本脚本只读仓库、只在临时目录写入；不安装依赖、不写入宿主目录。
# 退出码：0 = 全部通过；1 = 有失败。

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

$results = @()
$workRoot = Join-Path $env:TEMP ('feisheng-verify-' + [guid]::NewGuid().ToString('N'))

function Add-Result {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][bool]$Passed,
        [Parameter(Mandatory = $false)][string]$Detail = ''
    )
    $script:results += [pscustomobject]@{ Step = $Step; Passed = $Passed; Detail = $Detail }
    $mark = if ($Passed) { 'PASS' } else { 'FAIL' }
    $suffix = if ([string]::IsNullOrWhiteSpace($Detail)) { '' } else { ' — ' + $Detail }
    Write-Host ("[$mark] " + $Step + $suffix)
}

function Invoke-Child {
    param(
        [Parameter(Mandatory = $true)][string]$Script,
        [Parameter(Mandatory = $true)][hashtable]$Arguments
    )
    # StrictMode 下 $LASTEXITCODE 可能尚未赋值；先初始化，再调用子脚本。
    $global:LASTEXITCODE = 0
    $output = & $Script @Arguments
    return [pscustomobject]@{ Output = @($output); ExitCode = $LASTEXITCODE }
}

try {
    New-Item -ItemType Directory -Force -Path $workRoot | Out-Null

    # 1) catalog 与分类真源同步
    try {
        $regenCatalog = Join-Path $workRoot 'CANONICAL-CATALOG.json'
        $null = Invoke-Child -Script (Join-Path $repoRoot 'scripts/build-canonical-catalog.ps1') -Arguments @{
            RepoRoot = $repoRoot; OutputPath = $regenCatalog
        }
        $committed = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json') | ConvertFrom-Json
        $regenerated = Get-Content -Raw -Encoding UTF8 -LiteralPath $regenCatalog | ConvertFrom-Json
        $committed.PSObject.Properties.Remove('generatedAt')
        $regenerated.PSObject.Properties.Remove('generatedAt')
        $left = $committed | ConvertTo-Json -Depth 12
        $right = $regenerated | ConvertTo-Json -Depth 12
        if ($left -ne $right) {
            Add-Result -Step 'catalog 与 SKILL-CLASSIFICATION.json 同步' -Passed $false -Detail 'catalog 已过期，请重生成'
        } else {
            Add-Result -Step 'catalog 与 SKILL-CLASSIFICATION.json 同步' -Passed $true
        }
    } catch {
        Add-Result -Step 'catalog 与 SKILL-CLASSIFICATION.json 同步' -Passed $false -Detail $_.Exception.Message
    }

    # 2) 能力索引新鲜度
    try {
        $regenIndex = Join-Path $workRoot 'CAPABILITY-INDEX.md'
        $null = Invoke-Child -Script (Join-Path $repoRoot 'scripts/build-capability-index.ps1') -Arguments @{
            RepositoryRoot = $repoRoot; OutputPath = $regenIndex
        }
        $committedIndexPath = Join-Path $repoRoot 'docs/CAPABILITY-INDEX.md'
        if (-not (Test-Path -LiteralPath $committedIndexPath -PathType Leaf)) {
            Add-Result -Step '能力索引新鲜度' -Passed $false -Detail '缺少 docs/CAPABILITY-INDEX.md'
        } else {
            $a = (Get-Content -Raw -Encoding UTF8 -LiteralPath $committedIndexPath) -replace "`r`n", "`n"
            $b = (Get-Content -Raw -Encoding UTF8 -LiteralPath $regenIndex) -replace "`r`n", "`n"
            if ($a -ne $b) {
                Add-Result -Step '能力索引新鲜度' -Passed $false -Detail 'docs/CAPABILITY-INDEX.md 已过期，请重生成'
            } else {
                Add-Result -Step '能力索引新鲜度' -Passed $true
            }
        }
    } catch {
        Add-Result -Step '能力索引新鲜度' -Passed $false -Detail $_.Exception.Message
    }

    # 3) 发布 NOTICE 门禁
    try {
        $gate = Invoke-Child -Script (Join-Path $repoRoot 'scripts/validate-release-notices.ps1') -Arguments @{
            RepositoryRoot = $repoRoot
        }
        $parsed = ($gate.Output -join "`n") | ConvertFrom-Json
        if ($parsed.status -eq 'PASS') {
            Add-Result -Step '发布 NOTICE 门禁' -Passed $true -Detail ('runtime items = ' + @($parsed.runtimeItems).Count)
        } else {
            Add-Result -Step '发布 NOTICE 门禁' -Passed $false -Detail ('status = ' + $parsed.status)
        }
    } catch {
        Add-Result -Step '发布 NOTICE 门禁' -Passed $false -Detail $_.Exception.Message
    }

    # 4) Vibe Hook 适配器保持禁用
    #    该测试脚本在 Validate != 0 或 Invoke != 3 时会 throw，因此“不抛异常”即通过。
    #    （不能用输出哨兵：测试内部用 [Console]::WriteLine，不进入 PowerShell 输出流。）
    try {
        $null = Invoke-Child -Script (Join-Path $repoRoot 'tests/test-vibe-hook-adapter.ps1') -Arguments @{
            RepositoryRoot = $repoRoot
        }
        Add-Result -Step 'Vibe Hook 适配器保持禁用' -Passed $true
    } catch {
        Add-Result -Step 'Vibe Hook 适配器保持禁用' -Passed $false -Detail $_.Exception.Message
    }

    # 5) 静态投影 Build + Validate
    foreach ($hostName in @('Codex', 'Claude')) {
        $builder = if ($hostName -eq 'Codex') { 'build-codex-runtime-projection.ps1' } else { 'build-claude-runtime-projection.ps1' }
        $outputRoot = Join-Path $workRoot ('proj-' + $hostName.ToLowerInvariant())
        try {
            $build = Invoke-Child -Script (Join-Path $repoRoot ('scripts/' + $builder)) -Arguments @{
                Mode = 'Build'; RepositoryRoot = $repoRoot; OutputRoot = $outputRoot
            }
            $buildParsed = ($build.Output -join "`n") | ConvertFrom-Json
            if ($buildParsed.status -ne 'PASS') { throw ('build status = ' + $buildParsed.status) }
            $validate = Invoke-Child -Script (Join-Path $repoRoot ('scripts/' + $builder)) -Arguments @{
                Mode = 'Validate'; RepositoryRoot = $repoRoot; OutputRoot = $outputRoot
            }
            $validateParsed = ($validate.Output -join "`n") | ConvertFrom-Json
            if ($validateParsed.status -ne 'PASS') { throw ('validate status = ' + $validateParsed.status) }
            Add-Result -Step ($hostName + ' 静态投影 Build + Validate') -Passed $true
        } catch {
            Add-Result -Step ($hostName + ' 静态投影 Build + Validate') -Passed $false -Detail $_.Exception.Message
        }
    }

    # 6) 可选：发布候选包装配
    if ($IncludePackage) {
        try {
            $packageRoot = Join-Path $workRoot 'release'
            $package = Invoke-Child -Script (Join-Path $repoRoot 'scripts/build-release-package.ps1') -Arguments @{
                TargetHost = 'Both'; RepositoryRoot = $repoRoot; PackageRoot = $packageRoot; Label = 'verify'
            }
            $packageParsed = ($package.Output -join "`n") | ConvertFrom-Json
            if ($packageParsed.status -ne 'BUILT') { throw ('status = ' + $packageParsed.status) }
            if (@($packageParsed.forbiddenSegmentViolations).Count -gt 0) { throw '包含被拒绝的路径段' }
            Add-Result -Step '发布候选包装配' -Passed $true -Detail ('files = ' + $packageParsed.packageFileCount)
        } catch {
            Add-Result -Step '发布候选包装配' -Passed $false -Detail $_.Exception.Message
        }
    }
} finally {
    if (Test-Path -LiteralPath $workRoot) {
        Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$failed = @($results | Where-Object { -not $_.Passed })
Write-Host ''
Write-Host ('verify: ' + ($results.Count - $failed.Count) + '/' + $results.Count + ' steps passed')
if ($failed.Count -gt 0) {
    Write-Host 'failed steps:'
    foreach ($item in $failed) { Write-Host ('  - ' + $item.Step + ' :: ' + $item.Detail) }
    exit 1
}
Write-Host 'all gates passed'
exit 0
