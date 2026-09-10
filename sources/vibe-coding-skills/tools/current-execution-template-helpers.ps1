<#
[DocMap]
    层级：L3 / 计划恢复共享辅助
    模块：tools
    依赖：
    - `tools/INDEX.md`
    - `skills/dev-planner/templates/current-execution-template.md`
    - `skills/dev-planner/templates/phase-detail-template.md`
    输出：
    - CURRENT-EXECUTION 模板路径、字段模型、详细计划任务表契约与通用解析
#>

function Get-CurrentExecutionTemplatePath {
    param([string]$ToolsScriptRoot)

    $templatePath = [System.IO.Path]::GetFullPath((Join-Path $ToolsScriptRoot "..\skills\dev-planner\templates\current-execution-template.md"))
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        throw ("Current execution template not found: {0}" -f $templatePath)
    }

    return $templatePath
}

function Get-CurrentExecutionTemplateContent {
    param([string]$ToolsScriptRoot)

    $templatePath = Get-CurrentExecutionTemplatePath -ToolsScriptRoot $ToolsScriptRoot
    $content = Get-Content -LiteralPath $templatePath -Encoding utf8 -Raw
    $content = [regex]::Replace($content, '^---\r?\n.*?\r?\n---\r?\n?', '', [System.Text.RegularExpressions.RegexOptions]::Singleline)

    if ([string]::IsNullOrWhiteSpace($content)) {
        throw ("Current execution template is empty: {0}" -f $templatePath)
    }

    return $content.TrimEnd("`r", "`n") + "`n"
}

function Convert-CurrentExecutionTemplatePlaceholderToStateKey {
    param([string]$PlaceholderName)

    $parts = $PlaceholderName -split "_"
    return (($parts | ForEach-Object {
                if ([string]::IsNullOrWhiteSpace($_)) {
                    return ""
                }

                $lower = $_.ToLowerInvariant()
                return $lower.Substring(0, 1).ToUpperInvariant() + $lower.Substring(1)
            }) -join "")
}

function Get-CurrentExecutionTemplateModel {
    param([string]$ToolsScriptRoot)

    $content = Get-CurrentExecutionTemplateContent -ToolsScriptRoot $ToolsScriptRoot
    $lines = [regex]::Split($content.TrimEnd("`r", "`n"), "\r?\n")
    $fields = New-Object System.Collections.Generic.List[object]

    foreach ($line in $lines) {
        $match = [regex]::Match($line, '^- \*\*(?<label>[^*]+)\*\*: \[(?<placeholder>[A-Z_]+)\]\s*$')
        if (-not $match.Success) {
            continue
        }

        $placeholderName = $match.Groups["placeholder"].Value.Trim()
        $fields.Add([pscustomobject]@{
                label       = $match.Groups["label"].Value.Trim()
                placeholder = "[{0}]" -f $placeholderName
                stateKey    = Convert-CurrentExecutionTemplatePlaceholderToStateKey -PlaceholderName $placeholderName
            })
    }

    if ($fields.Count -eq 0) {
        throw "Current execution template does not define any placeholder-backed fields."
    }

    return [pscustomobject]@{
        content = $content
        fields  = [object[]]$fields.ToArray()
    }
}

function Read-CurrentExecutionFieldState {
    param(
        [string]$Path,
        [string]$ToolsScriptRoot,
        [System.Collections.IDictionary]$DefaultState
    )

    $state = [ordered]@{}
    foreach ($key in $DefaultState.Keys) {
        $state[$key] = $DefaultState[$key]
    }

    if (-not (Test-Path -LiteralPath $Path)) {
        return $state
    }

    $content = Get-Content -LiteralPath $Path -Encoding utf8 -Raw
    $template = Get-CurrentExecutionTemplateModel -ToolsScriptRoot $ToolsScriptRoot

    foreach ($field in $template.fields) {
        $pattern = "(?m)^- \*\*$([regex]::Escape($field.label))\*\*: (?<value>.*)$"
        $match = [regex]::Match($content, $pattern)
        if ($match.Success) {
            $state[$field.stateKey] = $match.Groups["value"].Value.Trim()
        }
    }

    return $state
}

function Get-PhaseDetailTemplatePath {
    param([string]$ToolsScriptRoot)

    $templatePath = [System.IO.Path]::GetFullPath((Join-Path $ToolsScriptRoot "..\skills\dev-planner\templates\phase-detail-template.md"))
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        throw ("Phase detail template not found: {0}" -f $templatePath)
    }

    return $templatePath
}

