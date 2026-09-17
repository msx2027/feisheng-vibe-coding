[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,

    [Parameter(Mandatory = $false)]
    [string]$RepositoryRoot = '',

    # 宿主适配面：claude(.claude/settings.json) / zcode(.zcode/config.json) / codex(.codex/hooks.json) / all
    [Parameter(Mandatory = $false)]
    [ValidateSet('claude', 'zcode', 'codex', 'all')]
    [string]$HostAdapter = 'claude',

    [Parameter(Mandatory = $false)]
    [switch]$Uninstall,

    [Parameter(Mandatory = $false)]
    [switch]$Force,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Vibe Hook 适配器安装/卸载（目标项目侧，多宿主）。
#
# 装什么：
#   <target>/.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1  自包含 runner 副本（记录 SHA）
#   <target>/.feisheng/vibe-hooks/contract.json                 契约副本（记录 SHA）
#   <target>/.feisheng/vibe-hooks/experience-recorder.mjs       经验台账记录器（记录 SHA；需 Node）
#   <target>/.feisheng/vibe-hooks/install-manifest.json         安装清单（回滚与审计依据）
#   宿主注册（按 -HostAdapter 选择）：
#     claude → <target>/.claude/settings.json  SessionStart + UserPromptSubmit
#     zcode  → <target>/.zcode/config.json     hooks.events 两事件 + enabled:true（合并保留 mcp 等）
#     codex  → <target>/.codex/hooks.json      session_start + user_prompt_submit（capture-only 语义）
#
# 不碰什么：
#   - 目标项目其它任何文件；.claude/feedback/（经验数据）与经验治理台账在卸载时保留
#   - 绝不把本仓库目录作为安装目标（防止把钩子装回统一包自己）
#
# 回滚：
#   -Uninstall：移除三宿主注册项 + 删除安装副本与状态目录；经验索引与台账（用户数据）保留
#   -DryRun：只输出将执行的动作

if (-not $RepositoryRoot) {
    # PS 5.1 的 param 默认值里 $PSScriptRoot 为空（CmdletBinding 高级脚本已知限制），进脚本体后再解析
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}

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
if (-not (Test-Path -LiteralPath (Join-Path $targetFull '.git'))) { throw "TargetRoot 不是 Git 仓库根（refusing 安装到非项目目录）: $targetFull" }

# 防呆：不把钩子装进统一包自己
if ($targetFull.TrimEnd('\', '/') -eq $repoRoot.TrimEnd('\', '/')) {
    throw '拒绝把 Vibe Hook 适配器安装到 feisheng-vibe-coding 仓库自身。'
}

$sourceRunner = Get-ContainedPath -Root $repoRoot -RelativePath 'scripts/invoke-vibe-hook-adapter.ps1'
$sourceContract = Get-ContainedPath -Root $repoRoot -RelativePath 'adapters/vibe-hooks/contract.json'
$sourceRecorder = Get-ContainedPath -Root $repoRoot -RelativePath 'adapters/vibe-hooks/experience-recorder.mjs'
$contract = Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceContract | ConvertFrom-Json
$enabledStatuses = @('enabled-experience-sedimentation-v1', 'enabled-experience-auto-record-v1', 'enabled-experience-autonomous-v1', 'enabled-experience-hard-gate-v1')
if ($enabledStatuses -notcontains [string]$contract.status) { throw "契约状态 '$($contract.status)' 不是启用态，拒绝安装。" }

# 注册事件面从契约派生（单一事实源）：契约 enabled 集合与 runner 支持面漂移时显式失败
$contractEnabledEvents = @(@($contract.events.PSObject.Properties) |
    Where-Object { [bool]$_.Value.enabled } | ForEach-Object { [string]$_.Name })
$runnerSupportedEvents = @('SessionStart', 'UserPromptSubmit', 'Stop')
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

function Test-RunnerMarkedGroup {
    # 用户既有 hook 组的形状不可信（组可能缺 hooks 键、条目可能缺 command 键）：
    # StrictMode 下直接取 $_.command 会崩掉整个安装/卸载。属性存在性先行，任何形状都安全。
    param($Group)
    if ($null -eq $Group -or -not (Test-HasProperty -Object $Group -Name 'hooks')) { return $false }
    foreach ($h in @($Group.hooks)) {
        if ($null -ne $h -and (Test-HasProperty -Object $h -Name 'command') -and ([string]$h.command -like ('*' + $runnerMarker + '*'))) { return $true }
    }
    return $false
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Write-JsonAtomic {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)]$Value
    )
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $tmp = $Path + '.tmp'
    [System.IO.File]::WriteAllText($tmp, ($Value | ConvertTo-Json -Depth 20), $utf8)
    Move-Item -LiteralPath $tmp -Destination $Path -Force
}

