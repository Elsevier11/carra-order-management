@echo off
setlocal

cd /d "%~dp0"

if not exist "package.json" (
  echo [ERRORE] package.json non trovato nella cartella corrente.
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRORE] npm non trovato. Installa Node.js e riprova.
  exit /b 1
)

if not exist "node_modules" (
  echo [INFO] Dipendenze root mancanti. Eseguo npm install...
  call npm install || exit /b 1
)

if not exist "frontend\\node_modules" (
  echo [INFO] Dipendenze frontend mancanti. Eseguo npm --prefix frontend install...
  call npm --prefix frontend install || exit /b 1
)

echo [INFO] Avvio backend + frontend in dev mode...
call npm run dev

endlocal
