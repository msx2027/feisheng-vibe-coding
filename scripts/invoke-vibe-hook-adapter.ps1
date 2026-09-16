[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Validate', 'Invoke', 'Digest')]
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

# Vibe Hook 适配器单一 runner（契约：adapters/vibe-hooks/contract.json，schema v2）。
#
# 语义分两档，由契约 status / contextInjection 字段区分：
#   v2 采集面（enabled-experience-sedimentation-v1，无 contextInjection 字段）：
#   - SessionStart    只读汇总索引中「待消化」条数（已打 Digest 标记的不计）；不写任何文件
#   - UserPromptSubmit 保守纠错信号检测，命中才向白名单索引追加一行 JSON；始终 exit 0
#   auto-record 面（enabled-experience-auto-record-v1，含 contextInjection + recorder）：
#   - SessionStart    额外以 additionalContext 注入「经验自动记账契约」（未启用台账的项目保持静默）
#   - UserPromptSubmit 捕获后在索引行追加 eventId/promptHash，并以 additionalContext 注入结构化
#                      autoRecord 路由（eventId/promptHash/occurredAt/记录命令模板），AI 判断后调用
#                      experience-recorder 落账；工具不判断可复用性，判断永远在会话 AI
#   共同：
#   - Digest          维护命令（非宿主事件）：打 <dedupKey>.digested 标记；SessionStart 只提醒未消化条目
#   - 其余事件        禁用：exit 3（治理门禁归控制面，不重复建第二套）
#
# 铁律：
#   - 永不执行 sources/vibe-coding-skills 的源钩子（sourceRunnerExecution=false）
#   - 所有写入限定在契约 writeWhitelist 内；越界 = 拒绝并记录到状态目录
#   - 幂等：同一事件键在 retention 内只处理一次
#   - dedupKey 用作标记文件名前必须严格校验为 40 位小写十六进制（索引行是不可信数据，防路径注入）

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
    $enabledStatuses = @('enabled-experience-sedimentation-v1', 'enabled-experience-auto-record-v1', 'enabled-experience-autonomous-v1', 'enabled-experience-hard-gate-v1')
    if ($enabledStatuses -notcontains [string]$Contract.status) { throw "契约状态 '$($Contract.status)' 不在启用集合，runner 拒绝工作。" }
    # auto-record 档完整性：声明注入就必须同时声明 recorder，缺一 fail-closed
    $hasInjection = $null -ne ($Contract.PSObject.Properties | Where-Object { $_.Name -eq 'contextInjection' })
    $hasRecorder = $null -ne ($Contract.PSObject.Properties | Where-Object { $_.Name -eq 'recorder' })
    if ($hasInjection -ne $hasRecorder) { throw '契约完整性：contextInjection 与 recorder 必须同时声明。' }
    if ($hasRecorder -and @($Contract.recorder.actions) -notcontains 'record') { throw '契约完整性：recorder 缺少 record 动作。' }
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

function Get-ExperienceLedger {
    param([Parameter(Mandatory = $true)][string]$TargetRoot)
    # auto-record 注入只在台账真实存在时进行（fail-closed：缺基础设施就不指示 AI 写账）。
    # 返回台账的项目相对路径（正斜杠规范）；未启用/缺文件/解析失败一律返回空串。
    $docsPath = Join-Path $TargetRoot '.vibe-docs.json'
    if (-not (Test-Path -LiteralPath $docsPath -PathType Leaf)) { return '' }
    try {
        $docs = Get-Content -Raw -Encoding UTF8 -LiteralPath $docsPath | ConvertFrom-Json
        $prop = $docs.PSObject.Properties['experienceGovernance']
        if ($null -eq $prop -or [string]::IsNullOrWhiteSpace([string]$prop.Value)) { return '' }
        $ledgerRelative = ([string]$prop.Value).Replace('\', '/').TrimStart('/')
        $ledgerFull = Get-ContainedPath -Root $TargetRoot -RelativePath $ledgerRelative
        if (-not (Test-Path -LiteralPath $ledgerFull -PathType Leaf)) { return '' }
        return $ledgerRelative
    } catch { return '' }
}

function Invoke-ContextInjection {
    param(
        [Parameter(Mandatory = $true)][string]$EventName,
        [Parameter(Mandatory = $true)][string]$ContextText
    )
    # additionalContext 走宿主 hookSpecificOutput JSON（Claude Code / ZCode 同构）；输出失败绝不阻塞宿主
    try {
        [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        $payload = [ordered]@{
            hookSpecificOutput = [ordered]@{
                hookEventName = $EventName
                additionalContext = $ContextText
            }
        }
        Write-Output (($payload | ConvertTo-Json -Compress -Depth 5))
    } catch { }
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

function Get-DedupKeyFromLine {
    param([Parameter(Mandatory = $true)][string]$Line)
    # 索引行是不可信数据：dedupKey 必须严格是 40 位小写十六进制才可用作标记文件名（防路径注入）。
    try {
        $entry = $Line | ConvertFrom-Json
        if ($null -ne $entry.PSObject.Properties['dedupKey']) {
            $key = [string]$entry.dedupKey
            # -cmatch：大小写敏感。契约声明 lowercase hex，PS 的 -match 默认忽略大小写，
            # 大写 key 会在大小写敏感文件系统上产生第二份标记（GA 复核红队 P3）。
            if ($key -cmatch '^[0-9a-f]{40}$') { return $key }
        }
    } catch { }
    return ''
}

function Get-PendingSignalCount {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][string]$StateDir
    )
    # 只读：统计索引中「待消化」条数（无有效 dedupKey 的按未消化计，保守不漏）。索引缺失/不可读 → 0。
    $indexPath = Join-Path $TargetRoot '.claude/feedback/FEEDBACK-INDEX.md'
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) { return 0 }
    try {
        $lines = @(Get-Content -LiteralPath $indexPath -Encoding UTF8 | Where-Object { $_ -match '^\{' })
    } catch { return 0 }
    $pending = 0
    foreach ($line in $lines) {
        $key = Get-DedupKeyFromLine -Line $line
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $marker = Join-Path $StateDir ($key + '.digested')
            if (Test-Path -LiteralPath $marker -PathType Leaf) { continue }
        }
        $pending++
    }
    return $pending
}

