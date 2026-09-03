$targetFolder = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp"
$wshell = New-Object -ComObject WScript.Shell

$s1 = $wshell.CreateShortcut("$targetFolder\Lista de Codigos.lnk")
$s1.TargetPath = "C:\Users\Pañol\Desktop\lista de codigos.xlsx"
$s1.Save()

$s2 = $wshell.CreateShortcut("$targetFolder\Inventario Panol.lnk")
$s2.TargetPath = "C:\Users\Pañol\Documents\panolsys\Inventario_Panol.xlsb"
$s2.Save()

Write-Host "Atajos creados exitosamente en $targetFolder"
