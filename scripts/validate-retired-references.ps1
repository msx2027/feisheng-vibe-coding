[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    # PS 5.1 的高级脚本（CmdletBinding）在 param 默认值里拿不到任何脚本路径表达式：
    # $PSScriptRoot 为空、$MyInvocation.MyCommand.Path 为 null。默认留空，进脚本体后再解析。
    # 默认解析值 = 本脚本目录（scripts/）的上一级 = 仓库根。
    [string]$RepositoryRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 退役引用扫描门禁。
#
# 目的：被裁决为 retired-* 的能力不得再被 runtime 一等内容以「/id 命令形态」引用，
# 否则宿主模型会被引导调用包内不存在的命令。28c8089 清理批的残留扫描把与英文单词
# 同形的 id（shape/implement/teach/triage）整类剔除在扫描外，/shape 的命令形态恰恰
# 从这个盲区漏网。本门禁改用不依赖人工同形词判断的口径：
#   - 全量 retired id，只认 /<id> 命令形态（裸英文词不在扫描面，天然避开同形冲突）
#   - sources/<快照>/ 开头的路径引用整段屏蔽后再扫——那是对内容真源的合法指认，不是运行时引用
#
# 扫描范围：skills/** 与 governance/sliver-core/** 的文本文件（与 28c8089 的清点口径一致）。
#
# 输出：JSON（status = PASS/FAIL）供 scripts/verify.ps1 解析。

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}
$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw "RepositoryRoot 不存在: $repoRoot"
}

$catalogPath = Join-Path $repoRoot 'provenance/CANONICAL-CATALOG.json'
if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) { throw "缺少文件: $catalogPath" }
$catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json
$retiredIds = @(@($catalog.records) |
    Where-Object { ([string]$_.status).StartsWith('retired') } |
    ForEach-Object { [string]$_.id })
if ($retiredIds.Count -eq 0) { throw 'catalog 中没有 retired 记录（扫描口径异常，请人工复核）' }

$scanRoots = @('skills', 'governance/sliver-core')
# 文本类型尽量收全：.template/.sh/.yaml/.yml/.py/.mjs/.cjs/.csv 等 runtime 单位可能携带的
# 引用面都在内；无扩展名文件（LICENSE/VERSION 等）与二进制不入扫（口径：文本模板资产全扫）。
$textExtensions = @('.md', '.ps1', '.json', '.txt', '.html', '.css', '.js', '.template', '.sh', '.yaml', '.yml', '.py', '.mjs', '.cjs', '.csv')
$snapshotPathRegex = [regex]::new('sources/[A-Za-z0-9_\-./]+', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$patternCache = @{}
foreach ($id in $retiredIds) {
    # IgnoreCase：宿主对命令大小写不敏感的容忍度高于门禁漏报的代价；宁误报不漏报
    $patternCache[$id] = [regex]::new('/' + [regex]::Escape($id) + '\b', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

$errors = @()
$filesScanned = 0
foreach ($scanRoot in $scanRoots) {
    $rootFull = Join-Path $repoRoot ($scanRoot.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
    if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) {
        $errors += ($scanRoot + ' (扫描根不存在)')
        continue
    }
    $files = @(Get-ChildItem -LiteralPath $rootFull -Recurse -File |
        Where-Object { $textExtensions -contains $_.Extension.ToLowerInvariant() })
    foreach ($file in $files) {
        $relative = [IO.Path]::GetFullPath($file.FullName).Substring($repoRoot.Length).TrimStart('\', '/').Replace('\', '/')
        $text = $null
        try { $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $file.FullName } catch {
            $errors += ($relative + ' (无法以 UTF-8 读取)')
            continue
        }
        if ([string]::IsNullOrEmpty($text)) { continue }
        $filesScanned++
        # 屏蔽 sources/<快照路径> 引用：等长掩码替换（保留换行），命中行号与原文一致
        $chars = $text.ToCharArray()
        foreach ($m in $snapshotPathRegex.Matches($text)) {
            for ($i = $m.Index; $i -lt ($m.Index + $m.Length); $i++) {
                if ($chars[$i] -ne "`r" -and $chars[$i] -ne "`n") { $chars[$i] = ' ' }
            }
        }
        $masked = -join $chars
        foreach ($id in $retiredIds) {
            foreach ($m in $patternCache[$id].Matches($masked)) {
                $line = 1
                for ($i = 0; $i -lt $m.Index; $i++) { if ($masked[$i] -eq "`n") { $line++ } }
                $errors += ($relative + ':' + $line + ' (退役 id /' + $id + ' 的命令形态引用)')
            }
        }
    }
}

$status = 'FAIL'
if ($errors.Count -eq 0) { $status = 'PASS' }
[pscustomobject]@{
    status = $status
    retiredCount = $retiredIds.Count
    filesScanned = $filesScanned
    errors = @($errors)
} | ConvertTo-Json -Depth 4
if ($errors.Count -gt 0) { exit 1 }
exit 0
