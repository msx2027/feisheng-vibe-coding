[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $toolsDir))
$hooksConfigPath = Join-Path $repoRoot "codex-hooks.json"
$hooksSourceDir = Join-Path $repoRoot "codex-hooks"
$realPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$realGit = Get-Command git -All -CommandType Application -ErrorAction Stop |
    Where-Object { $_.Source -and [System.IO.Path]::GetExtension($_.Source) -eq ".exe" } |
    Select-Object -First 1

if (-not $realGit) {
    throw "A real git.exe is required for the Codex hook trust regression test."
}
if (-not (Test-Path -LiteralPath $realPowerShell -PathType Leaf)) {
    throw "A system PowerShell executable is required for the Codex hook trust regression test."
}

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function New-FakeGitExecutable {
    param([Parameter(Mandatory = $true)][string]$Path)

    $source = @'
using System;
using System.IO;
using System.Linq;

public static class FakeGitProgram
{
    public static int Main(string[] args)
    {
        var marker = Environment.GetEnvironmentVariable("FAKE_GIT_MARKER");
        if (!String.IsNullOrWhiteSpace(marker))
        {
            File.AppendAllText(marker, String.Join(" ", args) + Environment.NewLine);
        }

        if (args.Any(arg => arg == "--show-toplevel"))
        {
            Console.WriteLine(Environment.GetEnvironmentVariable("FAKE_GIT_REPO_ROOT"));
        }
        else if (args.Any(arg => arg == "--git-dir"))
        {
            Console.WriteLine(".git");
        }

        return 0;
    }
}
'@

    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $Path -OutputType ConsoleApplication
}

function New-FailingTrustedGitExecutable {
    param([Parameter(Mandatory = $true)][string]$Path)

    $source = @'
using System;
using System.Linq;

public static class FailingTrustedGitProgram
{
    public static int Main(string[] args)
    {
        var failedCommand = Environment.GetEnvironmentVariable("FAKE_GIT_FAIL_COMMAND");
        if (!String.IsNullOrWhiteSpace(failedCommand) && args.Any(arg => arg == failedCommand))
        {
            Console.Error.WriteLine("Injected trusted Git failure for " + failedCommand);
            return 86;
        }

        if (args.Any(arg => arg == "--show-toplevel"))
        {
            Console.WriteLine(Environment.GetEnvironmentVariable("FAKE_GIT_REPO_ROOT"));
        }
        else if (args.Any(arg => arg == "--git-dir"))
        {
            Console.WriteLine(".git");
        }

        return 0;
    }
}
'@
    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $Path -OutputType ConsoleApplication
}

function New-FakeBashExecutable {
    param([Parameter(Mandatory = $true)][string]$Path)

    $source = @'
using System;
using System.IO;
using System.Linq;

public static class FakeBashProgram
{
    public static int Main(string[] args)
    {
        var marker = Environment.GetEnvironmentVariable("FAKE_BASH_MARKER");
        if (!String.IsNullOrWhiteSpace(marker))
        {
            File.AppendAllText(marker, String.Join(" ", args) + Environment.NewLine);
        }

        return 0;
    }
}
'@

    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $Path -OutputType ConsoleApplication
}

function New-FakeFsMonitorExecutable {
    param([Parameter(Mandatory = $true)][string]$Path)

    $source = @'
using System;
using System.IO;
using System.Linq;

public static class FakeFsMonitorProgram
{
    public static int Main(string[] args)
    {
        var marker = Environment.GetEnvironmentVariable("FAKE_GIT_CONFIG_MARKER");
        if (!String.IsNullOrWhiteSpace(marker))
        {
            File.AppendAllText(marker, String.Join(" ", args) + Environment.NewLine);
        }

        Console.WriteLine("fixture-token");
        return 0;
    }
}
'@

    Add-Type -TypeDefinition $source -Language CSharp -OutputAssembly $Path -OutputType ConsoleApplication
}

function New-FixtureRepo {
    param([Parameter(Mandatory = $true)][string]$Root)

    New-Item -ItemType Directory -Path $Root -Force | Out-Null
    & $realGit.Source -C $Root init --quiet
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to initialize fixture repository: $Root"
    }
    & $realGit.Source -C $Root config core.autocrlf true
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to configure fixture line endings."
    }

    $runnerPath = Join-Path $Root ".codex\hooks\run-hook.ps1"
    Write-Utf8File -Path $runnerPath -Content @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Hook,
    [string]$HookInput = ""
)

