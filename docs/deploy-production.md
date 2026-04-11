# Deploy Reale (Railway + Netlify/Vercel)

## 1. Backend Railway

1. Crea service dal repository root.
2. Verifica `railway.json` (`startCommand: npm run start`, health: `/health`).
3. Imposta env:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `ATTACHMENTS_DIR` (volume persistente)
   - `ATTACHMENTS_ALLOWED_EXTENSIONS`
   - `ATTACHMENTS_ALLOWED_MIME`
   - `ATTACHMENTS_ALLOWED_EXTENSIONS_ADMIN`
   - `ATTACHMENTS_ALLOWED_EXTENSIONS_OPERATIVO`
   - `ATTACHMENTS_MAX_SIZE_ADMIN`
   - `ATTACHMENTS_MAX_SIZE_OPERATIVO`
   - `ATTACHMENTS_ANTIVIRUS_COMMAND` (opzionale)
   - `ATTACHMENTS_RETENTION_DAYS`
4. Primo bootstrap DB:
   - `npm run db:migrate`

## 2. Frontend Netlify o Vercel

1. Root progetto: `frontend`.
2. Build command: `npm run build`.
3. Output: `dist/carra-consegne-frontend/browser`.
4. Aggiorna `frontend/src/environments/environment.production.ts` con URL API Railway.
5. Verifica rewrite SPA (`frontend/netlify.toml` o `frontend/vercel.json`).

## 3. Smoke Produzione

Esegui da locale o CI:

```bash
SMOKE_API_BASE=https://<backend-railway>/ npm run smoke:prod
```

Con login/admin + upload test:

```bash
SMOKE_API_BASE=https://<backend-railway>/ \
SMOKE_USERNAME=admin \
SMOKE_PASSWORD=<password> \
SMOKE_ATTACHMENT_ORDER_ID=<order_id_esistente> \
npm run smoke:prod
```

## 4. Retention Allegati

Schedula (cron giornaliero) comando:

```bash
npm run attachments:cleanup -- --days=365
```

Dry-run periodico di controllo:

```bash
npm run attachments:cleanup:dry -- --days=365
```