function Invoke-StopGateHandler {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][string]$StateDir
    )
    # 自检硬门禁（owner 授权 2026-09-17）：会话结束前必须（a）消化全部已捕获纠错信号（b）完成本会话自检留痕。
    # 防死锁：每会话最多拦截 3 次，超限放行并留痕（fail-open, audited）；宿主 stop_hook_active=true 直接放行。
    # 本 handler 除状态目录外零写入；任何异常静默放行（绝不困住用户会话）。
    try {
        $sessionId = ''
        $stopHookActive = $false
        if ([Console]::IsInputRedirected) {
            try {
                $ms = New-Object System.IO.MemoryStream
                $stdinStream = [Console]::OpenStandardInput()
                $buffer = New-Object byte[] 4096
                while (($read = $stdinStream.Read($buffer, 0, $buffer.Length)) -gt 0) { $ms.Write($buffer, 0, $read) }
                $raw = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
                if (-not [string]::IsNullOrWhiteSpace($raw)) {
                    $payload = $raw | ConvertFrom-Json
                    if ($null -ne $payload.PSObject.Properties['session_id']) { $sessionId = [string]$payload.session_id }
                    if ($null -ne $payload.PSObject.Properties['stop_hook_active']) { $stopHookActive = [bool]$payload.stop_hook_active }
                }
            } catch { }
        }
        if ($stopHookActive) { exit 0 }
        # 会话 id 是不可信输入：白名单字符外一律哈希成 40 hex，防路径注入
        if ([string]::IsNullOrWhiteSpace($sessionId)) { $sessionId = 'nosession' }
        if ($sessionId -notmatch '^[A-Za-z0-9._-]{1,80}$') {
            $sha = [System.Security.Cryptography.SHA256]::Create()
            try {
                $sessionId = [System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($sessionId))).Replace('-', '').ToLowerInvariant().Substring(0, 40)
            } finally { $sha.Dispose() }
        }

        $pending = Get-PendingSignalCount -TargetRoot $TargetRoot -StateDir $StateDir
        $ackPath = Join-Path $StateDir ("selfcheck-" + $sessionId + ".json")
        $hasAck = Test-Path -LiteralPath $ackPath -PathType Leaf
        if ($pending -eq 0 -and $hasAck) { exit 0 }

        $counterPath = Join-Path $StateDir ("stop-gate-" + $sessionId + ".json")
        $blocks = 0
        if (Test-Path -LiteralPath $counterPath -PathType Leaf) {
            try { $prev = Get-Content -Raw -Encoding UTF8 -LiteralPath $counterPath | ConvertFrom-Json; $blocks = [int]$prev.blocks } catch { $blocks = 0 }
        }
        if ($blocks -ge 3) {
            try {
                $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
                [System.IO.File]::AppendAllText((Join-Path $StateDir 'stop-gate-audit.log'), ((Get-Date).ToUniversalTime().ToString('o') + " fail-open cap reached sid=$sessionId pending=$pending`n"), $utf8NoBom)
            } catch { }
            exit 0
        }
        $blocks++
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        $counterJson = '{"sessionId":"' + $sessionId + '","blocks":' + $blocks + ',"at":"' + (Get-Date).ToUniversalTime().ToString('o') + '"}'
        [System.IO.File]::WriteAllText($counterPath, $counterJson, $utf8NoBom)

        $recorderPath = Join-Path $scriptDir 'experience-recorder.mjs'
        if ($pending -gt 0) {
            $reason = "【经验自检硬门禁】检测到 $pending 条未消化纠错信号，会话结束前必须处理：可复用教训 → node ""$recorderPath"" ""$TargetRoot"" --action record --event-id EVT-<sha256(""self|<sessionId>|<教训摘要>""前40位)> --prompt-material <一句话教训> --summary <一句话单行> --expected-revision <先 check 获取>；不可复用 → node ""$recorderPath"" ""$TargetRoot"" --action dismiss --source-dedup-key <40hex> --reason <一句话>。处理后正常结束即可。"
        } else {
            $reason = "【经验自检硬门禁】本会话尚未自检留痕。任务完成前自检：有可复用教训（自身返工/重试、推翻方案、用户重复请求或手动撤销产出等）→ node ""$recorderPath"" ""$TargetRoot"" --action record 自行记录；没有 → node ""$recorderPath"" ""$TargetRoot"" --action selfcheck --session $sessionId --finding none 留痕后正常结束。"
        }
        [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        $blockPayload = [ordered]@{ decision = 'block'; reason = $reason }
        Write-Output (($blockPayload | ConvertTo-Json -Compress -Depth 4))
        exit 0
    } catch {
        exit 0  # 门禁自身故障绝不困住会话
    }
}

