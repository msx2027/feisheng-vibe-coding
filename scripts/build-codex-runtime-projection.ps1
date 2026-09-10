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

function Get-FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function ConvertTo-SafeRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "$Label 不能为空。"
    }

    $normalized = $Path.Replace('\', '/')
    if (
        [System.IO.Path]::IsPathRooted($Path) -or
        $normalized.StartsWith('/') -or
        $normalized -match '^[A-Za-z]:' -or
        $normalized -match '(^|/)\.\.?(?:/|$)'
    ) {
        throw "$Label 不是安全的相对路径: $Path"
    }

    return $normalized
}

function Join-ContainedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $rootFull = Get-FullPath -Path $Root
    $rootWithoutTrailingSeparator = $rootFull.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    ))
    $relativeNative = $RelativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
    $candidate = [System.IO.Path]::GetFullPath((Join-Path -Path $rootFull -ChildPath $relativeNative))
    $prefix = $rootWithoutTrailingSeparator + [System.IO.Path]::DirectorySeparatorChar

    if (-not $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "路径越过了根目录: $RelativePath"
    }

    return $candidate
}

function Get-Sha256 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-GitRevision {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    Get-Command git -ErrorAction Stop | Out-Null
    $revision = (& git -C $Root rev-parse HEAD 2>$null).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($revision)) {
        throw "无法读取 source revision: $Root"
    }

    return $revision
}

function Get-NormalizedRelativePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,

        [Parameter(Mandatory = $true)]
        [string]$FullPath
    )

    $rootFull = Get-FullPath -Path $Root
    $candidate = Get-FullPath -Path $FullPath
    $prefix = $rootFull.TrimEnd([char[]]@(
        [System.IO.Path]::DirectorySeparatorChar,
        [System.IO.Path]::AltDirectorySeparatorChar
    )) + [System.IO.Path]::DirectorySeparatorChar

    if (-not $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "文件不属于给定根目录: $FullPath"
    }

    return $candidate.Substring($prefix.Length).Replace('\', '/')
}

function Get-ParentDirectories {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath
    )

    $segments = @($RelativePath.Split('/'))
    $directories = @()
    for ($index = 1; $index -lt $segments.Count; $index++) {
        $directories += ($segments[0..($index - 1)] -join '/')
    }

    return $directories
}

function Test-PathContainsSegment {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RelativePath,

        [Parameter(Mandatory = $true)]
        [string]$Segment
    )

    return $RelativePath -match ('(^|/)' + [regex]::Escape($Segment) + '(/|$)')
}

