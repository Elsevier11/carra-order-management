# ERP SQL Server Config da UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettere all'admin di configurare i parametri di connessione ERP SQL Server (host, porta, database, utente, password) dall'interfaccia web, senza modificare il file `.env`.

**Architecture:** I parametri vengono salvati nella tabella `import_config` esistente (key-value). Il server li legge dal DB con fallback sulle variabili d'ambiente. Una nuova view "Impostazioni" nel sidebar (solo admin) espone il form di configurazione con test connessione.

**Tech Stack:** Node.js/Express + Zod (backend), Angular 17+ con `@if` control flow (frontend), `mssql` (già installato), `postgres` (già installato).

---

## File Map

| File | Azione | Responsabilità |
|---|---|---|
| `src/server/sqlserver.ts` | Modifica | `resolveErpConfig()` async + `testErpConnection()` + firma `fetchErpOrders` |
| `src/server/routes/import.ts` | Modifica | Passa config risolta a `fetchErpOrders` |
| `src/server/routes/settings.ts` | Crea | Endpoints GET/PUT/POST-test per config SQL Server |
| `src/server/app.ts` | Modifica | Monta `settingsRouter` su `/api/settings` |
| `frontend/src/app/consegne.types.ts` | Modifica | Aggiunge `SqlServerConfigParam`, `SqlServerConfigResponse` |
| `frontend/src/app/settings.service.ts` | Crea | `SettingsService` con 3 metodi HTTP |
| `frontend/src/app/app.component.ts` | Modifica | ViewMode settings, state vars, metodi load/save/test |
| `frontend/src/app/app.component.html` | Modifica | Sidebar button + settings view |
| `frontend/src/app/app.component.scss` | Modifica | Stili settings page |

---

## Task 1: Refactor `sqlserver.ts` — config asincrona e test connessione

**Files:**
- Modify: `src/server/sqlserver.ts`

- [ ] **Step 1: Sostituire tutto il contenuto di `src/server/sqlserver.ts`**

```typescript
import sql from 'mssql'
import type postgres from 'postgres'

export interface ErpOrder {
  externalRef: string
  rifto: string
  cliente: string
  dataOrdine: string | null
  dataConsegna: string | null
  cantiere: string | null
  agenteNome: string | null
  agenteCodice: string | null
}

export interface ErpConfig {
  server: string
  port: number
  database: string
  user: string
  password: string
  timeoutMs: number
}

export async function resolveErpConfig(pgClient: postgres.Sql): Promise<ErpConfig> {
  const rows = await pgClient<{ key: string; value: string }[]>`
    select key, value from import_config
    where key in (
      'sqlserver_host', 'sqlserver_port', 'sqlserver_database',
      'sqlserver_user', 'sqlserver_password', 'sqlserver_timeout_ms'
    )
  `
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const host = map['sqlserver_host'] ?? process.env.SQLSERVER_HOST
  if (!host) {
    throw new Error(
      'Parametri ERP non configurati. Configurare la connessione nella pagina Impostazioni.',
    )
  }

  return {
    server: host,
    port: parseInt(map['sqlserver_port'] ?? process.env.SQLSERVER_PORT ?? '1433', 10),
    database: map['sqlserver_database'] ?? process.env.SQLSERVER_DATABASE ?? '',
    user: map['sqlserver_user'] ?? process.env.SQLSERVER_USER ?? '',
    password: map['sqlserver_password'] ?? process.env.SQLSERVER_PASSWORD ?? '',
    timeoutMs: parseInt(
      map['sqlserver_timeout_ms'] ?? process.env.SQLSERVER_QUERY_TIMEOUT_MS ?? '15000',
      10,
    ),
  }
}

function buildSqlConfig(config: ErpConfig, timeoutOverride?: number): sql.config {
  const timeout = timeoutOverride ?? config.timeoutMs
  return {
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    connectionTimeout: timeout,
    requestTimeout: timeout,
  }
}

export async function testErpConnection(config: ErpConfig): Promise<void> {
  const pool = new sql.ConnectionPool(buildSqlConfig(config, 5000))
  await pool.connect()
  await pool.close()
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  return String(value)
}

export async function fetchErpOrders(config: ErpConfig, sinceDate: Date): Promise<ErpOrder[]> {
  const pool = new sql.ConnectionPool(buildSqlConfig(config))
  await pool.connect()
  try {
    const request = pool.request()
    request.input('sinceDate', sql.DateTime, sinceDate)

    const result = await request.query<{
      NumeroDoc: string
      DataDoc: Date | null
      DataConsegna: Date | null
      Cd_DoSottoCommessa: string | null
      ClienteNome: string | null
      AgenteCodice: string | null
      AgenteNome: string | null
    }>(`
      SELECT TOP 1000
        t.NumeroDoc,
        t.DataDoc,
        t.DataConsegna,
        t.Cd_DoSottoCommessa,
        cf.Descrizione  AS ClienteNome,
        a.Cd_Agente     AS AgenteCodice,
        a.Descrizione   AS AgenteNome
      FROM dbo.DOTes t
      LEFT JOIN dbo.CF     cf ON t.Cd_CF       = cf.Cd_CF
      LEFT JOIN dbo.Agente a  ON t.Cd_Agente_1 = a.Cd_Agente
      WHERE t.Cd_Do   = 'OC '
        AND t.DataDoc >= @sinceDate
      ORDER BY t.DataDoc ASC
    `)

    return result.recordset.map((row) => ({
      externalRef: String(row.NumeroDoc).trim(),
      rifto: String(row.NumeroDoc).trim(),
      cliente: row.ClienteNome?.trim() ?? '',
      dataOrdine: toIsoDate(row.DataDoc),
      dataConsegna: toIsoDate(row.DataConsegna),
      cantiere: row.Cd_DoSottoCommessa?.trim() ?? null,
      agenteNome: row.AgenteNome?.trim() ?? null,
      agenteCodice: row.AgenteCodice?.trim() ?? null,
    }))
  } finally {
    await pool.close()
  }
}
```