$installDir = Get-ContainedPath -Root $targetFull -RelativePath '.feisheng/vibe-hooks'
$stateDir = Get-ContainedPath -Root $targetFull -RelativePath '.feisheng/vibe-hook-state'
$targetRunner = Join-Path $installDir 'invoke-vibe-hook-adapter.ps1'
$targetContract = Join-Path $installDir 'contract.json'
$targetRecorder = Join-Path $installDir 'experience-recorder.mjs'
$manifestPath = Join-Path $installDir 'install-manifest.json'
$claudeSettingsPath = Join-Path $targetFull '.claude/settings.json'
$zcodeConfigPath = Join-Path $targetFull '.zcode/config.json'
$codexHooksPath = Join-Path $targetFull '.codex/hooks.json'

$runnerMarker = [string]$targetRunner   # 注册去重标记：宿主注册命令里含 runner 绝对路径

$hookCommandBase = 'powershell -NoProfile -ExecutionPolicy Bypass -File "' + $targetRunner + '" -Mode Invoke -RepositoryRoot "' + $installDir + '" -TargetRoot "' + $targetFull + '" -Event {EVENT}'
$commandByEvent = @{}
foreach ($eventName in $contractEnabledEvents) {
    $commandByEvent[$eventName] = $hookCommandBase.Replace('{EVENT}', $eventName)
}
function Get-EventTimeout {
    param([Parameter(Mandatory = $true)][string]$EventName)
    $timeout = [int]$contract.events.$EventName.timeoutSeconds
    if ($timeout -le 0) { $timeout = 10 }
    return $timeout
}

# ---- 各宿主：读配置 / 写注册 / 清注册 ----
function Get-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
}

function Register-ClaudeHost {
    $settings = Get-JsonFile -Path $claudeSettingsPath
    if ($null -eq $settings) { $settings = [pscustomobject]@{} }
    if (-not (Test-HasProperty -Object $settings -Name 'hooks')) {
        $settings | Add-Member -MemberType NoteProperty -Name 'hooks' -Value ([pscustomobject]@{})
    }
    $matcherByEvent = @{ SessionStart = 'startup|resume'; UserPromptSubmit = ''; Stop = '' }
    foreach ($eventName in $contractEnabledEvents) {
        $entry = [pscustomobject]@{ type = 'command'; command = $commandByEvent[$eventName]; timeout = (Get-EventTimeout -EventName $eventName) }
        $group = [pscustomobject]@{ hooks = @($entry) }
        $matcher = $matcherByEvent[$eventName]
        if (-not [string]::IsNullOrWhiteSpace($matcher)) { $group | Add-Member -MemberType NoteProperty -Name 'matcher' -Value $matcher }
        if (Test-HasProperty -Object $settings.hooks -Name $eventName) {
            $existing = @($settings.hooks.$eventName) | Where-Object { -not (Test-RunnerMarkedGroup -Group $_) }
            $settings.hooks.$eventName = @($existing + @($group))
        } else {
            $settings.hooks | Add-Member -MemberType NoteProperty -Name $eventName -Value @($group)
        }
    }
    Write-JsonAtomic -Path $claudeSettingsPath -Value $settings
}

