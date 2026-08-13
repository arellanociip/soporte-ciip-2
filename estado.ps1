# ---------------------------------------------------------------
#  Si el servidor y el vigia corren sin ventana, hace falta algo que
#  diga si estan vivos. Esto es ese algo: lo llama estado.cmd.
# ---------------------------------------------------------------
$carpeta = Split-Path -Parent $MyInvocation.MyCommand.Path

function Proceso($trozo) {
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*$trozo*" -and $_.CommandLine -notlike "*estado.ps1*" } |
    Select-Object -First 1
}

Write-Host ""
Write-Host "  Soporte GTIC · como va todo"
Write-Host "  --------------------------------------------------"

$srv = Proceso "servidor.js"
if ($srv) {
  $desde = (Get-Process -Id $srv.ProcessId).StartTime
  Write-Host ("  Servidor:  ANDANDO   (desde las " + $desde.ToString("HH:mm") + " del " + $desde.ToString("dd/MM") + ")")
} else {
  Write-Host "  Servidor:  APAGADO   <- la oficina no puede pedir soporte"
}

# Que el proceso este vivo no basta: lo que importa es que conteste
try {
  $r = Invoke-WebRequest "http://localhost:8123/" -UseBasicParsing -TimeoutSec 4
  Write-Host ("  La pagina: RESPONDE  (" + $r.StatusCode + ")")
} catch {
  Write-Host "  La pagina: NO RESPONDE"
}

$vig = Proceso "vigia.ps1"
if ($vig) { Write-Host "  Vigia:     ANDANDO   (la bandeja salta sola)" }
else      { Write-Host "  Vigia:     APAGADO   (las solicitudes entran igual, pero no salta nada)" }

$n = Join-Path $carpeta "datos\solicitudes.json"
if (Test-Path $n) {
  try {
    $t = Get-Content $n -Raw | ConvertFrom-Json
    $abiertas = @($t | Where-Object { $_.estado -eq 'recibida' -or $_.estado -eq 'en_proceso' })
    Write-Host ("  Solicitudes: " + @($t).Count + " en total, " + $abiertas.Count + " sin resolver")
  } catch { }
}

Write-Host ""
$log = Join-Path $carpeta "datos\servidor.log"
if (Test-Path $log) {
  Write-Host "  Ultimas lineas del registro del servidor:"
  Get-Content $log -Tail 6 | ForEach-Object { Write-Host ("    " + $_) }
} else {
  Write-Host "  (todavia no hay registro del servidor)"
}

Write-Host ""
Write-Host "  Para arrancarlo:  arrancar.vbs      Para apagarlo:  detener.cmd"