- [ ] **Step 2: Verificare che TypeScript compili senza errori**

```bash
cd C:\Dev\Carra_Ordini
npx tsc --noEmit --project tsconfig.server.json
```

Expected: nessun errore relativo a `sqlserver.ts` (altri errori pre-esistenti sono ok da ignorare per ora).

- [ ] **Step 3: Commit**

```bash
git add src/server/sqlserver.ts
git commit -m "refactor(erp): resolveErpConfig async, testErpConnection, fetchErpOrders accetta config"
```

---

## Task 2: Aggiornare `import.ts` — passare config a `fetchErpOrders`

**Files:**
- Modify: `src/server/routes/import.ts`

- [ ] **Step 1: Aggiornare gli import in testa al file**

Sostituire la riga:
```typescript
import { fetchErpOrders, type ErpOrder } from '../sqlserver'
```
con:
```typescript
import { fetchErpOrders, resolveErpConfig, type ErpOrder } from '../sqlserver'
```

- [ ] **Step 2: Aggiornare la route `/sqlserver/preview`**

Trovare il blocco che chiama `fetchErpOrders(sinceDate)` (righe ~99-106) e sostituirlo con:

```typescript
      // 3. Interroga SQL Server con timeout
      let erpOrders: ErpOrder[]
      try {
        const erpConfig = await resolveErpConfig(pgClient)
        erpOrders = await fetchErpOrders(erpConfig, sinceDate)
      } catch (erpErr: unknown) {
        const message =
          erpErr instanceof Error ? erpErr.message : 'Errore connessione ERP SQL Server'
        return res.status(502).json({ message: `Impossibile connettersi al server ERP: ${message}` })
      }
```

- [ ] **Step 3: Verificare TypeScript**

```bash
npx tsc --noEmit --project tsconfig.server.json
```

Expected: nessun errore su `import.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/server/routes/import.ts
git commit -m "fix(erp): import routes usano resolveErpConfig da DB con fallback env"
```

---

## Task 3: Creare il router `settings.ts`

**Files:**
- Create: `src/server/routes/settings.ts`

