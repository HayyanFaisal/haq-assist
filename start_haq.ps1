# Start Haq Assist: the LLM (Gemma 4 12B), VoiceStudio (local Whisper / OmniVoice) and the app.
# Everything runs on GPU 1 (no display, PCI 03:00.0). Open http://127.0.0.1:8000 when the app window says it is ready.
$ErrorActionPreference = "Stop"
$Project = $PSScriptRoot
$Llama   = "D:\Oc16CCTV\SafeCity-Vehicle-ReID\.ModelForRun\runtime\llama-b12613\llama-server.exe"
$Voice   = Join-Path (Split-Path $Project -Parent) "VoiceStudio"
$Gpu1    = "GPU-dcd92a54-ad5d-60fe-692f-264c71b64b3c"

# 1) LLM on Vulkan2 (= GPU 1). 8K context, one request at a time.
Start-Process -FilePath $Llama -WindowStyle Minimized -ArgumentList @(
  "-m", "`"$Project\models\gemma-4-12b-it-qat-q4_0.gguf`"", "--device", "Vulkan2", "-ngl", "99",
  "-c", "8192", "-np", "1", "--host", "127.0.0.1", "--port", "8091", "--jinja")

# 2) VoiceStudio API on port 3900, pinned to GPU 1.
$env:CUDA_VISIBLE_DEVICES = $Gpu1
Start-Process -FilePath "$Voice\.venv\Scripts\python.exe" -WorkingDirectory $Voice -WindowStyle Minimized `
  -ArgumentList @("-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "3900")

# 3) Haq Assist app on port 8000 (search query encoding on CPU, reranker on GPU 1).
Start-Process -FilePath "$Project\.venv\Scripts\python.exe" -WorkingDirectory $Project `
  -ArgumentList @("-m", "uvicorn", "backend.app:app", "--host", "127.0.0.1", "--port", "8000")

Write-Host "Starting... first launch takes about a minute while models load."
Write-Host "Then open http://127.0.0.1:8000"
