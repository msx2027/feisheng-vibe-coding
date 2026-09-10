[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $scriptDir))
$mutexKey = ($repoRoot -replace '[^A-Za-z0-9._-]', '_')
if ($mutexKey.Length -gt 120) {
    $mutexKey = $mutexKey.Substring($mutexKey.Length - 120)
}
$mutexName = "Global\sync-compat-$mutexKey"
$syncMutex = [System.Threading.Mutex]::new($false, $mutexName)
$mutexHeld = $false

function Test-ReparsePoint {
    param([Parameter(Mandatory = $true)][System.IO.FileSystemInfo]$Item)

    return ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
}

function Assert-SafeRepoPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Role
    )

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootPrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if ($fullPath -ne $repoRoot -and
        -not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Role escapes repository root: $fullPath"
    }

    if (Test-Path -LiteralPath $repoRoot) {
        $rootItem = Get-Item -Force -LiteralPath $repoRoot
        if (Test-ReparsePoint -Item $rootItem) {
            throw "Repository root must not be a reparse point: $repoRoot"
        }
    }

    if ($fullPath -ne $repoRoot) {
        $relative = $fullPath.Substring($rootPrefix.Length)
        $current = $repoRoot
        foreach ($segment in ($relative -split '[\\/]')) {
            if ([string]::IsNullOrWhiteSpace($segment)) {
                continue
            }
            $current = Join-Path $current $segment
            if (-not (Test-Path -LiteralPath $current)) {
                break
            }
            $item = Get-Item -Force -LiteralPath $current
            if (Test-ReparsePoint -Item $item) {
                throw "$Role contains a reparse point: $current"
            }
        }
    }

    return $fullPath
}

function Assert-NoReparseTree {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Role
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }

    $rootItem = Get-Item -Force -LiteralPath $Path
    if (Test-ReparsePoint -Item $rootItem) {
        throw "$Role must not be a reparse point: $Path"
    }
    if (-not $rootItem.PSIsContainer) {
        return
    }

    $pending = [System.Collections.Generic.Stack[string]]::new()
    $pending.Push($rootItem.FullName)
    while ($pending.Count -gt 0) {
        $current = $pending.Pop()
        foreach ($item in Get-ChildItem -Force -LiteralPath $current) {
            if (Test-ReparsePoint -Item $item) {
                throw "$Role contains a reparse point: $($item.FullName)"
            }
            if ($item.PSIsContainer) {
                $pending.Push($item.FullName)
            }
        }
    }
}

function Test-PathInsideRepository {
    param([Parameter(Mandatory = $true)][string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootPrefix = $repoRoot.TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    return $fullPath -eq $repoRoot -or
        $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-TrustedExecutablePath {
    param([Parameter(Mandatory = $true)][string]$Path)

    try {
        if (-not [System.IO.Path]::IsPathRooted($Path)) {
            return $false
        }

        $fullPath = [System.IO.Path]::GetFullPath($Path)
        if (Test-PathInsideRepository -Path $fullPath) {
            return $false
        }
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            return $false
        }
        if ($env:OS -eq "Windows_NT" -and [System.IO.Path]::GetExtension($fullPath) -ne ".exe") {
            return $false
        }

        $current = $fullPath
        while (-not [string]::IsNullOrWhiteSpace($current)) {
            $item = Get-Item -Force -LiteralPath $current
            if (Test-ReparsePoint -Item $item) {
                return $false
            }
            $parent = Split-Path -Parent $current
            if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) {
                break
            }
            $current = $parent
        }

        return $true
    }
    catch {
        return $false
    }
}

function Resolve-TrustedPython {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:VIBE_PYTHON_EXECUTABLE -and
        [System.IO.Path]::IsPathRooted($env:VIBE_PYTHON_EXECUTABLE)) {
        $candidates.Add($env:VIBE_PYTHON_EXECUTABLE)
    }

    Get-Command python -All -CommandType Application -ErrorAction SilentlyContinue |
        ForEach-Object {
            if ($_.Source) {
                $candidates.Add($_.Source)
            }
        }

    $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($candidate in $candidates) {
        $fullPath = [System.IO.Path]::GetFullPath($candidate)
        if (-not $seen.Add($fullPath) -or -not (Test-TrustedExecutablePath -Path $fullPath)) {
            continue
        }

        $previousLocation = Get-Location
        try {
            Set-Location -LiteralPath (Split-Path -Parent $fullPath)
            & $fullPath -I -c "import tomllib" *> $null
            if ($LASTEXITCODE -eq 0) {
                return $fullPath
            }
        }
        catch {
            # Keep searching for a trusted Python with tomllib support.
        }
        finally {
            Set-Location -LiteralPath $previousLocation.Path
        }
    }

    return $null
}

