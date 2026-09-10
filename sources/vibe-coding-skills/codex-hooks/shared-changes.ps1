# DocMap:
# Layer: L3 / Codex Hook internal helper
# Module: codex-hooks
# Loaded by: codex-hooks/shared.ps1
# Git diff, worktree, and untracked change classification.

function Get-GitChangedRepoPaths {
    param(
        [string]$Root,
        [switch]$Cached
    )

    if ([string]::IsNullOrWhiteSpace($Root)) {
        return @()
    }

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git) {
        return @()
    }

    Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs @("rev-parse", "--git-dir") *> $null
    if ($LASTEXITCODE -ne 0) {
        return @()
    }

    $gitArgs = @("diff", "--name-only")
    if ($Cached) {
        $gitArgs += "--cached"
    }

    $paths = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs $gitArgs 2>$null
    if ($LASTEXITCODE -ne 0 -or $null -eq $paths) {
        return @()
    }

    return @($paths | ForEach-Object { Normalize-RepoPath $_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Test-ChangedPathsRequireReview {
    param(
        [string]$Root,
        [switch]$Cached
    )

    foreach ($path in (Get-GitChangedRepoPaths -Root $Root -Cached:$Cached)) {
        if (Test-RepoPathRequiresReview $path) {
            return $true
        }
    }

    return $false
}

function Test-ChangedPathsRequireDocSync {
    param(
        [string]$Root,
        [switch]$Cached
    )

    foreach ($path in (Get-GitChangedRepoPaths -Root $Root -Cached:$Cached)) {
        if (Test-RepoPathRequiresDocSync $path) {
            return $true
        }
    }

    return $false
}

function Test-GitDiffMatches {
    param(
        [string]$Root,
        [string]$Path,
        [string]$Pattern,
        [switch]$Cached
    )

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git -or [string]::IsNullOrWhiteSpace($Root) -or [string]::IsNullOrWhiteSpace($Path)) {
        return $false
    }

    $args = @("diff")
    if ($Cached) {
        $args += "--cached"
    }
    $args += "--"
    $args += $Path

    $lines = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs $args 2>$null
    foreach ($line in @($lines)) {
        if ($line -match $Pattern) {
            return $true
        }
    }

    return $false
}

function Test-RepoFileMatches {
    param(
        [string]$Root,
        [string]$Path,
        [string]$Pattern
    )

    if ([string]::IsNullOrWhiteSpace($Root) -or
        [string]::IsNullOrWhiteSpace($Path) -or
        [string]::IsNullOrWhiteSpace($Pattern)) {
        return $false
    }

    $relativePath = (Normalize-RepoPath $Path).Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $absolutePath = Join-Path $Root $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        return $false
    }

    try {
        $content = Get-Content -LiteralPath $absolutePath -Raw -Encoding UTF8 -ErrorAction Stop
    }
    catch {
        return $false
    }

    return [regex]::IsMatch($content, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Test-StagedDiffHasHazardSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    if (Test-HazardRepoPath $Path) {
        return $true
    }

    return Test-GitDiffMatches -Root $Root -Path $Path -Cached -Pattern '^[+-][^+-].*(auth|permission|security|token|secret|payment|database|db|migration|data[ _-]?loss|filesystem|file system|shell|network|eval|pre[-_ ]?commit|hook|agent routing|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|password|credential|private[_ -]?key|api[_ -]?key|sql|rollback|chmod|rm -rf|exec\(|spawn\(|child_process|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert|https?://)'
}

function Test-StagedDiffHasHighRiskSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    if (Test-StagedDiffHasHazardSignal -Root $Root -Path $Path) {
        return $true
    }

    return Test-GitDiffMatches -Root $Root -Path $Path -Cached -Pattern '^[+-][^+-].*(auth|permission|token|secret|payment|database|migration|security|eval|network|filesystem|shell|pre-commit|hook|agent|routing|route|env|sql|password|credential|private[_-]?key|api[_-]?key|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|api|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert)'
}

function Test-StagedProtectedDocStrictSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    return (Test-StagedDiffHasHazardSignal -Root $Root -Path $Path) -or
        (Test-StagedDiffHasHighRiskSignal -Root $Root -Path $Path) -or
        (Test-GitDiffMatches -Root $Root -Path $Path -Cached -Pattern '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)')
}

