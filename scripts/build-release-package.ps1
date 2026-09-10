[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Codex', 'Claude', 'Both')]
    [string]$TargetHost,

    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [Parameter(Mandatory = $true)]
    [string]$PackageRoot,

    [Parameter(Mandatory = $false)]
    [string]$Label = 'candidate'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 发布包构建器（静态候选包，不是宿主安装）：
#   1. 先跑发布 NOTICE 静态门禁；门禁失败则整个构建 fail closed。
#   2. 调 runtime projection builder 生成指定宿主的干净投影输出。
#   3. 仅按门禁报告里已映射的 provenance 路径，把随包 NOTICE/许可证文件复制进包；
#      不手工创建、不手工挑选许可证文件（复制项全部来自 LICENSE-MAP 映射）。
#   4. 生成 NOTICE.txt 与 RELEASE-MANIFEST.json（显式标注 static candidate / NOT host-installed /
#      fresh-session UNVERIFIED）。
#   5. 用内置 Compress-Archive 打包为 zip（不安装新依赖）。
#
# 本脚本不启用真实宿主安装，不写入任何真实 Codex/Claude 目录。

function Get-FullPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return [System.IO.Path]::GetFullPath($Path)
}

function Test-PathContainsSegment {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Segment
    )
    return $RelativePath -match ('(^|/)' + [regex]::Escape($Segment) + '(/|$)')
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-GitRevision {
    param([Parameter(Mandatory = $true)][string]$Root)
    Get-Command git -ErrorAction Stop | Out-Null
    $revision = (& git -C $Root rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($revision)) {
        throw "无法读取 source revision: $Root"
    }
    return $revision
}

$repoRoot = Get-FullPath -Path $RepositoryRoot
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

$packageRootFull = Get-FullPath -Path $PackageRoot
$repoPrefix = $repoRoot.TrimEnd([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)) + [System.IO.Path]::DirectorySeparatorChar
if ($packageRootFull.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or $packageRootFull -eq $repoRoot) {
    throw "PackageRoot 不能位于源仓库内: $packageRootFull"
}
if (Test-Path -LiteralPath $packageRootFull) {
    throw "PackageRoot 必须不存在（保证 fresh 输出）: $packageRootFull"
}

$noticeGateScript = Join-Path $repoRoot 'scripts/validate-release-notices.ps1'
if (-not (Test-Path -LiteralPath $noticeGateScript -PathType Leaf)) {
    throw "缺少 NOTICE 门禁脚本: $noticeGateScript"
}

$hosts = if ($TargetHost -eq 'Both') { @('Codex', 'Claude') } else { @($TargetHost) }
$sourceRevision = Get-GitRevision -Root $repoRoot

# 1) NOTICE 门禁（fail closed）
$gateRaw = & $noticeGateScript -RepositoryRoot $repoRoot
$gate = ($gateRaw -join "`n") | ConvertFrom-Json
if ($gate.status -ne 'PASS') {
    throw "NOTICE 门禁未通过，停止构建发布包。"
}
$catalogRelative = 'provenance/CANONICAL-CATALOG.json'
$catalogPath = Join-Path $repoRoot $catalogRelative
$catalogSha256 = Get-Sha256 -Path $catalogPath

New-Item -ItemType Directory -Force -Path $packageRootFull | Out-Null
$runtimeRoot = Join-Path $packageRootFull 'runtime'
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

# 2) 逐宿主构建干净投影（builder 自身会跑完整的路径/SHA/catalog/blocked 校验）
$hostReports = @()
foreach ($hostName in $hosts) {
    $builderName = if ($hostName -eq 'Codex') { 'build-codex-runtime-projection.ps1' } else { 'build-claude-runtime-projection.ps1' }
    $builderScript = Join-Path $repoRoot ('scripts/' + $builderName)
    if (-not (Test-Path -LiteralPath $builderScript -PathType Leaf)) {
        throw "缺少投影构建脚本: $builderScript"
    }
    $hostOutputRoot = Join-Path $runtimeRoot $hostName.ToLowerInvariant()
    $builderRaw = & $builderScript -Mode Build -RepositoryRoot $repoRoot -OutputRoot $hostOutputRoot
    $builderResult = ($builderRaw -join "`n") | ConvertFrom-Json
    if ($builderResult.status -ne 'PASS') {
        throw "$hostName 投影构建未通过。"
    }
    $hostReports += [ordered]@{
        host = $hostName
        outputRoot = ('runtime/' + $hostName.ToLowerInvariant())
        manifestSha256 = $builderResult.manifestSha256
        files = @($builderResult.include | ForEach-Object { $_.path })
    }
}

# 3) 只按门禁报告的 provenance 映射复制随包 NOTICE 文件
$noticeFiles = @{}
foreach ($item in @($gate.runtimeItems)) {
    foreach ($relative in @($item.notices)) {
        if ([string]::IsNullOrWhiteSpace([string]$relative)) { continue }
        $normalized = ([string]$relative).Replace('\', '/')
        if (-not $noticeFiles.ContainsKey($normalized)) {
            $noticeFiles[$normalized] = $true
        }
    }
}

$noticesRoot = Join-Path $packageRootFull 'notices'
New-Item -ItemType Directory -Force -Path $noticesRoot | Out-Null
$copiedNotices = @()
foreach ($relative in @($noticeFiles.Keys | Sort-Object)) {
    $sourcePath = Join-Path $repoRoot ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "门禁映射的 NOTICE 文件不存在: $relative"
    }
    $destinationPath = Join-Path $noticesRoot ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    $destinationDir = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $destinationDir)) {
        New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
    }
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    $copiedNotices += [ordered]@{
        repoPath = $relative
        packagePath = ('notices/' + $relative)
        sha256 = Get-Sha256 -Path $sourcePath
    }
}

