# Starts the FastAPI backend (creates a venv + installs deps on first run).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
    .\.venv\Scripts\python.exe -m pip install --upgrade pip
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
}

Write-Host "Starting backend on http://localhost:8000  (docs at /docs)" -ForegroundColor Green
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8000
