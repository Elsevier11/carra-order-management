# CARRA Order Workflow

Repository documentale per la sostituzione del file Excel `CARRA_CONSEGNE.xlsx` con una web app per la gestione del workflow ordini cliente.

## Obiettivo

Digitalizzare il processo operativo oggi gestito su Excel, mantenendo tracciabilità, continuità operativa e una struttura evolvibile verso sviluppo software.

## Struttura repository

- `docs/00-overview/` — contesto, obiettivi, processo attuale
- `docs/01-requirements/` — requisiti business e funzionali
- `docs/02-domain-model/` — entità, glossario, lifecycle ordine, regole business
- `docs/03-ux-ui/` — viste applicative, schermate, flussi utente
- `docs/04-decisions/` — ADR e decisioni progettuali
- `docs/05-delivery/` — MVP, backlog, roadmap
- `docs/06-data-migration/` — mappatura Excel e regole import
- `assets/` — diagrammi, wireframe, immagini di supporto

## Convenzioni ID

| Prefisso | Significato |
|---|---|
| BR-xxx | Business requirement |
| FR-xxx | Functional requirement |
| DB-xxx | Entità o campo dati |
| WF-xxx | Stato, transizione o regola workflow |
| UI-xxx | Schermata o componente UI |
| MIG-xxx | Regola di migrazione dati |
| ADR-xxxx | Decisione architetturale |
| TASK-xxx | Elemento backlog |

## Ordine di lettura consigliato

1. `docs/00-overview/project-scope.md`
2. `docs/00-overview/current-process.md`
3. `docs/01-requirements/functional-requirements.md`
4. `docs/02-domain-model/entities.md`
5. `docs/02-domain-model/order-lifecycle.md`
6. `docs/03-ux-ui/screens.md`
7. `docs/01-requirements/traceability-matrix.md`

## Stato attuale

- Analisi iniziale del file Excel completata
- MVP applicativo realizzato (backend API + frontend Angular)
- Deploy produzione completato (Railway API + Netlify frontend) in data 12/04/2026
- Smoke test produzione completo eseguito con esito positivo
- Da consolidare in documentazione: stato disegno dedicato, task bloccanti strutturati, traccia validazione wireframe con utenti

## Modalità di lavoro consigliata

- Un branch per ogni blocco di lavoro rilevante
- Pull request anche se lavori da solo, per tenere traccia delle decisioni
- Aggiornare sempre la traceability matrix quando nasce o cambia un requisito
- Registrare le decisioni stabili in `docs/04-decisions/`
