# 来源快照完整性门禁（共享模块）
#
# 目的：把「快照未被篡改 / 与来源一致」从一次性审计结论变成**可重复强制**的属性。
# 单一实现：本模块被 scripts/record-provenance-integrity.ps1（写入基线）与
# scripts/verify.ps1（每次校验）共同点源，禁止在别处复制一份。
#
# 两层校验：
#   1) 自证（self-integrity，CI 可用，不依赖来源目录）：重算快照树摘要并与
#      provenance/PROVENANCE-INTEGRITY.json 的记录比对；任何字节变化都会改变树摘要。
#   2) 交叉校验（source comparison，来源目录存在时才做）：每个快照文件必须与
#      同路径来源文件逐字节一致，或落在记录的 supplementAllowlist 内。
#
# 树摘要算法（sha256-lines-v1，跨 PowerShell 版本确定）：
#   记录 = 每个文件一行 "相对路径(/)`n 文件SHA-256"；按 Ordinal 排序相对路径；
#   以 LF 连接并追加结尾 LF；对 UTF-8(无 BOM) 字节求 SHA-256。

function Get-NormalizedTreeRelativePath {
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$FullPath)
    $rootFull = [System.IO.Path]::GetFullPath($Root)
    $candidate = [System.IO.Path]::GetFullPath($FullPath)
    $prefix = $rootFull.TrimEnd([char[]]@([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)) + [System.IO.Path]::DirectorySeparatorChar
    if (-not $candidate.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "文件不属于给定根目录: $FullPath"
    }
    return $candidate.Substring($prefix.Length).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
}

function Get-SnapshotFileRecords {
    param([Parameter(Mandatory = $true)][string]$Root)

    $rootFull = [System.IO.Path]::GetFullPath($Root)
    if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) {
        throw "快照目录不存在: $rootFull"
    }

    $records = @()
    $items = @(Get-ChildItem -LiteralPath $rootFull -Recurse -Force -File | Sort-Object FullName)
    foreach ($item in $items) {
        $relative = Get-NormalizedTreeRelativePath -Root $rootFull -FullPath $item.FullName
        $records += [pscustomobject]@{
            path = $relative
            sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant()
        }
    }

    $byPath = @{}
    foreach ($record in $records) { $byPath[$record.path] = $record }
    $paths = [string[]]@($byPath.Keys)
    [Array]::Sort($paths, [System.StringComparer]::Ordinal)
    return @($paths | ForEach-Object { $byPath[$_] })
}

function Get-SnapshotTreeHash {
    param([Parameter(Mandatory = $true)][object[]]$Records)

    $lines = foreach ($record in $Records) { ([string]$record.path) + "`n" + ([string]$record.sha256) }
    $payload = ($lines -join "`n")
    if ($Records.Count -gt 0) { $payload += "`n" }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        return 'sha256:' + ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Test-PathWithinAllowlist {
    param(
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $false)][string[]]$Allowlist = @()
    )
    foreach ($entry in @($Allowlist)) {
        if ([string]::IsNullOrWhiteSpace([string]$entry)) { continue }
        $normalized = ([string]$entry).Replace([System.IO.Path]::DirectorySeparatorChar, '/').TrimEnd('/')
        if ($RelativePath -eq $normalized -or $RelativePath.StartsWith($normalized + '/')) { return $true }
    }
    return $false
}

