---
name: Carra Ordini
description: Sistema operativo per la gestione del ciclo di vita degli ordini di vasche di depurazione
colors:
  primary: "#2563eb"
  primary-dark: "#1d4ed8"
  bg: "#eef3f9"
  surface: "#ffffff"
  surface-alt: "#f8fbff"
  surface-muted: "#f4f7fb"
  ink: "#0f172a"
  muted: "#64748b"
  alert: "#dc2626"
  success: "#15803d"
  border: "#dbe4f0"
  border-strong: "#c4d2e4"
  status-in-corso: "#166534"
  status-in-lavorazione: "#0f766e"
  status-disegno: "#7c3aed"
  status-pronti: "#b45309"
  status-consegna: "#ea580c"
  status-conclusi: "#1d4ed8"
  status-sospeso: "#9f1239"
  note-bg: "#fffbeb"
  note-accent: "#d97706"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "1.7rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  pill: "999px"
  button: "12px"
  card: "14px"
  surface: "18px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "44px"
  button-ghost-danger:
    backgroundColor: "#fff5f5"
    textColor: "{colors.alert}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "44px"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 14px"
    height: "46px"
  chip-status:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.pill}"
    padding: "0 10px"
    height: "30px"
  card-default:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "18px"
  kanban-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "14px 42px 14px 14px"
---

# Design System: Carra Ordini

## 1. Overview

**Creative North Star: "Il Tavolo di Lavoro"**

Questo è il sistema visivo di un professionista che conosce il suo mestiere. Come un tavolo di lavoro ben organizzato — ogni cosa al proprio posto, niente di superfluo — l'interfaccia è il mezzo, non il fine. Chi apre questa app sa già cosa vuole fare; il design non deve stupire, deve togliersi di mezzo il prima possibile e lasciare i dati in primo piano.

Il sistema eredita la familiarità dell'Excel che sostituisce ma la eleva: leggibilità migliore, gerarchia più chiara, stato degli ordini immediatamente visibile. Non è un'app per impressionare i direttori con screenshot. È un'app per usare ogni giorno, otto ore su otto, senza stancarsi.

Ciò che questo sistema rifiuta esplicitamente: l'estetica ERP anni '90 (tabelle grigie, barre blu, moduli con 40 campi piatti), la leggerezza B2C (pastelli, illustrazioni, copy amichevole), il template SaaS generico (gradient-text, card grid identiche, eyebrow su ogni sezione). Il sistema è invece solido, preciso, professionale — senza essere freddo.

**Key Characteristics:**
- Densità informativa alta, ma ordinata: chi usa l'app ogni giorno trova tutto dove se lo aspetta
- Status come segnale primario: i 7 stati del workflow sono codificati visivamente in modo coerente in tutto il sistema
- Chrome che sparisce: sidebar, header, bordi — tutto serve, niente è decorativo
- Urgenza guadagnata: solo ritardi e stati critici ottengono priorità visiva; il resto rimane calmo
- Scala di grigi per lo sfondo, blu per l'azione, colori semantici per lo stato

## 2. Colors: La Palette Operativa

Un fondo freddo-neutro con un solo accento attivo. I colori semantici appartengono al dominio degli ordini, non all'interfaccia.

### Primary
- **Blu Operativo** (`#2563eb`): il colore dell'azione. Bottoni primari, link, indicatori attivi, sidebar nav active state. Usato con parsimonia — la sua rarità è il punto.
- **Blu Profondo** (`#1d4ed8`): hover e gradient-end del blu operativo. Mai usato standalone.

### Neutral
- **Sfondo Lavagna** (`#eef3f9`): il fondo di ogni pagina. Blu-grigio freddo con minima crominanza — separa visivamente le card senza competere con i dati.
- **Superficie** (`#ffffff`): card, modal, sidebar. Bianco pieno — massima leggibilità.
- **Superficie Alt** (`#f8fbff`): sfondo alternativo per sezioni nidificate o righe zebrate.
- **Superficie Muted** (`#f4f7fb`): badge neutri, sfondo di sezioni secondarie.
- **Inchiostro** (`#0f172a`): testo primario. Navy quasi-nero — più caldo del nero puro, meno aggressivo.
- **Silenzio** (`#64748b`): testo secondario, label KV, metadati. Slate medio — contrasto ≥4.5:1 su bianco.
- **Bordo** (`#dbe4f0`): divisori, bordi di input, separatori. Quasi invisibile — segnala senza decorare.
- **Bordo Forte** (`#c4d2e4`): bordi enfatizzati su superfici interattive.

