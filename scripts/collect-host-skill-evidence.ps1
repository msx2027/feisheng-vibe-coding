[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(Mandatory = $false)]
    [string]$ClaudeSkillsRoot = (Join-Path $env:USERPROFILE '.claude/skills'),

    [Parameter(Mandatory = $false)]
    [string]$CodexSkillsRoot = (Join-Path $env:USERPROFILE '.codex/skills')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 逐技能宿主证据采集（真实证据，不是断言）。
#
# 证据源：
#   1) `codex debug prompt-input` —— 输出模型可见输入。其 "### Available skills" 段落列出**模型可调用**的技能
#      （name / description / file: rN/path），并给出技能根表。一次调用即可覆盖全部技能。
#   2) 宿主技能目录（~/.claude/skills = 共享根；~/.codex/skills）——判定"是否已安装"。
#
# 重要区分（实测得出）：禁用模型调用的技能（frontmatter `disable-model-invocation: true`）**不会**出现在
# Available skills 清单里 —— 这是设计使然，不是"未被发现"。因此证据分四类，不能一律按清单命中判定。
#
# 输出：provenance/HOST-DISCOVERY-EVIDENCE.json（机器可读）+ 控制台摘要。

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
$catalogPath = Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json'
if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) { throw "缺少 canonical catalog: $catalogPath" }
$catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json

# 宿主目录名与 catalog 路径目录名不一致的例外（如实记录，不隐式猜测）
# sliver 控制面在 catalog 里的路径是 vendored 位置 governance/sliver-core/SKILL.md，
# 而宿主安装目录名是 sliver-vibe-coding（源自 Sliver manifest 的 install_hint）。
$hostDirOverrides = @{ 'sliver-vibe-coding' = 'sliver-vibe-coding' }

function Get-SkillDirName {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $false)][string]$Id
    )
    if (-not [string]::IsNullOrWhiteSpace($Id) -and $hostDirOverrides.ContainsKey($Id)) { return $hostDirOverrides[$Id] }
    $normalized = $Path.Replace('\', '/')
    $segments = @($normalized.Split('/') | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($segments.Count -ge 2 -and $segments[$segments.Count - 1] -eq 'SKILL.md') { return $segments[$segments.Count - 2] }
    return $segments[$segments.Count - 1]
}

function Get-DirectoryNames {
    param([Parameter(Mandatory = $true)][string]$Root)
    $set = @{}
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return $set }
    foreach ($item in @(Get-ChildItem -LiteralPath $Root -Directory -Force)) { $set[$item.Name] = $true }
    return $set
}

# 1) 采集 codex 模型可见清单
$codexOutput = & codex debug prompt-input 2>&1 | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($codexOutput)) { throw 'codex debug prompt-input 未返回可用输出。' }
$text = $codexOutput.Replace('\n', "`n").Replace('\r', '')

$roots = @{}
foreach ($match in [regex]::Matches($text, '- `(r\d+)` = `([^`]+)`')) {
    $roots[$match.Groups[1].Value] = $match.Groups[2].Value
}

$modelVisible = @{}
$visibleEntries = @()
$seen = 0
foreach ($match in [regex]::Matches($text, '(?m)^- ([^\r\n]+?): .*?\(file: (r\d+)/([^)]+)\)')) {
    $seen++
    $entry = [pscustomobject]@{
        entryName = $match.Groups[1].Value
        root = $match.Groups[2].Value
        rootPath = $roots[$match.Groups[2].Value]
        path = ($match.Groups[3].Value -replace '\\', '/')
    }
    $visibleEntries += $entry
    # 目录名索引只作参考留存；记录级判定改用 catalog path 精确后缀匹配（防重名伪影，
    # 例如未接入的 vibe `code-review` 曾因目录名相同被记成 Matt 版已安装）
    $dir = Get-SkillDirName -Path $entry.path
    $key = $dir.ToLowerInvariant()
    if (-not $modelVisible.ContainsKey($key)) { $modelVisible[$key] = @() }
    $modelVisible[$key] += $entry
}