function Get-PhaseTaskTableContract {
    return [pscustomobject]@{
        SectionTitle      = "## Task Table"
        Header            = "| Task ID | Task | Status | Last Checkpoint | Resume Next Step | Notes |"
        Separator         = "| --- | --- | --- | --- | --- | --- |"
        RowPattern        = '^\|\s*(?<id>[^|]+?)\s*\|\s*(?<task>[^|]+?)\s*\|\s*(?<status>todo|doing|blocked|done)\s*\|\s*(?<checkpoint>[^|]*)\|\s*(?<next>[^|]*)\|\s*(?<notes>[^|]*)\|$'
        LegacyRowPattern  = '^\|\s*(?<id>[^|]+?)\s*\|\s*(?<task>[^|]+?)\s*\|\s*(?<status>todo|doing|blocked|done)\s*\|$'
    }
}

function Get-MarkdownSectionBody {
    param(
        [string]$Content,
        [string]$SectionTitle
    )

    if ([string]::IsNullOrWhiteSpace($Content) -or [string]::IsNullOrWhiteSpace($SectionTitle)) {
        return ""
    }

    $match = [regex]::Match(
        $Content,
        ("(?ims)^\s*{0}\s*$\s*(?<body>.*?)(?=^\s*##\s+|\z)" -f [regex]::Escape($SectionTitle))
    )
    if ($match.Success) {
        return $match.Groups["body"].Value
    }

    return ""
}

function Get-MarkdownSectionBodyByTitles {
    param(
        [string]$Content,
        [string[]]$SectionTitles
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return ""
    }

    foreach ($sectionTitle in @($SectionTitles)) {
        $body = Get-MarkdownSectionBody -Content $Content -SectionTitle $sectionTitle
        if (-not [string]::IsNullOrWhiteSpace($body)) {
            return $body
        }
    }

    return ""
}

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $base = $BasePath
    if (-not $base.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $base += [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = [System.Uri]::new($base)
    $targetUri = [System.Uri]::new($TargetPath)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString())
}

function Get-PlanContractRelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    return Get-RelativePathCompat -BasePath $BasePath -TargetPath $TargetPath
}

function Normalize-PlanContractRelativePath {
    param([string]$Path)

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }

    $normalized = $Path -replace "\\", "/"
    $normalized = $normalized -replace "^\./", ""
    return $normalized.Trim().TrimStart("/")
}

function Get-PlanCurrentStageSectionTitles {
    $currentWord = [string]::Concat([char]0x5F53, [char]0x524D)
    $stageWord = [string]::Concat([char]0x9636, [char]0x6BB5)

    return @(
        ("## " + [string]::Concat($currentWord, $stageWord)),
        "## Current Status",
        "## Current Stage"
    )
}

function Get-PlanDetailIndexSectionTitles {
    $indexTitle = [string]::Concat(
        [char]0x8865,
        [char]0x5145,
        [char]0x8BA1,
        [char]0x5212,
        [char]0x6587,
        [char]0x6863,
        [char]0x7D22,
        [char]0x5F15
    )

    return @(
        ("## " + $indexTitle),
        "## Detail Index"
    )
}

function Get-PlanCurrentTaskIndexSectionTitles {
    $currentWord = [string]::Concat([char]0x5F53, [char]0x524D)
    $indexWord = [string]::Concat([char]0x7D22, [char]0x5F15)

    return @(
        ("## " + $currentWord + " Task " + $indexWord),
        "## Current Task Index"
    )
}

function Get-IndexedPlanPathsFromDetailIndexBlock {
    param([string]$IndexBlock)

    if ([string]::IsNullOrWhiteSpace($IndexBlock)) {
        return [string[]]@()
    }

    $paths = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
    $regex = [regex]'plans/[^\s`"''<>()]+?\.md'
    foreach ($match in $regex.Matches($IndexBlock)) {
        $null = $paths.Add((Normalize-PlanContractRelativePath $match.Value))
    }

    return [string[]]@($paths | Sort-Object)
}

function Get-IndexedPlanPathsFromPlanContent {
    param([string]$Content)

    $indexBlock = Get-MarkdownSectionBodyByTitles -Content $Content -SectionTitles (Get-PlanDetailIndexSectionTitles)
    if ([string]::IsNullOrWhiteSpace($indexBlock)) {
        return [string[]]@()
    }

    return @(Get-IndexedPlanPathsFromDetailIndexBlock -IndexBlock $indexBlock)
}

function Get-PlanIndexedPathsFromContent {
    param([string]$Content)

    return @(Get-IndexedPlanPathsFromPlanContent -Content $Content)
}

