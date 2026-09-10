[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$runner = Join-Path -Path $RepositoryRoot -ChildPath 'scripts/invoke-vibe-hook-adapter.ps1'
& $runner -Mode Validate -RepositoryRoot $RepositoryRoot
if ($LASTEXITCODE -ne 0) { throw "Validate 失败，退出码: $LASTEXITCODE" }

& $runner -Mode Invoke -RepositoryRoot $RepositoryRoot -Event Stop
if ($LASTEXITCODE -ne 3) { throw "禁用态 Invoke 必须拒绝执行并返回 3，实际为: $LASTEXITCODE" }

[Console]::WriteLine('PASS: disabled Vibe Hook adapter validates and refuses source execution.')
