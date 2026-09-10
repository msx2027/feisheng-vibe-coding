# 运行时投影共享门禁：Codex 与 Claude 投影脚本共用同一套路径/SHA/catalog 解析逻辑。
# 本模块不是第二个 runtime owner，只是被两个投影 writer 点源的只读门禁函数集。

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
    if ($catalog.PSObject.Properties.Name -notcontains 'decisionPolicy') {
        throw 'canonical catalog 缺少 decisionPolicy；门禁必须从决策策略读取 runtime include 集合。'
    }
    $controlPlaneStatus = [string]$catalog.decisionPolicy.controlPlaneStatus
    if ([string]::IsNullOrWhiteSpace($controlPlaneStatus)) {
        throw 'decisionPolicy.controlPlaneStatus 缺失。'
    }
    $runtimeIncludedStatuses = @($catalog.decisionPolicy.acceptedStatuses)
    if ($runtimeIncludedStatuses.Count -eq 0 -or $runtimeIncludedStatuses -notcontains $controlPlaneStatus) {
        throw 'decisionPolicy.acceptedStatuses 必须非空且包含 controlPlaneStatus。'
    }

    $entryPath = ConvertTo-SafeRelativePath -Path ([string]$catalog.projectEntry) -Label 'projectEntry'
    if ($entryPath -ne 'SKILL.md') {
        throw "本投影只接受唯一根入口 SKILL.md，实际为: $entryPath"
    }

    $records = @($catalog.records)
    if ($records.Count -eq 0) {
        throw 'canonical catalog 没有记录。'
    }

    $controlPlaneRecords = @($records | Where-Object { $_.status -eq $controlPlaneStatus })
    if ($controlPlaneRecords.Count -ne 1) {
        throw "control-plane 记录必须唯一，实际数量: $($controlPlaneRecords.Count)"
    }

    $acceptedPrimitiveRecords = @($records | Where-Object {
        $runtimeIncludedStatuses -contains $_.status -and $_.status -ne $controlPlaneStatus
    })
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
            throw "blocked record 不能进入 runtime projection: $($blockedRecord.id)"
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
