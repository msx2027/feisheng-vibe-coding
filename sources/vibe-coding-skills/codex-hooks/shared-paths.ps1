# DocMap:
# Layer: L3 / Codex Hook internal helper
# Module: codex-hooks
# Loaded by: codex-hooks/shared.ps1
# Path classification and execution-tier mapping.

function Normalize-RepoPath {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    $normalized = $Path.Replace("`r", "").Replace("\", "/")
    while ($normalized.StartsWith("./")) {
        $normalized = $normalized.Substring(2)
    }

    if ($normalized -eq ".") {
        return ""
    }

    return $normalized
}

function Get-RelativeRepoPath {
    param(
        [string]$Root,
        [string]$Path
    )

    $rootPath = Normalize-RepoPath $Root
    $pathValue = Normalize-RepoPath $Path

    if ([string]::IsNullOrWhiteSpace($pathValue)) {
        return ""
    }

    $comparison = if ($env:OS -eq "Windows_NT") {
        [System.StringComparison]::OrdinalIgnoreCase
    }
    else {
        [System.StringComparison]::Ordinal
    }

    if ($pathValue.Equals($rootPath, $comparison)) {
        return ""
    }

    if (-not [string]::IsNullOrWhiteSpace($rootPath) -and $pathValue.StartsWith("$rootPath/", $comparison)) {
        return $pathValue.Substring($rootPath.Length + 1)
    }

    return $pathValue
}

function Test-GeneratedRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path
    if ($pathValue -eq ".claude/CLAUDE.md") {
        return $false
    }

    return $pathValue -like ".claude/*" -or
        $pathValue -like ".agents/*" -or
        $pathValue -like ".codex/*" -or
        $pathValue -like ".git/*"
}

function Test-LowSignalRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    switch -Wildcard ($pathValue) {
        "" { return $true }
        "*.lock" { return $true }
        "*.log" { return $true }
        "*.tmp" { return $true }
        "*.bak" { return $true }
        "*.swp" { return $true }
        "*.swo" { return $true }
        ".gitignore" { return $true }
        ".gitattributes" { return $true }
        ".editorconfig" { return $true }
        ".DS_Store" { return $true }
        "Thumbs.db" { return $true }
        "*.cache" { return $true }
        default { return $false }
    }
}

function Test-ModuleIndexRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path
    return $pathValue -in @(
        "skills/INDEX.md",
        "agents/INDEX.md",
        "hooks/INDEX.md",
        "codex-hooks/INDEX.md",
        "tools/INDEX.md"
    )
}

function Test-ProtectedSourceDocRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path
    return $pathValue -in @(
        "AGENTS.md",
        ".claude/CLAUDE.md",
        "DOC-MAP.md",
        "Product-Spec.md",
        "DEV-PLAN.md",
        "TERMINOLOGY-AND-NAMING.md",
        "skills/INDEX.md",
        "agents/INDEX.md",
        "hooks/INDEX.md",
        "codex-hooks/INDEX.md",
        "tools/INDEX.md"
    )
}

function Test-DocRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return $false
    }

    if (Test-ModuleIndexRepoPath $pathValue) {
        return $true
    }

    if ($pathValue -like "skills/*" -or
        $pathValue -like "agents/*" -or
        $pathValue -like "hooks/*" -or
        $pathValue -like "codex-hooks/*" -or
        $pathValue -like "tools/*" -or
        $pathValue -like ".githooks/*") {
        return $false
    }

    switch -Wildcard ($pathValue) {
        "README.md" { return $true }
        "CHANGELOG.md" { return $true }
        "CONTRIBUTING.md" { return $true }
        "Product-Spec.md" { return $true }
        "Product-Spec-CHANGELOG.md" { return $true }
        "DEV-PLAN.md" { return $true }
        "Design-Brief.md" { return $true }
        "AGENTS.md" { return $true }
        ".claude/CLAUDE.md" { return $true }
        "docs/*" { return $true }
        "plans/*" { return $true }
        "*.md" { return $true }
        "*.mdx" { return $true }
        "*.txt" { return $true }
        default { return $false }
    }
}

function Test-BehaviorRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue -or Test-DocRepoPath $pathValue) {
        return $false
    }

    switch -Wildcard ($pathValue) {
        "skills/*" { return $true }
        "agents/*" { return $true }
        "hooks/*" { return $true }
        "codex-hooks/*" { return $true }
        "tools/*" { return $true }
        ".githooks/*" { return $true }
        "migrations/*" { return $true }
        "settings.json" { return $true }
        "codex-hooks.json" { return $true }
        ".env" { return $true }
        ".env.*" { return $true }
        "*/.env" { return $true }
        "*/.env.*" { return $true }
        "*.ts" { return $true }
        "*.tsx" { return $true }
        "*.mts" { return $true }
        "*.cts" { return $true }
        "*.js" { return $true }
        "*.jsx" { return $true }
        "*.mjs" { return $true }
        "*.cjs" { return $true }
        "*.vue" { return $true }
        "*.svelte" { return $true }
        "*.html" { return $true }
        "*.css" { return $true }
        "*.scss" { return $true }
        "*.py" { return $true }
        "*.rs" { return $true }
        "*.go" { return $true }
        "*.java" { return $true }
        "*.kt" { return $true }
        "*.dart" { return $true }
        "*.swift" { return $true }
        "*.cs" { return $true }
        "*.cpp" { return $true }
        "*.sh" { return $true }
        "*.ps1" { return $true }
        "*.psm1" { return $true }
        "*.json" { return $true }
        "*.yaml" { return $true }
        "*.yml" { return $true }
        "*.toml" { return $true }
        "*.sql" { return $true }
        default { return $false }
    }
}

