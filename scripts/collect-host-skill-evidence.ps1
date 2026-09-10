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
$seen = 0
foreach ($match in [regex]::Matches($text, '(?m)^- ([^\r\n]+?): .*?\(file: (r\d+)/([^)]+)\)')) {
    $seen++
    $path = $match.Groups[3].Value
    $dir = Get-SkillDirName -Path $path
    $key = $dir.ToLowerInvariant()
    if (-not $modelVisible.ContainsKey($key)) { $modelVisible[$key] = @() }
    $modelVisible[$key] += [pscustomobject]@{
        entryName = $match.Groups[1].Value
        root = $match.Groups[2].Value
        rootPath = $roots[$match.Groups[2].Value]
        pathInRoot = $path
    }
}

# 2) 宿主安装情况
$claudeDirs = Get-DirectoryNames -Root $ClaudeSkillsRoot
$codexDirs = Get-DirectoryNames -Root $CodexSkillsRoot

# 统一包内的嵌套技能（skills/<group>/<id>）：顶层目录查不到，用 bundle 相对路径判定
$bundleRoot = Join-Path $ClaudeSkillsRoot 'feisheng-vibe-coding'
$bundleIsInstalled = Test-Path -LiteralPath $bundleRoot -PathType Container

function Test-InstalledInSharedBundle {
    param(
        [Parameter(Mandatory = $true)][string]$BundleRoot,
        [Parameter(Mandatory = $true)][bool]$BundleInstalled,
        [Parameter(Mandatory = $true)][string]$DirName
    )
    if (-not $BundleInstalled) { return $false }
    foreach ($group in @('checker', 'product', 'ui', 'engineering')) {
        $candidate = Join-Path $BundleRoot ('skills/' + $group + '/' + $DirName)
        if (Test-Path -LiteralPath $candidate -PathType Container) { return $true }
    }
    return $false
}

# 3) 逐记录判定
$records = @()
$summary = @{ modelVisible = 0; installedUserInvokedOnly = 0; notInstalled = 0; unknown = 0 }
foreach ($record in @($catalog.records | Sort-Object id)) {
    $dir = Get-SkillDirName -Path ([string]$record.path) -Id ([string]$record.id)
    $key = $dir.ToLowerInvariant()
    $visible = @()
    if ($modelVisible.ContainsKey($key)) { $visible = @($modelVisible[$key]) }
    $inClaude = $claudeDirs.ContainsKey($dir)
    $inCodex = $codexDirs.ContainsKey($dir)
    $modelInvocable = ([string]$record.invocation -ne 'user-invoked')

    $evidence = 'unknown'
    $inBundle = Test-InstalledInSharedBundle -BundleRoot $bundleRoot -BundleInstalled $bundleIsInstalled -DirName $dir
    if ($visible.Count -gt 0) {
        $evidence = 'model-visible'
        $summary.modelVisible++
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
        modelVisibleInCodex = ($visible.Count -gt 0)
        visibleAs = @($visible | ForEach-Object { [ordered]@{ entryName = $_.entryName; root = $_.root; rootPath = $_.rootPath; path = $_.pathInRoot } })
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
        parsedModelVisibleEntries = $seen
    }
    records = $records
}
$outPath = Join-Path $repoRoot 'provenance/HOST-DISCOVERY-EVIDENCE.json'
$document | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 -LiteralPath $outPath
Write-Output ("Wrote " + $outPath)
Write-Output ("model-visible=" + $summary.modelVisible + " installed-user-invoked-only=" + $summary.installedUserInvokedOnly + " not-installed=" + $summary.notInstalled + " other=" + $summary.unknown)
