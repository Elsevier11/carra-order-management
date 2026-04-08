# Functional Requirements

## Ordini

- **FR-001** — Creare un nuovo ordine con i principali dati anagrafici e operativi.
- **FR-002** — Visualizzare l'elenco ordini filtrabile per stato, cliente, commerciale, responsabile interno, fornitore e periodo.
- **FR-003** — Cercare un ordine per numero ordine, cliente, cantiere o testo libero.
- **FR-004** — Modificare i dati dell'ordine mantenendo storico delle variazioni rilevanti.

## Workflow

- **FR-005** — Gestire uno stato workflow unico per ordine.
- **FR-006** — Consentire il passaggio di stato solo se soddisfatte le regole previste.
- **FR-007** — Tracciare data, ora e utente di ogni transizione di stato.
- **FR-008** — Gestire uno stato di sospensione con motivo e data.

## Disegno tecnico

- **FR-009** — Gestire lo stato del disegno tecnico separatamente dal workflow generale.
- **FR-010** — Consentire i valori: da creare, inviato, confermato.
- **FR-011** — Memorizzare la data di invio del disegno e la data di conferma.
- **FR-012** — Impedire l'avvio lavorazione se il disegno non è confermato.

## Produzione e assegnazione

- **FR-013** — Registrare fornitore vasche, data assegnazione e operatore responsabile.
- **FR-014** — Consentire l'ingresso in lavorazione solo con data assegnazione valorizzata.
- **FR-015** — Gestire task o vincoli operativi derivati da accessori critici.

## Consegne

- **FR-016** — Gestire stato A.M.P. dell'ordine.
- **FR-017** — Registrare trasportatore, data/ora consegna concordata, data/ora partenza e numero mezzi.
- **FR-018** — Offrire una vista dedicata agli ordini pronti e avvisati.
- **FR-019** — Offrire una vista calendario/lista consegne.

## Note e storico

- **FR-020** — Gestire note cronologiche separate dall'anagrafica ordine.
- **FR-021** — Mantenere storico di cambi stato, note e attività principali.

## UX operativa

- **FR-022** — Offrire una vista board per stato.
- **FR-023** — Offrire una vista tabellare dettagliata.
- **FR-024** — Evidenziare urgenze, blocchi e incompletezze tramite badge e colori.
