# Kills any process listening on port 4000 then starts backend
$port = 4000

function Get-PortPids($p){
  netstat -ano | findstr LISTENING | findstr :$p | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -Unique
}

$pids = Get-PortPids $port
if ($pids) {
  Write-Host "Killing PID(s): $($pids -join ', ') on port $port" -ForegroundColor Yellow
  foreach ($p in $pids) { try { taskkill /PID $p /F | Out-Null } catch { Write-Host "Failed to kill $p" -ForegroundColor Red } }
  Start-Sleep -Milliseconds 400
  # Re-check
  $left = Get-PortPids $port
  if ($left) { Write-Host "Still occupied by: $($left -join ', ')" -ForegroundColor Red; Write-Host 'Retrying force kill...' -ForegroundColor Yellow; foreach ($p2 in $left){ try { taskkill /F /PID $p2 | Out-Null } catch {} }; Start-Sleep -Milliseconds 300 }
  $left2 = Get-PortPids $port
  if ($left2) { Write-Host "WARNING: Port $port still busy. Consider changing PORT in .env" -ForegroundColor Red }
} else {
  Write-Host "No existing listener on port $port" -ForegroundColor Green
}

Write-Host "Starting backend..." -ForegroundColor Cyan
node index.js