function Register-ZcodeHost {
    $config = Get-JsonFile -Path $zcodeConfigPath
    if ($null -eq $config) { $config = [pscustomobject]@{} }
    if (-not (Test-HasProperty -Object $config -Name 'hooks')) {
        $config | Add-Member -MemberType NoteProperty -Name 'hooks' -Value ([pscustomobject]@{})
    }
    # 配置文件 hooks 默认禁用：必须显式 enabled:true 才会运行（ZCode hooks 语义）
    if (-not (Test-HasProperty -Object $config.hooks -Name 'enabled')) {
        $config.hooks | Add-Member -MemberType NoteProperty -Name 'enabled' -Value $true
    } else {
        $config.hooks.enabled = $true
    }
    if (-not (Test-HasProperty -Object $config.hooks -Name 'events')) {
        $config.hooks | Add-Member -MemberType NoteProperty -Name 'events' -Value ([pscustomobject]@{})
    }
    $matcherByEvent = @{ SessionStart = 'startup|resume'; UserPromptSubmit = ''; Stop = '' }
    foreach ($eventName in $contractEnabledEvents) {
        $entry = [pscustomobject]@{ type = 'command'; command = $commandByEvent[$eventName]; timeout = (Get-EventTimeout -EventName $eventName) }
        $group = [pscustomobject]@{ hooks = @($entry) }
        $matcher = $matcherByEvent[$eventName]
        if (-not [string]::IsNullOrWhiteSpace($matcher)) { $group | Add-Member -MemberType NoteProperty -Name 'matcher' -Value $matcher }
        if (Test-HasProperty -Object $config.hooks.events -Name $eventName) {
            $existing = @($config.hooks.events.$eventName) | Where-Object { -not (Test-RunnerMarkedGroup -Group $_) }
            $config.hooks.events.$eventName = @($existing + @($group))
        } else {
            $config.hooks.events | Add-Member -MemberType NoteProperty -Name $eventName -Value @($group)
        }
    }
    Write-JsonAtomic -Path $zcodeConfigPath -Value $config
}

function Register-CodexHost {
    # codex hooks.json：事件名为 snake_case；本宿主契约语义为 capture-only（注入与 Stop 门禁语义未验证，
    # 显式跳过 Stop），常备义务由项目 AGENTS.md 经验治理文本承载
    $hooks = Get-JsonFile -Path $codexHooksPath
    if ($null -eq $hooks) { $hooks = [pscustomobject]@{} }
    if (-not (Test-HasProperty -Object $hooks -Name 'hooks')) {
        $hooks | Add-Member -MemberType NoteProperty -Name 'hooks' -Value ([pscustomobject]@{})
    }
    $eventBySnake = @{ SessionStart = 'session_start'; UserPromptSubmit = 'user_prompt_submit' }
    $codexEvents = @($contractEnabledEvents | Where-Object { $_ -ne 'Stop' })
    foreach ($eventName in $codexEvents) {
        $snake = $eventBySnake[$eventName]
        $entry = [pscustomobject]@{ type = 'command'; command = $commandByEvent[$eventName]; timeout = (Get-EventTimeout -EventName $eventName) }
        $group = [pscustomobject]@{ hooks = @($entry) }
        if ($eventName -eq 'SessionStart') { $group | Add-Member -MemberType NoteProperty -Name 'matcher' -Value 'startup|resume' }
        if (Test-HasProperty -Object $hooks.hooks -Name $snake) {
            $existing = @($hooks.hooks.$snake) | Where-Object { -not (Test-RunnerMarkedGroup -Group $_) }
            $hooks.hooks.$snake = @($existing + @($group))
        } else {
            $hooks.hooks | Add-Member -MemberType NoteProperty -Name $snake -Value @($group)
        }
    }
    Write-JsonAtomic -Path $codexHooksPath -Value $hooks
}