function Get-IndexedPlanPathsFromDevPlan {
    param([string]$RootPath)

    $devPlanPath = Join-Path $RootPath "DEV-PLAN.md"
    if (-not (Test-Path -LiteralPath $devPlanPath -PathType Leaf)) {
        return [string[]]@()
    }

    $content = Get-Content -LiteralPath $devPlanPath -Encoding utf8 -Raw
    return @(Get-IndexedPlanPathsFromPlanContent -Content $content)
}

function Get-PlanIndexedPathsFromDevPlan {
    param([string]$RootPath)

    return @(Get-IndexedPlanPathsFromDevPlan -RootPath $RootPath)
}

function Get-CurrentPhaseNumberFromPlanContent {
    param([string]$Content)

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return $null
    }

    $currentWord = [string]::Concat([char]0x5F53, [char]0x524D)
    $fullWidthColon = [string][char]0xFF1A
    $explicitCurrentPhasePatterns = @(
        ('(?im)^[- \t>*]*{0}\s*Phase\s*[:{1}]\s*Phase\s*(?<num>\d+)\b' -f [regex]::Escape($currentWord), $fullWidthColon),
        ('(?im)^[- \t>*]*Current\s+Phase\s*[:{0}]\s*Phase\s*(?<num>\d+)\b' -f $fullWidthColon)
    )

    foreach ($pattern in $explicitCurrentPhasePatterns) {
        $match = [regex]::Match($Content, $pattern)
        if ($match.Success) {
            return [int]$match.Groups["num"].Value
        }
    }

    $currentStageBody = Get-MarkdownSectionBodyByTitles -Content $Content -SectionTitles (Get-PlanCurrentStageSectionTitles)
    if (-not [string]::IsNullOrWhiteSpace($currentStageBody)) {
        $phaseMatch = [regex]::Match(
            $currentStageBody,
            'Phase\s*(?<num>\d+)\b',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
        if ($phaseMatch.Success) {
            return [int]$phaseMatch.Groups["num"].Value
        }
    }

    $indexedPlanPaths = @(Get-IndexedPlanPathsFromPlanContent -Content $Content)
    if ($indexedPlanPaths.Count -gt 0) {
        $phaseNumbers = @(
            $indexedPlanPaths |
            ForEach-Object {
                $phaseMatch = [regex]::Match(
                    $_,
                    '^plans/phase-(?<num>\d+)\.md$',
                    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
                )
                if ($phaseMatch.Success) {
                    [int]$phaseMatch.Groups["num"].Value
                }
            } |
            Where-Object { $null -ne $_ }
        )
        $uniquePhaseNumbers = @($phaseNumbers | Sort-Object -Unique)
        if ($uniquePhaseNumbers.Count -eq 1) {
            return $uniquePhaseNumbers[0]
        }
    }

    return $null
}

function Get-PlanReferenceSectionTitleSets {
    return @(
        ,(Get-PlanCurrentStageSectionTitles)
        ,(Get-PlanCurrentTaskIndexSectionTitles)
        ,(Get-PlanDetailIndexSectionTitles)
    )
}

function Update-MarkdownSectionBodyByTitles {
    param(
        [string]$Content,
        [string[]]$SectionTitles,
        [scriptblock]$BodyUpdater
    )

    if ([string]::IsNullOrWhiteSpace($Content) -or $null -eq $BodyUpdater) {
        return $Content
    }

    foreach ($sectionTitle in @($SectionTitles)) {
        if ([string]::IsNullOrWhiteSpace($sectionTitle)) {
            continue
        }

        $pattern = "(?ims)^(?<heading>\s*{0}\s*$\s*)(?<body>.*?)(?=^\s*##\s+|\z)" -f [regex]::Escape($sectionTitle)
        $match = [regex]::Match($Content, $pattern)
        if (-not $match.Success) {
            continue
        }

        $bodyGroup = $match.Groups["body"]
        $updatedBody = & $BodyUpdater $bodyGroup.Value
        if ($null -eq $updatedBody) {
            return $Content
        }

        return $Content.Substring(0, $bodyGroup.Index) + [string]$updatedBody + $Content.Substring($bodyGroup.Index + $bodyGroup.Length)
    }

    return $Content
}

