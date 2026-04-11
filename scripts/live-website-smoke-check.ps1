param(
  [int]$Port = 5000,
  [int]$StartupWaitSeconds = 4
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$serverDir = Join-Path $root "server"
$serverEntry = Join-Path $serverDir "server.js"

if (!(Test-Path $serverEntry)) {
  Write-Error "Server entry not found: $serverEntry"
}

$proc = $null
$failures = @()
$checks = @(
  "http://localhost:$Port/index.html",
  "http://localhost:$Port/dashboard.html",
  "http://localhost:$Port/user-dashboard.html",
  "http://localhost:$Port/seller-dashboard.html",
  "http://localhost:$Port/admin-dashboard.html",
  "http://localhost:$Port/api/health"
)

try {
  $proc = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $serverDir -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds $StartupWaitSeconds

  foreach ($url in $checks) {
    try {
      $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
      Write-Host ("[OK] {0} {1}" -f $response.StatusCode, $url)
    } catch {
      $message = $_.Exception.Message
      Write-Host ("[FAIL] {0} :: {1}" -f $url, $message)
      $failures += $url
    }
  }

  if ($failures.Count -gt 0) {
    Write-Error ("Smoke check failed for {0} endpoint(s)." -f $failures.Count)
  } else {
    Write-Host "[DONE] Live website smoke check passed."
  }
} finally {
  if ($proc -and !$proc.HasExited) {
    Stop-Process -Id $proc.Id -Force
  }
}