- [ ] **Step 1: Creare il file `src/server/routes/settings.ts`**

```typescript
import { Router } from 'express'
import { z } from 'zod'
import { pgClient } from '../db'
import { requireAuth, requireRole } from '../middleware/auth'
import { resolveErpConfig, testErpConnection } from '../sqlserver'

const router = Router()

// ── GET /api/settings/sqlserver ───────────────────────────────────────────────

router.get('/sqlserver', requireAuth, requireRole(['admin']), async (_req, res, next) => {
  try {
    const rows = await pgClient<{ key: string; value: string }[]>`
      select key, value from import_config
      where key in (
        'sqlserver_host', 'sqlserver_port', 'sqlserver_database',
        'sqlserver_user', 'sqlserver_password', 'sqlserver_timeout_ms'
      )
    `
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

    const param = (
      dbKey: string,
      envKey: string,
      fallback = '',
    ): { value: string; source: 'db' | 'env' } => {
      if (map[dbKey] !== undefined) return { value: map[dbKey], source: 'db' }
      return { value: process.env[envKey] ?? fallback, source: 'env' }
    }

    return res.json({
      host: param('sqlserver_host', 'SQLSERVER_HOST'),
      port: param('sqlserver_port', 'SQLSERVER_PORT', '1433'),
      database: param('sqlserver_database', 'SQLSERVER_DATABASE'),
      user: param('sqlserver_user', 'SQLSERVER_USER'),
      password: {
        value: '***',
        source: map['sqlserver_password'] !== undefined ? 'db' : ('env' as const),
      },
      timeoutMs: param('sqlserver_timeout_ms', 'SQLSERVER_QUERY_TIMEOUT_MS', '15000'),
    })
  } catch (err) {
    return next(err)
  }
})

// ── PUT /api/settings/sqlserver ───────────────────────────────────────────────

const sqlServerConfigSchema = z.object({
  host: z.string().min(1, 'Host obbligatorio'),
  port: z.string().regex(/^\d+$/, 'Porta deve essere un numero'),
  database: z.string().min(1, 'Database obbligatorio'),
  user: z.string(),
  password: z.string(),
  timeoutMs: z.string().regex(/^\d+$/, 'Timeout deve essere un numero'),
})

router.put('/sqlserver', requireAuth, requireRole(['admin']), async (req, res, next) => {
  try {
    const { host, port, database, user, password, timeoutMs } = sqlServerConfigSchema.parse(
      req.body,
    )

    const updates: Array<{ key: string; value: string }> = [
      { key: 'sqlserver_host', value: host },
      { key: 'sqlserver_port', value: port },
      { key: 'sqlserver_database', value: database },
      { key: 'sqlserver_user', value: user },
      { key: 'sqlserver_timeout_ms', value: timeoutMs },
    ]

    if (password !== '') {
      updates.push({ key: 'sqlserver_password', value: password })
    }

    for (const { key, value } of updates) {
      await pgClient`
        insert into import_config (key, value, updated_at)
        values (${key}, ${value}, now())
        on conflict (key) do update set value = excluded.value, updated_at = now()
      `
    }

    return res.json({ ok: true })
  } catch (err) {
    return next(err)
  }
})

// ── POST /api/settings/sqlserver/test ────────────────────────────────────────

router.post('/sqlserver/test', requireAuth, requireRole(['admin']), async (_req, res, next) => {
  try {
    const config = await resolveErpConfig(pgClient)
    await testErpConnection(config)
    return res.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Errore connessione'
    return res.json({ ok: false, message })
  }
})

export default router
```

- [ ] **Step 2: Verificare TypeScript**

```bash
npx tsc --noEmit --project tsconfig.server.json
```

Expected: nessun errore su `settings.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/server/routes/settings.ts
git commit -m "feat(api): GET/PUT/POST-test /api/settings/sqlserver per config ERP"
```

---

## Task 4: Montare `settingsRouter` in `app.ts`

**Files:**
- Modify: `src/server/app.ts`

- [ ] **Step 1: Aggiungere import del router**

