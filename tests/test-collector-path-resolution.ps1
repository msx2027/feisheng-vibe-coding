# collector path 归属与布尔恒真回归测试
# 目标：验证 catalog path 精确匹配逻辑，以及 [string] 套布尔表达式的陷阱防护

$ErrorActionPreference = 'Continue'
Set-StrictMode -Version Latest

$failed = 0
$passed = 0
$logPath = Join-Path $PSScriptRoot '..\_smoke\test-collector.log'
function Write-Log {
    param([string]$msg)
    Write-Output $msg
    Add-Content -Path $logPath -Value $msg -Encoding UTF8 -ErrorAction SilentlyContinue
}
# 清空日志
Set-Content -Path $logPath -Value '' -Encoding UTF8 -ErrorAction SilentlyContinue

function Assert-Equal {
    param([string]$Label, [object]$Expected, [object]$Actual)
    if ($Expected -ne $Actual) {
        Write-Output ("FAIL: {0} — Expected='{1}' Actual='{2}'" -f $Label, $Expected, $Actual)
        $script:failed++
    } else {
        Write-Output ("PASS: {0}" -f $Label)
        $script:passed++
    }
}

function Assert-True {
    param([string]$Label, [bool]$Condition)
    if (-not $Condition) {
        Write-Output ("FAIL: {0}" -f $Label)
        $script:failed++
    } else {
        Write-Output ("PASS: {0}" -f $Label)
        $script:passed++
    }
}

# === 从 collect-host-skill-evidence.ps1 提取的关键函数 ===
function Get-RecordPathSuffixes {
    param([Parameter(Mandatory = $true)][string]$RecordPath)
    $normalized = ([string]$RecordPath).Replace('\', '/')
    [array]$suffixes = @($normalized)
    if ($normalized -like 'sources/*') {
        $segments = @($normalized.Split('/') | Where-Object { $_ -ne '' })
        if ($segments.Count -gt 3) {
            $suffixes += (($segments[2..($segments.Count - 1)]) -join '/')
        }
    }
    return $suffixes
}

function Find-VisibleMatches {
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$VisibleEntries
    )
    $suffixes = @(Get-RecordPathSuffixes -RecordPath ([string]$Record.path))
    $attributed = @()
    foreach ($entry in $VisibleEntries) {
        foreach ($suffix in $suffixes) {
            # 正确写法：先赋布尔变量
            $isSuffixMatch = $entry.path.ToLowerInvariant().EndsWith('/' + $suffix.ToLowerInvariant(), [System.StringComparison]::OrdinalIgnoreCase)
            if ($isSuffixMatch) {
                $startsBundle = $entry.path.ToLowerInvariant().StartsWith('feisheng-vibe-coding/', [System.StringComparison]::OrdinalIgnoreCase)
                $via = if ($startsBundle) { 'unified-bundle' } else { 'legacy' }
                $attributed += [pscustomobject]@{ entry = $entry; via = $via }
                break
            }
        }
    }
    return $attributed
}

function Find-VisibleMatches-BUGGY {
    # 历史错误写法：[string] 套在布尔表达式上导致恒真
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$VisibleEntries
    )
    $suffixes = @(Get-RecordPathSuffixes -RecordPath ([string]$Record.path))
    $attributed = @()
    foreach ($entry in $VisibleEntries) {
        foreach ($suffix in $suffixes) {
            # BUG: [string]($entry.path.EndsWith(...)) 把布尔转成 "True"/"False" 字符串，非空即真
            $isSuffixMatch = [string]($entry.path.ToLowerInvariant().EndsWith('/' + $suffix.ToLowerInvariant(), [System.StringComparison]::OrdinalIgnoreCase))
            if ($isSuffixMatch) {
                $attributed += [pscustomobject]@{ entry = $entry; via = 'BUGGY' }
                break
            }
        }
    }
    return $attributed
}

# === 测试用例 1：Get-RecordPathSuffixes ===
Write-Output "`n--- Test: Get-RecordPathSuffixes ---"
$s = @(Get-RecordPathSuffixes -RecordPath 'sources/vibe-coding-skills/checkers/code-review/SKILL.md')
Assert-True 'sources path yields 2 suffixes' ($s.Count -eq 2)
Assert-Equal 'full suffix' 'sources/vibe-coding-skills/checkers/code-review/SKILL.md' $s[0]
Assert-Equal 'stripped suffix' 'checkers/code-review/SKILL.md' $s[1]

$s2 = @(Get-RecordPathSuffixes -RecordPath 'skills/checkers/code-review/SKILL.md')
Assert-True 'non-sources path yields 1 suffix' ($s2.Count -eq 1)
Assert-Equal 'non-sources suffix' 'skills/checkers/code-review/SKILL.md' $s2[0]

