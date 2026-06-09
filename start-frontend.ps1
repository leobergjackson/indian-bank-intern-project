# Starts the React (Vite) dev server (installs node_modules on first run).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\frontend

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "Starting frontend on http://localhost:5173" -ForegroundColor Green
npm run dev
