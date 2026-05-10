@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$server = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*character-store-server.js*' }; if (-not $server) { Write-Host 'No running character-store-server.js process found.'; exit 0 }; $server | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; Write-Host 'Stopped character-store-server.js.'"

endlocal
