[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Build', 'Validate')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [Parameter(Mandatory = $true)]
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 共享投影门禁模块（Codex/Claude 同一套路径/SHA/catalog/blocked/写权限逻辑，禁止平行实现）。
$guardModule = Join-Path $PSScriptRoot 'runtime-projection-guard.ps1'
if (-not (Test-Path -LiteralPath $guardModule -PathType Leaf)) {
    throw "缺少共享投影门禁模块: $guardModule"
}
. $guardModule

# Codex 宿主事实资产（Sliver codex 适配器 overlay）。
# 权威来源：governance/sliver-core/packaging/runtime-manifest.json 的 targets.codex.overlay_files。
# 与 Claude 侧对称：Claude 挂 CLAUDE.md + adapters/claude/runtime-adapter.md，Codex 挂这里 3 个。
$codexHostFactFiles = @(
    [pscustomobject]@{
        id = 'codex-host-facts-openai-yaml'; kind = 'host-facts'; source = 'sliver-vibe-coding'
        relativePath = 'adapters/codex/agents/openai.yaml'
        sourceRelativePath = 'governance/sliver-core/packaging/adapters/codex/agents/openai.yaml'
    },
    [pscustomobject]@{
        id = 'codex-host-facts-studio-codex'; kind = 'host-facts'; source = 'sliver-vibe-coding'
        relativePath = 'adapters/codex/references/studio-codex.md'
        sourceRelativePath = 'governance/sliver-core/packaging/adapters/codex/references/studio-codex.md'
    },
    [pscustomobject]@{
        id = 'codex-host-facts-execution-liveness'; kind = 'host-facts'; source = 'sliver-vibe-coding'
        relativePath = 'adapters/codex/references/execution-liveness-host.md'
        sourceRelativePath = 'governance/sliver-core/packaging/adapters/codex/references/execution-liveness-host.md'
    }
)

function Get-CodexProjectionPlan {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    # 复用共享 catalog 门禁：control-plane + accepted-primitive include、blocked 排除、写权限校验
    $basePlan = Get-ProjectionPlan -Root $Root

    $files = @($basePlan.files)
    foreach ($fact in $codexHostFactFiles) {
        $sourcePath = Join-ContainedPath -Root $Root -RelativePath $fact.sourceRelativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw ("缺少 Codex 宿主事实文件: " + $fact.sourceRelativePath)
        }
        $files += [pscustomobject]@{
            id = $fact.id
            kind = $fact.kind
            source = $fact.source
            sourceRevision = $null
            relativePath = $fact.relativePath
            sourcePath = $sourcePath
            sourceRelativePath = $fact.sourceRelativePath
        }
    }

    return [pscustomobject]@{
        catalogPath = $basePlan.catalogPath
        catalogRelativePath = $basePlan.catalogRelativePath
        catalogSha256 = $basePlan.catalogSha256
        sourceRevision = $basePlan.sourceRevision
        entryPath = $basePlan.entryPath
        files = $files
        acceptedPrimitiveIds = $basePlan.acceptedPrimitiveIds
        blockedRecords = $basePlan.blockedRecords
        entryAliases = $basePlan.entryAliases
    }
}


