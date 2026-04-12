# MVP Scope

## Obiettivo MVP

Mettere in esercizio una prima versione utilizzabile del sistema per sostituire l'operatività principale del file Excel.

## Incluso nel MVP

- Anagrafica ordini (`DONE`)
- Stato workflow (`DONE`)
- Stato disegno (`PARTIAL` - requisito presente nei documenti, non ancora esplicitato come dominio separato nel modello dati)
- Note cronologiche (`DONE`)
- Task operativi bloccanti (`PARTIAL` - presenti regole e controlli, non ancora come modulo task dedicato)
- Vista board (`DONE`)
- Vista lista (`DONE`)
- Vista consegne (`DONE`)
- Stato sospeso (`DONE`)
- Storico cambi stato (`DONE`)

## Non incluso nel MVP

- Integrazione ERP completa
- Notifiche automatiche evolute
- Reportistica direzionale avanzata
- Motore autorizzativo complesso

## Verifica stato al 12/04/2026

- MVP in produzione e utilizzabile
- Backend online su Railway con healthcheck operativo
- Frontend online su Netlify
- Smoke produzione completo superato (health, list, stats, login, export, audit, attachment upload)
