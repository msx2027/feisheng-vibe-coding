[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet('Shared', 'Claude', 'Codex')]
    [string]$TargetHost = 'Shared',

    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(Mandatory = $false)]
    [string]$InstallRoot = '',

    [Parameter(Mandatory = $false)]
    [string]$Name = 'vibe-coding-skills',

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [switch]$Force,

    [Parameter(Mandatory = $false)]
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 宿主投递入口（此前缺失的一环）：把统一 runtime 投影装成「一个技能目录」。
#
# 为什么是「一个目录」：宿主只认技能根下的一层目录（<root>/<name>/SKILL.md），
# 而 `~/.claude/skills` 是指向共享适配根的 junction、Codex 读同一根，所以**装一次两个宿主都读**，
# 不需要各拷一份。技能本身留在控制面目录内（不各自占顶层目录），由控制面按路由委派。
#
# 默认形态是 Shared（宿主中性，决策 #4）：共享根装不下两套宿主专属 overlay，
# 一个槽位文件放不了两个宿主的内容；宿主专属投影只用于发布候选包装配。
#
# fail-closed：
#   - 目标已存在且未给 -Force 时拒绝（不覆盖别人的目录）
#   - 给了 -Force 时，只允许覆盖带本仓库任一投影形态 manifest 标记的目录；别人的一律拒绝
#   - 装完必须用 builder 的 Validate 模式对**已安装目录**复核，失败即报错
#   - 只写 <InstallRoot>/<Name> 这一个目录，不碰宿主其它内容

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) { throw "RepositoryRoot 不存在: $repoRoot" }

$builderName = switch ($TargetHost) {
    'Codex' { 'build-codex-runtime-projection.ps1' }
    'Claude' { 'build-claude-runtime-projection.ps1' }
    'Shared' { 'build-shared-runtime-projection.ps1' }
}
$builder = Join-Path $repoRoot ('scripts/' + $builderName)
if (-not (Test-Path -LiteralPath $builder -PathType Leaf)) { throw "缺少投影 builder: $builder" }
$manifestName = switch ($TargetHost) {
    'Codex' { 'codex-projection-manifest.json' }
    'Claude' { 'claude-projection-manifest.json' }
    'Shared' { 'shared-projection-manifest.json' }
}
$manifestSchema = switch ($TargetHost) {
    'Codex' { 'feisheng-codex-runtime-projection/v1' }
    'Claude' { 'feisheng-claude-runtime-projection/v1' }
    'Shared' { 'feisheng-shared-runtime-projection/v1' }
}
# 本仓库全部投影形态的标记集合：目录必须带其中之一的 manifest 才视为「我们的安装」。
# 允许在同一位置于我们自己的形态之间切换（如 Claude 形态升级为 Shared 形态），但外人目录一个标记都没有，一律拒绝。
$knownManifestNames = @('codex-projection-manifest.json', 'claude-projection-manifest.json', 'shared-projection-manifest.json')
$knownManifestSchemas = @('feisheng-codex-runtime-projection/v1', 'feisheng-claude-runtime-projection/v1', 'feisheng-shared-runtime-projection/v1')

if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    # 默认装进宿主技能根。~/.claude/skills 在本机是指向共享适配根的 junction，
    # 因此这一次安装同时服务 Claude 与 Codex；下面会把解析后的真实路径打印出来供审查。
    $InstallRoot = Join-Path $env:USERPROFILE '.claude/skills'
}
$installRootFull = [System.IO.Path]::GetFullPath($InstallRoot)
$targetPath = Join-Path $installRootFull $Name

# 技能根可能是 junction（本机 ~/.claude/skills → 共享适配根）：把真实目标一并报出来供审查，
# 这样「一个根服务两个宿主」是可核对的，而不是只靠口头声明。
$installRootItem = Get-Item -LiteralPath $installRootFull -Force -ErrorAction SilentlyContinue
$installRootTarget = $null
if ($null -ne $installRootItem -and ($installRootItem.PSObject.Properties.Name -contains 'Target') -and $installRootItem.Target) {
    $installRootTarget = [string](@($installRootItem.Target)[0])
}
# 输出里的 installRootResolved：根存在才解析，不存在就回填报的绝对路径本身——
# DryRun 的意义正是在装机之前先看，为一个还没建的目录抛「找不到路径」等于把预演变成只能预演已装过的机器。
$installRootResolved = if (Test-Path -LiteralPath $installRootFull) { (Resolve-Path -LiteralPath $installRootFull).Path } else { $installRootFull }

function Get-ManifestMarker {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $found = @()
    foreach ($knownName in $knownManifestNames) {
        $candidate = Join-Path $Directory $knownName
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
        try {
            $found += (Get-Content -Raw -Encoding UTF8 -LiteralPath $candidate | ConvertFrom-Json)
        } catch {
            # 带我们的 manifest 名但内容解析失败：按「无效标记」处理，照样进 $found 让上层拒绝
            $found += $null
        }
    }
    if ($found.Count -eq 0) { return $null }
    if ($found.Count -gt 1) {
        throw "目录带有多个本仓库投影标记，拒绝处理（fail-closed）: $Directory"
    }
    return $found[0]
}

function Test-IsOurInstallMarker {
    param($Marker)
    return ($null -ne $Marker -and ($Marker.PSObject.Properties.Name -contains 'schema') -and $knownManifestSchemas -contains [string]$Marker.schema)
}