function Test-LowRiskChangedLine {
    param([string]$Line)

    $trimmed = ([string]$Line).Trim()

    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        return $true
    }

    if ($trimmed -match '^(//.*|/\*|\*/)$') {
        return $true
    }

    if ($trimmed -match '\bon[A-Z][A-Za-z]*=|@[A-Za-z-]+=|on:[A-Za-z-]+=|\{.*\}') {
        return $false
    }

    if ($trimmed -match '(className=|class=|aria-label=|title=|placeholder=|alt=|style=)') {
        return $true
    }

    if ($trimmed -match '^<[A-Za-z][^>]*>[^<>{}`=]+</[A-Za-z][A-Za-z0-9]*>$') {
        if ($trimmed -match '[`{}=]|\bon[A-Z][A-Za-z]*=|\b(if|for|while|switch|return|import|export|const|let|var|function|async|await)\b') {
            return $false
        }
        return $true
    }

    if ($trimmed -match '^(color|background|background-color|font|font-size|font-weight|line-height|letter-spacing|width|height|min-width|max-width|min-height|max-height|inline-size|block-size|min-inline-size|max-inline-size|min-block-size|max-block-size|inset|inset-[A-Za-z-]+|top|right|bottom|left|transform|translate|translate-[A-Za-z-]+|scale|rotate|margin|margin-[A-Za-z-]+|padding|padding-[A-Za-z-]+|gap|row-gap|column-gap|border|border-[A-Za-z-]+|border-radius|box-shadow|opacity)\s*:') {
        return $true
    }

    return $false
}

function Test-StagedDiffIsLight {
    param(
        [string]$Root,
        [string]$Path
    )

    $pathValue = Normalize-RepoPath $Path
    if (-not ($pathValue -like "*.tsx" -or $pathValue -like "*.jsx" -or $pathValue -like "*.vue" -or $pathValue -like "*.svelte" -or $pathValue -like "*.html" -or $pathValue -like "*.css" -or $pathValue -like "*.scss")) {
        return $false
    }

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git) {
        return $false
    }

    $hasChanged = $false
    $lines = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs @("diff", "--cached", "--", $pathValue) 2>$null
    foreach ($line in @($lines)) {
        if ($line -like "+++*" -or $line -like "---*" -or $line -like "@@*") {
            continue
        }

        if ($line.StartsWith("+") -or $line.StartsWith("-")) {
            $hasChanged = $true
            if (-not (Test-LowRiskChangedLine ($line.Substring(1)))) {
                return $false
            }
        }
    }

    return $hasChanged
}

function Test-WorktreeDiffHasHazardSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    if (Test-HazardRepoPath $Path) {
        return $true
    }

    return Test-GitDiffMatches -Root $Root -Path $Path -Pattern '^[+-][^+-].*(auth|permission|security|token|secret|payment|database|db|migration|data[ _-]?loss|filesystem|file system|shell|network|eval|pre[-_ ]?commit|hook|agent routing|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|password|credential|private[_ -]?key|api[_ -]?key|sql|rollback|chmod|rm -rf|exec\(|spawn\(|child_process|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert|https?://)'
}

function Test-WorktreeDiffHasHighRiskSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    if (Test-WorktreeDiffHasHazardSignal -Root $Root -Path $Path) {
        return $true
    }

    return Test-GitDiffMatches -Root $Root -Path $Path -Pattern '^[+-][^+-].*(auth|permission|token|secret|payment|database|migration|security|eval|network|filesystem|shell|pre-commit|hook|agent|routing|route|env|sql|password|credential|private[_-]?key|api[_-]?key|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|api|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert)'
}

function Test-WorktreeProtectedDocStrictSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    return (Test-WorktreeDiffHasHazardSignal -Root $Root -Path $Path) -or
        (Test-WorktreeDiffHasHighRiskSignal -Root $Root -Path $Path) -or
        (Test-GitDiffMatches -Root $Root -Path $Path -Pattern '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)')
}

function Test-UntrackedFileHasHazardSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    if (Test-HazardRepoPath $Path) {
        return $true
    }

    return Test-RepoFileMatches -Root $Root -Path $Path -Pattern '(auth|permission|security|token|secret|payment|database|db|migration|data[ _-]?loss|filesystem|file system|shell|network|eval|pre[-_ ]?commit|hook|agent routing|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|password|credential|private[_ -]?key|api[_ -]?key|sql|rollback|chmod|rm -rf|exec\(|spawn\(|child_process|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|https?://)'
}

function Test-UntrackedFileHasHighRiskSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    if (Test-UntrackedFileHasHazardSignal -Root $Root -Path $Path) {
        return $true
    }

    return Test-RepoFileMatches -Root $Root -Path $Path -Pattern '(auth|permission|token|secret|payment|database|migration|security|eval|network|filesystem|shell|pre-commit|hook|agent|routing|route|env|sql|password|credential|private[_-]?key|api[_-]?key|delete|danger|admin|role|privacy|login|logout|signin|sign[-_ ]?in|signup|sign[-_ ]?up|authorize|authorization|api|fetch\(|fetch |mutation|onSubmit|@submit|on:submit|test\(|expect\(|assert)'
}

function Test-UntrackedProtectedDocStrictSignal {
    param(
        [string]$Root,
        [string]$Path
    )

    return (Test-UntrackedFileHasHazardSignal -Root $Root -Path $Path) -or
        (Test-UntrackedFileHasHighRiskSignal -Root $Root -Path $Path) -or
        (Test-RepoFileMatches -Root $Root -Path $Path -Pattern '(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)')
}

function Test-WorktreeDiffIsLight {
    param(
        [string]$Root,
        [string]$Path
    )

    $pathValue = Normalize-RepoPath $Path
    if (-not ($pathValue -like "*.tsx" -or $pathValue -like "*.jsx" -or $pathValue -like "*.vue" -or $pathValue -like "*.svelte" -or $pathValue -like "*.html" -or $pathValue -like "*.css" -or $pathValue -like "*.scss")) {
        return $false
    }

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git) {
        return $false
    }

    $hasChanged = $false
    $lines = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs @("diff", "--", $pathValue) 2>$null
    foreach ($line in @($lines)) {
        if ($line -like "+++*" -or $line -like "---*" -or $line -like "@@*") {
            continue
        }

        if ($line.StartsWith("+") -or $line.StartsWith("-")) {
            $hasChanged = $true
            if (-not (Test-LowRiskChangedLine ($line.Substring(1)))) {
                return $false
            }
        }
    }

    return $hasChanged
}

function Get-StagedChangeExecutionTier {
    param(
        [string]$Root,
        [string]$Path,
        [string]$Status = "M"
    )

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return "t0"
    }

    if (Test-ProtectedSourceDocRepoPath $pathValue) {
        if (Test-StagedProtectedDocStrictSignal -Root $Root -Path $pathValue) {
            return "t3"
        }

        return "t2"
    }

    if (Test-RepoPathRequiresReview $pathValue -and (Test-HazardRepoPath $pathValue)) {
        return "t3"
    }

    if ($Status -like "D" -or $Status -like "R*" -or $Status -like "C*") {
        if (Test-BehaviorRepoPath $pathValue) {
            if (Test-StagedDiffHasHazardSignal -Root $Root -Path $pathValue) {
                return "t3"
            }

            return "t2"
        }

        return "t0"
    }

    if (Test-DocRepoPath $pathValue) {
        if (Test-GitDiffMatches -Root $Root -Path $pathValue -Cached -Pattern '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)') {
            return "t2"
        }

        return "t0"
    }

    if (-not (Test-BehaviorRepoPath $pathValue)) {
        return "t0"
    }

    if ((Test-StagedDiffHasHazardSignal -Root $Root -Path $pathValue) -or
        (Test-StagedDiffHasHighRiskSignal -Root $Root -Path $pathValue)) {
        return "t3"
    }

    if (Test-StagedDiffIsLight -Root $Root -Path $pathValue) {
        return "t1"
    }

    return "t2"
}

