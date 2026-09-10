# DocMap:
# Layer: L3 / Codex Hook internal helper
# Module: codex-hooks
# Loaded by: codex-hooks/shared.ps1
# Documentation coverage, snapshots, and state helpers.

function Get-RelevantDocPatternsForSourcePath {
    param([string]$Path)

    $pathValue = Normalize-RepoPath $Path

    switch ($pathValue) {
        "AGENTS.md" {
            return @(".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "skills/INDEX.md", "agents/INDEX.md", "hooks/INDEX.md", "codex-hooks/INDEX.md", "tools/INDEX.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        ".claude/CLAUDE.md" {
            return @("AGENTS.md", "DOC-MAP.md", "README.md", "skills/INDEX.md", "agents/INDEX.md", "hooks/INDEX.md", "codex-hooks/INDEX.md", "tools/INDEX.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "DOC-MAP.md" {
            return @("AGENTS.md", ".claude/CLAUDE.md", "README.md", "skills/INDEX.md", "agents/INDEX.md", "hooks/INDEX.md", "codex-hooks/INDEX.md", "tools/INDEX.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "Product-Spec.md" {
            return @("DEV-PLAN.md", "Product-Spec-CHANGELOG.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "DEV-PLAN.md" {
            return @("Product-Spec.md", "TERMINOLOGY-AND-NAMING.md", "README.md")
        }
        "TERMINOLOGY-AND-NAMING.md" {
            return @("Product-Spec.md", "DEV-PLAN.md")
        }
        "skills/INDEX.md" {
            return @("skills/*", "AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "agents/INDEX.md" {
            return @("agents/*", "AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "hooks/INDEX.md" {
            return @("hooks/*", ".githooks/*", "AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "codex-hooks/INDEX.md" {
            return @("codex-hooks/*", ".githooks/*", "AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
        "tools/INDEX.md" {
            return @("tools/*", "AGENTS.md", ".claude/CLAUDE.md", "DOC-MAP.md", "README.md", "Product-Spec.md", "DEV-PLAN.md", "TERMINOLOGY-AND-NAMING.md")
        }
    }

    $patterns = New-Object System.Collections.Generic.List[string]

    if ($pathValue -like "skills/*" -or
        $pathValue -like "agents/*" -or
        $pathValue -like "hooks/*" -or
        $pathValue -like "codex-hooks/*" -or
        $pathValue -like "tools/*" -or
        $pathValue -like ".githooks/*" -or
        $pathValue -eq "settings.json" -or
        $pathValue -eq "codex-hooks.json") {
        $patterns.AddRange([string[]]@("README.md", "CHANGELOG.md", "CONTRIBUTING.md", "DOC-MAP.md", "Product-Spec.md", "Product-Spec-CHANGELOG.md", "DEV-PLAN.md", "Design-Brief.md", "AGENTS.md", ".claude/CLAUDE.md", "TERMINOLOGY-AND-NAMING.md", "docs/*", "plans/*"))
    }
    else {
        $patterns.AddRange([string[]]@("CHANGELOG.md", "Product-Spec.md", "Product-Spec-CHANGELOG.md", "DEV-PLAN.md", "Design-Brief.md", "docs/*", "plans/*"))
    }

    switch -Wildcard ($pathValue) {
        "skills/*" { $patterns.Add("skills/INDEX.md") }
        "agents/*" { $patterns.Add("agents/INDEX.md") }
        "hooks/*" { $patterns.Add("hooks/INDEX.md") }
        "codex-hooks/*" { $patterns.Add("codex-hooks/INDEX.md") }
        "tools/*" { $patterns.Add("tools/INDEX.md") }
        ".githooks/*" {
            $patterns.Add("hooks/INDEX.md")
            $patterns.Add("codex-hooks/INDEX.md")
            $patterns.Add("tools/INDEX.md")
        }
    }

    return $patterns.ToArray()
}

function Test-RelevantDocForSourcePath {
    param(
        [string]$DocPath,
        [string]$SourcePath
    )

    $docValue = Normalize-RepoPath $DocPath
    $sourceValue = Normalize-RepoPath $SourcePath

    if ([string]::IsNullOrWhiteSpace($docValue) -or
        [string]::IsNullOrWhiteSpace($sourceValue) -or
        $docValue -eq $sourceValue -or
        -not (Test-SourceChangeRepoPath $sourceValue)) {
        return $false
    }

    foreach ($pattern in (Get-RelevantDocPatternsForSourcePath $sourceValue)) {
        if ($docValue -like $pattern) {
            return $true
        }
    }

    return $false
}

function ConvertFrom-GitNullSeparatedBytes {
    param([byte[]]$Bytes)

    if ($null -eq $Bytes -or $Bytes.Length -eq 0) {
        return @()
    }
    if ($Bytes[$Bytes.Length - 1] -ne 0) {
        throw [System.IO.InvalidDataException]::new("Git NUL-separated output is not terminated.")
    }

    $encoding = New-Object System.Text.UTF8Encoding($false, $true)
    $fields = New-Object System.Collections.Generic.List[string]
    $start = 0
    for ($index = 0; $index -lt $Bytes.Length; $index += 1) {
        if ($Bytes[$index] -ne 0) {
            continue
        }

        $fields.Add($encoding.GetString($Bytes, $start, $index - $start))
        $start = $index + 1
    }

    return $fields.ToArray()
}

function ConvertFrom-GitNameStatusBytes {
    param(
        [byte[]]$Bytes,
        [ValidateSet("cached", "unstaged")][string]$Scope
    )

    $fields = @(ConvertFrom-GitNullSeparatedBytes -Bytes $Bytes)
    $records = New-Object System.Collections.Generic.List[object]
    $index = 0
    while ($index -lt $fields.Count) {
        $status = [string]$fields[$index]
        $index += 1
        if ($status -notmatch '^(A|C\d*|M|R\d*|D)$') {
            throw [System.IO.InvalidDataException]::new("Unexpected Git change status: $status")
        }

        if ($status -like "R*" -or $status -like "C*") {
            if (($index + 1) -ge $fields.Count) {
                throw [System.IO.InvalidDataException]::new("Git rename/copy record is incomplete.")
            }
            $oldPath = Normalize-RepoPath ([string]$fields[$index])
            $newPath = Normalize-RepoPath ([string]$fields[$index + 1])
            $index += 2
            $records.Add([pscustomobject]@{ Status = $status; Path = $newPath; OldPath = $oldPath; Scope = $Scope })
        }
        else {
            if ($index -ge $fields.Count) {
                throw [System.IO.InvalidDataException]::new("Git change record is incomplete.")
            }
            $path = Normalize-RepoPath ([string]$fields[$index])
            $index += 1
            $records.Add([pscustomobject]@{ Status = $status; Path = $path; OldPath = ""; Scope = $Scope })
        }
    }

    return $records.ToArray()
}

function Invoke-CodexHookTrustedGitBytes {
    param(
        [Parameter(Mandatory = $true)]$Git,
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string[]]$GitArgs
    )

    if ([string]::IsNullOrWhiteSpace([string]$Git.Source) -or $GitArgs.Count -eq 0) {
        $global:LASTEXITCODE = 127
        return $null
    }

    $trustedArgs = @("--no-pager", "-c", "core.fsmonitor=false")
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

    $processStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processStartInfo.FileName = [string]$Git.Source
    $processStartInfo.WorkingDirectory = $Root
    $processStartInfo.UseShellExecute = $false
    $processStartInfo.CreateNoWindow = $true
    $processStartInfo.RedirectStandardOutput = $true
    $processStartInfo.RedirectStandardError = $true

    if ($null -ne $processStartInfo.GetType().GetProperty("ArgumentList")) {
        foreach ($argument in $trustedArgs) {
            [void]$processStartInfo.ArgumentList.Add([string]$argument)
        }

        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo = $processStartInfo
        $outputStream = [System.IO.MemoryStream]::new()
        try {
            if (-not $process.Start()) {
                $global:LASTEXITCODE = 127
                return $null
            }

            $stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($outputStream)
            $stderrTask = $process.StandardError.BaseStream.CopyToAsync([System.IO.Stream]::Null)
            $process.WaitForExit()
            [void]$stdoutTask.GetAwaiter().GetResult()
            [void]$stderrTask.GetAwaiter().GetResult()
            $global:LASTEXITCODE = $process.ExitCode
            if ($process.ExitCode -ne 0) {
                return $null
            }

            return ,$outputStream.ToArray()
        }
        finally {
            $outputStream.Dispose()
            $process.Dispose()
        }
    }

    $stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString("N")) + ".stdout")
    $stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) (([guid]::NewGuid().ToString("N")) + ".stderr")
    try {
        $process = Start-Process -FilePath ([string]$Git.Source) `
            -ArgumentList $trustedArgs `
            -WorkingDirectory $Root `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath
        $global:LASTEXITCODE = $process.ExitCode
        if ($process.ExitCode -ne 0) {
            return $null
        }

        return ,[System.IO.File]::ReadAllBytes($stdoutPath)
    }
    finally {
        Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-GitChangeEnumerationResult {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    if ([string]::IsNullOrWhiteSpace($Root)) {
        return [pscustomobject]@{ Succeeded = $false; Records = @() }
    }

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git) {
        return [pscustomobject]@{ Succeeded = $false; Records = @() }
    }

    Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs @("rev-parse", "--git-dir") *> $null
    if ($LASTEXITCODE -ne 0) {
        return [pscustomobject]@{ Succeeded = $false; Records = @() }
    }

    $records = New-Object System.Collections.Generic.List[object]

    if ($Scope -eq "cached" -or $Scope -eq "all") {
        $bytes = Invoke-CodexHookTrustedGitBytes -Git $git -Root $Root -GitArgs @("diff", "--cached", "--name-status", "-z", "--diff-filter=ACMRD")
        if ($LASTEXITCODE -ne 0 -or $null -eq $bytes) {
            return [pscustomobject]@{ Succeeded = $false; Records = @() }
        }
        foreach ($record in @(ConvertFrom-GitNameStatusBytes -Bytes $bytes -Scope "cached")) {
            $records.Add($record)
        }
    }

    if ($Scope -eq "unstaged" -or $Scope -eq "all") {
        $bytes = Invoke-CodexHookTrustedGitBytes -Git $git -Root $Root -GitArgs @("diff", "--name-status", "-z", "--diff-filter=ACMRD")
        if ($LASTEXITCODE -ne 0 -or $null -eq $bytes) {
            return [pscustomobject]@{ Succeeded = $false; Records = @() }
        }
        foreach ($record in @(ConvertFrom-GitNameStatusBytes -Bytes $bytes -Scope "unstaged")) {
            $records.Add($record)
        }
    }

    if ($Scope -eq "untracked" -or $Scope -eq "all") {
        $bytes = Invoke-CodexHookTrustedGitBytes -Git $git -Root $Root -GitArgs @("ls-files", "--others", "--exclude-standard", "-z")
        if ($LASTEXITCODE -ne 0 -or $null -eq $bytes) {
            return [pscustomobject]@{ Succeeded = $false; Records = @() }
        }
        foreach ($path in @(ConvertFrom-GitNullSeparatedBytes -Bytes $bytes)) {
            if ([string]::IsNullOrWhiteSpace($path)) { continue }
            $records.Add([pscustomobject]@{ Status = "A"; Path = (Normalize-RepoPath $path); OldPath = ""; Scope = "untracked" })
        }
    }

    return [pscustomobject]@{ Succeeded = $true; Records = $records.ToArray() }
}

function Get-GitChangeRecords {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    return (Get-GitChangeEnumerationResult -Root $Root -Scope $Scope).Records
}

function Get-CurrentSourceChangeRecords {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    $records = New-Object System.Collections.Generic.List[object]

    foreach ($record in (Get-GitChangeRecords -Root $Root -Scope $Scope)) {
        if ($record.Scope -eq "cached") {
            if (Test-StagedRecordRequiresReview -Root $Root -Record $record) {
                $records.Add($record)
            }
        }
        elseif ($record.Scope -eq "unstaged") {
            if (Test-WorktreeRecordRequiresReview -Root $Root -Record $record) {
                $records.Add($record)
            }
        }
        elseif ($record.Scope -eq "untracked") {
            if (Test-UntrackedRecordRequiresReview -Root $Root -Record $record) {
                $records.Add($record)
            }
        }
    }

    return $records.ToArray()
}

function Get-StrictSourceRecords {
    param(
        [string]$Root,
        [Parameter(Mandatory = $true)][object[]]$Records
    )

    $strictRecords = New-Object System.Collections.Generic.List[object]

    foreach ($record in $Records) {
        if ($record.Scope -eq "cached") {
            if (Test-StagedRecordRequiresStrictReview -Root $Root -Record $record) {
                $strictRecords.Add($record)
            }
        }
        elseif ($record.Scope -eq "unstaged") {
            if (Test-WorktreeRecordRequiresStrictReview -Root $Root -Record $record) {
                $strictRecords.Add($record)
            }
        }
        elseif ($record.Scope -eq "untracked") {
            if (Test-UntrackedRecordRequiresStrictReview -Root $Root -Record $record) {
                $strictRecords.Add($record)
            }
        }
    }

    return $strictRecords.ToArray()
}

function Get-CurrentStrictSourceChangeRecords {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    return Get-StrictSourceRecords -Root $Root -Records @(Get-GitChangeRecords -Root $Root -Scope $Scope)
}

function Get-CurrentT2LightChangeRecords {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    $records = New-Object System.Collections.Generic.List[object]

    foreach ($record in (Get-GitChangeRecords -Root $Root -Scope $Scope)) {
        if ($record.Scope -eq "cached") {
            if (Test-StagedRecordRequiresT2Check -Root $Root -Record $record) {
                $records.Add($record)
            }
        }
        elseif ($record.Scope -eq "unstaged") {
            if (Test-WorktreeRecordRequiresT2Check -Root $Root -Record $record) {
                $records.Add($record)
            }
        }
        elseif ($record.Scope -eq "untracked") {
            if (Test-UntrackedRecordRequiresT2Check -Root $Root -Record $record) {
                $records.Add($record)
            }
        }
    }

    return $records.ToArray()
}

function Test-ChangeCanCoverSource {
    param(
        [string]$Root,
        [string]$Status = "M",
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "cached",
        [string]$CoverPath,
        [string]$SourcePath
    )

    $coverValue = Normalize-RepoPath $CoverPath
    $sourceValue = Normalize-RepoPath $SourcePath

    if (-not (Test-RelevantDocForSourcePath -DocPath $coverValue -SourcePath $sourceValue)) {
        return $false
    }

    if ($coverValue -eq "Product-Spec-CHANGELOG.md") {
        return $true
    }

    $tier = "t0"
    if ($Scope -eq "cached" -or $Scope -eq "all") {
        $tier = Get-StagedChangeExecutionTier -Root $Root -Path $coverValue -Status $Status
    }
    elseif ($Scope -eq "unstaged") {
        $tier = Get-WorktreeChangeExecutionTier -Root $Root -Path $coverValue -Status $Status
    }
    elseif ($Scope -eq "untracked") {
        $tier = Get-UntrackedChangeExecutionTier -Root $Root -Path $coverValue
    }

    if ((Get-ExecutionTierRank $tier) -ge 2) {
        return $true
    }

    return (Get-ExecutionTierRank (Get-RepoPathExecutionTier $coverValue)) -ge 2
}

function Test-CurrentDocSyncHasUncoveredSources {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    $sources = @(Get-CurrentSourceChangeRecords -Root $Root -Scope $Scope)
    if ($sources.Count -eq 0) {
        return $false
    }

    $covers = @(Get-GitChangeRecords -Root $Root -Scope $Scope)

    foreach ($source in $sources) {
        $covered = $false
        foreach ($cover in $covers) {
            if (Test-ChangeCanCoverSource -Root $Root -Status $cover.Status -Scope $cover.Scope -CoverPath $cover.Path -SourcePath $source.Path) {
                $covered = $true
                break
            }
        }

        if (-not $covered) {
            return $true
        }
    }

    return $false
}

function Test-StrictSourceRecordsHaveDocSyncCoverage {
    param(
        [string]$Root,
        [Parameter(Mandatory = $true)][object[]]$Records
    )

    $sources = @(Get-StrictSourceRecords -Root $Root -Records $Records)
    if ($sources.Count -eq 0) {
        return $false
    }

    foreach ($source in $sources) {
        $covered = $false
        foreach ($cover in $Records) {
            if (Test-ChangeCanCoverSource -Root $Root -Status $cover.Status -Scope $cover.Scope -CoverPath $cover.Path -SourcePath $source.Path) {
                $covered = $true
                break
            }
        }

        if (-not $covered) {
            return $true
        }
    }

    return $false
}

function Test-CurrentDocSyncHasUncoveredStrictSources {
    param(
        [string]$Root,
        [ValidateSet("cached", "unstaged", "untracked", "all")][string]$Scope = "all"
    )

    $records = @(Get-GitChangeRecords -Root $Root -Scope $Scope)
    if ($records.Count -eq 0) {
        return $false
    }

    return Test-StrictSourceRecordsHaveDocSyncCoverage -Root $Root -Records $records
}

function Get-StagedReviewSnapshotHash {
    param([string]$Root)

    $records = @(Get-CurrentSourceChangeRecords -Root $Root -Scope "cached")
    if ($records.Count -eq 0) {
        return ""
    }

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git) {
        return ""
    }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("review-snapshot-v2")
    foreach ($record in $records) {
        if ([string]::IsNullOrWhiteSpace($record.OldPath)) {
            $lines.Add(("record`t{0}`t{1}`t" -f $record.Status, $record.Path))
            $diffArgs = @("diff", "--cached", "--binary", "--", $record.Path)
        }
        else {
            $lines.Add(("record`t{0}`t{1}`t{2}" -f $record.Status, $record.OldPath, $record.Path))
            $diffArgs = @("diff", "--cached", "--binary", "--", $record.OldPath, $record.Path)
        }

        $diffLines = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs $diffArgs 2>$null
        foreach ($line in @($diffLines)) {
            $lines.Add([string]$line)
        }
        $lines.Add("")
        $lines.Add("end-record")
    }

    $content = ($lines -join "`n") + "`n"
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tmp, $content, $utf8NoBom)

        $hash = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs @("hash-object", $tmp) 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hash)) {
            return ""
        }

        return [string]$hash
    }
    finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Get-StagedT2CheckSnapshotHash {
    param([string]$Root)

    $records = @(Get-CurrentT2LightChangeRecords -Root $Root -Scope "cached")
    if ($records.Count -eq 0) {
        return ""
    }

    $git = Get-TrustedGitCommand -Root $Root
    if (-not $git) {
        return ""
    }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("t2-check-snapshot-v1")
    foreach ($record in $records) {
        if ([string]::IsNullOrWhiteSpace($record.OldPath)) {
            $lines.Add(("record`t{0}`t{1}`t" -f $record.Status, $record.Path))
            $diffArgs = @("diff", "--cached", "--binary", "--", $record.Path)
        }
        else {
            $lines.Add(("record`t{0}`t{1}`t{2}" -f $record.Status, $record.OldPath, $record.Path))
            $diffArgs = @("diff", "--cached", "--binary", "--", $record.OldPath, $record.Path)
        }

        $diffLines = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs $diffArgs 2>$null
        foreach ($line in @($diffLines)) {
            $lines.Add([string]$line)
        }
        $lines.Add("")
        $lines.Add("end-record")
    }

    $content = ($lines -join "`n") + "`n"
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tmp, $content, $utf8NoBom)

        $hash = Invoke-CodexHookTrustedGit -Git $git -Root $Root -GitArgs @("hash-object", $tmp) 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hash)) {
            return ""
        }

        return [string]$hash
    }
    finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
}

function Read-StateValue {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return ""
    }

    return (((Get-Content -LiteralPath $Path -Raw -Encoding UTF8) -replace "^\uFEFF", "") -replace "\s", "")
}

function Write-StateValue {
    param(
        [string]$Path,
        [string]$Value
    )

    $parent = Split-Path -Path $Path -Parent
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Value, $utf8NoBom)
}