function Get-SourceState {
    param([Parameter(Mandatory = $true)][string]$SourceRoot)

    # 注意：不能返回裸数组——干净仓库的“空数组”会被 PowerShell 解包成 $null，
    # 与“不是 git 仓库”无法区分。因此统一返回对象。
    if (-not (Test-Path -LiteralPath $SourceRoot -PathType Container)) {
        return [pscustomobject]@{ kind = 'unavailable'; dirtyPaths = @(); revision = $null }
    }
    $gitDir = Join-Path $SourceRoot '.git'
    if (-not (Test-Path -LiteralPath $gitDir) -or -not (Get-Command git -ErrorAction SilentlyContinue)) {
        return [pscustomobject]@{ kind = 'not-a-git-checkout'; dirtyPaths = @(); revision = $null }
    }
    $output = & git -C $SourceRoot status --porcelain 2>$null
    if ($LASTEXITCODE -ne 0) { throw "无法读取来源 git 状态: $SourceRoot" }
    $paths = @()
    foreach ($line in @($output)) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $paths += $line.Substring(3).Trim().Replace([System.IO.Path]::DirectorySeparatorChar, '/')
    }
    $sorted = [string[]]@($paths)
    [Array]::Sort($sorted, [System.StringComparer]::Ordinal)
    $revision = (& git -C $SourceRoot rev-parse HEAD 2>$null).Trim()
    return [pscustomobject]@{ kind = 'git'; dirtyPaths = @($sorted); revision = $revision }
}

function Get-LocalPatches {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

    # 本地补丁登记（本仓库自持后允许对 vendored 内容做补丁）。
    # 返回 snapshot -> path -> { originalSha256, patchedSha256, patchId } 的映射。
    # 未登记的偏差仍视为漂移；登记项哈希不符也失败（登记不得过期）。
    $path = Join-Path $RepositoryRoot 'provenance/LOCAL-PATCHES.json'
    $map = @{}
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $map }
    $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $path | ConvertFrom-Json
    if ($doc.schema -ne 'feisheng-local-patches/v1') { throw "不支持的 LOCAL-PATCHES schema: $($doc.schema)" }
    foreach ($patch in @($doc.patches)) {
        $snapshot = [string]$patch.snapshot
        if (-not $map.ContainsKey($snapshot)) { $map[$snapshot] = @{} }
        foreach ($file in @($patch.files)) {
            $relative = ([string]$file.path).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
            $map[$snapshot][$relative] = [pscustomobject]@{
                originalSha256 = [string]$file.originalSha256
                patchedSha256 = [string]$file.patchedSha256
                patchId = [string]$patch.id
            }
        }
    }
    return $map
}

