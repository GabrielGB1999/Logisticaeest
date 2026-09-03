$targetFolder = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp"
$wshell = New-Object -ComObject WScript.Shell

$s1 = $wshell.CreateShortcut("$targetFolder\Iniciar Sistema Logistica.lnk")
$s1.TargetPath = "C:\proyectos\Logistica EESTN4\INICIAR.bat"
$s1.WorkingDirectory = "C:\proyectos\Logistica EESTN4"
$s1.Save()

Write-Host "Atajo de INICIAR.bat creado exitosamente en $targetFolder"
