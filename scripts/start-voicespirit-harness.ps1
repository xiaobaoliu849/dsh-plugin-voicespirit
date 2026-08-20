# Start VoiceSpirit Realtime Voice Backend and DeepSeek Harness Web Server

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  DeepSeek Harness + VoiceSpirit Realtime Voice Call Integration " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan

$VoiceSpiritDir = "D:\voicespirit"

if (Test-Path "$VoiceSpiritDir\backend\main.py") {
    Write-Host "[1/2] Checking VoiceSpirit Backend at $VoiceSpiritDir..." -ForegroundColor Yellow
    # Check if port 8000 is running
    $tcp = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
    if (-not $tcp) {
        Write-Host "Starting VoiceSpirit backend on port 8000 in background..." -ForegroundColor Green
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$VoiceSpiritDir\backend'; if (Test-Path '..\.desktop-venv\Scripts\activate.ps1') { & '..\.desktop-venv\Scripts\activate.ps1' } elseif (Test-Path '..\venv\Scripts\activate.ps1') { & '..\venv\Scripts\activate.ps1' }; python -m uvicorn main:app --host 127.0.0.1 --port 8000"
        Start-Sleep -Seconds 3
    } else {
        Write-Host "VoiceSpirit backend is already active on port 8000." -ForegroundColor Green
    }
} else {
    Write-Host "VoiceSpirit backend not found at $VoiceSpiritDir. Ensure gatewayUrl is configured in Settings." -ForegroundColor Gray
}

Write-Host "[2/2] Launching DeepSeek Harness Web..." -ForegroundColor Yellow
pnpm dsh web
