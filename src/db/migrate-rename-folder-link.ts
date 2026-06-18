/**
 * One-time migration: rename folder_link → folder_link_documenti in ordini table.
 * Run BEFORE drizzle-kit push so the column rename is safe (no data loss).
 */
import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
  // Check if old column exists
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'ordini'
      AND column_name = 'folder_link'
  `

  if (rows.length > 0) {
    console.log('Renaming folder_link → folder_link_documenti ...')
    await sql`ALTER TABLE ordini RENAME COLUMN folder_link TO folder_link_documenti`
    console.log('Done.')
  } else {
    // Check if already renamed
    const already = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ordini'
        AND column_name = 'folder_link_documenti'
    `
    if (already.length > 0) {
      console.log('Column already renamed, skipping.')
    } else {
      console.log('folder_link column not found — will be created by drizzle push.')
    }
  }

  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
