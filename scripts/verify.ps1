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

# 共享模块（单一实现，不在本脚本里复制一份）
$provenanceModule = Join-Path $PSScriptRoot 'provenance-integrity.ps1'
if (-not (Test-Path -LiteralPath $provenanceModule -PathType Leaf)) {
    throw "缺少 provenance integrity 模块: $provenanceModule"
}
. $provenanceModule

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

    # 1b) runtime include 内容完整性
    #     「接受」在本仓库意味着把内容导入 sources/ 之外的一等位置；那么一等副本与登记的
    #     sourceSha256 就不能静默漂移。这道门禁把「导入的内容 == 登记的内容」变成可验证事实，
    #     而不是靠人工记忆。（控制面记录同样纳入：sliver-core/SKILL.md 也在 catalog 里有 sha。）
    try {
        $catalogDoc = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json') | ConvertFrom-Json
        $runtimeStatuses = @($catalogDoc.decisionPolicy.acceptedStatuses)
        $runtimeDrift = @()
        $runtimeChecked = 0
        foreach ($runtimeRecord in @($catalogDoc.records)) {
            if ($runtimeStatuses -notcontains $runtimeRecord.status) { continue }
            $runtimeRelativePath = ([string]$runtimeRecord.path).Replace('\', '/')
            $runtimeFullPath = Join-Path $repoRoot ($runtimeRelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
            if (-not (Test-Path -LiteralPath $runtimeFullPath -PathType Leaf)) {
                $runtimeDrift += ($runtimeRecord.id + ' (文件缺失)')
                continue
            }
            $runtimeActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $runtimeFullPath).Hash.ToLowerInvariant()
            if ($runtimeActualHash -ne [string]$runtimeRecord.sourceSha256) {
                $runtimeDrift += ($runtimeRecord.id + ' (sha 与登记不一致)')
            }
            $runtimeChecked++
        }
        if ($runtimeDrift.Count -gt 0) {
            Add-Result -Step 'runtime include 内容完整性' -Passed $false -Detail ($runtimeDrift -join '; ')
        } else {
            Add-Result -Step 'runtime include 内容完整性' -Passed $true -Detail ('files = ' + $runtimeChecked)
        }
    } catch {
        Add-Result -Step 'runtime include 内容完整性' -Passed $false -Detail $_.Exception.Message
    }

    # 1c) 导入副本与快照一致性（与 eol 无关的忠实性证据）
    #     1b 的「与登记的 sourceSha256 比对」沿用的是既有约定，但它的字节依赖于 checkout 行为：
    #     core.autocrlf=true 时，同一棵树里的快照与导入副本会经受同样的换行变换，
    #     而登记的 sha 不会。所以这里再做一次「一等副本 == 它派生自的快照文件」的逐文件比对：
    #     两边同处一个工作树，同一变换，因此这一条与机器/配置无关（已实测：fresh clone 下 1b 会因 eol 抖动，1c 不会）。
    try {
        $importRecordPath = Join-Path $repoRoot 'provenance/VIBE-IMPORTS.json'
        if (-not (Test-Path -LiteralPath $importRecordPath -PathType Leaf)) {
            Add-Result -Step '导入副本与快照一致性' -Passed $true -Detail '无 Vibe 导入记录（0 个导入技能）'
        } else {
            $importRecord = Get-Content -Raw -Encoding UTF8 -LiteralPath $importRecordPath | ConvertFrom-Json
            $importFailures = @()
            $importFileCount = 0
            foreach ($importEntry in @($importRecord.imports)) {
                $sourceRelativeRoot = ([string]$importEntry.sourcePath).Replace('\', '/')
                $destinationRelativeRoot = ([string]$importEntry.destination).Replace('\', '/')
                if ([string]::IsNullOrWhiteSpace($sourceRelativeRoot) -or [string]::IsNullOrWhiteSpace($destinationRelativeRoot)) {
                    $importFailures += ([string]$importEntry.id + ' (导入记录缺源/目标路径)')
                    continue
                }
                foreach ($fileEntry in @($importEntry.files)) {
                    $fileRelative = ([string]$fileEntry.path).Replace('\', '/')
                    $sourceFullPath = Join-Path $repoRoot (($sourceRelativeRoot + '/' + $fileRelative).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
                    $destinationFullPath = Join-Path $repoRoot (($destinationRelativeRoot + '/' + $fileRelative).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
                    if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Leaf)) {
                        $importFailures += ([string]$importEntry.id + '/' + $fileRelative + ' (快照文件缺失)')
                        continue
                    }
                    if (-not (Test-Path -LiteralPath $destinationFullPath -PathType Leaf)) {
                        $importFailures += ([string]$importEntry.id + '/' + $fileRelative + ' (导入副本缺失)')
                        continue
                    }
                    $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceFullPath).Hash.ToLowerInvariant()
                    $destinationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $destinationFullPath).Hash.ToLowerInvariant()
                    if ($sourceHash -ne $destinationHash) {
                        $importFailures += ([string]$importEntry.id + '/' + $fileRelative + ' (与快照不一致)')
                    }
                    $importFileCount++
                }
            }
            if ($importFailures.Count -gt 0) {
                Add-Result -Step '导入副本与快照一致性' -Passed $false -Detail ($importFailures -join '; ')
            } else {
                Add-Result -Step '导入副本与快照一致性' -Passed $true -Detail ('files = ' + $importFileCount)
            }
        }
    } catch {
        Add-Result -Step '导入副本与快照一致性' -Passed $false -Detail $_.Exception.Message
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

    # 3) 来源快照完整性（自证树摘要 + 来源逐字节交叉校验；来源不可用时只做自证）
    try {
        $integrity = Test-ProvenanceIntegrity -RepositoryRoot $repoRoot
        if ($integrity.ok) {
            $detail = (@($integrity.snapshots) | ForEach-Object { $_.name + '=' + $_.fileCount }) -join ', '
            Add-Result -Step '来源快照完整性' -Passed $true -Detail $detail
        } else {
            Add-Result -Step '来源快照完整性' -Passed $false -Detail (@($integrity.errors) -join '; ')
        }
    } catch {
        Add-Result -Step '来源快照完整性' -Passed $false -Detail $_.Exception.Message
    }

    # 4) 发布 NOTICE 门禁
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

    # 5) Vibe Hook 适配器保持禁用
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

    # 6) 静态投影 Build + Validate
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

    # 7) 可选：发布候选包装配
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
