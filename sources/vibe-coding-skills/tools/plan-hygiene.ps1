[CmdletBinding()]
param(
    [string]$Root = ".",
    [switch]$Json,
    [switch]$ApplyArchive,
    [int]$DevPlanSoftLimitLines = 220,
    [int]$DevPlanHardLimitLines = 320,
    [int]$ActivePlansSoftLimit = 5,
    [int]$ActivePlansHardLimit = 8
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$currentExecutionHelperPath = Join-Path $PSScriptRoot "current-execution-template-helpers.ps1"
if (-not (Test-Path -LiteralPath $currentExecutionHelperPath -PathType Leaf)) {
    throw ("Missing required helper: {0}" -f $currentExecutionHelperPath)
}
. $currentExecutionHelperPath

function Write-FileUtf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
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

function Get-PlanFileRecords {
    param(
        [string]$RootPath,
        [string]$PlansPath
    )

    if (-not (Test-Path -LiteralPath $PlansPath)) {
        return @()
    }

    $records = @()
    foreach ($file in Get-ChildItem -LiteralPath $PlansPath -File -Recurse -Filter *.md) {
        $relativePath = Normalize-PlanContractRelativePath (Get-PlanContractRelativePathCompat -BasePath $RootPath -TargetPath $file.FullName)
        if ($relativePath -ieq "plans/CURRENT-EXECUTION.md") {
            continue
        }
        $records += [pscustomobject]@{
            FullPath     = $file.FullName
            RelativePath = $relativePath
            IsArchived   = $relativePath -like "plans/archive/*"
        }
    }

    return $records
}

function Get-PlanTaskStatusSummary {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject]@{
            HasTaskRows      = $false
            HasNonDoneTasks  = $false
            NonDoneStatuses  = @()
        }
    }

    $statuses = @(Read-PhaseTaskRowsFromFile -Path $Path | ForEach-Object { $_.status })

    $nonDoneStatuses = @($statuses | Where-Object { $_ -ne "done" } | Sort-Object -Unique)
    return [pscustomobject]@{
        HasTaskRows      = $statuses.Count -gt 0
        HasNonDoneTasks  = $nonDoneStatuses.Count -gt 0
        NonDoneStatuses  = $nonDoneStatuses
    }
}

