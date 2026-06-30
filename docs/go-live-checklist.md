# Go-Live Checklist

## 1. Backend Environment
- Set `DATABASE_URL` to production PostgreSQL.
- Set `JWT_SECRET` strong random value (>= 32 chars).
- Set `ATTACHMENTS_DIR` to persistent volume path.
- Optional hardening:
  - `ATTACHMENTS_ALLOWED_EXTENSIONS`
  - `ATTACHMENTS_ALLOWED_MIME`
  - `ATTACHMENTS_ALLOWED_EXTENSIONS_ADMIN`
  - `ATTACHMENTS_ALLOWED_EXTENSIONS_OPERATIVO`
  - `ATTACHMENTS_MAX_SIZE_ADMIN`
  - `ATTACHMENTS_MAX_SIZE_OPERATIVO`
  - `ATTACHMENTS_ANTIVIRUS_COMMAND` (es. `clamscan --no-summary {file}`)
  - `ATTACHMENTS_RETENTION_DAYS`

## 2. Frontend Environment
- Set `frontend/src/environments/environment.production.ts` with production API URL.
- Build: `npm run build`

## 3. Database
- The backend runs schema alignment automatically on startup.
- Keep `npm run db:bootstrap` available only as a manual maintenance command.
- Validate object creation on first startup:
  - `order_events`
  - `order_attachments`
  - `audit_logs`
  - `app_users`

## 4. Smoke Tests
- API health:
  - `GET /health`
- Auth:
  - `POST /api/auth/login`
- Core:
  - `GET /api/consegne`
  - `GET /api/consegne/stats`
  - `GET /api/consegne/export`
- Attachments:
  - upload/list/download/delete
- Audit:
  - `GET /api/audit` with admin token
  - `GET /api/audit/export` with admin token
- Esecuzione script automatico:
  - `SMOKE_API_BASE=https://... npm run smoke:prod`

## 5. Automated Validation
- Run full tests:
  - `npm run test:run`
  - `npm run test:db`

## 6. Operational Controls
- Daily DB backups:
  - `npm run db:backup`
- Retention policy for attachments.
- Monitoring/alerts on:
  - HTTP 5xx
  - DB connection failures
  - Disk usage for attachments storage
- Scheduler (cron o equivalente esterno):
  - `npm run attachments:cleanup -- --days=365`