function Get-ProjectionPlan {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $catalogRelativePath = 'provenance/CANONICAL-CATALOG.json'
    $catalogPath = Join-ContainedPath -Root $Root -RelativePath $catalogRelativePath
    if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) {
        throw "缺少 canonical catalog: $catalogPath"
    }

    $catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json
    if ($catalog.schema -ne 'feisheng-canonical-skill-catalog/v1') {
        throw "不支持的 canonical catalog schema: $($catalog.schema)"
    }
    if ($catalog.owner -ne 'skill-catalog') {
        throw "canonical catalog owner 必须是 skill-catalog。"
    }

    $entryPath = ConvertTo-SafeRelativePath -Path ([string]$catalog.projectEntry) -Label 'projectEntry'
    if ($entryPath -ne 'SKILL.md') {
        throw "本最小 Codex projection 只接受唯一根入口 SKILL.md，实际为: $entryPath"
    }

    $records = @($catalog.records)
    if ($records.Count -eq 0) {
        throw 'canonical catalog 没有记录。'
    }

    $controlPlaneRecords = @($records | Where-Object { $_.status -eq 'control-plane' })
    if ($controlPlaneRecords.Count -ne 1) {
        throw "control-plane 记录必须唯一，实际数量: $($controlPlaneRecords.Count)"
    }

    $acceptedPrimitiveRecords = @($records | Where-Object { $_.status -eq 'accepted-primitive' })
    if ($acceptedPrimitiveRecords.Count -eq 0) {
        throw 'canonical catalog 没有 accepted-primitive 记录。'
    }

    $requiredBlockedIds = @('code-review', 'tdd')
    $blockedRecords = @($records | Where-Object { $_.status -like 'blocked-*' })
    foreach ($blockedId in $requiredBlockedIds) {
        $matchingRecords = @($records | Where-Object { $_.id -eq $blockedId })
        if ($matchingRecords.Count -ne 1 -or $matchingRecords[0].status -notlike 'blocked-*') {
            throw "必须保持 blocked 的记录缺失或状态错误: $blockedId"
        }
    }

    $includedRecords = @($controlPlaneRecords + $acceptedPrimitiveRecords)
    $includedPaths = @($entryPath)
    foreach ($record in $includedRecords) {
        if ([string]::IsNullOrWhiteSpace([string]$record.id)) {
            throw 'catalog 中的 included record 缺少 id。'
        }

        $recordPath = ConvertTo-SafeRelativePath -Path ([string]$record.path) -Label "record $($record.id) 的 path"
        if ($includedPaths -contains $recordPath) {
            throw "catalog include 路径重复: $recordPath"
        }
        $includedPaths += $recordPath
    }

    foreach ($blockedRecord in $blockedRecords) {
        $blockedPath = ConvertTo-SafeRelativePath -Path ([string]$blockedRecord.path) -Label "blocked record $($blockedRecord.id) 的 path"
        if ($includedPaths -contains $blockedPath) {
            throw "blocked record 不能进入 Codex projection: $($blockedRecord.id)"
        }
    }

    $entryAliases = @()
    $projectEntryGroups = @($catalog.duplicateGroups | Where-Object { $_.id -eq 'project-entry' })
    foreach ($group in $projectEntryGroups) {
        $entryAliases += @($group.aliases)
    }
    $entryAliases = @($entryAliases | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique)

    $filePlan = @()
    $sourceEntryPath = Join-ContainedPath -Root $Root -RelativePath $entryPath
    if (-not (Test-Path -LiteralPath $sourceEntryPath -PathType Leaf)) {
        throw "缺少 project entry: $sourceEntryPath"
    }
    $filePlan += [pscustomobject]@{
        id = 'project-entry'
        kind = 'project-entry'
        source = 'feisheng-vibe-coding'
        sourceRevision = $null
        relativePath = $entryPath
        sourcePath = $sourceEntryPath
    }

    foreach ($record in $includedRecords) {
        $recordPath = ConvertTo-SafeRelativePath -Path ([string]$record.path) -Label "record $($record.id) 的 path"
        $sourcePath = Join-ContainedPath -Root $Root -RelativePath $recordPath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw "缺少 catalog 批准的文件: $sourcePath"
        }
        $sourceItem = Get-Item -LiteralPath $sourcePath
        if (($sourceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "catalog 批准的文件不能是 reparse point: $sourcePath"
        }

        $filePlan += [pscustomobject]@{
            id = [string]$record.id
            kind = [string]$record.status
            source = [string]$record.source
            sourceRevision = if ($record.PSObject.Properties.Name -contains 'sourceRevision' -and $null -ne $record.sourceRevision) { [string]$record.sourceRevision } else { $null }
            relativePath = $recordPath
            sourcePath = $sourcePath
        }
    }

    return [pscustomobject]@{
        catalogPath = $catalogPath
        catalogRelativePath = $catalogRelativePath
        catalogSha256 = Get-Sha256 -Path $catalogPath
        sourceRevision = Get-GitRevision -Root $Root
        entryPath = $entryPath
        files = $filePlan
        acceptedPrimitiveIds = @($acceptedPrimitiveRecords | ForEach-Object { [string]$_.id })
        blockedRecords = @($blockedRecords | ForEach-Object {
            [pscustomobject]@{
                id = [string]$_.id
                status = [string]$_.status
                path = ConvertTo-SafeRelativePath -Path ([string]$_.path) -Label "blocked record $($_.id) 的 path"
            }
        })
        entryAliases = $entryAliases
    }
}

function Get-ExpectedDirectories {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Files
    )

    $directories = @()
    foreach ($file in $Files) {
        $directories += Get-ParentDirectories -RelativePath $file.relativePath
    }

    return @($directories | Select-Object -Unique)
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

    $plan = Get-ProjectionPlan -Root $Root
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

        $plan = Get-ProjectionPlan -Root $repositoryRootFull
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
            acceptedPrimitives = @($plan.files | Where-Object { $_.kind -eq 'accepted-primitive' } | ForEach-Object {
                [ordered]@{
                    id = $_.id
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
