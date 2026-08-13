' ---------------------------------------------------------------
'  Arranca el servidor y el vigia SIN VENTANA.
'
'  Windows no tiene demonios como los de un servidor de verdad, pero
'  esto es lo mas parecido sin pedirle permisos de administrador a
'  nadie: los procesos quedan corriendo sin ninguna ventana que se
'  pueda cerrar por error, y siguen ahi hasta que se cierre sesion o
'  se use detener.cmd.
'
'  Antes esto vivia en dos ventanas negras minimizadas, y cada vez que
'  alguien cerraba una "por limpiar la barra de tareas" la oficina se
'  quedaba sin sistema sin que nadie supiera por que.
'
'  Se le puede dar doble clic. No dice nada: si no aparece nada, es
'  que arranco. Para ver como va: estado.cmd
' ---------------------------------------------------------------
Option Explicit

Dim sh, fso, carpeta
Set sh  = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = carpeta

' 0 = sin ventana; False = no esperar a que termine
If Not YaAnda("servidor.js") Then
  sh.Run "cmd /c """"" & carpeta & "\servidor-demonio.cmd""""", 0, False
  WScript.Sleep 2500      ' que el servidor este arriba antes de que el vigia lo busque
End If

If Not YaAnda("vigia.ps1") Then
  sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -File """ & carpeta & _
         "\vigia.ps1"" -Servidor http://localhost:8123", 0, False
End If

' ¿Hay ya un proceso con esto en su linea de ordenes? Sin esta pregunta, dos
' doble clics dejarian dos servidores peleando por el mismo puerto y dos vigias
' haciendo saltar la bandeja dos veces.
Function YaAnda(trozo)
  Dim wmi, lista, p
  YaAnda = False
  On Error Resume Next
  Set wmi = GetObject("winmgmts:\\.\root\cimv2")
  Set lista = wmi.ExecQuery("Select CommandLine from Win32_Process")
  For Each p In lista
    If Not IsNull(p.CommandLine) Then
      If InStr(1, p.CommandLine, trozo, 1) > 0 And _
         InStr(1, p.CommandLine, "arrancar.vbs", 1) = 0 Then
        YaAnda = True
        Exit For
      End If
    End If
  Next
  On Error GoTo 0
End Function