function Invoke-SessionStartHandler {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][array]$Whitelist,
        [Parameter(Mandatory = $true)][string]$StateDir,
        [Parameter(Mandatory = $false)][object]$Contract
    )
    # 只读：汇总经验索引里「待消化」条数（已打消化标记的不计）；auto-record 档额外注入记账契约。不写任何文件。
    $pending = Get-PendingSignalCount -TargetRoot $TargetRoot -StateDir $StateDir
    $indexPath = Join-Path $TargetRoot '.claude/feedback/FEEDBACK-INDEX.md'
    $total = 0
    if (Test-Path -LiteralPath $indexPath -PathType Leaf) {
        try { $total = @(Get-Content -LiteralPath $indexPath -Encoding UTF8 | Where-Object { $_ -match '^\{' }).Count } catch { $total = 0 }
    }
    $hasInjection = ($null -ne $Contract) -and ($null -ne ($Contract.PSObject.Properties | Where-Object { $_.Name -eq 'contextInjection' }))
    if (-not $hasInjection) {
        if ($pending -eq 0) { exit 0 }
        [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        # PENDING=/TOTAL= 是 ASCII 机器可读前缀（测试与日志解析用），中文句子面向宿主模型
        Write-Output ("PENDING=" + $pending + "; TOTAL=" + $total + "; 经验沉淀提醒：目标项目的纠错经验索引有 " + $pending + " 条待消化（.claude/feedback/FEEDBACK-INDEX.md）。处理相关问题时先查阅，避免重复踩坑；消化后运行 runner -Mode Digest 标记完成。")
        exit 0
    }
    # auto-record 档：注入契约；台账未启用时不指示写账（fail-closed），但保留待消化提醒
    $ledgerRelative = Get-ExperienceLedger -TargetRoot $TargetRoot
    $pendingLine = ''
    if ($pending -gt 0) {
        $pendingLine = "`n当前有 " + $pending + " 条未消化纠错信号（.claude/feedback/FEEDBACK-INDEX.md），处理相关问题前先查阅，避免重复踩坑。PENDING=" + $pending + "; TOTAL=" + $total
    }
    if ([string]::IsNullOrWhiteSpace($ledgerRelative)) {
        if ($pending -gt 0) { Invoke-ContextInjection -EventName 'SessionStart' -ContextText ("经验沉淀提醒（只读）：" + $pendingLine.TrimStart("`n")) }
        exit 0
    }
    $recorderPath = Join-Path $scriptDir 'experience-recorder.mjs'
    $contractText = @"
【经验自动记账契约 enabled-experience-autonomous-v1】本项目已启用经验治理台账（$ledgerRelative）。
1) 检测到纠错信号时 hook 会注入 autoRecord 路由；你必须在当前任务完成后立即自主处理，不需要等待用户再次指示。
2) 自检义务（零触发词，不依赖用户说任何纠错词）：每个任务完成前自检——你自己的返工/重试、推翻重来的方案、修掉的自身错误、用户重复提出同一请求、用户手动改写或撤销你的产出、用户放弃你的方案转向他路，这些一律按纠错处理：可复用→立即自行记录；不可复用→不记（宁可漏记，不可滥记）。此义务由 Stop 硬门禁强制：会话结束时若有未消化纠错信号或本会话尚未自检留痕，结束请求会被拦截并给出处理指令（每会话最多拦截 3 次，超限放行并留痕）；无新教训时用 --action selfcheck --session <sessionId> --finding none 留痕后即可正常结束。
3) 记录方法：node "$recorderPath" "$TargetRoot" --action check 获取 revision 与现有经验；新教训用 --action record --event-id EVT-<sha256("self|<sessionId>|<教训摘要>")前40位> --prompt-material <一句话教训描述> --summary <一句话单行摘要> --expected-revision <N>；命中已有经验加 --experience-id EXP-NNN。无需任何 hook 信号，事件身份由你自造且必须确定性（同 session 同教训重跑同 eventId 幂等）。
4) 判定不值得记的 hook 信号：--action dismiss --source-dedup-key <40hex> --reason <一句话>（留痕审计）。
5) 治理义务：--action check 输出 dueForReview=true 时，先跑一轮治理审查——已登记政策则按政策执行 --action govern；无政策时向用户提议政策文本（政策经用户确认一次后即可自治执行）。清扫条目进清扫日志，可恢复。
6) 红线：绝不自动升档/退役（升档 L1/L2/L3、退役必须用户逐次确认，达阈值只向用户报告可升信号）；绝不未经登记政策执行清扫。
"@
    Invoke-ContextInjection -EventName 'SessionStart' -ContextText ($contractText + $pendingLine)
    exit 0
}

