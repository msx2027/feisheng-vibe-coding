# 宿主中性（shared）投影 writer：装进宿主共享技能根的形态（决策 #4，见 docs/HANDOFF-NEXT.md 9.1）。
# 与 Codex / Claude writer 共用 guard 模块的 Invoke-RuntimeProjection（唯一主体实现）。
# 差异：不合入任何宿主 overlay —— references/runtime-adapter.md 保留核心中性版，
# 不带 agents/openai.yaml、references/studio-codex.md、references/execution-liveness-host.md、
# assets/project-claude/CLAUDE.md（这些是宿主专属文件，共享根装不下两套）。
# fail-closed：guard 主体会在计划里断言不含 host-facts 文件。

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

try {
    $result = Invoke-RuntimeProjection `
        -Mode $Mode `
        -RepositoryRoot $RepositoryRoot `
        -OutputRoot $OutputRoot `
        -ManifestName 'shared-projection-manifest.json' `
        -ManifestSchema 'feisheng-shared-runtime-projection/v1' `
        -ResultSchema 'feisheng-shared-runtime-projection-result/v1' `
        -HostLabel 'shared-neutral' `
        -OverlayTargetName '' `
        -HostAdapter ([ordered]@{
            runtimeAdapter = 'references/runtime-adapter.md'
            runtimeAdapterVariant = 'core-neutral (no host overlay)'
            overlayContract = 'none; host-neutral shared projection for the shared skill root'
            freshSessionSmoke = 'UNVERIFIED'
        }) `
        -ResultExtras ([ordered]@{ freshSessionSmoke = 'UNVERIFIED' })
    $result | ConvertTo-Json -Depth 12
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