function Test-SourceChangeRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return $false
    }

    return (Test-ProtectedSourceDocRepoPath $pathValue) -or (Test-BehaviorRepoPath $pathValue)
}

function Test-RepoWorkflowPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    switch -Wildcard ($pathValue) {
        "skills/*" { return $true }
        "agents/*" { return $true }
        "hooks/*" { return $true }
        "codex-hooks/*" { return $true }
        "tools/*" { return $true }
        ".githooks/*" { return $true }
        "settings.json" { return $true }
        "codex-hooks.json" { return $true }
        default { return $false }
    }
}

function Test-HazardRepoPath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return $false
    }

    switch -Wildcard ($pathValue) {
        "skills/*" { return $true }
        "agents/*" { return $true }
        "hooks/*" { return $true }
        "codex-hooks/*" { return $true }
        "tools/*" { return $true }
        ".githooks/*" { return $true }
        "migrations/*" { return $true }
        "settings.json" { return $true }
        "codex-hooks.json" { return $true }
        ".env" { return $true }
        ".env.*" { return $true }
        "*/.env" { return $true }
        "*/.env.*" { return $true }
    }

    return $pathValue -match '(^|[/_.-])(auth|permission|security|token|secret|payment|database|db|migration|migrations|data[-_]?loss|filesystem|shell|network|eval|pre[-_]?commit|hook|agent|routing|release|deploy|publish|delete|danger|admin|role|privacy|login|logout|signin|sign[-_]?in|signup|sign[-_]?up|authorize|authorization)([/_.-]|$)'
}

function Get-RepoPathExecutionTier {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    if (Test-GeneratedRepoPath $pathValue -or Test-LowSignalRepoPath $pathValue) {
        return "t0"
    }

    if (Test-ProtectedSourceDocRepoPath $pathValue) {
        return "t2"
    }

    switch -Wildcard ($pathValue) {
        "skills/*" { return "t3" }
        "agents/*" { return "t3" }
        "hooks/*" { return "t3" }
        "codex-hooks/*" { return "t3" }
        "tools/*" { return "t3" }
        ".githooks/*" { return "t3" }
        "settings.json" { return "t3" }
        "codex-hooks.json" { return "t3" }
    }

    if ((Test-HazardRepoPath $pathValue) -and (Test-BehaviorRepoPath $pathValue)) {
        return "t3"
    }

    switch -Wildcard ($pathValue) {
        "*.tsx" { return "t1" }
        "*.jsx" { return "t1" }
        "*.vue" { return "t1" }
        "*.svelte" { return "t1" }
        "*.html" { return "t1" }
        "*.css" { return "t1" }
        "*.scss" { return "t1" }
    }

    if (Test-DocRepoPath $pathValue) {
        return "t0"
    }

    if (Test-BehaviorRepoPath $pathValue) {
        return "t2"
    }

    return "t0"
}

function Get-ExecutionTierRank {
    param([string]$Tier)

    switch ($Tier) {
        "t0" { return 0 }
        "t1" { return 1 }
        "t2" { return 2 }
        "t3" { return 3 }
        default { return 2 }
    }
}

function Test-RepoPathRequiresReview {
    param([string]$Path)

    return (Test-SourceChangeRepoPath $Path) -and ((Get-RepoPathGateLevel $Path) -eq "strict")
}

function Test-RepoPathRequiresDocSync {
    param([string]$Path)

    return (Test-SourceChangeRepoPath $Path) -and (Test-RepoPathRequiresReview $Path)
}

function Test-RepoPathRequiresT2Check {
    param([string]$Path)

    return (Test-SourceChangeRepoPath $Path) -and ((Get-RepoPathGateLevel $Path) -eq "t2-light")
}

function Get-RepoPathGateLevel {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path
    if (-not (Test-SourceChangeRepoPath $pathValue)) {
        return "none"
    }

    $tier = Get-RepoPathExecutionTier $pathValue
    if ((Get-ExecutionTierRank $tier) -lt 2) {
        return "none"
    }

    if ($tier -eq "t3" -or (Test-RepoWorkflowPath $pathValue)) {
        return "strict"
    }

    return "t2-light"
}
