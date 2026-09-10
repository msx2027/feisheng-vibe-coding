param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,
    [Parameter(Mandatory = $true)]
    [string]$SourceRootBase
)

$ErrorActionPreference = 'Stop'

$sourceRoots = [ordered]@{
    'sliver-vibe-coding' = Join-Path $SourceRootBase 'sliver-vibe-coding'
    'vibe-coding-skills' = Join-Path $SourceRootBase 'vibe-coding-skills'
    'mattpocock-skills' = Join-Path $SourceRootBase 'mattpocock-skills'
}

function Get-FrontmatterValue {
    param(
        [string]$Text,
        [string]$Key
    )

    $pattern = '(?m)^' + [regex]::Escape($Key) + ':\s*["'']?([^"''\r\n]+)'
    $match = [regex]::Match($Text, $pattern)
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }
    return $null
}

function Get-SkillRow {
    param(
        [string]$SourceId,
        [string]$SourceRoot,
        [System.IO.FileInfo]$File,
        [hashtable]$RevisionSourced
    )

    # 工作树未采用、改取已提交 revision 内容的文件：以**快照**为准
    # （快照里就是已采纳的已提交内容），不读工作树，避免把未提交改动当成事实。
    $relativePath = $File.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')
    $key = $SourceId + '|' + ($relativePath -replace '\\', '/')
    $contentFile = $File
    if ($RevisionSourced.ContainsKey($key)) {
        $snapshotPath = Join-Path $TargetRoot ($RevisionSourced[$key])
        if (-not (Test-Path -LiteralPath $snapshotPath -PathType Leaf)) {
            throw "revision 来源文件在快照中缺失: $snapshotPath"
        }
        $contentFile = Get-Item -LiteralPath $snapshotPath
    }

    $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $contentFile.FullName
    $skillName = Get-FrontmatterValue -Text $content -Key 'name'
    $description = Get-FrontmatterValue -Text $content -Key 'description'
    $disabled = $content -match '(?m)^disable-model-invocation:\s*true\s*$'
    $sha = (Get-FileHash -Algorithm SHA256 -LiteralPath $contentFile.FullName).Hash.ToLowerInvariant()

    if ([string]::IsNullOrWhiteSpace($skillName)) {
        $skillName = [System.IO.Path]::GetFileName($File.DirectoryName)
    }

    [pscustomobject]@{
        source = $SourceId
        canonicalCandidate = $skillName
        path = $relativePath
        invocation = if ($disabled) { 'user-invoked' } else { 'model-invoked-or-user-invoked' }
        description = $description
        sha256 = $sha
    }
}

$rows = [System.Collections.Generic.List[object]]::new()
$sourceSummary = [ordered]@{}

# provenance 记录里登记的「改取已提交 revision 内容」的路径（单一真源：导入记录）
$revisionSourced = @{}
$importRecordPath = Join-Path $TargetRoot 'provenance/MATT-IMPORT.json'
if (Test-Path -LiteralPath $importRecordPath -PathType Leaf) {
    $importRecord = Get-Content -Raw -Encoding UTF8 -LiteralPath $importRecordPath | ConvertFrom-Json
    if ($importRecord.PSObject.Properties.Name -contains 'committedRevisionFiles') {
        $snapshotRoot = ([string]$importRecord.snapshotRoot).Replace('\', '/')
        foreach ($entry in @($importRecord.committedRevisionFiles)) {
            $rel = ([string]$entry.path).Replace('\', '/')
            $revisionSourced[('mattpocock-skills|' + $rel)] = ($snapshotRoot + '/' + $rel)
        }
    }
}

foreach ($entry in $sourceRoots.GetEnumerator()) {
    $sourceId = $entry.Key
    $sourceRoot = $entry.Value
    if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
        throw "Source directory does not exist: $sourceRoot"
    }

    if ($sourceId -eq 'sliver-vibe-coding') {
        $skillFiles = @(Get-Item -LiteralPath (Join-Path $sourceRoot 'SKILL.md'))
        $sourceSummary[$sourceId] = [ordered]@{
            sourceSkillFiles = $skillFiles.Count
            internalRouteRegistry = 'references/routes-index.md'
        }
    }
    else {
        $skillRoot = Join-Path $sourceRoot 'skills'
        $skillFiles = @(Get-ChildItem -LiteralPath $skillRoot -Recurse -File -Filter 'SKILL.md' | Sort-Object FullName)
        $sourceSummary[$sourceId] = [ordered]@{
            sourceSkillFiles = $skillFiles.Count
            sourceRoot = 'skills/'
        }
    }

    foreach ($skillFile in $skillFiles) {
        $rows.Add((Get-SkillRow -SourceId $sourceId -SourceRoot $sourceRoot -File $skillFile -RevisionSourced $revisionSourced))
    }
}

$exactNameGroups = @($rows | Group-Object canonicalCandidate | Where-Object { $_.Count -gt 1 } | ForEach-Object {
    [pscustomobject]@{
        canonicalCandidate = $_.Name
        sources = @($_.Group | Select-Object -ExpandProperty source -Unique)
        paths = @($_.Group | Select-Object -ExpandProperty path)
        decision = 'pending-semantic-review'
    }
})

$output = [ordered]@{
    schema = 'feisheng-skill-inventory/v1'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    sourceSummary = $sourceSummary
    exactNameDuplicates = $exactNameGroups
    skills = @($rows)
    semanticDecisions = 'provenance/SKILL-DECISIONS.md'
}

$outputPath = Join-Path $targetRoot 'provenance/SKILL-INVENTORY.json'
$output | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath $outputPath
Write-Output "Generated $outputPath with $($rows.Count) skill records."
