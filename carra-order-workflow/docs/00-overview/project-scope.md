# Project Scope

## Contesto

L'azienda gestisce ordini relativi alla costruzione di vasche di depurazione e accessori tramite un file Excel multi-foglio. Il processo è già organizzato per stati operativi ma oggi dipende da spostamenti manuali di righe, note testuali e convenzioni colore.

## Problema da risolvere

L'attuale gestione su Excel presenta limiti di tracciabilità, standardizzazione dei dati, controllo degli avanzamenti, collaborazione multiutente e gestione strutturata delle eccezioni.

## Obiettivo del progetto

Realizzare una soluzione web based che:
- sostituisca l'uso operativo del file Excel;
- mantenga i passaggi reali del processo aziendale;
- renda strutturati dati oggi presenti in testo libero;
- consenta vista per stati, ricerca, filtri, storico e pianificazione consegne;
- prepari una base solida per successive integrazioni con gestionale, utenti e notifiche.

## In scope

- Analisi del processo attuale
- Modellazione dati ordini e workflow
- Definizione MVP della web app
- Mappatura Excel -> modello dati
- Definizione schermate principali
- Gestione ordini, note, task, stati e consegne

## Out of scope iniziale

- Integrazione completa ERP/gestionale
- Automazioni email/SMS avanzate
- App mobile nativa
- BI avanzata e reporting direzionale evoluto
- Pianificazione produzione completa MRP

## Aggiornamento scope

- Integrazione ERP: implementato un collegamento in lettura (import ordini da SQL Server ERP al caricamento) — vedi `docs/superpowers/specs/2026-06-04-erp-sqlserver-config-design.md`. Resta fuori scope l'evasione ordine/scrittura verso l'ERP (es. generazione automatica DDT), che è allo stadio di proposta non implementata.
- Pianificazione produzione completa MRP: ancora fuori scope, nessuna modifica.
