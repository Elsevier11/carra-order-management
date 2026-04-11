import fs from 'node:fs/promises'
import path from 'node:path'
import { inArray, lt } from 'drizzle-orm'
import { orderAttachments } from '../db/schema'
import { db, pgClient } from '../server/db'

function parseArg(name: string): string | undefined {
  const token = process.argv.find((item) => item.startsWith(`--${name}=`))
  if (!token) return undefined
  return token.slice(name.length + 3)
}

async function main() {
  const retentionDays = Number(parseArg('days') ?? process.env.ATTACHMENTS_RETENTION_DAYS ?? 365)
  const dryRun = process.argv.includes('--dry-run')
  const root = path.resolve(process.env.ATTACHMENTS_DIR ?? './data/uploads')
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - retentionDays)

  const rows = await db
    .select({
      id: orderAttachments.id,
      storagePath: orderAttachments.storagePath,
      createdAt: orderAttachments.createdAt,
    })
    .from(orderAttachments)
    .where(lt(orderAttachments.createdAt, threshold))
    .orderBy(orderAttachments.createdAt)

  let deleted = 0
  const idsToDelete: number[] = []
  for (const row of rows) {
    const absolute = path.resolve(root, row.storagePath)
    if (!absolute.startsWith(root)) continue
    if (!dryRun) {
      await fs.rm(absolute, { force: true })
    }
    idsToDelete.push(row.id)
    deleted += 1
  }

  if (!dryRun && idsToDelete.length > 0) {
    await db.delete(orderAttachments).where(inArray(orderAttachments.id, idsToDelete))
  }

  console.log(`[cleanup-attachments] retentionDays=${retentionDays} dryRun=${dryRun} candidates=${rows.length} processed=${deleted}`)
}

main()
  .catch((error) => {
    console.error('[cleanup-attachments] failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pgClient.end()
  })
