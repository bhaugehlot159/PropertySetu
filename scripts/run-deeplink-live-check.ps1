param(
  [string]$LegacyUrl = "http://localhost:5000",
  [string]$ProUrl = "http://localhost:5200",
  [switch]$AutoStart
)

$ErrorActionPreference = "Stop"

function Invoke-JsonGet {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$RetryCount = 20,
    [int]$DelayMs = 1000
  )
  for ($i = 0; $i -lt [Math]::Max(1, $RetryCount); $i++) {
    try {
      return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 12
    } catch {
      Start-Sleep -Milliseconds $DelayMs
    }
  }
  return $null
}

function Invoke-StatusGet {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$RetryCount = 15,
    [int]$DelayMs = 800
  )
  for ($i = 0; $i -lt [Math]::Max(1, $RetryCount); $i++) {
    try {
      $res = Invoke-WebRequest -UseBasicParsing -Method Get -Uri $Url -TimeoutSec 12
      return [int]$res.StatusCode
    } catch {
      Start-Sleep -Milliseconds $DelayMs
    }
  }
  return 0
}

function Add-Row {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][bool]$Passed,
    [Parameter(Mandatory = $true)][string]$Details
  )
  return [pscustomobject]@{
    Check = $Name
    Status = $(if ($Passed) { "PASS" } else { "FAIL" })
    Details = $Details
  }
}

$jobs = @()
if ($AutoStart) {
  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
  $jobs += Start-Job -ScriptBlock { param($Path) Set-Location $Path; node server/server.js } -ArgumentList $repoRoot
  $jobs += Start-Job -ScriptBlock { param($Path) Set-Location $Path; node server/professional-server.js } -ArgumentList $repoRoot
  Start-Sleep -Seconds 8
}

try {
  $legacyReadiness = Invoke-JsonGet "$LegacyUrl/api/system/app-launch-readiness"
  $proReadiness = Invoke-JsonGet "$ProUrl/api/v3/system/app-launch-readiness"
  $assetLinksStatus = Invoke-StatusGet "$LegacyUrl/.well-known/assetlinks.json"
  $appleAssocStatus = Invoke-StatusGet "$LegacyUrl/.well-known/apple-app-site-association"
  $proAppleAssocStatus = Invoke-StatusGet "$ProUrl/.well-known/apple-app-site-association"

  $rows = @()
  $rows += Add-Row "Legacy readiness endpoint" ($null -ne $legacyReadiness) "$LegacyUrl/api/system/app-launch-readiness"
  $rows += Add-Row "Pro readiness endpoint" ($null -ne $proReadiness) "$ProUrl/api/v3/system/app-launch-readiness"
  $rows += Add-Row "assetlinks status 200" ($assetLinksStatus -eq 200) "$LegacyUrl/.well-known/assetlinks.json => $assetLinksStatus"
  $rows += Add-Row "apple association status 200 (legacy)" ($appleAssocStatus -eq 200) "$LegacyUrl/.well-known/apple-app-site-association => $appleAssocStatus"
  $rows += Add-Row "apple association status 200 (pro)" ($proAppleAssocStatus -eq 200) "$ProUrl/.well-known/apple-app-site-association => $proAppleAssocStatus"

  $legacyStage = if ($legacyReadiness) { [string]$legacyReadiness.stage } else { "unreachable" }
  $proStage = if ($proReadiness) { [string]$proReadiness.stage } else { "unreachable" }
  $rows += Add-Row "Legacy stage launch-ready" ($legacyStage -eq "launch-ready") "stage=$legacyStage"
  $rows += Add-Row "Pro stage launch-ready" ($proStage -eq "launch-ready") "stage=$proStage"

  Write-Host ""
  Write-Host "PropertySetu Deep Link Live Check" -ForegroundColor Cyan
  Write-Host "Legacy URL: $LegacyUrl"
  Write-Host "Pro URL:    $ProUrl"
  Write-Host ""
  $rows | Format-Table -AutoSize

  $allPass = ($rows | Where-Object { $_.Status -eq "FAIL" }).Count -eq 0
  if (-not $allPass) {
    Write-Host ""
    Write-Host "Deep-link infrastructure is live, but launch-ready stage is incomplete until real app identifiers are configured." -ForegroundColor Yellow
    exit 2
  }

  Write-Host ""
  Write-Host "All checks passed. Launch-ready state confirmed." -ForegroundColor Green
  exit 0
}
finally {
  if ($jobs.Count -gt 0) {
    foreach ($job in $jobs) {
      Stop-Job -Job $job -ErrorAction SilentlyContinue | Out-Null
      Remove-Job -Job $job -Force -ErrorAction SilentlyContinue | Out-Null
    }
  }
}
