[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Validate', 'Invoke')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$RepositoryRoot,

    [ValidateSet('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop')]
    [string]$Event,

    # 目标项目根；缺省时从当前目录向上找 .git 祖先（与源钩子同一约定）
    [string]$TargetRoot,

    # 宿主传入的 Hook JSON payload（Claude Code 从 stdin 给出；测试可直接传字符串）
    [string]$HookInput,

    # 测试用：覆盖状态目录（默认 <TargetRoot>/.feisheng/vibe-hook-state）
    [string]$StateDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Vibe Hook 适配器单一 runner（契约：adapters/vibe-hooks/contract.json v2）。
#
# 语义（v2 = enabled-experience-sedimentation-v1）：
#   - SessionStart    启用：只读汇总目标项目经验索引，输出上下文；不写任何文件
#   - UserPromptSubmit 启用：保守纠错信号检测，命中才向白名单索引追加一行 JSON；始终 exit 0
#   - 其余事件        禁用：exit 3（治理门禁归控制面，不重复建第二套）
#
# 铁律：
#   - 永不执行 sources/vibe-coding-skills 的源钩子（sourceRunnerExecution=false）
#   - 所有写入限定在契约 writeWhitelist 内；越界 = 拒绝并记录到状态目录
#   - 幂等：同一事件键在 retention 内只处理一次

$script:EnabledEvents = @('SessionStart', 'UserPromptSubmit')

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

function Assert-Contract {
    param([Parameter(Mandatory = $true)]$Contract)

    if ($Contract.schema -ne 'feisheng-vibe-hook-adapter/v2') { throw '不支持的 Hook adapter schema（期望 v2）。' }
    if ($Contract.owner -ne 'runtime-projection') { throw 'Hook adapter owner 必须是 runtime-projection。' }
    $enabledStatuses = @('enabled-experience-sedimentation-v1')
    if ($enabledStatuses -notcontains [string]$Contract.status) { throw "契约状态 '$($Contract.status)' 不在启用集合，runner 拒绝工作。" }
    if (-not $Contract.runner.singleRunner -or $Contract.runner.path -ne 'scripts/invoke-vibe-hook-adapter.ps1') { throw 'Hook adapter 必须只有本仓库的单一 runner。' }
    if ($Contract.runner.sourceRunnerExecution -or $Contract.source.executionAllowed) { throw '来源 Hook 任何情况下都不得执行。' }
    if (-not $Contract.idempotency.required -or [string]::IsNullOrWhiteSpace([string]$Contract.idempotency.key)) { throw 'Hook adapter 必须声明幂等键。' }
    if (@($Contract.writeWhitelist).Count -eq 0) { throw '启用态契约必须声明写入白名单。' }

    $allowedEvents = @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop')
    foreach ($eventName in $allowedEvents) {
        $eventContract = $Contract.events.$eventName
        if ($null -eq $eventContract -or [int]$eventContract.timeoutSeconds -lt 1) { throw "缺少或无效的事件契约: $eventName" }
        if ([string]::IsNullOrWhiteSpace([string]$eventContract.handler)) { throw "缺少事件处理标识: $eventName" }
        if ($null -eq ($eventContract.PSObject.Properties | Where-Object { $_.Name -eq 'enabled' })) { throw "事件 $eventName 缺少 enabled 声明（fail-closed）。" }
    }
    foreach ($enabledName in $script:EnabledEvents) {
        if (-not [bool]$Contract.events.$enabledName.enabled) { throw "契约声明与 runner 不一致: $enabledName 应为启用。" }
    }
}

function Get-TargetRoot {
    param([string]$Start)
    if (-not [string]::IsNullOrWhiteSpace($Start)) {
        $cursor = [System.IO.Path]::GetFullPath($Start)
    } else {
        $cursor = [System.IO.Path]::GetFullPath((Get-Location).Path)
    }
    for ($i = 0; $i -lt 64; $i++) {
        if (Test-Path -LiteralPath (Join-Path $cursor '.git')) { return $cursor }
        $parent = Split-Path -Parent $cursor
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $cursor) { break }
        $cursor = $parent
    }
    if (-not [string]::IsNullOrWhiteSpace($Start)) { return [System.IO.Path]::GetFullPath($Start) }
    return [System.IO.Path]::GetFullPath((Get-Location).Path)
}

