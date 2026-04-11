# Go-Live Checklist

## 1. Backend Environment
- Set `DATABASE_URL` to production PostgreSQL.
- Set `JWT_SECRET` strong random value (>= 32 chars).
- Set `ATTACHMENTS_DIR` to persistent volume path.
- Optional hardening:
  - `ATTACHMENTS_ALLOWED_EXTENSIONS`
  - `ATTACHMENTS_ALLOWED_MIME`

## 2. Frontend Environment
- Set `frontend/src/environments/environment.production.ts` with production API URL.
- Build: `npm run build`

## 3. Database
- Run migrations/bootstrap:
  - `npm run db:migrate`
- Validate object creation on first startup:
  - `order_events`
  - `order_attachments`
  - `audit_logs`

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

## 5. Automated Validation
- Run full tests:
  - `npm run test:run`
  - `npm run test:db`

## 6. Operational Controls
- Daily DB backups.
- Retention policy for attachments.
- Monitoring/alerts on:
  - HTTP 5xx
  - DB connection failures
  - Disk usage for attachments storage
