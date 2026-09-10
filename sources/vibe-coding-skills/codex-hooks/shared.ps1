$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Read-HookInputObject {
    param([string]$HookInput)

    if ([string]::IsNullOrWhiteSpace($HookInput)) {
        return $null
    }

    try {
        return $HookInput | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Get-HookValue {
    param(
        $Object,
        [Parameter(Mandatory = $true)][string[]]$Path
    )

    $current = $Object
    foreach ($segment in $Path) {
        if ($null -eq $current) {
            return $null
        }

        $property = $current.PSObject.Properties[$segment]
        if ($null -eq $property) {
            return $null
        }

        $current = $property.Value
    }

    return $current
}

function Test-CodexHookReparsePoint {
    param([Parameter(Mandatory = $true)][System.IO.FileSystemInfo]$Item)

    return ($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
}

function Test-CodexHookPathInsideRoot {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Root
    )

    try {
        $fullPath = [System.IO.Path]::GetFullPath($Path)
        $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
        $comparison = if ($env:OS -eq "Windows_NT") {
            [System.StringComparison]::OrdinalIgnoreCase
        }
        else {
            [System.StringComparison]::Ordinal
        }
        $rootPrefix = $fullRoot + [System.IO.Path]::DirectorySeparatorChar
        return $fullPath.Equals($fullRoot, $comparison) -or $fullPath.StartsWith($rootPrefix, $comparison)
    }
    catch {
        return $false
    }
}

function Test-CodexHookTrustedApplicationPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Root,
        [Parameter(Mandatory = $true)][string]$ExpectedName
    )

    try {
        if (-not [System.IO.Path]::IsPathRooted($Path)) {
            return $false
        }

        $fullPath = [System.IO.Path]::GetFullPath($Path)
        if (-not [System.IO.Path]::GetFileName($fullPath).Equals($ExpectedName, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            return $false
        }
        if (-not [string]::IsNullOrWhiteSpace($Root) -and (Test-CodexHookPathInsideRoot -Path $fullPath -Root $Root)) {
            return $false
        }

        $current = $fullPath
        while (-not [string]::IsNullOrWhiteSpace($current)) {
            $item = Get-Item -Force -LiteralPath $current
            if (Test-CodexHookReparsePoint -Item $item) {
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

function Test-CodexHookTrustedGitPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Root
    )

    $expectedName = if ($env:OS -eq "Windows_NT") { "git.exe" } else { "git" }
    return Test-CodexHookTrustedApplicationPath -Path $Path -Root $Root -ExpectedName $expectedName
}

function Get-CodexHookGitDistributionRoot {
    param([Parameter(Mandatory = $true)][string]$GitPath)

    $gitDirectory = Split-Path -Path $GitPath -Parent
    if ($env:OS -ne "Windows_NT") {
        return Split-Path -Path $gitDirectory -Parent
    }

    $gitDirectoryName = Split-Path -Path $gitDirectory -Leaf
    $gitContainer = Split-Path -Path $gitDirectory -Parent
    if ($gitDirectoryName -eq "bin" -and (Split-Path -Path $gitContainer -Leaf) -in @("mingw64", "usr")) {
        return Split-Path -Path $gitContainer -Parent
    }
    if ($gitDirectoryName -in @("bin", "cmd")) {
        return $gitContainer
    }

    return ""
}

function Test-CodexHookTrustedGitDistribution {
    param(
        [Parameter(Mandatory = $true)][string]$GitPath,
        [string]$Root
    )

    if ($env:OS -ne "Windows_NT") {
        return $true
    }

    $gitRoot = Get-CodexHookGitDistributionRoot -GitPath $GitPath
    if ([string]::IsNullOrWhiteSpace($gitRoot)) {
        return $false
    }

    return Test-CodexHookTrustedApplicationPath -Path (Join-Path $gitRoot "bin\\bash.exe") -Root $Root -ExpectedName "bash.exe"
}

function Get-TrustedGitCommand {
    param([string]$Root)

    foreach ($candidate in @(Get-Command git -All -CommandType Application -ErrorAction SilentlyContinue)) {
        if ([string]::IsNullOrWhiteSpace([string]$candidate.Source)) {
            continue
        }
        if ((Test-CodexHookTrustedGitPath -Path $candidate.Source -Root $Root) -and
            (Test-CodexHookTrustedGitDistribution -GitPath $candidate.Source -Root $Root)) {
            return $candidate
        }
    }

    return $null
}

function Invoke-CodexHookTrustedGit {
    param(
        [Parameter(Mandatory = $true)]$Git,
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string[]]$GitArgs
    )

    if ([string]::IsNullOrWhiteSpace([string]$Git.Source) -or $GitArgs.Count -eq 0) {
        $global:LASTEXITCODE = 127
        return
    }

    $trustedArgs = @("--no-pager", "-c", "core.fsmonitor=false", "-C", $Root)
    if ($GitArgs[0] -eq "diff") {
        $trustedArgs += "diff"
        if ($GitArgs -notcontains "--no-ext-diff") {
            $trustedArgs += "--no-ext-diff"
        }
        if ($GitArgs -notcontains "--no-textconv") {
            $trustedArgs += "--no-textconv"
        }
        if ($GitArgs.Count -gt 1) {
            $trustedArgs += $GitArgs[1..($GitArgs.Count - 1)]
        }
    }
    else {
        $trustedArgs += $GitArgs
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $Git.Source @trustedArgs
        $gitExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    $global:LASTEXITCODE = $gitExitCode
}

function Get-TrustedGitBashPath {
    param([string]$Root)

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git -or [string]::IsNullOrWhiteSpace([string]$git.Source)) {
        return ""
    }

    $gitRoot = Get-CodexHookGitDistributionRoot -GitPath $git.Source
    if ([string]::IsNullOrWhiteSpace($gitRoot)) {
        return ""
    }

    $expectedName = if ($env:OS -eq "Windows_NT") { "bash.exe" } else { "bash" }
    foreach ($candidate in @(
        (Join-Path $gitRoot "bin\$expectedName"),
        (Join-Path $gitRoot "usr\bin\$expectedName")
    )) {
        if (Test-CodexHookTrustedApplicationPath -Path $candidate -Root $Root -ExpectedName $expectedName) {
            return $candidate
        }
    }

    return ""
}

function Get-RepoRoot {
    param([string]$StartPath)

    $path = if ([string]::IsNullOrWhiteSpace($StartPath)) {
        (Get-Location).Path
    }
    else {
        $StartPath
    }

    if ([string]::IsNullOrWhiteSpace($path)) {
        return $null
    }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $path = Split-Path -Path $path -Parent
    }

    if (-not (Test-Path -LiteralPath $path)) {
        return $null
    }

    try {
        $current = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $path).Path)
    }
    catch {
        return $null
    }

    while (-not [string]::IsNullOrWhiteSpace($current)) {
        if (Test-Path -LiteralPath (Join-Path $current ".git")) {
            return $current
        }

        $parent = Split-Path -Parent $current
        if ([string]::IsNullOrWhiteSpace($parent) -or $parent -eq $current) {
            break
        }
        $current = $parent
    }

    return $null
}

. (Join-Path $PSScriptRoot "shared-paths.ps1")
. (Join-Path $PSScriptRoot "shared-changes.ps1")
. (Join-Path $PSScriptRoot "shared-docs.ps1")