Dopo la riga `import responsabiliRoutes from './routes/responsabili'` aggiungere:

```typescript
import settingsRoutes from './routes/settings'
```

- [ ] **Step 2: Montare il router**

Dopo la riga `app.use('/api/responsabili', responsabiliRoutes)` aggiungere:

```typescript
  app.use('/api/settings', settingsRoutes)
```

- [ ] **Step 3: Verificare TypeScript e avviare il server per un controllo rapido**

```bash
npx tsc --noEmit --project tsconfig.server.json
```

Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/server/app.ts
git commit -m "feat(api): monta settingsRoutes su /api/settings"
```

---

## Task 5: Aggiungere tipi frontend in `consegne.types.ts`

**Files:**
- Modify: `frontend/src/app/consegne.types.ts`

- [ ] **Step 1: Aggiungere i nuovi tipi in fondo al file**

```typescript
// ── Settings: configurazione ERP SQL Server ──────────────────────────────────

export interface SqlServerConfigParam {
  value: string;
  source: 'db' | 'env';
}

export interface SqlServerConfigResponse {
  host: SqlServerConfigParam;
  port: SqlServerConfigParam;
  database: SqlServerConfigParam;
  user: SqlServerConfigParam;
  password: SqlServerConfigParam;
  timeoutMs: SqlServerConfigParam;
}

export interface SqlServerConfigSavePayload {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  timeoutMs: string;
}

export interface SqlServerTestResult {
  ok: boolean;
  message?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/consegne.types.ts
git commit -m "feat(types): SqlServerConfigResponse e tipi settings ERP"
```

---

## Task 6: Creare `SettingsService`

**Files:**
- Create: `frontend/src/app/settings.service.ts`

- [ ] **Step 1: Creare il file**

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  SqlServerConfigResponse,
  SqlServerConfigSavePayload,
  SqlServerTestResult,
} from './consegne.types';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/settings`;

  getSqlServerConfig(): Observable<SqlServerConfigResponse> {
    return this.http.get<SqlServerConfigResponse>(`${this.baseUrl}/sqlserver`);
  }

  saveSqlServerConfig(payload: SqlServerConfigSavePayload): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.baseUrl}/sqlserver`, payload);
  }

  testSqlServerConnection(): Observable<SqlServerTestResult> {
    return this.http.post<SqlServerTestResult>(`${this.baseUrl}/sqlserver/test`, {});
  }
}
```

- [ ] **Step 2: Verificare che Angular compili**

```bash
cd frontend
npx ng build --configuration development 2>&1 | tail -20
```

Expected: build completata senza errori su `settings.service.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/settings.service.ts
git commit -m "feat(frontend): SettingsService con getSqlServerConfig/save/test"
```

---

## Task 7: Aggiornare `AppComponent` — TypeScript

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Aggiungere import di `SettingsService` e dei nuovi tipi**

Nella sezione imports in testa al file, aggiungere `SettingsService` e i nuovi tipi:

```typescript
import { SettingsService } from './settings.service';
```

Nella riga degli import da `consegne.types`, aggiungere alla lista:
```typescript
  SqlServerConfigResponse,
  SqlServerConfigSavePayload,
  SqlServerTestResult,
```

- [ ] **Step 2: Aggiungere `'settings'` al tipo `ViewMode`**

Trovare:
```typescript
type ViewMode = 'dashboard' | 'kanban' | 'audit' | 'anagrafiche';
```
Sostituire con:
```typescript
type ViewMode = 'dashboard' | 'kanban' | 'audit' | 'anagrafiche' | 'settings';
```

- [ ] **Step 3: Iniettare `SettingsService` nella classe**

Dopo la riga:
```typescript
  private readonly authService = inject(AuthService);
```
Aggiungere:
```typescript
  private readonly settingsService = inject(SettingsService);
```

- [ ] **Step 4: Aggiungere le variabili di stato per la pagina settings**

In fondo al blocco delle variabili di stato (prima del primo metodo), aggiungere:

