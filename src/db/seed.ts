import 'dotenv/config'
import { db, pgClient } from '../server/db'
import { ordini } from './schema'

const sampleRows: Array<typeof ordini.$inferInsert> = [
  {
    rifto: '57025',
    cliente: 'BOLDARINO',
    tipoImpianto: 'N1 VA220R N1 POZZETTO',
    dataConsegna: new Date('2026-01-14'),
    traspor: '1 COTRAM',
    stato: 'IN CORSO',
  },
  {
    rifto: '50025',
    cliente: 'Lucchini Costruzioni',
    tipoImpianto: 'N1 METEOTANK MPSD 11.000',
    dataConsegna: new Date('2026-03-13'),
    traspor: '2 COTRAM',
    stato: 'IN CORSO',
  },
  {
    rifto: 'ARCA 15226',
    cliente: 'LUCCHINI COSTRUZIONI',
    tipoImpianto: 'N1 METEOTANK MPSD',
    dataConsegna: new Date('2026-02-15'),
    traspor: 'COTRAM',
    stato: 'IN CORSO',
  },
]

async function seed() {
  await db.insert(ordini).values(sampleRows)
  console.log(`Seed completed: inserted ${sampleRows.length} rows`)
  await pgClient.end()
}

seed().catch((error) => {
  console.error('Seed failed', error)
  process.exit(1)
})