function Get-RuntimeCopyPatches {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        # 可选过滤：只取派生自某个来源快照的登记项（按登记项自带的 snapshotPath 前缀判断）。
        # 两个消费方（vibe 导入 / matt 导入）各自只看自己负责的登记，避免把对方的登记误判成「登记过期」。
        [Parameter(Mandatory = $false)][string]$SnapshotPathPrefix = ''
    )

    # 一等副本（skills/**）的本地补丁登记。
    #
    # 为什么需要独立命名空间：LOCAL-PATCHES.json 的键空间有两类互不重叠的对象——
    #   ① 快照树补丁（snapshot = 快照名，path 相对该快照根）：校验「快照 == patchedSha256，来源 == originalSha256」；
    #   ② 一等副本补丁（snapshot = 'runtime-import'，path 相对仓库根）：校验「导入副本 == patchedSha256，
    #      它偏离的原始内容 == originalSha256（= 来源快照文件的哈希）」。
    # 两类都 fail-closed：未登记的偏差仍然是漂移，登记过期（哈希不符）同样失败。
    # 分开命名空间是必需的：副本路径若写进快照命名空间，会被快照校验误读成「快照本身应等于 patchedSha256」。
    $map = @{}
    $path = Join-Path $RepositoryRoot 'provenance/LOCAL-PATCHES.json'
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $map }
    $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $path | ConvertFrom-Json
    if ($doc.schema -ne 'feisheng-local-patches/v1') { throw "不支持的 LOCAL-PATCHES schema: $($doc.schema)" }
    foreach ($patch in @($doc.patches)) {
        if ([string]$patch.snapshot -ne 'runtime-import') { continue }
        foreach ($file in @($patch.files)) {
            $sourceSnapshotPath = ''
            if ($file.PSObject.Properties.Name -contains 'snapshotPath') {
                $sourceSnapshotPath = ([string]$file.snapshotPath).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
            }
            if (-not [string]::IsNullOrWhiteSpace($SnapshotPathPrefix)) {
                if (-not $sourceSnapshotPath.StartsWith($SnapshotPathPrefix, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
            }
            $relative = ([string]$file.path).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
            $map[$relative] = [pscustomobject]@{
                originalSha256 = [string]$file.originalSha256
                patchedSha256 = [string]$file.patchedSha256
                patchId = [string]$patch.id
                snapshotPath = $sourceSnapshotPath
            }
        }
    }
    return $map
}

function Test-ProvenanceIntegrity {
    param(
        [Parameter(Mandatory = $true)][string]$RepositoryRoot,
        [Parameter(Mandatory = $false)][switch]$RequireSource
    )

    $repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $recordPath = Join-Path $repoRoot 'provenance/PROVENANCE-INTEGRITY.json'
    if (-not (Test-Path -LiteralPath $recordPath -PathType Leaf)) {
        throw "缺少 provenance/PROVENANCE-INTEGRITY.json（请先跑 scripts/record-provenance-integrity.ps1）。"
    }
    $record = Get-Content -Raw -Encoding UTF8 -LiteralPath $recordPath | ConvertFrom-Json
    if ($record.schema -ne 'feisheng-provenance-integrity/v1') {
        throw "不支持的 provenance integrity schema: $($record.schema)"
    }
    if ($record.algorithm -ne 'sha256-lines-v1') {
        throw "不支持的树摘要算法: $($record.algorithm)"
    }

    $localPatches = Get-LocalPatches -RepositoryRoot $repoRoot

    $result = @()
    $errors = @()
    foreach ($snapshot in @($record.snapshots)) {
        $snapshotRoot = Join-Path $repoRoot ([string]$snapshot.path)
        $records = @(Get-SnapshotFileRecords -Root $snapshotRoot)
        $treeHash = Get-SnapshotTreeHash -Records $records
        $countOk = ($records.Count -eq [int]$snapshot.fileCount)
        $hashOk = ($treeHash -eq [string]$snapshot.treeHash)

        $drifted = @()
        if (-not $countOk) {
            $errors += ("快照文件数变化: " + $snapshot.name + " 记录=" + $snapshot.fileCount + " 实际=" + $records.Count)
        }
        if (-not $hashOk) {
            # 记录只保存聚合摘要（避免与 VIBE-IMPORT 重复逐文件哈希）；漂移定位交给下方来源比对。
            $errors += ("快照树摘要变化: " + $snapshot.name + " 记录=" + $snapshot.treeHash + " 实际=" + $treeHash)
        }

        $sourceRoot = [string]$snapshot.sourceRoot
        $sourceAvailable = (-not [string]::IsNullOrWhiteSpace($sourceRoot)) -and (Test-Path -LiteralPath $sourceRoot -PathType Container)
        $sourceChecked = 0
        $sourceSkipped = 0
        $revisionChecked = 0
        $patchedChecked = 0
        $sourceDrift = @()

        # 该快照下已登记的本地补丁
        $snapshotPatches = @{}
        if ($localPatches.ContainsKey([string]$snapshot.name)) { $snapshotPatches = $localPatches[[string]$snapshot.name] }

        # 来自某个 git revision 的文件（工作树已改动，故有意不采用工作树内容）：
        # 与记录的 sha256 比对，不比对工作树。
        $revisionSourced = @{}
        if ($snapshot.PSObject.Properties.Name -contains 'revisionSourcedPaths') {
            foreach ($entry in @($snapshot.revisionSourcedPaths)) {
                $revisionSourced[[string]$entry.path] = [string]$entry.sha256
            }
        }

        if ($sourceAvailable) {
            $allowlist = @($snapshot.supplementAllowlist)
            foreach ($record in $records) {
                if (Test-PathWithinAllowlist -RelativePath $record.path -Allowlist $allowlist) { $sourceSkipped++; continue }
                if ($snapshotPatches.ContainsKey($record.path)) {
                    # 已登记的本地补丁：快照必须等于 patchedSha256；来源必须仍等于 originalSha256
                    $patch = $snapshotPatches[$record.path]
                    if ($patch.patchedSha256 -ne $record.sha256) {
                        $sourceDrift += ($record.path + ' (content-vs-registered-patch)')
                        continue
                    }
                    $sourcePath = Join-Path $sourceRoot ($record.path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
                    if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
                        $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant()
                        if ($sourceHash -ne $patch.originalSha256) {
                            $sourceDrift += ($record.path + ' (upstream-moved-under-patch)')
                            continue
                        }
                    }
                    $patchedChecked++
                    continue
                }
                if ($revisionSourced.ContainsKey($record.path)) {
                    if ($revisionSourced[$record.path] -ne $record.sha256) {
                        $sourceDrift += ($record.path + ' (content-vs-recorded-revision)')
                    } else {
                        $revisionChecked++
                    }
                    continue
                }
                $sourcePath = Join-Path $sourceRoot ($record.path.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
                if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
                    $sourceDrift += ($record.path + ' (absent-in-source)')
                    continue
                }
                $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourcePath).Hash.ToLowerInvariant()
                if ($sourceHash -ne $record.sha256) { $sourceDrift += ($record.path + ' (content-vs-source)') } else { $sourceChecked++ }
            }
            if ($sourceDrift.Count -gt 0) {
                $preview = @($sourceDrift | Select-Object -First 5)
                $suffix = if ($sourceDrift.Count -gt $preview.Count) { ' …' } else { '' }
                $errors += ("快照与来源不一致: " + $snapshot.name + " 共 " + $sourceDrift.Count + " 个文件 → " + ($preview -join ', ') + $suffix)
            }
        } elseif ($RequireSource) {
            $errors += ("来源目录不可用（RequireSource）: " + $snapshot.name + " sourceRoot=" + $sourceRoot)
        }

        $result += [pscustomobject]@{
            name = [string]$snapshot.name
            path = [string]$snapshot.path
            fileCount = $records.Count
            expectedFileCount = [int]$snapshot.fileCount
            treeHash = $treeHash
            expectedTreeHash = [string]$snapshot.treeHash
            treeHashMatch = $hashOk
            countMatch = $countOk
            sourceAvailable = $sourceAvailable
            sourceCheckedFiles = $sourceChecked
            revisionSourcedCheckedFiles = $revisionChecked
            locallyPatchedCheckedFiles = $patchedChecked
            sourceAllowlistedFiles = $sourceSkipped
            driftedPaths = @($drifted + $sourceDrift)
        }
    }

    return [pscustomobject]@{
        ok = ($errors.Count -eq 0)
        errors = @($errors)
        snapshots = @($result)
    }
}

