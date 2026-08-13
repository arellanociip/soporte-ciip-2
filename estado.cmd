@echo off
REM ---------------------------------------------------------------
REM  Como va todo. Doble clic.
REM  Con el servidor y el vigia corriendo sin ventana, esta es la
REM  forma de saber si estan vivos sin tener que buscarlos.
REM ---------------------------------------------------------------
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0estado.ps1"
echo.
pause
