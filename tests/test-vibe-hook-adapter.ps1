[CmdletBinding()]
param(
    # PS 5.1 的高级脚本（CmdletBinding）在 param 默认值里拿不到任何脚本路径表达式：
    # $PSScriptRoot 为空、$MyInvocation.MyCommand.Path 为 null。默认留空，进脚本体后再解析。
    # 默认解析值 = 本脚本目录（tests/）的上一级 = 仓库根。
    [string]$RepositoryRoot = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Vibe Hook 适配器测试（契约 v2：纠错信号采集启用 + Digest 消化标记，治理门禁保持禁用）。
#
# 覆盖：
#   1) Validate：契约 v2 不变量
#   2) 未启用事件（Stop / PreToolUse / PostToolUse）Invoke 必须 exit 3
#   3) SessionStart：无索引 → exit 0 且零写入；有索引 → 输出待处理条数，仍零写入
#   4) UserPromptSubmit：纠错信号 → 白名单索引恰好新增一行；重复事件幂等；普通输入零写入；非法 payload 静默
#   4f) Digest：消化标记使 SessionStart 只计未消化条数；无 dedupKey 旧行按内容哈希打 legacy 标记；幂等
#   4g) 安装器遇到用户既有异形 hook 条目（缺 command/hooks 键）不崩溃且保留原条目
#   4h) Stop 收工凭据（v2 加固批 B）：缺失→block；形状不对→block；齐备（凭据+自检留痕）→放行；3 次封顶 fail-open 保持
#   5) 写入边界：全部动作结束后，目标目录里除白名单外不得出现任何新文件
#
# 全部使用临时沙箱目标目录，不碰真实项目。

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = Split-Path -Parent $PSScriptRoot
}
$repoRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
$runner = Join-Path $repoRoot 'scripts/invoke-vibe-hook-adapter.ps1'

# 跨平台：Linux CI 只有 pwsh，Windows 可能有 powershell（PS 5.1）或 pwsh（PS 7）
$pwshExe = if (Get-Command 'pwsh' -ErrorAction SilentlyContinue) { 'pwsh' } else { 'powershell' }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ('feisheng-hook-test-' + [guid]::NewGuid().ToString('N'))
$target = Join-Path $work 'target'
New-Item -ItemType Directory -Force -Path (Join-Path $target '.git') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $target '.claude/feedback') | Out-Null
$feedbackIndex = Join-Path $target '.claude/feedback/FEEDBACK-INDEX.md'

function Invoke-Runner {
    param(
        [Parameter(Mandatory = $true)][string]$Mode,
        [string]$EventName,
        [string]$HookInput,
        [string]$Target
    )
    $args2 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $runner, '-Mode', $Mode, '-RepositoryRoot', $repoRoot)
    if (-not [string]::IsNullOrWhiteSpace($EventName)) { $args2 += @('-Event', $EventName) }
    if (-not [string]::IsNullOrWhiteSpace($Target)) { $args2 += @('-TargetRoot', $Target) }
    $global:LASTEXITCODE = 0
    # HookInput 一律走 stdin 管道：payload 内嵌双引号经原生命令行传参会被剥掉（PS 5.1 无自动转义），
    # 且 $OutputEncoding 必须显式 UTF-8，否则 PS 5.1 按 ASCII 编码管道、中文信号失配
    $global:OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    # 父进程同样必须按 UTF-8 解码子进程 stdout：否则中文之后紧邻的 ASCII（如「。PENDING=2」的 P）
    # 会被 GBK 多字节对吞掉，断言误报。真实宿主按字节 UTF-8 读取，不受此影响
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    # PS 5.1 下 2>&1 会把子进程 stderr 行变成错误记录，$ErrorActionPreference='Stop' 时一遇即炸；
    # 禁用事件的预期 stderr（DISABLED 提示）也走这条通道，捕获时临时降级
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if (-not [string]::IsNullOrWhiteSpace($HookInput)) {
            $out = $HookInput | & $pwshExe @args2 2>&1
        } else {
            $out = & $pwshExe @args2 2>&1
        }
    } finally {
        $ErrorActionPreference = $previousEap
    }
    return [pscustomobject]@{ Output = (@($out) -join "`n"); ExitCode = $global:LASTEXITCODE }
}

function Assert-IndexLineCount {
    param([Parameter(Mandatory = $true)][int]$Expected)
    if (-not (Test-Path -LiteralPath $feedbackIndex)) { throw "索引文件缺失，期望 $Expected 行" }
    $count = @(Get-Content -LiteralPath $feedbackIndex -Encoding UTF8 | Where-Object { $_ -match '^\{' }).Count
    if ($count -ne $Expected) { throw "索引行数期望 $Expected 实际 $count" }
}

