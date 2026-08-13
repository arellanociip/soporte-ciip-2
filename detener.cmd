@echo off
REM ---------------------------------------------------------------
REM  Apaga el servidor y el vigia. Doble clic.
REM  Como corren sin ventana, no hay nada que cerrar a mano: esto es
REM  lo que los detiene. Mientras esten apagados, nadie en la oficina
REM  puede pedir soporte ni ver la bandeja.
REM ---------------------------------------------------------------
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$yo = $PID;" ^
  "$paro = 0;" ^
  "Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $yo -and ($_.CommandLine -like '*servidor-demonio.cmd*' -or $_.CommandLine -like '*servidor.js*' -or $_.CommandLine -like '*vigia.ps1*') -and $_.CommandLine -notlike '*detener*' } | ForEach-Object { Write-Host ('  deteniendo ' + $_.Name + ' (' + $_.ProcessId + ')'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $paro++ };" ^
  "if ($paro -eq 0) { Write-Host '  No habia nada andando.' } else { Write-Host ''; Write-Host ('  Apagado. ' + $paro + ' proceso(s) detenido(s).') }"

echo.
echo  Para volver a levantarlo: doble clic en arrancar.vbs
echo.
pause