function Test-CodexRuntimeProjection {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$ProjectionRoot
    )

    if (-not (Test-Path -LiteralPath $ProjectionRoot -PathType Container)) {
        throw "projection 输出目录不存在: $ProjectionRoot"
    }

    $plan = Get-CodexProjectionPlan -Root $Root
    $manifestRelativePath = 'codex-projection-manifest.json'
    $manifestPath = Join-ContainedPath -Root $ProjectionRoot -RelativePath $manifestRelativePath
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "缺少 projection manifest: $manifestPath"
    }

    $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.schema -ne 'feisheng-codex-runtime-projection/v1') {
        throw "不支持的 projection manifest schema: $($manifest.schema)"
    }
    if ($manifest.source.repositoryRevision -ne $plan.sourceRevision) {
        throw "source revision 已变化: manifest=$($manifest.source.repositoryRevision), current=$($plan.sourceRevision)"
    }
    if ($manifest.source.catalogSha256 -ne $plan.catalogSha256) {
        throw 'canonical catalog SHA-256 已变化，当前 projection 不能作为新鲜输出。'
    }
    if ($manifest.projectEntry.path -ne $plan.entryPath) {
        throw "manifest project entry 不一致: $($manifest.projectEntry.path)"
    }

    $expectedFiles = @($plan.files | ForEach-Object { $_.relativePath }) + $manifestRelativePath
    $actualFiles = @(Get-ChildItem -LiteralPath $ProjectionRoot -Recurse -Force -File | ForEach-Object {
        Get-NormalizedRelativePath -Root $ProjectionRoot -FullPath $_.FullName
    })
    $missingFiles = @($expectedFiles | Where-Object { $actualFiles -notcontains $_ })
    $unexpectedFiles = @($actualFiles | Where-Object { $expectedFiles -notcontains $_ })
    if ($missingFiles.Count -gt 0 -or $unexpectedFiles.Count -gt 0) {
        throw "projection 文件集合不匹配: missing=[$($missingFiles -join ', ')]; unexpected=[$($unexpectedFiles -join ', ')]"
    }

    $expectedDirectories = Get-ExpectedDirectories -Files $plan.files
    $actualDirectories = @(Get-ChildItem -LiteralPath $ProjectionRoot -Recurse -Force -Directory | ForEach-Object {
        Get-NormalizedRelativePath -Root $ProjectionRoot -FullPath $_.FullName
    })
    $unexpectedDirectories = @($actualDirectories | Where-Object { $expectedDirectories -notcontains $_ })
    if ($unexpectedDirectories.Count -gt 0) {
        throw "projection 包含未授权目录: $($unexpectedDirectories -join ', ')"
    }

    $rootFiles = @(Get-ChildItem -LiteralPath $ProjectionRoot -Force -File | ForEach-Object { $_.Name })
    $expectedRootFiles = @('SKILL.md', $manifestRelativePath)
    if ($rootFiles.Count -ne $expectedRootFiles.Count -or @($rootFiles | Where-Object { $expectedRootFiles -notcontains $_ }).Count -gt 0) {
        throw "projection 顶层只能包含唯一项目入口和 manifest，实际为: $($rootFiles -join ', ')"
    }

    $forbiddenSegments = @('sources', '.agents', '.claude', '.codex', 'hooks', 'codex-hooks', 'generated-mirrors') + $plan.entryAliases
    $allRuntimePaths = @($actualFiles + $actualDirectories)
    foreach ($segment in $forbiddenSegments | Select-Object -Unique) {
        $matches = @($allRuntimePaths | Where-Object { Test-PathContainsSegment -RelativePath $_ -Segment $segment })
        if ($matches.Count -gt 0) {
            throw "projection 包含被拒绝的 generated mirror、Hook 或第二入口路径 ($segment): $($matches -join ', ')"
        }
    }

    foreach ($blockedRecord in $plan.blockedRecords) {
        $matches = @($allRuntimePaths | Where-Object {
            (Test-PathContainsSegment -RelativePath $_ -Segment $blockedRecord.id) -or $_ -eq $blockedRecord.path
        })
        if ($matches.Count -gt 0) {
            throw "blocked skill 出现在 projection 中: $($blockedRecord.id) => $($matches -join ', ')"
        }
    }

    $manifestFiles = @($manifest.files)
    if ($manifestFiles.Count -ne $plan.files.Count) {
        throw "manifest 文件数不一致: manifest=$($manifestFiles.Count), expected=$($plan.files.Count)"
    }

    $fileHashes = @()
    foreach ($plannedFile in $plan.files) {
        $outputPath = Join-ContainedPath -Root $ProjectionRoot -RelativePath $plannedFile.relativePath
        if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
            throw "缺少已批准的 projection 文件: $outputPath"
        }

        $sourceHash = Get-Sha256 -Path $plannedFile.sourcePath
        $outputHash = Get-Sha256 -Path $outputPath
        $manifestFile = @($manifestFiles | Where-Object { $_.path -eq $plannedFile.relativePath })
        if ($manifestFile.Count -ne 1) {
            throw "manifest 缺少或重复文件记录: $($plannedFile.relativePath)"
        }
        if ($manifestFile[0].sourceSha256 -ne $sourceHash -or $manifestFile[0].outputSha256 -ne $outputHash -or $sourceHash -ne $outputHash) {
            throw "SHA-256 不一致: $($plannedFile.relativePath)"
        }

        $fileHashes += [ordered]@{
            path = $plannedFile.relativePath
            sha256 = $outputHash
        }
    }

    return [ordered]@{
        schema = 'feisheng-codex-runtime-projection-result/v1'
        mode = 'Validate'
        status = 'PASS'
        sourceRevision = $plan.sourceRevision
        catalogSha256 = $plan.catalogSha256
        outputRoot = $ProjectionRoot
        include = @($plan.files | ForEach-Object {
            [ordered]@{
                id = $_.id
                kind = $_.kind
                path = $_.relativePath
            }
        })
        exclude = [ordered]@{
            blocked = @($plan.blockedRecords)
            generatedMirrorAndHookSegments = @('sources', '.agents', '.claude', '.codex', 'hooks', 'codex-hooks', 'generated-mirrors')
            projectEntryAliases = @($plan.entryAliases)
        }
        fileCounts = [ordered]@{
            copied = $plan.files.Count
            generated = 1
            total = $actualFiles.Count
        }
        fileHashes = $fileHashes
        manifestSha256 = Get-Sha256 -Path $manifestPath
        exitCode = 0
    }
}