function Get-WorktreeChangeExecutionTier {
    param(
        [string]$Root,
        [string]$Path,
        [string]$Status = "M"
    )

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return "t0"
    }

    if (Test-ProtectedSourceDocRepoPath $pathValue) {
        if (Test-WorktreeProtectedDocStrictSignal -Root $Root -Path $pathValue) {
            return "t3"
        }

        return "t2"
    }

    if (Test-RepoPathRequiresReview $pathValue -and (Test-HazardRepoPath $pathValue)) {
        return "t3"
    }

    if ($Status -like "D" -or $Status -like "R*" -or $Status -like "C*") {
        if (Test-BehaviorRepoPath $pathValue) {
            if (Test-WorktreeDiffHasHazardSignal -Root $Root -Path $pathValue) {
                return "t3"
            }

            return "t2"
        }

        return "t0"
    }

    if (Test-DocRepoPath $pathValue) {
        if (Test-GitDiffMatches -Root $Root -Path $pathValue -Pattern '^[+-][^+-].*(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)') {
            return "t2"
        }

        return "t0"
    }

    if (-not (Test-BehaviorRepoPath $pathValue)) {
        return "t0"
    }

    if ((Test-WorktreeDiffHasHazardSignal -Root $Root -Path $pathValue) -or
        (Test-WorktreeDiffHasHighRiskSignal -Root $Root -Path $pathValue)) {
        return "t3"
    }

    if (Test-WorktreeDiffIsLight -Root $Root -Path $pathValue) {
        return "t1"
    }

    return "t2"
}

function Get-UntrackedChangeExecutionTier {
    param(
        [string]$Root,
        [string]$Path
    )

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return "t0"
    }

    if (Test-ProtectedSourceDocRepoPath $pathValue) {
        if (Test-UntrackedProtectedDocStrictSignal -Root $Root -Path $pathValue) {
            return "t3"
        }

        return "t2"
    }

    if (Test-RepoWorkflowPath $pathValue) {
        return "t3"
    }

    if (Test-DocRepoPath $pathValue) {
        if (Test-RepoFileMatches -Root $Root -Path $pathValue -Pattern '(command|install|setup|workflow|rule|gate|hook|skill|agent|api|permission|security|token|secret|deploy|release)') {
            return "t2"
        }

        return "t0"
    }

    if (-not (Test-BehaviorRepoPath $pathValue)) {
        return "t0"
    }

    if ((Test-UntrackedFileHasHazardSignal -Root $Root -Path $pathValue) -or
        (Test-UntrackedFileHasHighRiskSignal -Root $Root -Path $pathValue)) {
        return "t3"
    }

    return "t2"
}

function Get-StagedChangeGateLevel {
    param(
        [string]$Root,
        [string]$Path,
        [string]$Status = "M"
    )

    $pathValue = Normalize-RepoPath $Path
    if (-not (Test-SourceChangeRepoPath $pathValue)) {
        return "none"
    }

    $tier = Get-StagedChangeExecutionTier -Root $Root -Path $pathValue -Status $Status
    if ((Get-ExecutionTierRank $tier) -lt 2) {
        return "none"
    }

    if ($tier -eq "t3" -or (Test-RepoWorkflowPath $pathValue)) {
        return "strict"
    }

    if (($Status -like "D" -or $Status -like "R*" -or $Status -like "C*") -and (Test-BehaviorRepoPath $pathValue)) {
        return "strict"
    }

    return "t2-light"
}

function Get-WorktreeChangeGateLevel {
    param(
        [string]$Root,
        [string]$Path,
        [string]$Status = "M"
    )

    $pathValue = Normalize-RepoPath $Path
    if (-not (Test-SourceChangeRepoPath $pathValue)) {
        return "none"
    }

    $tier = Get-WorktreeChangeExecutionTier -Root $Root -Path $pathValue -Status $Status
    if ((Get-ExecutionTierRank $tier) -lt 2) {
        return "none"
    }

    if ($tier -eq "t3" -or (Test-RepoWorkflowPath $pathValue)) {
        return "strict"
    }

    if (($Status -like "D" -or $Status -like "R*" -or $Status -like "C*") -and (Test-BehaviorRepoPath $pathValue)) {
        return "strict"
    }

    return "t2-light"
}

function Get-UntrackedChangeGateLevel {
    param(
        [string]$Root,
        [string]$Path
    )

    $pathValue = Normalize-RepoPath $Path
    if (-not (Test-SourceChangeRepoPath $pathValue)) {
        return "none"
    }

    $tier = Get-UntrackedChangeExecutionTier -Root $Root -Path $pathValue
    if ((Get-ExecutionTierRank $tier) -lt 2) {
        return "none"
    }

    if ($tier -eq "t3" -or (Test-RepoWorkflowPath $pathValue)) {
        return "strict"
    }

    return "t2-light"
}