# 4) NOTICE.txt + RELEASE-MANIFEST.json
$noticeLines = @()
$noticeLines += 'Feisheng Vibe Coding release package NOTICE'
$noticeLines += ('Label: ' + $Label)
$noticeLines += ('Source revision: ' + $sourceRevision)
$noticeLines += ('Canonical catalog SHA-256: ' + $catalogSha256)
$noticeLines += 'Status: static candidate package; NOT host-installed; fresh-session smoke UNVERIFIED.'
$noticeLines += ''
$noticeLines += 'Runtime license mapping (from provenance/LICENSE-MAP.json via the release notice gate):'
foreach ($item in @($gate.runtimeItems)) {
    $noticeLines += ('- [' + $item.status + '] ' + $item.id + ' (' + $item.source + ')')
    $noticeLines += ('    license: ' + $item.license)
    $noticeLines += ('    path:    ' + $item.path)
    $noticeLines += ('    notices: ' + (@($item.notices) -join ', '))
}
$noticeLines += ''
$noticeLines += 'Bundled notice files (copied by provenance path):'
foreach ($copied in $copiedNotices) {
    $noticeLines += ('- ' + $copied.packagePath + '  <-  ' + $copied.repoPath)
}
$noticeLines += ''
$noticeLines += 'The Vibe source remains runtimeEligible=false and contributes no runtime file to this package.'
$noticeText = ($noticeLines -join "`r`n") + "`r`n"
$noticePath = Join-Path $packageRootFull 'NOTICE.txt'
Set-Content -Encoding UTF8 -LiteralPath $noticePath -Value $noticeText

$releaseManifest = [ordered]@{
    schema = 'feisheng-release-package/v1'
    label = $Label
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = 'static-candidate; NOT host-installed; fresh-session UNVERIFIED'
    source = [ordered]@{
        repositoryRevision = $sourceRevision
        catalogPath = $catalogRelative
        catalogSha256 = $catalogSha256
    }
    noticeGate = [ordered]@{
        status = $gate.status
        licenseMapStatus = $gate.licenseMapStatus
        runtimeItemCount = @($gate.runtimeItems).Count
    }
    build = [ordered]@{
        powerShellVersion = $PSVersionTable.PSVersion.ToString()
        powerShellEdition = [string]$PSVersionTable.PSEdition
        reproducibilityNote = 'projection manifest bytes depend on ConvertTo-Json formatting; PowerShell 7 (pwsh) is the canonical release build runtime. Windows PowerShell 5.1 runs the same gates/projections but emits different manifest bytes for identical values.'
    }
    hosts = $hostReports
    notices = $copiedNotices
    exclusions = [ordered]@{
        vibeRuntimeEligible = $false
        blockedSkills = @('code-review', 'tdd')
        generatedMirrorAndHookSegments = @('sources', '.agents', '.claude', '.codex', 'hooks', 'codex-hooks', 'generated-mirrors')
    }
    note = 'static package assembly only; does not prove host discovery, trust, or fresh-session behavior'
}
$releaseManifestPath = Join-Path $packageRootFull 'RELEASE-MANIFEST.json'
$releaseManifest | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -LiteralPath $releaseManifestPath

# 5) zip（内置 Compress-Archive，不安装新依赖）
$zipName = 'feisheng-vibe-coding-' + $Label + '.zip'
$zipPath = Join-Path (Split-Path -Parent $packageRootFull) $zipName
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}
Compress-Archive -Path (Join-Path $packageRootFull '*') -DestinationPath $zipPath -Force

$packageFiles = @(Get-ChildItem -LiteralPath $packageRootFull -Recurse -Force -File | ForEach-Object {
    $_.FullName.Substring($packageRootFull.Length + 1).Replace('\', '/')
})

$result = [ordered]@{
    schema = 'feisheng-release-package-result/v1'
    status = 'BUILT'
    label = $Label
    sourceRevision = $sourceRevision
    catalogSha256 = $catalogSha256
    noticeGateStatus = $gate.status
    hosts = @($hostReports | ForEach-Object { $_.host })
    packageRoot = $packageRootFull
    zipPath = $zipPath
    zipSha256 = Get-Sha256 -Path $zipPath
    packageFileCount = $packageFiles.Count
    forbiddenSegmentViolations = @($packageFiles | Where-Object { $_ -like 'runtime/*' } | Where-Object {
        $candidate = $_
        @('sources', '.agents', '.claude', '.codex', 'codex-hooks', '-hooks/') | Where-Object { Test-PathContainsSegment -RelativePath $candidate -Segment $_ }
    })
    note = 'static candidate package; NOT a release authorization; does not prove host installation or fresh-session smoke'
}
$result | ConvertTo-Json -Depth 10
