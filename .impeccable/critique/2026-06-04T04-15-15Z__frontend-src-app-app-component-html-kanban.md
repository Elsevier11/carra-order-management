---
timestamp: 2026-06-04T04-15-15Z
slug: frontend-src-app-app-component-html-kanban
---
## Design Health Score

| # | Euristica | Score | Problema chiave |
|---|-----------|-------|-----------------|
| 1 | Visibilità dello stato del sistema | 3 | Loading state solo testuale; ritardi ben visibili |
| 2 | Corrispondenza col mondo reale | 3 | Terminologia di dominio corretta; "rif" e alcuni nomi abbreviati |
| 3 | Controllo e libertà utente | 2 | Nessun undo sulle transizioni di stato; drag non reversibile |
| 4 | Consistenza e standard | 3 | Cards coerenti; ma il pulsante storia è icona-sola emoji vs. tutto il resto ha testo |
| 5 | Prevenzione errori | 2 | La modal di conferma al drop è ottima; ma la transizione rapida nel dettaglio non ha conferma |
| 6 | Riconoscimento vs. Ricordo | 3 | Colonne leggibili; filtri con placeholder; il pulsante storia richiede memoria |
| 7 | Flessibilità ed efficienza | 2 | Drag-drop buono; modalità compatta utile; zero shortcut da tastiera |
| 8 | Estetica e design minimalista | 3 | Card pulite; barra filtri sovraffollata |
| 9 | Gestione e recupero errori | 2 | Messaggi generici in cima alla pagina, non contestuali all'azione |
| 10 | Aiuto e documentazione | 1 | Nessun tooltip contestuale; stato vuoto colonna non gestito |
| **Totale** | | **24/40** | **Acceptable** |

## Anti-Patterns Verdict
Scansione deterministica: 2 finding. Linea 245 (falso positivo — bordo neutro della card). Linea 345 (reale — drag preview usa border-left: 3px solid var(--primary) invece del ::before della card).

## Overall Impression
Board operativamente solida. Il problema principale è la barra filtri con 8+ controlli piatti e l'azione primaria sepolta. Seconda priorità: il vettore mancante sulla card (CSS pronto, HTML non lo renderizza).

## What's Working
1. Sistema colori semantici di stato coerente su tutto il sistema.
2. Modal di conferma sul drag-and-drop — previene errori accidentali.
3. Modalità compatta + filtro solo-ritardi — tool che si adatta all'utente.

## Priority Issues
[P1] Barra filtri sovraffollata — 8+ controlli piatti, azione primaria sepolta
[P1] Vettore assente dalla card — SCSS pronto, HTML non lo renderizza (riga 440 app.component.html)
[P1] Pulsante storia ⏳ icona-sola senza aria-label
[P2] Loading state primitivo — testo generico invece di skeleton
[P2] Colonne vuote non gestite — nessun empty state
[P2] Drag preview usa border-left vietato (styles-kanban.scss:345)

## Persona Red Flags
Alex: nessun shortcut tastiera, 3 step per transizione stato nel dettaglio.
Sam: pulsante storia non accessibile, stato comunicato solo tramite colore, nessun prefers-reduced-motion.
Marco (operativo): checkbox visualizzazione confuse con filtri dati, badge storia non auto-esplicativo, nessuna indicazione filtro attivo.

## Minor Observations
- Credenziali demo nel login markup (rimuovere in production)
- filters-panel grid-template-columns complessa, da testare su 1366px
- Sidebar: "Kanban" prima di "Dashboard" ma activeView parte da 'dashboard'
