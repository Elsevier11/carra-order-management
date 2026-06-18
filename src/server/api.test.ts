import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const runDbTests = process.env.RUN_DB_TESTS === '1'

describe.runIf(runDbTests)('Consegne API', () => {
  let app: ReturnType<(typeof import('./app'))['createApp']>
  let db: (typeof import('./db'))['db']
  let pgClient: (typeof import('./db'))['pgClient']
  let ensureDatabaseObjects: (typeof import('./db'))['ensureDatabaseObjects']
  let ordini: (typeof import('../db/schema'))['ordini']
  let orderAttachments: (typeof import('../db/schema'))['orderAttachments']
  let auditLogs: (typeof import('../db/schema'))['auditLogs']
  let appUsers: (typeof import('../db/schema'))['appUsers']
  let eq: (typeof import('drizzle-orm'))['eq']
  let ilike: (typeof import('drizzle-orm'))['ilike']
  let gte: (typeof import('drizzle-orm'))['gte']
  let like: (typeof import('drizzle-orm'))['like']
  let token = ''
  let letturaToken = ''
  let operativoToken = ''
  let auditStartId = 0

  beforeAll(async () => {
    process.env.ATTACHMENTS_ALLOWED_EXTENSIONS_ADMIN = 'pdf,txt,csv'
    process.env.ATTACHMENTS_ALLOWED_EXTENSIONS_OPERATIVO = 'pdf'
    process.env.ATTACHMENTS_ANTIVIRUS_MODE = 'mock'
    process.env.ATTACHMENTS_ANTIVIRUS_FAIL_PATTERN = 'eicar'

    const appModule = await import('./app')
    const dbModule = await import('./db')
    const schemaModule = await import('../db/schema')
    const drizzleModule = await import('drizzle-orm')

    app = appModule.createApp()
    db = dbModule.db
    pgClient = dbModule.pgClient
    ensureDatabaseObjects = dbModule.ensureDatabaseObjects
    ordini = schemaModule.ordini
    orderAttachments = schemaModule.orderAttachments
    auditLogs = schemaModule.auditLogs
    appUsers = schemaModule.appUsers
    eq = drizzleModule.eq
    ilike = drizzleModule.ilike
    gte = drizzleModule.gte
    like = drizzleModule.like

    await ensureDatabaseObjects()

    await db.delete(ordini).where(ilike(ordini.rifto, '__TEST__%'))
    await db.delete(appUsers).where(like(appUsers.username, 'test_user_%'))
    await db.insert(ordini).values([
      {
        rifto: '__TEST__A-001',
        cliente: 'Cliente Uno',
        tipoImpianto: 'MT10',
        dataConsegna: new Date('2026-03-13'),
        dataOrdine: new Date('2026-03-01'),
        traspor: 'TEST_COTRAM',
        stato: 'IN CORSO',
      },
      {
        rifto: '__TEST__A-002',
        cliente: 'Cliente Due',
        tipoImpianto: 'MT20',
        dataConsegna: new Date('2026-02-10'),
        dataOrdine: new Date('2026-01-20'),
        traspor: 'TEST_BRT',
        stato: 'CONCLUSI',
      },
      {
        rifto: '__TEST__B-100',
        cliente: 'Cliente Uno',
        tipoImpianto: 'MT30',
        dataConsegna: new Date('2026-04-01'),
        dataOrdine: new Date('2026-03-12'),
        traspor: 'TEST_COTRAM',
        stato: 'IN CORSO',
      },
    ])

    const login = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin123',
    })
    token = login.body.token as string

    const loginLettura = await request(app).post('/api/auth/login').send({
      username: 'lettura',
      password: 'lettura123',
    })
    letturaToken = loginLettura.body.token as string

    const loginOperativo = await request(app).post('/api/auth/login').send({
      username: 'operativo',
      password: 'operativo123',
    })
    operativoToken = loginOperativo.body.token as string

    const [maxAudit] = await db.select({ max: drizzleModule.max(auditLogs.id) }).from(auditLogs)
    auditStartId = Number(maxAudit?.max ?? 0)
  })

  afterAll(async () => {
    await db.delete(ordini).where(ilike(ordini.rifto, '__TEST__%'))
    await db.delete(appUsers).where(like(appUsers.username, 'test_user_%'))
    await pgClient.end()
  })

  it('GET /api/consegne applies filters and pagination', async () => {
    const res = await request(app).get('/api/consegne').query({
      stato: 'IN CORSO',
      cliente: 'Cliente Uno',
      page: 1,
      pageSize: 10,
      sortBy: 'rif',
      sortDir: 'asc',
    })

    expect(res.status).toBe(200)
    expect(res.body.pagination.total).toBe(2)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].rif).toBe('__TEST__A-001')
    expect(res.body.data[1].rif).toBe('__TEST__B-100')
  })

  it('captures audit logs for auth failures and protected access', async () => {
    const failedLogin = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'wrong-password',
    })
    expect(failedLogin.status).toBe(401)

    const forbiddenAudit = await request(app).get('/api/audit')
    expect(forbiddenAudit.status).toBe(401)

    const auditRes = await request(app).get('/api/audit').set('Authorization', `Bearer ${token}`).query({
      page: 1,
      pageSize: 20,
    })
    expect(auditRes.status).toBe(200)
    expect(Array.isArray(auditRes.body.data)).toBe(true)
    const authFailure = auditRes.body.data.find((entry: { action: string; username: string | null; success: boolean }) => entry.action === 'AUTH_LOGIN_FAILED' && entry.username === 'admin')
    expect(authFailure).toBeTruthy()

    const forbiddenForReadOnly = await request(app).get('/api/audit').set('Authorization', `Bearer ${letturaToken}`)
    expect(forbiddenForReadOnly.status).toBe(403)
  })

  it('manages users lifecycle for admin', async () => {
    const create = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'test_user_ops',
        role: 'operativo',
        password: 'testpass123',
        isActive: true,
      })
    expect(create.status).toBe(201)
    const userId = create.body.id as number

    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(Array.isArray(list.body.data)).toBe(true)
    expect(list.body.data.some((x: { username: string }) => x.username === 'test_user_ops')).toBe(true)

    const roleUpdate = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'lettura', isActive: true })
    expect(roleUpdate.status).toBe(200)
    expect(roleUpdate.body.role).toBe('lettura')

    const resetPassword = await request(app)
      .put(`/api/users/${userId}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'testpass456' })
    expect(resetPassword.status).toBe(204)

    const login = await request(app).post('/api/auth/login').send({
      username: 'test_user_ops',
      password: 'testpass456',
    })
    expect(login.status).toBe(200)

    const deactivate = await request(app)
      .put(`/api/users/${userId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
    expect(deactivate.status).toBe(200)
    expect(deactivate.body.isActive).toBe(false)
  })

  it('forbids user management for non-admin', async () => {
    const list = await request(app).get('/api/users').set('Authorization', `Bearer ${operativoToken}`)
    expect(list.status).toBe(403)
  })

  it('GET /api/consegne/stats returns grouped status', async () => {
    const res = await request(app).get('/api/consegne/stats')

    expect(res.status).toBe(200)
    const byStatus = Object.fromEntries(res.body.byStatus.map((x: { stato: string; count: number }) => [x.stato, x.count]))
    expect(Number(byStatus['IN CORSO'] ?? 0)).toBeGreaterThanOrEqual(2)
    expect(Number(byStatus.CONCLUSI ?? 0)).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(res.body.weeklyTrend)).toBe(true)
  })

  it('GET /api/consegne/filters is not intercepted by id route', async () => {
    const res = await request(app).get('/api/consegne/filters')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.clienti)).toBe(true)
    expect(Array.isArray(res.body.vettori)).toBe(true)
    expect(Array.isArray(res.body.stati)).toBe(true)
  })

  it('GET /api/consegne/board returns grouped columns by status', async () => {
    const res = await request(app).get('/api/consegne/board')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.columns)).toBe(true)
    const inCorso = res.body.columns.find((x: { status: string; count: number }) => x.status === 'IN CORSO')
    const conclusi = res.body.columns.find((x: { status: string; count: number }) => x.status === 'CONCLUSI')
    expect(inCorso?.count).toBeGreaterThanOrEqual(2)
    expect(conclusi?.count).toBeGreaterThanOrEqual(1)
  })

  it('POST + PUT + DELETE lifecycle works', async () => {
    const created = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__C-777',
      cliente: 'Cliente Tre',
      stato: 'IN LAVORAZIONE',
      dataConsegna: '2026-05-10',
      dataOrdine: '2026-05-01',
    })
    expect(created.status).toBe(201)
    const id = created.body.id as number

    const updated = await request(app).put(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`).send({
      stato: 'CONCLUSI',
      note: 'chiuso da test',
    })
    expect(updated.status).toBe(200)
    expect(updated.body.stato).toBe('CONCLUSI')
    expect(updated.body.note).toBe('chiuso da test')

    const deleted = await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(204)

    const check = await db.select().from(ordini).where(eq(ordini.id, id))
    expect(check).toHaveLength(0)
  })

  it('POST /api/consegne/:id/transition updates status and writes history', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__D-900',
      cliente: 'Cliente Quattro',
      stato: 'IN CORSO',
      dataConsegna: '2026-06-10',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const transition = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'SOSPESO',
      note: 'Mancano documenti',
    })
    expect(transition.status).toBe(200)
    expect(transition.body.stato).toBe('SOSPESO')

    const history = await request(app).get(`/api/consegne/${id}/history`)
    expect(history.status).toBe(200)
    expect(Array.isArray(history.body.data)).toBe(true)
    expect(history.body.data.length).toBeGreaterThanOrEqual(2)
    const latestEvent = history.body.data[0] as { eventType: string; toStatus: string; note: string }
    expect(latestEvent.eventType).toBe('STATUS_SUSPENDED')
    expect(latestEvent.toStatus).toBe('SOSPESO')
    expect(latestEvent.note).toContain('Mancano')

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('POST /api/consegne/:id/transition validates business rules', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__E-901',
      cliente: 'Cliente Cinque',
      stato: 'IN CORSO',
      dataConsegna: '2026-06-11',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const sameStatus = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'IN CORSO',
    })
    expect(sameStatus.status).toBe(400)

    const suspendedWithoutNote = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'SOSPESO',
    })
    expect(suspendedWithoutNote.status).toBe(400)

    const invalidJump = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'CONCLUSI',
      note: 'skip',
    })
    expect(invalidJump.status).toBe(400)
    expect(String(invalidJump.body.message)).toContain('Transizione non consentita')

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('supports attachment lifecycle with upload/list/download/delete', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__F-ATT',
      cliente: 'Cliente Allegati',
      stato: 'IN CORSO',
      dataConsegna: '2026-06-15',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const upload = await request(app)
      .post(`/api/consegne/${id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('contenuto allegato test', 'utf8'), 'test-allegato.txt')
    expect(upload.status).toBe(201)
    expect(upload.body.fileName).toBe('test-allegato.txt')
    const attachmentId = upload.body.id as number

    const list = await request(app).get(`/api/consegne/${id}/attachments`).set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)
    expect(list.body.data[0].id).toBe(attachmentId)

    const download = await request(app).get(`/api/consegne/${id}/attachments/${attachmentId}`).set('Authorization', `Bearer ${token}`)
    expect(download.status).toBe(200)
    expect(download.headers['content-type']).toContain('text/plain')
    expect(download.text).toContain('contenuto allegato test')

    const deleteAttachment = await request(app).delete(`/api/consegne/${id}/attachments/${attachmentId}`).set('Authorization', `Bearer ${token}`)
    expect(deleteAttachment.status).toBe(204)

    const listAfterDelete = await request(app).get(`/api/consegne/${id}/attachments`).set('Authorization', `Bearer ${token}`)
    expect(listAfterDelete.status).toBe(200)
    expect(listAfterDelete.body.data).toHaveLength(0)

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('rejects unsupported attachment extension and mime', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__G-ATT',
      cliente: 'Cliente Allegati Invalidi',
      stato: 'IN CORSO',
      dataConsegna: '2026-06-18',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const upload = await request(app)
      .post(`/api/consegne/${id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake exe payload', 'utf8'), {
        filename: 'dangerous.exe',
        contentType: 'application/octet-stream',
      })
    expect(upload.status).toBe(400)

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('exports filtered csv from backend', async () => {
    const res = await request(app)
      .get('/api/consegne/export')
      .set('Authorization', `Bearer ${token}`)
      .query({ cliente: 'Cliente Uno', sortBy: 'rif', sortDir: 'asc' })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('rif,cliente,tipoImpianto,dataConsegna,cantiere,stato,note')
    expect(res.text).toContain('__TEST__A-001')
  })

  it('exports audit csv for admin', async () => {
    const res = await request(app)
      .get('/api/audit/export')
      .set('Authorization', `Bearer ${token}`)
      .query({ action: 'CONSEGNE', pageSize: 10 })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('id,createdAt,username,role,action')
  })

  it('rejects attachment upload when role policy blocks extension', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__ROLE-ATT',
      cliente: 'Cliente Role Policy',
      stato: 'IN CORSO',
      dataConsegna: '2026-07-18',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const upload = await request(app)
      .post(`/api/consegne/${id}/attachments`)
      .set('Authorization', `Bearer ${operativoToken}`)
      .attach('file', Buffer.from('file txt blocked for operativo', 'utf8'), 'blocked-operativo.txt')
    expect(upload.status).toBe(400)
    expect(String(upload.body.message)).toContain('not allowed for role operativo')

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('rejects attachment upload when antivirus scan fails', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__AV-ATT',
      cliente: 'Cliente Antivirus',
      stato: 'IN CORSO',
      dataConsegna: '2026-07-19',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const upload = await request(app)
      .post(`/api/consegne/${id}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('simulated malware', 'utf8'), 'simulated-eicar.txt')
    expect(upload.status).toBe(400)
    expect(String(upload.body.message)).toContain('antivirus')

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('provides import preview report with duplicates and invalid rows', async () => {
    const res = await request(app)
      .post('/api/import/preview')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rows: [
          { rif: 'PX-1', cliente: 'Cliente X', dataConsegna: '2026-01-10' },
          { rif: 'PX-1', cliente: 'Cliente X', dataConsegna: '2026-01-10' },
          { rif: '', cliente: 'Broken row' },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.totalRows).toBe(3)
    expect(res.body.validRowsCount).toBe(2)
    expect(res.body.invalidRowsCount).toBe(1)
    expect(res.body.duplicateGroups).toBe(1)
  })

  it('writes audit entries for attachment operations and transitions', async () => {
    const rows = await db
      .select()
      .from(auditLogs)
      .where(gte(auditLogs.id, auditStartId + 1))
      .orderBy(auditLogs.id)

    const actions = rows.map((row) => row.action)
    expect(actions.some((action) => action.includes('/api/consegne'))).toBe(true)
    expect(actions.some((action) => action === 'CONSEGNE_EXPORT')).toBe(true)
    expect(rows.some((row) => row.path.includes('/attachments') && row.success)).toBe(true)
  })

  it('rejects write endpoints without token', async () => {
    const res = await request(app).post('/api/consegne').send({
      rif: '__TEST__NOAUTH',
      cliente: 'No Auth',
    })
    expect(res.status).toBe(401)
  })
})
