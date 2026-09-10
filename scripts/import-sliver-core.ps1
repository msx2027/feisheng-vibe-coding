param(
    [Parameter(Mandatory = $true)]
    [string]$TargetRoot,
    [Parameter(Mandatory = $true)]
    [string]$SourceRoot
)

$ErrorActionPreference = 'Stop'
$coreRoot = Join-Path $TargetRoot 'governance/sliver-core'
if (Test-Path -LiteralPath $coreRoot) {
    throw "Target core already exists: $coreRoot"
}

New-Item -ItemType Directory -Path $coreRoot | Out-Null

$filePaths = @(
    'SKILL.md',
    '.gitignore',
    'README.md',
    'LICENSE',
    'VERSION',
    'CHANGELOG.md',
    'COMPATIBILITY.md',
    'packaging/runtime-manifest.json',
    'scripts/check_project_guardrails.py',
    'scripts/runtime_decision_contract.py',
    'scripts/runtime_file_set.py',
    'scripts/runtime_governance_contract.py',
    'scripts/runtime_identity.py',
    'scripts/runtime_manifest_contract.py',
    'scripts/runtime_required_assets.py',
    'scripts/stage_contract.py',
    'scripts/migrate_stage_contract.py',
    'scripts/validation_support.py',
    'scripts/validate_runtime_bundle.py',
    'scripts/validate_skill.py'
)

$directoryPaths = @(
    'references',
    'assets/project-bootstrap',
    'assets/project-adoption',
    'assets/project-design',
    'assets/project-stage',
    'assets/project-feature',
    'assets/project-decision',
    'assets/project-audit',
    'scripts',
    'tests',
    'plugins',
    '.agents/plugins',
    '.github/workflows',
    'packaging/adapters'
)

foreach ($relativePath in $filePaths) {
    $sourcePath = Join-Path $SourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Missing source file: $sourcePath"
    }
    $destinationPath = Join-Path $coreRoot $relativePath
    $destinationParent = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
}

foreach ($relativePath in $directoryPaths) {
    $sourcePath = Join-Path $SourceRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
        throw "Missing source directory: $sourcePath"
    }
    $destinationPath = Join-Path $coreRoot $relativePath
    $destinationParent = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationParent -Recurse
}

$revision = (& git -C $SourceRoot rev-parse HEAD 2>$null).Trim()
$status = @(& git -C $SourceRoot status --short 2>$null)
$record = [ordered]@{
    schema = 'feisheng-import-record/v1'
    source = 'sliver-vibe-coding'
    sourceRoot = $SourceRoot
    sourceRevision = $revision
    sourceWorkingTree = if ($status.Count -eq 0) { 'clean' } else { 'modified' }
    importedRoot = 'governance/sliver-core'
    importedFiles = $filePaths + $directoryPaths
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    note = 'Imported as an isolated governance source; not a second public entry.'
}
$recordPath = Join-Path $TargetRoot 'provenance/SLIVER-IMPORT.json'
$record | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $recordPath
Write-Output "Imported Sliver core to $coreRoot"
