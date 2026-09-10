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

function Get-RecordBundleFilePaths {
    param(
        [Parameter(Mandatory = $true)]$Record
    )

    # 记录自身的那个文件始终属于该记录（单文件单位 = 这个文件；目录单位 = 必含它）。
    $recordPath = [string]$Record.path
    if ([string]::IsNullOrWhiteSpace($recordPath)) {
        throw "record '$($Record.id)' 缺少 path。"
    }

    if ($Record.PSObject.Properties.Name -notcontains 'bundle' -or $null -eq $Record.bundle) {
        return @($recordPath)
    }

    $paths = @()
    foreach ($file in @($Record.bundle.files)) {
        $filePath = [string]$file.path
        if ([string]::IsNullOrWhiteSpace($filePath)) {
            throw "record '$($Record.id)' 的 bundle 里存在空 path。"
        }
        $paths += $filePath
    }
    if ($paths.Count -eq 0) {
        throw "record '$($Record.id)' 的 bundle 没有任何文件；拒绝空 bundle（fail-closed）。"
    }
    if ($paths -notcontains $recordPath) {
        throw "record '$($Record.id)' 的 bundle 不包含记录自身的 path: $recordPath"
    }

    return @($paths)
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

    # blocked 记录一律不得进入投影（下方逐条校验）。
    # 不再硬编码「哪些 id 必须 blocked」：那是一条写在代码里的分类判断，
    # 与「分类唯一真源是 SKILL-CLASSIFICATION.json」冲突；分类改动应由数据 + 证据驱动。
    $blockedRecords = @($records | Where-Object { $_.status -like 'blocked-*' })

    $includedRecords = @($controlPlaneRecords + $acceptedPrimitiveRecords)
    # bundle 展开（唯一实现）：
    #   记录带 bundle → 用 bundle.files 作为该记录的投影文件清单（生成器已逐文件记 sha，仍是显式白名单）
    #   记录无 bundle → 退化为单文件（record.path）
    # 这样「runtime 单位是目录还是单文件」由 catalog 的 bundlePolicy 决定，而不是在门禁里硬编码。
    $includedPaths = @($entryPath)
    $filePlan = @()
    foreach ($record in $includedRecords) {
        if ([string]::IsNullOrWhiteSpace([string]$record.id)) {
            throw 'catalog 中的 included record 缺少 id。'
        }
        foreach ($bundleRelativePath in @(Get-RecordBundleFilePaths -Record $record)) {
            $bundlePath = ConvertTo-SafeRelativePath -Path $bundleRelativePath -Label "record $($record.id) 的 bundle 文件"
            if ($includedPaths -contains $bundlePath) {
                throw "catalog include 路径重复: $bundlePath"
            }
            $includedPaths += $bundlePath
        }
    }

    foreach ($blockedRecord in $blockedRecords) {
        $blockedPath = ConvertTo-SafeRelativePath -Path ([string]$blockedRecord.path) -Label "blocked record $($blockedRecord.id) 的 path"
        if ($includedPaths -contains $blockedPath) {
            throw "blocked record 不能进入 runtime projection: $($blockedRecord.id)"
        }
    }

    # 写权限门禁（防重复写入者）：
    #   A) runtime include 必须声明 writeAuthority（不能空声明）
    #   B) 任何记录声明了控制面 token 时，必须是该 token 的排他 owner
    $hasWritePolicy = $catalog.decisionPolicy.PSObject.Properties.Name -contains 'writeAuthorityPolicy'
    $runtimeRecords = @($records | Where-Object { $runtimeIncludedStatuses -contains $_.status })
    if ($runtimeRecords.Count -gt 0 -and -not $hasWritePolicy) {
        throw '缺少 decisionPolicy.writeAuthorityPolicy：无法校验写权限排他性（fail-closed）。'
    }
    if ($hasWritePolicy) {
        $writePolicy = $catalog.decisionPolicy.writeAuthorityPolicy
        $controlPlaneTokens = @($writePolicy.controlPlaneTokens)
        foreach ($record in $records) {
            $authority = @()
            if ($record.PSObject.Properties.Name -contains 'writeAuthority' -and $null -ne $record.writeAuthority) {
                $authority = @($record.writeAuthority)
            }
            if (($runtimeIncludedStatuses -contains $record.status) -and $authority.Count -eq 0) {
                throw "runtime include 必须声明 writeAuthority: $($record.id)"
            }
            foreach ($token in $authority) {
                if ($controlPlaneTokens -notcontains [string]$token) { continue }
                $allowed = @()
                if ($writePolicy.exclusiveOwners.PSObject.Properties.Name -contains [string]$token) {
                    $allowed = @($writePolicy.exclusiveOwners.$token)
                }
                if ($allowed -notcontains $record.id) {
                    throw "重复写入者: '$($record.id)' 声明了控制面 token '$token'，但排他 owner 为 [$($allowed -join ', ')]"
                }
            }
        }
    }

    $entryAliases = @()
    $projectEntryGroups = @($catalog.duplicateGroups | Where-Object { $_.id -eq 'project-entry' })
    foreach ($group in $projectEntryGroups) {
        $entryAliases += @($group.aliases)
    }
    $entryAliases = @($entryAliases | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -Unique)

    # 禁止路径段从 catalog 的 bundlePolicy 读（真源 = SKILL-CLASSIFICATION.json 的 bundlePolicy），
    # 不在每个 builder 里各写一份。缺失时回退到内置默认值，并始终合并入口别名。
    $forbiddenSegments = @('sources', '.agents', '.claude', '.codex', 'hooks', 'codex-hooks', 'generated-mirrors')
    if ($catalog.PSObject.Properties.Name -contains 'bundlePolicy' -and $null -ne $catalog.bundlePolicy) {
        if ($catalog.bundlePolicy.PSObject.Properties.Name -contains 'forbiddenSegments') {
            $policySegments = @($catalog.bundlePolicy.forbiddenSegments | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
            if ($policySegments.Count -eq 0) {
                throw 'catalog.bundlePolicy.forbiddenSegments 为空；拒绝在缺失策略时继续（fail-closed）。'
            }
            $forbiddenSegments = @($policySegments)
        }
    }
    $forbiddenSegments = @($forbiddenSegments + $entryAliases | Select-Object -Unique)

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
        $recordRevision = if ($record.PSObject.Properties.Name -contains 'sourceRevision' -and $null -ne $record.sourceRevision) { [string]$record.sourceRevision } else { $null }
        foreach ($bundleRelativePath in @(Get-RecordBundleFilePaths -Record $record)) {
            $recordPath = ConvertTo-SafeRelativePath -Path $bundleRelativePath -Label "record $($record.id) 的文件"
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
                sourceRevision = $recordRevision
                relativePath = $recordPath
                sourcePath = $sourcePath
            }
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
        forbiddenSegments = $forbiddenSegments
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
