import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import XLSX from 'xlsx'

const runDbTests = process.env.RUN_DB_TESTS === '1'

describe.runIf(runDbTests)('Consegne API', () => {
  let app: ReturnType<(typeof import('./app'))['createApp']>
  let db: (typeof import('./db'))['db']
  let pgClient: (typeof import('./db'))['pgClient']
  let ensureDatabaseObjects: (typeof import('./db'))['ensureDatabaseObjects']
  let ordini: (typeof import('../db/schema'))['ordini']
  let auditLogs: (typeof import('../db/schema'))['auditLogs']
  let appUsers: (typeof import('../db/schema'))['appUsers']
  let eq: (typeof import('drizzle-orm'))['eq']
  let ilike: (typeof import('drizzle-orm'))['ilike']
  let gte: (typeof import('drizzle-orm'))['gte']
  let like: (typeof import('drizzle-orm'))['like']
  let sql: (typeof import('drizzle-orm'))['sql']
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
    auditLogs = schemaModule.auditLogs
    appUsers = schemaModule.appUsers
    eq = drizzleModule.eq
    ilike = drizzleModule.ilike
    gte = drizzleModule.gte
    like = drizzleModule.like
    sql = drizzleModule.sql

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
        rifto: '__TEST__C-003',
        cliente: 'Cliente Tre',
        tipoImpianto: 'MT15',
        dataConsegna: new Date('2026-02-11'),
        dataOrdine: new Date('2026-01-21'),
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

  it('GET /api/consegne/dashboard/aging returns the operational aging list sorted by permanence', async () => {
    const first = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__AGING-001',
      cliente: 'Cliente Aging Uno',
      tipoImpianto: 'TA-1',
      dataConsegna: '2026-07-10',
      dataOrdine: '2026-06-20',
      stato: 'DISEGNO IN GESTIONE',
    })
    expect(first.status).toBe(201)

    const second = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__AGING-002',
      cliente: 'Cliente Aging Due',
      tipoImpianto: 'TA-2',
      dataConsegna: '2026-07-11',
      dataOrdine: '2026-06-21',
      stato: 'PRONTI & AVVISATI',
    })
    expect(second.status).toBe(201)

    await db.execute(sql`
      update order_events
      set created_at = ${'2026-06-18T00:00:00.000Z'}
      where order_id = ${first.body.id} and event_type = 'ORDER_CREATED'
    `)
    await db.execute(sql`
      update order_events
      set created_at = ${'2026-06-21T00:00:00.000Z'}
      where order_id = ${second.body.id} and event_type = 'ORDER_CREATED'
    `)

    const res = await request(app).get('/api/consegne/dashboard/aging')
    expect(res.status).toBe(200)
    const refs = res.body.data.map((item: { rif: string }) => item.rif)
    const firstIndex = refs.indexOf('__TEST__AGING-001')
    const secondIndex = refs.indexOf('__TEST__AGING-002')
    expect(firstIndex).toBeGreaterThanOrEqual(0)
    expect(secondIndex).toBeGreaterThanOrEqual(0)
    expect(firstIndex).toBeLessThan(secondIndex)
    const firstRow = res.body.data.find((item: { rif: string; daysInState: number }) => item.rif === '__TEST__AGING-001')
    const secondRow = res.body.data.find((item: { rif: string; daysInState: number }) => item.rif === '__TEST__AGING-002')
    expect(firstRow?.daysInState ?? 0).toBeGreaterThan(secondRow?.daysInState ?? 0)
    expect([firstRow?.stato, secondRow?.stato]).toEqual(['DISEGNO IN GESTIONE', 'PRONTI & AVVISATI'])

    await request(app).delete(`/api/consegne/${first.body.id}`).set('Authorization', `Bearer ${token}`)
    await request(app).delete(`/api/consegne/${second.body.id}`).set('Authorization', `Bearer ${token}`)
  })

  it('GET /api/consegne/filters is not intercepted by id route', async () => {
    const res = await request(app).get('/api/consegne/filters')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.clienti)).toBe(true)
    expect(Array.isArray(res.body.stati)).toBe(true)
  })

  it('GET /api/consegne/board returns grouped columns by status', async () => {
    const [recentlyTouched] = await db.select({ id: ordini.id }).from(ordini).where(eq(ordini.rifto, '__TEST__A-002')).limit(1)
    expect(recentlyTouched).toBeTruthy()

    const touched = await request(app)
      .put(`/api/consegne/${recentlyTouched.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'touch latest modification' })
    expect(touched.status).toBe(200)

    const res = await request(app).get('/api/consegne/board')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.columns)).toBe(true)
    const inCorso = res.body.columns.find((x: { status: string; count: number }) => x.status === 'IN CORSO')
    const conclusi = res.body.columns.find((x: { status: string; count: number }) => x.status === 'CONCLUSI')
    expect(inCorso?.count).toBeGreaterThanOrEqual(2)
    expect(conclusi?.count).toBeGreaterThanOrEqual(2)
    const orderIds = (inCorso?.items ?? []).map((item: { rif: string }) => item.rif)
    expect(orderIds.indexOf('__TEST__B-100')).toBeGreaterThanOrEqual(0)
    expect(orderIds.indexOf('__TEST__A-001')).toBeGreaterThanOrEqual(0)
    expect(orderIds.indexOf('__TEST__B-100')).toBeLessThan(orderIds.indexOf('__TEST__A-001'))
    const conclusiOrderIds = (conclusi?.items ?? []).map((item: { rif: string }) => item.rif)
    expect(conclusiOrderIds.indexOf('__TEST__A-002')).toBeGreaterThanOrEqual(0)
    expect(conclusiOrderIds.indexOf('__TEST__C-003')).toBeGreaterThanOrEqual(0)
    expect(conclusiOrderIds.indexOf('__TEST__A-002')).toBeLessThan(conclusiOrderIds.indexOf('__TEST__C-003'))
  })

  it('POST + PUT + DELETE lifecycle works', async () => {
    const created = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__C-777',
      cliente: 'Cliente Tre',
      stato: 'DA ASSEGNARE',
      dataConsegna: '2026-05-10',
      dataOrdine: '2026-05-01',
      referente: 'Mario Rossi',
      telefono: '333 1234567',
      referente2: 'Luca Bianchi',
      telefono2: '02 123456',
      cementiNote: 'Prima tranche solo vasca A',
    })
    expect(created.status).toBe(201)
    const id = created.body.id as number
    expect(created.body.referente).toBe('Mario Rossi')
    expect(created.body.telefono).toBe('333 1234567')
    expect(created.body.referente2).toBe('Luca Bianchi')
    expect(created.body.telefono2).toBe('02 123456')
    expect(created.body.cementiNote).toBe('Prima tranche solo vasca A')

    const updated = await request(app).put(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`).send({
      stato: 'CONCLUSI',
      note: 'chiuso da test',
      referente: 'Mario Rossi, Luca Bianchi',
      telefono: '02 123456',
      referente2: 'Paolo Verdi',
      telefono2: '348 0000000',
      cementiNote: 'Aggiornata per seconda tranche',
    })
    expect(updated.status).toBe(200)
    expect(updated.body.stato).toBe('CONCLUSI')
    expect(updated.body.note).toBe('chiuso da test')
    expect(updated.body.referente).toBe('Mario Rossi, Luca Bianchi')
    expect(updated.body.telefono).toBe('02 123456')
    expect(updated.body.referente2).toBe('Paolo Verdi')
    expect(updated.body.telefono2).toBe('348 0000000')
    expect(updated.body.cementiNote).toBe('Aggiornata per seconda tranche')

    const deleted = await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
    expect(deleted.status).toBe(204)

    const check = await db.select().from(ordini).where(eq(ordini.id, id))
    expect(check).toHaveLength(0)
  })

  it('blocks duplicate creation on same cliente and tipoImpianto unless forced', async () => {
    const basePayload = {
      cliente: 'Cliente Duplicato',
      tipoImpianto: 'N°1 METEOTANK MP/SD 1.800 E.R.',
      stato: 'DA ASSEGNARE',
      dataConsegna: '2026-05-20',
      dataOrdine: '2026-05-10',
    }

    const first = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__DUP-001',
      ...basePayload,
    })
    expect(first.status).toBe(201)

    const blocked = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__DUP-002',
      ...basePayload,
    })
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe('DUPLICATE_ORDER')
    expect(Array.isArray(blocked.body.duplicates)).toBe(true)
    expect(blocked.body.duplicates[0]?.rif).toBe('__TEST__DUP-001')

    const forced = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__DUP-003',
      ...basePayload,
      forceCreateDuplicate: true,
    })
    expect(forced.status).toBe(201)

    await request(app).delete(`/api/consegne/${first.body.id}`).set('Authorization', `Bearer ${token}`)
    await request(app).delete(`/api/consegne/${forced.body.id}`).set('Authorization', `Bearer ${token}`)
  })

  it('supports DA ASSEGNARE -> ASSEGNATO -> CONCLUSI transition flow', async () => {
    const operaiSeed = await request(app).get('/api/operai').set('Authorization', `Bearer ${token}`)
    expect(operaiSeed.status).toBe(200)

    let operaiIds = (operaiSeed.body.data as Array<{ id: number }>).slice(0, 2).map((item) => item.id)
    while (operaiIds.length < 2) {
      const createdOperaio = await request(app).post('/api/operai').set('Authorization', `Bearer ${token}`).send({
        nome: `__TEST__OP_${operaiIds.length + 1}_${Date.now()}`,
      })
      expect(createdOperaio.status).toBe(201)
      operaiIds.push(createdOperaio.body.id as number)
    }

    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__C-778',
      cliente: 'Cliente Flusso Assegnato',
      stato: 'DA ASSEGNARE',
      dataConsegna: '2026-05-12',
      dataOrdine: '2026-05-02',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const toAssegnato = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'ASSEGNATO',
      note: 'Assegnazione completata',
      lavorazioneAssegnataAt: '2026-05-03',
      operaiIds,
    })
    expect(toAssegnato.status).toBe(200)
    expect(toAssegnato.body.stato).toBe('ASSEGNATO')

    const assignedDetail = await request(app).get(`/api/consegne/${id}`)
    expect(assignedDetail.status).toBe(200)
    expect(assignedDetail.body.lavorazioneAssegnataAt).toBe('2026-05-03')
    expect((assignedDetail.body.operaiAssegnati ?? []).map((op: { id: number }) => op.id)).toEqual(operaiIds)

    const toConclusi = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'CONCLUSI',
      note: 'Lavorazione chiusa',
      conclusiMode: 'week',
      conclusiWeek: '2026-W19',
    })
    expect(toConclusi.status).toBe(200)
    expect(toConclusi.body.stato).toBe('CONCLUSI')

    const conclusiDetail = await request(app).get(`/api/consegne/${id}`)
    expect(conclusiDetail.status).toBe(200)
    expect(conclusiDetail.body.conclusiMode).toBe('week')
    expect(conclusiDetail.body.conclusiWeek).toBe('2026-W19')

    const historyAfterClose = await request(app).get(`/api/consegne/${id}/history`)
    expect(historyAfterClose.status).toBe(200)
    expect(historyAfterClose.body.data[0]?.details?.conclusiMode).toBe('week')
    expect(historyAfterClose.body.data[0]?.details?.conclusiWeek).toBe('2026-W19')

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('auto-populates disegnoApprovatoAt when transitioning to DISEGNO APPROVATO', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__DIS-APP',
      cliente: 'Cliente Disegno',
      stato: 'IN CORSO',
      dataConsegna: '2026-05-15',
      dataOrdine: '2026-05-04',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const toGestione = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'DISEGNO IN GESTIONE',
      note: 'Disegno inviato',
    })
    expect(toGestione.status).toBe(200)

    const toApprovato = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'DISEGNO APPROVATO',
      note: 'Disegno approvato dal cliente',
    })
    expect(toApprovato.status).toBe(200)
    expect(toApprovato.body.stato).toBe('DISEGNO APPROVATO')

    const detail = await request(app).get(`/api/consegne/${id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.disegnoApprovatoAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const history = await request(app).get(`/api/consegne/${id}/history`)
    expect(history.status).toBe(200)
    expect(history.body.data[0]?.details?.disegnoApprovatoAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('supports DA ASSEGNARE -> ASSEGNATO with skip assegnazione', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__C-779',
      cliente: 'Cliente Decido Dopo',
      stato: 'DA ASSEGNARE',
      dataConsegna: '2026-05-13',
      dataOrdine: '2026-05-03',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const toAssegnato = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'ASSEGNATO',
      skipAssegnazione: true,
      note: 'Assegno più tardi',
    })
    expect(toAssegnato.status).toBe(200)
    expect(toAssegnato.body.stato).toBe('ASSEGNATO')

    const detail = await request(app).get(`/api/consegne/${id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.lavorazioneAssegnataAt).toBeNull()
    expect(detail.body.operaiAssegnati).toEqual([])

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
  })

  it('supports ASSEGNATO -> CONCLUSI with date mode', async () => {
    const create = await request(app).post('/api/consegne').set('Authorization', `Bearer ${token}`).send({
      rif: '__TEST__C-780',
      cliente: 'Cliente Chiusura Data',
      stato: 'DA ASSEGNARE',
      dataConsegna: '2026-05-14',
      dataOrdine: '2026-05-04',
    })
    expect(create.status).toBe(201)
    const id = create.body.id as number

    const toAssegnato = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'ASSEGNATO',
      skipAssegnazione: true,
      note: 'Assegnazione rinviata',
    })
    expect(toAssegnato.status).toBe(200)
    expect(toAssegnato.body.stato).toBe('ASSEGNATO')

    const toConclusi = await request(app).post(`/api/consegne/${id}/transition`).set('Authorization', `Bearer ${token}`).send({
      toStatus: 'CONCLUSI',
      note: 'Chiusura con data',
      conclusiMode: 'date',
      conclusiDate: '2026-05-20',
    })
    expect(toConclusi.status).toBe(200)
    expect(toConclusi.body.stato).toBe('CONCLUSI')

    const conclusiDetail = await request(app).get(`/api/consegne/${id}`)
    expect(conclusiDetail.status).toBe(200)
    expect(conclusiDetail.body.conclusiMode).toBe('date')
    expect(conclusiDetail.body.conclusiDate).toBe('2026-05-20')

    const history = await request(app).get(`/api/consegne/${id}/history`)
    expect(history.status).toBe(200)
    expect(history.body.data[0]?.details?.conclusiMode).toBe('date')
    expect(history.body.data[0]?.details?.conclusiDate).toBe('2026-05-20')

    await request(app).delete(`/api/consegne/${id}`).set('Authorization', `Bearer ${token}`)
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

  it('exports xlsx with all orders and summary sheet', async () => {
    const res = await request(app)
      .get('/api/consegne/export/xlsx')
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        res.on('end', () => callback(null, Buffer.concat(chunks)))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    const workbook = XLSX.read(res.body, { type: 'buffer' })
    expect(workbook.SheetNames).toContain('Ordini')
    expect(workbook.SheetNames).toContain('Riepilogo')

    const ordersSheet = workbook.Sheets.Ordini
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ordersSheet)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((row) => row.Rif === '__TEST__A-001')).toBe(true)
    expect(rows[0]).toHaveProperty('Stato')
    expect(rows[0]).toHaveProperty('Cliente')
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
    expect(actions.some((action) => action === 'CONSEGNE_EXPORT_XLSX')).toBe(true)
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