function Get-PlanHygieneReport {
    param(
        [string]$RootPath,
        [int]$SoftLineLimit,
        [int]$HardLineLimit,
        [int]$SoftActivePlans,
        [int]$HardActivePlans
    )

    $devPlanPath = Join-Path $RootPath "DEV-PLAN.md"
    $plansPath = Join-Path $RootPath "plans"
    $devPlanExists = Test-Path -LiteralPath $devPlanPath
    $devPlanContent = ""
    $devPlanLineCount = 0

    if ($devPlanExists) {
        $devPlanContent = Get-Content -LiteralPath $devPlanPath -Encoding utf8 -Raw
        $devPlanLineCount = (Get-Content -LiteralPath $devPlanPath -Encoding utf8).Count
    }

    $indexedPlanPaths = @()
    $currentPhaseNumber = $null
    if ($devPlanExists) {
        $indexedPlanPaths = @(Get-PlanIndexedPathsFromContent -Content $devPlanContent | Where-Object { $_ -ine "plans/CURRENT-EXECUTION.md" })
        $currentPhaseNumber = Get-CurrentPhaseNumberFromPlanContent -Content $devPlanContent
    }

    $planFiles = Get-PlanFileRecords -RootPath $RootPath -PlansPath $plansPath
    $activePlanFiles = @($planFiles | Where-Object { -not $_.IsArchived })
    $archivedPlanFiles = @($planFiles | Where-Object { $_.IsArchived })

    $indexedLookup = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($path in $indexedPlanPaths) {
        $null = $indexedLookup.Add($path)
    }

    $unindexedActivePaths = @(
        $activePlanFiles |
        Where-Object { -not $indexedLookup.Contains($_.RelativePath) } |
        ForEach-Object { $_.RelativePath }
    )

    $indexedMissingPaths = @()
    foreach ($relativePath in $indexedPlanPaths) {
        $fullPath = Join-Path $RootPath ($relativePath -replace "/", "\")
        if (-not (Test-Path -LiteralPath $fullPath)) {
            $indexedMissingPaths += $relativePath
        }
    }

    $archiveCandidates = @()
    if ($null -ne $currentPhaseNumber) {
        foreach ($planFile in $activePlanFiles) {
            $match = [regex]::Match($planFile.RelativePath, '^plans/phase-(?<num>\d+)\.md$', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
            if ($match.Success) {
                $phaseNumber = [int]$match.Groups["num"].Value
                if ($phaseNumber -le ($currentPhaseNumber - 2)) {
                    $taskStatusSummary = Get-PlanTaskStatusSummary -Path $planFile.FullPath
                    if (-not ($taskStatusSummary.HasTaskRows -and $taskStatusSummary.HasNonDoneTasks)) {
                        $archiveCandidates += $planFile.RelativePath
                    }
                }
            }
        }
    }

    $status = "clean"
    $reasons = @()
    $recommendedActions = @()

    if (-not $devPlanExists) {
        $status = "missing_dev_plan"
        $reasons += "DEV-PLAN.md is missing, so plan hygiene cannot be evaluated."
        $recommendedActions += "Create or restore DEV-PLAN.md before using plans/."
    }
    else {
        if ($devPlanLineCount -gt $HardLineLimit) {
            $status = "cleanup_required"
            $reasons += "DEV-PLAN.md has $devPlanLineCount lines, above the hard limit of $HardLineLimit."
            $recommendedActions += "Compress DEV-PLAN.md so it only keeps current state, the phase overview, and indexed detail docs."
        }
        elseif ($devPlanLineCount -gt $SoftLineLimit) {
            if ($status -eq "clean") {
                $status = "cleanup_recommended"
            }
            $reasons += "DEV-PLAN.md has $devPlanLineCount lines, above the recommended limit of $SoftLineLimit."
            $recommendedActions += "Move current or next phase task detail into plans/ so DEV-PLAN.md stays a control page."
        }

        if ($activePlanFiles.Count -gt $HardActivePlans) {
            $status = "cleanup_required"
            $reasons += "There are $($activePlanFiles.Count) active plan docs, above the hard limit of $HardActivePlans."
            $recommendedActions += "Merge low-signal plan docs and move completed phase detail into plans/archive/."
        }
        elseif ($activePlanFiles.Count -gt $SoftActivePlans) {
            if ($status -eq "clean") {
                $status = "cleanup_recommended"
            }
            $reasons += "There are $($activePlanFiles.Count) active plan docs, above the recommended limit of $SoftActivePlans."
            $recommendedActions += "Keep active plan docs around 3-5, preferably current phase, next phase, and decisions."
        }

        if ($unindexedActivePaths.Count -gt 0) {
            $status = "cleanup_required"
            $reasons += "Active plan docs are not indexed by DEV-PLAN.md: $($unindexedActivePaths -join ', ')."
            $recommendedActions += "Add unindexed docs to DEV-PLAN.md, or merge them before removing duplicates."
        }

        if ($indexedMissingPaths.Count -gt 0) {
            $status = "cleanup_required"
            $reasons += "DEV-PLAN.md points to missing detail docs: $($indexedMissingPaths -join ', ')."
            $recommendedActions += "Fix broken indexes in DEV-PLAN.md so new sessions do not follow bad paths."
        }

        if ($archiveCandidates.Count -gt 0) {
            if ($status -eq "clean") {
                $status = "cleanup_recommended"
            }
            $reasons += "Older phase detail docs can be archived: $($archiveCandidates -join ', ')."
            $recommendedActions += "Move detail docs older than current phase minus one into plans/archive/."
        }

        if ($recommendedActions.Count -eq 0) {
            $recommendedActions += "The current plan structure is clear. No cleanup is needed right now."
        }
    }

    return [pscustomobject]@{
        rootPath            = $RootPath
        devPlanPath         = $devPlanPath
        devPlanExists       = $devPlanExists
        devPlanLineCount    = $devPlanLineCount
        currentPhaseNumber  = $currentPhaseNumber
        indexedPlanPaths    = $indexedPlanPaths
        activePlanPaths     = @($activePlanFiles | ForEach-Object { $_.RelativePath })
        archivedPlanPaths   = @($archivedPlanFiles | ForEach-Object { $_.RelativePath })
        unindexedActive     = $unindexedActivePaths
        indexedMissing      = $indexedMissingPaths
        archiveCandidates   = $archiveCandidates
        thresholds          = [pscustomobject]@{
            devPlanSoftLimitLines = $SoftLineLimit
            devPlanHardLimitLines = $HardLineLimit
            activePlansSoftLimit  = $SoftActivePlans
            activePlansHardLimit  = $HardActivePlans
        }
        status              = $status
        reasons             = $reasons
        recommendedActions  = $recommendedActions
        appliedArchives     = @()
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

$report = Get-PlanHygieneReport `
    -RootPath $rootPath `
    -SoftLineLimit $DevPlanSoftLimitLines `
    -HardLineLimit $DevPlanHardLimitLines `
    -SoftActivePlans $ActivePlansSoftLimit `
    -HardActivePlans $ActivePlansHardLimit

if ($ApplyArchive -and $report.archiveCandidates.Count -gt 0 -and $report.devPlanExists) {
    $archiveDir = Join-Path $rootPath "plans\archive"
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null

    $devPlanContent = Get-Content -LiteralPath $report.devPlanPath -Encoding utf8 -Raw
    $appliedArchives = @()
    $planPathRewrites = [ordered]@{}

    foreach ($relativePath in $report.archiveCandidates) {
        $sourcePath = Join-Path $rootPath ($relativePath -replace "/", '\')
        $targetRelativePath = Normalize-PlanContractRelativePath ($relativePath -replace '^plans/', 'plans/archive/')
        $targetPath = Join-Path $rootPath ($targetRelativePath -replace "/", '\')

        if (-not (Test-Path -LiteralPath $sourcePath)) {
            continue
        }

        Move-Item -LiteralPath $sourcePath -Destination $targetPath -Force
        $planPathRewrites[([string](Normalize-PlanContractRelativePath $relativePath))] = $targetRelativePath

        $appliedArchives += [pscustomobject]@{
            from = $relativePath
            to   = $targetRelativePath
        }
    }

    $devPlanContent = Update-PlanReferenceSectionsInContent -Content $devPlanContent -PathRewrites $planPathRewrites
    Write-FileUtf8NoBom -Path $report.devPlanPath -Content $devPlanContent

    $currentExecutionPath = Join-Path $rootPath "plans\CURRENT-EXECUTION.md"
    if ($appliedArchives.Count -gt 0 -and (Test-Path -LiteralPath $currentExecutionPath)) {
        $currentExecutionContent = Get-Content -LiteralPath $currentExecutionPath -Encoding utf8 -Raw
        $statusMatch = [regex]::Match($currentExecutionContent, '(?m)^- \*\*Status\*\*: (?<value>.*)$')
        $sourcePlanMatch = [regex]::Match($currentExecutionContent, '(?m)^- \*\*Source Plan File\*\*: (?<value>.*)$')

        if ($statusMatch.Success -and $sourcePlanMatch.Success) {
            $currentStatus = $statusMatch.Groups["value"].Value.Trim().ToLowerInvariant()
            $sourcePlanFile = Normalize-PlanContractRelativePath $sourcePlanMatch.Groups["value"].Value

            if (($currentStatus -eq "done" -or $currentStatus -eq "idle") -and -not [string]::IsNullOrWhiteSpace($sourcePlanFile)) {
                foreach ($move in $appliedArchives) {
                    if ($sourcePlanFile -ieq $move.from) {
                        $updatedCurrentExecutionContent = [regex]::Replace(
                            $currentExecutionContent,
                            '(?m)^- \*\*Source Plan File\*\*: .*$',
                            ("- **Source Plan File**: {0}" -f $move.to),
                            1
                        )

                        if ($updatedCurrentExecutionContent -ne $currentExecutionContent) {
                            Write-FileUtf8NoBom -Path $currentExecutionPath -Content $updatedCurrentExecutionContent
                        }

                        break
                    }
                }
            }
        }
    }

    $report = Get-PlanHygieneReport `
        -RootPath $rootPath `
        -SoftLineLimit $DevPlanSoftLimitLines `
        -HardLineLimit $DevPlanHardLimitLines `
        -SoftActivePlans $ActivePlansSoftLimit `
        -HardActivePlans $ActivePlansHardLimit

    $report | Add-Member -NotePropertyName appliedArchives -NotePropertyValue $appliedArchives -Force
}

if ($Json) {
    $report | ConvertTo-Json -Depth 6
    exit 0
}

Write-Host "Plan Hygiene Status: $($report.status)"
Write-Host "Root: $($report.rootPath)"

if ($report.devPlanExists) {
    Write-Host "DEV-PLAN Lines: $($report.devPlanLineCount)"
}
else {
    Write-Host "DEV-PLAN Lines: N/A"
}

Write-Host "Active Plan Docs: $($report.activePlanPaths.Count)"
Write-Host "Archived Plan Docs: $($report.archivedPlanPaths.Count)"

if ($null -ne $report.currentPhaseNumber) {
    Write-Host "Current Phase: Phase $($report.currentPhaseNumber)"
}
else {
    Write-Host "Current Phase: Unknown"
}

if ($report.reasons.Count -gt 0) {
    Write-Host ""
    Write-Host "Reasons:"
    foreach ($reason in $report.reasons) {
        Write-Host "  - $reason"
    }
}

Write-Host ""
Write-Host "Recommended Actions:"
foreach ($action in $report.recommendedActions) {
    Write-Host "  - $action"
}

if ($report.appliedArchives.Count -gt 0) {
    Write-Host ""
    Write-Host "Applied Archives:"
    foreach ($move in $report.appliedArchives) {
        Write-Host "  - $($move.from) -> $($move.to)"
    }
}
