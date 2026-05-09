@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on this PC.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:4317/api/characters' -TimeoutSec 2 ^| Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  start "agenticwAIfu backend" cmd /k "cd /d ""%~dp0"" && node character-store-server.js"
  timeout /t 1 /nobreak >nul
)

start "" "%~dp0index.html"

endlocal