function Update-PlanReferenceSectionsInContent {
    param(
        [string]$Content,
        [System.Collections.IDictionary]$PathRewrites
    )

    if ([string]::IsNullOrWhiteSpace($Content) -or $null -eq $PathRewrites -or $PathRewrites.Count -eq 0) {
        return $Content
    }

    $rewriteEntries = @(
        $PathRewrites.GetEnumerator() |
        ForEach-Object {
            [pscustomobject]@{
                From = Normalize-PlanContractRelativePath ([string]$_.Key)
                To   = Normalize-PlanContractRelativePath ([string]$_.Value)
            }
        } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_.From) -and -not [string]::IsNullOrWhiteSpace($_.To) } |
        Sort-Object { $_.From.Length } -Descending
    )
    if ($rewriteEntries.Count -eq 0) {
        return $Content
    }

    $updatedContent = $Content
    foreach ($sectionTitles in Get-PlanReferenceSectionTitleSets) {
        $updatedContent = Update-MarkdownSectionBodyByTitles -Content $updatedContent -SectionTitles $sectionTitles -BodyUpdater {
            param($Body)

            $updatedBody = [string]$Body
            foreach ($entry in $rewriteEntries) {
                $replacement = [string]$entry.To
                $updatedBody = [regex]::Replace(
                    $updatedBody,
                    [regex]::Escape($entry.From),
                    [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement }
                )
            }

            return $updatedBody
        }
    }

    return $updatedContent
}

function New-PlanDetailIndexEntryLine {
    param(
        [string]$RelativePath,
        [string]$Description = "phase detail"
    )

    return ("- ``{0}`` - {1}" -f (Normalize-PlanContractRelativePath $RelativePath), $Description)
}

function Convert-PhaseTaskRowToMarkdown {
    param([object]$Row)

    return "| $($Row.TaskId) | $($Row.Task) | $($Row.Status) | $($Row.Checkpoint) | $($Row.NextStep) | $($Row.Notes) |"
}

function Read-PhaseTaskRowsFromContent {
    param(
        [string]$Content,
        [string]$PlanFile = ""
    )

    if ([string]::IsNullOrWhiteSpace($Content)) {
        return @()
    }

    $contract = Get-PhaseTaskTableContract
    $taskTableContent = Get-MarkdownSectionBody -Content $Content -SectionTitle $contract.SectionTitle
    if ([string]::IsNullOrWhiteSpace($taskTableContent)) {
        return @()
    }

    $rows = @()
    foreach ($line in [regex]::Split($taskTableContent, "\r?\n")) {
        $trimmed = $line.Trim()
        $match = [regex]::Match(
            $trimmed,
            $contract.RowPattern,
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
        )
        if (-not $match.Success) {
            $match = [regex]::Match(
                $trimmed,
                $contract.LegacyRowPattern,
                [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            )
            if (-not $match.Success) {
                continue
            }
        }

        if ($match.Groups["id"].Value.Trim() -eq "Task ID") {
            continue
        }

        $rows += [pscustomobject]@{
            planFile       = $PlanFile
            taskId         = $match.Groups["id"].Value.Trim()
            taskTitle      = $match.Groups["task"].Value.Trim()
            status         = $match.Groups["status"].Value.Trim().ToLowerInvariant()
            lastCheckpoint = $(if ($match.Groups["checkpoint"].Success) { $match.Groups["checkpoint"].Value.Trim() } else { "" })
            resumeNextStep = $(if ($match.Groups["next"].Success) { $match.Groups["next"].Value.Trim() } else { "" })
            notes          = $(if ($match.Groups["notes"].Success) { $match.Groups["notes"].Value.Trim() } else { "" })
        }
    }

    return $rows
}

function Read-PhaseTaskRowsFromFile {
    param(
        [string]$Path,
        [string]$PlanFile = ""
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return @()
    }

    $content = Get-Content -LiteralPath $Path -Encoding utf8 -Raw
    return Read-PhaseTaskRowsFromContent -Content $content -PlanFile $PlanFile
}

function Test-PhaseDetailTemplateTaskTableContract {
    param([string]$ToolsScriptRoot)

    $templatePath = Get-PhaseDetailTemplatePath -ToolsScriptRoot $ToolsScriptRoot
    $content = Get-Content -LiteralPath $templatePath -Encoding utf8 -Raw
    $contract = Get-PhaseTaskTableContract
    $issues = New-Object System.Collections.Generic.List[string]

    if ($content -notmatch [regex]::Escape($contract.SectionTitle)) {
        $issues.Add("Phase detail template is missing the shared Task Table section heading.")
    }

    if ($content -notmatch [regex]::Escape($contract.Header)) {
        $issues.Add("Phase detail template is missing the shared task-table header.")
    }

    if ($content -notmatch [regex]::Escape($contract.Separator)) {
        $issues.Add("Phase detail template is missing the shared task-table separator.")
    }

    return [string[]]$issues.ToArray()
}
