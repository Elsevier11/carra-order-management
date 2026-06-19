---
target: frontend/src/app/app.component.html
total_score: 20
p0_count: 2
p1_count: 2
timestamp: 2026-06-18T17-35-17Z
slug: frontend-src-app-app-component-html
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Toast auto-hide 3s, nessun loading state sul pulsante Salva, upload senza progress |
| 2 | Match System / Real World | 3 | disegnoMittenteId mostra ID numerico invece del nome in read mode |
| 3 | User Control and Freedom | 2 | Nessun Annulla modifiche esplicito in editMode; nessun undo per cambio stato |
| 4 | Consistency and Standards | 2 | Due paradigmi di salvataggio coesistono: Salva globale header + Salva locali Gestione; Cementi/Accessori senza nessuno |
| 5 | Error Prevention | 1 | Elimina accanto a Modifica senza gap di sicurezza; nessuna validazione inline |
| 6 | Recognition Rather Than Recall | 2 | Checkbox logistica senza raggruppamento in editMode; mittente ID in read mode |
| 7 | Flexibility and Efficiency | 2 | Nessun shortcut; nessuna bulk action; workflow cambio stato sempre 3 step manuali |
| 8 | Aesthetic and Minimalist Design | 3 | Input file upload grezzo; note box stilizzato come warning ambra senza necessità |
| 9 | Error Recovery | 2 | Toast top-right + errore inline tab = doppio feedback in posizioni diverse |
| 10 | Help and Documentation | 1 | Solo placeholder come hint; nessun tooltip, nessuna guida contestuale |
| **Totale** | | **20/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** Non urla AI made this. I tell patterns presenti: (1) detail-section-title in uppercase identico su ogni sezione di ogni tab — eyebrow-reflex; (2) badge SI/NO verdi per qualsiasi booleano SI anche neutro.

**Deterministic scan:** 0 finding nel file HTML. Exit code 0. Nessun anti-pattern codificato rilevato.

## Overall Impression

Il modal funziona ma non si fida di se stesso. L'header è il pezzo più solido. Il problema centrale non è estetico — è un'ambiguità di salvataggio che attraversa tutto il componente. Per un'app operativa usata 8 ore al giorno, questo è il rischio più concreto.

## What's Working

1. Header status-first: chip stato → rif → cliente risponde alla domanda principale nel primo secondo.
2. Progressive disclosure checklist: Cementi e Accessori rivelano sotto-flag solo quando la voce principale è selezionata.
3. Confirm overlay in-context: le confirm card appaiono con blur sul modal esistente, mantenendo il contesto visivo.

## Priority Issues

**[P0] Dualità del paradigma di salvataggio**
- Due meccanismi: Salva globale header (solo Dettagli editMode) + Salva locali tab Gestione + nessun Salva in Cementi/Accessori.
- Fix: Unificare. Estendere EditableConsegna con campi Gestione, o rendere ogni tab autonomo con proprio Salva esplicito.

**[P0] Elimina affiancato a Modifica senza separazione di sicurezza**
- Flex gap 6px tra azioni costruttive e distruttive. Fat-finger risk in flusso operativo veloce.
- Fix: margin-left: auto su Elimina o spostarlo in overflow menu.

**[P1] disegnoMittenteId mostra ID in read mode**
- Operatore vede "Mittente: 3" invece del nome.
- Fix: aggiungere nomeMittente(id) helper analogy a nomeCommerciale(id) già presente.

**[P1] Nessun feedback di persistenza per Cementi e Accessori**
- Utente che spunta cementi non sa se le modifiche vengono salvate.
- Fix: toast di conferma con debounce, o pulsante Salva esplicito, o includere nel dirty-state globale.

**[P2] Widget cambio stato senza indicazione dello stato corrente**
- Operazione irreversibile senza recap. Stato corrente visibile solo nell'header, fuori dalla viewport quando tab body scrolla.
- Fix: aggiungere chip stato corrente sopra il select.

## Persona Red Flags

**Mario (operatore, domain expert non tecnico):** Spunta cementi → nessun Salva → incertezza persistenza. Vede "Mittente: 3" → non capisce. Errore SOSPESO → toast top-right non visto.

**Alex (power user, 6-8h/giorno):** Modifica Dettagli → va in Gestione → preme Aggiorna stato → Dettagli non salvati, nessun avviso. Elimina vicino a Modifica = fat-finger risk.

**Jordan (first-timer):** Tab Gestione condizionale senza spiegazione. Nessun Salva in Cementi → modifica persa.

## Minor Observations

- detail-note-box in ambra usa pattern warning per contenuto neutro.
- Upload allegati senza hint su tipi/dimensioni.
- Storico nel footer posizionalmente anomalo.
- Nessun Esc da tastiera per chiudere il modal.
