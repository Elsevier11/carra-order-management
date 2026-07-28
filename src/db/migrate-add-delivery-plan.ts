/**
 * Idempotent migration: add the JSONB delivery plan to ordini.
 * This stores 1-4 planned deliveries while keeping legacy columns for compatibility.
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
  const column = { name: 'consegne_programmate', ddl: `ALTER TABLE ordini ADD COLUMN consegne_programmate jsonb NOT NULL DEFAULT '[]'::jsonb` }
  if (await columnExists('ordini', column.name)) {
    console.log(`ordini.${column.name} already exists`)
    await sql.end()
    return
  }

  console.log(`Adding ordini.${column.name}...`)
  await sql.unsafe(column.ddl)
  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