function Test-StagedRecordRequiresReview {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    if ((Test-SourceChangeRepoPath $Record.Path) -and ((Get-ExecutionTierRank (Get-StagedChangeExecutionTier -Root $Root -Path $Record.Path -Status $Record.Status)) -ge 2)) {
        return $true
    }

    if (-not [string]::IsNullOrWhiteSpace($Record.OldPath) -and
        (Test-SourceChangeRepoPath $Record.OldPath) -and
        ((Get-ExecutionTierRank (Get-StagedChangeExecutionTier -Root $Root -Path $Record.OldPath -Status $Record.Status)) -ge 2)) {
        return $true
    }

    return $false
}

function Test-StagedRecordRequiresStrictReview {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    if ((Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-StagedChangeGateLevel -Root $Root -Path $Record.Path -Status $Record.Status) -eq "strict")) {
        return $true
    }

    if (-not [string]::IsNullOrWhiteSpace($Record.OldPath) -and
        (Test-SourceChangeRepoPath $Record.OldPath) -and
        ((Get-StagedChangeGateLevel -Root $Root -Path $Record.OldPath -Status $Record.Status) -eq "strict")) {
        return $true
    }

    return $false
}

function Test-StagedRecordRequiresT2Check {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    if ((Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-StagedChangeGateLevel -Root $Root -Path $Record.Path -Status $Record.Status) -eq "t2-light")) {
        return $true
    }

    if (-not [string]::IsNullOrWhiteSpace($Record.OldPath) -and
        (Test-SourceChangeRepoPath $Record.OldPath) -and
        ((Get-StagedChangeGateLevel -Root $Root -Path $Record.OldPath -Status $Record.Status) -eq "t2-light")) {
        return $true
    }

    return $false
}

function Test-WorktreeRecordRequiresReview {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    if ((Test-SourceChangeRepoPath $Record.Path) -and ((Get-ExecutionTierRank (Get-WorktreeChangeExecutionTier -Root $Root -Path $Record.Path -Status $Record.Status)) -ge 2)) {
        return $true
    }

    if (-not [string]::IsNullOrWhiteSpace($Record.OldPath) -and
        (Test-SourceChangeRepoPath $Record.OldPath) -and
        ((Get-ExecutionTierRank (Get-WorktreeChangeExecutionTier -Root $Root -Path $Record.OldPath -Status $Record.Status)) -ge 2)) {
        return $true
    }

    return $false
}

function Test-WorktreeRecordRequiresStrictReview {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    if ((Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-WorktreeChangeGateLevel -Root $Root -Path $Record.Path -Status $Record.Status) -eq "strict")) {
        return $true
    }

    if (-not [string]::IsNullOrWhiteSpace($Record.OldPath) -and
        (Test-SourceChangeRepoPath $Record.OldPath) -and
        ((Get-WorktreeChangeGateLevel -Root $Root -Path $Record.OldPath -Status $Record.Status) -eq "strict")) {
        return $true
    }

    return $false
}

function Test-WorktreeRecordRequiresT2Check {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    if ((Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-WorktreeChangeGateLevel -Root $Root -Path $Record.Path -Status $Record.Status) -eq "t2-light")) {
        return $true
    }

    if (-not [string]::IsNullOrWhiteSpace($Record.OldPath) -and
        (Test-SourceChangeRepoPath $Record.OldPath) -and
        ((Get-WorktreeChangeGateLevel -Root $Root -Path $Record.OldPath -Status $Record.Status) -eq "t2-light")) {
        return $true
    }

    return $false
}

function Test-UntrackedRecordRequiresReview {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    return (Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-ExecutionTierRank (Get-UntrackedChangeExecutionTier -Root $Root -Path $Record.Path)) -ge 2)
}

function Test-UntrackedRecordRequiresStrictReview {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    return (Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-UntrackedChangeGateLevel -Root $Root -Path $Record.Path) -eq "strict")
}

function Test-UntrackedRecordRequiresT2Check {
    param(
        [string]$Root,
        $Record
    )

    if ($null -eq $Record) {
        return $false
    }

    return (Test-SourceChangeRepoPath $Record.Path) -and
        ((Get-UntrackedChangeGateLevel -Root $Root -Path $Record.Path) -eq "t2-light")
}
