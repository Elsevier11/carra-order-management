# Order Lifecycle

## Stati principali

- **WF-001** — NUOVO / IN CORSO
- **WF-002** — DISEGNO IN GESTIONE
- **WF-003** — PRONTO PER LAVORAZIONE
- **WF-004** — IN LAVORAZIONE
- **WF-005** — CONCLUSO / MERCE PRONTA
- **WF-006** — PRONTO & AVVISATO
- **WF-007** — CONSEGNA PIANIFICATA
- **WF-008** — CHIUSO
- **WF-009** — SOSPESO

## Regole di transizione

- Da `NUOVO / IN CORSO` a `PRONTO PER LAVORAZIONE` solo con disegno confermato.
- Da `PRONTO PER LAVORAZIONE` a `IN LAVORAZIONE` solo con data assegnazione e operatore valorizzati.
- Da `IN LAVORAZIONE` a `CONCLUSO / MERCE PRONTA` quando la produzione è confermata.
- Da `CONCLUSO / MERCE PRONTA` a `PRONTO & AVVISATO` quando il cliente è avvisato e i dati di consegna sono definiti.
- Da qualsiasi stato a `SOSPESO` con motivo obbligatorio.
- Da `SOSPESO` a stato attivo con nota di riattivazione obbligatoria.
