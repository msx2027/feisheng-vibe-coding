param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'
$inventoryPath = Join-Path $RepoRoot 'provenance/SKILL-INVENTORY.json'
$outputPath = Join-Path $RepoRoot 'provenance/CANONICAL-CATALOG.json'
$inventory = Get-Content -Raw -Encoding UTF8 -LiteralPath $inventoryPath | ConvertFrom-Json

$mattRevision = '9fe7e7a3bb352851b986725bab1c7cfb17610a97'
$sliverRevision = '30c7cfb363c7ea58121e98edfd321c2cf396098e'

$uiSkills = @('ui-ux-pro-max','impeccable','design-system','ui-styling','brand','layout','polish','adapt','animate','colorize','bolder','delight','distill','overdrive','quieter','typeset')
$eventOnly = @('experience-elevator','feedback-writer','evolution-engine')
$mattAdapters = @('implement','improve-codebase-architecture','to-spec','to-tickets','triage','wayfinder','setup-matt-pocock-skills')
$mattUserTools = @('grill-me','grill-with-docs','handoff','teach','to-questionnaire','wait-what','ask-matt')
$acceptedMatt = @('diagnosing-bugs','codebase-design','domain-modeling')
$blockedMatt = @('code-review','tdd')

$records = @()
foreach ($row in @($inventory.skills)) {
    $source = [string]$row.source
    $candidate = [string]$row.canonicalCandidate
    $relative = ([string]$row.path).Replace('\', '/')
    $id = $candidate
    $status = 'source-only-unreviewed'
    $revision = $null
    $path = $relative

    if ($source -eq 'sliver-vibe-coding') {
        $id = 'sliver-vibe-coding'
        $status = 'control-plane'
        $revision = $sliverRevision
        $path = 'governance/sliver-core/SKILL.md'
    } elseif ($source -eq 'vibe-coding-skills') {
        $revision = $null
        $path = 'sources/vibe-coding-skills/' + $relative
        if ($candidate -eq 'vibe-coding-skills') { $status = 'compatibility-alias' }
        elseif ($eventOnly -contains $candidate) { $status = 'event-only-source-only' }
        elseif ($uiSkills -contains $candidate) { $status = 'source-only-ui' }
        elseif ($candidate -in @('product-spec-builder','design-brief-builder','design-maker','dev-planner','dev-builder','architecture-foundation','target-constitution-setup','target-runtime-setup','bug-fixer','test-automation','requirements-test-designer','release-builder','audit','critique','optimize','harden','ui-system-guardian','doc-sync-guardian','codebase-memory-scout','hotspot-governor','rule-harvester','skill-builder')) { $status = 'source-only-product-or-checker' }
        if ($candidate -eq 'code-review') { $id = 'vibe-code-review'; $status = 'source-only-checker' }
    } elseif ($source -eq 'mattpocock-skills') {
        $revision = $mattRevision
        $path = 'sources/mattpocock-skills/' + $relative
        if ($candidate -eq 'mattpocock-code-review' -or $relative -match '/code-review/SKILL\.md$') { $id = 'code-review'; $status = 'blocked-unclassified-working-tree' }
        elseif ($candidate -eq 'tdd') { $id = 'tdd'; $status = 'blocked-unclassified-working-tree' }
        elseif ($acceptedMatt -contains $candidate) {
            $status = 'accepted-primitive'
            $path = 'skills/engineering/' + $candidate + '/SKILL.md'
        }
        elseif ($mattAdapters -contains $candidate) { $status = 'adapter-candidate' }
        elseif ($mattUserTools -contains $candidate) { $status = if ($candidate -eq 'ask-matt') { 'compatibility-selector' } else { 'source-only-user-tool' } }
        elseif ($relative -like 'skills/in-progress/*') { $status = 'excluded-in-progress' }
        elseif ($candidate -in @('research','prototype','wizard','resolving-merge-conflicts','git-guardrails-claude-code','migrate-to-shoehorn','scaffold-exercises','setup-pre-commit','grilling','writing-for-agents')) { $status = 'source-only-primitive' }
    }

    $records += [ordered]@{
        id = $id
        source = $source
        path = $path
        sourceRevision = $revision
        invocation = [string]$row.invocation
        status = $status
        sourceSha256 = [string]$row.sha256
        writeAuthority = @()
    }
}

$records = @($records | Sort-Object id, source)
$output = [ordered]@{
    schema = 'feisheng-canonical-skill-catalog/v1'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    owner = 'skill-catalog'
    projectEntry = 'SKILL.md'
    routeOwner = 'governance/sliver-core/references/routes-index.md'
    sourceInventory = 'provenance/SKILL-INVENTORY.json'
    records = $records
    duplicateGroups = @(
        [ordered]@{ id = 'project-entry'; owner = 'sliver-vibe-coding'; aliases = @('vibe-coding-skills','ask-matt'); rule = 'aliases may select or activate but cannot own project routing' },
        [ordered]@{ id = 'review-and-test'; owner = 'sliver-validation-gate'; members = @('vibe-code-review','code-review','tdd'); rule = 'specialized methods return findings/results; Sliver owns the gate' },
        [ordered]@{ id = 'truth-and-planning'; owner = 'target-truth'; members = @('product-spec-builder','dev-planner','to-spec','to-tickets','wayfinder'); rule = 'adapters project to target-truth and cannot create a parallel spec owner' }
    )
    decisionPolicy = [ordered]@{
        acceptedStatuses = @('control-plane','accepted-primitive')
        runtimeExcludedStatuses = @('blocked-unclassified-working-tree','source-only-unreviewed','source-only-ui','source-only-product-or-checker','source-only-checker','source-only-user-tool','source-only-primitive','event-only-source-only','adapter-candidate','compatibility-alias','compatibility-selector','excluded-in-progress')
        generatedProjectionsAreReadOnly = $true
    }
}

$output | ConvertTo-Json -Depth 12 | Set-Content -Encoding UTF8 -LiteralPath $outputPath
Write-Output "Generated $outputPath with $($records.Count) records."
