@echo off
REM ---------------------------------------------------------------
REM  El vigia de la bandeja. Doble clic y listo.
REM
REM  En cuanto entra una solicitud, trae la bandeja al frente de la
REM  pantalla; si no esta abierta, la abre.
REM
REM  Para llevarlo a otra maquina de la oficina: copia esta carpeta
REM  con vigia.cmd y vigia.ps1 dentro, y dale doble clic alli. No
REM  hace falta instalar nada.
REM
REM  Si el servidor cambia de maquina, la direccion se corrige aqui:
REM ---------------------------------------------------------------
set SERVIDOR=http://172.21.20.49:8123

cd /d "%~dp0"
title Vigia de la bandeja
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vigia.ps1" -Servidor %SERVIDOR%

echo.
echo  El vigia se detuvo.
pause
