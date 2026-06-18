/**
 * Verify Task 1 schema changes in DB.
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
  // Verify new tables exist
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `
  console.log('Tables:', tables.map(r => r.table_name).join(', '))

  // Verify ordini columns
  const ordiniCols = await sql`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ordini'
    ORDER BY ordinal_position
  `
  console.log('\nordini columns:')
  for (const c of ordiniCols) {
    console.log(`  ${c.column_name}: ${c.data_type} (nullable=${c.is_nullable}, default=${c.column_default})`)
  }

  // Check folder_link is gone
  const oldCol = ordiniCols.find(c => c.column_name === 'folder_link')
  const newCol = ordiniCols.find(c => c.column_name === 'folder_link_documenti')
  console.log('\nRename check:')
  console.log('  folder_link (old):', oldCol ? 'STILL EXISTS ❌' : 'gone ✓')
  console.log('  folder_link_documenti (new):', newCol ? 'exists ✓' : 'MISSING ❌')

  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
