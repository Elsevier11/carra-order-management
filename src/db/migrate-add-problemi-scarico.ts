/**
 * Idempotent migration: add ordini.problemi_scarico_nota if missing.
 * Useful for databases already deployed before the field was introduced.
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
  if (await columnExists('ordini', 'problemi_scarico_nota')) {
    console.log('ordini.problemi_scarico_nota already exists')
  } else {
    console.log('Adding ordini.problemi_scarico_nota...')
    await sql`ALTER TABLE ordini ADD COLUMN problemi_scarico_nota TEXT`
  }

  await sql.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
