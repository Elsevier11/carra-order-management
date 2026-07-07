param(
  [switch]$DryRun,
  [switch]$Docker,
  [switch]$Aggressive,
  [switch]$Volumes,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
  @'
Usage: cleanup-workspace.ps1 [-DryRun] [-Docker] [-Aggressive] [-Volumes]

Deletes only build/cache artifacts inside the repository:
  - node_modules
  - dist
  - .turbo
  - coverage
  - frontend/node_modules
  - frontend/dist
  - frontend/.angular
  - frontend/.vite
  - frontend/coverage

Optional Docker cleanup:
  -Docker      prune stopped containers, builder cache and unused images
  -Aggressive  also run docker image prune -af and docker builder prune -af
  -Volumes     also prune unused Docker volumes

Use -DryRun first to preview the actions.
'@ | Write-Host
}

if ($Help) {
  Show-Usage
  exit 0
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path (Join-Path $scriptDir '..')).Path
if (-not (Test-Path -LiteralPath (Join-Path $rootDir '.git'))) {
  throw "Repository root not found from $scriptDir"
}

Set-Location $rootDir

$targets = @(
  'node_modules',
  'dist',
  '.turbo',
  'coverage',
  'frontend/node_modules',
  'frontend/dist',
  'frontend/.angular',
  'frontend/.vite',
  'frontend/coverage'
)

function Remove-Target {
  param([Parameter(Mandatory = $true)][string]$RelativePath)

  $fullPath = Join-Path $rootDir $RelativePath
  if (-not (Test-Path -LiteralPath $fullPath)) {
    return
  }

  $resolvedPath = (Resolve-Path -LiteralPath $fullPath).Path
  $rootPrefix = $rootDir.TrimEnd('\') + '\'
  if (-not $resolvedPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete outside repo: $resolvedPath"
  }

  if ($DryRun) {
    Write-Host "[dry-run] Remove-Item -LiteralPath `"$resolvedPath`" -Recurse -Force"
    return
  }

  Remove-Item -LiteralPath $resolvedPath -Recurse -Force
  Write-Host "removed $RelativePath"
}

Write-Host "Repository root: $rootDir"
foreach ($target in $targets) {
  Remove-Target -RelativePath $target
}

if ($Docker) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host 'Docker not found, skipping Docker prune.'
    exit 0
  }

  if ($DryRun) {
    Write-Host '[dry-run] docker container prune -f'
    Write-Host '[dry-run] docker builder prune -f'
    Write-Host '[dry-run] docker image prune -f'
    if ($Volumes) {
      Write-Host '[dry-run] docker volume prune -f'
    }
    if ($Aggressive) {
      Write-Host '[dry-run] docker builder prune -af'
      Write-Host '[dry-run] docker image prune -af'
    }
    exit 0
  }

  docker container prune -f | Out-Host
  docker builder prune -f | Out-Host
  docker image prune -f | Out-Host
  if ($Volumes) {
    docker volume prune -f | Out-Host
  }
  if ($Aggressive) {
    docker builder prune -af | Out-Host
    docker image prune -af | Out-Host
  }
}
