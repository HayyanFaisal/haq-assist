# Stop Haq Assist: the app (port 8000), VoiceStudio (port 3900) and the Gemma LLM server (port 8091). Frees GPU 1.
# Only Haq's own processes are stopped: other llama-server instances (other projects) are left alone.
$targets = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq "python.exe" -and $_.CommandLine -match "uvicorn backend\.(app:app|main:app)") -or
  ($_.Name -eq "llama-server.exe" -and $_.CommandLine -match "gemma-4-12b")
}
if (-not $targets) { Write-Host "Haq Assist is not running."; return }
foreach ($p in $targets) {
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped $($p.Name) (process $($p.ProcessId))"
}
# Wait until the ports are really free, so an immediate start_haq.ps1 can bind them again.
$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline -and (Get-NetTCPConnection -State Listen -LocalPort 8000, 3900, 8091 -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 500 }
Write-Host "Haq Assist stopped."
