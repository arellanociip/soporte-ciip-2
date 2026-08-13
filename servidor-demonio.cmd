@echo off
REM ---------------------------------------------------------------
REM  El servidor, para correr sin ventana.
REM  No se le da doble clic: lo arranca arrancar.vbs, que lo lanza
REM  escondido. Aqui solo esta el lazo que lo vuelve a levantar si
REM  se cae, y el desvio de todo lo que diga al registro.
REM ---------------------------------------------------------------
cd /d "%~dp0"
if not exist "datos" mkdir "datos"

:levantar
echo. >> "datos\servidor.log"
echo [%date% %time%] arrancando >> "datos\servidor.log"
node servidor.js >> "datos\servidor.log" 2>&1
echo [%date% %time%] se detuvo, vuelve en 5 segundos >> "datos\servidor.log"
timeout /t 5 >nul
goto levantar
