[CmdletBinding()]
param(
    # 宿主技能根（~/.claude/skills 是共享根的 junction；列目录与取 LinkType 均可穿透）
    [Parameter(Mandatory = $false)]
    [string]$SkillsRoot = (Join-Path $env:USERPROFILE '.claude/skills'),

    # 可选：把快照写到该 JSON 文件（如 _smoke/host-legacy-links-<date>.json）；默认只输出到 stdout
    [Parameter(Mandatory = $false)]
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# 只读清点宿主技能根的顶层条目形态（阶段 5「旧入口退役」口径的输入，不删除任何东西）。
#
# 分类：
#   unified-bundle   我们的统一包目录（feisheng-vibe-coding）
#   reparse-link     junction/symlink：target 指向三个源仓库 → source-repo-link；其它 → other-link
#   directory        普通目录（不是链接）
#
# 退役口径待 owner 决策；本工具只提供清单与回滚所需信息（链接删除即可逆，源仓库不动）。

$rootFull = [System.IO.Path]::GetFullPath($SkillsRoot)
if (-not (Test-Path -LiteralPath $rootFull -PathType Container)) { throw "SkillsRoot 不存在: $rootFull" }

$sourceRepoMarkers = @('sliver-vibe-coding', 'vibe-coding-skills', 'mattpocock-skills')

$entries = @()
foreach ($item in @(Get-ChildItem -LiteralPath $rootFull -Force)) {
    $kind = 'directory'
    $target = $null
    if ($item.LinkType) {
        $target = @($item.Target)[0]
        $kind = 'other-link'
        if (-not [string]::IsNullOrWhiteSpace([string]$target)) {
            foreach ($marker in $sourceRepoMarkers) {
                if ([string]$target -like ('*' + $marker + '*')) { $kind = 'source-repo-link'; break }
            }
        }
    }
    if ($item.PSIsContainer -and $item.Name -eq 'feisheng-vibe-coding') { $kind = 'unified-bundle' }
    $entries += [ordered]@{
        name = $item.Name
        kind = $kind
        linkType = $item.LinkType
        target = $target
    }
}

$byKind = @{}
foreach ($e in $entries) { $byKind[[string]$e.kind] = 1 + $(if ($byKind.ContainsKey([string]$e.kind)) { $byKind[[string]$e.kind] } else { 0 }) }

$document = [ordered]@{
    schema = 'feisheng-host-legacy-links-audit/v1'
    capturedAt = (Get-Date).ToUniversalTime().ToString('o')
    root = $rootFull
    counts = $byKind
    note = 'read-only audit; source-repo-link entries are the phase-5 retirement candidates (owner decision pending); deleting a link is reversible, source repos stay untouched'
    entries = $entries
}
$json = $document | ConvertTo-Json -Depth 6
if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($OutputPath), $json, $utf8NoBom)
    Write-Output ('Wrote ' + [System.IO.Path]::GetFullPath($OutputPath))
}
Write-Output ($json)
