[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
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
#   4f) Digest：消化标记使 SessionStart 只计未消化条数；恶意 dedupKey 不可标记不逃逸；幂等
#   5) 写入边界：全部动作结束后，目标目录里除白名单外不得出现任何新文件
#
# 全部使用临时沙箱目标目录，不碰真实项目。

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

    # 2) 未启用事件必须 exit 3
    foreach ($disabled in @('Stop', 'PreToolUse', 'PostToolUse')) {
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
    #     此刻索引 4 行 = 2 条合成行（无 dedupKey，不可标记）+ 2 条真实行（同一 dedupKey，过期重录）
    $r = Invoke-Runner -Mode 'Digest' -Target $target
    if ($r.ExitCode -ne 0) { throw "Digest 应 exit 0，实际 $($r.ExitCode): $($r.Output)" }
    if ($r.Output -notmatch [regex]::Escape('DIGEST: marked=1 already=0 unmarkable=2')) { throw "Digest 首跑计数不符: $($r.Output)" }

    # 恶意 dedupKey（路径注入形态）必须被判定为不可标记，且不得在状态目录外产生任何文件
    Add-Content -LiteralPath $feedbackIndex -Encoding UTF8 -Value '{"dedupKey":"../../evil","ts":"2026-09-11T00:00:02Z"}'

    # 新增一条不同信号 → SessionStart 应只报「未消化」条数：3 不可标记 + 1 未标记真实 = 4（已标记的 1 条不计）
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-test-3","prompt":"还是错，日期格式应该是 ISO"}' -Target $target
    if ($r.ExitCode -ne 0) { throw "新信号应 exit 0" }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target
    if ($r.Output -notmatch 'PENDING=4') { throw "SessionStart 应报 PENDING=4（剔除已标记）: $($r.Output)" }

    # 第二次 Digest：标记新条目 + 识别恶意行为不可标记
    $r = Invoke-Runner -Mode 'Digest' -Target $target
    if ($r.Output -notmatch [regex]::Escape('DIGEST: marked=1 already=1 unmarkable=3')) { throw "Digest 二跑计数不符: $($r.Output)" }
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'SessionStart' -Target $target
    if ($r.Output -notmatch 'PENDING=3') { throw "SessionStart 应报 PENDING=3: $($r.Output)" }

    # 幂等：第三次 Digest 全部 already，SessionStart 继续只报不可标记的 3 条
    $r = Invoke-Runner -Mode 'Digest' -Target $target
    if ($r.Output -notmatch [regex]::Escape('DIGEST: marked=0 already=2 unmarkable=3')) { throw "Digest 幂等计数不符: $($r.Output)" }
    # 负面断言：状态目录之外不得出现任何 .digested 文件（恶意 dedupKey 不得逃逸）
    $escaped = @(Get-ChildItem -LiteralPath $target -Recurse -Force -Filter '*.digested' | Where-Object { $_.FullName -notlike ((Join-Path $target '.feisheng/vibe-hook-state') + '*') })
    if ($escaped.Count -gt 0) { throw ("digested 标记出现在状态目录之外: " + (@($escaped | ForEach-Object { $_.FullName }) -join '; ')) }

    # 5) 安装 / 卸载 / 回滚 + 契约篡改必须 fail-closed
    $installer = Join-Path $repoRoot 'scripts/install-vibe-hooks.ps1'
    $global:LASTEXITCODE = 0
    $instOut = & $pwshExe -NoProfile -ExecutionPolicy Bypass -File $installer -TargetRoot $target -RepositoryRoot $repoRoot 2>&1
    if ($LASTEXITCODE -ne 0) { throw "安装应成功，exit=$LASTEXITCODE" }
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
            if ($null -ne $settingsAfter.hooks.PSObject.Properties[$eventName]) {
                foreach ($group in @($settingsAfter.hooks.$eventName)) {
                    foreach ($h in @($group.hooks)) {
                        if ([string]$h.command -like '*invoke-vibe-hook-adapter.ps1*') { throw '卸载后注册残留' }
                    }
                }
            }
        }
    }

    # 5b) reparse 守卫负面用例：.claude/feedback 是 junction 时，纠错信号不得写入重定向目录
    $evil = Join-Path $work 'evil'
    New-Item -ItemType Directory -Force -Path $evil | Out-Null
    $feedbackDir = Join-Path $target '.claude/feedback'
    Remove-Item -LiteralPath $feedbackDir -Recurse -Force
    cmd /c mklink /j ("$feedbackDir") ("$evil") | Out-Null
    $r = Invoke-Runner -Mode 'Invoke' -EventName 'UserPromptSubmit' -HookInput '{"session_id":"s-junction","prompt":"不对，你理解错了"}' -Target $target
    if ($r.ExitCode -ne 0) { throw "junction 场景应 exit 0（静默降级）" }
    if (@(Get-ChildItem -LiteralPath $evil -Recurse -Force -File).Count -gt 0) { throw 'junction 逃逸：纠错数据被写出目标项目' }
    Remove-Item -LiteralPath $feedbackDir -Force

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

    [Console]::WriteLine('PASS: Vibe Hook adapter v2 — capture-scoped enablement, whitelist enforced, idempotent, digestion markers pending-aware, governance events stay disabled.')
    exit 0
} finally {
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