[System.IO.File]::AppendAllText($env:HOOK_RUNNER_MARKER, $Hook + [Environment]::NewLine)
exit 0
'@
    Write-Utf8File -Path (Join-Path $Root "tools\pre-commit-gate.sh") -Content @'
#!/usr/bin/env bash
exit 0
'@
    $fsMonitorPath = Join-Path $Root "fake-fsmonitor.exe"
    New-FakeFsMonitorExecutable -Path $fsMonitorPath
    & $realGit.Source -C $Root config core.fsmonitor "./fake-fsmonitor.exe"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to configure fixture core.fsmonitor hook."
    }
    $probePath = Join-Path $Root "probe.txt"
    Write-Utf8File -Path $probePath -Content "staged probe`n"
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $addOutput = @(& $realGit.Source -C $Root add probe.txt 2>&1)
        $addStatus = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($addStatus -ne 0) {
        throw "Failed to stage fixture Git config probe."
    }
    if (($addOutput | Out-String) -notmatch "LF will be replaced by CRLF") {
        throw "Fixture did not reproduce the expected Git CRLF warning."
    }

    Write-Utf8File -Path $probePath -Content "staged probe`nunstaged probe`n"
    Write-Utf8File -Path (Join-Path $Root "codex-hooks\fixture.ps1") -Content "Write-Output 'hook fixture'`n"
}

function Get-BootstrapCommands {
    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $hooksConfigPath | ConvertFrom-Json
    $commands = New-Object System.Collections.Generic.List[string]
    foreach ($eventProperty in $config.hooks.PSObject.Properties) {
        foreach ($group in @($eventProperty.Value)) {
            foreach ($hook in @($group.hooks)) {
                if ($hook.type -eq "command") {
                    $commands.Add([string]$hook.command)
                }
            }
        }
    }
    return @($commands)
}

function Invoke-BootstrapTrustScenario {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FixtureRoot,
        [Parameter(Mandatory = $true)][string]$PoisonedPathEntry,
        [Parameter(Mandatory = $true)][string[]]$Commands,
        [Parameter(Mandatory = $true)][string]$ScenarioRoot
    )

    $fakeMarker = Join-Path $ScenarioRoot "$Name-bootstrap-fake-git.txt"
    $runnerMarker = Join-Path $ScenarioRoot "$Name-bootstrap-runner.txt"
    $previousPath = $env:PATH
    $previousFakeMarker = $env:FAKE_GIT_MARKER
    $previousFakeRoot = $env:FAKE_GIT_REPO_ROOT
    $previousRunnerMarker = $env:HOOK_RUNNER_MARKER

    try {
        $env:PATH = "$PoisonedPathEntry$([System.IO.Path]::PathSeparator)$previousPath"
        $env:FAKE_GIT_MARKER = $fakeMarker
        $env:FAKE_GIT_REPO_ROOT = $FixtureRoot
        $env:HOOK_RUNNER_MARKER = $runnerMarker

        Push-Location -LiteralPath $FixtureRoot
        try {
            foreach ($command in $Commands) {
                & "$env:SystemRoot\System32\cmd.exe" /d /s /c $command | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    throw "Codex hook bootstrap failed in scenario '$Name' with exit code $LASTEXITCODE."
                }
            }
        }
        finally {
            Pop-Location
        }

        if (Test-Path -LiteralPath $fakeMarker) {
            $calls = Get-Content -Raw -Encoding UTF8 -LiteralPath $fakeMarker
            throw "Codex hook bootstrap executed fake Git in scenario '$Name': $calls"
        }

        $runnerCalls = if (Test-Path -LiteralPath $runnerMarker) {
            @(Get-Content -Encoding UTF8 -LiteralPath $runnerMarker)
        }
        else {
            @()
        }
        if ($runnerCalls.Count -ne $Commands.Count) {
            throw "Codex hook bootstrap did not preserve runner dispatch in scenario '$Name': expected $($Commands.Count), got $($runnerCalls.Count)."
        }
    }
    finally {
        $env:PATH = $previousPath
        $env:FAKE_GIT_MARKER = $previousFakeMarker
        $env:FAKE_GIT_REPO_ROOT = $previousFakeRoot
        $env:HOOK_RUNNER_MARKER = $previousRunnerMarker
    }
}

