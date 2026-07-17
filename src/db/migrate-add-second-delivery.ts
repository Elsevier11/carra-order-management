/**
 * Idempotent migration: add the second planned delivery fields to ordini.
 * Useful for existing databases already deployed before multi-day deliveries.
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${table}
      AND column_name = ${column}
  `
  return rows.length > 0
}

async function main() {
  const columns: Array<{ name: string; ddl: string }> = [
    { name: 'consegna_data_effettiva_seconda', ddl: 'ALTER TABLE ordini ADD COLUMN consegna_data_effettiva_seconda TIMESTAMP' },
    { name: 'vettore_secondo_id', ddl: 'ALTER TABLE ordini ADD COLUMN vettore_secondo_id INTEGER REFERENCES vettori(id) ON DELETE SET NULL' },
    { name: 'bilici_secondi', ddl: 'ALTER TABLE ordini ADD COLUMN bilici_secondi INTEGER NOT NULL DEFAULT 0' },
  ]

  for (const column of columns) {
    if (await columnExists('ordini', column.name)) {
      console.log(`ordini.${column.name} already exists`)
      continue
    }
    console.log(`Adding ordini.${column.name}...`)
    await sql.unsafe(column.ddl)
  }

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