### Secondary — Stato di Allerta
- **Rosso Urgenza** (`#dc2626`): errori, badge SOSPESO, badge-warn. Riservato agli stati critici e ai messaggi di errore.
- **Verde Conferma** (`#15803d`): messaggi di successo.

### Tertiary — Colori Semantici di Stato
Ogni stato del workflow ha un colore dedicato. Questi colori appaiono solo come testo/bordo su sfondi quasi-bianchi — mai come sfondi di superfici grandi.
- **IN CORSO** (`#166534`): verde scuro
- **IN LAVORAZIONE** (`#0f766e`): verde-teal
- **DISEGNO IN GESTIONE** (`#7c3aed`): viola
- **PRONTI & AVVISATI** (`#b45309`): ambra
- **CONSEGNA PIANIFICATA** (`#ea580c`): arancio
- **CONCLUSI** (`#1d4ed8`): indaco/blu
- **SOSPESO** (`#9f1239`): cremisi

### Named Rules
**La Regola del Silenzio Cromatico.** L'accento blu (#2563eb) appare su ≤10% di qualsiasi schermata. I colori di stato non escono mai dal contesto degli stati del workflow: non si usano come accenti decorativi, non si applicano ai bordi delle card generiche, non si mettono nei bottoni. Il loro significato dipende dalla loro esclusività.

**La Regola del Solo Testo.** I colori semantici di stato (verde, teal, viola, ambra, arancio, indaco, cremisi) si usano solo come `color` su testo e bordi di chip, mai come `background-color` su superfici grandi. Su sfondo bianco/quasi-bianco garantiscono contrasto; su fondo colorato perdono leggibilità e significato.

## 3. Typography

**Font Unico:** Manrope (con fallback Segoe UI, sans-serif)

**Carattere:** Manrope è un sans geometrico con tocchi umanisti — leggibile a 0.75rem come a 1.7rem, con pesi che vanno da 400 a 800. Il sistema usa un solo typeface in più pesi anziché due famiglie separate: coerenza massima, nessuna tensione visiva tra display e body. La variazione nasce dal peso e dalla dimensione, non dalla famiglia.

### Hierarchy
- **Display** (700, 1.7rem, line-height 1.2): solo per titoli di pagine standalone come il login. Rarissimo.
- **Headline** (800, 1.5rem, line-height 1.2, letter-spacing -0.01em): titoli di modal e intestazioni di dettaglio ordine. Il livello più alto nelle viste operative.
- **Title** (700, 1.2rem, line-height 1.3): intestazioni di sezione, header del contenuto principale.
- **Body** (500, 1rem, line-height 1.5): testo operativo, valori KV, contenuto di card e tabelle. Max 65ch per colonne di testo libero.
- **Label** (700, 0.75rem, letter-spacing 0.05em, UPPERCASE): etichette di campo KV, intestazioni di sezione nel modal, header di colonne. Muted color. Massimo 4 parole.

### Named Rules
**La Regola del Peso, Non del Font.** Nessuna seconda famiglia tipografica. La gerarchia nasce da peso (500 → 700 → 800) e scala (0.75rem → 1rem → 1.2rem → 1.5rem), non da pairing di font. L'aggiunta di una seconda famiglia è vietata salvo approvazione esplicita.

**La Regola delle Label.** Le label uppercase (`.kv-label`, `.detail-section-title`, `.form-field__label`) esistono per segnalare metadato, non per decorare. Non si applicano a testo body, non si usano come titoli di sezione nei livelli superiori della gerarchia. Massimo 4 parole in uppercase per elemento.

## 4. Elevation

Il sistema usa ombre strutturali: ogni livello ha un'ombra specifica che segnala la sua posizione nella gerarchia di z-index. Non è decorativa — è semantica. La regola è: più un elemento è vicino all'utente (modal > sidebar > card), più la sua ombra è profonda.

