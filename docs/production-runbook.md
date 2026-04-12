# Production Runbook

Ultimo aggiornamento: 12/04/2026

## Endpoint Produzione

- Frontend Netlify: `https://genuine-kleicha-42d5d7.netlify.app`
- Backend Railway API: `https://web-production-385de.up.railway.app`
- Health endpoint: `https://web-production-385de.up.railway.app/health`

## Provider e Progetti

- Railway project: `glistening-magic`
  - Service API: `web`
  - Service DB: `Postgres`
- Netlify project: `genuine-kleicha-42d5d7`
- Repository GitHub: `Elsevier11/carra-order-management`
- Branch produzione: `main`

## Configurazione Chiave

- Frontend production API URL file:
  - `frontend/src/environments/environment.production.ts`
- Railway env minime API (`web`):
  - `DATABASE_URL` (reference: `${{ Postgres.DATABASE_URL }}`)
  - `JWT_SECRET`
  - `NODE_ENV=production`
  - `ATTACHMENTS_DIR=/data/attachments`
- Railway build override API:
  - `NIXPACKS_BUILD_CMD=echo skip-backend-build`
  - `NPM_CONFIG_PRODUCTION=false`

## Comandi Operativi Rapidi

- Smoke base:
  - `SMOKE_API_BASE=https://web-production-385de.up.railway.app npm run smoke:prod`
- Smoke completo:
  - `SMOKE_API_BASE=https://web-production-385de.up.railway.app`
  - `SMOKE_USERNAME=admin`
  - `SMOKE_PASSWORD=<password>`
  - `SMOKE_ATTACHMENT_ORDER_ID=<id>`
  - `npm run smoke:prod`
- Retention allegati:
  - dry-run: `npm run attachments:cleanup:dry -- --days=365`
  - run: `npm run attachments:cleanup -- --days=365`

## Runbook Incidenti (Checklist)

1. Verifica backend:
   - apri `/health`
   - se non `200`, apri Railway `web -> Deployments -> View logs`
2. Verifica database:
   - Railway `Postgres` stato `Online`
   - `web` deve avere `DATABASE_URL` con reference a `Postgres`
3. Verifica frontend:
   - Netlify `Deploys` deve essere `Published` su ultimo commit `main`
   - se login fallisce, ricontrolla `environment.production.ts`
4. Verifica end-to-end:
   - esegui smoke base e poi completo

## Sicurezza Operativa

- Non salvare password in chiaro nei documenti.
- Se una credenziale viene esposta, ruotarla subito.
- Per password DB, usare `Postgres -> Database/Config -> Regenerate Password` (non edit manuale variabile).
