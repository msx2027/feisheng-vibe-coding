[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,

    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),

    [Parameter(Mandatory = $false)]
    [switch]$Uninstall,

    [Parameter(Mandatory = $false)]
    [switch]$Force,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Vibe Hook 适配器安装/卸载（目标项目侧）。
#
# 装什么：
#   <target>/.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1  自包含 runner 副本（记录 SHA）
#   <target>/.feisheng/vibe-hooks/contract.json                 契约副本（记录 SHA）
#   <target>/.claude/settings.json                              合并注册 SessionStart / UserPromptSubmit 两个 Hook
#
# 不碰什么：
#   - 目标项目其它任何文件；.claude/feedback/（经验数据）在卸载时保留
#   - 绝不把本仓库目录作为安装目标（防止把钩子装回统一包自己）
#
# 回滚：
#   -Uninstall：移除 settings.json 里本适配器的注册项 + 删除安装副本与状态目录；经验索引（用户数据）保留
#   -DryRun：只输出将执行的动作

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
        throw "路径越过根目录: $RelativePath"
    }
    return $candidate
}

$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
$targetFull = [System.IO.Path]::GetFullPath($TargetRoot)
if (-not (Test-Path -LiteralPath $targetFull -PathType Container)) { throw "TargetRoot 不存在: $targetFull" }
if (-not (Test-Path -LiteralPath (Join-Path $targetFull '.git'))) { throw "TargetRoot 不是 Git 仓库根（ refusing 安装到非项目目录）: $targetFull" }