function Invoke-RuntimeTrustScenario {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FixtureRoot,
        [Parameter(Mandatory = $true)][string]$PoisonedPathEntry,
        [Parameter(Mandatory = $true)][string]$ScenarioRoot
    )

    $fakeMarker = Join-Path $ScenarioRoot "$Name-runtime-fake-git.txt"
    $fakeBashMarker = Join-Path $ScenarioRoot "$Name-runtime-fake-bash.txt"
    $fakeGitConfigMarker = Join-Path $ScenarioRoot "$Name-runtime-fake-git-config.txt"
    $probePath = Join-Path $ScenarioRoot "$Name-runtime-probe.ps1"
    $entrypointProbePath = Join-Path $ScenarioRoot "$Name-runtime-entrypoint.ps1"
    $sharedPath = Join-Path $hooksSourceDir "shared.ps1"
    $stopGatePath = Join-Path $hooksSourceDir "stop-gate.ps1"
    $preCommitPath = Join-Path $hooksSourceDir "pre-commit-check.ps1"
    Write-Utf8File -Path $probePath -Content @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SharedPath,
    [Parameter(Mandatory = $true)][string]$FixtureRoot
)

. $SharedPath
$resolvedRoot = Get-RepoRoot $FixtureRoot
if ([string]::IsNullOrWhiteSpace($resolvedRoot) -or
    [System.IO.Path]::GetFullPath($resolvedRoot) -ne [System.IO.Path]::GetFullPath($FixtureRoot)) {
    throw "Repository marker walk did not resolve the fixture root."
}

$git = Get-TrustedGitCommand -Root $resolvedRoot
if (-not $git) {
    throw "No trusted Git command was resolved."
}

Invoke-CodexHookTrustedGit -Git $git -Root $resolvedRoot -GitArgs @("rev-parse", "--git-dir") *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Trusted Git command could not inspect the fixture repository."
}

$diff = Invoke-CodexHookTrustedGit -Git $git -Root $resolvedRoot -GitArgs @("diff", "--cached", "--name-status")
if ($LASTEXITCODE -ne 0) {
    throw "Trusted Git wrapper could not inspect the fixture index."
}

Invoke-CodexHookTrustedGit -Git $git -Root $resolvedRoot -GitArgs @("definitely-not-a-git-command") 2>$null
if ($LASTEXITCODE -eq 0) {
    throw "Trusted Git wrapper hid a real Git command failure."
}

Write-Output $git.Source
'@
    Write-Utf8File -Path $entrypointProbePath -Content @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$HookPath,
    [Parameter(Mandatory = $true)][string]$HookInputBase64
)

