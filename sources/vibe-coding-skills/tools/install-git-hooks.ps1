[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$hookPath = Join-Path $repoRoot ".githooks"
$preCommitPath = Join-Path $hookPath "pre-commit"

function Get-UsableBashPath {
    $candidatePaths = New-Object System.Collections.Generic.List[string]

    foreach ($command in (Get-Command bash -All -ErrorAction SilentlyContinue)) {
        if (-not [string]::IsNullOrWhiteSpace($command.Source)) {
            $candidatePaths.Add($command.Source)
        }
    }

    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git -and -not [string]::IsNullOrWhiteSpace($git.Source)) {
        $gitRoot = Split-Path -Path (Split-Path -Path $git.Source -Parent) -Parent
        if (-not [string]::IsNullOrWhiteSpace($gitRoot)) {
            $candidatePaths.Add((Join-Path $gitRoot "bin\bash.exe"))
            $candidatePaths.Add((Join-Path $gitRoot "usr\bin\bash.exe"))
        }
    }

    foreach ($candidate in ($candidatePaths | Select-Object -Unique)) {
        if ([string]::IsNullOrWhiteSpace($candidate) -or -not (Test-Path -LiteralPath $candidate)) {
            continue
        }

        & $candidate -lc "exit 0" *> $null
        if ($LASTEXITCODE -eq 0) {
            return $candidate
        }
    }

    return ""
}

if (-not (Test-Path $preCommitPath)) {
    throw "Missing hook file: $preCommitPath"
}

cmd /c "git -C ""$repoRoot"" rev-parse --git-dir >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
    throw "Git hooks need a Git repository. Run git init first or use the package inside a cloned repo, then rerun this script."
}

cmd /c "git -C ""$repoRoot"" rev-parse --verify HEAD >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
    throw "Git hooks should be installed after the first baseline commit. Commit the imported package once, then rerun this script."
}

$bashPath = Get-UsableBashPath
if ([string]::IsNullOrWhiteSpace($bashPath)) {
    throw "Git hooks in this package rely on a usable Git Bash. Install Git Bash, then rerun this script."
}

git -C $repoRoot config core.hooksPath .githooks
if ($LASTEXITCODE -ne 0) {
    throw "Failed to set core.hooksPath."
}

$installed = git -C $repoRoot config --get core.hooksPath
Write-Host "Git hooks installed."
Write-Host "core.hooksPath = $installed"
Write-Host "usable bash = $bashPath"
