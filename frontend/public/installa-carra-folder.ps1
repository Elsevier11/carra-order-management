# installa-carra-folder.ps1
# Registra il protocollo carra-folder:// su questo PC Windows.
# Doppio clic o "Esegui con PowerShell" - si eleva da solo ad Amministratore.

# -- Auto-elevazione amministratore -----------------------------------------
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $scriptPath = $MyInvocation.MyCommand.Path
    if (-not $scriptPath) { $scriptPath = $PSCommandPath }
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

# -- Sblocca il file (rimuove il mark "scaricato da internet") ---------------
$scriptPath = $MyInvocation.MyCommand.Path
if ($scriptPath) { Unblock-File -Path $scriptPath -ErrorAction SilentlyContinue }

$ErrorActionPreference = "Stop"

try {
    $handlerDir  = "C:\carra-tools"
    $handlerFile = "$handlerDir\carra-folder-open.ps1"

    # -- 1. Crea la cartella di supporto --------------------------------------
    if (!(Test-Path $handlerDir)) {
        New-Item -ItemType Directory -Path $handlerDir | Out-Null
    }

    # -- 2. Scrivi lo script handler ------------------------------------------
    $handlerScript = @'
# Handler interno - non modificare
param([string]$Url)
$path = [uri]::UnescapeDataString(($Url -replace '^carra-folder:(//)?', ''))
Start-Process -FilePath explorer.exe -ArgumentList @($path)
'@
    Set-Content -Path $handlerFile -Value $handlerScript -Encoding UTF8

    # -- 3. Registra il protocollo nel Registry -------------------------------
    $base = "HKLM:\SOFTWARE\Classes\carra-folder"
    New-Item -Path $base -Force | Out-Null
    Set-ItemProperty -Path $base -Name "(Default)"    -Value "URL:Carra Folder Handler"
    Set-ItemProperty -Path $base -Name "URL Protocol" -Value ""

    New-Item -Path "$base\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$base\DefaultIcon" -Name "(Default)" -Value "explorer.exe,0"

    New-Item -Path "$base\shell\open\command" -Force | Out-Null
    $cmd = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$handlerFile`" `"%1`""
    Set-ItemProperty -Path "$base\shell\open\command" -Name "(Default)" -Value $cmd

    Write-Host ""
    Write-Host "Installazione completata!" -ForegroundColor Green
    Write-Host "Il protocollo carra-folder:// e' ora attivo su questo PC." -ForegroundColor Green
    Write-Host "Puoi aprire le cartelle degli ordini direttamente dall'app Carra." -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "ERRORE durante l'installazione:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Read-Host "Premi Invio per chiudere"