$hookInput = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($HookInputBase64))
& $HookPath -HookInput $hookInput
exit $LASTEXITCODE
'@

    $previousPath = $env:PATH
    $previousFakeMarker = $env:FAKE_GIT_MARKER
    $previousFakeRoot = $env:FAKE_GIT_REPO_ROOT
    $previousFakeBashMarker = $env:FAKE_BASH_MARKER
    $previousFakeGitConfigMarker = $env:FAKE_GIT_CONFIG_MARKER
    try {
        $env:PATH = "$PoisonedPathEntry$([System.IO.Path]::PathSeparator)$previousPath"
        $env:FAKE_GIT_MARKER = $fakeMarker
        $env:FAKE_GIT_REPO_ROOT = $FixtureRoot
        $env:FAKE_BASH_MARKER = $fakeBashMarker
        $env:FAKE_GIT_CONFIG_MARKER = $fakeGitConfigMarker

        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & $realGit.Source -C $FixtureRoot diff --cached --name-status 2>$null | Out-Null
            $directConfigStatus = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($directConfigStatus -ne 0 -or -not (Test-Path -LiteralPath $fakeGitConfigMarker)) {
            throw "Git config regression fixture did not reproduce target core.fsmonitor execution in scenario '$Name'."
        }
        Remove-Item -LiteralPath $fakeGitConfigMarker -Force

        Push-Location -LiteralPath $FixtureRoot
        try {
            $probeOutput = & $realPowerShell -NoProfile -ExecutionPolicy Bypass -File $probePath -SharedPath $sharedPath -FixtureRoot $FixtureRoot
            if ($LASTEXITCODE -ne 0) {
                throw "Trusted Git runtime probe failed in scenario '$Name' with exit code $LASTEXITCODE."
            }
            if (@($probeOutput).Count -eq 0) {
                throw "Trusted Git runtime probe returned no executable in scenario '$Name'."
            }
            if (Test-Path -LiteralPath $fakeMarker) {
                $calls = Get-Content -Raw -Encoding UTF8 -LiteralPath $fakeMarker
                throw "Codex hook runtime probe executed fake Git in scenario '$Name': $calls"
            }
            if (Test-Path -LiteralPath $fakeGitConfigMarker) {
                $calls = Get-Content -Raw -Encoding UTF8 -LiteralPath $fakeGitConfigMarker
                throw "Codex hook runtime probe honored target Git config in scenario '$Name': $calls"
            }

            $stopInput = @{ cwd = $FixtureRoot } | ConvertTo-Json -Compress
            $stopInputBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($stopInput))
            $stopOutput = @(& $realPowerShell -NoProfile -ExecutionPolicy Bypass -File $entrypointProbePath -HookPath $stopGatePath -HookInputBase64 $stopInputBase64)
            if ($LASTEXITCODE -ne 0) {
                throw "stop-gate.ps1 failed in scenario '$Name' with exit code $LASTEXITCODE."
            }
            if ($stopOutput.Count -ne 1) {
                throw "stop-gate.ps1 did not return one structured result in scenario '$Name': $($stopOutput -join ' | ')"
            }
            try {
                $stopResult = $stopOutput[0] | ConvertFrom-Json
            }
            catch {
                throw "stop-gate.ps1 returned invalid JSON in scenario '$Name': $($stopOutput[0])"
            }
            if ($stopResult.decision -ne "block") {
                throw "stop-gate.ps1 did not preserve the strict-source block decision in scenario '$Name': $($stopOutput[0])"
            }

            $preCommitInput = @{
                cwd = $FixtureRoot
                tool_input = @{ command = "git commit -m trust-regression" }
            } | ConvertTo-Json -Compress
            $preCommitInputBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($preCommitInput))
            & $realPowerShell -NoProfile -ExecutionPolicy Bypass -File $entrypointProbePath -HookPath $preCommitPath -HookInputBase64 $preCommitInputBase64 | Out-Null
            if ($LASTEXITCODE -notin @(0, 2)) {
                throw "pre-commit-check.ps1 returned an unexpected exit code in scenario '$Name': $LASTEXITCODE."
            }
        }
        finally {
            Pop-Location
        }

        if (Test-Path -LiteralPath $fakeMarker) {
            $calls = Get-Content -Raw -Encoding UTF8 -LiteralPath $fakeMarker
            throw "Codex hook PowerShell runtime executed fake Git in scenario '$Name': $calls"
        }
        if (Test-Path -LiteralPath $fakeBashMarker) {
            $calls = Get-Content -Raw -Encoding UTF8 -LiteralPath $fakeBashMarker
            throw "Codex hook PowerShell runtime executed fake Bash in scenario '$Name': $calls"
        }
        if (Test-Path -LiteralPath $fakeGitConfigMarker) {
            $calls = Get-Content -Raw -Encoding UTF8 -LiteralPath $fakeGitConfigMarker
            throw "Codex hook PowerShell runtime honored target Git config in scenario '$Name': $calls"
        }
    }
    finally {
        $env:PATH = $previousPath
        $env:FAKE_GIT_MARKER = $previousFakeMarker
        $env:FAKE_GIT_REPO_ROOT = $previousFakeRoot
        $env:FAKE_BASH_MARKER = $previousFakeBashMarker
        $env:FAKE_GIT_CONFIG_MARKER = $previousFakeGitConfigMarker
    }
}