function Test-WhitelistedPath {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][array]$Whitelist,
        [Parameter(Mandatory = $true)][string]$RelativePath
    )
    foreach ($entry in $Whitelist) {
        $entryNorm = ([string]$entry).Replace('\', '/').TrimEnd('/')
        if ($RelativePath -eq $entryNorm -or $RelativePath.StartsWith($entryNorm + '/', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Test-PathHasReparseAncestor {
    param(
        [Parameter(Mandatory = $true)][string]$FullPath,
        [Parameter(Mandatory = $true)][string]$StopAtRoot
    )
    # P1-1：junction/symlink 可把白名单内路径引到目标项目外。
    # 检查 leaf 自身 + 逐级祖先（封顶于 TargetRoot——目标项目上方的良性 reparse 点不背锅）。
    $leaf = Get-Item -LiteralPath $FullPath -Force -ErrorAction SilentlyContinue
    if ($null -ne $leaf -and $leaf.LinkType) { return $true }
    $rootFull = [System.IO.Path]::GetFullPath($StopAtRoot).TrimEnd([char[]]@('/', '\'))
    $dir = Split-Path -Parent $FullPath
    while ($dir -and ($dir.Length -gt $rootFull.Length)) {
        $item = Get-Item -LiteralPath $dir -Force -ErrorAction SilentlyContinue
        if ($null -ne $item -and $item.LinkType) { return $true }
        $parent = Split-Path -Parent $dir
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $dir) { break }
        $dir = $parent
    }
    return $false
}

function Write-WhitelistedText {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][array]$Whitelist,
        [Parameter(Mandatory = $true)][string]$RelativePath,
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][bool]$Append
    )
    # 先做根包含规范化（越根直接拒绝），再在规范化后的相对路径上做白名单匹配（防 ../ 绕过）
    $full = Get-ContainedPath -Root $TargetRoot -RelativePath $RelativePath
    $rootFull = [System.IO.Path]::GetFullPath($TargetRoot).TrimEnd([char[]]@('\', '/'))
    $normalizedRelative = $full.Substring($rootFull.Length + 1).Replace('\', '/')
    if (-not (Test-WhitelistedPath -TargetRoot $TargetRoot -Whitelist $Whitelist -RelativePath $normalizedRelative)) {
        throw "写入路径不在契约白名单内: $normalizedRelative"
    }
    if (Test-PathHasReparseAncestor -FullPath $full -StopAtRoot $TargetRoot) {
        throw "写入路径的祖先目录含符号链接/junction，拒绝写入（防白名单逃逸）: $normalizedRelative"
    }
    $parent = Split-Path -Parent $full
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    if ($Append) {
        for ($attempt = 0; $attempt -lt 3; $attempt++) {
            try {
                [System.IO.File]::AppendAllText($full, $Content, $utf8)
                return
            } catch [System.IO.IOException] {
                Start-Sleep -Milliseconds (50 * ($attempt + 1))
            }
        }
        throw '追加写入在重试后仍失败（并发冲突）。'
    }
    [System.IO.File]::WriteAllText($full, $Content, $utf8)
}

function Test-EventDuplicate {
    param(
        [Parameter(Mandatory = $true)][string]$StateDir,
        [Parameter(Mandatory = $true)][string]$DedupKey,
        [Parameter(Mandatory = $true)][int]$RetentionSeconds
    )
    if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Force -Path $StateDir | Out-Null }
    $marker = Join-Path $StateDir ($DedupKey + '.ok')
    if (Test-Path -LiteralPath $marker -PathType Leaf) {
        $age = (Get-Date) - (Get-Item -LiteralPath $marker).LastWriteTime
        if ($age.TotalSeconds -lt $RetentionSeconds) { return $true }
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($marker, (Get-Date).ToUniversalTime().ToString('o'), $utf8)
    return $false
}

function Invoke-SessionStartHandler {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][array]$Whitelist
    )
    # 只读：汇总经验索引里待处理的条目数，作为上下文输出；不写任何文件。
    $indexPath = Join-Path $TargetRoot '.claude/feedback/FEEDBACK-INDEX.md'
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) { exit 0 }
    try {
        $lines = @(Get-Content -LiteralPath $indexPath -Encoding UTF8 | Where-Object { $_ -match '^\{' })
    } catch {
        exit 0  # 索引被锁/不可读：静默降级，绝不阻塞宿主
    }
    if ($lines.Count -eq 0) { exit 0 }
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    Write-Output ("经验沉淀提醒：目标项目的纠错经验索引有 " + $lines.Count + " 条待消化（.claude/feedback/FEEDBACK-INDEX.md）。处理相关问题时先查阅，避免重复踩坑。")
    exit 0
}

function Invoke-PromptSubmitHandler {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][array]$Whitelist,
        [Parameter(Mandatory = $true)][string]$HookInput,
        [Parameter(Mandatory = $true)][string]$StateDir
    )
    $prompt = ''
    $sessionId = ''
    try {
        $payload = $HookInput | ConvertFrom-Json
        if ($null -ne $payload.PSObject.Properties['prompt']) { $prompt = [string]$payload.prompt }
        if ($null -ne $payload.PSObject.Properties['session_id']) { $sessionId = [string]$payload.session_id }
    } catch {
        exit 0  # payload 不可解析时静默放弃（钩子绝不阻塞用户）
    }
    if ([string]::IsNullOrWhiteSpace($prompt)) { exit 0 }

    # 保守纠错信号：只有明确的否定/纠错表述才记录，避免噪音
    $patterns = @('不对', '回答错了', '你搞错了', '搞错了', '不是这样', '理解错了', '重新做', '又错了', '还是错', "that'?s wrong", 'you.?re wrong', 'incorrect', 'misunderstood')
    $matched = $false
    foreach ($p in $patterns) {
        if ($prompt -match $p) { $matched = $true; break }
    }
    if (-not $matched) { exit 0 }

    $dedupKey = $null
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $material = 'feisheng.vibe|UserPromptSubmit|' + $sessionId + '|' + $prompt
        $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($material))
        $dedupKey = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant().Substring(0, 40)
    } finally { $sha.Dispose() }
    if (Test-EventDuplicate -StateDir $StateDir -DedupKey $dedupKey -RetentionSeconds 600) { exit 0 }

    $record = [ordered]@{
        ts = (Get-Date).ToUniversalTime().ToString('o')
        sessionId = $sessionId
        dedupKey = $dedupKey
        promptSnippet = if ($prompt.Length -gt 200) { $prompt.Substring(0, 200) } else { $prompt }
    }
    $line = ($record | ConvertTo-Json -Depth 4 -Compress) + "`n"
    try {
        Write-WhitelistedText -TargetRoot $TargetRoot -Whitelist $Whitelist -RelativePath '.claude/feedback/FEEDBACK-INDEX.md' -Content $line -Append $true
    } catch {
        # 白名单写入失败：记录到状态目录（白名单内），绝不阻塞宿主
        Write-WhitelistedText -TargetRoot $TargetRoot -Whitelist $Whitelist -RelativePath '.feisheng/vibe-hook-state/write-refusals.log' -Content ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $_.Exception.Message + "`n") -Append $true
    }
    exit 0
}

