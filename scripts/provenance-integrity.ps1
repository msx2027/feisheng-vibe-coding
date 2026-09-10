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
        $sourceDrift = @()

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