# === 测试用例 2：Find-VisibleMatches 精确匹配 ===
Write-Output "`n--- Test: Find-VisibleMatches exact suffix match ---"
$record = [pscustomobject]@{ path = 'skills/checkers/code-review/SKILL.md'; id = 'code-review' }
$entries = @(
    [pscustomobject]@{ path = 'feisheng-vibe-coding/skills/checkers/code-review/SKILL.md'; entryName = 'code-review'; root = 'r1'; rootPath = '/shared/skills' }
    [pscustomobject]@{ path = 'feisheng-vibe-coding/skills/checkers/ui-audit/SKILL.md'; entryName = 'ui-audit'; root = 'r1'; rootPath = '/shared/skills' }
)
$matches = @(Find-VisibleMatches -Record $record -VisibleEntries $entries)
Assert-True 'exact match finds 1' ($matches.Count -eq 1)
Assert-Equal 'match via unified-bundle' 'unified-bundle' $matches[0].via
Assert-Equal 'match entry name' 'code-review' $matches[0].entry.entryName

# === 测试用例 3：重名防护（vibe code-review vs matt code-review）===
# 实际场景：matt 的 code-review 在统一包中已重命名为 mattpocock-code-review，两者路径不同
Write-Output "`n--- Test: name collision defense ---"
$vibeRecord = [pscustomobject]@{ path = 'skills/checkers/code-review/SKILL.md'; id = 'vibe-code-review' }
$mattRecord = [pscustomobject]@{ path = 'skills/mattpocock-code-review/SKILL.md'; id = 'mattpocock-code-review' }
$entries = @(
    [pscustomobject]@{ path = 'feisheng-vibe-coding/skills/checkers/code-review/SKILL.md'; entryName = 'code-review'; root = 'r1'; rootPath = '/shared/skills' },
    [pscustomobject]@{ path = 'feisheng-vibe-coding/skills/mattpocock-code-review/SKILL.md'; entryName = 'mattpocock-code-review'; root = 'r1'; rootPath = '/shared/skills' }
)
$vibeMatches = @(Find-VisibleMatches -Record $vibeRecord -VisibleEntries $entries)
$mattMatches = @(Find-VisibleMatches -Record $mattRecord -VisibleEntries $entries)
Assert-True 'vibe record matches its own path' ($vibeMatches.Count -eq 1)
Assert-True 'matt record matches its own renamed path' ($mattMatches.Count -eq 1)
# 关键：matt 不应被 vibe 路径吸引，因为统一包路径已不同
$vibeOnlyEntries = @($entries[0])
$mattToVibe = @(Find-VisibleMatches -Record $mattRecord -VisibleEntries $vibeOnlyEntries)
Assert-True 'matt record does NOT match vibe-only path (renamed path mismatch)' ($mattToVibe.Count -eq 0)

# === 测试用例 4：遗留链接暴露（剥掉 sources/<repo>/ 前缀）===
Write-Output "`n--- Test: legacy link via stripped suffix ---"
$record = [pscustomobject]@{ path = 'sources/mattpocock-skills/tdd/SKILL.md'; id = 'tdd' }
$entries = @(
    [pscustomobject]@{ path = 'mattpocock-skills/tdd/SKILL.md'; entryName = 'tdd'; root = 'r2'; rootPath = '/legacy' }
)
$matches = @(Find-VisibleMatches -Record $record -VisibleEntries $entries)
Assert-True 'stripped suffix matches legacy link' ($matches.Count -eq 1)
Assert-Equal 'legacy via' 'legacy' $matches[0].via

# === 测试用例 5：布尔恒真回归（BUGGY 版应错误匹配，正确版不应）===
Write-Output "`n--- Test: boolean string coercion bug regression ---"
$record = [pscustomobject]@{ path = 'skills/checkers/code-review/SKILL.md'; id = 'code-review' }
$entries = @(
    [pscustomobject]@{ path = 'feisheng-vibe-coding/skills/checkers/ui-audit/SKILL.md'; entryName = 'ui-audit'; root = 'r1'; rootPath = '/shared/skills' }
)
$buggyMatches = @(Find-VisibleMatches-BUGGY -Record $record -VisibleEntries $entries)
$correctMatches = @(Find-VisibleMatches -Record $record -VisibleEntries $entries)
Assert-True 'BUGGY version falsely matches (coercion bug)' ($buggyMatches.Count -eq 1)
Assert-True 'CORRECT version does NOT match different path' ($correctMatches.Count -eq 0)

# === 测试用例 6：EndsWith 边界（前缀部分匹配不应命中）===
Write-Output "`n--- Test: partial prefix must not match ---"
$record = [pscustomobject]@{ path = 'skills/ui/ui-audit/SKILL.md'; id = 'ui-audit' }
$entries = @(
    [pscustomobject]@{ path = 'feisheng-vibe-coding/skills/ui/ui-audit-v3/SKILL.md'; entryName = 'ui-audit-v3'; root = 'r1'; rootPath = '/shared/skills' }
)
$matches = @(Find-VisibleMatches -Record $record -VisibleEntries $entries)
Assert-True 'partial name (ui-audit-v3 vs ui-audit) must NOT match' ($matches.Count -eq 0)

# === 测试用例 7：空可见列表 ===
Write-Output "`n--- Test: empty visible entries ---"
$record = [pscustomobject]@{ path = 'skills/checkers/code-review/SKILL.md'; id = 'code-review' }
$matches = @(Find-VisibleMatches -Record $record -VisibleEntries @())
Assert-True 'empty entries returns empty' ($matches.Count -eq 0)

# === 汇总 ===
Write-Output "`n========================================"
Write-Output ("Total: {0} passed, {1} failed" -f $passed, $failed)
if ($failed -gt 0) { exit 1 }