function Invoke-StopGateEnumerationFailureScenario {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$FixtureRoot,
        [Parameter(Mandatory = $true)][string]$TrustedGitCommandDirectory,
        [Parameter(Mandatory = $true)][string]$ScenarioRoot,
        [Parameter(Mandatory = $true)][ValidateSet("diff", "ls-files")][string]$FailCommand
    )

    $stopGatePath = Join-Path $hooksSourceDir "stop-gate.ps1"
    $entrypointProbePath = Join-Path $ScenarioRoot "$Name-stop-gate-failure-entrypoint.ps1"
    $markerPath = Join-Path $FixtureRoot ".claude\.needs-review"
    Write-Utf8File -Path $entrypointProbePath -Content @'
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$HookPath,
    [Parameter(Mandatory = $true)][string]$HookInputBase64
)

$hookInput = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($HookInputBase64))
& $HookPath -HookInput $hookInput
exit $LASTEXITCODE
'@
    Write-Utf8File -Path $markerPath -Content "clean`n"

    $previousPath = $env:PATH
    $previousFakeRoot = $env:FAKE_GIT_REPO_ROOT
    $previousFailedCommand = $env:FAKE_GIT_FAIL_COMMAND
    try {
        $env:PATH = "$TrustedGitCommandDirectory$([System.IO.Path]::PathSeparator)$previousPath"
        $env:FAKE_GIT_REPO_ROOT = $FixtureRoot
        $env:FAKE_GIT_FAIL_COMMAND = $FailCommand

        $stopInput = @{ cwd = $FixtureRoot } | ConvertTo-Json -Compress
        $stopInputBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($stopInput))
        $stopOutput = @(& $realPowerShell -NoProfile -ExecutionPolicy Bypass -File $entrypointProbePath -HookPath $stopGatePath -HookInputBase64 $stopInputBase64)
        if ($LASTEXITCODE -ne 0) {
            throw "stop-gate.ps1 did not fail closed for injected $FailCommand failure in scenario '$Name': exit code $LASTEXITCODE."
        }
        if ($stopOutput.Count -ne 1) {
            throw "stop-gate.ps1 did not return one structured block for injected $FailCommand failure in scenario '$Name': $($stopOutput -join ' | ')"
        }
        try {
            $stopResult = $stopOutput[0] | ConvertFrom-Json
        }
        catch {
            throw "stop-gate.ps1 returned invalid JSON for injected $FailCommand failure in scenario '$Name': $($stopOutput[0])"
        }
        if ($stopResult.decision -ne "block" -or [string]$stopResult.reason -notmatch "could not be recomputed") {
            throw "stop-gate.ps1 did not report a Git recomputation block for injected $FailCommand failure in scenario '$Name': $($stopOutput[0])"
        }
        if (-not (Test-Path -LiteralPath $markerPath)) {
            throw "stop-gate.ps1 cleared review state after injected $FailCommand failure in scenario '$Name'."
        }
    }
    finally {
        $env:PATH = $previousPath
        $env:FAKE_GIT_REPO_ROOT = $previousFakeRoot
        $env:FAKE_GIT_FAIL_COMMAND = $previousFailedCommand
    }
}

