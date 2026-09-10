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
    #     sha256 就不能静默漂移。覆盖范围是**整个 bundle**（catalog 的 bundle.files 逐文件 sha），
    #     而不只是 SKILL.md —— 否则引用的 reference/ 等文件漂移不会被发现。
    try {
        $catalogDoc = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json') | ConvertFrom-Json
        $runtimeStatuses = @($catalogDoc.decisionPolicy.acceptedStatuses)
        $runtimeDrift = @()
        $runtimeChecked = 0
        foreach ($runtimeRecord in @($catalogDoc.records)) {
            if ($runtimeStatuses -notcontains $runtimeRecord.status) { continue }

            $runtimeFiles = @()
            $hasBundle = ($runtimeRecord.PSObject.Properties.Name -contains 'bundle') -and ($null -ne $runtimeRecord.bundle)
            if ($hasBundle) {
                foreach ($bundleFile in @($runtimeRecord.bundle.files)) {
                    $runtimeFiles += [pscustomobject]@{ path = [string]$bundleFile.path; sha256 = [string]$bundleFile.sha256 }
                }
                # 纵深防御：bundle 必须含记录自身的文件（手工改 catalog 时也能拦住）
                $selfFile = @($runtimeFiles | Where-Object { $_.path -eq [string]$runtimeRecord.path })
                if ($selfFile.Count -ne 1) {
                    $runtimeDrift += ([string]$runtimeRecord.id + ' (bundle 不含记录自身 path)')
                    continue
                }
            } else {
                $runtimeFiles += [pscustomobject]@{ path = [string]$runtimeRecord.path; sha256 = [string]$runtimeRecord.sourceSha256 }
            }

            foreach ($runtimeFile in $runtimeFiles) {
                $runtimeRelativePath = ([string]$runtimeFile.path).Replace('\', '/')
                $runtimeFullPath = Join-Path $repoRoot ($runtimeRelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
                if (-not (Test-Path -LiteralPath $runtimeFullPath -PathType Leaf)) {
                    $runtimeDrift += ($runtimeRelativePath + ' (文件缺失)')
                    continue
                }
                $runtimeActualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $runtimeFullPath).Hash.ToLowerInvariant()
                if ($runtimeActualHash -ne [string]$runtimeFile.sha256) {
                    $runtimeDrift += ($runtimeRelativePath + ' (sha 与登记不一致)')
                }
                $runtimeChecked++
            }
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

    # 1d) 保真树的换行可复现性（把刚修好的不变量锁住，防回归）
    #     目标：不管 runner 的 core.autocrlf 是什么值，保真树在 clone 后都得到与登记 sha 一致的字节。
    #     做法：对保真树逐文件检查 ①属性确实是 -text（规则覆盖到、且没被删）
    #     ②索引 blob 与工作树字节一致（i/ 与 w/ 相同）—— 后者就是「clone 会原样还原」的等价表述。
    #     反例：删掉 .gitattributes 规则、或在自动转换生效时重新 add 快照，都会被这条抓。
    try {
        Get-Command git -ErrorAction Stop | Out-Null
        $fidelityTrees = @('sources', 'skills', 'governance/sliver-core')
        $eolOutput = @(& git -C $repoRoot ls-files --eol -- @fidelityTrees 2>$null)
        if ($LASTEXITCODE -ne 0) { throw 'git ls-files --eol 执行失败' }
        if ($eolOutput.Count -eq 0) { throw '保真树没有任何已跟踪文件；预期至少 sources/** 与 skills/**。' }
        $eolViolations = @()
        $eolParsedCount = 0
        foreach ($line in $eolOutput) {
            # git ls-files --eol 的实际格式：前三个字段是空格对齐的 `i/<eol> w/<eol> attr/<attr>`，
            # 然后一个 TAB，再是路径。只按 TAB 切只能得到 2 段，必须再切 meta 段，
            # 否则每一行都会被跳过，门禁会“假通过”（本步已实测踩过这个坑）。
            $tabFields = @([string]$line -split "`t")
            if ($tabFields.Count -lt 2) { continue }
            $relativePath = [string]$tabFields[1]
            $metaFields = @($tabFields[0] -split '\s+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            if ($metaFields.Count -lt 3) {
                $eolViolations += ($relativePath + ' (无法解析 --eol 输出行)')
                continue
            }
            $eolParsedCount++
            $indexToken = $metaFields[0]
            $worktreeToken = $metaFields[1]
            $attribute = $metaFields[2]
            if ($attribute -notlike 'attr/*-text*') {
                $eolViolations += ($relativePath + ' (属性不是 -text: ' + $attribute + ')')
                continue
            }
            # 必须去掉 i/ 与 w/ 前缀再比：这两个前缀天生不同，直接比会把全部文件报成违规（本步已踩过）。
            if (($indexToken -replace '^i/', '') -ne ($worktreeToken -replace '^w/', '')) {
                $eolViolations += ($relativePath + ' (' + $indexToken + ' != ' + $worktreeToken + ')')
            }
        }
        # 自检：解析不到行就直接失败，不让格式变化静默变成“通过”
        if ($eolParsedCount -ne $eolOutput.Count) {
            $eolViolations += ('解析行数 ' + $eolParsedCount + ' != git 输出行数 ' + $eolOutput.Count + '（--eol 输出格式可能已变）')
        }
        if ($eolViolations.Count -gt 0) {
            $preview = @($eolViolations | Select-Object -First 5) -join '; '
            Add-Result -Step '保真树换行可复现性' -Passed $false -Detail ('违规 ' + $eolViolations.Count + ' 个: ' + $preview)
        } else {
            Add-Result -Step '保真树换行可复现性' -Passed $true -Detail ('files = ' + $eolOutput.Count + ' (-text，索引==工作树)')
        }
    } catch {
        Add-Result -Step '保真树换行可复现性' -Passed $false -Detail $_.Exception.Message
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

    # 3b) 路由绑定：runtime 已接入技能必须在绑定 owner 里唯一命中一次（真源：classification.routeBinding）
    try {
        $binding = Invoke-Child -Script (Join-Path $repoRoot 'scripts/validate-route-bindings.ps1') -Arguments @{
            RepositoryRoot = $repoRoot
        }
        $bindingParsed = ($binding.Output -join "`n") | ConvertFrom-Json
        if ($bindingParsed.status -ne 'PASS') {
            Add-Result -Step '路由绑定' -Passed $false -Detail ((@($bindingParsed.errors) -join '; '))
        } else {
            Add-Result -Step '路由绑定' -Passed $true -Detail ('admitted=' + $bindingParsed.admitted + ' bound=' + $bindingParsed.bound + ' scanned=' + $bindingParsed.referenceFilesScanned)
        }
    } catch {
        Add-Result -Step '路由绑定' -Passed $false -Detail $_.Exception.Message
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
