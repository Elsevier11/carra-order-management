# Product

## Register

product

## Users

Staff interno Carra (3–10 persone): responsabili di produzione, coordinatori ordini, amministratori. Usano l'app su desktop durante l'orario lavorativo. Conoscono bene il dominio (ordini di vasche di depurazione) ma non sono utenti tecnici — arrivano da un flusso su Excel. Vogliono trovare un'informazione velocemente e agire senza frizione.

## Product Purpose

Sistema web di gestione ordini che sostituisce Excel nel tracciare l'intero ciclo di vita degli ordini di vasche di depurazione. Gli ordini avanzano attraverso 7 stati operativi, dalla presa in carico alla consegna. L'app mette in evidenza le urgenze (ordini in ritardo), supporta le transizioni di stato con drag-and-drop, gestisce allegati e logistica, e offre agli admin un log di audit e la gestione utenti. Il successo si misura così: "dov'è questo ordine?" in meno di 5 secondi.

## Brand Personality

Familiare, leggibile, affidabile. L'app deve sembrare l'evoluzione naturale dell'Excel che ha sostituito — niente sorprese, niente fronzoli, tutto al suo posto. Comoda da usare ogni giorno, non impressionante da guardare una volta sola.

## Anti-references

- ERP legacy / SAP: niente tabelle grigie con barre blu, nessuna estetica da software anni '90
- App consumer / B2C: non giocoso, non pastello, non pensato per il mobile come primo schermo
- Template SaaS generico: non il kit Tailwind con gradient-text, card grid identiche ed eyebrow su ogni sezione

## Design Principles

1. **Il dato comanda.** Ogni elemento UI mostra qualcosa di azionabile o aiuta a raggiungerlo. Decorazione senza significato viene tolta.
2. **Lo stato è il segnale primario.** I 7 stati del workflow sono il nucleo semantico; colore, tipografia e layout li rinforzano in modo coerente.
3. **L'urgenza si guadagna.** Gli ordini in ritardo e quelli bloccati ottengono priorità visiva; tutto il resto rimane calmo. Non si fa l'allarme per nulla.
4. **Familiare al primo sguardo.** Gerarchia chiara, pattern riconoscibili, zero cognitive load sprecata a capire l'interfaccia.
5. **Una sola fonte di verità per schermata.** Niente etichette ridondanti, niente contesto ripetuto che l'utente conosce già.

## Accessibility & Inclusion

Nessun target WCAG formale. In pratica: contrasto leggibile sul testo (≥4.5:1), azioni principali raggiungibili da tastiera, stato non comunicato solo tramite colore.