function Invoke-DigestHandler {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][string]$StateDir
    )
    # 维护命令：给当前索引里的条目打消化标记。只写白名单状态目录；幂等（重复跑只报 already）。
    $indexPath = Join-Path $TargetRoot '.claude/feedback/FEEDBACK-INDEX.md'
    if (-not (Test-Path -LiteralPath $indexPath -PathType Leaf)) {
        [Console]::WriteLine('DIGEST: index missing; 0 entries marked.')
        exit 0
    }
    $lines = @(Get-Content -LiteralPath $indexPath -Encoding UTF8 | Where-Object { $_ -match '^\{' })
    if (-not (Test-Path -LiteralPath $StateDir)) { New-Item -ItemType Directory -Force -Path $StateDir | Out-Null }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $unmarkable = 0
    $uniqueKeys = @{}
    foreach ($line in $lines) {
        $key = Get-DedupKeyFromLine -Line $line
        if ([string]::IsNullOrWhiteSpace($key)) { $unmarkable++; continue }
        $uniqueKeys[$key] = $true
    }
    $marked = 0; $already = 0
    foreach ($key in $uniqueKeys.Keys) {
        $marker = Join-Path $StateDir ($key + '.digested')
        if (Test-Path -LiteralPath $marker -PathType Leaf) { $already++; continue }
        [System.IO.File]::WriteAllText($marker, (Get-Date).ToUniversalTime().ToString('o'), $utf8)
        $marked++
    }
    [Console]::WriteLine('DIGEST: marked=' + $marked + ' already=' + $already + ' unmarkable=' + $unmarkable)
    exit 0
}

