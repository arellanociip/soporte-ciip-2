@echo off
REM ---------------------------------------------------------------
REM  Levanta el sitio para toda la oficina. Doble clic y listo.
REM  Mientras esta ventana este abierta, el sitio esta disponible.
REM  Para apagarlo: cierra la ventana, o Ctrl+C aqui dentro.
REM ---------------------------------------------------------------
setlocal
cd /d "%~dp0"

set PUERTO=8123

REM La IP de esta maquina en la red de la oficina. Se descartan la de
REM loopback (127.x) y la del VPN de Cloudflare (172.16.x), que no sirven
REM para que otro entre.
set IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do (
    echo %%b | findstr /b "127. 172.16." >nul || if not defined IP set IP=%%b
  )
)
if not defined IP set IP=localhost

echo.
echo  ============================================================
echo   SOLICITUD DE SOPORTE - GTIC
echo  ============================================================
echo.
echo   En esta maquina:
echo     http://localhost:%PUERTO%/index.html
echo.
echo   Desde otra maquina de la oficina:
echo     http://%IP%:%PUERTO%/index.html
echo.
echo   La bandeja de GTIC:
echo     http://%IP%:%PUERTO%/bandeja.html
echo.
echo  ------------------------------------------------------------
echo   OJO: mientras js\config.js este vacio, cada maquina guarda
echo   SUS solicitudes en SU navegador. Lo que mande un companero
echo   NO va a aparecer en tu bandeja. Para que todos vean lo
echo   mismo hay que montar Supabase (ver el README).
echo  ------------------------------------------------------------
echo.
echo   Deja esta ventana abierta. Para apagarlo, cierrala.
echo.

python -m http.server %PUERTO%

REM Si python no existe, la ventana se cerraria sin que se lea el error.
if errorlevel 1 (
  echo.
  echo  No se pudo arrancar. Revisa que Python este instalado:
  echo    python --version
  pause
)
endlocal
