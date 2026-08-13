@echo off
REM ---------------------------------------------------------------
REM  Deja el vigia puesto para que arranque solo con Windows.
REM
REM  Pone un acceso directo en la carpeta de Inicio de este usuario, y
REM  lo arranca ya. Se quita borrando ese acceso directo: pulsa
REM  Windows+R, escribe   shell:startup   y borra "Vigia de la bandeja".
REM ---------------------------------------------------------------
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$inicio = [Environment]::GetFolderPath('Startup');" ^
  "$atajo = Join-Path $inicio 'Vigia de la bandeja.lnk';" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($atajo);" ^
  "$s.TargetPath = '%~dp0vigia.cmd';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Trae la bandeja de soporte al frente cuando entra una solicitud';" ^
  "$s.Save();" ^
  "Write-Host '';" ^
  "Write-Host ('  Puesto: ' + $atajo);" ^
  "Write-Host '  A partir del proximo encendido arranca solo, minimizado.'"

echo.
echo  Arrancandolo tambien ahora...
start "" /min "%~dp0vigia.cmd"
echo.
pause