function Invoke-PromptSubmitHandler {
    param(
        [Parameter(Mandatory = $true)][string]$TargetRoot,
        [Parameter(Mandatory = $true)][array]$Whitelist,
        [Parameter(Mandatory = $true)][string]$HookInput,
        [Parameter(Mandatory = $true)][string]$StateDir,
        [Parameter(Mandatory = $false)][object]$Contract
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

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $promptBytes = [System.Text.Encoding]::UTF8.GetBytes($prompt)
        $promptHash = 'sha256:' + ([System.BitConverter]::ToString($sha.ComputeHash($promptBytes))).Replace('-', '').ToLowerInvariant()
        $material = 'feisheng.vibe|UserPromptSubmit|' + $sessionId + '|' + $prompt
        $dedupKey = ([System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($material)))).Replace('-', '').ToLowerInvariant().Substring(0, 40)
    } finally { $sha.Dispose() }
    if (Test-EventDuplicate -StateDir $StateDir -DedupKey $dedupKey -RetentionSeconds 600) { exit 0 }

    $occurredAt = (Get-Date).ToUniversalTime().ToString('o')
    $eventId = 'EVT-' + $dedupKey
    $record = [ordered]@{
        ts = $occurredAt
        sessionId = $sessionId
        dedupKey = $dedupKey
        eventId = $eventId
        promptHash = $promptHash
        promptSnippet = if ($prompt.Length -gt 200) { $prompt.Substring(0, 200) } else { $prompt }
    }
    $line = ($record | ConvertTo-Json -Depth 4 -Compress) + "`n"
    $captured = $false
    try {
        Write-WhitelistedText -TargetRoot $TargetRoot -Whitelist $Whitelist -RelativePath '.claude/feedback/FEEDBACK-INDEX.md' -Content $line -Append $true
        $captured = $true
    } catch {
        # 白名单写入失败：记录到状态目录（白名单内），绝不阻塞宿主
        Write-WhitelistedText -TargetRoot $TargetRoot -Whitelist $Whitelist -RelativePath '.feisheng/vibe-hook-state/write-refusals.log' -Content ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $_.Exception.Message + "`n") -Append $true
    }
    if (-not $captured) { exit 0 }

    # auto-record 档：注入结构化 autoRecord 路由（判断在会话 AI，工具只落账）；台账未启用时只报已采集
    $hasInjection = ($null -ne $Contract) -and ($null -ne ($Contract.PSObject.Properties | Where-Object { $_.Name -eq 'contextInjection' }))
    if (-not $hasInjection) { exit 0 }
    $ledgerRelative = Get-ExperienceLedger -TargetRoot $TargetRoot
    if ([string]::IsNullOrWhiteSpace($ledgerRelative)) {
        Invoke-ContextInjection -EventName 'UserPromptSubmit' -ContextText ("已捕获纠错信号（eventId=" + $eventId + "）；本项目未启用经验治理台账（.vibe-docs.json 无 experienceGovernance 或台账文件缺失），不做自动记录。")
        exit 0
    }
    $recorderPath = Join-Path $scriptDir 'experience-recorder.mjs'
    $contextText = @"
