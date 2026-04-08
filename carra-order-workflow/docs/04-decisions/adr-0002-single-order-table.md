# ADR-0002 — Modello ordine unico invece di più fogli equivalenti a Excel

## Stato
Accepted

## Contesto

Il file Excel attuale distribuisce lo stesso ordine su fogli diversi in funzione dello stato operativo.

## Decisione

Nel sistema web l'ordine sarà una singola entità persistente con stato workflow, storico eventi e viste filtrate.

## Conseguenze

- Niente duplicazione ordini tra stati
- Maggiore tracciabilità
- Regole workflow implementabili in modo consistente
- UI a viste multiple sullo stesso dataset
