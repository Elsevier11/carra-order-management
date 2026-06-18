/**
 * Direct SQL migration for Task 1 schema changes.
 * Applies all new tables and columns without relying on drizzle-kit interactive prompts.
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `
  return rows.length > 0
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
  `
  return rows.length > 0
}

async function main() {
  console.log('=== Schema migration v2 ===')

  // 1. Create anagrafe tables
  if (!await tableExists('mittenti_disegno')) {
    console.log('Creating mittenti_disegno...')
    await sql`
      CREATE TABLE mittenti_disegno (
        id        SERIAL PRIMARY KEY,
        nome      TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } else { console.log('mittenti_disegno already exists') }

  if (!await tableExists('operai')) {
    console.log('Creating operai...')
    await sql`
      CREATE TABLE operai (
        id        SERIAL PRIMARY KEY,
        nome      TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } else { console.log('operai already exists') }

  if (!await tableExists('vettori')) {
    console.log('Creating vettori...')
    await sql`
      CREATE TABLE vettori (
        id        SERIAL PRIMARY KEY,
        nome      TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } else { console.log('vettori already exists') }

  if (!await tableExists('cementi_tipi')) {
    console.log('Creating cementi_tipi...')
    await sql`
      CREATE TABLE cementi_tipi (
        id        SERIAL PRIMARY KEY,
        nome      TEXT NOT NULL,
        ordine    INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } else { console.log('cementi_tipi already exists') }

  if (!await tableExists('accessori_tipi')) {
    console.log('Creating accessori_tipi...')
    await sql`
      CREATE TABLE accessori_tipi (
        id        SERIAL PRIMARY KEY,
        nome      TEXT NOT NULL,
        ordine    INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `
  } else { console.log('accessori_tipi already exists') }

  // 2. New columns on ordini
  const newOrdiniColumns: Array<{ col: string; ddl: string }> = [
    { col: 'folder_link_foto',         ddl: 'ALTER TABLE ordini ADD COLUMN folder_link_foto TEXT' },
    { col: 'disegno_spedito_at',       ddl: 'ALTER TABLE ordini ADD COLUMN disegno_spedito_at TIMESTAMP' },
    { col: 'disegno_mittente_id',      ddl: 'ALTER TABLE ordini ADD COLUMN disegno_mittente_id INTEGER REFERENCES mittenti_disegno(id) ON DELETE SET NULL' },
    { col: 'disegno_note',             ddl: 'ALTER TABLE ordini ADD COLUMN disegno_note TEXT' },
    { col: 'massicciata_nota',         ddl: 'ALTER TABLE ordini ADD COLUMN massicciata_nota TEXT' },
    { col: 'tipo_carici_nota',         ddl: 'ALTER TABLE ordini ADD COLUMN tipo_carici_nota TEXT' },
    { col: 'lavorazione_assegnata_at', ddl: 'ALTER TABLE ordini ADD COLUMN lavorazione_assegnata_at TIMESTAMP' },
    { col: 'consegna_data_effettiva',  ddl: 'ALTER TABLE ordini ADD COLUMN consegna_data_effettiva TIMESTAMP' },
    { col: 'vettore_id',               ddl: 'ALTER TABLE ordini ADD COLUMN vettore_id INTEGER REFERENCES vettori(id) ON DELETE SET NULL' },
    { col: 'ddt_pronti',               ddl: 'ALTER TABLE ordini ADD COLUMN ddt_pronti BOOLEAN NOT NULL DEFAULT FALSE' },
    { col: 'bancale',                  ddl: 'ALTER TABLE ordini ADD COLUMN bancale BOOLEAN NOT NULL DEFAULT FALSE' },
    { col: 'carico_verificato',        ddl: 'ALTER TABLE ordini ADD COLUMN carico_verificato BOOLEAN NOT NULL DEFAULT FALSE' },
    { col: 'cam_si_no',                ddl: 'ALTER TABLE ordini ADD COLUMN cam_si_no BOOLEAN NOT NULL DEFAULT FALSE' },
  ]

  for (const { col, ddl } of newOrdiniColumns) {
    if (!await columnExists('ordini', col)) {
      console.log(`Adding ordini.${col}...`)
      await sql.unsafe(ddl)
    } else {
      console.log(`ordini.${col} already exists`)
    }
  }

  // 3. Relational tables
  if (!await tableExists('order_operai')) {
    console.log('Creating order_operai...')
    await sql`
      CREATE TABLE order_operai (
        order_id   INTEGER NOT NULL REFERENCES ordini(id) ON DELETE CASCADE,
        operaio_id INTEGER NOT NULL REFERENCES operai(id) ON DELETE CASCADE,
        PRIMARY KEY (order_id, operaio_id)
      )
    `
  } else { console.log('order_operai already exists') }

  if (!await tableExists('order_cementi')) {
    console.log('Creating order_cementi...')
    await sql`
      CREATE TABLE order_cementi (
        id       SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES ordini(id) ON DELETE CASCADE,
        tipo_id  INTEGER NOT NULL REFERENCES cementi_tipi(id) ON DELETE CASCADE,
        ordinata BOOLEAN NOT NULL DEFAULT FALSE,
        fatta    BOOLEAN NOT NULL DEFAULT FALSE
      )
    `
  } else { console.log('order_cementi already exists') }

  if (!await tableExists('order_accessori')) {
    console.log('Creating order_accessori...')
    await sql`
      CREATE TABLE order_accessori (
        id       SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES ordini(id) ON DELETE CASCADE,
        tipo_id  INTEGER NOT NULL REFERENCES accessori_tipi(id) ON DELETE CASCADE,
        ordinata BOOLEAN NOT NULL DEFAULT FALSE,
        fatta    BOOLEAN NOT NULL DEFAULT FALSE
      )
    `
  } else { console.log('order_accessori already exists') }

  console.log('\n=== Migration complete ===')
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