# 契约解析：安装态（契约与 runner 同目录）优先，仓库态回退到 <RepositoryRoot>/adapters/vibe-hooks/
$scriptDir = $PSScriptRoot
$contractPath = Join-Path $scriptDir 'contract.json'
if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) {
    $contractPath = Get-ContainedPath -Root $RepositoryRoot -RelativePath 'adapters/vibe-hooks/contract.json'
}
if (-not (Test-Path -LiteralPath $contractPath -PathType Leaf)) { throw "缺少 Hook adapter contract: $contractPath" }

$contract = Get-Content -Raw -Encoding UTF8 -LiteralPath $contractPath | ConvertFrom-Json
Assert-Contract -Contract $contract

if ($Mode -eq 'Validate') {
    [Console]::WriteLine('PASS: Vibe Hook adapter contract v2 is valid (experience sedimentation enabled; governance gates stay disabled).')
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Event)) { throw 'Invoke 模式必须给出 Event。' }

$eventContract = $contract.events.$Event
if (-not [bool]$eventContract.enabled) {
    [Console]::Error.WriteLine("DISABLED: 事件 '$Event' 未解锁（理由: " + [string]$eventContract.disabledReason + "）；exit 3。")
    exit 3
}

$resolvedTarget = Get-TargetRoot -Start $TargetRoot
$contractStateStore = [string]$contract.idempotency.stateStore
$stateDirRelative = $contractStateStore.Replace('target-repository/', '').TrimStart('/')
if (-not [string]::IsNullOrWhiteSpace($StateDir)) {
    $resolvedStateDir = [System.IO.Path]::GetFullPath($StateDir)
} else {
    $resolvedStateDir = Get-ContainedPath -Root $resolvedTarget -RelativePath $stateDirRelative
}