try {
    # 1) Validate
    $r = Invoke-Runner -Mode 'Validate' -Target $target
    if ($r.ExitCode -ne 0) { throw "Validate 应通过，exit=$($r.ExitCode): $($r.Output)" }

    # 2) 未启用事件必须 exit 3（禁用集合从契约派生，不复制清单）
    $hookContract = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $repoRoot 'adapters/vibe-hooks/contract.json') | ConvertFrom-Json
    $disabledEvents = @(@($hookContract.events.PSObject.Properties) |
        Where-Object { -not [bool]$_.Value.enabled } | ForEach-Object { [string]$_.Name })
    if ($disabledEvents.Count -eq 0) { throw '契约没有任何禁用事件，本用例口径失效' }
    foreach ($disabled in $disabledEvents) {
        $r = Invoke-Runner -Mode 'Invoke' -EventName $disabled -Target $target
        if ($r.ExitCode -ne 3) { throw "禁用事件 $disabled 应 exit 3，实际 $($r.ExitCode)" }
    }

    # 3) SessionStart：无索引 → exit 0 零写入
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target
    if ($r.ExitCode -ne 0) { throw "SessionStart（无索引）应 exit 0，实际 $($r.ExitCode)" }
    if (Test-Path -LiteralPath $feedbackIndex) { throw 'SessionStart（无索引）不得创建索引' }

    # 3b) SessionStart：有 2 条待处理 → 输出条数，仍零写入
    Set-Content -LiteralPath $feedbackIndex -Encoding UTF8 -Value @('# 经验索引（测试）', '{"ts":"2026-09-11T00:00:00Z","note":"a"}', '{"ts":"2026-09-11T00:00:01Z","note":"b"}')
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target
    if ($r.ExitCode -ne 0) { throw "SessionStart（有索引）应 exit 0，实际 $($r.ExitCode)" }
    if ($r.Output -notmatch 'PENDING=2') { throw "SessionStart 应报告 PENDING=2，实际输出: $($r.Output)" }
    $count = @(Get-Content -LiteralPath $feedbackIndex -Encoding UTF8 | Where-Object { $_ -match '^\{' }).Count
    if ($count -ne 2) { throw "SessionStart 不得修改索引，行数变为 $count" }

    # 4) UserPromptSubmit：纠错信号 → 新增恰好 1 行
    $payload = '{"session_id":"s-test-1","prompt":"不对，你理解错了，提醒应该是到期的前三天"}'
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput $payload -Target $target
    if ($r.ExitCode -ne 0) { throw "纠错信号应 exit 0，实际 $($r.ExitCode): $($r.Output)" }
    Assert-IndexLineCount 3   # 原 2 条 + 新 1 条

    # 4b) 幂等：同一输入重复提交，不得重复记录
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput $payload -Target $target
    if ($r.ExitCode -ne 0) { throw "重复事件应 exit 0" }
    Assert-IndexLineCount 3

    # 4c) 幂等过期：把标记时间戳改到保留期之前 → 同一输入允许再次记录
    $marker = Get-ChildItem -LiteralPath (Join-Path $target '.feisheng/vibe-hook-state') -Filter '*.ok' | Select-Object -First 1
    if ($null -eq $marker) { throw '幂等标记缺失' }
    $marker.LastWriteTime = (Get-Date).AddMinutes(-11)
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput $payload -Target $target
    if ($r.ExitCode -ne 0) { throw "过期后重录应 exit 0" }
    Assert-IndexLineCount 4

    # 4d) 普通输入（无纠错信号）→ 零写入
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-test-2","prompt":"帮我把列表页的按钮改成蓝色"}' -Target $target
    if ($r.ExitCode -ne 0) { throw "普通输入应 exit 0" }
    Assert-IndexLineCount 4

    # 4e) 非法 payload → 静默 exit 0，零写入
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput 'not-json-at-all' -Target $target
    if ($r.ExitCode -ne 0) { throw "非法 payload 应 exit 0" }
    Assert-IndexLineCount 4

    # 4f) Digest 消化状态机：
    #     此刻索引 4 行 = 2 条合成行（无 dedupKey → 按行内容哈希打 legacy 标记）+ 2 条真实行（同一 dedupKey，过期重录）
    $r = Invoke-Runner -Mode 'Digest' -Target $target
    if ($r.ExitCode -ne 0) { throw "Digest 应 exit 0，实际 $($r.ExitCode): $($r.Output)" }
    if ($r.Output -notmatch [regex]::Escape('DIGEST: marked=1 already=0 legacy=2 legacyAlready=0')) { throw "Digest 首跑计数不符: $($r.Output)" }

    # 恶意 dedupKey（路径注入形态）不得直接用作标记文件名：按内容哈希归入 legacy 标记，仍限状态目录内
    Add-Content -LiteralPath $feedbackIndex -Encoding UTF8 -Value '{"dedupKey":"../../evil","ts":"2026-09-11T00:00:02Z"}'

    # 新增一条不同信号 → SessionStart 应只报「未消化」条数：1 未标记真实 + 1 未标记 legacy（恶意行）= 2
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-test-3","prompt":"还是错，日期格式应该是 ISO"}' -Target $target
    if ($r.ExitCode -ne 0) { throw "新信号应 exit 0" }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target
    if ($r.Output -notmatch 'PENDING=2') { throw "SessionStart 应报 PENDING=2（剔除已标记）: $($r.Output)" }

    # 第二次 Digest：标记新真实条目 + 恶意行走 legacy 标记
    $r = Invoke-Runner -Mode 'Digest' -Target $target
    if ($r.Output -notmatch [regex]::Escape('DIGEST: marked=1 already=1 legacy=1 legacyAlready=2')) { throw "Digest 二跑计数不符: $($r.Output)" }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target
    if ($r.Output -match 'PENDING=') { throw "全部消化后不得再报 PENDING: $($r.Output)" }

    # 幂等：第三次 Digest 全部 already
    $r = Invoke-Runner -Mode 'Digest' -Target $target
    if ($r.Output -notmatch [regex]::Escape('DIGEST: marked=0 already=2 legacy=0 legacyAlready=3')) { throw "Digest 幂等计数不符: $($r.Output)" }
    # 负面断言：状态目录之外不得出现任何 .digested 文件（恶意 dedupKey 不得逃逸）
    $escaped = @(Get-ChildItem -LiteralPath $target -Recurse -Force -Filter '*.digested' | Where-Object { $_.FullName -notlike ((Join-Path $target '.feisheng/vibe-hook-state') + '*') })
    if ($escaped.Count -gt 0) { throw ("digested 标记出现在状态目录之外: " + (@($escaped | ForEach-Object { $_.FullName }) -join '; ')) }

    # 5) 安装 / 卸载 / 回滚 + 契约篡改必须 fail-closed
    $installer = Join-Path $repoRoot 'scripts/install-vibe-hooks.ps1'
    # 5-0) 用户既有 hook 条目形状不可信：缺 command/hooks 键的异形组不得让安装器 StrictMode 崩溃
    New-Item -ItemType Directory -Force -Path (Join-Path $target '.claude') | Out-Null
    $foreignSettings = '{"hooks":{"SessionStart":[{"matcher":"workspace:*","hooks":[{"type":"prompt","timeout":2}]},{"unknownShape":true}]}}'
    [System.IO.File]::WriteAllText((Join-Path $target '.claude/settings.json'), $foreignSettings, (New-Object System.Text.UTF8Encoding($false)))
    $global:LASTEXITCODE = 0
    $instOut = & $pwshExe -NoProfile -ExecutionPolicy Bypass -File $installer -TargetRoot $target -RepositoryRoot $repoRoot 2>&1
    if ($LASTEXITCODE -ne 0) { throw "安装应成功（含异形既有 hook 条目），exit=$LASTEXITCODE" }
    $settingsInstalled = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $target '.claude/settings.json') | ConvertFrom-Json
    $foreignKept = @(@($settingsInstalled.hooks.SessionStart) | Where-Object { $null -ne $_.PSObject.Properties['unknownShape'] })
    if (@($foreignKept).Count -ne 1) { throw '安装器破坏了用户既有 hook 条目' }
    if (-not (Test-Path -LiteralPath (Join-Path $target '.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1'))) { throw '安装副本缺失' }
    if (-not (Test-Path -LiteralPath (Join-Path $target '.feisheng/vibe-hooks/install-manifest.json'))) { throw '安装清单缺失' }

    # 安装器拒绝重复安装（无 -Force）
    $global:LASTEXITCODE = 0
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $pwshExe -NoProfile -ExecutionPolicy Bypass -File $installer -TargetRoot $target -RepositoryRoot $repoRoot 2>&1 | Out-Null } finally { $ErrorActionPreference = $previousEap }
    if ($LASTEXITCODE -eq 0) { throw '重复安装未加 -Force 应失败' }

    # 契约篡改必须 fail-closed（status 翻回禁用态后，安装态 runner 拒绝工作）
    $tamperDir = Join-Path $work 'tamper'
    New-Item -ItemType Directory -Force -Path $tamperDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $target '.feisheng/vibe-hooks/invoke-vibe-hook-adapter.ps1') -Destination $tamperDir -Force
    $tamperContract = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $target '.feisheng/vibe-hooks/contract.json') | ConvertFrom-Json
    $tamperContract.status = 'defined-disabled-pending-gates'
    $tamperContract | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $tamperDir 'contract.json')
    $global:LASTEXITCODE = 0
    $previousEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $pwshExe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $tamperDir 'invoke-vibe-hook-adapter.ps1') -Mode Invoke -RepositoryRoot $repoRoot -Event SessionStart -TargetRoot $target 2>&1 | Out-Null } finally { $ErrorActionPreference = $previousEap }
    if ($LASTEXITCODE -eq 0) { throw '篡改契约后 runner 必须拒绝工作' }

    # 卸载：注册清除 + 安装副本清除 + 经验数据保留
    $global:LASTEXITCODE = 0
    $uninstOut = & $pwshExe -NoProfile -ExecutionPolicy Bypass -File $installer -TargetRoot $target -RepositoryRoot $repoRoot -Uninstall 2>&1
    if ($LASTEXITCODE -ne 0) { throw "卸载应成功，exit=$LASTEXITCODE" }
    if (Test-Path -LiteralPath (Join-Path $target '.feisheng/vibe-hooks')) { throw '卸载后安装副本残留' }
    if (-not (Test-Path -LiteralPath $feedbackIndex)) { throw '卸载不得删除经验数据' }
    $settingsAfter = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $target '.claude/settings.json') | ConvertFrom-Json
    if ($null -ne $settingsAfter.PSObject.Properties['hooks'] -and $null -ne $settingsAfter.hooks) {
        foreach ($eventName in @('SessionStart', 'UserPromptSubmit')) {
            if ($null -eq $settingsAfter.hooks.PSObject.Properties[$eventName]) { continue }
            foreach ($group in @($settingsAfter.hooks.$eventName)) {
                if ($null -eq $group -or $null -eq $group.PSObject.Properties['hooks']) { continue }
                foreach ($h in @($group.hooks)) {
                    if ($null -eq $h -or $null -eq $h.PSObject.Properties['command']) { continue }
                    if ([string]$h.command -like '*invoke-vibe-hook-adapter.ps1*') { throw '卸载后注册残留' }
                }
            }
        }
    }

    # 5b) reparse 守卫负面用例：.claude/feedback 是 junction 时，纠错信号不得写入重定向目录
    # 注：junction 是 Windows 特有机制，非 Windows 平台跳过此负面用例（Linux 无 junction，symlink 行为不同）。
    # 平台判定用环境变量而不是 $IsLinux/$IsMacOS——那两个自动变量只在 PowerShell 7+ 存在，
    # Windows PowerShell 5.1 + StrictMode 下直接引用会让整个门禁步骤失败。
    $isWindowsPlatform = ($env:OS -eq 'Windows_NT')
    if ($isWindowsPlatform) {
        $evil = Join-Path $work 'evil'
        New-Item -ItemType Directory -Force -Path $evil | Out-Null
        $feedbackDir = Join-Path $target '.claude/feedback'
        Remove-Item -LiteralPath $feedbackDir -Recurse -Force
        cmd /c mklink /j ("$feedbackDir") ("$evil") | Out-Null
        $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-junction","prompt":"不对，你理解错了"}' -Target $target
        if ($r.ExitCode -ne 0) { throw "junction 场景应 exit 0（静默降级）" }
        if (@(Get-ChildItem -LiteralPath $evil -Recurse -Force -File).Count -gt 0) { throw 'junction 逃逸：纠错数据被写出目标项目' }
        Remove-Item -LiteralPath $feedbackDir -Force
    } else {
        Write-Host '[SKIPPED] 5b) junction 负面用例（非 Windows 平台；该回归只受 Windows 本机运行保护，仓库无 Windows CI）'
    }

    # 5c) auto-record 注入 + experience-recorder 闭环（独立沙箱 target2，带台账基础设施）
    $target2 = Join-Path $work 'target2'
    New-Item -ItemType Directory -Force -Path (Join-Path $target2 '.git') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $target2 'docs/项目治理') | Out-Null
    $vibeDocs = Join-Path $target2 '.vibe-docs.json'
    [System.IO.File]::WriteAllText($vibeDocs, '{"experienceGovernance": "docs/项目治理/经验治理.md"}', (New-Object System.Text.UTF8Encoding($false)))
    $ledgerPath2 = Join-Path $target2 'docs/项目治理/经验治理.md'
    $ledgerJson = @'
{
  "vibeExperienceLedger": "v2",
  "revision": 0,
  "l1RegistryAnchor": null,
  "thresholds": { "L0": 3, "L1": 5, "L2": 8 },
  "processedEvents": [],
  "consumedConfirmations": [],
  "experiences": [],
  "archived": []
}
'@
    # 注意：围栏三连反引号必须用单引号字符串拼（双引号里 ` 是转义符）
    [System.IO.File]::WriteAllText($ledgerPath2, ('```json vibe-experience-ledger' + "`n" + $ledgerJson + "`n" + '```' + "`n`n人工登记区（必须原样保留）`n"), (New-Object System.Text.UTF8Encoding($false)))
    $recorder = Join-Path $repoRoot 'adapters/vibe-hooks/experience-recorder.mjs'

    function Get-LastJsonLine {
        param([Parameter(Mandatory = $true)][string]$Text)
        $line = @($Text -split "`n" | Where-Object { $_ -match '^\{' } | Select-Object -Last 1)
        if (@($line).Count -eq 0) { throw "输出中没有 JSON 行: $Text" }
        return (@($line)[0] | ConvertFrom-Json)
    }
    function Invoke-Recorder {
        param([Parameter(Mandatory = $true)][string[]]$RecorderArgs)
        $global:LASTEXITCODE = 0
        $out = & node $recorder $RecorderArgs 2>&1
        return [pscustomobject]@{ Output = (@($out) -join "`n"); ExitCode = $global:LASTEXITCODE }
    }

    # 5c-1) 捕获后必须注入 autoRecord 路由（JSON、事件名、命令模板俱全）
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-auto","prompt":"不对，日期字段搞错了"}' -Target $target2
    if ($r.ExitCode -ne 0) { throw "auto-record 捕获应 exit 0: $($r.Output)" }
    $injection = Get-LastJsonLine -Text $r.Output
    if ($injection.hookSpecificOutput.hookEventName -ne 'UserPromptSubmit') { throw '注入事件名必须是 UserPromptSubmit' }
    if ($injection.hookSpecificOutput.additionalContext -notmatch 'autoRecord') { throw '注入缺少 autoRecord 标识' }
    if ($injection.hookSpecificOutput.additionalContext -notmatch '--action record') { throw '注入缺少 record 命令模板' }
    # 索引行必须带 eventId + promptHash（最小事件身份）
    $indexLine2 = @(Get-Content -LiteralPath (Join-Path $target2 '.claude/feedback/FEEDBACK-INDEX.md') -Encoding UTF8 | Where-Object { $_ -match '^\{' })[0] | ConvertFrom-Json
    if (-not $indexLine2.eventId -or $indexLine2.eventId -notlike 'EVT-*') { throw '索引行缺少 EVT- eventId' }
    if ($indexLine2.promptHash -notmatch '^sha256:[a-f0-9]{64}$') { throw '索引行 promptHash 格式非法' }
    # record 模板必须携带源信号 dedupKey：缺失则 record 永不消化源信号 → Stop 门禁死循环 + 重复记账
    if ($injection.hookSpecificOutput.additionalContext -notmatch ('--action record[^\r\n]*--source-dedup-key ' + [regex]::Escape($indexLine2.dedupKey))) { throw '注入 record 模板缺少 --source-dedup-key' }
    # 注入的 recorder 路径必须真实存在（仓库态曾指向不存在的 scripts/experience-recorder.mjs）
    $recorderRef = $null
    if ($injection.hookSpecificOutput.additionalContext -match 'node "([^"]+experience-recorder\.mjs)"') { $recorderRef = $Matches[1] }
    if ([string]::IsNullOrWhiteSpace($recorderRef)) { throw '注入缺少 recorder 路径' }
    if (-not (Test-Path -LiteralPath $recorderRef -PathType Leaf)) { throw "注入的 recorder 路径不存在: $recorderRef" }

    # 5c-2) recorder：check → record → 自动消化标记 → replay no-op → CAS 拒绝
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target2 '.'), '--action', 'check')
    if ($r.ExitCode -ne 0) { throw "recorder check 应成功: $($r.Output)" }
    if ((Get-LastJsonLine -Text $r.Output).revision -ne 0) { throw 'check 应报 revision 0' }
    $occurredAt = $indexLine2.ts
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target2 '.'), '--action', 'record', '--event-id', $indexLine2.eventId, '--prompt-hash', $indexLine2.promptHash, '--occurred-at', $occurredAt, '--summary', '自动记账冒烟：日期字段格式纠错', '--expected-revision', '0', '--source-dedup-key', $indexLine2.dedupKey)
    if ($r.ExitCode -ne 0) { throw "recorder record 应成功: $($r.Output)" }
    $recorded = Get-LastJsonLine -Text $r.Output
    if ($recorded.experienceId -ne 'EXP-001' -or $recorded.revision -ne 1 -or $recorded.replay) { throw "record 结果异常: $($r.Output)" }
    if (-not $recorded.digestMarked) { throw 'record 应自动消化源信号' }
    if (-not (Test-Path -LiteralPath (Join-Path $target2 ".feisheng/vibe-hook-state/$($indexLine2.dedupKey).digested"))) { throw '消化标记未落盘' }
    # 台账外人工区必须原样保留
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $ledgerPath2) -notmatch '人工登记区') { throw '台账围栏外人工区被破坏' }
    # 重放（同 payload 同 occurredAt）→ no-op
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target2 '.'), '--action', 'record', '--event-id', $indexLine2.eventId, '--prompt-hash', $indexLine2.promptHash, '--occurred-at', $occurredAt, '--experience-id', 'EXP-001', '--expected-revision', '1')
    if ($r.ExitCode -ne 0 -or -not (Get-LastJsonLine -Text $r.Output).replay) { throw "重放应 no-op 成功: $($r.Output)" }
    # CAS 不匹配必须拒绝
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target2 '.'), '--action', 'record', '--event-id', 'EVT-cas0000cas0000cas0000cas0000cas0000', '--prompt-material', 'x', '--summary', 'y', '--expected-revision', '99')
    if ($r.ExitCode -eq 0) { throw 'CAS 不匹配必须失败' }

    # 5c-3) SessionStart 注入契约（消化完成后不再报 PENDING）
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target2
    if ($r.ExitCode -ne 0) { throw "SessionStart（auto-record）应 exit 0" }
    $ss = Get-LastJsonLine -Text $r.Output
    if ($ss.hookSpecificOutput.hookEventName -ne 'SessionStart') { throw 'SessionStart 注入事件名错误' }
    if ($ss.hookSpecificOutput.additionalContext -notmatch '经验自动记账契约') { throw 'SessionStart 缺少自动记账契约' }
    if ($ss.hookSpecificOutput.additionalContext -match 'PENDING=') { throw '源信号已消化后不得再报 PENDING' }

    # 5c-4) 无台账项目：捕获只报「未启用」，不得给出 record 指令
    $target3 = Join-Path $work 'target3'
    New-Item -ItemType Directory -Force -Path (Join-Path $target3 '.git') | Out-Null
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-noledge","prompt":"不对，搞错了"}' -Target $target3
    if ($r.ExitCode -ne 0) { throw '无台账捕获应 exit 0' }
    $noLedger = Get-LastJsonLine -Text $r.Output
    if ($noLedger.hookSpecificOutput.additionalContext -match '--action record') { throw '无台账项目不得注入 record 指令（fail-closed）' }

    # 5d) 零触发词自检 + 政策制治理（独立沙箱 target4：预置老化 L0 条目）
    $target4 = Join-Path $work 'target4'
    New-Item -ItemType Directory -Force -Path (Join-Path $target4 '.git') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $target4 'docs/项目治理') | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $target4 '.vibe-docs.json'), '{"experienceGovernance": "docs/项目治理/经验治理.md"}', (New-Object System.Text.UTF8Encoding($false)))
    $oldHex = 'a' * 40
    $ledgerOld = [ordered]@{
        vibeExperienceLedger = 'v2'; revision = 2; l1RegistryAnchor = $null
        thresholds = [ordered]@{ L0 = 3; L1 = 5; L2 = 8 }
        processedEvents = @(
            [ordered]@{ eventId = "EVT-$oldHex"; signalType = 'explicit-correction'; scope = 'target-project'; promptHash = ('sha256:' + ('a' * 64)); occurredAt = '2026-06-01T00:00:00.000Z'; experienceId = 'EXP-001' }
        )
        consumedConfirmations = @(); archived = @()
        experiences = @(
            [ordered]@{ id = 'EXP-001'; summary = '老化教训应被清扫'; tier = 'L0'; count = 1; trajectory = @('2026-06-01 记录@L0'); landing = $null }
        )
    }
    $ledgerPath4 = Join-Path $target4 'docs/项目治理/经验治理.md'
    [System.IO.File]::WriteAllText($ledgerPath4, ('```json vibe-experience-ledger' + "`n" + ($ledgerOld | ConvertTo-Json -Depth 12) + "`n" + '```' + "`n人工区保留`n"), (New-Object System.Text.UTF8Encoding($false)))

    # 5d-1) 自检义务进契约文本（零触发词）：SessionStart 注入含自检与治理义务
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target4
    $ssText = (Get-LastJsonLine -Text $r.Output).hookSpecificOutput.additionalContext
    if ($ssText -notmatch '自检义务') { throw '契约注入缺少自检义务（零触发词）' }
    if ($ssText -notmatch '治理义务') { throw '契约注入缺少治理义务' }

    # 5d-2) 政策登记（owner 会话确认一次）→ check 出现政策与 dueForReview
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'policy-add', '--policy-id', 'P-001', '--tier', 'L0', '--count-below', '3', '--days-unhit', '30', '--confirmed-by', 'owner', '--policy-source', 'owner 会话拍板 2026-09-17 政策制自治')
    if ($r.ExitCode -ne 0) { throw "policy-add 应成功: $($r.Output)" }
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'check')
    $checked = Get-LastJsonLine -Text $r.Output
    if ($checked.policies.Count -ne 1 -or -not $checked.governance.dueForReview) { throw "check 应含政策且 dueForReview=true: $($r.Output)" }

    # 5d-3) 未登记政策执行 govern 必须拒绝；登记后清扫老化条目进日志
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'govern', '--policy-id', 'P-999')
    if ($r.ExitCode -eq 0) { throw '未登记政策的 govern 必须失败' }
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'govern', '--policy-id', 'P-001')
    if ($r.ExitCode -ne 0) { throw "govern 应成功: $($r.Output)" }
    $governed = Get-LastJsonLine -Text $r.Output
    if ($governed.swept -notcontains 'EXP-001') { throw "老化条目应被清扫: $($r.Output)" }
    $journalPath4 = Join-Path $target4 'docs/项目治理/经验治理-清扫.md'
    if (-not (Test-Path -LiteralPath $journalPath4)) { throw '清扫日志缺失' }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $journalPath4) -notmatch 'EXP-001') { throw '清扫日志缺条目' }
    if ((Get-Content -Raw -Encoding UTF8 -LiteralPath $ledgerPath4) -notmatch '人工区保留') { throw '清扫后人工区被破坏' }

    # 5d-4) 清扫后 dueForReview 翻转 + 零触发词自造身份记录（无 hook 信号）
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'check')
    $checked = Get-LastJsonLine -Text $r.Output
    if ($checked.governance.dueForReview) { throw '刚治理完不应 dueForReview' }
    $selfEventId = 'EVT-' + -join ((1..40) | ForEach-Object { 'c' })
    $checkOut = (Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'check')).Output
    $expectedRev = (Get-LastJsonLine -Text $checkOut).revision
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'record', '--event-id', $selfEventId, '--prompt-material', 'AI 自检：返工了一次日期格式', '--summary', '自检教训：日期格式先用 ISO', '--expected-revision', "$expectedRev")
    if ($r.ExitCode -ne 0) { throw "自造身份记录应成功: $($r.Output)" }
    $selfRecorded = Get-LastJsonLine -Text $r.Output
    if ($selfRecorded.experienceId -ne 'EXP-002' -or $selfRecorded.replay) { throw "自检记录结果异常: $($r.Output)" }

    # 5d-5) 清扫后重放旧事件（processedEvents 保留、experiences 已移除）：必须幂等成功并只消化
    #       源信号，不得因 find() 得 undefined TypeError 崩溃（P1 回归）
    $checkOut5 = (Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'check')).Output
    $rev5 = (Get-LastJsonLine -Text $checkOut5).revision
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target4 '.'), '--action', 'record', '--event-id', "EVT-$oldHex", '--prompt-hash', ('sha256:' + ('a' * 64)), '--occurred-at', '2026-06-01T00:00:00.000Z', '--experience-id', 'EXP-001', '--source-dedup-key', $oldHex, '--expected-revision', "$rev5")
    if ($r.ExitCode -ne 0) { throw "清扫后重放应幂等成功: $($r.Output)" }
    $replayed = Get-LastJsonLine -Text $r.Output
    if (-not $replayed.replay -or -not $replayed.swept) { throw "重放已清扫经验结果异常: $($r.Output)" }
    if ($null -ne $replayed.count -or $null -ne $replayed.tier) { throw "重放已清扫经验不应返回计数/档位: $($r.Output)" }
    if (-not (Test-Path -LiteralPath (Join-Path $target4 ".feisheng/vibe-hook-state/$oldHex.digested"))) { throw '清扫后重放未消化源信号' }

    # 5e) Stop 硬门禁：自检留痕 + 未消化信号拦截 + 封顶放行（fail-open audited）
    function Get-BlockReason {
        param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
        if ([string]::IsNullOrWhiteSpace($Text)) { return $null }
        $line = @($Text -split "`n" | Where-Object { $_ -match '"decision"' } | Select-Object -Last 1)
        if (@($line).Count -eq 0) { return $null }
        return ((@($line)[0] | ConvertFrom-Json).reason)
    }
    $gateTarget = $target2
    $gateState = Join-Path $gateTarget '.feisheng/vibe-hook-state'

    # 5e-1) 无未消化信号 + 未自检留痕 + 无凭据 → 拦截，理由含 selfcheck 指令与收工凭据指令
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-gate","stop_hook_active":false}' -Target $gateTarget
    if ($r.ExitCode -ne 0) { throw "Stop 门禁应 exit 0: $($r.Output)" }
    $reason1 = Get-BlockReason -Text $r.Output
    if ($null -eq $reason1 -or $reason1 -notmatch '自检' -or $reason1 -notmatch 'selfcheck' -or $reason1 -notmatch '收工凭据') { throw "首次 Stop 应拦截并给出 selfcheck 与收工凭据指令: $($r.Output)" }

    # 5e-2) selfcheck 留痕后仍拦（只剩凭据缺失），凭据齐备后放行（无输出）
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $gateTarget '.'), '--action', 'selfcheck', '--session', 's-gate', '--finding', 'none')
    if ($r.ExitCode -ne 0) { throw "selfcheck 应成功: $($r.Output)" }
    if (-not (Test-Path -LiteralPath (Join-Path $gateState 'selfcheck-s-gate.json'))) { throw 'selfcheck 标记未落盘' }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-gate","stop_hook_active":false}' -Target $gateTarget
    $reason2 = Get-BlockReason -Text $r.Output
    if ($null -eq $reason2 -or $reason2 -notmatch '收工凭据' -or $reason2 -match '未消化纠错信号') { throw "自检留痕后应只剩收工凭据拦截: $($r.Output)" }
    $credGatePath = Join-Path $gateState 'stop-credential-s-gate.json'
    $validCredGate = '{"verification":[{"command":"pwsh tests/test-vibe-hook-adapter.ps1","exitCode":0,"outputDigest":"PASS: all green"}],"scope":{"declared":["tests/test-vibe-hook-adapter.ps1"],"outOfScope":[]},"findings":{"deferred":0,"rejectedWithReason":0}}'
    [System.IO.File]::WriteAllText($credGatePath, $validCredGate, (New-Object System.Text.UTF8Encoding($false)))
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-gate","stop_hook_active":false}' -Target $gateTarget
    if ($r.ExitCode -ne 0 -or (Get-BlockReason -Text $r.Output)) { throw "凭据齐备后 Stop 应放行: $($r.Output)" }

    # 5e-3) 新的未消化纠错信号 → 拦截并给出 record/dismiss 指令
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-cap","prompt":"不对，搞错了"}' -Target $gateTarget
    if ($r.ExitCode -ne 0) { throw '捕获应成功' }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cap","stop_hook_active":false}' -Target $gateTarget
    $reason3 = Get-BlockReason -Text $r.Output
    if ($null -eq $reason3 -or $reason3 -notmatch '未消化纠错信号' -or $reason3 -notmatch '--action record' -or $reason3 -notmatch '--source-dedup-key') { throw "未消化信号应拦截（理由需含可消化源的 record 指令）: $($r.Output)" }

    # 5e-4) stop_hook_active=true 直接放行（宿主已在继续轮次中）
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cap","stop_hook_active":true}' -Target $gateTarget
    if ($r.ExitCode -ne 0 -or (Get-BlockReason -Text $r.Output)) { throw "stop_hook_active 应放行: $($r.Output)" }

    # 5e-5) 封顶：同会话第 3 次拦截后，第 4 次放行并留审计
    Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cap","stop_hook_active":false}' -Target $gateTarget | Out-Null
    Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cap","stop_hook_active":false}' -Target $gateTarget | Out-Null
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cap","stop_hook_active":false}' -Target $gateTarget
    if (Get-BlockReason -Text $r.Output) { throw '第 4 次 Stop 应 fail-open 放行' }
    if (-not (Test-Path -LiteralPath (Join-Path $gateState 'stop-gate-audit.log'))) { throw 'fail-open 未留审计' }

    # 5e-6) 恶意会话 id 不得逃逸状态目录
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"..\\..\\evil","stop_hook_active":false}' -Target $gateTarget
    if ($r.ExitCode -ne 0) { throw '恶意 sid 应安全处理' }
    $escaped = @(Get-ChildItem -LiteralPath $gateTarget -Recurse -Force -File | Where-Object { $_.FullName -notlike ($gateState + '*') -and $_.Name -like '*evil*' })
    if ($escaped.Count -gt 0) { throw ("恶意 sid 逃逸状态目录: " + (@($escaped | ForEach-Object { $_.FullName }) -join '; ')) }

    # 5f) Stop 门禁冷启动回归：状态目录不存在时不得静默失效
    #     （曾因计数器写入抛 DirectoryNotFoundException 被 catch 吞掉 → 门禁整体失效，P1 回归）
    $target5 = Join-Path $work 'target5'
    New-Item -ItemType Directory -Force -Path (Join-Path $target5 '.git') | Out-Null
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cold","stop_hook_active":false}' -Target $target5
    if ($r.ExitCode -ne 0) { throw "冷启动 Stop 应 exit 0: $($r.Output)" }
    if ($null -eq (Get-BlockReason -Text $r.Output)) { throw '状态目录缺失时 Stop 门禁静默失效（应输出 block 拦截）' }
    if (-not (Test-Path -LiteralPath (Join-Path $target5 '.feisheng/vibe-hook-state/stop-gate-s-cold.json'))) { throw '拦截计数器未落盘（状态目录未创建）' }

    # 5f-2) 状态目录不可用（同名文件占位）→ fail-open 放行，但异常必须留审计（TEMP 兜底）
    $target6 = Join-Path $work 'target6'
    New-Item -ItemType Directory -Force -Path (Join-Path $target6 '.git') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $target6 '.feisheng') | Out-Null
    Set-Content -LiteralPath (Join-Path $target6 '.feisheng/vibe-hook-state') -Value 'not-a-dir'
    $tempAudit = Join-Path ([System.IO.Path]::GetTempPath()) 'stop-gate-audit.log'
    $auditBefore = if (Test-Path -LiteralPath $tempAudit) { (Get-Item -LiteralPath $tempAudit).Length } else { 0 }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-blocked","stop_hook_active":false}' -Target $target6
    if ($r.ExitCode -ne 0) { throw "状态目录不可用应 fail-open exit 0: $($r.Output)" }
    if ($null -ne (Get-BlockReason -Text $r.Output)) { throw '状态目录不可用应放行（绝不困住会话）' }
    if (-not (Test-Path -LiteralPath $tempAudit) -or (Get-Item -LiteralPath $tempAudit).Length -le $auditBefore) { throw '门禁异常未留审计' }

    # 5g) 收工凭据回归（v2 加固批 B，独立沙箱 target7）：缺失→block；形状不对→block；齐备→放行；封顶保持
    $target7 = Join-Path $work 'target7'
    New-Item -ItemType Directory -Force -Path (Join-Path $target7 '.git') | Out-Null
    $credState7 = Join-Path $target7 '.feisheng/vibe-hook-state'
    $credPath7 = Join-Path $credState7 'stop-credential-s-cred.json'
    $validCred7 = '{"verification":[{"command":"node adapters/vibe-hooks/experience-recorder.mjs . --action check","exitCode":0,"outputDigest":"revision=0"}],"scope":{"declared":["docs/需求变更.md"],"outOfScope":[]},"findings":{"deferred":1,"rejectedWithReason":2}}'

    # 5g-1) 凭据缺失 → block，理由含凭据 schema、落盘路径与声明源说明
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cred","stop_hook_active":false}' -Target $target7
    $g1 = Get-BlockReason -Text $r.Output
    if ($null -eq $g1 -or $g1 -notmatch '收工凭据' -or $g1 -notmatch 'declared' -or $g1 -notmatch 'stop-credential-s-cred\.json') { throw "凭据缺失应拦截且给出凭据指令: $($r.Output)" }

    # 5g-2) 形状不对（缺 verification 字段）→ 仍 block
    New-Item -ItemType Directory -Force -Path $credState7 | Out-Null
    [System.IO.File]::WriteAllText($credPath7, '{"scope":{"declared":["x"],"outOfScope":[]},"findings":{"deferred":0,"rejectedWithReason":0}}', (New-Object System.Text.UTF8Encoding($false)))
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cred","stop_hook_active":false}' -Target $target7
    if ($null -eq (Get-BlockReason -Text $r.Output)) { throw '缺 verification 的凭据应拦截' }

    # 5g-3) 形状不对（exitCode 非数值）→ 仍 block
    [System.IO.File]::WriteAllText($credPath7, '{"verification":[{"command":"echo hi","exitCode":"ok","outputDigest":"x"}],"scope":{"declared":["x"],"outOfScope":[]},"findings":{"deferred":0,"rejectedWithReason":0}}', (New-Object System.Text.UTF8Encoding($false)))
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cred","stop_hook_active":false}' -Target $target7
    if ($null -eq (Get-BlockReason -Text $r.Output)) { throw 'exitCode 非数值的凭据应拦截' }

    # 5g-4) 齐备（合格凭据 + recorder selfcheck 留痕）→ 放行
    [System.IO.File]::WriteAllText($credPath7, $validCred7, (New-Object System.Text.UTF8Encoding($false)))
    $r = Invoke-Recorder -RecorderArgs @((Join-Path $target7 '.'), '--action', 'selfcheck', '--session', 's-cred', '--finding', 'none')
    if ($r.ExitCode -ne 0) { throw "target7 selfcheck 应成功: $($r.Output)" }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-cred","stop_hook_active":false}' -Target $target7
    if ($r.ExitCode -ne 0 -or (Get-BlockReason -Text $r.Output)) { throw "凭据齐备应放行: $($r.Output)" }

    # 5g-5) 封顶保持：同会话 3 次拦截后第 4 次 fail-open 放行并留审计（凭据缺失场景下语义不变）
    for ($i = 0; $i -lt 3; $i++) {
        Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-capc","stop_hook_active":false}' -Target $target7 | Out-Null
    }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'Stop' -HookInput '{"session_id":"s-capc","stop_hook_active":false}' -Target $target7
    if (Get-BlockReason -Text $r.Output) { throw '第 4 次 Stop 应 fail-open 放行（凭据缺失不改变封顶语义）' }
    if (-not (Test-Path -LiteralPath (Join-Path $credState7 'stop-gate-audit.log'))) { throw 'fail-open 未留审计（target7）' }

    # 6) 写入边界：目标目录里除白名单外不得有新文件
    $allowed = @(
        (Join-Path $target '.git'),
        (Join-Path $target '.claude/feedback'),
        (Join-Path $target '.claude/settings.json'),
        (Join-Path $target '.feisheng/vibe-hook-state'),
        (Join-Path $target '.feisheng/vibe-hooks')
    )
    $violations = @()
    foreach ($file in @(Get-ChildItem -LiteralPath $target -Recurse -Force -File)) {
        $full = $file.FullName
        $inside = $false
        foreach ($dir in $allowed) {
            if ($full.StartsWith($dir + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or $full -eq $dir) { $inside = $true }
        }
        if (-not $inside) { $violations += $full }
    }
    if ($violations.Count -gt 0) { throw ("白名单外出现写入: " + ($violations -join '; ')) }

    [Console]::WriteLine('PASS: Vibe Hook adapter hard-gate-v1 + completion credential (v6, shape-only) — capture + autoRecord injection + recorder closed loop + policy governance + Stop self-check/credential hard gate (capped fail-open), whitelist enforced, idempotent, governance events stay disabled.')
    exit 0
} finally {
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