### Shadow Vocabulary
- **Superficie** (`0 4px 12px rgba(15, 23, 42, 0.05)`): card, kanban cards, toggle. Il livello base. Appena percettibile — segnala che l'elemento è "sulla scrivania", non piatto sul fondo.
- **Pannello** (`0 16px 32px rgba(15, 23, 42, 0.06)`): content-header, form panel. Livello intermedio — separa l'header principale dal contenuto scorrevole.
- **Modale** (`0 18px 36px rgba(15, 23, 42, 0.08)`): modal e drawer. Il livello più alto. Ombra più profonda per segnalare che il contenuto è sopra tutto il resto.
- **Drag preview** (`0 18px 36px rgba(15, 23, 42, 0.12)`): kanban card durante il drag. Ombra massima — segnala interazione attiva.

### Named Rules
**La Regola della Gerarchia Strutturale.** Le ombre non decorano: identificano il livello. Una card non usa mai l'ombra del modal; un modal non usa mai l'ombra della card. Se un nuovo elemento ha bisogno di un'ombra, scegli il livello gerarchico corretto dalla scala, non un valore arbitrario.

**La Regola del Piatto a Riposo.** I bordi (`--border: #dbe4f0`) separano gli elementi allo stesso livello gerarchico. Le ombre li separano da elementi a livelli diversi. Non usare ombre dove bastano i bordi, e non usare bordi dove servono le ombre.

## 5. Components

### Buttons
Solidi, diretti, con peso visivo dichiarato. Si capisce sempre quale azione è primaria.

