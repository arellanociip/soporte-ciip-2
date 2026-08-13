@echo off
REM ---------------------------------------------------------------
REM  Levanta el sitio para toda la oficina. Doble clic y listo.
REM  Mientras esta ventana este abierta, el sitio esta disponible y
REM  las solicitudes de todos se guardan en datos\solicitudes.json.
REM  Para apagarlo: cierra esta ventana.
REM
REM  Si el servidor se cae por lo que sea, esta ventana lo vuelve a
REM  levantar sola a los cinco segundos: la oficina no se queda sin
REM  sistema por un tropiezo, y lo que paso queda escrito con su hora
REM  en datos\servidor.log.
REM ---------------------------------------------------------------
cd /d "%~dp0"
title Servidor de soporte GTIC

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  No se encontro Node. Instalalo desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

:levantar
node servidor.js

echo.
echo  El servidor se detuvo. Volviendo a levantarlo en 5 segundos...
echo  (para apagarlo de verdad, cierra esta ventana)
echo.
timeout /t 5 >nul
goto levantar
