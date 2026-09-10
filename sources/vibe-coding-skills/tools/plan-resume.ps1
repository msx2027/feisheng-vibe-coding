[CmdletBinding()]
param(
    [string]$Root = ".",
    [string]$StateFile = "plans/CURRENT-EXECUTION.md",
    [switch]$Json
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$currentExecutionHelperPath = Join-Path $PSScriptRoot "current-execution-template-helpers.ps1"
if (-not (Test-Path -LiteralPath $currentExecutionHelperPath -PathType Leaf)) {
    throw ("Missing required helper: {0}" -f $currentExecutionHelperPath)
}
. $currentExecutionHelperPath

function Resolve-ScopedPath {
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
        $normalizedRelative = Normalize-PlanContractRelativePath $RelativePath
        [System.IO.Path]::GetFullPath((Join-Path $RootPath ($normalizedRelative -replace "/", "\")))
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

function Resolve-RootDirectory {
    param([string]$RootPath)

    if ([string]::IsNullOrWhiteSpace($RootPath)) {
        throw "Root path is required."
    }

    try {
        return (Resolve-Path -LiteralPath $RootPath -ErrorAction Stop).Path
    }
    catch {
        throw ("Root path not found: {0}" -f $RootPath)
    }
}

function Read-CurrentExecutionState {
    param([string]$Path)

    $state = [ordered]@{
        exists            = $false
        relativePath      = Normalize-PlanContractRelativePath $Path
        status            = ""
        currentPhase      = ""
        currentTaskId     = ""
        currentTaskTitle  = ""
        sourcePlanFile    = ""
        lastCheckpoint    = ""
        resumeNextStep    = ""
        touchedFiles      = ""
        lastUpdated       = ""
    }

    $fieldDefaults = [ordered]@{
        Status           = ""
        CurrentPhase     = ""
        CurrentTaskId    = ""
        CurrentTaskTitle = ""
        SourcePlanFile   = ""
        LastCheckpoint   = ""
        ResumeNextStep   = ""
        TouchedFiles     = ""
        LastUpdated      = ""
    }
    $fieldState = Read-CurrentExecutionFieldState -Path $Path -ToolsScriptRoot $PSScriptRoot -DefaultState $fieldDefaults

    if (Test-Path -LiteralPath $Path) {
        $state.exists = $true
    }

    $state.status = $fieldState["Status"]
    $state.currentPhase = $fieldState["CurrentPhase"]
    $state.currentTaskId = $fieldState["CurrentTaskId"]
    $state.currentTaskTitle = $fieldState["CurrentTaskTitle"]
    $state.sourcePlanFile = $fieldState["SourcePlanFile"]
    $state.lastCheckpoint = $fieldState["LastCheckpoint"]
    $state.resumeNextStep = $fieldState["ResumeNextStep"]
    $state.touchedFiles = $fieldState["TouchedFiles"]
    $state.lastUpdated = $fieldState["LastUpdated"]

    return [pscustomobject]$state
}

function Get-PhaseTaskRows {
    param(
        [string]$RootPath,
        [switch]$IncludeArchived
    )

    $plansDir = Join-Path $RootPath "plans"
    if (-not (Test-Path -LiteralPath $plansDir)) {
        return @()
    }

    $rows = @()
    foreach ($file in Get-ChildItem -LiteralPath $plansDir -File -Recurse -Filter *.md) {
        $relativePath = Normalize-PlanContractRelativePath (Get-PlanContractRelativePathCompat -BasePath $RootPath -TargetPath $file.FullName)
        if ($relativePath -ieq "plans/CURRENT-EXECUTION.md") { continue }
        if (-not $IncludeArchived -and $relativePath -like "plans/archive/*") { continue }

        $rows += Read-PhaseTaskRowsFromFile -Path $file.FullName -PlanFile $relativePath
    }

    return $rows
}

function Get-ArchivedPlanFilePath {
    param([string]$Path)

    $normalizedPath = Normalize-PlanContractRelativePath $Path
    if ([string]::IsNullOrWhiteSpace($normalizedPath)) {
        return ""
    }

    if ($normalizedPath -like "plans/archive/*") {
        return $normalizedPath
    }

    if ($normalizedPath -like "plans/*") {
        return ($normalizedPath -replace '^plans/', 'plans/archive/')
    }

    return $normalizedPath
}

function Test-IsCurrentTaskRow {
    param(
        [pscustomobject]$Row,
        [pscustomobject]$CurrentState
    )

    if (-not $Row -or [string]::IsNullOrWhiteSpace($CurrentState.currentTaskId)) {
        return $false
    }

    if ($Row.taskId -ne $CurrentState.currentTaskId) {
        return $false
    }

    if ([string]::IsNullOrWhiteSpace($CurrentState.sourcePlanFile)) {
        return $true
    }

    return $Row.planFile -ieq $CurrentState.sourcePlanFile
}

function New-ResumeTask {
    param(
        [string]$Source,
        [string]$PlanFile,
        [string]$TaskId,
        [string]$TaskTitle,
        [string]$Status,
        [string]$LastCheckpoint,
        [string]$ResumeNextStep
    )

    return [pscustomobject]@{
        source         = $Source
        planFile       = $PlanFile
        taskId         = $TaskId
        taskTitle      = $TaskTitle
        status         = $Status
        lastCheckpoint = $LastCheckpoint
        resumeNextStep = $ResumeNextStep
    }
}

$rootPath = $null
try {
    $rootPath = Resolve-RootDirectory -RootPath $Root
}
catch {
    Write-Host $_.Exception.Message
    exit 1
}

try {
    $statePath = Resolve-ScopedPath -RootPath $rootPath -RelativePath $StateFile
    $currentState = Read-CurrentExecutionState -Path $statePath
    $indexedPlanPaths = @(
        Get-PlanIndexedPathsFromDevPlan -RootPath $rootPath |
        Where-Object {
            $_ -and
            $_ -ine "plans/CURRENT-EXECUTION.md" -and
            $_ -notlike "plans/archive/*"
        }
    )
    $indexedPlanLookup = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($path in $indexedPlanPaths) {
        $null = $indexedPlanLookup.Add($path)
    }

    $allTaskRows = Get-PhaseTaskRows -RootPath $rootPath
    $taskRows = @($allTaskRows | Where-Object { $indexedPlanLookup.Contains($_.planFile) })
    $unindexedActivePlanFiles = @(
        $allTaskRows |
        Where-Object {
            ($_.status -eq "doing" -or $_.status -eq "blocked") -and
            -not $indexedPlanLookup.Contains($_.planFile)
        } |
        ForEach-Object { $_.planFile } |
        Sort-Object -Unique
    )
    $archivedTaskRows = @(
        Get-PhaseTaskRows -RootPath $rootPath -IncludeArchived |
        Where-Object { $_.planFile -like "plans/archive/*" }
    )

$doingRows = @($taskRows | Where-Object { $_.status -eq "doing" })
$blockedRows = @($taskRows | Where-Object { $_.status -eq "blocked" })
$activeRows = @($doingRows + $blockedRows)
$currentStatus = $currentState.status.ToLowerInvariant()

$decision = "no_interrupted_task"
$decisionReason = "No current execution file or in-progress task was found."
$resumeTask = $null
$issues = @()

$validCurrentStatuses = @("doing", "blocked", "done", "idle")

if ($currentState.exists -and (
    [string]::IsNullOrWhiteSpace($currentState.status) -or
    $validCurrentStatuses -notcontains $currentStatus
)) {
    $decision = "manual_reconcile_required"
    $decisionReason = "Current execution file has an invalid or incomplete status."
    $issues += "Current execution file Status is missing or invalid: '$($currentState.status)'."
}
elseif ($currentState.exists -and (
    $currentStatus -eq "doing" -or
    $currentStatus -eq "blocked" -or
    $currentStatus -eq "done"
) -and [string]::IsNullOrWhiteSpace($currentState.sourcePlanFile)) {
    $decision = "manual_reconcile_required"
    $decisionReason = "Current execution file is missing the source plan file."
    $issues += "Current execution file says $currentStatus, but Source Plan File is missing."
}
elseif ($currentState.exists -and (
    $currentStatus -eq "doing" -or
    $currentStatus -eq "blocked" -or
    $currentStatus -eq "done"
) -and -not $indexedPlanLookup.Contains($currentState.sourcePlanFile)) {
    $decision = "manual_reconcile_required"
    $decisionReason = "Current execution file points to a plan detail doc that is not indexed by DEV-PLAN.md."
    $issues += "Current execution file points to unindexed or inactive plan detail doc: $($currentState.sourcePlanFile)."
}
elseif ($unindexedActivePlanFiles.Count -gt 0) {
    $decision = "manual_reconcile_required"
    $decisionReason = "Active phase detail docs are not indexed by DEV-PLAN.md."
    foreach ($planFile in $unindexedActivePlanFiles) {
        $issues += "DEV-PLAN.md does not index active phase detail doc: $planFile."
    }
}
elseif ($currentState.exists -and ($currentStatus -eq "doing" -or $currentStatus -eq "blocked")) {
    $currentTaskRows = @($taskRows | Where-Object { Test-IsCurrentTaskRow -Row $_ -CurrentState $currentState })
    $currentTaskActiveRows = @($activeRows | Where-Object { Test-IsCurrentTaskRow -Row $_ -CurrentState $currentState })
    $otherDoingRows = @($doingRows | Where-Object { -not (Test-IsCurrentTaskRow -Row $_ -CurrentState $currentState) })

    if ($currentTaskRows.Count -eq 0) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file points to a task missing from phase detail docs."
        $issues += "Current execution file points to $($currentState.currentTaskId), but no matching task row was found in $($currentState.sourcePlanFile)."
    }
    elseif ($currentTaskRows.Count -gt 1) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file matches more than one task row in phase detail docs."
        $issues += "Current execution file maps to multiple task rows. Reconcile plan state before resuming work."
    }
    elseif ($currentTaskRows.Count -eq 1 -and $currentTaskRows[0].status -eq "done") {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file points to a task already marked done in phase detail docs."
        $issues += "Current execution file says $currentStatus, but $($currentTaskRows[0].planFile):$($currentTaskRows[0].taskId) is already marked done."
    }
    elseif ($currentTaskRows.Count -eq 1 -and $currentTaskRows[0].status -eq "todo") {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file points to a task still marked todo in phase detail docs."
        $issues += "Current execution file says $currentStatus, but $($currentTaskRows[0].planFile):$($currentTaskRows[0].taskId) is still marked todo."
    }
    elseif ($currentTaskActiveRows.Count -gt 1) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file matches more than one active task row in phase detail docs."
        $issues += "Current execution file maps to multiple active task rows. Reconcile plan state before resuming work."
    }
    elseif ($otherDoingRows.Count -gt 0) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file conflicts with another doing task in phase detail docs."
        foreach ($row in $otherDoingRows) {
            $issues += "Current execution file points to $($currentState.currentTaskId), but $($row.planFile):$($row.taskId) is still marked $($row.status)."
        }
    }
    elseif ($currentTaskActiveRows.Count -eq 1 -and $currentTaskActiveRows[0].status -ne $currentStatus) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file and phase detail docs disagree on the current task status."
        $issues += "Current execution file says $currentStatus, but $($currentTaskActiveRows[0].planFile):$($currentTaskActiveRows[0].taskId) says $($currentTaskActiveRows[0].status)."
    }
    elseif ($currentStatus -eq "doing") {
        $decision = "resume_interrupted_task"
        $decisionReason = "Current execution file shows a task in doing state."
        $resumeTask = New-ResumeTask `
            -Source "current-execution" `
            -PlanFile $currentState.sourcePlanFile `
            -TaskId $currentState.currentTaskId `
            -TaskTitle $currentState.currentTaskTitle `
            -Status $currentState.status `
            -LastCheckpoint $currentState.lastCheckpoint `
            -ResumeNextStep $currentState.resumeNextStep
    }
    else {
        $decision = "resolve_blocked_task"
        $decisionReason = "Current execution file shows a blocked task."
        $resumeTask = New-ResumeTask `
            -Source "current-execution" `
            -PlanFile $currentState.sourcePlanFile `
            -TaskId $currentState.currentTaskId `
            -TaskTitle $currentState.currentTaskTitle `
            -Status $currentState.status `
            -LastCheckpoint $currentState.lastCheckpoint `
            -ResumeNextStep $currentState.resumeNextStep
    }
}
elseif ($currentState.exists -and $currentStatus -eq "idle") {
    if ($activeRows.Count -gt 0) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file says idle, but phase detail docs still show active tasks."
        foreach ($row in $activeRows) {
            $issues += "Current execution file says idle, but $($row.planFile):$($row.taskId) is still marked $($row.status)."
        }
    }
    else {
        $decision = "no_interrupted_task"
        $decisionReason = "Current execution file says idle and no active task remains."
    }
}
elseif ($doingRows.Count -eq 1) {
    $decision = "resume_interrupted_task"
    $decisionReason = "Exactly one task row is marked doing in phase detail docs."
    $resumeTask = New-ResumeTask `
        -Source "phase-detail" `
        -PlanFile $doingRows[0].planFile `
        -TaskId $doingRows[0].taskId `
        -TaskTitle $doingRows[0].taskTitle `
        -Status $doingRows[0].status `
        -LastCheckpoint $doingRows[0].lastCheckpoint `
        -ResumeNextStep $doingRows[0].resumeNextStep
}
elseif ($doingRows.Count -gt 1) {
    $decision = "manual_reconcile_required"
    $decisionReason = "More than one task row is marked doing across phase detail docs."
    $issues += "Multiple tasks are marked doing. Reconcile plan state before resuming work."
}
elseif ($blockedRows.Count -eq 1) {
    $decision = "resolve_blocked_task"
    $decisionReason = "No doing task was found, and exactly one task is blocked."
    $resumeTask = New-ResumeTask `
        -Source "phase-detail" `
        -PlanFile $blockedRows[0].planFile `
        -TaskId $blockedRows[0].taskId `
        -TaskTitle $blockedRows[0].taskTitle `
        -Status $blockedRows[0].status `
        -LastCheckpoint $blockedRows[0].lastCheckpoint `
        -ResumeNextStep $blockedRows[0].resumeNextStep
}
elseif ($blockedRows.Count -gt 1) {
    $decision = "manual_reconcile_required"
    $decisionReason = "More than one task row is marked blocked across phase detail docs."
    $issues += "Multiple tasks are marked blocked. Reconcile plan state before resuming work."
}

