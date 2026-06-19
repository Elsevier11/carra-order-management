# Design: Sotto-tab Anagrafiche

**Data:** 2026-06-19  
**Scope:** Riorganizzazione pagina Anagrafiche — aggiunta secondo livello di navigazione a tab

## Problema

Tutte le sezioni di Persone (Utenti, Commerciali, Responsabili, Mittenti Disegno, Operai) e di Produzione (Vettori, Tipi Cemento, Tipi Accessorio) vengono mostrate tutte insieme in verticale. Non è chiaro a colpo d'occhio cosa si può gestire, e la pagina è lunga e caotica.

## Soluzione

Aggiungere un secondo livello di tab ("sotto-tab") dentro ciascuna macro-categoria, in modo che ogni tipo di anagrafica sia raggiungibile dal proprio tab e venga mostrata una sola sezione alla volta.

## Struttura Navigazione

```
[Persone]  [Produzione]          ← livello 1 (invariato)

Sotto "Persone":
  [Utenti] [Commerciali] [Responsabili] [Mittenti Disegno*] [Operai*]
                                         (* solo se isAdmin)

Sotto "Produzione":
  [Vettori] [Tipi Cemento] [Tipi Accessorio]
```

## Stato (TypeScript)

- `activePersoneSubTab: string = 'utenti'` — ricorda la sotto-tab attiva in Persone
- `activeProduzioneSubTab: string = 'vettori'` — ricorda la sotto-tab attiva in Produzione
- Quando si torna a una macro-tab, si ripristina la sotto-tab al valore precedente (non si resetta)

## Lazy Loading

Si carica solo la sotto-tab attiva, non l'intero gruppo:

| Sotto-tab | Metodo caricato |
|---|---|
| utenti | `loadUsers()` |
| commerciali | `loadCommerciali()` |
| responsabili | `loadResponsabili()` |
| mittenti-disegno | `loadMittentiDisegnoAdmin()` |
| operai | `loadOperaiAdmin()` |
| vettori | `loadVettoriAdmin()` |
| tipi-cemento | `loadCementiTipiAdmin()` |
| tipi-accessorio | `loadAccessoriTipiAdmin()` |

Il metodo `loadActiveRegistryTab()` viene sostituito da `loadActiveSubTab()` che fa switch sulla sotto-tab corrente.

## Stile

Le sotto-tab usano la stessa classe `ghost` delle tab principali, rese visivamente subordinate tramite una riga separata sotto la riga principale (stesso pattern già in uso nel progetto).

## File Modificati

- `frontend/src/app/app.component.ts` — stato, metodi setPersoneSubTab/setProduzioneSubTab, lazy load
- `frontend/src/app/app.component.html` — struttura tab HTML

## Fuori Scope

- Nessuna modifica al backend
- Nessuna modifica agli stili globali (solo classi già esistenti)
- Nessuna modifica alla logica CRUD delle singole sezioni
