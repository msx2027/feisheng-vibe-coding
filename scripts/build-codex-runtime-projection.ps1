# Codex 投影 writer：与 Claude / 宿主中性（shared）writer 共用 guard 模块的
# Invoke-RuntimeProjection（唯一主体实现），本脚本只声明 Codex 的差异参数。
# Codex 宿主 overlay 落点由 Sliver 自己的 packaging/runtime-manifest.json（targets.codex.overlay_files）定义。

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
        -ManifestName 'codex-projection-manifest.json' `
        -ManifestSchema 'feisheng-codex-runtime-projection/v1' `
        -ResultSchema 'feisheng-codex-runtime-projection-result/v1' `
        -HostLabel 'codex' `
        -OverlayTargetName 'codex'
    $result | ConvertTo-Json -Depth 12
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
