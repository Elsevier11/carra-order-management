# Design: Configurazione ERP SQL Server da UI

**Data:** 2026-06-04
**Stato:** Approvato

## Contesto

I parametri di connessione al SQL Server ERP (host, porta, database, utente, password) sono attualmente fissi nel file `.env` del server. Questo rende l'installazione presso nuovi clienti dipendente dall'accesso al filesystem del server. L'obiettivo è permettere la configurazione da interfaccia web, accessibile solo all'amministratore.

## Approccio scelto

**DB-first con fallback a `.env`** — i parametri vengono letti prima dalla tabella `import_config` di PostgreSQL; se mancanti, si usano le variabili d'ambiente come fallback. Compatibilità retroattiva garantita: installazioni che usano già `.env` non richiedono alcuna modifica.

---

## Backend

### Storage

Nessuna nuova tabella. Le chiavi vengono aggiunte alla tabella `import_config` esistente (già usata per `sqlserver_last_import_date`):

| Chiave | Tipo | Fallback env |
|---|---|---|
| `sqlserver_host` | string | `SQLSERVER_HOST` |
| `sqlserver_port` | string | `SQLSERVER_PORT` (default 1433) |
| `sqlserver_database` | string | `SQLSERVER_DATABASE` |
| `sqlserver_user` | string | `SQLSERVER_USER` |
| `sqlserver_password` | string | `SQLSERVER_PASSWORD` |
| `sqlserver_timeout_ms` | string | `SQLSERVER_QUERY_TIMEOUT_MS` (default 15000) |

La password è memorizzata in chiaro. Accettabile per uso interno su rete privata.

### Modifica `src/server/sqlserver.ts`

`getConfig()` diventa `resolveErpConfig(pgClient)`: funzione asincrona che legge le chiavi dal DB e cade sull'env per i valori mancanti. `fetchErpOrders` riceve la config risolta come parametro invece di chiamare `getConfig()` internamente.

### Nuovo router `src/server/routes/settings.ts`

Montato su `/api/settings`. Tutti gli endpoint richiedono ruolo `admin`.

**`GET /api/settings/sqlserver`**
- Legge le 6 chiavi da `import_config`, fallback su env
- Risposta: oggetto con i valori correnti; password restituita come `***`; campo `source: "db" | "env"` per ogni parametro

**`PUT /api/settings/sqlserver`**
- Body: `{ host, port, database, user, password, timeoutMs }`
- Se `password === ""` (campo non toccato), non sovrascrivere il valore esistente
- Upsert di tutte le chiavi modificate in `import_config`
- Risposta: `{ ok: true }`

**`POST /api/settings/sqlserver/test`**
- Legge la config corrente (DB + env fallback)
- Tenta connessione reale a SQL Server con timeout ridotto (5s)
- Risposta: `{ ok: true }` oppure `{ ok: false, message: "..." }`

### Modifica `src/server/routes/import.ts`

Le route `/sqlserver/preview` e `/sqlserver/execute` chiamano `resolveErpConfig(pgClient)` e passano la config a `fetchErpOrders` invece di affidarsi all'env direttamente.

---

## Frontend

### Nuovo componente `SettingsComponent`

- Path: `frontend/src/app/settings/settings.component.ts`
- Route Angular: `/settings`
- Guard: redirect a `/` se `currentUser.role !== 'admin'`

### Accesso

Link "Impostazioni" nell'header, visibile solo agli admin, accanto agli altri controlli di navigazione.

### Layout

Card "Connessione ERP SQL Server" con form:

```
[ Server (host) ]     [ Porta ]
[ Database            ]
[ Utente              ]
[ Password  👁 ]       ← toggle visibilità campo
[ Timeout (ms)        ]

Origine: [badge "Da database" | "Da .env (default)" | "Mista"]

[Test connessione]                [Salva]
```

**Badge origine:** calcolato dai campi `source` restituiti dal GET. Se tutti i valori vengono dal DB → "Da database"; se tutti da env → "Da .env (default)"; misto → "Mista (DB + .env)".

**Test connessione:** chiama `POST /api/settings/sqlserver/test`. Durante la chiamata il bottone mostra uno spinner. Risultato mostrato inline sotto il form: verde per successo, rosso con messaggio per errore.

**Salva:** invia PUT. Se il campo password contiene `***` (valore mascherato non modificato dall'utente), invia stringa vuota affinché il server non sovrascriva. Feedback inline di successo/errore.

### Service

Tre metodi nuovi, preferibilmente in un nuovo `SettingsService` (`frontend/src/app/settings.service.ts`) per non appesantire `ConsegneService`:

- `getSqlServerConfig(): Observable<SqlServerConfigResponse>`
- `saveSqlServerConfig(config): Observable<{ ok: boolean }>`
- `testSqlServerConnection(): Observable<{ ok: boolean; message?: string }>`

### Tipi nuovi in `consegne.types.ts`

```typescript
export interface SqlServerConfigParam {
  value: string
  source: 'db' | 'env'
}

export interface SqlServerConfigResponse {
  host: SqlServerConfigParam
  port: SqlServerConfigParam
  database: SqlServerConfigParam
  user: SqlServerConfigParam
  password: SqlServerConfigParam  // value sempre "***"
  timeoutMs: SqlServerConfigParam
}
```

---

## Gestione errori

| Scenario | Comportamento |
|---|---|
| Nessun parametro in DB né in env | `resolveErpConfig` lancia errore; preview/execute rispondono 502 come oggi |
| Test connessione fallisce | `{ ok: false, message: "..." }` — UI mostra messaggio ERP |
| PUT con host vuoto | Validazione Zod lato server: `host` obbligatorio, errore 400 |
| Accesso `/settings` senza ruolo admin | Guard frontend redirige a `/`; API risponde 403 |

---

## Fuori scope

- Cifratura della password (rimandato a esigenza futura)
- Gestione di profili di connessione multipli
- Configurazione via CLI o file di seed automatico
