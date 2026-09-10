[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

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

Write-Host "Step 1/2: syncing compatibility directories..."
& (Join-Path $scriptDir "sync-compat.ps1")

cmd /c "git -C ""$repoRoot"" rev-parse --git-dir >nul 2>nul"
$hasGitRepo = $LASTEXITCODE -eq 0
$bashPath = Get-UsableBashPath

if (-not $hasGitRepo) {
    Write-Host "Step 2/2: skipping Git hooks because the folder is not a Git repository."
    Write-Host "If you later run git init or place the package inside a cloned repo, rerun tools\install-git-hooks.ps1."
}
else {
    cmd /c "git -C ""$repoRoot"" rev-parse --verify HEAD >nul 2>nul"
    $hasBaselineCommit = $LASTEXITCODE -eq 0

    if (-not $hasBaselineCommit) {
        Write-Host "Step 2/2: skipping Git hooks because this Git repository has no baseline commit yet."
        Write-Host "Commit the imported package once, then rerun tools\install-git-hooks.ps1."
    }
    elseif ([string]::IsNullOrWhiteSpace($bashPath)) {
        Write-Host "Step 2/2: skipping Git hooks because a usable Git Bash was not found."
        Write-Host "Install Git Bash and rerun tools\install-git-hooks.ps1 if you want repo-level hooks."
    }
    else {
        Write-Host "Step 2/2: installing repo Git hooks with Bash: $bashPath"
        & (Join-Path $scriptDir "install-git-hooks.ps1")
    }
}

Write-Host "Repository setup complete."
