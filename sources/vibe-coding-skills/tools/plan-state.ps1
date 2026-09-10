[CmdletBinding()]
param(
    [ValidateSet("show", "start", "checkpoint", "done", "blocked", "clear")]
    [string]$Action = "show",
    [string]$Root = ".",
    [string]$StateFile = "plans/CURRENT-EXECUTION.md",
    [string]$Phase,
    [string]$TaskId,
    [string]$TaskTitle,
    [string]$PlanFile,
    [string]$Checkpoint,
    [string]$NextStep,
    [string[]]$TouchedFiles,
    [switch]$Json
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$currentExecutionHelperPath = Join-Path $PSScriptRoot "current-execution-template-helpers.ps1"
if (-not (Test-Path -LiteralPath $currentExecutionHelperPath -PathType Leaf)) {
    throw ("Missing required helper: {0}" -f $currentExecutionHelperPath)
}
. $currentExecutionHelperPath

function Normalize-RelativePath {
    param([string]$Path)

    return (Normalize-PlanContractRelativePath $Path)
}

function Get-StatePath {
    param(
        [string]$RootPath,
        [string]$RelativePath,
        [string]$ArgumentName = "StateFile"
    )

    if ([string]::IsNullOrWhiteSpace($RelativePath)) {
        throw "Missing required value: $ArgumentName"
    }

    $candidatePath = if ([System.IO.Path]::IsPathRooted($RelativePath)) {
        [System.IO.Path]::GetFullPath($RelativePath)
    }
    else {
        $relative = Normalize-RelativePath $RelativePath
        [System.IO.Path]::GetFullPath((Join-Path $RootPath ($relative -replace "/", "\")))
    }

    $fullRootPath = [System.IO.Path]::GetFullPath($RootPath)
    $rootPrefix = if ($fullRootPath.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $fullRootPath
    }
    else {
        $fullRootPath + [System.IO.Path]::DirectorySeparatorChar
    }

    if (
        $candidatePath -ne $fullRootPath -and
        -not $candidatePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        throw "$ArgumentName must stay within the repository root."
    }

    return $candidatePath
}

function Ensure-ParentDirectory {
    param([string]$Path)

    $directory = Split-Path -Parent $Path
    if ($directory) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
}

function Write-FileUtf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    Ensure-ParentDirectory -Path $Path

    # Atomic write: write a temp file in the same directory, then atomically
    # rename it over the target. Prevents WriteAllText from truncating the state
    # file to empty/partial content if the process is killed mid-write (data loss).
    # The temp file shares the target directory so the rename is a same-volume
    # atomic operation rather than a cross-volume copy.
    # Write the full content to a temp file first, then move it over the target.
    # Because the temp file is fully written before the move, the target is never
    # observed as empty/truncated even if the process dies mid-write. Move-Item
    # -Force performs a same-directory rename-with-overwrite (the same approach
    # already used by plan-hygiene.ps1), which is more portable across PowerShell
    # versions than [System.IO.File]::Replace.
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $directory = [System.IO.Path]::GetDirectoryName($fullPath)
    $tempPath = [System.IO.Path]::Combine($directory, [System.IO.Path]::GetRandomFileName() + ".tmp")
    $encoding = [System.Text.UTF8Encoding]::new($false)
    try {
        [System.IO.File]::WriteAllText($tempPath, $Content, $encoding)
        Move-Item -LiteralPath $tempPath -Destination $fullPath -Force
    }
    finally {
        if (Test-Path -LiteralPath $tempPath) {
            Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Read-State {
    param([string]$Path)

    $default = [ordered]@{
        Status           = "idle"
        CurrentPhase     = ""
        CurrentTaskId    = ""
        CurrentTaskTitle = ""
        SourcePlanFile   = ""
        LastCheckpoint   = ""
        ResumeNextStep   = ""
        TouchedFiles     = ""
        LastUpdated      = ""
    }

    return (Read-CurrentExecutionFieldState -Path $Path -ToolsScriptRoot $PSScriptRoot -DefaultState $default)
}

function Render-StateContent {
    param([System.Collections.IDictionary]$State)

    $template = Get-CurrentExecutionTemplateModel -ToolsScriptRoot $PSScriptRoot
    $content = $template.content

    foreach ($field in $template.fields) {
        $value = if ($State.Contains($field.stateKey)) { [string]$State[$field.stateKey] } else { "" }
        $content = $content.Replace($field.placeholder, $value)
    }

    return $content
}

function Write-State {
    param(
        [string]$Path,
        [System.Collections.IDictionary]$State
    )

    $content = Render-StateContent -State $State
    Write-FileUtf8NoBom -Path $Path -Content $content
}

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $normalizedBase = [System.IO.Path]::GetFullPath($BasePath)
    if (-not $normalizedBase.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $normalizedBase += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = [System.Uri]::new($normalizedBase)
    $targetUri = [System.Uri]::new([System.IO.Path]::GetFullPath($TargetPath))
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString())
}

function Require-Value {
    param(
        [string]$Value,
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing required value: $Name"
    }
}

function Resolve-ValidatedPlanFile {
    param(
        [string]$RootPath,
        [string]$RelativePath
    )

    $planPath = Get-StatePath -RootPath $RootPath -RelativePath $RelativePath -ArgumentName "PlanFile"
    if (-not (Test-Path -LiteralPath $planPath -PathType Leaf)) {
        throw "PlanFile must point to an existing plan detail file."
    }

    $normalizedPlanFile = Normalize-RelativePath (Get-RelativePathCompat -BasePath $RootPath -TargetPath $planPath)
    if (
        $normalizedPlanFile -notlike "plans/*.md" -or
        $normalizedPlanFile -ieq "plans/CURRENT-EXECUTION.md" -or
        $normalizedPlanFile -like "plans/archive/*"
    ) {
        throw "PlanFile must point to an active plans/*.md detail file."
    }

    $indexedLookup = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($path in @(
            Get-PlanIndexedPathsFromDevPlan -RootPath $RootPath |
            Where-Object {
                $_ -and
                $_ -ine "plans/CURRENT-EXECUTION.md" -and
                $_ -notlike "plans/archive/*"
            }
        )) {
        $null = $indexedLookup.Add($path)
    }

    if (-not $indexedLookup.Contains($normalizedPlanFile)) {
        throw "PlanFile must match an active detail plan indexed by DEV-PLAN.md."
    }

    return $normalizedPlanFile
}

function Sync-ValidatedStateSourcePlanFile {
    param(
        [string]$RootPath,
        [psobject]$State
    )

    if ($null -eq $State) {
        throw "Current execution state is missing."
    }

    if ([string]::IsNullOrWhiteSpace($State.SourcePlanFile)) {
        throw "Current execution state is missing SourcePlanFile."
    }

    $State.SourcePlanFile = Resolve-ValidatedPlanFile -RootPath $RootPath -RelativePath $State.SourcePlanFile
}

$rootPath = $null
try {
    $rootPath = (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path
}
catch {
    Write-Host ("Root path not found: {0}" -f $Root)
    exit 1
}

$statePath = Get-StatePath -RootPath $rootPath -RelativePath $StateFile -ArgumentName "StateFile"

if ($Action -eq "clear") {
    if (Test-Path -LiteralPath $statePath) {
        Remove-Item -LiteralPath $statePath -Force
    }

    $output = [pscustomobject]@{
        rootPath = $rootPath
        stateFile = Normalize-RelativePath $StateFile
        status = "cleared"
    }

    if ($Json) {
        $output | ConvertTo-Json -Depth 4
    }
    else {
        Write-Host "Plan state cleared: $(Normalize-RelativePath $StateFile)"
    }
    exit 0
}

$state = Read-State -Path $statePath
$now = (Get-Date).ToString("o")

# State transition legality check: enforce legal MOVES, not just legal actions.
# Shares the same transition semantics as the task state machine in
# update-target-task-state.mjs (decided by the user):
#   - No skipping: idle/todo cannot go straight to done (zero-work completion);
#     blocked must return to doing before it can become done.
#   - Not-started cannot be blocked directly: idle/todo must start (enter doing)
#     before they can be blocked.
#   - done is not a dead terminal state but can only step back one: done->doing
#     (start = reopen for rework) is allowed; done->blocked is rejected.
#   - Self-transitions are allowed (idempotent re-marking): blocked->blocked and
#     done->done are permitted, matching the task state machine's matrix.
#   - checkpoint does not change status (only updates progress), so it is exempt.
# The idle start state means "not started yet" and only allows start.
function Assert-LegalTransition {
    param(
        [string]$FromStatus,
        [string]$Action
    )

    $from = if ([string]::IsNullOrWhiteSpace($FromStatus)) { "idle" } else { $FromStatus.Trim().ToLowerInvariant() }

    # Allowed source states for each transition action.
    $allowedFrom = @{
        "start"   = @("idle", "todo", "doing", "blocked", "done") # start/reopen: any state may enter doing (done = rework reopen)
        "blocked" = @("doing", "blocked")                          # block an in-progress task; blocked->blocked is idempotent re-marking
        "done"    = @("doing", "done")                             # complete an in-progress task (blocked must return to doing first); done->done is idempotent
    }

    if (-not $allowedFrom.ContainsKey($Action)) {
        return # checkpoint / other non-transition actions are not checked here
    }

    if ($allowedFrom[$Action] -notcontains $from) {
        throw ("Illegal plan-state transition: cannot '{0}' from status '{1}'. Resolve via a legal step first." -f $Action, $from)
    }
}

Assert-LegalTransition -FromStatus $state.Status -Action $Action

switch ($Action) {
    "show" {
    }
    "start" {
        Require-Value -Value $Phase -Name "Phase"
        Require-Value -Value $TaskId -Name "TaskId"
        Require-Value -Value $TaskTitle -Name "TaskTitle"
        Require-Value -Value $PlanFile -Name "PlanFile"
        Require-Value -Value $Checkpoint -Name "Checkpoint"
        Require-Value -Value $NextStep -Name "NextStep"
        $validatedPlanFile = Resolve-ValidatedPlanFile -RootPath $rootPath -RelativePath $PlanFile

        $state.Status = "doing"
        $state.CurrentPhase = $Phase.Trim()
        $state.CurrentTaskId = $TaskId.Trim()
        $state.CurrentTaskTitle = $TaskTitle.Trim()
        $state.SourcePlanFile = $validatedPlanFile
        $state.LastCheckpoint = $Checkpoint.Trim()
        $state.ResumeNextStep = $NextStep.Trim()
        $state.TouchedFiles = if ($TouchedFiles) { ($TouchedFiles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-RelativePath $_ }) -join ", " } else { "" }
        $state.LastUpdated = $now
        Write-State -Path $statePath -State $state
    }
    "checkpoint" {
        if (-not (Test-Path -LiteralPath $statePath)) {
            throw "Cannot checkpoint without an existing current execution file."
        }

        Sync-ValidatedStateSourcePlanFile -RootPath $rootPath -State $state
        $state.Status = if ([string]::IsNullOrWhiteSpace($state.Status)) { "doing" } else { $state.Status }
        if ($Checkpoint) { $state.LastCheckpoint = $Checkpoint.Trim() }
        if ($NextStep) { $state.ResumeNextStep = $NextStep.Trim() }
        if ($TouchedFiles) { $state.TouchedFiles = ($TouchedFiles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-RelativePath $_ }) -join ", " }
        $state.LastUpdated = $now
        Write-State -Path $statePath -State $state
    }
    "done" {
        if (-not (Test-Path -LiteralPath $statePath)) {
            throw "Cannot mark done without an existing current execution file."
        }

        Sync-ValidatedStateSourcePlanFile -RootPath $rootPath -State $state
        $state.Status = "done"
        if ($Checkpoint) { $state.LastCheckpoint = $Checkpoint.Trim() }
        if ($NextStep) { $state.ResumeNextStep = $NextStep.Trim() }
        if ($TouchedFiles) { $state.TouchedFiles = ($TouchedFiles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-RelativePath $_ }) -join ", " }
        $state.LastUpdated = $now
        Write-State -Path $statePath -State $state
    }
    "blocked" {
        if (-not (Test-Path -LiteralPath $statePath)) {
            throw "Cannot mark blocked without an existing current execution file."
        }

        Sync-ValidatedStateSourcePlanFile -RootPath $rootPath -State $state
        $state.Status = "blocked"
        if ($Checkpoint) { $state.LastCheckpoint = $Checkpoint.Trim() }
        if ($NextStep) { $state.ResumeNextStep = $NextStep.Trim() }
        if ($TouchedFiles) { $state.TouchedFiles = ($TouchedFiles | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | ForEach-Object { Normalize-RelativePath $_ }) -join ", " }
        $state.LastUpdated = $now
        Write-State -Path $statePath -State $state
    }
}

$output = [pscustomobject]@{
    rootPath         = $rootPath
    stateFile        = Normalize-RelativePath (Get-RelativePathCompat -BasePath $rootPath -TargetPath $statePath)
    status           = $state.Status
    currentPhase     = $state.CurrentPhase
    currentTaskId    = $state.CurrentTaskId
    currentTaskTitle = $state.CurrentTaskTitle
    sourcePlanFile   = $state.SourcePlanFile
    lastCheckpoint   = $state.LastCheckpoint
    resumeNextStep   = $state.ResumeNextStep
    touchedFiles     = $state.TouchedFiles
    lastUpdated      = $state.LastUpdated
}

if ($Json) {
    $output | ConvertTo-Json -Depth 4
}
else {
    if ($Action -eq "show") {
        if (Test-Path -LiteralPath $statePath) {
            Get-Content -LiteralPath $statePath -Encoding utf8
        }
        else {
            Write-Host "No current execution state file."
        }
    }
    else {
        Write-Host "Plan state updated:"
        Write-Host "  Status: $($output.status)"
        Write-Host "  Task: $($output.currentTaskId) $($output.currentTaskTitle)"
        Write-Host "  Next: $($output.resumeNextStep)"
    }
}