# 安装位必须是实体目录：目标若是重解析点（junction／符号链接），下面的 Remove-Item -Recurse 会穿透到它
# 指向的真实目录树。本机实测共享根里的 `vibe-coding-skills` 就是**回指仓库根本身**的 junction——
# 一旦放行，「重装投影」等于把仓库本体连同未提交工作树一起删掉。用 Attributes 判而不判 LinkType：
# 后者按 PowerShell 版本对 junction 有的给值有的给空，判空即放行等于没有这道门。
function Assert-PhysicalDirectory {
    param([Parameter(Mandatory = $true)][string]$Directory)
    $item = Get-Item -LiteralPath $Directory -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        $linkTarget = if ($item.PSObject.Properties.Name -contains 'Target') { (@($item.Target) -join ', ') } else { '未知' }
        throw "拒绝处理：$Directory 是重解析点（指向 $linkTarget），不是投影安装位。摘链接请单独用 rmdir（只删重解析点）；-Recurse 递归删除会穿透删掉它指向的真实目录树。"
    }
}

if ($Uninstall) {
    if (-not (Test-Path -LiteralPath $targetPath -PathType Container)) {
        [pscustomobject]@{ status = 'SKIPPED'; reason = 'not-installed'; installPath = $targetPath } | ConvertTo-Json -Depth 6 -Compress
        exit 0
    }
    Assert-PhysicalDirectory -Directory $targetPath
    $marker = Get-ManifestMarker -Directory $targetPath
    if (-not (Test-IsOurInstallMarker -Marker $marker)) {
        throw "拒绝卸载：$targetPath 不带本仓库任何投影形态的标记（不是我们的安装）。"
    }
    Remove-Item -LiteralPath $targetPath -Recurse -Force
    [pscustomobject]@{ status = 'UNINSTALLED'; installPath = $targetPath } | ConvertTo-Json -Depth 6 -Compress
    exit 0
}

# 1) 目标占用检查
if (Test-Path -LiteralPath $targetPath) {
    Assert-PhysicalDirectory -Directory $targetPath
    $existing = Get-ManifestMarker -Directory $targetPath
    if (-not $Force) {
        throw "安装目标已存在，拒绝覆盖: $targetPath（要替换请加 -Force）"
    }
    if (-not (Test-IsOurInstallMarker -Marker $existing)) {
        throw "拒绝覆盖：$targetPath 不带本仓库任何投影形态的标记（不是我们的安装）。"
    }
    $existingSchema = [string]$existing.schema
    # DryRun 只读：记录将被替换的形态即可，绝不动目标目录
    if (-not $DryRun) {
        Remove-Item -LiteralPath $targetPath -Recurse -Force
    }
} else {
    $existingSchema = $null
}

# 2) 构建到仓库外的全新临时目录（builder 强制如此）
$stageRoot = Join-Path $env:TEMP ('vibe-install-' + [guid]::NewGuid().ToString('N'))
$projectionRoot = Join-Path $stageRoot 'projection'
try {
    New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
    $buildJson = (& $builder -Mode Build -RepositoryRoot $repoRoot -OutputRoot $projectionRoot) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "投影构建失败: $($buildJson | Select-Object -Last 1)" }
    $build = $buildJson | ConvertFrom-Json
    if ([string]$build.status -ne 'PASS' -or [string]$build.mode -ne 'Build') { throw "投影构建状态异常: $($build.status)" }

    $manifestPath = Join-Path $projectionRoot $manifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "构建产物缺少 manifest: $manifestPath" }
    $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
    # manifest sha 与文件数取 builder 自己报告的值（单一真源，不重复计算）
    $manifestSha = [string]$build.manifestSha256
    if ([string]::IsNullOrWhiteSpace($manifestSha)) { throw '构建结果缺少 manifestSha256' }
    $expectedFiles = [int]$build.fileCounts.total
    if ($expectedFiles -le 0) { throw '构建结果缺少 fileCounts.total' }

    if ($DryRun) {
        [pscustomobject]@{
            status = 'DRY-RUN'; targetHost = $TargetHost
            manifestName = $manifestName; manifestSchema = $manifestSchema; replacesSchema = $existingSchema
            installRoot = $installRootFull; installRootResolved = $installRootResolved
            installRootTarget = $installRootTarget
            installPath = $targetPath; fileCount = $expectedFiles; manifestSha256 = $manifestSha
            sourceRevision = [string]$build.sourceRevision
        } | ConvertTo-Json -Depth 6 -Compress
        exit 0
    }

    # 3) 复制（只写目标目录这一个）
    New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
    foreach ($item in @(Get-ChildItem -LiteralPath $projectionRoot -Force)) {
        Copy-Item -LiteralPath $item.FullName -Destination $targetPath -Recurse -Force
    }

    # 4) 装后复核：用 builder 的 Validate 模式验证**已安装目录**，而不是只看源
    $validateJson = (& $builder -Mode Validate -RepositoryRoot $repoRoot -OutputRoot $targetPath) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw "装后复核失败: $($validateJson | Select-Object -Last 1)" }
    $validate = $validateJson | ConvertFrom-Json
    if ([string]$validate.status -ne 'PASS') { throw "装后复核状态异常: $($validate.status)" }

    $installedCount = @(Get-ChildItem -LiteralPath $targetPath -Recurse -File).Count
    if ($installedCount -ne $expectedFiles) { throw "装后文件数不符: 期望 $expectedFiles 实际 $installedCount" }

    [pscustomobject]@{
        status = 'INSTALLED'
        targetHost = $TargetHost
        manifestName = $manifestName
        manifestSchema = $manifestSchema
        replacesSchema = $existingSchema
        installRoot = $installRootFull
        installRootResolved = $installRootResolved
        installRootTarget = $installRootTarget
        installPath = $targetPath
        fileCount = $installedCount
        manifestSha256 = $manifestSha
        sourceRevision = [string]$build.sourceRevision
        validated = $true
        rollback = ('Remove-Item -Recurse -Force "' + $targetPath + '"')
    } | ConvertTo-Json -Depth 6 -Compress
} finally {
    if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
