import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const runDbTests = process.env.RUN_DB_TESTS === '1'

describe.runIf(runDbTests)('Consegne API', () => {
  let app: ReturnType<(typeof import('./app'))['createApp']>
  let db: (typeof import('./db'))['db']
  let pgClient: (typeof import('./db'))['pgClient']
  let ordini: (typeof import('../db/schema'))['ordini']
  let eq: (typeof import('drizzle-orm'))['eq']
  let ilike: (typeof import('drizzle-orm'))['ilike']
  let token = ''

  beforeAll(async () => {
    const appModule = await import('./app')
    const dbModule = await import('./db')
    const schemaModule = await import('../db/schema')
    const drizzleModule = await import('drizzle-orm')

    app = appModule.createApp()
    db = dbModule.db
    pgClient = dbModule.pgClient
    ordini = schemaModule.ordini
    eq = drizzleModule.eq
    ilike = drizzleModule.ilike

    await db.delete(ordini).where(ilike(ordini.rifto, '__TEST__%'))
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
  })

  afterAll(async () => {
    await db.delete(ordini).where(ilike(ordini.rifto, '__TEST__%'))
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

  it('GET /api/consegne/stats returns grouped status and carrier', async () => {
    const res = await request(app).get('/api/consegne/stats')

    expect(res.status).toBe(200)
    const byStatus = Object.fromEntries(res.body.byStatus.map((x: { stato: string; count: number }) => [x.stato, x.count]))
    const byCarrier = Object.fromEntries(res.body.byCarrier.map((x: { vettore: string; count: number }) => [x.vettore, x.count]))
    expect(Number(byStatus['IN CORSO'] ?? 0)).toBeGreaterThanOrEqual(2)
    expect(Number(byStatus.CONCLUSI ?? 0)).toBeGreaterThanOrEqual(1)
    expect(Number(byCarrier.TEST_COTRAM ?? 0)).toBeGreaterThanOrEqual(2)
    expect(Number(byCarrier.TEST_BRT ?? 0)).toBeGreaterThanOrEqual(1)
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
      vettore: 'TEST_COTRAM',
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

  it('rejects write endpoints without token', async () => {
    const res = await request(app).post('/api/consegne').send({
      rif: '__TEST__NOAUTH',
      cliente: 'No Auth',
    })
    expect(res.status).toBe(401)
  })
})
