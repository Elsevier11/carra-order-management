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

### Backend su Railway

- File usato: `railway.json`
- Start command: `npm run start`
- Healthcheck: `/health`
- Env richieste:
  - `DATABASE_URL`
  - `PORT` (Railway la imposta automaticamente)
  - `NODE_ENV=production`
  - `JWT_SECRET`
  - `ATTACHMENTS_DIR`
  - `ATTACHMENTS_ALLOWED_EXTENSIONS`
  - `ATTACHMENTS_ALLOWED_MIME`

### Frontend su Netlify

- Directory: `frontend`
- File usato: `frontend/netlify.toml`
- Build command: `npm run build`
- Publish directory: `dist/carra-consegne-frontend/browser`

### Frontend su Vercel

- Root project: `frontend`
- Build command: `npm run build`
- Output directory: `dist/carra-consegne-frontend/browser`
- Rewrites SPA: `frontend/vercel.json`

### URL API Frontend produzione

Aggiorna `frontend/src/environments/environment.production.ts`:
- `apiUrl: 'https://<tuo-backend>/api'`

### Checklist Go-Live

- Vedi [docs/go-live-checklist.md](./docs/go-live-checklist.md)
