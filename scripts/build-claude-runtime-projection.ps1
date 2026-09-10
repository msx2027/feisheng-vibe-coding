# Claude 投影 writer：与 Codex / 宿主中性（shared）writer 共用 guard 模块的
# Invoke-RuntimeProjection（唯一主体实现），本脚本只声明 Claude 的差异参数。
# fresh-session smoke 保持 UNVERIFIED。

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

$guardModule = Join-Path $PSScriptRoot 'runtime-projection-guard.ps1'
if (-not (Test-Path -LiteralPath $guardModule -PathType Leaf)) {
    throw "缺少共享投影门禁模块: $guardModule"
}
. $guardModule

# Claude 宿主 overlay 落点由 Sliver 自己的 packaging/runtime-manifest.json（targets.claude-code.overlay_files）定义，
# 共享实现 Get-HostOverlayFacts / Merge-OverlayFacts 在 guard 模块里。
# 注意 references/runtime-adapter.md 是「覆盖核心包同名槽位」的语义：Claude 专用版本替换掉核心那份
# （核心那份写着「本包不声明启动时宿主适配」，之前被我们错放成 adapters/claude/runtime-adapter.md，
# 导致宿主实际读到的是不声明适配的核心版本）。
# 另：assets/project-claude/CLAUDE.md 是**目标项目模板**（内容为 @AGENTS.md），不属于技能根目录。

try {
    $result = Invoke-RuntimeProjection `
        -Mode $Mode `
        -RepositoryRoot $RepositoryRoot `
        -OutputRoot $OutputRoot `
        -ManifestName 'claude-projection-manifest.json' `
        -ManifestSchema 'feisheng-claude-runtime-projection/v1' `
        -ResultSchema 'feisheng-claude-runtime-projection-result/v1' `
        -HostLabel 'claude' `
        -OverlayTargetName 'claude-code' `
        -HostAdapter ([ordered]@{
            runtimeAdapter = 'references/runtime-adapter.md'
            hostEntryTemplate = 'assets/project-claude/CLAUDE.md'
            overlayContract = 'governance/sliver-core/packaging/runtime-manifest.json targets.claude-code.overlay_files'
            freshSessionSmoke = 'UNVERIFIED'
        }) `
        -ResultExtras ([ordered]@{ freshSessionSmoke = 'UNVERIFIED' })
    $result | ConvertTo-Json -Depth 12
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
