param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$OutputRoot
)

$ErrorActionPreference = 'Stop'
$catalogPath = Join-Path $RepoRoot 'provenance/CANONICAL-CATALOG.json'
$projectionPath = Join-Path $RepoRoot 'packaging/runtime-projection.json'
$catalog = Get-Content -Raw -Encoding UTF8 -LiteralPath $catalogPath | ConvertFrom-Json
$projection = Get-Content -Raw -Encoding UTF8 -LiteralPath $projectionPath | ConvertFrom-Json
$includes = @($projection.hosts.codex.include)
if ($includes.Count -eq 0) { throw 'Codex projection has no approved includes.' }

if (Test-Path -LiteralPath $OutputRoot) { throw "Output directory already exists; choose a new path: $OutputRoot" }
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$records = @($catalog.records | Where-Object { $_.status -in @('control-plane', 'accepted-primitive') })
foreach ($relativePath in $includes) {
    $sourcePath = Join-Path $RepoRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) { throw "Approved projection input missing: $relativePath" }
    $destinationPath = Join-Path $OutputRoot $relativePath
    if ((Get-Item -LiteralPath $sourcePath).PSIsContainer) {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination (Split-Path -Parent $destinationPath) -Recurse
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destinationPath) | Out-Null
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }
}

$blockedIds = @($catalog.records | Where-Object { $_.status -like 'blocked*' } | ForEach-Object { $_.id })
$outputFiles = @(Get-ChildItem -LiteralPath $OutputRoot -Recurse -File)
$forbidden = @($outputFiles | Where-Object {
    $relative = $_.FullName.Substring($OutputRoot.Length + 1).Replace('\\', '/')
    $relative -match '(^|/)code-review(/|$)' -or
    $relative -match '(^|/)tdd(/|$)' -or
    $relative -eq 'skills/ROUTING-MANIFEST.json' -or
    $relative -eq 'MANIFEST.json'
})
if ($forbidden.Count -gt 0) { throw "Forbidden files entered projection: $($forbidden.FullName -join ', ')" }
$manifest = [ordered]@{
    schema = 'feisheng-codex-projection/v1'
    sourceCatalog = 'provenance/CANONICAL-CATALOG.json'
    records = @($records | ForEach-Object { $_.id })
    blockedRecordsExcluded = $blockedIds
    files = $outputFiles.Count
    freshSessionSmoke = 'UNVERIFIED'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $OutputRoot 'projection-manifest.json')
Write-Output "Generated Codex candidate projection with $($outputFiles.Count) files; fresh-session smoke remains UNVERIFIED."