function Remove-HostRegistrations {
    # 三个宿主一起清（即使本次只装了部分；清注册按命令含 runner 路径判定，幂等）
    $hostFiles = @(
        @{ Path = $claudeSettingsPath; Events = @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop') },
        @{ Path = $zcodeConfigPath; Events = @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'Stop'); NestedEvents = $true },
        @{ Path = $codexHooksPath; Events = @('session_start', 'user_prompt_submit', 'pre_tool_use', 'permission_request', 'post_tool_use', 'subagent_start', 'subagent_stop', 'stop') }
    )
    foreach ($hostFile in $hostFiles) {
        if (-not (Test-Path -LiteralPath $hostFile.Path -PathType Leaf)) { continue }
        $settings = Get-JsonFile -Path $hostFile.Path
        if ($null -eq $settings) { continue }
        if (-not (Test-HasProperty -Object $settings -Name 'hooks')) { continue }
        $hooksRoot = $settings.hooks
        if ($hostFile.ContainsKey('NestedEvents') -and $hostFile.NestedEvents -and (Test-HasProperty -Object $hooksRoot -Name 'events')) { $hooksRoot = $hooksRoot.events }
        $changed = $false
        foreach ($eventName in $hostFile.Events) {
            if (-not (Test-HasProperty -Object $hooksRoot -Name $eventName)) { continue }
            $kept = @()
            foreach ($group in @($hooksRoot.$eventName)) {
                $matched = Test-RunnerMarkedGroup -Group $group
                if (-not $matched) { $kept += $group }
            }
            if (@($kept).Count -ne @($hooksRoot.$eventName).Count) {
                $changed = $true
                if (@($kept).Count -gt 0) { $hooksRoot.$eventName = $kept }
                else { $hooksRoot.PSObject.Properties.Remove($eventName) }
            }
        }
        if ($changed) { Write-JsonAtomic -Path $hostFile.Path -Value $settings }
    }
}

if ($Uninstall) {
    if (-not (Test-Path -LiteralPath $installDir -PathType Container) -and
        -not (Test-Path -LiteralPath $claudeSettingsPath) -and
        -not (Test-Path -LiteralPath $zcodeConfigPath) -and
        -not (Test-Path -LiteralPath $codexHooksPath)) {
        [pscustomobject]@{ status = 'SKIPPED'; reason = 'not-installed'; target = $targetFull } | ConvertTo-Json -Compress
        exit 0
    }
    if ($DryRun) { [pscustomobject]@{ status = 'DRY-RUN-UNINSTALL'; target = $targetFull } | ConvertTo-Json -Compress; exit 0 }
    # 1) 三宿主清注册（安装目录被手删也要清，防残留死钩子）
    Remove-HostRegistrations
    # 2) 删除安装副本与状态目录（保留 .claude/feedback/ 与经验治理台账）
    if (Test-Path -LiteralPath $installDir) { Remove-Item -LiteralPath $installDir -Recurse -Force }
    if (Test-Path -LiteralPath $stateDir) { Remove-Item -LiteralPath $stateDir -Recurse -Force }
    [pscustomobject]@{ status = 'UNINSTALLED'; target = $targetFull; preserved = '.claude/feedback/ + 经验治理台账' } | ConvertTo-Json -Compress
    exit 0
}

# 注册项去重：任一目标宿主文件里已有本 runner 的命令则视为已安装
$selectedHosts = if ($HostAdapter -eq 'all') { @('claude', 'zcode', 'codex') } else { @($HostAdapter) }
$pathByHost = @{ claude = $claudeSettingsPath; zcode = $zcodeConfigPath; codex = $codexHooksPath }
$alreadyRegistered = $false
foreach ($hostName in $selectedHosts) {
    $raw = $null
    if (Test-Path -LiteralPath $pathByHost[$hostName] -PathType Leaf) {
        $raw = Get-Content -Raw -Encoding UTF8 -LiteralPath $pathByHost[$hostName]
    }
    if ($raw -like ('*' + $runnerMarker + '*')) { $alreadyRegistered = $true }
}
if ($alreadyRegistered -and -not $Force) {
    throw "目标项目已注册本适配器（未加 -Force）: 请用 -Force 重装或先 -Uninstall"
}
if ((Test-Path -LiteralPath $installDir -PathType Container) -and -not $Force) {
    throw "安装目录已存在（未加 -Force）: $installDir"
}

