# 运行时投影共享门禁：Codex / Claude / 宿主中性（shared）三个投影 writer 共用同一套
# 路径/SHA/catalog 解析与 Build+Validate 主体。
# 本模块不是第二个 runtime owner，只是被三个投影 writer 点源的共享实现；
# writer 之间的全部差异由参数声明（见 Invoke-RuntimeProjection），禁止在 writer 里复制主体。

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

# 宿主 overlay 契约（唯一实现，两个投影 builder 共用）。
#
# Sliver 用 packaging/runtime-manifest.json 的 targets.<host>.overlay_files 声明「哪个适配文件装到哪个路径」。
# 本仓库**不复制也不改写**这张映射：复制会在上游改契约时静默漂移。
#
# **落点基准**：Sliver 的 overlay 目标路径是相对「运行时 bundle 根」的（即 Sliver 自己 SKILL.md 所在目录）。
# 证据：SKILL.md:145「Every published bundle contains exactly one fixed startup host slot at
# references/runtime-adapter.md … A platform adapter may replace only that slot」；核心 runtime-adapter.md:46
# 「If references/execution-liveness-host.md exists in the selected runtime bundle」。
# 在 Sliver 自己的包里 bundle 根 == 技能根，两者重合；而**本仓库把控制面嵌在 governance/sliver-core/ 下**，
# 两者不再重合。因此必须把 overlay 目标**重定位进控制面根**，否则：
#   - references/runtime-adapter.md 不会覆盖协议真正加载的那个槽位（宿主读到的仍是不声明适配的核心版）；
#   - references/studio-codex.md、references/execution-liveness-host.md、assets/project-claude/CLAUDE.md
#     都不在「selected runtime bundle」里，控制面按自己的相对路径找不到它们。
#
# 例外：`agents/` 开头的目标是 **Codex 插件元数据**（interface/display_name/default_prompt），
# 控制面文档从不引用它，宿主按「技能根」读。因此它留在投影根，不进控制面根。
function Get-HostOverlayFacts {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$TargetName
    )

    $manifestRelative = 'governance/sliver-core/packaging/runtime-manifest.json'
    $manifestPath = Join-Path $Root ($manifestRelative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "缺少 Sliver runtime manifest: $manifestRelative"
    }
    $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
    if (-not ($manifest.PSObject.Properties.Name -contains 'targets')) {
        throw "runtime manifest 缺少 targets: $manifestRelative"
    }
    if (-not ($manifest.targets.PSObject.Properties.Name -contains $TargetName)) {
        throw "runtime manifest 缺少 target '$TargetName'（fail-closed）"
    }
    $target = $manifest.targets.$TargetName
    if (-not ($target.PSObject.Properties.Name -contains 'overlay_files')) {
        throw "target '$TargetName' 缺少 overlay_files（fail-closed）"
    }

    # 控制面根从 manifest 自身位置推导：<cpRoot>/packaging/runtime-manifest.json → <cpRoot>
    $controlPlaneRoot = ($manifestRelative -replace '/packaging/runtime-manifest\.json$', '')
    if ([string]::IsNullOrWhiteSpace($controlPlaneRoot) -or $controlPlaneRoot -eq $manifestRelative) {
        throw "无法从 manifest 路径推导控制面根: $manifestRelative"
    }

    $facts = @()
    foreach ($property in $target.overlay_files.PSObject.Properties) {
        $destination = ([string]$property.Value).Replace('\', '/').TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($destination)) {
            throw ("overlay 目标为空: " + [string]$property.Name)
        }
        # 重定位基准：除 agents/（宿主插件元数据）外，其余都是运行时 bundle 内部路径
        $relativePath = if ($destination -like 'agents/*') { $destination } else { ($controlPlaneRoot + '/' + $destination) }
        $sourceRelativePath = ('governance/sliver-core/' + ([string]$property.Name).Replace('\', '/').TrimStart('/'))
        $sourcePath = Join-ContainedPath -Root $Root -RelativePath $sourceRelativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            throw ("缺少宿主 overlay 源文件: " + $sourceRelativePath)
        }
        $facts += [pscustomobject]@{
            id = 'host-overlay-' + ($relativePath -replace '[^A-Za-z0-9]+', '-')
            kind = 'host-facts'
            source = 'sliver-vibe-coding'
            sourceRevision = $null
            relativePath = $relativePath
            sourcePath = $sourcePath
            sourceRelativePath = $sourceRelativePath
        }
    }
    if ($facts.Count -eq 0) {
        throw "target '$TargetName' 的 overlay_files 为空（fail-closed）"
    }
    return $facts
}