function New-AtomicFileContext {
    param(
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][string]$Role
    )

    $safeTarget = Assert-SafeRepoPath -Path $Target -Role $Role
    $targetParent = Split-Path -Parent $safeTarget
    if ($targetParent) {
        [void](Assert-SafeRepoPath -Path $targetParent -Role "$Role parent")
        Assert-NoReparseTree -Path $targetParent -Role "$Role parent"
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
        [void](Assert-SafeRepoPath -Path $targetParent -Role "$Role parent")
        Assert-NoReparseTree -Path $targetParent -Role "$Role parent"
    }

    $existingTarget = $null
    try {
        $existingTarget = Get-Item -Force -LiteralPath $safeTarget -ErrorAction Stop
    }
    catch [System.Management.Automation.ItemNotFoundException] {
        $existingTarget = $null
    }
    if ($existingTarget -and
        ((Test-ReparsePoint -Item $existingTarget) -or $existingTarget.PSIsContainer)) {
        throw "$Role must be a regular non-reparse file: $safeTarget"
    }

    $nonce = [guid]::NewGuid().ToString('N').Substring(0, 16)
    return [pscustomobject]@{
        Target = $safeTarget
        Parent = $targetParent
        Temporary = Assert-SafeRepoPath -Path (Join-Path $targetParent ".s-$PID-$nonce") -Role "$Role temporary file"
        Backup = Assert-SafeRepoPath -Path (Join-Path $targetParent ".b-$PID-$nonce") -Role "$Role backup file"
        TargetExisted = $null -ne $existingTarget
        Role = $Role
    }
}

function Complete-AtomicFile {
    param([Parameter(Mandatory = $true)]$Context)

    $temporaryItem = Get-Item -Force -LiteralPath $Context.Temporary -ErrorAction Stop
    if ((Test-ReparsePoint -Item $temporaryItem) -or $temporaryItem.PSIsContainer) {
        throw "$($Context.Role) temporary path is not a regular file: $($Context.Temporary)"
    }

    [void](Assert-SafeRepoPath -Path $Context.Target -Role $Context.Role)
    Assert-NoReparseTree -Path $Context.Parent -Role "$($Context.Role) parent"

    $currentTarget = $null
    try {
        $currentTarget = Get-Item -Force -LiteralPath $Context.Target -ErrorAction Stop
    }
    catch [System.Management.Automation.ItemNotFoundException] {
        $currentTarget = $null
    }
    if ($currentTarget -and
        ((Test-ReparsePoint -Item $currentTarget) -or $currentTarget.PSIsContainer)) {
        throw "$($Context.Role) changed to an unsafe target before replacement: $($Context.Target)"
    }

    if ($Context.TargetExisted) {
        if (-not $currentTarget) {
            throw "$($Context.Role) changed before replacement: $($Context.Target)"
        }
        [System.IO.File]::Replace($Context.Temporary, $Context.Target, $Context.Backup)
        Remove-Item -LiteralPath $Context.Backup -Force -ErrorAction Stop
    }
    else {
        if ($currentTarget) {
            throw "$($Context.Role) appeared before replacement: $($Context.Target)"
        }
        [System.IO.File]::Move($Context.Temporary, $Context.Target)
    }
}

function Remove-AtomicFileArtifacts {
    param([Parameter(Mandatory = $true)]$Context)

    foreach ($path in @($Context.Temporary, $Context.Backup)) {
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }
        $item = Get-Item -Force -LiteralPath $path
        if ((Test-ReparsePoint -Item $item) -or $item.PSIsContainer) {
            throw "Refusing to remove unsafe atomic file artifact: $path"
        }
        Remove-Item -LiteralPath $path -Force -ErrorAction Stop
    }
}

