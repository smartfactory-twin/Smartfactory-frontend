$ErrorActionPreference = 'Stop'

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backendRootCandidate = if ($env:SMARTFACTORY_BACKEND_ROOT) {
  $env:SMARTFACTORY_BACKEND_ROOT
} else {
  Join-Path $frontendRoot '..\Smartfactory-backend'
}
$backendRoot = (Resolve-Path $backendRootCandidate).Path
$runId = [guid]::NewGuid().ToString('N')
$backendPortProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$backendPortProbe.Start()
$backendPort = ([Net.IPEndPoint]$backendPortProbe.LocalEndpoint).Port
$backendPortProbe.Stop()
$frontendPortProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$frontendPortProbe.Start()
$frontendPort = ([Net.IPEndPoint]$frontendPortProbe.LocalEndpoint).Port
$frontendPortProbe.Stop()
$backendUrl = "http://127.0.0.1:$backendPort"
$frontendUrl = "http://127.0.0.1:$frontendPort"
$tempRoot = Join-Path ([IO.Path]::GetTempPath()) "smartfactory-e2e-$runId"
$dbPath = Join-Path $tempRoot 'db.sqlite3'
$backendLog = Join-Path $tempRoot 'backend.log'
$backendErrorLog = Join-Path $tempRoot 'backend-error.log'
$frontendLog = Join-Path $tempRoot 'frontend.log'
$frontendErrorLog = Join-Path $tempRoot 'frontend-error.log'
$password = "E2E-only-$runId-Password!"
$reportRoot = Join-Path $frontendRoot 'reports\quality-2026-11-27-current-main'
$compatibilityReport = Join-Path $reportRoot ("browser-compatibility-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.jsonl')
$backendProcess = $null
$frontendProcess = $null

function Stop-ProcessTree([int]$processId) {
  if (-not $processId) { return }
  try {
    & taskkill.exe /PID $processId /T /F *> $null
  } catch { }
}

New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
$env:SECRET_KEY = "local-e2e-$runId-not-for-deployment"
$env:DJANGO_SETTINGS_MODULE = 'core.settings_e2e'
$env:E2E_DB_PATH = $dbPath
$env:E2E_TEST_PASSWORD = $password
$env:E2E_BASE_URL = $frontendUrl
$env:E2E_API_ORIGIN = $backendUrl
$env:E2E_FRONTEND_PORT = [string]$frontendPort
$env:E2E_ADMIN_EMAIL = 'admin.e2e@example.test'
$env:E2E_TECHNICIAN_EMAIL = 'technicien.e2e@example.test'
$env:E2E_OPERATOR_EMAIL = 'operateur.e2e@example.test'
$env:E2E_ADMIN_PASSWORD = $password
$env:E2E_TECHNICIAN_PASSWORD = $password
$env:E2E_OPERATOR_PASSWORD = $password
$env:COMPATIBILITY_RESULTS_FILE = $compatibilityReport
New-Item -ItemType Directory -Force -Path $reportRoot | Out-Null

try {
  Push-Location $backendRoot
  python manage.py migrate --noinput
  if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed.' }
  python manage.py seed_e2e_test_data
  if ($LASTEXITCODE -ne 0) { throw 'E2E fixture seeding failed.' }
  $backendProcess = Start-Process -FilePath 'python' -ArgumentList @('manage.py', 'runserver', "127.0.0.1:$backendPort", '--noreload') -WorkingDirectory $backendRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog
  Pop-Location

  $npmCommand = (Get-Command 'npm.cmd').Source
  $frontendProcess = Start-Process -FilePath $npmCommand -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', [string]$frontendPort, '--strictPort') -WorkingDirectory $frontendRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrorLog

  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      if ($backendProcess.HasExited -or $frontendProcess.HasExited) { throw 'An E2E service exited before becoming ready.' }
      $null = Invoke-WebRequest -UseBasicParsing -Uri "$backendUrl/api/schema/" -TimeoutSec 2
      $null = Invoke-WebRequest -UseBasicParsing -Uri "$frontendUrl/login" -TimeoutSec 2
      $ready = $true
      break
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ready) { throw "Local E2E services did not become ready. Logs: $tempRoot" }

  if ($env:SMARTFACTORY_RUN_ZAP -eq '1') {
    $reportMount = $reportRoot.Replace('\', '/')
    $zapFrontendTarget = $frontendUrl.Replace('127.0.0.1', 'host.docker.internal') + '/'
    $zapApiTarget = $backendUrl.Replace('127.0.0.1', 'host.docker.internal') + '/api/docs/'
    docker run --rm -v "${reportMount}:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t $zapFrontendTarget -J frontend-zap.json -r frontend-zap.html -I
    if ($LASTEXITCODE -ne 0) { throw 'OWASP ZAP frontend baseline scan failed.' }
    docker run --rm -v "${reportMount}:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t $zapApiTarget -J backend-zap.json -r backend-zap.html -I
    if ($LASTEXITCODE -ne 0) { throw 'OWASP ZAP API baseline scan failed.' }
  }

  Push-Location $frontendRoot
  npx playwright test --config=playwright.live.config.js
  $testExit = $LASTEXITCODE
  Pop-Location
  if ($testExit -ne 0) { throw "Real API E2E run failed (exit $testExit). Logs: $tempRoot" }

  Stop-ProcessTree $backendProcess.Id
  $backendProcess.WaitForExit()
  $backendProcess = Start-Process -FilePath 'python' -ArgumentList @('manage.py', 'runserver', "127.0.0.1:$backendPort", '--noreload') -WorkingDirectory $backendRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
      $loginBody = @{ email = $env:E2E_ADMIN_EMAIL; password = $password } | ConvertTo-Json
      if ($backendProcess.HasExited) { throw 'The restarted E2E API exited.' }
      $login = Invoke-RestMethod -Method Post -Uri "$backendUrl/api/auth/login/" -ContentType 'application/json' -Body $loginBody -TimeoutSec 2
      $headers = @{ Authorization = "Bearer $($login.access)" }
      $machines = Invoke-RestMethod -Uri "$backendUrl/api/equipements/machines/?page_size=100" -Headers $headers -TimeoutSec 2
      $identifiers = @($machines.results | ForEach-Object { $_.identifiant_interne })
      $chromiumCount = @($identifiers | Where-Object { $_ -eq 'E2E-CHROMIUM' }).Count
      $firefoxCount = @($identifiers | Where-Object { $_ -eq 'E2E-FIREFOX' }).Count
      if ($chromiumCount -eq 1 -and $firefoxCount -eq 1) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ready) { throw "Persisted E2E records were not available after restarting the API. Logs: $tempRoot" }
  Write-Output "Real API E2E passed. Temporary database and service logs: $tempRoot"
} finally {
  if ($backendProcess -and -not $backendProcess.HasExited) { Stop-ProcessTree $backendProcess.Id }
  if ($frontendProcess -and -not $frontendProcess.HasExited) { Stop-ProcessTree $frontendProcess.Id }
}