```typescript
  // ── Settings ERP ─────────────────────────────────────────────────────────────
  settingsConfig: SqlServerConfigResponse | null = null;
  settingsLoading = false;
  settingsSaving = false;
  settingsTesting = false;
  settingsError = '';
  settingsSuccess = '';
  settingsTestResult: SqlServerTestResult | null = null;
  settingsShowPassword = false;
  settingsForm = {
    host: '',
    port: '1433',
    database: '',
    user: '',
    password: '',
    timeoutMs: '15000',
  };
```

- [ ] **Step 5: Aggiungere guard 'settings' in `changeView()`**

Trovare:
```typescript
    if ((view === 'audit' || view === 'anagrafiche') && !this.isAdmin) return;
```
Sostituire con:
```typescript
    if ((view === 'audit' || view === 'anagrafiche' || view === 'settings') && !this.isAdmin) return;
    if (view === 'settings') this.loadSettings();
```

- [ ] **Step 6: Aggiungere i metodi della pagina settings**

In fondo al file, prima della chiusura della classe `}`, aggiungere:

```typescript
  // ── Settings ERP — metodi ────────────────────────────────────────────────────

  loadSettings(): void {
    if (!this.isAdmin) return;
    this.settingsLoading = true;
    this.settingsError = '';
    this.settingsSuccess = '';
    this.settingsTestResult = null;
    this.settingsService.getSqlServerConfig().subscribe({
      next: (config) => {
        this.settingsConfig = config;
        this.settingsForm = {
          host: config.host.value,
          port: config.port.value,
          database: config.database.value,
          user: config.user.value,
          password: '***',
          timeoutMs: config.timeoutMs.value,
        };
        this.settingsLoading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.settingsLoading = false;
        this.settingsError = err?.error?.message ?? 'Errore caricamento configurazione';
      },
    });
  }

  saveSettings(): void {
    if (!this.isAdmin) return;
    this.settingsSaving = true;
    this.settingsError = '';
    this.settingsSuccess = '';
    const payload: SqlServerConfigSavePayload = {
      host: this.settingsForm.host,
      port: this.settingsForm.port,
      database: this.settingsForm.database,
      user: this.settingsForm.user,
      password: this.settingsForm.password === '***' ? '' : this.settingsForm.password,
      timeoutMs: this.settingsForm.timeoutMs,
    };
    this.settingsService.saveSqlServerConfig(payload).subscribe({
      next: () => {
        this.settingsSaving = false;
        this.settingsSuccess = 'Configurazione salvata.';
        this.loadSettings();
      },
      error: (err: { error?: { message?: string } }) => {
        this.settingsSaving = false;
        this.settingsError = err?.error?.message ?? 'Errore salvataggio';
      },
    });
  }

  testSettings(): void {
    if (!this.isAdmin) return;
    this.settingsTesting = true;
    this.settingsTestResult = null;
    this.settingsError = '';
    this.settingsService.testSqlServerConnection().subscribe({
      next: (result) => {
        this.settingsTesting = false;
        this.settingsTestResult = result;
      },
      error: (err: { error?: { message?: string } }) => {
        this.settingsTesting = false;
        this.settingsTestResult = { ok: false, message: err?.error?.message ?? 'Errore test' };
      },
    });
  }

  get settingsOriginLabel(): string {
    if (!this.settingsConfig) return '';
    const sources = [
      this.settingsConfig.host.source,
      this.settingsConfig.port.source,
      this.settingsConfig.database.source,
      this.settingsConfig.user.source,
      this.settingsConfig.password.source,
    ];
    const allDb = sources.every((s) => s === 'db');
    const allEnv = sources.every((s) => s === 'env');
    if (allDb) return 'Da database';
    if (allEnv) return 'Da .env (default)';
    return 'Mista (DB + .env)';
  }
```

- [ ] **Step 7: Verificare compilazione Angular**

```bash
cd frontend
npx ng build --configuration development 2>&1 | tail -30
```