function Copy-AtomicFile {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Target,
        [Parameter(Mandatory = $true)][string]$Role
    )

    $safeSource = Assert-SafeRepoPath -Path $Source -Role "$Role source"
    if (-not (Test-Path -LiteralPath $safeSource -PathType Leaf)) {
        throw "Missing source file: $safeSource"
    }
    $sourceItem = Get-Item -Force -LiteralPath $safeSource
    if ((Test-ReparsePoint -Item $sourceItem) -or $sourceItem.PSIsContainer) {
        throw "$Role source must be a regular non-reparse file: $safeSource"
    }

    $context = New-AtomicFileContext -Target $Target -Role $Role
    try {
        Copy-Item -LiteralPath $safeSource -Destination $context.Temporary -Force
        Complete-AtomicFile -Context $context
    }
    finally {
        Remove-AtomicFileArtifacts -Context $context
    }
}

function Sync-Directory {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRelative,
        [Parameter(Mandatory = $true)][string]$TargetRelative,
        [string[]]$ExcludeNames = @()
    )

    $source = Assert-SafeRepoPath -Path (Join-Path $repoRoot $SourceRelative) -Role "Source directory"
    $target = Assert-SafeRepoPath -Path (Join-Path $repoRoot $TargetRelative) -Role "Target directory"

    if (-not (Test-Path -LiteralPath $source)) {
        throw "Missing source directory: $SourceRelative"
    }
    Assert-NoReparseTree -Path $source -Role "Source directory"
    Assert-NoReparseTree -Path $target -Role "Target directory"

    $excluded = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($name in $ExcludeNames) {
        [void]$excluded.Add($name)
    }

    $targetParent = Split-Path -Parent $target
    if ($targetParent) {
        [void](Assert-SafeRepoPath -Path $targetParent -Role "Target parent")
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
    }

    if (-not (Test-Path -LiteralPath $target)) {
        New-Item -ItemType Directory -Path $target -Force | Out-Null
    }
    [void](Assert-SafeRepoPath -Path $target -Role "Target directory")

    $includedItems = @(
        Get-ChildItem -LiteralPath $source -Force -Recurse |
            Where-Object {
                $relativePath = $_.FullName.Substring($source.Length).TrimStart('\', '/')
                $topLevelName = ($relativePath -split '[\\/]')[0]
                -not $excluded.Contains($topLevelName)
            }
    )

    $includedItems |
        Where-Object { $_.PSIsContainer } |
        Sort-Object { $_.FullName.Length } |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($source.Length).TrimStart('\', '/')
            $targetPath = Assert-SafeRepoPath -Path (Join-Path $target $relativePath) -Role "Directory mirror target"
            $existingTarget = $null
            try {
                $existingTarget = Get-Item -Force -LiteralPath $targetPath -ErrorAction Stop
            }
            catch [System.Management.Automation.ItemNotFoundException] {
                $existingTarget = $null
            }
            if ($existingTarget -and (Test-ReparsePoint -Item $existingTarget)) {
                throw "Directory mirror target must not be a reparse point: $targetPath"
            }
            if ($existingTarget -and -not $existingTarget.PSIsContainer) {
                Remove-Item -LiteralPath $targetPath -Force -ErrorAction Stop
            }
            New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
            [void](Assert-SafeRepoPath -Path $targetPath -Role "Directory mirror target")
        }

    $includedItems |
        Where-Object { -not $_.PSIsContainer } |
        ForEach-Object {
            $relativePath = $_.FullName.Substring($source.Length).TrimStart('\', '/')
            $targetPath = Assert-SafeRepoPath -Path (Join-Path $target $relativePath) -Role "Directory mirror file"
            if (Test-Path -LiteralPath $targetPath) {
                $existingTarget = Get-Item -Force -LiteralPath $targetPath
                if (Test-ReparsePoint -Item $existingTarget) {
                    throw "Directory mirror file must not be a reparse point: $targetPath"
                }
                if ($existingTarget.PSIsContainer) {
                    Assert-NoReparseTree -Path $targetPath -Role "Directory mirror file replacement"
                    Remove-Item -LiteralPath $targetPath -Recurse -Force -ErrorAction Stop
                }
            }
            Copy-AtomicFile -Source $_.FullName -Target $targetPath -Role "Directory mirror file"
        }

    Get-ChildItem -LiteralPath $target -Force -Recurse |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object {
            $targetPath = $_.FullName
            $relativePath = $targetPath.Substring($target.Length).TrimStart('\', '/')
            $sourcePath = Join-Path $source $relativePath
            $topLevelName = ($relativePath -split '[\\/]')[0]

            if ($excluded.Contains($topLevelName) -or -not (Test-Path -LiteralPath $sourcePath)) {
                [void](Assert-SafeRepoPath -Path $targetPath -Role "Sync deletion target")
                Remove-Item -LiteralPath $targetPath -Recurse -Force -ErrorAction Stop
                if (Test-Path -LiteralPath $targetPath) {
                    throw "Failed to remove stale runtime mirror path: $targetPath"
                }
            }
        }
}

function Sync-File {
    param(
        [Parameter(Mandatory = $true)][string]$SourceRelative,
        [Parameter(Mandatory = $true)][string]$TargetRelative
    )

    $source = Join-Path $repoRoot $SourceRelative
    $target = Join-Path $repoRoot $TargetRelative
    Copy-AtomicFile -Source $source -Target $target -Role "File mirror target"
}

function ConvertTo-TomlBasicString {
    param([AllowNull()][string]$Value)

    if ($null -eq $Value) {
        $Value = ""
    }

    $escaped = $Value.
        Replace('\', '\\').
        Replace('"', '\"').
        Replace("`r", "").
        Replace("`n", "\n")

    return '"' + $escaped + '"'
}

function ConvertTo-TomlMultilineBasicString {
    param([AllowNull()][string]$Value)

    if ($null -eq $Value) {
        $Value = ""
    }

    $normalized = $Value -replace "`r`n", "`n"
    $normalized = $normalized -replace "`r", "`n"
    $escaped = $normalized.
        Replace('\', '\\').
        Replace('"""', '\"\"\"')

    return '"""' + "`n" + $escaped.TrimEnd("`n") + "`n" + '"""'
}

function Get-FrontmatterField {
    param(
        [Parameter(Mandatory = $true)][string]$Frontmatter,
        [Parameter(Mandatory = $true)][string]$FieldName,
        [Parameter(Mandatory = $true)][string]$SourceRelative
    )

    $fieldPattern = '(?m)^' + [regex]::Escape($FieldName) + ':\s*(?<value>.+?)\s*$'
    if ($Frontmatter -notmatch $fieldPattern) {
        throw "Missing frontmatter field '$FieldName' in $SourceRelative"
    }

    $value = $Matches.value.Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    return $value
}

function Convert-AgentMarkdownToCodexToml {
    param(
        [Parameter(Mandatory = $true)][System.IO.FileInfo]$SourceFile,
        [Parameter(Mandatory = $true)][string]$SourceRoot
    )

    $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $SourceFile.FullName
    $sourceRelative = $SourceFile.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')

    if ($content -notmatch '(?s)^---\s*\r?\n(?<frontmatter>.*?)\r?\n---\s*\r?\n(?<body>.*)$') {
        throw "Agent file must start with YAML frontmatter: agents/$sourceRelative"
    }

    $frontmatter = $Matches.frontmatter
    $body = $Matches.body.TrimStart("`r", "`n")
    $name = Get-FrontmatterField -Frontmatter $frontmatter -FieldName "name" -SourceRelative "agents/$sourceRelative"
    $description = Get-FrontmatterField -Frontmatter $frontmatter -FieldName "description" -SourceRelative "agents/$sourceRelative"

    return @(
        "name = $(ConvertTo-TomlBasicString $name)"
        "description = $(ConvertTo-TomlBasicString $description)"
        "developer_instructions = $(ConvertTo-TomlMultilineBasicString $body)"
        ""
    ) -join "`n"
}

function Test-CodexAgentToml {
    param([Parameter(Mandatory = $true)][string]$Target)

    $python = Resolve-TrustedPython
    if (-not $python) {
        Write-Warning "Trusted Python with tomllib not found; skipped TOML parse check for $Target"
        return
    }

    $previousLocation = Get-Location
    try {
        Set-Location -LiteralPath (Split-Path -Parent $python)
        & $python -I -c "import pathlib, sys, tomllib; tomllib.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))" $Target
        if ($LASTEXITCODE -ne 0) {
            throw "Generated Codex agent TOML failed to parse: $Target"
        }
    }
    finally {
        Set-Location -LiteralPath $previousLocation.Path
    }
}

function Sync-CodexAgents {
    $source = Assert-SafeRepoPath -Path (Join-Path $repoRoot "agents") -Role "Agent source"
    $target = Assert-SafeRepoPath -Path (Join-Path $repoRoot ".codex/agents") -Role "Codex agent target"

    if (-not (Test-Path -LiteralPath $source)) {
        throw "Missing source directory: agents"
    }
    Assert-NoReparseTree -Path $source -Role "Agent source"
    Assert-NoReparseTree -Path $target -Role "Codex agent target"

    New-Item -ItemType Directory -Path $target -Force | Out-Null

    $generatedTargets = New-Object System.Collections.Generic.HashSet[string]

    Get-ChildItem -LiteralPath $source -Filter "*.md" -File |
        Where-Object { $_.Name -ne "INDEX.md" } |
        ForEach-Object {
            $toml = Convert-AgentMarkdownToCodexToml -SourceFile $_ -SourceRoot $source
            $targetFile = Join-Path $target ($_.BaseName + ".toml")
            $context = New-AtomicFileContext -Target $targetFile -Role "Codex agent target"
            try {
                [System.IO.File]::WriteAllText(
                    $context.Temporary,
                    $toml,
                    [System.Text.UTF8Encoding]::new($false)
                )
                Test-CodexAgentToml -Target $context.Temporary
                Complete-AtomicFile -Context $context
            }
            finally {
                Remove-AtomicFileArtifacts -Context $context
            }
            [void]$generatedTargets.Add([System.IO.Path]::GetFullPath($targetFile))
        }

    Get-ChildItem -LiteralPath $target -Filter "*.toml" -File -ErrorAction SilentlyContinue |
        ForEach-Object {
            $targetPath = [System.IO.Path]::GetFullPath($_.FullName)
            if (-not $generatedTargets.Contains($targetPath)) {
                Remove-Item -LiteralPath $_.FullName -Force
            }
        }
}

$directoryMappings = @(
    @{ Source = "skills"; Target = ".agents/skills" },
    @{ Source = "skills"; Target = ".claude/skills" },
    @{ Source = "agents"; Target = ".claude/agents"; ExcludeNames = @("INDEX.md") },
    @{ Source = "hooks"; Target = ".claude/hooks" },
    @{ Source = "feedback/templates"; Target = ".claude/feedback/templates" },
    @{ Source = "codex-hooks"; Target = ".codex/hooks" }
)

$fileMappings = @(
    @{ Source = "EVOLUTION.md"; Target = ".claude/EVOLUTION.md" },
    @{ Source = "settings.json"; Target = ".claude/settings.json" },
    @{ Source = "codex-hooks.json"; Target = ".codex/hooks.json" }
)

try {
    $mutexHeld = $syncMutex.WaitOne([TimeSpan]::FromMinutes(2))
    if (-not $mutexHeld) {
        throw "Timed out waiting for sync-compat lock: $mutexName"
    }

    foreach ($mapping in $directoryMappings) {
        $excludeNames = if ($mapping.ContainsKey("ExcludeNames")) { $mapping.ExcludeNames } else { @() }
        Sync-Directory -SourceRelative $mapping.Source -TargetRelative $mapping.Target -ExcludeNames $excludeNames
    }

    foreach ($mapping in $fileMappings) {
        Sync-File -SourceRelative $mapping.Source -TargetRelative $mapping.Target
    }

    Sync-CodexAgents

    Write-Host "Synced compatibility directories:"
    Write-Host "  - .claude/"
    Write-Host "  - .agents/"
    Write-Host "  - .codex/"
    Write-Host "Generated Codex agent mirror:"
    Write-Host "  - agents/*.md -> .codex/agents/*.toml"
}
finally {
    if ($mutexHeld) {
        $syncMutex.ReleaseMutex() | Out-Null
    }

    $syncMutex.Dispose()
}
