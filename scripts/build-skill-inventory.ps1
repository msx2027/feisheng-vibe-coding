param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,
    [Parameter(Mandatory = $true)]
    [string]$SourceRootBase
)

$ErrorActionPreference = 'Stop'

# 规范化运行时闸门：本脚本无条件写入库镜像 provenance/SKILL-INVENTORY.json，只允许 PowerShell 7 (pwsh) 运行。
# Windows PowerShell 5.1 下 ConvertTo-Json 每层缩进 4 空格（pwsh 7 为 2 空格），且 Set-Content -Encoding UTF8
# 会多写 3 字节 BOM（ef bb bf；2026-09-28 同内容实测：5.1 得 17 字节、7 得 14 字节；两者行尾同为 CRLF）。
# 同一份数据落盘体积近乎翻倍，而门禁的 catalog 对账比的是解析后的语义，抓不到这种膨胀。
# 口径与理由同 build-canonical-catalog.ps1 的同名闸门（2026-09-28 实测 158,273 → 289,370 字节）。
if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw ('拒绝用 Windows PowerShell ' + $PSVersionTable.PSVersion.ToString() + ' 生成入库镜像: ' +
        '5.1 的 JSON 每层 4 空格缩进外加 3 字节 BOM，会把入库文件体积推高近一倍且语义对账抓不到。' +
        ' 请改用 PowerShell 7 重跑: pwsh -NoProfile -File scripts/build-skill-inventory.ps1 ...')
}

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
