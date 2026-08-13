# ---------------------------------------------------------------
#  El vigía de la bandeja
#
#  Se queda escuchando al servidor y, en cuanto entra una solicitud,
#  trae la bandeja al frente de la pantalla. Si no está abierta, la
#  abre él en su propia ventana.
#
#  Va en PowerShell a propósito: así corre en cualquier máquina de la
#  oficina sin instalarle nada. Node solo hace falta en la máquina
#  donde vive el servidor.
#
#  Arranque:  doble clic en vigia.cmd
#  A mano:    powershell -ExecutionPolicy Bypass -File vigia.ps1 -Servidor http://172.21.20.49:8123
# ---------------------------------------------------------------
param(
  [string]$Servidor = "http://172.21.20.49:8123"
)

$Servidor = $Servidor.TrimEnd('/')
$Pagina   = "$Servidor/bandeja.html"
$Titulo   = "Bandeja de soporte"

# Dos cosas que Windows no da hechas:
#
#   · Encontrar la ventana. No vale preguntarle al proceso de Edge por "su"
#     ventana: Edge mete todas las que tengas abiertas en un solo proceso y
#     solo declara una. Hay que recorrer las ventanas del escritorio y buscar
#     la que se llame como la página.
#
#   · Traerla al frente. Desde un programa que está en segundo plano, Windows
#     no deja robar el foco así como así: hay que engancharse al hilo de la
#     ventana que lo tiene en ese momento. Sin eso, lo único que pasa es que el
#     botón de la barra de tareas parpadea.
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Ventana {
  public delegate bool Recorrer(IntPtr h, IntPtr dato);
  [DllImport("user32.dll")] static extern bool EnumWindows(Recorrer cb, IntPtr dato);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern void keybd_event(byte tecla, byte codigo, uint banderas, UIntPtr extra);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint de, uint a, bool enganchar);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();

  public static IntPtr Buscar(string trozo) {
    IntPtr hallada = IntPtr.Zero;
    EnumWindows(delegate(IntPtr h, IntPtr dato) {
      if (!IsWindowVisible(h)) return true;
      StringBuilder nombre = new StringBuilder(500);
      GetWindowText(h, nombre, 500);
      if (nombre.ToString().IndexOf(trozo, StringComparison.OrdinalIgnoreCase) >= 0) {
        hallada = h;
        return false;
      }
      return true;
    }, IntPtr.Zero);
    return hallada;
  }

  // Windows suelta el foco a regañadientes y no siempre a la primera, así que
  // se intenta tres veces con los tres trucos que hay: engancharse al hilo de
  // quien tiene el foco, subir la ventana del todo, y —si aun así se resiste—
  // un toque de la tecla Alt, que es lo que el propio Windows toma por "aquí
  // hay alguien usando el teclado" y desbloquea el cambio.
  public static bool AlFrente(IntPtr h) {
    for (int intento = 0; intento < 3; intento++) {
      IntPtr frente = GetForegroundWindow();
      if (frente == h) return true;
      uint suyo = GetWindowThreadProcessId(frente, IntPtr.Zero);
      uint mio  = GetCurrentThreadId();
      if (intento > 0) {
        keybd_event(0x12, 0, 0, UIntPtr.Zero);   // Alt abajo
        keybd_event(0x12, 0, 2, UIntPtr.Zero);   // Alt arriba
      }
      AttachThreadInput(suyo, mio, true);
      ShowWindow(h, 9);          // SW_RESTORE: si estaba minimizada, la levanta
      BringWindowToTop(h);
      SetForegroundWindow(h);
      AttachThreadInput(suyo, mio, false);
      System.Threading.Thread.Sleep(120);
      if (GetForegroundWindow() == h) return true;
    }
    return GetForegroundWindow() == h;
  }
}
"@

function Escribir($texto) {
  Write-Host ("  " + (Get-Date -Format "HH:mm:ss") + "  " + $texto)
}

function Show-Bandeja {
  $v = [Ventana]::Buscar($Titulo)
  if ($v -ne [IntPtr]::Zero) {
    if ([Ventana]::AlFrente($v)) {
      Escribir "llegó una solicitud -> bandeja al frente"
    } else {
      # Windows se reservó el foco. Al menos la ventana quedó levantada y su
      # botón parpadeando en la barra de tareas.
      Escribir "llegó una solicitud -> la bandeja quedó levantada (Windows no soltó el foco)"
    }
    return
  }
  # --app abre una ventana solo para la bandeja, sin barra de direcciones y con
  # su propio botón en la barra de tareas. Usa el mismo Edge de siempre, así que
  # la sesión y el permiso de los avisos son los que ya están dados.
  Start-Process "msedge.exe" -ArgumentList "--app=$Pagina"
  Escribir "llegó una solicitud -> abriendo la bandeja"
}

Write-Host ""
Write-Host "  Vigía de la bandeja de soporte"
Write-Host "  Escuchando a $Servidor"
Write-Host "  Deja esta ventana abierta. Para apagarlo, ciérrala."
Write-Host ""

while ($true) {
  try {
    $peticion = [System.Net.HttpWebRequest]::Create("$Servidor/rest/v1/eventos")
    $peticion.Timeout = 15000
    # El servidor manda una línea de vida cada 25 segundos; con un minuto de
    # espera, un silencio más largo que eso es que la conexión se murió.
    $peticion.ReadWriteTimeout = 60000
    $respuesta = $peticion.GetResponse()
    $lector = New-Object System.IO.StreamReader($respuesta.GetResponseStream())
    Escribir "conectado"
    while ($null -ne ($linea = $lector.ReadLine())) {
      if ($linea -eq "data: nueva") { Show-Bandeja }
    }
  } catch {
    Escribir ("sin conexión con el servidor (" + $_.Exception.Message + ")")
  }
  # El servidor puede estar apagado o la red caída: se vuelve a intentar sin
  # hacer ruido hasta que conteste.
  Start-Sleep -Seconds 5
}
