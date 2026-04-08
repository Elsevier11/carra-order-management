# ADR-0003 — Separazione tra stato workflow e stato disegno tecnico

## Stato
Accepted

## Contesto

Nel processo attuale lo stato del disegno è implicito nelle note e influenza il passaggio in lavorazione.

## Decisione

Modellare separatamente:
- stato workflow generale ordine;
- stato del disegno tecnico.

## Conseguenze

- Maggiore chiarezza nelle regole di business
- Possibilità di blocchi automatici basati su prerequisiti
- Migliore reportistica sui colli di bottiglia
