[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Validate', 'Invoke')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [ValidateSet('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop')]
    [string]$Event
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-ContainedPath {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )

    $rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd([char[]]@('\', '/'))
    $candidate = [System.IO.Path]::GetFullPath((Join-Path -Path $rootFull -ChildPath $RelativePath))
    if (-not $candidate.StartsWith($rootFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "路径越过仓库根目录: $RelativePath"
    }
    return $candidate
}

function Assert-Contract {
    param([Parameter(Mandatory = $true)]$Contract)

    if ($Contract.schema -ne 'feisheng-vibe-hook-adapter/v1') { throw '不支持的 Hook adapter schema。' }
    if ($Contract.owner -ne 'runtime-projection') { throw 'Hook adapter owner 必须是 runtime-projection。' }
    if ($Contract.status -ne 'defined-disabled-pending-gates') { throw '未满足运行时门禁时，Hook adapter 必须保持禁用。' }
    if (-not $Contract.runner.singleRunner -or $Contract.runner.path -ne 'scripts/invoke-vibe-hook-adapter.ps1') { throw 'Hook adapter 必须只有本仓库的单一 runner。' }
    if ($Contract.runner.sourceRunnerExecution -or $Contract.source.executionAllowed) { throw '未通过门禁时不得执行来源 Hook。' }
    if (@($Contract.writeWhitelist).Count -ne 0) { throw '禁用态 Hook adapter 不得拥有写入白名单。' }
    if (-not $Contract.idempotency.required -or [string]::IsNullOrWhiteSpace([string]$Contract.idempotency.key)) { throw 'Hook adapter 必须声明幂等键。' }

    $allowedEvents = @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop')
    foreach ($eventName in $allowedEvents) {
        $eventContract = $Contract.events.$eventName
        if ($null -eq $eventContract -or [int]$eventContract.timeoutSeconds -lt 1) { throw "缺少或无效的事件契约: $eventName" }
        if ([string]::IsNullOrWhiteSpace([string]$eventContract.handler)) { throw "缺少事件处理标识: $eventName" }
    }
}

$contractPath = Get-ContainedPath -Root $RepositoryRoot -RelativePath 'adapters/vibe-hooks/contract.json'
if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) { throw "缺少 Hook adapter contract: $contractPath" }

$contract = Get-Content -Raw -Encoding UTF8 -LiteralPath $contractPath | ConvertFrom-Json
Assert-Contract -Contract $contract

if ($Mode -eq 'Validate') {
    [Console]::WriteLine('PASS: Vibe Hook adapter contract is valid and remains disabled.')
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Event)) { throw 'Invoke 模式必须给出 Event。' }
[Console]::Error.WriteLine("BLOCKED: Vibe Hook adapter is disabled pending gates; event '$Event' was not executed.")
exit 3