# recorder 需要 Node 运行时（三大宿主均自带 Node；目标机缺失时显式失败而非半装）
$nodeCheck = & node --version 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeCheck)) {
    throw 'experience-recorder 需要 Node 运行时（node 不在 PATH）。请安装 Node 后重试。'
}

$runnerSha = Get-Sha256 -Path $sourceRunner
$contractSha = Get-Sha256 -Path $sourceContract
$recorderSha = Get-Sha256 -Path $sourceRecorder

if ($DryRun) {
    [pscustomobject]@{
        status = 'DRY-RUN'; target = $targetFull; hosts = $selectedHosts
        wouldInstall = @('.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1', '.feisheng/vibe-hooks/contract.json', '.feisheng/vibe-hooks/experience-recorder.mjs', '.feisheng/vibe-hooks/install-manifest.json')
        wouldRegister = $contractEnabledEvents
        runnerSha256 = $runnerSha; contractSha256 = $contractSha; recorderSha256 = $recorderSha
    } | ConvertTo-Json -Compress
    exit 0
}

# 1) 拷贝 runner + 契约 + recorder
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -LiteralPath $sourceRunner -Destination $targetRunner -Force
Copy-Item -LiteralPath $sourceContract -Destination $targetContract -Force
Copy-Item -LiteralPath $sourceRecorder -Destination $targetRecorder -Force
if ((Get-Sha256 -Path $targetRunner) -ne $runnerSha) { throw 'runner 副本 SHA 不一致' }
if ((Get-Sha256 -Path $targetContract) -ne $contractSha) { throw 'contract 副本 SHA 不一致' }
if ((Get-Sha256 -Path $targetRecorder) -ne $recorderSha) { throw 'recorder 副本 SHA 不一致' }

# 2) 各宿主注册（合并写入，不动宿主文件其它键）
foreach ($hostName in $selectedHosts) {
    switch ($hostName) {
        'claude' { Register-ClaudeHost }
        'zcode' { Register-ZcodeHost }
        'codex' { Register-CodexHost }
    }
}

# 3) 安装清单（回滚与审计依据）
$manifest = [ordered]@{
    schema = 'feisheng-vibe-hook-install/v1'
    installedAt = (Get-Date).ToUniversalTime().ToString('o')
    targetRoot = $targetFull
    hosts = $selectedHosts
    events = $contractEnabledEvents
    files = @(
        [ordered]@{ path = '.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1'; sha256 = $runnerSha }
        [ordered]@{ path = '.feisheng/vibe-hooks/contract.json'; sha256 = $contractSha }
        [ordered]@{ path = '.feisheng/vibe-hooks/experience-recorder.mjs'; sha256 = $recorderSha }
    )
    writeWhitelist = @($contract.writeWhitelist)
    rollback = 'scripts/install-vibe-hooks.ps1 -TargetRoot <target> -Uninstall'
}
[System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 8), (New-Object System.Text.UTF8Encoding($false)))

[pscustomobject]@{
    status = 'INSTALLED'; target = $targetFull; hosts = $selectedHosts
    events = $contractEnabledEvents
    runnerSha256 = $runnerSha; contractSha256 = $contractSha; recorderSha256 = $recorderSha
    settingsPaths = @($selectedHosts | ForEach-Object { $pathByHost[$_] })
    feedbackIndex = '.claude/feedback/FEEDBACK-INDEX.md（经验数据，卸载时保留）'
    rollback = $manifest.rollback
} | ConvertTo-Json -Compress