try {
    $repositoryRootFull = Get-FullPath -Path $RepositoryRoot
    if (-not (Test-Path -LiteralPath $repositoryRootFull -PathType Container)) {
        throw "RepositoryRoot 不存在: $repositoryRootFull"
    }
    $outputRootFull = Get-FullPath -Path $OutputRoot

    if ($Mode -eq 'Build') {
        if (Test-Path -LiteralPath $outputRootFull) {
            throw "为保证 fresh temporary output，OutputRoot 必须不存在: $outputRootFull"
        }
        $repositoryPrefix = $repositoryRootFull.TrimEnd([char[]]@(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.IO.Path]::AltDirectorySeparatorChar
        )) + [System.IO.Path]::DirectorySeparatorChar
        if ($outputRootFull.StartsWith($repositoryPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "OutputRoot 不能位于源仓库内: $outputRootFull"
        }

        $plan = Get-CodexProjectionPlan -Root $repositoryRootFull
        New-Item -ItemType Directory -Force -Path $outputRootFull | Out-Null
        $manifestFiles = @()
        foreach ($plannedFile in $plan.files) {
            $destinationPath = Join-ContainedPath -Root $outputRootFull -RelativePath $plannedFile.relativePath
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
            Copy-Item -LiteralPath $plannedFile.sourcePath -Destination $destinationPath
            $sourceHash = Get-Sha256 -Path $plannedFile.sourcePath
            $outputHash = Get-Sha256 -Path $destinationPath
            if ($sourceHash -ne $outputHash) {
                throw "复制后的 SHA-256 不一致: $($plannedFile.relativePath)"
            }

            $manifestFiles += [ordered]@{
                id = $plannedFile.id
                kind = $plannedFile.kind
                source = $plannedFile.source
                sourceRevision = $plannedFile.sourceRevision
                path = $plannedFile.relativePath
                sourceSha256 = $sourceHash
                outputSha256 = $outputHash
            }
        }

        $manifest = [ordered]@{
            schema = 'feisheng-codex-runtime-projection/v1'
            status = 'candidate-unverified; static-smoke-only'
            host = 'codex'
            source = [ordered]@{
                repositoryRevision = $plan.sourceRevision
                catalogPath = $plan.catalogRelativePath
                catalogSha256 = $plan.catalogSha256
            }
            projectEntry = [ordered]@{
                path = $plan.entryPath
                unique = $true
            }
            controlPlane = @($plan.files | Where-Object { $_.kind -eq 'control-plane' } | ForEach-Object {
                [ordered]@{
                    id = $_.id
                    path = $_.relativePath
                }
            })
            accepted = @($plan.files | Where-Object { $_.kind -ne 'control-plane' -and $_.kind -notlike 'host-*' } | ForEach-Object {
                [ordered]@{
                    id = $_.id
                    status = $_.kind
                    path = $_.relativePath
                }
            })
            excluded = [ordered]@{
                blocked = @($plan.blockedRecords)
                generatedMirrorAndHookSegments = @('sources', '.agents', '.claude', '.codex', 'hooks', 'codex-hooks', 'generated-mirrors')
                projectEntryAliases = @($plan.entryAliases)
            }
            files = $manifestFiles
            fileCounts = [ordered]@{
                copied = $plan.files.Count
                generated = 1
                total = $plan.files.Count + 1
            }
        }
        $manifestPath = Join-ContainedPath -Root $outputRootFull -RelativePath 'codex-projection-manifest.json'
        $manifest | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -LiteralPath $manifestPath
    }

    $result = Test-CodexRuntimeProjection -Root $repositoryRootFull -ProjectionRoot $outputRootFull
    if ($Mode -eq 'Build') {
        $result.mode = 'Build'
    }
    $result | ConvertTo-Json -Depth 12
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