【autoRecord 纠错信号已采集】eventId=$eventId; signalType=explicit-correction; scope=target-project; promptHash=$promptHash; occurredAt=$occurredAt; sourceDedupKey=$dedupKey
请在当前任务完成后立即自主处理（无需用户指示）：判断该纠错是否可复用教训。
可复用 → node "$recorderPath" "$TargetRoot" --action check 取 revision，再 --action record --event-id $eventId --prompt-hash $promptHash --occurred-at $occurredAt --summary <一句话单行摘要，禁止照抄原始 prompt> --expected-revision <N>（命中已有经验加 --experience-id EXP-NNN）
不可复用 → node "$recorderPath" "$TargetRoot" --action dismiss --source-dedup-key $dedupKey --reason <一句话>
两条路径都会自动消化源信号；绝不自动升档，达阈值只报告。
"@
    Invoke-ContextInjection -EventName 'UserPromptSubmit' -ContextText $contextText
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
    [Console]::WriteLine('PASS: Vibe Hook adapter contract is valid (status=' + [string]$contract.status + '; capture + auto-record injection + recorder scoped; governance gates stay disabled).')
    exit 0
}

if ($Mode -eq 'Digest') {
    $resolvedTarget = Get-TargetRoot -Start $TargetRoot
    $contractStateStore = [string]$contract.idempotency.stateStore
    $stateDirRelative = $contractStateStore.Replace('target-repository/', '').TrimStart('/')
    if (-not [string]::IsNullOrWhiteSpace($StateDir)) {
        $resolvedStateDir = [System.IO.Path]::GetFullPath($StateDir)
    } else {
        $resolvedStateDir = Get-ContainedPath -Root $resolvedTarget -RelativePath $stateDirRelative
    }
    # 状态目录若经 junction/symlink 重定向出目标项目，标记写入会越出白名单语义 → 拒绝（与采集同一防线）
    if (Test-PathHasReparseAncestor -FullPath $resolvedStateDir -StopAtRoot $resolvedTarget) {
        try {
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            $diagDir = Join-Path $resolvedTarget '.feisheng/vibe-hook-state'
            if (-not (Test-Path -LiteralPath $diagDir)) { New-Item -ItemType Directory -Force -Path $diagDir | Out-Null }
            [System.IO.File]::AppendAllText((Join-Path $diagDir 'write-refusals.log'), ((Get-Date).ToUniversalTime().ToString('o') + ' digest state-dir reparse detected' + "`n"), $utf8NoBom)
        } catch {}
        [Console]::Error.WriteLine('REFUSED: 状态目录含 reparse 点，Digest 拒绝写入。')
        exit 0
    }
    Invoke-DigestHandler -TargetRoot $resolvedTarget -StateDir $resolvedStateDir
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
        Invoke-SessionStartHandler -TargetRoot $resolvedTarget -Whitelist @($contract.writeWhitelist) -StateDir $resolvedStateDir -Contract $contract
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
            Invoke-PromptSubmitHandler -TargetRoot $resolvedTarget -Whitelist @($contract.writeWhitelist) -HookInput $HookInput -StateDir $resolvedStateDir -Contract $contract
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
        'Stop' {
            Invoke-StopGateHandler -TargetRoot $resolvedTarget -StateDir $resolvedStateDir
        }
        default {
            [Console]::Error.WriteLine("DISABLED: 事件 '$Event' 未启用。")
            exit 3
        }
    }
