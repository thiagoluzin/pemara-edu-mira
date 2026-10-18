Option Explicit
Dim shell, fso, folder, nodePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(nodePath) Then
  MsgBox "Node.js nao encontrado. Este piloto usa o Node.js ja preparado neste computador.", 48, "PEMARA OpenChamber"
  WScript.Quit 1
End If
shell.Run Chr(34) & nodePath & Chr(34) & " " & Chr(34) & folder & "\launch.mjs" & Chr(34), 0, False
