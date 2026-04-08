# Entities

## DB-001 Ordine

Campi principali:
- id
- rif_ordine
- cliente
- tipo_impianto
- data_consegna_prevista
- riferimento_consegna
- cantiere
- data_ordine
- trasporto_note
- scarico_note
- fornitore_vasche
- commerciale
- responsabile_interno
- bancali_previsti
- stato_workflow_id
- stato_disegno_id
- data_assegnazione
- operatore_assegnato
- acconto_pagato
- arca
- created_at
- updated_at

## DB-002 Stato disegno

Campi:
- id
- codice
- descrizione
- data_invio_disegno
- data_conferma_disegno

Valori iniziali:
- DA_CREARE
- INVIATO
- CONFERMATO

## DB-003 Storico ordine

Campi:
- id
- ordine_id
- tipo_evento
- valore_precedente
- valore_nuovo
- nota
- utente
- data_evento

## DB-004 Task operativo

Campi:
- id
- ordine_id
- tipo_task
- descrizione
- bloccante
- stato_task
- assegnato_a
- data_scadenza

## DB-005 Consegna

Campi:
- id
- ordine_id
- stato_amp
- data_amp
- data_ora_consegna_concordata
- data_ora_partenza
- trasportatore
- numero_camion
- esito_consegna
- note_logistiche
