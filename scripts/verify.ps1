[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    # PS 5.1 的高级脚本（CmdletBinding）在 param 默认值里拿不到任何脚本路径表达式：
    # $PSScriptRoot 为空、$MyInvocation.MyCommand.Path 为 null。默认留空，进脚本体后再解析——
    # 脚本体的 $PSScriptRoot 在两个版本下都可用。
    [string]$RepositoryRoot = '',

    [Parameter(Mandatory = $false)]
    [switch]$IncludePackage,

    # 可选：宿主证据门。校验 HOST-DISCOVERY-EVIDENCE.json 的新鲜度、admitted 记录的宿主证据，
    # 以及「非 admitted 技能从统一包内可见」的影子入口。默认不跑（CI 无宿主环境）；本机验收时加。
    [Parameter(Mandatory = $false)]
    [switch]$IncludeHostEvidence,

    [Parameter(Mandatory = $false)]
    [int]$HostEvidenceMaxAgeDays = 7
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 单入口验证器：一条命令跑完全部门禁 + 生成物新鲜度校验。
#
# 覆盖（步骤名以实际输出为准，编号随门禁演进而增删，对账勿依赖本文数字）：
#   - catalog 与分类真源同步（重生成后语义比对）
#   - 入库生成物为 pwsh 7 排版（catalog / inventory 的 JSON 缩进结构判据；语义比对对缩进不敏感，
#     5.1 生成的入库文件体积近乎翻倍却能全绿——2026-09-28 实测 158,273 对 289,370 字节）
#   - runtime include 内容完整性（bundle 逐文件 sha256 + 全局路径唯一性）
#   - 导入副本与快照一致性（Vibe 逐文件白名单 + Matt 侧，含登记补丁双向核对）
#   - 已登记补丁结构不变量（runtime-import 补丁的围栏奇偶 / frontmatter 键集 / 路径 token 结构比对）
#   - 保真树换行可复现性（-text 且索引==工作树）
#   - 控制面静态契约评测（governance/sliver-core 的开发执行 D0 / 有界 D1 加载体积预算，2026-09-28 接线）
#   - 能力索引新鲜度（重生成后逐字节比对）
#   - 来源快照完整性（聚合树摘要自证）
#   - 路由绑定（admitted 在绑定 owner 唯一命中）
#   - 退役引用扫描（全量 retired id 的 /id 命令形态；sources/ 快照路径引用除外）
#   - 发布 NOTICE 门禁
#   - Vibe Hook 适配器安全契约（v2：纠错信号采集两事件启用 + Digest 消化标记）
#   - collector 路径归属单测（宿主证据归属逻辑回归门；会向 gitignore 的 _smoke/ 追加测试日志）
#   - 提交关卡清单自检（scripts/githooks/pre-commit 检查清单「声明 == 实现」，2026-09-25 接线）
#   - Codex / Claude / 宿主中性静态投影 Build + Validate
#   - 文档数字与实测一致（README / 交接文档自称「catalog 实测」的计数逐条重算比对，2026-09-28 接线）
#   - 文档步数与实际步数一致（末步自计：README 徽章与正文、交接文档全部「默认 N 步 / 全开 N 步」自称不得靠人抄）
#   - 可选：宿主证据门（-IncludeHostEvidence，把 host-discovery-evidenced 纸面门变成机器门）
#   - 可选：发布候选包装配（-IncludePackage）
#
# 本脚本只读仓库、只在临时目录写入（collector 单测的日志除外，见上）；不安装依赖、不写入宿主目录。
# 退出码：0 = 全部通过；1 = 有失败。

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}
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
# 来源快照实测文件数（步骤 3 填充，步骤 6b 消费）。
$docSnapshotFiles = @{}
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('vibe-verify-' + [guid]::NewGuid().ToString('N'))

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

    # 1a) 入库 JSON 生成物的排版必须是 pwsh 7 的每层 2 空格缩进
    #     为什么要单独一步：第 1 步把两边 JSON 解析后比语义，对缩进不敏感——谁用 Windows PowerShell 5.1
    #     重生成并提交（5.1 为每层 4 空格），同一份数据落盘体积近乎翻倍（2026-09-28 实测
    #     158,273 字节对 289,370 字节，解析后逐字段全等），而门禁全绿。生成器侧已加运行时闸门
    #     （build-canonical-catalog.ps1 / build-skill-inventory.ps1 拒绝在 5.1 下写仓库内文件），
    #     本步是对「闸门上线前已入库」与「绕过生成器手工改排版」的兜底。
    #     判据取结构而非体积（体积上限会随记录数增长烂掉）：pwsh 7 必有缩进恰为 2 的行，
    #     5.1 的缩进全为 4 的倍数、绝不会出现 2；只查两份由生成器产出的镜像，不查手记的登记表。
    try {
        $layoutFiles = @('provenance/CANONICAL-CATALOG.json', 'provenance/SKILL-INVENTORY.json')
        $layoutErrors = @()
        foreach ($layoutFile in $layoutFiles) {
            $layoutText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot $layoutFile)
            $layoutIndentTwo = 0
            foreach ($layoutLine in ($layoutText -split "`n")) {
                if (($layoutLine.Length - $layoutLine.TrimStart(' ').Length) -eq 2) { $layoutIndentTwo++ }
            }
            if ($layoutIndentTwo -eq 0) {
                $layoutErrors += ($layoutFile + ' 不是 pwsh 7 排版（无缩进 2 空格行，疑似 Windows PowerShell 5.1 生成的每层 4 空格；用 pwsh 重生成该文件）')
            }
        }
        if (@($layoutErrors).Count -gt 0) {
            Add-Result -Step '入库生成物为 pwsh 7 排版' -Passed $false -Detail ((@($layoutErrors | Select-Object -First 4)) -join '; ')
        } else {
            Add-Result -Step '入库生成物为 pwsh 7 排版' -Passed $true -Detail ('files = ' + (@($layoutFiles)).Count + ' (2-space indent)')
        }
    } catch {
        Add-Result -Step '入库生成物为 pwsh 7 排版' -Passed $false -Detail $_.Exception.Message
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
        # 1b-2) 全局唯一性守护：任何记录的 path 都不得是另一记录 path 的路径后缀。
        #     否则宿主可见性按 path 后缀归属时，同一条目会同时命中多条记录（GA 复核红队指出的
        #     构造性歧义：admitted 记录可借他记录文件拿到假 model-visible，非 admitted 会被误报影子入口）。
        $allRecordPaths = @(@($catalogDoc.records) | ForEach-Object { ([string]$_.path).Replace('\', '/') })
        $pathSuffixCollisions = @()
        for ($pi = 0; $pi -lt $allRecordPaths.Count; $pi++) {
            for ($pj = 0; $pj -lt $allRecordPaths.Count; $pj++) {
                if ($pi -eq $pj) { continue }
                $isSuffix = $allRecordPaths[$pj].ToLowerInvariant().EndsWith('/' + $allRecordPaths[$pi].ToLowerInvariant(), [System.StringComparison]::OrdinalIgnoreCase)
                if ($isSuffix) {
                    $pathSuffixCollisions += ($allRecordPaths[$pi] + ' 是 ' + $allRecordPaths[$pj] + ' 的路径后缀（归属歧义）')
                }
            }
        }
        if ($pathSuffixCollisions.Count -gt 0) {
            $runtimeDrift += @(@('catalog path 后缀歧义（全局唯一性）') + @($pathSuffixCollisions | Select-Object -First 5))
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
            # 一等副本的本地补丁登记（命名空间 'runtime-import'，见 provenance-integrity.ps1）。
            # 语义与快照树补丁一致：已登记的偏差合法，未登记的偏差仍是漂移，登记过期同样失败。
            $runtimeCopyPatches = Get-RuntimeCopyPatches -RepositoryRoot $repoRoot -SnapshotPathPrefix 'sources/vibe-coding-skills'
            $consumedRuntimePatches = @{}
            $importPatchedCount = 0
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
                    $destinationRelative = $destinationRelativeRoot.TrimEnd('/') + '/' + $fileRelative
                    if ($sourceHash -ne $destinationHash) {
                        $registeredPatch = $null
                        if ($runtimeCopyPatches.ContainsKey($destinationRelative)) { $registeredPatch = $runtimeCopyPatches[$destinationRelative] }
                        if ($null -eq $registeredPatch) {
                            $importFailures += ([string]$importEntry.id + '/' + $fileRelative + ' (与快照不一致，且无本地补丁登记)')
                        } elseif ([string]$registeredPatch.originalSha256 -ne $sourceHash) {
                            $importFailures += ($destinationRelative + ' (补丁登记的 originalSha256 与快照不符)')
                        } elseif ([string]$registeredPatch.patchedSha256 -ne $destinationHash) {
                            $importFailures += ($destinationRelative + ' (补丁登记的 patchedSha256 与副本不符)')
                        } else {
                            $consumedRuntimePatches[$destinationRelative] = $true
                            $importPatchedCount++
                        }
                    }
                    $importFileCount++
                }
            }
            # 登记的副本补丁必须被真实导入项消费：登记指向不存在的偏差 = 登记过期，fail-closed。
            $staleRuntimePatches = @($runtimeCopyPatches.Keys | Where-Object { -not $consumedRuntimePatches.ContainsKey($_) })
            if ($staleRuntimePatches.Count -gt 0) {
                $sortedStalePatches = [string[]]@($staleRuntimePatches)
                [Array]::Sort($sortedStalePatches, [System.StringComparer]::Ordinal)
                $importFailures += ('本地补丁登记未对应任何「副本偏离快照」的导入项: ' + ($sortedStalePatches -join ', '))
            }
            if ($importFailures.Count -gt 0) {
                Add-Result -Step '导入副本与快照一致性' -Passed $false -Detail ($importFailures -join '; ')
            } else {
                Add-Result -Step '导入副本与快照一致性' -Passed $true -Detail ('files = ' + $importFileCount + '（含 ' + $importPatchedCount + ' 个已登记本地补丁）')
            }
        }
    } catch {
        Add-Result -Step '导入副本与快照一致性' -Passed $false -Detail $_.Exception.Message
    }

    # 1c-2) 一等副本与来源快照一致性（Matt 侧补充覆盖）
    #     VIBE-IMPORTS.json 有逐文件白名单，1c 直接用它；MATT-IMPORT.json（v2）只登记快照根、文件数与
    #     revision 来源，没有逐文件映射，所以 matt 副本此前**没有**副本↔快照覆盖（只被 catalog 的
    #     记录级自洽校验间接覆盖一个文件）。这里用来源事实快照 SKILL-INVENTORY.json 把副本记录接回上游路径：
    #     inventory 行按 (source, sha256) 唯一命中 → 上游目录 → 快照文件 = <snapshotRoot>/<上游相对路径>。
    #     语义与 1c 完全一致：已登记的本地补丁合法，未登记的偏差失败，登记过期（副本不再偏离）也失败。
    try {
        $mattImportRecordPath = Join-Path $repoRoot 'provenance/MATT-IMPORT.json'
        if (-not (Test-Path -LiteralPath $mattImportRecordPath -PathType Leaf)) {
            Add-Result -Step '导入副本与快照一致性（Matt）' -Passed $true -Detail '无 Matt 导入记录（0 个导入技能）'
        } else {
            $mattImportRecord = Get-Content -Raw -Encoding UTF8 -LiteralPath $mattImportRecordPath | ConvertFrom-Json
            $mattSnapshotRelativeRoot = ([string]$mattImportRecord.snapshotRoot).Replace('\', '/')
            $inventoryDoc = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/SKILL-INVENTORY.json') | ConvertFrom-Json
            $catalogDocForMatt = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json') | ConvertFrom-Json
            $acceptedStatusesForMatt = @($catalogDocForMatt.decisionPolicy.acceptedStatuses)

            $inventoryBySourceSha = @{}
            foreach ($inventoryRow in @($inventoryDoc.skills)) {
                $inventoryKey = ([string]$inventoryRow.source + '|' + ([string]$inventoryRow.sha256).ToLowerInvariant())
                if (-not $inventoryBySourceSha.ContainsKey($inventoryKey)) { $inventoryBySourceSha[$inventoryKey] = @() }
                $inventoryBySourceSha[$inventoryKey] = @($inventoryBySourceSha[$inventoryKey]) + @(([string]$inventoryRow.path).Replace('\', '/'))
            }

            $registeredMattPatches = Get-RuntimeCopyPatches -RepositoryRoot $repoRoot -SnapshotPathPrefix 'sources/mattpocock-skills'
            $consumedMattPatches = @{}
            $mattFailures = @()
            $mattFileCount = 0
            $mattPatchedCount = 0

            foreach ($mattRecord in @($catalogDocForMatt.records)) {
                if ([string]$mattRecord.source -ne 'mattpocock-skills') { continue }
                if ($acceptedStatusesForMatt -notcontains [string]$mattRecord.status) { continue }

                $mattRecordPath = ([string]$mattRecord.path).Replace('\', '/')
                $inventoryKey = ([string]$mattRecord.source + '|' + ([string]$mattRecord.sourceSha256).ToLowerInvariant())
                if (-not $inventoryBySourceSha.ContainsKey($inventoryKey)) {
                    $mattFailures += ($mattRecordPath + ' (SKILL-INVENTORY 里没有匹配 (source, sha256) 的来源行)')
                    continue
                }
                $upstreamCandidates = @($inventoryBySourceSha[$inventoryKey])
                if ($upstreamCandidates.Count -ne 1) {
                    $mattFailures += ($mattRecordPath + ' (无法唯一确定上游路径，命中 ' + $upstreamCandidates.Count + ' 条)')
                    continue
                }
                $upstreamDirectory = [string](Split-Path -Path $upstreamCandidates[0] -Parent)
                if ([string]::IsNullOrWhiteSpace($upstreamDirectory)) { $upstreamDirectory = '.' }

                $mattBundleRoot = ''
                $mattBundleFiles = @()
                $hasMattBundle = ($mattRecord.PSObject.Properties.Name -contains 'bundle') -and ($null -ne $mattRecord.bundle)
                if ($hasMattBundle) {
                    $mattBundleRoot = ([string]$mattRecord.bundle.root).Replace('\', '/')
                    foreach ($mattBundleFile in @($mattRecord.bundle.files)) { $mattBundleFiles += ([string]$mattBundleFile.path).Replace('\', '/') }
                } else {
                    $mattBundleFiles += $mattRecordPath
                }

                foreach ($mattDestinationPath in $mattBundleFiles) {
                    $mattRelativeInside = [string](Split-Path -Path $mattDestinationPath -Leaf)
                    if (-not [string]::IsNullOrWhiteSpace($mattBundleRoot) -and $mattDestinationPath.StartsWith($mattBundleRoot + '/')) {
                        $mattRelativeInside = $mattDestinationPath.Substring($mattBundleRoot.Length + 1)
                    }
                    $mattUpstreamRelative = ($upstreamDirectory + '/' + $mattRelativeInside).Replace('\', '/')
                    $mattSnapshotFullPath = Join-Path $repoRoot (($mattSnapshotRelativeRoot + '/' + $mattUpstreamRelative).Replace('/', [System.IO.Path]::DirectorySeparatorChar))
                    $mattDestinationFullPath = Join-Path $repoRoot ($mattDestinationPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))

                    if (-not (Test-Path -LiteralPath $mattSnapshotFullPath -PathType Leaf)) {
                        $mattFailures += ($mattDestinationPath + ' (快照缺对应文件: ' + $mattSnapshotRelativeRoot + '/' + $mattUpstreamRelative + ')')
                        continue
                    }
                    if (-not (Test-Path -LiteralPath $mattDestinationFullPath -PathType Leaf)) {
                        $mattFailures += ($mattDestinationPath + ' (导入副本缺失)')
                        continue
                    }

                    $mattSnapshotHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mattSnapshotFullPath).Hash.ToLowerInvariant()
                    $mattDestinationHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $mattDestinationFullPath).Hash.ToLowerInvariant()
                    if ($mattSnapshotHash -ne $mattDestinationHash) {
                        $registeredMattPatch = $null
                        if ($registeredMattPatches.ContainsKey($mattDestinationPath)) { $registeredMattPatch = $registeredMattPatches[$mattDestinationPath] }
                        if ($null -eq $registeredMattPatch) {
                            $mattFailures += ($mattDestinationPath + ' (与快照不一致，且无本地补丁登记)')
                        } elseif ([string]$registeredMattPatch.originalSha256 -ne $mattSnapshotHash) {
                            $mattFailures += ($mattDestinationPath + ' (补丁登记的 originalSha256 与快照不符)')
                        } elseif ([string]$registeredMattPatch.patchedSha256 -ne $mattDestinationHash) {
                            $mattFailures += ($mattDestinationPath + ' (补丁登记的 patchedSha256 与副本不符)')
                        } else {
                            $consumedMattPatches[$mattDestinationPath] = $true
                            $mattPatchedCount++
                        }
                    }
                    $mattFileCount++
                }
            }

            $staleMattPatches = @($registeredMattPatches.Keys | Where-Object { -not $consumedMattPatches.ContainsKey($_) })
            if ($staleMattPatches.Count -gt 0) {
                $sortedStaleMattPatches = [string[]]@($staleMattPatches)
                [Array]::Sort($sortedStaleMattPatches, [System.StringComparer]::Ordinal)
                $mattFailures += ('本地补丁登记未对应任何「副本偏离快照」的导入项: ' + ($sortedStaleMattPatches -join ', '))
            }

            if ($mattFailures.Count -gt 0) {
                Add-Result -Step '导入副本与快照一致性（Matt）' -Passed $false -Detail ($mattFailures -join '; ')
            } else {
                Add-Result -Step '导入副本与快照一致性（Matt）' -Passed $true -Detail ('files = ' + $mattFileCount + '（含 ' + $mattPatchedCount + ' 个已登记本地补丁）')
            }
        }
    } catch {
        Add-Result -Step '导入副本与快照一致性（Matt）' -Passed $false -Detail $_.Exception.Message
    }

    # 1c-3) 已登记补丁的结构不变量（文本补丁安全网）
    #     哈希对账只证明「登记内容 == 文件内容」，不证明「补丁没有顺手破坏结构」：哈希证明意图，不证明安全。
    #     对每个 runtime-import 登记项，把来源快照原文与补丁后副本做三类结构级比对：
    #     ① ``` 围栏奇偶一致；② frontmatter 有无与键集一致（值允许变）；
    #     ③ 既有「像路径的反引号 token」未被加料改写（骨架相同、原文不同，典型是路径被顺手翻译）。
    #     不拦新增合法引用、删除既有引用与正文改写——那是文本补丁的正常形态。
    #     sliver-core 命名空间原文不在本仓库（只有哈希），不覆盖；原文/副本缺失一律失败（fail-closed）。
    try {
        $patchStructure = Test-RuntimePatchStructureInvariants -RepositoryRoot $repoRoot
        if ($patchStructure.ok) {
            Add-Result -Step '已登记补丁结构不变量' -Passed $true -Detail ('patches = ' + $patchStructure.checked)
        } else {
            Add-Result -Step '已登记补丁结构不变量' -Passed $false -Detail (@($patchStructure.errors) -join '; ')
        }
    } catch {
        Add-Result -Step '已登记补丁结构不变量' -Passed $false -Detail $_.Exception.Message
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

    # 1e) 控制面静态契约评测（开发执行加载体积预算；2026-09-28 接线）
    #     为什么要接：`evaluate_execution_backbone.py` 是 D0/有界 D1 加载体积预算的唯一 owner，
    #     但它此前没有被任何关卡调用（verify.ps1 无 python 步骤、CI 也无），预算超标只能靠人偶然跑到才发现。
    #     实测归因（LF 与 CRLF 两份副本 A/B，见 evidence/20260928-loading-budget-and-eol-root-cause.md）：
    #     自导入起真实内容增长只有 SKILL.md +67 字节，其余超标来自 governance/sliver-core 整树以 CRLF
    #     落盘（同一内容 LF 副本实测 D0=66839 合规、有界 D1=74049）。
    #     2026-09-28 换行归一批已把该树 220 个文件落地为 LF（内容零差异，登记经 annotation 通道重录），
    #     本步从此守的是「不得再退回 CRLF」；d0 预算同时撤销上一批的借道上调，回到上游原值 67000。
    #     本步把这条不变量变成机器门；缺 python3 直接失败，不静默跳过。
    try {
        $backboneRoot = Join-Path $repoRoot 'governance/sliver-core'
        $backboneScript = Join-Path $backboneRoot 'scripts/evaluate_execution_backbone.py'
        if (-not (Test-Path -LiteralPath $backboneScript -PathType Leaf)) {
            throw "缺少控制面评测脚本: $backboneScript"
        }
        $pythonCandidate = $null
        foreach ($pythonName in @('python3', 'python')) {
            $resolvedPython = Get-Command $pythonName -ErrorAction SilentlyContinue
            if ($null -ne $resolvedPython) { $pythonCandidate = $resolvedPython.Source; break }
        }
        if ([string]::IsNullOrWhiteSpace($pythonCandidate)) {
            throw '未找到 python3 / python，无法运行控制面静态契约评测（不得静默跳过）'
        }
        $global:LASTEXITCODE = 0
        $backboneOutput = @(& $pythonCandidate -B $backboneScript $backboneRoot 2>&1 | ForEach-Object { [string]$_ })
        $backboneExit = $LASTEXITCODE
        $backboneLine = if (@($backboneOutput).Count -gt 0) { [string]($backboneOutput[-1]) } else { '' }
        if ($backboneExit -ne 0) {
            $detail = @($backboneOutput | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ' | '
            if ([string]::IsNullOrWhiteSpace($detail)) { $detail = '退出码 ' + $backboneExit + '，无输出' }
            Add-Result -Step '控制面静态契约评测' -Passed $false -Detail $detail
        } else {
            Add-Result -Step '控制面静态契约评测' -Passed $true -Detail $backboneLine
        }
    } catch {
        Add-Result -Step '控制面静态契约评测' -Passed $false -Detail $_.Exception.Message
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
            # 6b 的数字对账要用快照实测文件数（README 三方表里的 220/553/136 是同一个数）。
            foreach ($integritySnapshot in @($integrity.snapshots)) {
                $docSnapshotFiles[[string]$integritySnapshot.name] = [int]$integritySnapshot.fileCount
            }
            foreach ($integritySnapshot in @($integrity.snapshots)) {
                $script:docSnapshotFiles[[string]$integritySnapshot.name] = [int]$integritySnapshot.fileCount
            }
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

    # 3c) 退役引用扫描：runtime 一等内容里不得再有退役 id 的 /id 命令形态引用
    #     （sources/<快照>/ 路径引用是合法指认，扫描时整段屏蔽；28c8089 的同形词人工剔除口径废止）
    try {
        $retiredScan = Invoke-Child -Script (Join-Path $repoRoot 'scripts/validate-retired-references.ps1') -Arguments @{
            RepositoryRoot = $repoRoot
        }
        $retiredParsed = ($retiredScan.Output -join "`n") | ConvertFrom-Json
        if ($retiredParsed.status -ne 'PASS') {
            Add-Result -Step '退役引用扫描' -Passed $false -Detail ((@($retiredParsed.errors) -join '; '))
        } else {
            Add-Result -Step '退役引用扫描' -Passed $true -Detail ('retired=' + $retiredParsed.retiredCount + ' scanned=' + $retiredParsed.filesScanned)
        }
    } catch {
        Add-Result -Step '退役引用扫描' -Passed $false -Detail $_.Exception.Message
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

    # 5) Vibe Hook 适配器安全契约（v2：纠错信号采集两事件启用 + Digest 消化标记，治理门禁事件保持禁用）
    #    测试覆盖：契约不变量、未启用事件 exit 3、SessionStart 只读、UserPromptSubmit 白名单追加 + 幂等、写入边界。
    try {
        $null = Invoke-Child -Script (Join-Path $repoRoot 'tests/test-vibe-hook-adapter.ps1') -Arguments @{
            RepositoryRoot = $repoRoot
        }
        Add-Result -Step 'Vibe Hook 适配器安全契约' -Passed $true
    } catch {
        Add-Result -Step 'Vibe Hook 适配器安全契约' -Passed $false -Detail $_.Exception.Message
    }

    # 5c) collector 路径归属单测（宿主证据归属逻辑的回归门；测试失败走 exit 1，不是 throw）
    try {
        $collectorTest = Invoke-Child -Script (Join-Path $repoRoot 'tests/test-collector-path-resolution.ps1') -Arguments @{}
        if ($collectorTest.ExitCode -ne 0) { throw ('collector 路径归属单测失败（exit ' + $collectorTest.ExitCode + '）') }
        Add-Result -Step 'collector 路径归属单测' -Passed $true
    } catch {
        Add-Result -Step 'collector 路径归属单测' -Passed $false -Detail $_.Exception.Message
    }

    # 5d) 提交关卡清单自检（本地 pre-commit 检查清单「声明 == 实现」的回归门，2026-09-25 接线）
    try {
        $global:LASTEXITCODE = 0
        $hookTestOut = & node (Join-Path $repoRoot 'scripts/githooks/pre-commit.test.mjs') $repoRoot
        if ($LASTEXITCODE -ne 0) { throw ('提交关卡清单自检失败（exit ' + $LASTEXITCODE + '）：' + ($hookTestOut -join '; ')) }
        Add-Result -Step '提交关卡清单自检' -Passed $true
    } catch {
        Add-Result -Step '提交关卡清单自检' -Passed $false -Detail $_.Exception.Message
    }

    # 5b) 可选：宿主证据门（把 runtimePromotionPolicy 的 host-discovery-evidenced 纸面门变成机器门）
    if ($IncludeHostEvidence) {
        try {
            $evidencePath = Join-Path $repoRoot 'provenance/HOST-DISCOVERY-EVIDENCE.json'
            if (-not (Test-Path -LiteralPath $evidencePath -PathType Leaf)) {
                throw '缺少 provenance/HOST-DISCOVERY-EVIDENCE.json（先运行 scripts/collect-host-skill-evidence.ps1）'
            }
            $hostEvidence = Get-Content -Raw -Encoding UTF8 -LiteralPath $evidencePath | ConvertFrom-Json
            $capturedAt = [datetimeoffset]::Parse([string]$hostEvidence.capturedAt, [System.Globalization.CultureInfo]::InvariantCulture).UtcDateTime
            $ageDays = ((Get-Date).ToUniversalTime() - $capturedAt).TotalDays
            if ($ageDays -gt $HostEvidenceMaxAgeDays) {
                throw ('宿主证据已过期: capturedAt=' + [string]$hostEvidence.capturedAt + '，超过 ' + $HostEvidenceMaxAgeDays + ' 天上限')
            }
            $gateCatalog = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json') | ConvertFrom-Json
            $gateAccepted = @($gateCatalog.decisionPolicy.acceptedStatuses)
            $evidenceById = @{}
            foreach ($er in @($hostEvidence.records)) { $evidenceById[[string]$er.id] = $er }
            $gateViolations = @()
            $gateAdmitted = 0
            foreach ($record in @($gateCatalog.records)) {
                $isAdmitted = $gateAccepted -contains [string]$record.status
                # readiness 漂移校验：status 前缀必须与 readiness 一致
                $statusStr = [string]$record.status
                $readinessStr = [string]$record.readiness
                $expectedReadiness = switch -Regex ($statusStr) {
                    '^accepted-' { 'accepted' }
                    '^retired-'  { 'retired' }
                    '^compatibility-' { 'compatibility' }
                    '^excluded-' { 'excluded' }
                    '^control-plane$' { 'runtime' }
                    default      { $null }
                }
                if (($null -ne $expectedReadiness) -and ($readinessStr -ne $expectedReadiness)) {
                    $gateViolations += ($record.id + ' (readiness 漂移: status=' + $statusStr + ' 但 readiness=' + $readinessStr + '，期望=' + $expectedReadiness + ')')
                }
                $er = $evidenceById[[string]$record.id]
                if ($isAdmitted) {
                    $gateAdmitted++
                    if ($null -eq $er) {
                        $gateViolations += ([string]$record.id + ' (admitted 但宿主证据缺记录)')
                        continue
                    }
                    $allowedEvidence = @('model-visible', 'installed-in-shared-bundle')
                    if ([string]$record.invocation -eq 'user-invoked') { $allowedEvidence += 'installed-user-invoked-only' }
                    if ($allowedEvidence -notcontains [string]$er.evidence) {
                        $gateViolations += ([string]$record.id + ' (admitted 但宿主证据为 ' + [string]$er.evidence + '，违反 runtimePromotionPolicy.host-discovery-evidenced)')
                    }
                } else {
                    # 影子入口：非 admitted 技能不得从统一包内可见（遗留源链接暴露不算，那是阶段 5 口径）
                    if ($null -eq $er) { continue }  # 非 admitted 缺证据记录不算违规（影子检查无从做起）
                    foreach ($v in @($er.visibleAs)) {
                        if ([string]$v.path -like 'vibe-coding-skills/*') {
                            $gateViolations += ([string]$record.id + ' (非 admitted 但从统一包内可见: ' + [string]$v.path + ')')
                            break
                        }
                    }
                }
            }
            if ($gateViolations.Count -gt 0) {
                Add-Result -Step '宿主证据门' -Passed $false -Detail (@($gateViolations | Select-Object -First 8) -join '; ')
            } else {
                Add-Result -Step '宿主证据门' -Passed $true -Detail ('admitted=' + $gateAdmitted + ' ageDays=' + [math]::Round($ageDays, 2))
            }
        } catch {
            Add-Result -Step '宿主证据门' -Passed $false -Detail $_.Exception.Message
        }
    }

    # 6) 静态投影 Build + Validate（两个宿主投影 + 宿主中性投影：共享根安装形态，决策 #4）
    $projectionTargets = @(
        [pscustomobject]@{ StepName = 'Codex 静态投影 Build + Validate'; Builder = 'build-codex-runtime-projection.ps1' },
        [pscustomobject]@{ StepName = 'Claude 静态投影 Build + Validate'; Builder = 'build-claude-runtime-projection.ps1' },
        [pscustomobject]@{ StepName = '宿主中性静态投影 Build + Validate'; Builder = 'build-shared-runtime-projection.ps1' }
    )
    # 6b 的数字对账要用投影实测总数（安装态文件数不是 catalog 能算出来的），在此顺手留下。
    $projectionTotals = @{}
    foreach ($projectionTarget in $projectionTargets) {
        $outputRoot = Join-Path $workRoot ('proj-' + [System.IO.Path]::GetFileNameWithoutExtension($projectionTarget.Builder).Replace('build-', '').Replace('-runtime-projection', ''))
        try {
            $build = Invoke-Child -Script (Join-Path $repoRoot ('scripts/' + $projectionTarget.Builder)) -Arguments @{
                Mode = 'Build'; RepositoryRoot = $repoRoot; OutputRoot = $outputRoot
            }
            $buildParsed = ($build.Output -join "`n") | ConvertFrom-Json
            if ($buildParsed.status -ne 'PASS') { throw ('build status = ' + $buildParsed.status) }
            $validate = Invoke-Child -Script (Join-Path $repoRoot ('scripts/' + $projectionTarget.Builder)) -Arguments @{
                Mode = 'Validate'; RepositoryRoot = $repoRoot; OutputRoot = $outputRoot
            }
            $validateParsed = ($validate.Output -join "`n") | ConvertFrom-Json
            if ($validateParsed.status -ne 'PASS') { throw ('validate status = ' + $validateParsed.status) }
            $projectionTotals[[string]$projectionTarget.Builder] = [int]$validateParsed.fileCounts.total
            Add-Result -Step $projectionTarget.StepName -Passed $true
        } catch {
            Add-Result -Step $projectionTarget.StepName -Passed $false -Detail $_.Exception.Message
        }
    }

    # 6b) 文档数字与实测一致
    #     README 与 docs/HANDOFF-NEXT.md 里有一批自称「catalog 实测」的计数。同一个 bundle 数字曾
    #     同时以 432（README，2026-09-18 口径）与 422 / 420（交接文档，2026-09-12 口径）并存，而当下
    #     真值需要重算：靠人肉订正已复发三次，投影落盘数（写死 95/93/92）离实测 456/454/453 更远。
    #     规则：每条锚点必须命中，且命中的数字与重算值全等；锚点未命中同样判失败——否则改写一句
    #     文案就能把对账静默摘掉。
    try {
        $docCatalog = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json') | ConvertFrom-Json
        $docAcceptedStatuses = @($docCatalog.decisionPolicy.acceptedStatuses)
        $docAccepted = @($docCatalog.records | Where-Object { $docAcceptedStatuses -contains $_.status })
        $docBundleFiles = 0
        $docFilesBySource = @{}
        foreach ($docRecord in $docAccepted) {
            $docRecordHasBundle = ($docRecord.PSObject.Properties.Name -contains 'bundle') -and ($null -ne $docRecord.bundle)
            $docRecordFileCount = if ($docRecordHasBundle) { @($docRecord.bundle.files).Count } else { 1 }
            $docBundleFiles += $docRecordFileCount
            $docRecordSource = [string]$docRecord.source
            if (-not $docFilesBySource.ContainsKey($docRecordSource)) { $docFilesBySource[$docRecordSource] = 0 }
            $docFilesBySource[$docRecordSource] += $docRecordFileCount
        }
        $docRecordsTotal = @($docCatalog.records).Count
        $docRuntimeRecords = @($docAccepted).Count
        $docRetiredRecords = @($docCatalog.records | Where-Object { $_.readiness -eq 'retired' }).Count
        $docOutRecords = @($docCatalog.records | Where-Object { @('excluded', 'compatibility') -contains $_.readiness }).Count
        # 「控制面 1 + Matt 13 + Vibe 38」这条构成同样是算出来的，不写死——否则对账本身会变成第二个假数。
        $docControlPlaneRecords = @($docAccepted | Where-Object { [string]$_.source -eq 'sliver-vibe-coding' }).Count
        $docMattRecords = @($docAccepted | Where-Object { [string]$_.source -eq 'mattpocock-skills' }).Count
        $docVibeRecords = @($docAccepted | Where-Object { [string]$_.source -eq 'vibe-coding-skills' }).Count
        $docRegisteredSliver = @($docCatalog.records | Where-Object { [string]$_.source -eq 'sliver-vibe-coding' }).Count
        $docRegisteredMatt = @($docCatalog.records | Where-Object { [string]$_.source -eq 'mattpocock-skills' }).Count
        $docRegisteredVibe = @($docCatalog.records | Where-Object { [string]$_.source -eq 'vibe-coding-skills' }).Count
        $docSnapshotSliver = $docSnapshotFiles['sliver-core']
        $docSnapshotMatt = $docSnapshotFiles['mattpocock-skills']
        $docSnapshotVibe = $docSnapshotFiles['vibe-coding-skills']
        if ($null -eq $docSnapshotMatt -or $null -eq $docSnapshotSliver -or $null -eq $docSnapshotVibe) {
            throw '来源快照文件数未获得（第 3 步未通过，先修它）'
        }
        $docSharedTotal = $projectionTotals['build-shared-runtime-projection.ps1']
        if ($null -eq $docSharedTotal) { throw '宿主中性投影实测总数未获得（第 6 步未通过，先修它）' }

        $docNumberRules = @(
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) 条\*\*来源技能全量登记定编'; Expect = @($docRecordsTotal) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) 条进入 runtime\*\*'; Expect = @($docRuntimeRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = 'runtime\*\*（(\d+) 文件）'; Expect = @($docBundleFiles) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) 条退役\*\*'; Expect = @($docRetiredRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) 条排除/兼容\*\*'; Expect = @($docOutRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| Runtime bundle \| (\d+) 文件'; Expect = @($docBundleFiles) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '安装态 (\d+) = \+根入口'; Expect = @($docSharedTotal) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '登记 / runtime / 退役 / 排除 \| (\d+) / \*\*(\d+)\*\* / (\d+) / (\d+)'; Expect = @($docRecordsTotal, $docRuntimeRecords, $docRetiredRecords, $docOutRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+)\*\* source skills fully registered'; Expect = @($docRecordsTotal) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) in runtime\*\*'; Expect = @($docRuntimeRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = 'in runtime\*\* \((\d+) files\)'; Expect = @($docBundleFiles) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) retired\*\*'; Expect = @($docRetiredRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\*\*(\d+) excluded/compat\*\*'; Expect = @($docOutRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| Runtime bundle \| (\d+) files'; Expect = @($docBundleFiles) }
            [pscustomobject]@{ File = 'README.md'; Pattern = 'installed projection (\d+) = \+ root entry'; Expect = @($docSharedTotal) }
            [pscustomobject]@{ File = 'README.md'; Pattern = 'Registered / runtime / retired / excluded \| (\d+) / \*\*(\d+)\*\* / (\d+) / (\d+)'; Expect = @($docRecordsTotal, $docRuntimeRecords, $docRetiredRecords, $docOutRecords) }
            # 三方来源表：快照实测文件数 + 登记数 + 已接入数（中英各一份）
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| sliver-vibe-coding \| 控制面 \| `governance/sliver-core/`（(\d+) 文件） \| (\d+) \| (\d+) \|'; Expect = @($docSnapshotSliver, $docRegisteredSliver, $docControlPlaneRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| vibe-coding-skills \| 产品 / UI / 事件 / checker \| `sources/vibe-coding-skills/`（(\d+) 文件） \| (\d+) \| (\d+) \|'; Expect = @($docSnapshotVibe, $docRegisteredVibe, $docVibeRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| mattpocock-skills \| 工程原语 \| `sources/mattpocock-skills/`（(\d+) 文件） \| (\d+) \| (\d+) \|'; Expect = @($docSnapshotMatt, $docRegisteredMatt, $docMattRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| sliver-vibe-coding \| Control plane \| `governance/sliver-core/` \((\d+) files\) \| (\d+) \| (\d+) \|'; Expect = @($docSnapshotSliver, $docRegisteredSliver, $docControlPlaneRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| vibe-coding-skills \| Product / UI / events / checkers \| `sources/vibe-coding-skills/` \((\d+) files\) \| (\d+) \| (\d+) \|'; Expect = @($docSnapshotVibe, $docRegisteredVibe, $docVibeRecords) }
            [pscustomobject]@{ File = 'README.md'; Pattern = '\| mattpocock-skills \| Engineering primitives \| `sources/mattpocock-skills/` \((\d+) files\) \| (\d+) \| (\d+) \|'; Expect = @($docSnapshotMatt, $docRegisteredMatt, $docMattRecords) }
            # 顶部徽章（URL 编码形态）同样是同一批数字的第二个落点
            [pscustomobject]@{ File = 'README.md'; Pattern = 'badge/skills-(\d+)%20runtime%20%2F%20(\d+)%20registered'; Expect = @($docRuntimeRecords, $docRecordsTotal) }
            # 运行时入口 SKILL.md 的「当前阶段」段：装到宿主上后这就是用户看到的现状，同样不许手抄
            [pscustomobject]@{ File = 'SKILL.md'; Pattern = '(\d+) 条来源技能已登记'; Expect = @($docRecordsTotal) }
            [pscustomobject]@{ File = 'SKILL.md'; Pattern = '已登记，\*\*(\d+) 条通过五道门禁进入 runtime\*\*（(\d+) 文件）'; Expect = @($docRuntimeRecords, $docBundleFiles) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '\*\*(\d+) 条记录\*\*'; Expect = @($docRecordsTotal) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '\*\*(\d+) 条 runtime 已接入\*\*'; Expect = @($docRuntimeRecords) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '（控制面 (\d+) \+ matt (\d+) \+ vibe (\d+)）'; Expect = @($docControlPlaneRecords, $docMattRecords, $docVibeRecords) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '/\*\*(\d+) 条 retired\*\*/'; Expect = @($docRetiredRecords) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '/\*\*(\d+) 条排除或兼容\*\*'; Expect = @($docOutRecords) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = 'runtime bundle 共 \*\*(\d+)\*\* 文件'; Expect = @($docBundleFiles) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '\*\*(\d+)\*\* = catalog 登记的 runtime bundle 文件数'; Expect = @($docBundleFiles) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '\*\*(\d+)\*\* = 部署态 = '; Expect = @($docSharedTotal) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '`vibe-coding-skills` \*\*(\d+) 文件\*\*'; Expect = @($docSharedTotal) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '控制面包：\*\*(\d+) 文件\*\*'; Expect = @($docFilesBySource['sliver-vibe-coding']) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = 'build-codex-runtime-projection\.ps1\s*→ (\d+) 文件'; Expect = @($projectionTotals['build-codex-runtime-projection.ps1']) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = 'build-claude-runtime-projection\.ps1\s*→ (\d+) 文件'; Expect = @($projectionTotals['build-claude-runtime-projection.ps1']) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = 'build-shared-runtime-projection\.ps1\s*→ (\d+) 文件'; Expect = @($docSharedTotal) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '(\d+) 条记录 / (\d+) bundle 文件（控制面 (\d+) \+ Matt (\d+) \+ Vibe (\d+)'; Expect = @($docRuntimeRecords, $docBundleFiles, $docControlPlaneRecords, $docMattRecords, $docVibeRecords) }
            [pscustomobject]@{ File = 'docs/HANDOFF-NEXT.md'; Pattern = '部署态 (\d+) = \+根入口\+manifest'; Expect = @($docSharedTotal) }
        )
        $docNumberErrors = @()
        $docNumberChecked = 0
        $docFileTexts = @{}
        foreach ($docRule in $docNumberRules) {
            $docRuleFile = [string]$docRule.File
            if (-not $docFileTexts.ContainsKey($docRuleFile)) {
                $docFileTexts[$docRuleFile] = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot $docRuleFile)
            }
            $docRuleMatches = [regex]::Matches([string]$docFileTexts[$docRuleFile], [string]$docRule.Pattern, ([System.Text.RegularExpressions.RegexOptions]::IgnoreCase))
            if ($docRuleMatches.Count -eq 0) {
                $docNumberErrors += ($docRuleFile + ' 锚点未命中（文案被改写？请恢复或同步本步锚点）: ' + [string]$docRule.Pattern)
                continue
            }
            foreach ($docMatch in $docRuleMatches) {
                if (($docMatch.Groups.Count - 1) -ne @($docRule.Expect).Count) {
                    $docNumberErrors += ($docRuleFile + ' 锚点捕获组数与预期不符: ' + [string]$docRule.Pattern)
                    continue
                }
                for ($docGroupIndex = 1; $docGroupIndex -lt $docMatch.Groups.Count; $docGroupIndex++) {
                    $docNumberChecked++
                    $docActual = [int]$docMatch.Groups[$docGroupIndex].Value
                    $docExpectedValue = @($docRule.Expect)[$docGroupIndex - 1]
                    if ($null -eq $docExpectedValue) {
                        $docNumberErrors += ($docRuleFile + ' 实测值未获得（第 6 步未通过？）: ' + [string]$docRule.Pattern)
                        continue
                    }
                    if ($docActual -ne [int]$docExpectedValue) {
                        $docNumberErrors += ($docRuleFile + ' 登记=' + $docActual + ' 实测=' + [int]$docExpectedValue + ' 处: ' + $docMatch.Value.Trim())
                    }
                }
            }
        }
        if ($docNumberErrors.Count -gt 0) {
            Add-Result -Step '文档数字与实测一致' -Passed $false -Detail ((@($docNumberErrors | Select-Object -First 8)) -join '; ')
        } else {
            Add-Result -Step '文档数字与实测一致' -Passed $true -Detail (
                'claims = ' + $docNumberChecked + ' records = ' + $docRecordsTotal + ' runtime = ' + $docRuntimeRecords +
                ' bundle = ' + $docBundleFiles + ' installed = ' + $docSharedTotal)
        }
    } catch {
        Add-Result -Step '文档数字与实测一致' -Passed $false -Detail $_.Exception.Message
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
    # 8) 文档步数与实际步数一致（必须放在最后：它统计的就是「本脚本一共登记了几步」）
    #    步数是这批数字里最后一个还在手抄的：README 徽章、README 正文、交接文档各写一遍，
    #    每次增删门禁都得追着改（2026-09-12、2026-09-25 各补过一次）。还原口径：
    #    已登记步数 - 本次真跑过的可选步 + 本步自身 = 默认档步数。
    try {
        $optionalStepsRun = 0
        if ($IncludeHostEvidence) { $optionalStepsRun++ }
        if ($IncludePackage) { $optionalStepsRun++ }
        $defaultStepCount = (@($results).Count - $optionalStepsRun) + 1
        $stepReadmeText = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'README.md')
        $stepBadgeMatch = [regex]::Match($stepReadmeText, 'static%20gates-verify\.ps1%20(\d+)%20steps')
        $stepTableMatch = [regex]::Match($stepReadmeText, '`verify\.ps1` 默认 (\d+) 步')
        $stepCountErrors = @()
        if (-not $stepBadgeMatch.Success) { $stepCountErrors += 'README 徽章步数锚点未命中（改写文案请同步本步）' }
        if (-not $stepTableMatch.Success) { $stepCountErrors += 'README 正文步数锚点未命中（改写文案请同步本步）' }
        foreach ($stepClaim in @($stepBadgeMatch, $stepTableMatch)) {
            if ($stepClaim.Success -and [int]$stepClaim.Groups[1].Value -ne $defaultStepCount) {
                $stepCountErrors += ('README 登记=' + [int]$stepClaim.Groups[1].Value + ' 实测默认档=' + $defaultStepCount)
            }
        }
        # 交接文档的步数自 2026-09-28 起一并核对：同一份文档里「默认 21 步」与「默认 15 步」曾并存
        # （入口速查与起点检查清单两处停在 2026-09-12 口径），而本步原先只锚 README。
        # 口径：默认档取所有「默认 N 步」命中；全开档 = 默认档 + 两个可选步，取所有「全开 N 步」命中。
        # 命中数为 0 同样判失败——改写文案不能把这条对账静默摘掉。
        $stepHandoffPath = Join-Path $repoRoot 'docs/HANDOFF-NEXT.md'
        if (-not (Test-Path -LiteralPath $stepHandoffPath -PathType Leaf)) {
            throw "缺少交接文档: $stepHandoffPath"
        }
        $stepHandoffText = Get-Content -Raw -Encoding UTF8 -LiteralPath $stepHandoffPath
        $fullOpenStepCount = $defaultStepCount + 2
        $handoffDefaultMatches = @([regex]::Matches($stepHandoffText, '默认\s*\**(\d+)\s*\**步'))
        $handoffFullMatches = @([regex]::Matches($stepHandoffText, '全开\s*\**(\d+)\s*\**步'))
        if ($handoffDefaultMatches.Count -lt 1) { $stepCountErrors += '交接文档默认步数锚点未命中（改写文案请同步本步）' }
        if ($handoffFullMatches.Count -lt 1) { $stepCountErrors += '交接文档全开步数锚点未命中（改写文案请同步本步）' }
        foreach ($stepClaim in $handoffDefaultMatches) {
            if ([int]$stepClaim.Groups[1].Value -ne $defaultStepCount) {
                $stepCountErrors += ('交接文档登记=' + [int]$stepClaim.Groups[1].Value + ' 实测默认档=' + $defaultStepCount)
            }
        }
        foreach ($stepClaim in $handoffFullMatches) {
            if ([int]$stepClaim.Groups[1].Value -ne $fullOpenStepCount) {
                $stepCountErrors += ('交接文档全开登记=' + [int]$stepClaim.Groups[1].Value + ' 实测全开=' + $fullOpenStepCount)
            }
        }
        if ($stepCountErrors.Count -gt 0) {
            Add-Result -Step '文档步数与实际步数一致' -Passed $false -Detail ((@($stepCountErrors | Select-Object -First 4)) -join '; ')
        } else {
            Add-Result -Step '文档步数与实际步数一致' -Passed $true -Detail ('default = ' + $defaultStepCount + ' steps')
        }
    } catch {
        Add-Result -Step '文档步数与实际步数一致' -Passed $false -Detail $_.Exception.Message
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