function Export-GitBlobToFile {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRoot,
        [Parameter(Mandatory = $true)][string]$Revision,
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$DestinationPath,
        [Parameter(Mandatory = $false)][switch]$NormalizeCrlf
    )

    # 字节安全地从 git 对象库导出某个 revision 的文件内容。
    # 不能用 PowerShell 管道接 git 输出：原生输出会被当作文本行处理，破坏字节与换行。
    #
    # 换行：git blob 存 LF（源仓库 core.autocrlf=true），工作树与快照均为 CRLF。
    # 已实测模型：`blob 经 LF->CRLF 归一化后 == 源工作树`（6/6 抽样逐字节相等）。
    # -NormalizeCrlf 即应用这条已证实的检查出约定，保证快照内换行约定一致（否则
    # 在 autocrlf 下同一文件会在 checkout 时被改回 CRLF，导致记录哈希不可复现）。
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'git 不可用。' }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'git'
    $psi.WorkingDirectory = $SourceRoot
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.Arguments = 'cat-file blob "' + $Revision + ':' + $RelativePath + '"'

    $process = [System.Diagnostics.Process]::Start($psi)
    $stream = New-Object System.IO.MemoryStream
    $bytes = $null
    try {
        $process.StandardOutput.BaseStream.CopyTo($stream)
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) {
            throw ('无法读取 git blob ' + $Revision + ':' + $RelativePath + ' :: ' + $stderr)
        }
        $bytes = $stream.ToArray()
    } finally {
        $stream.Dispose()
        $process.Dispose()
    }

    $blobSha256 = Get-BytesSha256 -Bytes $bytes
    $normalization = 'none'
    if ($NormalizeCrlf) {
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        $normalized = $text.Replace("`r`n", "`n").Replace("`n", "`r`n")
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
        $normalization = 'lf-to-crlf'
    }

    $directory = Split-Path -Parent $DestinationPath
    if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
    [System.IO.File]::WriteAllBytes($DestinationPath, $bytes)

    return [pscustomobject]@{
        path = $RelativePath
        revision = $Revision
        blobSha256 = $blobSha256
        byteCount = $bytes.Length
        normalization = $normalization
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $DestinationPath).Hash.ToLowerInvariant()
    }
}