Expected: build ok, nessun errore su `app.component.ts`.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat(frontend): AppComponent — settings view, stato e metodi ERP config"
```

---

## Task 8: Aggiornare `AppComponent` — HTML

**Files:**
- Modify: `frontend/src/app/app.component.html`

- [ ] **Step 1: Aggiungere il bottone "Impostazioni" nel sidebar**

Trovare nel sidebar il blocco `@if (isAdmin)` che contiene `audit` e `anagrafiche`:
```html
        @if (isAdmin) {
          <button type="button" [class.active]="activeView === 'audit'" (click)="changeView('audit')">Audit</button>
          <button type="button" [class.active]="activeView === 'anagrafiche'" (click)="changeView('anagrafiche')">Anagrafiche</button>
        }
```
Sostituire con:
```html
        @if (isAdmin) {
          <button type="button" [class.active]="activeView === 'audit'" (click)="changeView('audit')">Audit</button>
          <button type="button" [class.active]="activeView === 'anagrafiche'" (click)="changeView('anagrafiche')">Anagrafiche</button>
          <button type="button" [class.active]="activeView === 'settings'" (click)="changeView('settings')">Impostazioni</button>
        }
```

- [ ] **Step 2: Aggiungere il blocco della view settings**

In fondo al template, prima dell'ultimo `}` che chiude il blocco `@else {` principale (dopo il modale ERP), aggiungere:

```html
  @if (activeView === 'settings' && isAdmin) {
    <div class="content-header">
      <h1 class="content-title">Impostazioni</h1>
    </div>
    <div class="settings-page">
      <div class="settings-card">
        <h2 class="settings-card-title">Connessione ERP SQL Server</h2>

        @if (settingsLoading) {
          <p class="settings-loading">Caricamento configurazione...</p>
        } @else {
          <div class="settings-form">
            <div class="settings-row settings-row--two">
              <label class="settings-field">
                <span>Server (host)</span>
                <input type="text" [(ngModel)]="settingsForm.host" placeholder="es. srvsql" />
                @if (settingsConfig) {
                  <small class="settings-source">{{ settingsConfig.host.source === 'db' ? 'Da database' : 'Da .env' }}</small>
                }
              </label>
              <label class="settings-field">
                <span>Porta</span>
                <input type="text" [(ngModel)]="settingsForm.port" placeholder="1433" />
              </label>
            </div>
            <label class="settings-field">
              <span>Database</span>
              <input type="text" [(ngModel)]="settingsForm.database" placeholder="es. ADB_GESTIONALE" />
              @if (settingsConfig) {
                <small class="settings-source">{{ settingsConfig.database.source === 'db' ? 'Da database' : 'Da .env' }}</small>
              }
            </label>
            <label class="settings-field">
              <span>Utente</span>
              <input type="text" [(ngModel)]="settingsForm.user" placeholder="es. sa" autocomplete="off" />
            </label>
            <label class="settings-field">
              <span>Password</span>
              <div class="settings-password-wrap">
                <input
                  [type]="settingsShowPassword ? 'text' : 'password'"
                  [(ngModel)]="settingsForm.password"
                  autocomplete="new-password"
                />
                <button type="button" class="ghost settings-eye" (click)="settingsShowPassword = !settingsShowPassword">
                  {{ settingsShowPassword ? 'Nascondi' : 'Mostra' }}
                </button>
              </div>
              @if (settingsConfig) {
                <small class="settings-source">{{ settingsConfig.password.source === 'db' ? 'Da database' : 'Da .env' }}</small>
              }
            </label>
            <label class="settings-field settings-field--narrow">
              <span>Timeout (ms)</span>
              <input type="text" [(ngModel)]="settingsForm.timeoutMs" placeholder="15000" />
            </label>

            @if (settingsConfig) {
              <p class="settings-origin">
                Origine configurazione: <strong>{{ settingsOriginLabel }}</strong>
              </p>
            }

            @if (settingsError) {
              <div class="error">{{ settingsError }}</div>
            }
            @if (settingsSuccess) {
              <div class="success-box">{{ settingsSuccess }}</div>
            }
            @if (settingsTestResult) {
              <div [class]="settingsTestResult.ok ? 'success-box' : 'error'">
                @if (settingsTestResult.ok) { Connessione riuscita. }
                @else { Connessione fallita: {{ settingsTestResult.message }} }
              </div>
            }
          </div>

          <div class="settings-actions">
            <button
              type="button"
              class="ghost"
              [disabled]="settingsTesting || settingsSaving"
              (click)="testSettings()"
            >
              {{ settingsTesting ? 'Test in corso...' : 'Test connessione' }}
            </button>
            <button
              type="button"
              [disabled]="settingsSaving || settingsTesting"
              (click)="saveSettings()"
            >
              {{ settingsSaving ? 'Salvataggio...' : 'Salva' }}
            </button>
          </div>
        }
      </div>
    </div>
  }
```

- [ ] **Step 3: Verificare compilazione Angular**

```bash
cd frontend
npx ng build --configuration development 2>&1 | tail -20
```

Expected: build ok.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/app.component.html
git commit -m "feat(frontend): settings view — form configurazione ERP SQL Server"
```

---

## Task 9: Stili CSS per la pagina settings

**Files:**
- Modify: `frontend/src/app/app.component.scss`

- [ ] **Step 1: Aggiungere in fondo al file**

```scss
// ── Settings page ──────────────────────────────────────────────────────────────

.settings-page {
  padding: 24px;
  max-width: 640px;
}

.settings-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 28px;
  display: grid;
  gap: 20px;
}

.settings-card-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.settings-form {
  display: grid;
  gap: 16px;
}

.settings-row--two {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: start;
}

.settings-field {
  display: grid;
  gap: 6px;
  font-size: 0.875rem;
  font-weight: 500;

  input {
    width: 100%;
    box-sizing: border-box;
  }
}

.settings-field--narrow {
  max-width: 200px;
}

.settings-source {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 400;
}

.settings-password-wrap {
  display: flex;
  gap: 8px;
  align-items: center;

  input {
    flex: 1;
  }
}

.settings-eye {
  white-space: nowrap;
  font-size: 0.8rem;
  padding: 4px 10px;
}

.settings-origin {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.settings-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.settings-loading {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0;
}
```

- [ ] **Step 2: Verificare build completa**

```bash
cd frontend
npx ng build --configuration development 2>&1 | tail -20
```

Expected: build completata senza errori.

- [ ] **Step 3: Commit finale**

```bash
git add frontend/src/app/app.component.scss
git commit -m "feat(frontend): stili pagina Impostazioni ERP"
```

---

## Self-Review

### Copertura spec

| Requisito spec | Task |
|---|---|
| Parametri in `import_config` con chiavi definite | Task 1, 3 |
| `resolveErpConfig` DB-first con fallback env | Task 1 |
| `testErpConnection` con timeout 5s | Task 1 |
| `fetchErpOrders` accetta config come parametro | Task 1 |
| Route preview/execute usano config da DB | Task 2 |
| `GET /api/settings/sqlserver` con `source` e password mascherata | Task 3 |
| `PUT /api/settings/sqlserver` con skip password se vuota | Task 3 |
| `POST /api/settings/sqlserver/test` | Task 3 |
| Tutti gli endpoint admin-only | Task 3 |
| Router montato su `/api/settings` | Task 4 |
| Tipi `SqlServerConfigResponse` ecc. | Task 5 |
| `SettingsService` con 3 metodi | Task 6 |
| `ViewMode` + guard `changeView` | Task 7 |
| Sidebar button solo per admin | Task 8 |
| Form con toggle password | Task 8 |
| Badge origine configurazione | Task 7 (getter), Task 8 (HTML) |
| Test connessione inline | Task 7, 8 |
| Stili pagina | Task 9 |

### Tipo consistency

- `SqlServerConfigSavePayload` definito in Task 5, usato in Task 6 e 7 — coerente.
- `settingsForm.password === '***'` → invia `''` → server non sovrascrive — coerente tra Task 7 e Task 3.
- `resolveErpConfig(pgClient)` — `pgClient` importato da `../db` in tutti i router — già presente nelle route esistenti, stesso pattern.

Nessun problema trovato.
