[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Source,

  [Parameter(Mandatory = $true)]
  [string]$Destination,

  [switch]$AllowExistingDestination
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path)
}

$sourcePath = Resolve-FullPath $Source
$destinationPath = Resolve-FullPath $Destination

if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
  throw "Source Vault was not found: $sourcePath"
}

if ($sourcePath -eq $destinationPath -or $destinationPath.StartsWith("$sourcePath\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destination must not be the source Vault or a child of it."
}

if ((Test-Path -LiteralPath $destinationPath) -and -not $AllowExistingDestination) {
  throw "Destination already exists. Inspect it first, then rerun with -AllowExistingDestination if merging is intentional."
}

New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null

$sourceFiles = Get-ChildItem -LiteralPath $sourcePath -Recurse -File
foreach ($file in $sourceFiles) {
  $relative = [System.IO.Path]::GetRelativePath($sourcePath, $file.FullName)
  $target = Join-Path $destinationPath $relative
  $targetParent = Split-Path -Parent $target
  New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $target -Force
}

$destinationFiles = Get-ChildItem -LiteralPath $destinationPath -Recurse -File
$sourceHashes = @{}
foreach ($file in $sourceFiles) {
  $relative = [System.IO.Path]::GetRelativePath($sourcePath, $file.FullName)
  $sourceHashes[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
}

$mismatches = @()
foreach ($file in $destinationFiles) {
  $relative = [System.IO.Path]::GetRelativePath($destinationPath, $file.FullName)
  if (-not $sourceHashes.ContainsKey($relative)) {
    continue
  }
  $destinationHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
  if ($destinationHash -ne $sourceHashes[$relative]) {
    $mismatches += $relative
  }
}

$missing = $sourceHashes.Keys | Where-Object {
  -not (Test-Path -LiteralPath (Join-Path $destinationPath $_) -PathType Leaf)
}

if ($missing.Count -gt 0 -or $mismatches.Count -gt 0) {
  Write-Error "Verification failed. Missing: $($missing.Count); hash mismatches: $($mismatches.Count). The source Vault was not changed."
}

Write-Host "Verified copy complete."
Write-Host "Source files: $($sourceFiles.Count)"
Write-Host "Destination files: $($destinationFiles.Count)"
Write-Host "SHA-256 matches: $($sourceHashes.Count)"
Write-Host "The source Vault remains untouched: $sourcePath"
