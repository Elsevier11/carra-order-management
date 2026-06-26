# Carra Consegne Platform

## Avvio locale

1. `npm install`
2. `npm --prefix frontend install`
3. `npm run db:migrate`
4. `npm run db:seed` (campione iniziale)
5. `npm run dev`

Backend: `http://localhost:3100`  
Frontend Angular: `http://localhost:4200`

## API principali

- `GET /health`
- `POST /api/auth/login`
- `GET /api/consegne`
  - filtri: `q`, `cliente`, `vettore`, `stato`, `fromDate`, `toDate`
  - paginazione: `page`, `pageSize`
  - sorting: `sortBy` (`rif|cliente|dataConsegna|vettore|stato`), `sortDir` (`asc|desc`)
- `GET /api/consegne/:id`
- `GET /api/consegne/stats`
- `GET /api/consegne/filters`
- `GET /api/consegne/export` (auth)
- `GET /api/consegne/:id/attachments` (auth)
- `POST /api/consegne/:id/attachments` (auth: `admin|operativo`, multipart campo `file`)
- `GET /api/consegne/:id/attachments/:attachmentId` (auth)
- `DELETE /api/consegne/:id/attachments/:attachmentId` (auth: `admin|operativo`)
- `GET /api/audit` (auth: `admin`)
- `GET /api/audit/export` (auth: `admin`)
- `GET /api/users` (auth: `admin`)
- `POST /api/users` (auth: `admin`)
- `PUT /api/users/:id` (auth: `admin`)
- `PUT /api/users/:id/password` (auth: `admin`)
- `POST /api/import/preview` (auth: `admin|operativo`)
- `POST /api/consegne` (auth: `admin|operativo`)
- `PUT /api/consegne/:id` (auth: `admin|operativo`)
- `DELETE /api/consegne/:id` (auth: `admin|operativo`)

### Utenti demo (sviluppo)

- `admin / admin123`
- `operativo / operativo123`
- `lettura / lettura123`

## Build

- Frontend production build: `npm run build`
- Backend run (prod-like): `npm run start`

## Test Automatici

- Unit/integration non distruttivi:
  - `npm run test:run`
- API integration test su DB reale:
  - `npm run test:db`
  - usa `RUN_DB_TESTS=1`
  - opera su record con prefisso `__TEST__` e cleanup mirato

## Import Dataset Completo (120+)

1. Copia il file JSON completo in `data/consegne.full.json`
2. Import incrementale: `npm run db:import`
3. Import pulito (svuota tabella e reimporta): `npm run db:import:truncate`

Supporta chiavi sia camelCase che snake_case:
- `rif` o `rifto`
- `tipoImpianto` o `tipo_impianto`
- `dataConsegna` o `data_consegna`
- `vettore` o `traspor`

Puoi anche passare un file custom:
- `npm run db:import -- ./data/mio-file.json`

### Estrazione diretta da Excel (primi 4 fogli = stati)

- Estrai JSON + report:
  - `npm run db:extract:xlsx -- "C:\\percorso\\CARRA_CONSEGNE.xlsx" "./data/consegne.full.json" "./data/consegne.full.report.json"`
- Poi importa:
  - `npm run db:import:truncate -- ./data/consegne.full.json`

## Deploy

### Deploy Linux con Docker Compose

- Procedura consigliata per installazione on-prem: [docs/deploy-linux-docker.md](./docs/deploy-linux-docker.md)
- Stack incluso nel repository:
  - backend Node
  - frontend Angular servito da Nginx
  - PostgreSQL
  - importer one-shot per il JSON iniziale
- Per un aggiornamento normale in produzione:
  - `git pull`
  - `docker compose up -d --build`
- Il bootstrap DB va eseguito solo sul primo avvio di un DB nuovo:
  - `npm run db:bootstrap`
- Per aggiornamenti via immagini pubblicate su GitHub Container Registry:
  - `docker compose -f docker-compose.prod.yml pull`
  - `docker compose -f docker-compose.prod.yml up -d`

### URL API Frontend

- Per il pacchetto Docker/on-prem il frontend usa `apiUrl: '/api'`
- Se in futuro separi frontend e backend su domini diversi, serve una config dedicata o un reverse proxy che esponga comunque `/api` sullo stesso origin del browser

### Checklist Go-Live

- Vedi [docs/go-live-checklist.md](./docs/go-live-checklist.md)

## Operativita Produzione

- Cleanup retention allegati:
  - dry-run: `npm run attachments:cleanup:dry`
  - esecuzione: `npm run attachments:cleanup`
  - override giorni: `npm run attachments:cleanup -- --days=180`
- Smoke test produzione:
  - imposta env `SMOKE_API_BASE` (+ opzionale `SMOKE_USERNAME`, `SMOKE_PASSWORD`, `SMOKE_ATTACHMENT_ORDER_ID`)
  - esegui: `npm run smoke:prod`