function Get-BytesSha256 {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Sort-StringsOrdinal {
    param([Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$Values)
    $copy = [string[]]@($Values)
    [Array]::Sort($copy, [System.StringComparer]::Ordinal)
    return @($copy)
}

function Get-MarkdownFenceCount {
    param([Parameter(Mandatory = $true)][string]$Text)

    # 统计「行首 ``` 围栏行」数量（允许 ≤3 空格缩进，CommonMark）。奇偶用于判断围栏是否配对；
    # 嵌套围栏等历史怪癖在原文与副本两侧同构，比奇偶不影响判定。
    $count = 0
    foreach ($line in @($Text.Replace("`r`n", "`n").Split("`n"))) {
        if ($line.TrimStart(' ').StartsWith('```')) { $count++ }
    }
    return $count
}

function Get-FrontmatterInfo {
    param([Parameter(Mandatory = $true)][string]$Text)

    # 解析 YAML frontmatter 的有无与顶层键名集合（键名顺序不敏感；值不解析、允许变）。
    $lines = @($Text.Replace("`r`n", "`n").Split("`n"))
    $info = [pscustomobject]@{ hasFrontmatter = $false; keys = @() }
    if ($lines.Count -lt 2) { return $info }
    if ($lines[0] -ne '---') { return $info }
    $info.hasFrontmatter = $true
    $keys = @()
    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -eq '---' -or $lines[$i] -eq '...') { break }
        if ($lines[$i] -match '^([A-Za-z][A-Za-z0-9_-]*)\s*:') { $keys += $Matches[1] }
    }
    $info.keys = @($keys)
    return $info
}

function Get-AsciiPathSkeletonMap {
    param([Parameter(Mandatory = $true)][string]$Text)

    # 从反引号 inline code 里提取「像路径的 token」（含 '/' 且纯 ASCII 路径字符），
    # 骨架 = 剥掉所有 [A-Za-z0-9/._-] 之外的字符。骨架 -> 原始 token 集合。
    # 用途：识别「路径被加料改写」——骨架相同但原文不同，典型是把
    # tools/check-api-contracts.mjs 顺手写成 tools/check-api-contracts（接口契约）.mjs。
    $map = @{}
    $spans = [System.Text.RegularExpressions.Regex]::Matches($Text, '`([^`\r\n]+)`')
    foreach ($span in $spans) {
        $token = $span.Groups[1].Value
        if ($token.IndexOf('/') -lt 0) { continue }
        if ($token -notmatch '^[A-Za-z0-9][A-Za-z0-9/._\-]*$') { continue }
        $skeleton = [System.Text.RegularExpressions.Regex]::Replace($token, '[^A-Za-z0-9/._\-]', '')
        if (-not $map.ContainsKey($skeleton)) {
            $map[$skeleton] = New-Object 'System.Collections.Generic.HashSet[string]'
        }
        $map[$skeleton].Add($token) | Out-Null
    }
    return $map
}

