param(
  [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

$frontendRoot = "frontend"
$dirs = @("css", "js", "pages", "legal", "folders")

if (-not (Test-Path $frontendRoot)) {
  New-Item -ItemType Directory -Path $frontendRoot | Out-Null
}

Get-ChildItem -File -Path . -Filter *.html | ForEach-Object {
  Copy-Item $_.FullName -Destination (Join-Path $frontendRoot $_.Name) -Force
}

Get-ChildItem -File -Path . -Filter *.js | ForEach-Object {
  Copy-Item $_.FullName -Destination (Join-Path $frontendRoot $_.Name) -Force
}

foreach ($d in $dirs) {
  if (Test-Path $d) {
    if (-not (Test-Path (Join-Path $frontendRoot $d))) {
      New-Item -ItemType Directory -Path (Join-Path $frontendRoot $d) | Out-Null
    }
    Copy-Item -Path (Join-Path $d "*") -Destination (Join-Path $frontendRoot $d) -Recurse -Force
  }
}

Write-Host "Frontend sync complete."