if ($currentState.exists -and $currentStatus -eq "done") {
    $currentDoneRows = @($taskRows | Where-Object { Test-IsCurrentTaskRow -Row $_ -CurrentState $currentState })
    $archivedPlanFile = Get-ArchivedPlanFilePath -Path $currentState.sourcePlanFile
    $currentArchivedDoneRows = @(
        $archivedTaskRows |
        Where-Object {
            $_.taskId -eq $currentState.currentTaskId -and
            $_.planFile -ieq $archivedPlanFile
        }
    )
    $matchingDoneRows = @($currentDoneRows + $currentArchivedDoneRows)

    if ([string]::IsNullOrWhiteSpace($currentState.currentTaskId)) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file says done, but the current task id is missing."
        $resumeTask = $null
        $issues += "Current execution file says done, but Current Task ID is missing."
    }
    elseif (
        $matchingDoneRows.Count -eq 0 -and
        -not [string]::IsNullOrWhiteSpace($currentState.currentTaskId)
    ) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file says done, but the same task is missing from phase detail docs."
        $resumeTask = $null
        $issues += "Current execution file says done for $($currentState.currentTaskId), but no matching task row was found in phase detail docs."
    }
    elseif ($matchingDoneRows.Count -gt 1) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file matches more than one task row in phase detail docs."
        $resumeTask = $null
        $issues += "Current execution file maps to multiple task rows. Reconcile plan state before resuming work."
    }
    elseif ($matchingDoneRows.Count -eq 1 -and $matchingDoneRows[0].status -ne "done") {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file says done, but the same task is not done in phase detail docs."
        $resumeTask = $null
        $issues += "Current execution file says done, but $($matchingDoneRows[0].planFile):$($matchingDoneRows[0].taskId) is marked $($matchingDoneRows[0].status)."
    }
    elseif ($activeRows.Count -gt 0) {
        $decision = "manual_reconcile_required"
        $decisionReason = "Current execution file says done, but phase detail docs still contain active tasks."
        $resumeTask = $null
        $issues += "Current execution file and phase detail docs disagree."
    }
    else {
        $decision = "no_interrupted_task"
        $decisionReason = "Current execution file says done and no active task remains."
        $resumeTask = $null
    }
}