function Test-RuntimePatchStructureInvariants {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

    # 已登记文本补丁的结构不变量（vendored 补丁安全网）。
    #
    # 背景：哈希对账只证明「登记内容 == 文件内容」，不证明「补丁没有顺手破坏结构」——
    # 哈希证明意图，不证明安全。本检查对每个 runtime-import 登记项，把来源快照原文与
    # 补丁后副本做三类结构级比对，拦三类手滑：
    #   ① 围栏奇偶：补丁把 ``` 围栏数从偶数改成奇数（删了半个代码围栏，其后全部内容错位）；
    #   ② frontmatter：有无翻转或键集变化（键丢失/新增会改变技能加载与门控行为；值允许变）；
    #   ③ 路径 token 改写：补丁后出现骨架与既有路径相同、原文不同的 token（路径被翻译/加料）。
    # 不拦：新增合法引用、删除既有引用、正文改写——这些是文本补丁的正常形态。
    # 限制：sliver-core 命名空间的原文不在本仓库（只有哈希），无法做内容级比对，不覆盖。
    # fail-closed：原文或副本缺失 = 失败；检查不了不等于通过。

    $repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $patches = Get-RuntimeCopyPatches -RepositoryRoot $repoRoot
    $errors = @()
    $checked = 0

    foreach ($relative in $patches.Keys) {
        $entry = $patches[$relative]
        $snapshotPath = [string]$entry.snapshotPath
        $patchedPath = Join-Path $repoRoot ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        $originalPath = Join-Path $repoRoot ($snapshotPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
        if ([string]::IsNullOrWhiteSpace($snapshotPath) -or -not (Test-Path -LiteralPath $originalPath -PathType Leaf)) {
            $errors += ($relative + ' (结构不变量无法执行：来源原文缺失 ' + $snapshotPath + ')')
            continue
        }
        if (-not (Test-Path -LiteralPath $patchedPath -PathType Leaf)) {
            $errors += ($relative + ' (结构不变量无法执行：补丁副本缺失)')
            continue
        }

        $originalText = [System.IO.File]::ReadAllText($originalPath)
        $patchedText = [System.IO.File]::ReadAllText($patchedPath)

        # ① 围栏奇偶一致
        $originalFences = Get-MarkdownFenceCount -Text $originalText
        $patchedFences = Get-MarkdownFenceCount -Text $patchedText
        if (($originalFences % 2) -ne ($patchedFences % 2)) {
            $errors += ($relative + ' (围栏奇偶变化: 原文 ' + $originalFences + ' 个 ``` 行，补丁后 ' + $patchedFences + ' 个——疑似删/多了半个代码围栏)')
        }

        # ② frontmatter 有无与键集一致（值允许变）
        $originalFm = Get-FrontmatterInfo -Text $originalText
        $patchedFm = Get-FrontmatterInfo -Text $patchedText
        if ($originalFm.hasFrontmatter -ne $patchedFm.hasFrontmatter) {
            $errors += ($relative + ' (frontmatter 有无翻转: 原文 ' + $originalFm.hasFrontmatter + '，补丁后 ' + $patchedFm.hasFrontmatter + ')')
        } elseif ($originalFm.hasFrontmatter) {
            $originalKeys = Sort-StringsOrdinal -Values $originalFm.keys
            $patchedKeys = Sort-StringsOrdinal -Values $patchedFm.keys
            if ((@($originalKeys) -join '`n') -ne (@($patchedKeys) -join '`n')) {
                $errors += ($relative + ' (frontmatter 键集变化: 原文 [' + ($originalKeys -join ', ') + ']，补丁后 [' + ($patchedKeys -join ', ') + '])')
            }
        }

        # ③ 既有路径 token 未被加料改写（骨架相同、原文不同）。
        # 补丁侧必须对全部反引号 token 算骨架——带中文加料的 token 本身过不了 ASCII 门禁，
        # 先按门禁过滤会把恰要抓的对象（tools/foo（工具）.mjs）放走。
        $originalSkeletons = Get-AsciiPathSkeletonMap -Text $originalText
        $patchedSpans = [System.Text.RegularExpressions.Regex]::Matches($patchedText, '`([^`\r\n]+)`')
        foreach ($span in $patchedSpans) {
            $token = $span.Groups[1].Value
            $skeleton = [System.Text.RegularExpressions.Regex]::Replace($token, '[^A-Za-z0-9/._\-]', '')
            if ($skeleton.IndexOf('/') -lt 0) { continue }
            if ($originalSkeletons.ContainsKey($skeleton) -and -not $originalSkeletons[$skeleton].Contains($token)) {
                $errors += ($relative + ' (路径 token 被改写: ' + $token + ')')
            }
        }

        $checked++
    }

    return [pscustomobject]@{
        ok = ($errors.Count -eq 0)
        checked = $checked
        errors = @($errors)
    }
}

function Test-RuntimePatchLineCounts {
    param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

    # 登记项的 linesChanged 必须等于「来源原文 → 补丁后副本」的实算加删行数之和。
    #
    # 为什么要机械强制：这个字段此前没有任何消费者（grep 全部 .ps1/.mjs/.py 零命中），44 个
    # runtime-import 登记项里三种口径并存——30 项记加删之和、9 项只记新增、5 项两者都不是
    # （evidence/20261001-skill-body-dead-command-cleanup.md §4b 末条）。没有消费者的数字必然漂，
    # 而它一旦被引进取决（本次就是）就会给出错答案。
    # 口径（owner 2026-10-01 第 ④ 项统一，写进 LOCAL-PATCHES.json 的 note）：
    #   git diff --no-index --numstat 的 added + deleted，即对来源快照原文的加删之和。
    # 例外：snapshotPath == path 的条目（sliver-core 的 catalog 投影双通道登记）没有可活的原文副本，
    # 活树无法复算，计入 exempt 并在读数里显式打印——「检查不了」必须可见，不得静默当成通过。
    # fail-closed：原文/副本缺失、字段缺失、git 退出 128 一律失败。sliver-core 命名空间（原文只有哈希）不覆盖。

    $repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
    $registryPath = Join-Path $repoRoot 'provenance/LOCAL-PATCHES.json'
    if (-not (Test-Path -LiteralPath $registryPath -PathType Leaf)) {
        # 登记文件缺失＝对账前提不成立，不是「没有要对的账」。本包一定有这份登记
        # （provenance/LOCAL-PATCHES.json 是受跟踪文件），缺了只可能是被删或路径变了，必须判红。
        return [pscustomobject]@{
            ok = $false
            checked = 0
            exempt = @()
            errors = @('对账前提不成立：provenance/LOCAL-PATCHES.json 登记文件缺失')
        }
    }
    $doc = Get-Content -Raw -Encoding UTF8 -LiteralPath $registryPath | ConvertFrom-Json
    if ($doc.schema -ne 'feisheng-local-patches/v1') { throw "不支持的 LOCAL-PATCHES schema: $($doc.schema)" }

    $errors = @()
    $exempt = @()
    $checked = 0
    # 扫到的 runtime-import 文件条目总数：为 0 不是「没有账要对」而是「对账前提塌了」
    # （命名空间改名、登记被清空、patches 结构变了都会静默归零），必须与 exempt 一样显式判红。
    $scanned = 0
    # 扫到的 runtime-import 文件条目总数：为 0 时本步什么都没对，属「对账前提不成立」而非通过。
    # 为什么必须单列这一条：缺 linesChanged／缺 snapshotPath／原文或副本缺失 的条目都走 continue，
    # 不进 $checked，所以只看 $checked 的调用方会把「全批条目字段名变了」读成「没有要对的账」。
    $scanned = 0
    # 同一 path 在 runtime-import 命名空间下只允许一条活登记（OWNER-LEDGER 的 local-patch-registry 规则）。
    # 这条必须机械查：下游消费方 Get-RuntimeCopyPatches 用哈希表按 path 收条目，重复登记不是「多记一遍」
    # 而是**后一条静默覆盖前一条**——2026-10-01 实测两处重复让结构不变量步的条数比登记条数少 2，
    # 两个门禁步各报各的分母（74 与 75）却全绿，没有任何一处把「少算了两条」当故障。
    $pathOwners = @{}
    $duplicates = @()

    foreach ($patch in @($doc.patches)) {
        if ([string]$patch.snapshot -ne 'runtime-import') { continue }
        foreach ($file in @($patch.files)) {
            $scanned++
            $relative = ([string]$file.path).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
            if ($pathOwners.ContainsKey($relative)) {
                $duplicates += ($relative + ' [' + [string]$pathOwners[$relative] + ' + ' + [string]$patch.id + ']')
            } else {
                $pathOwners[$relative] = [string]$patch.id
            }
            $snapshotRel = ''
            if ($file.PSObject.Properties.Name -contains 'snapshotPath') {
                $snapshotRel = ([string]$file.snapshotPath).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
            }
            if (-not ($file.PSObject.Properties.Name -contains 'linesChanged')) {
                $errors += ($relative + ' (行数对账无法执行：登记项缺 linesChanged 字段)')
                continue
            }
            $registered = [int]$file.linesChanged
            if ([string]::IsNullOrWhiteSpace($snapshotRel)) {
                $errors += ($relative + ' (行数对账无法执行：来源原文 snapshotPath 未登记)')
                continue
            }
            if ($snapshotRel -eq $relative) {
                $exempt += ($relative + '[' + [string]$patch.id + ']')
                continue
            }

            $originalPath = Join-Path $repoRoot ($snapshotRel.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
            $patchedPath = Join-Path $repoRoot ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
            if (-not (Test-Path -LiteralPath $originalPath -PathType Leaf)) {
                $errors += ($relative + ' (行数对账无法执行：来源原文缺失 ' + $snapshotRel + ')')
                continue
            }
            if (-not (Test-Path -LiteralPath $patchedPath -PathType Leaf)) {
                $errors += ($relative + ' (行数对账无法执行：补丁副本缺失)')
                continue
            }

            # git diff --no-index 有差异时退出码为 1，这是正常结果而非失败；显式关掉 Stop 偏好，
            # 否则 5.1 会把 stderr 的提示包成 ErrorRecord 抛在这里（与 verify.ps1 的 Invoke-Node 同理）。
            $prevPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                $global:LASTEXITCODE = 0
                $numstat = & git -c core.autocrlf=false -c core.quotepath=false diff --no-index --numstat -- $originalPath $patchedPath 2>$null
                $gitCode = $LASTEXITCODE
            } finally {
                $ErrorActionPreference = $prevPreference
            }
            if ($gitCode -eq 128) {
                $errors += ($relative + ' (行数对账失败：git diff --no-index 退出 128)')
                continue
            }
            $statLine = @($numstat | Where-Object { $_ -match '^\d+\t\d+\t' } | Select-Object -First 1)
            if (@($statLine).Count -eq 0) {
                if ($gitCode -eq 0) { $added = 0; $deleted = 0 }
                else {
                    $errors += ($relative + ' (行数对账失败：退出 ' + $gitCode + ' 但 numstat 无数字行——二进制或口径变了)')
                    continue
                }
            } else {
                $statParts = @($statLine[0] -split "`t")
                $added = [int]$statParts[0]
                $deleted = [int]$statParts[1]
            }

            $checked++
            $actual = $added + $deleted
            if ($actual -ne $registered) {
                $errors += ($relative + ' (linesChanged 登记=' + $registered + ' 实算=加' + $added + '+删' + $deleted + '=' + $actual + '，口径=对来源快照的加删之和)')
            }
        }
    }

    # 重复登记必须判红：下游 Get-RuntimeCopyPatches 用哈希表按 path 收条目，重复＝后一条静默覆盖前一条。
    # （此前 $duplicates 只收集不上报，本步对重复是盲的——门禁自己的消费者缺失，与被它抓的 bug 同类。）
    if (@($duplicates).Count -gt 0) {
        $errors += ('runtime-import 命名空间存在重复登记（同一 path 多条活条目，后者静默覆盖前者）: ' + ($duplicates -join ', '))
    }
    if ($scanned -eq 0) {
        $errors += '对账前提不成立：runtime-import 命名空间扫到 0 个文件条目（本包有 38 个导入技能，归零只可能是命名空间改名、patches 结构变了或登记被清空）'
    }

    return [pscustomobject]@{
        ok = ($errors.Count -eq 0)
        checked = $checked
        scanned = $scanned
        exempt = @($exempt)
        errors = @($errors)
    }
}