switch ($Event) {
    'SessionStart' {
        Invoke-SessionStartHandler -TargetRoot $resolvedTarget -Whitelist @($contract.writeWhitelist)
    }
    'UserPromptSubmit' {
        if ([string]::IsNullOrWhiteSpace($HookInput) -and -not [Console]::IsInputRedirected) {
            # 无 stdin 且未显式传入：无东西可分析，静默成功
            exit 0
        }
        if ([string]::IsNullOrWhiteSpace($HookInput) -and [Console]::IsInputRedirected) {
            # 直接读 stdin 字节流按 UTF-8 解码：[Console]::In 在 PS 5.1 会按系统代码页（GBK）解码中文导致乱码；
            # 字节级读取对宿主管道编码完全免疫（真实会话实测中文无损）
            try {
                $ms = New-Object System.IO.MemoryStream
                $stdinStream = [Console]::OpenStandardInput()
                $buffer = New-Object byte[] 4096
                while (($read = $stdinStream.Read($buffer, 0, $buffer.Length)) -gt 0) { $ms.Write($buffer, 0, $read) }
                $HookInput = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            } catch {
                # 诊断落盘而非静默：状态目录属白名单，失败原因可审计
                try {
                    $diagDir = Join-Path $resolvedTarget '.feisheng/vibe-hook-state'
                    if (-not (Test-Path -LiteralPath $diagDir)) { New-Item -ItemType Directory -Force -Path $diagDir | Out-Null }
                    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                    [System.IO.File]::AppendAllText((Join-Path $diagDir 'stdin-read-errors.log'), ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $_.Exception.Message + "`n"), $utf8NoBom)
                } catch {}
                exit 0
            }
        }
        # 状态目录若经 junction/symlink 重定向出目标项目，则放弃采集（与白名单同一防线）
        if (Test-PathHasReparseAncestor -FullPath $resolvedStateDir -StopAtRoot $resolvedTarget) {
            try {
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::AppendAllText((Join-Path $resolvedTarget '.feisheng/vibe-hook-state/write-refusals.log'), ((Get-Date).ToUniversalTime().ToString('o') + ' state-dir reparse detected' + "`n"), $utf8NoBom)
            } catch {}
            exit 0
        }
        try {
            Invoke-PromptSubmitHandler -TargetRoot $resolvedTarget -Whitelist @($contract.writeWhitelist) -HookInput $HookInput -StateDir $resolvedStateDir
        } catch {
            # 契约 failurePolicy.handlerFailureWhenEnabled：记录后按宿主策略返回，绝不阻塞用户
            try {
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                $diagDir = Get-ContainedPath -Root $resolvedTarget -RelativePath '.feisheng/vibe-hook-state'
                if (-not (Test-Path -LiteralPath $diagDir)) { New-Item -ItemType Directory -Force -Path $diagDir | Out-Null }
                [System.IO.File]::AppendAllText((Join-Path $diagDir 'handler-errors.log'), ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $_.Exception.Message + "`n"), $utf8NoBom)
            } catch {}
            exit 0
        }
    }
    default {
        [Console]::Error.WriteLine("DISABLED: 事件 '$Event' 未启用。")
        exit 3
    }
}
