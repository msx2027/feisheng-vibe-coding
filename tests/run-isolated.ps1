[CmdletBinding()]
param(
    [string]$RepositoryRoot = ''
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) { $RepositoryRoot = Split-Path -Parent $PSScriptRoot }
$repo = [IO.Path]::GetFullPath($RepositoryRoot)
$work = Join-Path $repo ('_tmp/test-run-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null
try {
    $tests = @('test-collector-path-resolution.ps1','test-vibe-hook-adapter.ps1')
    foreach ($name in $tests) {
        Write-Host "RUN $name"
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $name) -RepositoryRoot $repo *>&1 |
            Tee-Object -FilePath (Join-Path $work ($name + '.log'))
        if ($LASTEXITCODE -ne 0) { throw "测试失败: $name (exit=$LASTEXITCODE)" }
    }
    Write-Host 'PASS: 隔离测试全部通过'
} finally {
    if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}
