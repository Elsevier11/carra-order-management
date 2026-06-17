# installa-carra-folder.ps1
# Registra il protocollo carra-folder:// su questo PC Windows.
# Eseguire con tasto destro -> "Esegui con PowerShell" (come Amministratore).

$ErrorActionPreference = "Stop"

$handlerDir  = "C:\carra-tools"
$handlerFile = "$handlerDir\carra-folder-open.ps1"

# -- 1. Crea la cartella di supporto ----------------------------------------
if (!(Test-Path $handlerDir)) {
    New-Item -ItemType Directory -Path $handlerDir | Out-Null
}

# -- 2. Scrivi lo script handler --------------------------------------------
$handlerScript = @'
# Handler interno - non modificare
param([string]$Url)
$path = [uri]::UnescapeDataString($Url.Substring(13))   # rimuove "carra-folder:"
Start-Process explorer.exe -ArgumentList $path
'@
Set-Content -Path $handlerFile -Value $handlerScript -Encoding UTF8

# -- 3. Registra il protocollo nel Registry ---------------------------------
$base = "HKLM:\SOFTWARE\Classes\carra-folder"
New-Item -Path $base -Force | Out-Null
Set-ItemProperty -Path $base -Name "(Default)"    -Value "URL:Carra Folder Handler"
Set-ItemProperty -Path $base -Name "URL Protocol" -Value ""

New-Item -Path "$base\DefaultIcon" -Force | Out-Null
Set-ItemProperty -Path "$base\DefaultIcon" -Name "(Default)" -Value "explorer.exe,0"

New-Item -Path "$base\shell\open\command" -Force | Out-Null
$cmd = "powershell.exe -WindowStyle Hidden -File `"$handlerFile`" `"%1`""
Set-ItemProperty -Path "$base\shell\open\command" -Name "(Default)" -Value $cmd

Write-Host ""
Write-Host "Installazione completata!" -ForegroundColor Green
Write-Host "Il protocollo carra-folder:// e' ora attivo su questo PC." -ForegroundColor Green
Write-Host "Puoi aprire le cartelle degli ordini direttamente dall'app Carra." -ForegroundColor Cyan
Write-Host ""
Read-Host "Premi Invio per chiudere"