- **Shape:** angoli arrotondati (12px) — definiti ma non soffici; non pill, non sharp.
- **Primary:** gradient lineare `#2d6df6 → #1d4ed8`, testo bianco, altezza 44px, padding 0 16px. Inset shadow inferiore (`inset 0 -1px 0 rgba(15,23,42,0.12)`) per dare senso di spessore.
- **Hover / Focus:** `filter: brightness(1.02)` — sottile, non drammatico. Nessun scale o translate.
- **Ghost:** gradient `#f8fbff → #eef4fb`, testo `--ink`, bordo `--border`. Per azioni secondarie sullo stesso piano del primario.
- **Ghost Danger:** gradient `#fff5f5 → #fee2e2`, testo `--alert` (#dc2626), bordo `#fca5a5`. Per azioni distruttive non ancora confermate.
- **Danger:** gradient rosso pieno `#ef4444 → #dc2626`. Per azioni distruttive con conferma.
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed`. Nessun altro stile.

### Chips / Status Badges
I chip di stato sono l'elemento più critico del sistema: codificano il workflow.

- **Style:** pill (radius 999px), altezza 30px, padding 0 10px, font-size 0.76rem peso 700, bordo 1px con il colore semantico a 20-24% opacità, testo con il colore semantico pieno, sfondo quasi-bianco (`#f8fafc`).
- **Regola:** il background è sempre neutro. Il colore del chip sta nel testo e nel bordo, mai nel fill. Questo garantisce leggibilità e coerenza con la Regola del Solo Testo.

### Cards / Containers
- **Corner Style:** 14px (card operativa), 18px (content-header, superfici principali)
- **Background:** `#ffffff` — bianco pieno su sfondo `#eef3f9`. Il contrasto tra card e sfondo nasce dal tono, non dall'ombra.
- **Shadow Strategy:** `--shadow-sm` per card a riposo. Nessuna ombra aggiuntiva al hover (la selezione usa un bordo colorato, non un'ombra potenziata).
- **Border:** `1px solid rgba(148, 163, 184, 0.18-0.22)` — semitrasparente, quasi invisibile.
- **Internal Padding:** 18px standard (`.chart-card`, `.detail-card`); 14px per kanban card.

### Kanban Card (componente firma)
La kanban card è il componente più distintivo del sistema.

- **Accent bar:** pseudo-elemento `::before` larghezza 3px, `inset: 0 auto 0 0` — striscia verticale sinistra con il colore semantico dello stato corrente. Non è un `border-left` standard: è un gradient che sfuma da `color-mix(in srgb, statusColor 72%, white 28%)` a `statusColor` — più sottile, più controllato.
- **Overflow button:** pseudo-elemento `::after` come bordo interno con il colore dello stato al 18% — conferma visiva dello stato senza sovraccaricare.
- **Drag state:** l'ombra passa da `--shadow-sm` a `0 18px 36px rgba(15,23,42,0.12)`. Il placeholder originale scende a `opacity: 0.35`.
- **Compact mode:** padding ridotto, font-size leggermente inferiore. Stessa struttura.

### Inputs / Fields
- **Style:** bordo `1px solid --border`, radius 12px, altezza 46px, padding 0 14px. Sfondo bianco, testo `--ink`.
- **Focus:** `border-color: --primary`, `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)` — anello di focus blu leggero.
- **Form labels:** uppercase, 0.72rem, peso 700, `letter-spacing: 0.02em`, colore `--muted`. Asterisco rosso per campi required.
- **Textarea:** stesso stile, `padding: 12px 14px`, `resize: vertical`.

### Navigation (Sidebar)
- **Layout:** sidebar fissa 300px, gradient verticale `#f7f9fd → #f1f5fb`, bordo destro `rgba(148,163,184,0.2)`.
- **Brand mark:** quadrato 42px, radius 12px, gradient `#3b82f6 → #1d4ed8`, iniziali bianche peso 800.
- **Nav items:** altezza minima 54px, bordo-raggio `0 14px 14px 0` (solo lato destro — l'active state ha un bar indicator sinistro). Default: sfondo trasparente, colore `#334155`. Hover: `rgba(37,99,235,0.08)`. Active: `rgba(37,99,235,0.14)` + `inset 4px 0 0 #0b5ed7` — il bar indicator a sinistra segnala la selezione senza una tab bar piena.

### Modal
- **Backdrop:** `rgba(15, 23, 42, 0.4)` — scuro ma trasparente; il contesto rimane percettibile.
- **Detail modal:** `max-width: 1100px`, `max-height: 92vh`, scrollable internamente. Il modal è grande — è la vista di lavoro principale su un ordine, non un dialog di conferma.
- **Confirm modal:** `min(460px, 92vw)` — compatto.

## 6. Do's and Don'ts

### Do:
- **Usa il blu primario (`#2563eb`) solo per azioni attivabili** — bottoni primari, link, nav active. Non come colore decorativo o per enfatizzare testo informativo.
- **Usa i colori di stato solo nel contesto del workflow** — chip, barre laterali delle kanban card, header di colonna kanban. Mai come accenti generici dell'interfaccia.
- **Mantieni sfondo bianco sulle card** — il contrasto tra `#ffffff` e `#eef3f9` è l'unico strumento di separazione al livello base; non alterarlo con tinte.
- **Usa label uppercase solo per metadati brevi** — etichette KV, intestazioni di sezione, colonne tabella. Mai per testo body o titoli.
- **Dai sempre un'ombra strutturale coerente con la gerarchia** — `--shadow-sm` per card, `--shadow-md` per modal. Nessun valore arbitrario.
- **Comunica lo stato anche senza colore** — chip con testo del nome stato, icone o simboli a supporto; il colore rafforza, non sostituisce.

### Don't:
- **Non usare border-left colorato e spesso (>1px) come decorazione** — la striscia laterale della kanban card è un pseudo-elemento 3px controllato; fuori da quel contesto, un `border-left` colorato è vietato. Usa sfondo tinto, bordo completo o niente.
- **Non mettere testo in gradient** (`background-clip: text`): vietato in tutto il sistema.
- **Non inventare un'estetica ERP legacy** — nessuna tabella con header a sfondo grigio-blu, nessun campo piatto senza bordo su sfondo grigio, nessun bottone con `border-radius: 2px` e aspetto anni '90.
- **Non usare pattern da app consumer o B2C** — no pastelli, no illustrazioni, no copy amichevole nel chrome dell'interfaccia, no mobile-first che sacrifica la densità desktop.
- **Non replicare template SaaS generici** — nessun eyebrow uppercase su ogni sezione, nessuna card grid con icona + titolo + testo ripetuta all'infinito, nessun hero con metrica grande + numero + gradient.
- **Non aggiungere una seconda famiglia tipografica** — Manrope è sufficiente in tutti i pesi. Una seconda family crea tensione visiva senza aggiungere gerarchia.
- **Non usare ombre arbitrarie** — solo i quattro livelli documentati nella sezione Elevation. `box-shadow: 0 0 20px rgba(0,0,0,0.3)` fuori scala è vietato.
- **Non mettere colori di stato come sfondo di superfici grandi** — `#166534` come background di una card è illeggibile e rompe la semantica del sistema. Solo come `color` e `border-color` su chip e accent bar.
