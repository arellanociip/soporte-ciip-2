@echo off
REM ---------------------------------------------------------------
REM  Levanta el sitio para toda la oficina. Doble clic y listo.
REM  Mientras esta ventana este abierta, el sitio esta disponible y
REM  las solicitudes de todos se guardan en datos\solicitudes.json.
REM  Para apagarlo: Ctrl+C aqui dentro, o cierra la ventana.
REM ---------------------------------------------------------------
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  No se encontro Node. Instalalo desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

node servidor.js

REM Si el servidor se cae, que el error se pueda leer antes de cerrar.
echo.
echo  El servidor se detuvo.
pause