# 2) 宿主安装情况
$claudeDirs = Get-DirectoryNames -Root $ClaudeSkillsRoot
$codexDirs = Get-DirectoryNames -Root $CodexSkillsRoot

# 统一包内的嵌套技能（skills/<group>/<id>）：顶层目录查不到，用 bundle 相对路径判定
$bundleRoot = Join-Path $ClaudeSkillsRoot 'feisheng-vibe-coding'
$bundleIsInstalled = Test-Path -LiteralPath $bundleRoot -PathType Container

function Test-InstalledInSharedBundle {
    # 精确判定：统一包按仓库相对路径安装，catalog 记录的 path 就应在 <bundleRoot>/<path> 落位。
    # 不再按目录名到 skills/<group>/ 下扫（那会把重名源技能误判成已装，也看不见控制面嵌套位置）。
    param(
        [Parameter(Mandatory = $true)][string]$BundleRoot,
        [Parameter(Mandatory = $true)][bool]$BundleInstalled,
        [Parameter(Mandatory = $true)][string]$RecordPath
    )
    if (-not $BundleInstalled) { return $false }
    $relative = ([string]$RecordPath).Replace('\', '/')
    $candidate = Join-Path $BundleRoot ($relative.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    return (Test-Path -LiteralPath $candidate -PathType Leaf)
}

function Get-RecordPathSuffixes {
    # 记录 path 的宿主匹配后缀：快照路径（sources/<repo>/...）在宿主可能经「源仓库名/」遗留链接暴露，
    # 额外提供剥掉 sources/<repo>/ 前缀的变体。
    param([Parameter(Mandatory = $true)][string]$RecordPath)
    $normalized = ([string]$RecordPath).Replace('\', '/')
    $suffixes = @($normalized)
    if ($normalized -like 'sources/*') {
        $segments = @($normalized.Split('/') | Where-Object { $_ -ne '' })
        if ($segments.Count -gt 3) {
            $suffixes += (($segments[2..($segments.Count - 1)]) -join '/')
        }
    }
    return $suffixes
}

function Find-VisibleMatches {
    # 用 catalog path 后缀把模型可见条目归属到唯一记录；并标注暴露途径（unified-bundle / legacy）。
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$VisibleEntries
    )
    $suffixes = @(Get-RecordPathSuffixes -RecordPath ([string]$Record.path))
    $attributed = @()
    foreach ($entry in $VisibleEntries) {
        foreach ($suffix in $suffixes) {
            # 注意：不要写 [string](...EndsWith(...)) —— 那会把布尔结果转成 "False" 字符串，
            # 而非空字符串在 PowerShell 里是真值，条件会恒真（本仓库真实踩过：82 条记录全部误匹配）。
            $isSuffixMatch = $entry.path.ToLowerInvariant().EndsWith('/' + $suffix.ToLowerInvariant(), [System.StringComparison]::OrdinalIgnoreCase)
            if ($isSuffixMatch) {
                $startsBundle = $entry.path.ToLowerInvariant().StartsWith('feisheng-vibe-coding/', [System.StringComparison]::OrdinalIgnoreCase)
                $via = if ($startsBundle) { 'unified-bundle' } else { 'legacy' }
                $attributed += [pscustomobject]@{ entry = $entry; via = $via }
                break
            }
        }
    }
    return $attributed
}

# 3) 逐记录判定
$records = @()
$summary = @{ modelVisible = 0; installedUserInvokedOnly = 0; notInstalled = 0; unknown = 0; legacyVisible = 0 }
foreach ($record in @($catalog.records | Sort-Object id)) {
    $dir = Get-SkillDirName -Path ([string]$record.path) -Id ([string]$record.id)
    $matchedVisible = @(Find-VisibleMatches -Record $record -VisibleEntries $visibleEntries)
    $inClaude = $claudeDirs.ContainsKey($dir)
    $inCodex = $codexDirs.ContainsKey($dir)
    $modelInvocable = ([string]$record.invocation -ne 'user-invoked')

    $evidence = 'unknown'
    $inBundle = Test-InstalledInSharedBundle -BundleRoot $bundleRoot -BundleInstalled $bundleIsInstalled -RecordPath ([string]$record.path)
    if ($matchedVisible.Count -gt 0) {
        $evidence = 'model-visible'
        $summary.modelVisible++
        if (@($matchedVisible | Where-Object { $_.via -eq 'legacy' }).Count -gt 0) { $summary.legacyVisible++ }
    } elseif ($inBundle) {
        $evidence = 'installed-in-shared-bundle'
        $summary.installedUserInvokedOnly++
    } elseif ($inClaude -or $inCodex) {
        $evidence = if ($modelInvocable) { 'installed-but-not-model-visible' } else { 'installed-user-invoked-only' }
        if ($evidence -eq 'installed-user-invoked-only') { $summary.installedUserInvokedOnly++ } else { $summary.unknown++ }
    } else {
        $evidence = 'not-installed'
        $summary.notInstalled++
    }

    # 共享根顶层条目形态：我们的包 / 指向源仓库等的 reparse 链接 / 普通目录（遗留暴露的退役口径输入）
    $sharedRootEntryKind = $null
    $sharedRootEntryTarget = $null
    if ($inClaude) {
        if ($dir -eq 'feisheng-vibe-coding') {
            $sharedRootEntryKind = 'unified-bundle'
        } else {
            $item = Get-Item -LiteralPath (Join-Path $ClaudeSkillsRoot $dir) -Force -ErrorAction SilentlyContinue
            if ($null -ne $item -and $item.LinkType) {
                $sharedRootEntryKind = 'reparse-link'
                $sharedRootEntryTarget = @($item.Target)[0]
            } else {
                $sharedRootEntryKind = 'directory'
            }
        }
    }

    $records += [ordered]@{
        id = [string]$record.id
        source = [string]$record.source
        dirName = $dir
        invocation = [string]$record.invocation
        readiness = [string]$record.readiness
        status = [string]$record.status
        installedInSharedRoot = $inClaude
        installedInSharedBundle = $inBundle
        installedInCodexRoot = $inCodex
        modelVisibleInCodex = ($matchedVisible.Count -gt 0)
        visibleVia = @(@($matchedVisible | ForEach-Object { $_.via }) | Select-Object -Unique)
        sharedRootEntryKind = $sharedRootEntryKind
        sharedRootEntryTarget = $sharedRootEntryTarget
        visibleAs = @($matchedVisible | ForEach-Object { [ordered]@{ entryName = $_.entry.entryName; root = $_.entry.root; rootPath = $_.entry.rootPath; path = $_.entry.path; via = $_.via } })
        evidence = $evidence
    }
}

$document = [ordered]@{
    schema = 'feisheng-host-discovery-evidence/v1'
    owner = 'provenance'
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    method = 'codex debug prompt-input (model-visible skill list) + host skill directory presence'
    caveat = 'skills with disable-model-invocation are intentionally absent from the model-visible list; they are evidenced by installation instead'
    codexSkillRoots = $roots
    counts = [ordered]@{
        catalogRecords = @($records).Count
        modelVisible = $summary.modelVisible
        installedUserInvokedOnly = $summary.installedUserInvokedOnly
        notInstalled = $summary.notInstalled
        otherOrUnknown = $summary.unknown
        legacyVisible = $summary.legacyVisible
        parsedModelVisibleEntries = $seen
    }
    records = $records
}
$outPath = Join-Path $repoRoot 'provenance/HOST-DISCOVERY-EVIDENCE.json'
$document | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -LiteralPath $outPath
Write-Output ("Wrote " + $outPath)
Write-Output ("model-visible=" + $summary.modelVisible + " installed-user-invoked-only=" + $summary.installedUserInvokedOnly + " not-installed=" + $summary.notInstalled + " other=" + $summary.unknown)