$statusCounts = [pscustomobject]@{
    todo = @($taskRows | Where-Object { $_.status -eq "todo" }).Count
    doing = $doingRows.Count
    blocked = $blockedRows.Count
    done = @($taskRows | Where-Object { $_.status -eq "done" }).Count
}

$output = [pscustomobject]@{
    rootPath = $rootPath
    indexedPlanPaths = $indexedPlanPaths
    unindexedActivePlanFiles = $unindexedActivePlanFiles
    currentExecution = $currentState
    taskStatusCounts = $statusCounts
    activeTaskRows = $activeRows
    decision = $decision
    decisionReason = $decisionReason
    resumeTask = $resumeTask
    issues = $issues
}

if ($Json) {
    $output | ConvertTo-Json -Depth 6
    exit 0
}

Write-Host "Plan Resume Decision: $decision"
Write-Host "Reason: $decisionReason"
Write-Host "Task Counts: todo=$($statusCounts.todo) doing=$($statusCounts.doing) blocked=$($statusCounts.blocked) done=$($statusCounts.done)"

if ($resumeTask) {
    Write-Host ""
    Write-Host "Resume Task:"
    Write-Host "  Source: $($resumeTask.source)"
    Write-Host "  Plan File: $($resumeTask.planFile)"
    Write-Host "  Task ID: $($resumeTask.taskId)"
    Write-Host "  Task: $($resumeTask.taskTitle)"
    Write-Host "  Last Checkpoint: $($resumeTask.lastCheckpoint)"
    Write-Host "  Resume Next Step: $($resumeTask.resumeNextStep)"
}

    if ($issues.Count -gt 0) {
        Write-Host ""
        Write-Host "Issues:"
        foreach ($issue in $issues) {
            Write-Host "  - $issue"
        }
    }
}
catch {
    $message = $_.Exception.Message.Trim()
    if ([string]::IsNullOrWhiteSpace($message)) {
        $message = "plan-resume failed."
    }

    [Console]::Error.WriteLine($message)
    exit 1
}