# 防呆：不把钩子装进统一包自己
if ($targetFull.TrimEnd('\', '/') -eq $repoRoot.TrimEnd('\', '/')) {
    throw '拒绝把 Vibe Hook 适配器安装到 feisheng-vibe-coding 仓库自身。'
}

$sourceRunner = Get-ContainedPath -Root $repoRoot -RelativePath 'scripts/invoke-vibe-hook-adapter.ps1'
$sourceContract = Get-ContainedPath -Root $repoRoot -RelativePath 'adapters/vibe-hooks/contract.json'
$contract = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceContract | ConvertFrom-Json
$enabledStatuses = @('enabled-experience-sedimentation-v1')
if ($enabledStatuses -notcontains [string]$contract.status) { throw "契约状态 '$($contract.status)' 不是启用态，拒绝安装。" }

# 注册事件面从契约派生（单一事实源），不复制清单：契约的 enabled 集合与 runner 支持面漂移时
# 显式失败，而不是把宿主用不到/不允许的钩子静默装上（runner 对未实现事件会 exit 3）。
$contractEnabledEvents = @(@($contract.events.PSObject.Properties) |
    Where-Object { [bool]$_.Value.enabled } | ForEach-Object { [string]$_.Name })
$runnerSupportedEvents = @('SessionStart', 'UserPromptSubmit')
# 比较键拆中间变量：-join 与 -ne 同表达式串联会被运算符优先级错误分组
$contractEnabledKey = @($contractEnabledEvents | Sort-Object) -join ','
$runnerSupportedKey = @($runnerSupportedEvents | Sort-Object) -join ','
if ($contractEnabledKey -ne $runnerSupportedKey) {
    throw ("契约启用事件集（" + ($contractEnabledEvents -join ', ') + "）与 runner 支持面（" + ($runnerSupportedEvents -join ', ') + "）不一致，拒绝安装。")
}


function Test-HasProperty {
    param($Object, [Parameter(Mandatory = $true)][string]$Name)
    if ($null -eq $Object) { return $false }
    return ($null -ne $Object.PSObject.Properties[$Name])
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

$installDir = Get-ContainedPath -Root $targetFull -RelativePath '.feisheng/vibe-hooks'
$stateDir = Get-ContainedPath -Root $targetFull -RelativePath '.feisheng/vibe-hook-state'
$targetRunner = Join-Path $installDir 'invoke-vibe-hook-adapter.ps1'
$targetContract = Join-Path $installDir 'contract.json'
$manifestPath = Join-Path $installDir 'install-manifest.json'
$settingsPath = Join-Path $targetFull '.claude/settings.json'

$hookCommandBase = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $targetRunner + '" -Mode Invoke -RepositoryRoot "' + $installDir + '" -TargetRoot "' + $targetFull + '" -Event {EVENT}'

if ($Uninstall) {
    if (-not (Test-Path -LiteralPath $installDir -PathType Container) -and -not (Test-Path -LiteralPath $settingsPath)) {
        [pscustomobject]@{ status = 'SKIPPED'; reason = 'not-installed'; target = $targetFull } | ConvertTo-Json -Compress
        exit 0
    }
    if ($DryRun) { [pscustomobject]@{ status = 'DRY-RUN-UNINSTALL'; target = $targetFull } | ConvertTo-Json -Compress; exit 0 }
    # 1) settings.json 移除本适配器注册项（即使安装目录已被手删也要清注册，防残留死钩子）
    if (Test-Path -LiteralPath $settingsPath) {
        $settings = Get-Content -Raw -Encoding UTF8 -LiteralPath $settingsPath | ConvertFrom-Json
        if (Test-HasProperty -Object $settings -Name 'hooks') {
            foreach ($eventName in @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop')) {
                if (-not (Test-HasProperty -Object $settings.hooks -Name $eventName)) { continue }
                $kept = @()
                foreach ($group in @($settings.hooks.$eventName)) {
                    $matched = $false
                    foreach ($h in @($group.hooks)) {
                        if ([string]$h.command -like ('*' + $targetRunner + '*')) { $matched = $true }
                    }
                    if (-not $matched) { $kept += $group }
                }
                if (@($kept).Count -gt 0) { $settings.hooks.$eventName = $kept }
                else { $settings.hooks.PSObject.Properties.Remove($eventName) }
            }
            $utf8 = New-Object System.Text.UTF8Encoding($false)
            $settingsTmp = $settingsPath + '.tmp'
            [System.IO.File]::WriteAllText($settingsTmp, ($settings | ConvertTo-Json -Depth 20), $utf8)
            Move-Item -LiteralPath $settingsTmp -Destination $settingsPath -Force
        }
    }
    # 2) 删除安装副本与状态目录（保留 .claude/feedback/ 经验数据）；副本可能已被手删，对称守卫
    if (Test-Path -LiteralPath $installDir) { Remove-Item -LiteralPath $installDir -Recurse -Force }
    if (Test-Path -LiteralPath $stateDir) { Remove-Item -LiteralPath $stateDir -Recurse -Force }
    [pscustomobject]@{ status = 'UNINSTALLED'; target = $targetFull; preserved = '.claude/feedback/' } | ConvertTo-Json -Compress
    exit 0
}

# 注册项去重：settings.json 里已有本 runner 的命令则视为已安装
$alreadyRegistered = $false
if (Test-Path -LiteralPath $settingsPath) {
    $raw = Get-Content -Raw -Encoding UTF8 -LiteralPath $settingsPath
    if ($raw -like ('*' + $targetRunner + '*')) { $alreadyRegistered = $true }
}
if ($alreadyRegistered -and -not $Force) {
    throw "目标项目已注册本适配器（未加 -Force）: $settingsPath"
}
if ((Test-Path -LiteralPath $installDir -PathType Container) -and -not $Force) {
    throw "安装目录已存在（未加 -Force）: $installDir"
}

$runnerSha = Get-Sha256 -Path $sourceRunner
$contractSha = Get-Sha256 -Path $sourceContract

if ($DryRun) {
    [pscustomobject]@{
        status = 'DRY-RUN'; target = $targetFull
        wouldInstall = @('.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1', '.feisheng/vibe-hooks/contract.json', '.feisheng/vibe-hooks/install-manifest.json')
        wouldRegister = $contractEnabledEvents
        runnerSha256 = $runnerSha; contractSha256 = $contractSha
    } | ConvertTo-Json -Compress
    exit 0
}

# 1) 拷贝 runner + 契约
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -LiteralPath $sourceRunner -Destination $targetRunner -Force
Copy-Item -LiteralPath $sourceContract -Destination $targetContract -Force
if ((Get-Sha256 -Path $targetRunner) -ne $runnerSha) { throw 'runner 副本 SHA 不一致' }
if ((Get-Sha256 -Path $targetContract) -ne $contractSha) { throw 'contract 副本 SHA 不一致' }

# 2) 注册 Claude Code hooks（合并写入，不动其它键）
$settings = $null
if (Test-Path -LiteralPath $settingsPath) {
    $settings = Get-Content -Raw -Encoding UTF8 -LiteralPath $settingsPath | ConvertFrom-Json
} else {
    $settings = [pscustomobject]@{}
}
if (-not (Test-HasProperty -Object $settings -Name 'hooks')) {
    $settings | Add-Member -MemberType NoteProperty -Name 'hooks' -Value ([pscustomobject]@{})
}
# matcher 是宿主注册语义（按事件名映射，与契约解耦），timeout 取契约 timeoutSeconds。
$matcherByEvent = @{ SessionStart = 'startup|resume'; UserPromptSubmit = '' }
foreach ($eventName in $contractEnabledEvents) {
    $timeout = [int]$contract.events.$eventName.timeoutSeconds
    if ($timeout -le 0) { $timeout = 10 }
    $matcher = $matcherByEvent[$eventName]
    if ($null -eq $matcher) { $matcher = '' }
    $command = $hookCommandBase.Replace('{EVENT}', $eventName)
    $entry = [pscustomobject]@{ type = 'command'; command = $command; timeout = $timeout }
    $group = [pscustomobject]@{ hooks = @($entry) }
    if (-not [string]::IsNullOrWhiteSpace($matcher)) { $group | Add-Member -MemberType NoteProperty -Name 'matcher' -Value $matcher }
    if (Test-HasProperty -Object $settings.hooks -Name $eventName) {
        $existing = @($settings.hooks.$eventName) | Where-Object {
            -not (@($_.hooks) | Where-Object { [string]$_.command -like ('*' + $targetRunner + '*') })
        }
        $settings.hooks.$eventName = @($existing + @($group))
    } else {
        $settings.hooks | Add-Member -MemberType NoteProperty -Name $eventName -Value @($group)
    }
}
$settingsParent = Split-Path -Parent $settingsPath
if (-not (Test-Path -LiteralPath $settingsParent)) { New-Item -ItemType Directory -Force -Path $settingsParent | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$settingsJson = $settings | ConvertTo-Json -Depth 20
$settingsTmp = $settingsPath + '.tmp'
[System.IO.File]::WriteAllText($settingsTmp, $settingsJson, $utf8)
Move-Item -LiteralPath $settingsTmp -Destination $settingsPath -Force

# 3) 安装清单（回滚与审计依据）
$manifest = [ordered]@{
    schema = 'feisheng-vibe-hook-install/v1'
    installedAt = (Get-Date).ToUniversalTime().ToString('o')
    targetRoot = $targetFull
    events = $contractEnabledEvents
    files = @(
        [ordered]@{ path = '.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1'; sha256 = $runnerSha }
        [ordered]@{ path = '.feisheng/vibe-hooks/contract.json'; sha256 = $contractSha }
    )
    writeWhitelist = @($contract.writeWhitelist)
    rollback = 'scripts/install-vibe-hooks.ps1 -TargetRoot <target> -Uninstall'
}
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), $utf8)

[pscustomobject]@{
    status = 'INSTALLED'; target = $targetFull
    events = $contractEnabledEvents
    runnerSha256 = $runnerSha; contractSha256 = $contractSha
    settingsPath = $settingsPath
    feedbackIndex = '.claude/feedback/FEEDBACK-INDEX.md（经验数据，卸载时保留）'
    rollback = $manifest.rollback
} | ConvertTo-Json -Compress
