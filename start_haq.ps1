# Start Haq Assist: the LLM (Gemma 4 12B), VoiceStudio (local Whisper / OmniVoice) and the app.
# Everything runs on GPU 1 (no display, PCI 03:00.0). The script waits until all three answer, then says so.
$ErrorActionPreference = "Stop"
$Project = $PSScriptRoot
$Llama   = "D:\Oc16CCTV\SafeCity-Vehicle-ReID\.ModelForRun\runtime\llama-b12613\llama-server.exe"
$Voice   = Join-Path (Split-Path $Project -Parent) "VoiceStudio"
$Gpu1    = "GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c"

# A service whose port is already taken is reused, not started twice (a second copy could not bind the port and would exit).
function Test-Listening([int]$Port) { [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) }

# 1) LLM on Vulkan2 (= GPU 1). 8K context, one request at a time.
if (Test-Listening 8091) { Write-Host "LLM already running on port 8091: reusing it" } else {
  Start-Process -FilePath $Llama -WindowStyle Minimized -ArgumentList @(
    "-m", "`"$Project\models\gemma-4-12b-it-qat-q4_0.gguf`"", "--device", "Vulkan2", "-ngl", "99",
    "-c", "8192", "-np", "1", "--host", "127.0.0.1", "--port", "8091", "--jinja")
}

# 2) VoiceStudio API on port 3900, pinned to GPU 1.
if (Test-Listening 3900) { Write-Host "Voice already running on port 3900: reusing it" } else {
  $env:CUDA_VISIBLE_DEVICES = $Gpu1
  Start-Process -FilePath "$Voice\.venv\Scripts\python.exe" -WorkingDirectory $Voice -WindowStyle Minimized `
    -ArgumentList @("-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "3900")
}

# 3) Haq Assist app on port 8000 (search query encoding on CPU, reranker on GPU 1).
if (Test-Listening 8000) { Write-Host "App already running on port 8000: reusing it" } else {
  Start-Process -FilePath "$Project\.venv\Scripts\python.exe" -WorkingDirectory $Project -WindowStyle Minimized `
    -ArgumentList @("-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", "8000")
}

# 4) Wait until each service answers, so the page opens with the AI and voice ready.
#    Keep the three minimized windows open: closing one stops that service.
Write-Host "Starting the LLM, voice and app (about 30-60 seconds)..."
$checks = [ordered]@{ "LLM (Gemma 4)" = "http://127.0.0.1:8091/health"; "Voice (Whisper + OmniVoice)" = "http://127.0.0.1:3900/health"; "App" = "http://127.0.0.1:8000/api/library" }
$ready = @{}
$deadline = (Get-Date).AddMinutes(4)
while ($ready.Count -lt $checks.Count -and (Get-Date) -lt $deadline) {
  foreach ($name in $checks.Keys) {
    if ($ready[$name]) { continue }
    try { Invoke-WebRequest $checks[$name] -UseBasicParsing -TimeoutSec 15 | Out-Null; $ready[$name] = $true; Write-Host "  ready: $name" } catch { }
  }
  if ($ready.Count -lt $checks.Count) { Start-Sleep -Seconds 2 }
}
foreach ($name in $checks.Keys) { if (-not $ready[$name]) { Write-Host "  NOT READY after 4 minutes: $name (check its minimized window)" -ForegroundColor Yellow } }
if ($ready.Count -eq $checks.Count) {
  $h = Invoke-RestMethod "http://127.0.0.1:8000/api/health" -TimeoutSec 30
  if ($h.voice_reply) {
    # the first reply loads OmniVoice (~30 s); do it now so the first Listen press in the demo is fast
    Write-Host "  warming up the voice (about 30 seconds)..."
    try { Invoke-WebRequest "http://127.0.0.1:8000/api/voice/speak" -Method Post -ContentType "application/json" -Body '{"text":"Haq Assist is ready.","language":"en"}' -UseBasicParsing -TimeoutSec 180 | Out-Null } catch { Write-Host "  voice warm-up failed: $($_.Exception.Message)" -ForegroundColor Yellow }
  }
  Write-Host ("Haq Assist is ready. Listen buttons: " + $(if ($h.voice_reply) { "on" } else { "off (OmniVoice licence not accepted in VoiceStudio)" }))
}
Write-Host "Open http://127.0.0.1:8000"