$tmpRoot = Join-Path $env:TEMP ("codex-hook-git-trust-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmpRoot | Out-Null

try {
    $outsideFakeBin = Join-Path $tmpRoot "outside-fake-bin"
    New-Item -ItemType Directory -Path $outsideFakeBin | Out-Null
    $outsideFakeGit = Join-Path $outsideFakeBin "git.exe"
    New-FakeGitExecutable -Path $outsideFakeGit
    $outsideFakeBash = Join-Path $outsideFakeBin "bash.exe"
    New-FakeBashExecutable -Path $outsideFakeBash

    $failingTrustedGitRoot = Join-Path $tmpRoot "failing-trusted-git"
    $failingTrustedGitCommandDirectory = Join-Path $failingTrustedGitRoot "cmd"
    $failingTrustedGitBashDirectory = Join-Path $failingTrustedGitRoot "bin"
    New-Item -ItemType Directory -Path $failingTrustedGitCommandDirectory, $failingTrustedGitBashDirectory | Out-Null
    New-FailingTrustedGitExecutable -Path (Join-Path $failingTrustedGitCommandDirectory "git.exe")
    Copy-Item -LiteralPath $outsideFakeBash -Destination (Join-Path $failingTrustedGitBashDirectory "bash.exe")

    $directRepo = Join-Path $tmpRoot "direct-repo"
    New-FixtureRepo -Root $directRepo
    Copy-Item -LiteralPath $outsideFakeGit -Destination (Join-Path $directRepo "git.exe")
    Copy-Item -LiteralPath $outsideFakeBash -Destination (Join-Path $directRepo "bash.exe")

    $junctionRepo = Join-Path $tmpRoot "junction-repo"
    New-FixtureRepo -Root $junctionRepo
    $junctionPath = Join-Path $tmpRoot "poisoned-path-junction"
    New-Item -ItemType Junction -Path $junctionPath -Target $outsideFakeBin | Out-Null

    $ordinaryPathRepo = Join-Path $tmpRoot "ordinary-path-repo"
    New-FixtureRepo -Root $ordinaryPathRepo

    $bootstrapCommands = @(Get-BootstrapCommands)
    if ($bootstrapCommands.Count -eq 0) {
        throw "No Codex hook bootstrap commands were found."
    }

    Invoke-BootstrapTrustScenario -Name "repo-local" -FixtureRoot $directRepo -PoisonedPathEntry $directRepo -Commands $bootstrapCommands -ScenarioRoot $tmpRoot
    Invoke-BootstrapTrustScenario -Name "path-ordinary" -FixtureRoot $ordinaryPathRepo -PoisonedPathEntry $outsideFakeBin -Commands $bootstrapCommands -ScenarioRoot $tmpRoot
    Invoke-BootstrapTrustScenario -Name "path-junction" -FixtureRoot $junctionRepo -PoisonedPathEntry $junctionPath -Commands $bootstrapCommands -ScenarioRoot $tmpRoot
    Invoke-RuntimeTrustScenario -Name "repo-local" -FixtureRoot $directRepo -PoisonedPathEntry $directRepo -ScenarioRoot $tmpRoot
    Invoke-RuntimeTrustScenario -Name "path-ordinary" -FixtureRoot $ordinaryPathRepo -PoisonedPathEntry $outsideFakeBin -ScenarioRoot $tmpRoot
    Invoke-RuntimeTrustScenario -Name "path-junction" -FixtureRoot $junctionRepo -PoisonedPathEntry $junctionPath -ScenarioRoot $tmpRoot
    Invoke-StopGateEnumerationFailureScenario -Name "trusted-git-diff-failure" -FixtureRoot $ordinaryPathRepo -TrustedGitCommandDirectory $failingTrustedGitCommandDirectory -ScenarioRoot $tmpRoot -FailCommand "diff"
    Invoke-StopGateEnumerationFailureScenario -Name "trusted-git-untracked-failure" -FixtureRoot $ordinaryPathRepo -TrustedGitCommandDirectory $failingTrustedGitCommandDirectory -ScenarioRoot $tmpRoot -FailCommand "ls-files"

    $unsafeBootstrap = Select-String -LiteralPath $hooksConfigPath -Pattern 'Get-Command\s+git' -AllMatches
    if ($unsafeBootstrap) {
        throw "codex-hooks.json still resolves Git from ambient command lookup."
    }

    $runtimeFiles = Get-ChildItem -LiteralPath $hooksSourceDir -Filter "*.ps1" -File
    $unsafeRuntime = @($runtimeFiles |
        Where-Object { $_.Name -ne "shared.ps1" } |
        Select-String -Pattern 'Get-Command\s+git')
    if ($unsafeRuntime.Count -gt 0) {
        throw "Codex hook runtime still contains direct Git lookup: $($unsafeRuntime.Path -join ', ')"
    }
    $unsafeBashRuntime = @($runtimeFiles | Select-String -Pattern 'Get-Command\s+bash')
    if ($unsafeBashRuntime.Count -gt 0) {
        throw "Codex hook runtime still contains ambient Bash lookup: $($unsafeBashRuntime.Path -join ', ')"
    }

    $trustedLookup = @(Select-String -LiteralPath (Join-Path $hooksSourceDir "shared.ps1") -Pattern 'Get-Command\s+git.*-All.*-CommandType\s+Application')
    if ($trustedLookup.Count -ne 1) {
        throw "shared.ps1 must contain exactly one centralized application-only Git candidate lookup."
    }

    Write-Host "PASS: Codex hook bootstrap and PowerShell runtime reject repo-local, ordinary PATH, and PATH-junction fake Git/Bash while preserving trusted dispatch."
}
finally {
    Remove-Item -LiteralPath $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}