# 把 overlay 事实合进核心包文件清单：目标路径相同者由 overlay 覆盖（Sliver 的 overlay 语义）。
function Merge-OverlayFacts {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$BaseFiles,
        [Parameter(Mandatory = $true)][object[]]$OverlayFacts
    )

    $overlayPaths = @{}
    foreach ($fact in $OverlayFacts) { $overlayPaths[[string]$fact.relativePath] = $true }

    $result = @($BaseFiles | Where-Object { -not $overlayPaths.ContainsKey([string]$_.relativePath) })
    $result += $OverlayFacts

    $duplicates = @($result | Group-Object relativePath | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    if ($duplicates.Count -gt 0) {
        throw ('overlay 合并后仍有重复路径: ' + ($duplicates -join ', '))
    }
    return $result
}

# 三个投影 writer（codex / claude / shared-neutral）共用的 Build + Validate 主体（唯一实现）。
# writer 只声明差异参数：
#   -ManifestName / -ManifestSchema / -ResultSchema  投影标记与结果 schema
#   -HostLabel                                        manifest 的 host 字段
#   -OverlayTargetName                                Sliver runtime-manifest 的 target 名；空 = 宿主中性（不合入任何 overlay）
#   -HostAdapter                                      可选，写进 manifest 的 hostAdapter 说明段（codex 中性为 $null）
#   -ResultExtras                                     可选，附加到验证结果顶层的字段（如 freshSessionSmoke）
# 宿主中性（-OverlayTargetName 为空）时 fail-closed 断言计划里不含任何 host-facts 文件。
function Invoke-RuntimeProjection {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Build', 'Validate')]
        [string]$Mode,

        [Parameter(Mandatory = $true)]
        [string]$RepositoryRoot,

        [Parameter(Mandatory = $true)]
        [string]$OutputRoot,

        [Parameter(Mandatory = $true)]
        [string]$ManifestName,

        [Parameter(Mandatory = $true)]
        [string]$ManifestSchema,

        [Parameter(Mandatory = $true)]
        [string]$ResultSchema,

        [Parameter(Mandatory = $true)]
        [string]$HostLabel,

        [string]$OverlayTargetName = '',

        $HostAdapter = $null,

        $ResultExtras = $null
    )

    # manifest 必须是输出根下的单段文件名（防路径拼接被滥用）
    if ($ManifestName -notmatch '^[A-Za-z0-9][A-Za-z0-9.-]*\.json$' -or $ManifestName -match '(^|/)\.\.?(?:/|$)') {
        throw "manifest 名必须是输出根下的单段文件名: $ManifestName"
    }

    $repositoryRootFull = Get-FullPath -Path $RepositoryRoot
    if (-not (Test-Path -LiteralPath $repositoryRootFull -PathType Container)) {
        throw "RepositoryRoot 不存在: $repositoryRootFull"
    }
    $outputRootFull = Get-FullPath -Path $OutputRoot

    $plan = Get-ProjectionPlan -Root $repositoryRootFull
    if ([string]::IsNullOrWhiteSpace($OverlayTargetName)) {
        $hostFactFiles = @(@($plan.files) | Where-Object { [string]$_.kind -eq 'host-facts' })
        if ($hostFactFiles.Count -gt 0) {
            throw ('宿主中性投影不得包含宿主 overlay 文件: ' + (@($hostFactFiles | ForEach-Object { [string]$_.relativePath }) -join ', '))
        }
    }
    else {
        $overlayFacts = @(Get-HostOverlayFacts -Root $repositoryRootFull -TargetName $OverlayTargetName)
        $plan.files = @(Merge-OverlayFacts -BaseFiles @($plan.files) -OverlayFacts $overlayFacts)
    }

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
                sourceRelativePath = if ($plannedFile.PSObject.Properties.Name -contains 'sourceRelativePath') { $plannedFile.sourceRelativePath } else { $plannedFile.relativePath }
                sourceSha256 = $sourceHash
                outputSha256 = $outputHash
            }
        }

        $manifest = [ordered]@{
            schema = $ManifestSchema
            status = 'candidate-unverified; static-smoke-only'
            host = $HostLabel
            source = [ordered]@{
                repositoryRevision = $plan.sourceRevision
                catalogPath = $plan.catalogRelativePath
                catalogSha256 = $plan.catalogSha256
            }
            projectEntry = [ordered]@{
                path = $plan.entryPath
                unique = $true
            }
            controlPlane = @($plan.files | Where-Object { $_.kind -eq 'control-plane' } | Group-Object id | ForEach-Object {
                $groupItems = @($_.Group)
                [ordered]@{
                    id = [string]$_.Name
                    status = [string]$groupItems[0].kind
                    files = @($groupItems | ForEach-Object { $_.relativePath })
                }
            })
            accepted = @($plan.files | Where-Object { $_.kind -ne 'control-plane' -and $_.kind -notlike 'host-*' } | Group-Object id | ForEach-Object {
                $groupItems = @($_.Group)
                [ordered]@{
                    id = [string]$_.Name
                    status = [string]$groupItems[0].kind
                    files = @($groupItems | ForEach-Object { $_.relativePath })
                }
            })
        }
        if ($null -ne $HostAdapter) { $manifest['hostAdapter'] = $HostAdapter }
        $manifest['excluded'] = [ordered]@{
            blocked = @($plan.blockedRecords)
            forbiddenSegments = @($plan.forbiddenSegments)
            projectEntryAliases = @($plan.entryAliases)
        }
        $manifest['files'] = $manifestFiles
        $manifest['fileCounts'] = [ordered]@{
            copied = @($plan.files).Count
            generated = 1
            total = @($plan.files).Count + 1
        }
        $manifestPath = Join-ContainedPath -Root $outputRootFull -RelativePath $ManifestName
        $manifest | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -LiteralPath $manifestPath
    }

    if (-not (Test-Path -LiteralPath $outputRootFull -PathType Container)) {
        throw "projection 输出目录不存在: $outputRootFull"
    }

    $manifestPath = Join-ContainedPath -Root $outputRootFull -RelativePath $ManifestName
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "缺少 projection manifest: $manifestPath"
    }

    $manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.schema -ne $ManifestSchema) {
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

    $expectedFiles = @($plan.files | ForEach-Object { $_.relativePath }) + $ManifestName
    $actualFiles = @(Get-ChildItem -LiteralPath $outputRootFull -Recurse -Force -File | ForEach-Object {
        Get-NormalizedRelativePath -Root $outputRootFull -FullPath $_.FullName
    })
    $missingFiles = @($expectedFiles | Where-Object { $actualFiles -notcontains $_ })
    $unexpectedFiles = @($actualFiles | Where-Object { $expectedFiles -notcontains $_ })
    if ($missingFiles.Count -gt 0 -or $unexpectedFiles.Count -gt 0) {
        throw "projection 文件集合不匹配: missing=[$($missingFiles -join ', ')]; unexpected=[$($unexpectedFiles -join ', ')]"
    }

    $expectedDirectories = Get-ExpectedDirectories -Files $plan.files
    $actualDirectories = @(Get-ChildItem -LiteralPath $outputRootFull -Recurse -Force -Directory | ForEach-Object {
        Get-NormalizedRelativePath -Root $outputRootFull -FullPath $_.FullName
    })
    $unexpectedDirectories = @($actualDirectories | Where-Object { $expectedDirectories -notcontains $_ })
    if ($unexpectedDirectories.Count -gt 0) {
        throw "projection 包含未授权目录: $($unexpectedDirectories -join ', ')"
    }

    $rootFiles = @(Get-ChildItem -LiteralPath $outputRootFull -Force -File | ForEach-Object { $_.Name })
    $expectedRootFiles = @('SKILL.md', $ManifestName)
    if ($rootFiles.Count -ne $expectedRootFiles.Count -or @($rootFiles | Where-Object { $expectedRootFiles -notcontains $_ }).Count -gt 0) {
        throw "projection 顶层只能包含唯一项目入口和 manifest，实际为: $($rootFiles -join ', ')"
    }

    $forbiddenSegments = @($plan.forbiddenSegments)
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

    $manifestFilesRecords = @($manifest.files)
    if ($manifestFilesRecords.Count -ne @($plan.files).Count) {
        throw "manifest 文件数不一致: manifest=$($manifestFilesRecords.Count), expected=$(@($plan.files).Count)"
    }

    $fileHashes = @()
    foreach ($plannedFile in $plan.files) {
        $outputPath = Join-ContainedPath -Root $outputRootFull -RelativePath $plannedFile.relativePath
        if (-not (Test-Path -LiteralPath $outputPath -PathType Leaf)) {
            throw "缺少已批准的 projection 文件: $outputPath"
        }

        $sourceHash = Get-Sha256 -Path $plannedFile.sourcePath
        $outputHash = Get-Sha256 -Path $outputPath
        $manifestFile = @($manifestFilesRecords | Where-Object { $_.path -eq $plannedFile.relativePath })
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

    $result = [ordered]@{
        schema = $ResultSchema
        mode = 'Validate'
        status = 'PASS'
        sourceRevision = $plan.sourceRevision
        catalogSha256 = $plan.catalogSha256
        outputRoot = $outputRootFull
        include = @($plan.files | ForEach-Object {
            [ordered]@{
                id = $_.id
                kind = $_.kind
                path = $_.relativePath
            }
        })
        exclude = [ordered]@{
            blocked = @($plan.blockedRecords)
            forbiddenSegments = @($plan.forbiddenSegments)
            projectEntryAliases = @($plan.entryAliases)
        }
        fileCounts = [ordered]@{
            copied = @($plan.files).Count
            generated = 1
            total = $actualFiles.Count
        }
        fileHashes = $fileHashes
        manifestSha256 = Get-Sha256 -Path $manifestPath
    }
    if ($null -ne $ResultExtras) {
        foreach ($extraProperty in $ResultExtras.GetEnumerator()) {
            $result[$extraProperty.Key] = $extraProperty.Value
        }
    }
    $result['exitCode'] = 0
    if ($Mode -eq 'Build') { $result['mode'] = 'Build' }
    return $result
}
