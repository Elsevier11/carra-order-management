import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { db, ensureDatabaseObjects, pgClient } from '../server/db'
import { ordini } from './schema'

export const rawRowSchema = z
  .object({
    rif: z.string().optional(),
    rifto: z.string().optional(),
    cliente: z.string().optional(),
    tipoImpianto: z.string().optional(),
    tipo_impianto: z.string().optional(),
    dataConsegna: z.string().optional(),
    data_consegna: z.string().optional(),
    cantiere: z.string().optional(),
    dataOrdine: z.string().optional(),
    data_ordine: z.string().optional(),
    scarico: z.string().optional(),
    vascheCav: z.string().optional(),
    vasche_cav: z.string().optional(),
    accessori: z.string().optional(),
    operai: z.string().optional(),
    stato: z.string().optional(),
    note: z.string().optional(),
  })
  .passthrough()

const batchSize = 200

export function buildDedupKey(row: typeof ordini.$inferInsert): string {
  const rif = (row.rifto ?? '').trim().toUpperCase()
  const cliente = (row.cliente ?? '').trim().toUpperCase()
  const dataConsegna = row.dataConsegna ? row.dataConsegna.toISOString().slice(0, 10) : ''
  return `${rif}|${cliente}|${dataConsegna}`
}

export function analyzeImportRows(rawRows: z.infer<typeof rawRowSchema>[]) {
  const validRows: typeof ordini.$inferInsert[] = []
  const invalidRows: Array<{ index: number; reason: string }> = []
  const duplicates: Array<{ key: string; indexes: number[] }> = []
  const map = new Map<string, number[]>()

  rawRows.forEach((raw, index) => {
    const normalized = normalizeRow(raw)
    if (!normalized) {
      invalidRows.push({ index, reason: 'missing_rif_or_cliente' })
      return
    }
    validRows.push(normalized)
    const key = buildDedupKey(normalized)
    const list = map.get(key) ?? []
    list.push(index)
    map.set(key, list)
  })

  for (const [key, indexes] of map.entries()) {
    if (indexes.length > 1) {
      duplicates.push({ key, indexes })
    }
  }

  return {
    totalRows: rawRows.length,
    validRowsCount: validRows.length,
    invalidRowsCount: invalidRows.length,
    duplicateGroups: duplicates.length,
    duplicates,
    invalidRows,
  }
}

export function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function normalizeRow(raw: z.infer<typeof rawRowSchema>): typeof ordini.$inferInsert | null {
  const rif = raw.rif?.trim() || raw.rifto?.trim()
  const cliente = raw.cliente?.trim()

  if (!rif || !cliente) {
    return null
  }

  return {
    rifto: rif,
    cliente,
    tipoImpianto: raw.tipoImpianto ?? raw.tipo_impianto ?? null,
    dataConsegna: parseDate(raw.dataConsegna ?? raw.data_consegna),
    cantiere: raw.cantiere ?? null,
    dataOrdine: parseDate(raw.dataOrdine ?? raw.data_ordine),
    scarico: raw.scarico ?? null,
    vascheCav: raw.vascheCav ?? raw.vasche_cav ?? null,
    accessori: raw.accessori ?? null,
    operai: raw.operai ?? null,
    stato: raw.stato?.trim() || 'IN CORSO',
    note: raw.note ?? null,
  }
}

export async function importFromJson(sourcePath: string, shouldTruncate: boolean) {
  await ensureDatabaseObjects()
  const absolutePath = path.resolve(sourcePath)
  const rawFile = await fs.readFile(absolutePath, 'utf8')
  const parsed = z.array(rawRowSchema).parse(JSON.parse(rawFile))
  const analysis = analyzeImportRows(parsed)
  const rows = parsed.map(normalizeRow).filter((row): row is typeof ordini.$inferInsert => row !== null)

  if (rows.length === 0) {
    throw new Error('No valid rows to import. Ensure each row has at least "rif" (or "rifto") and "cliente".')
  }

  if (shouldTruncate) {
    await db.delete(ordini)
    console.log('Table ordini truncated before import.')
  }

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    await db.insert(ordini).values(chunk)
  }

  console.log(`Import completed from ${absolutePath}: ${rows.length} rows inserted.`)
  console.log(`Import analysis: duplicates=${analysis.duplicateGroups}, invalidRows=${analysis.invalidRowsCount}`)
  return rows.length
}

async function runCli() {
  const args = process.argv.slice(2)
  const shouldTruncate = args.includes('--truncate')
  const fileArg = args.find((arg) => !arg.startsWith('--'))
  const sourcePath = fileArg ?? process.env.IMPORT_FILE ?? './data/consegne.full.json'
  await importFromJson(sourcePath, shouldTruncate)
  await pgClient.end()
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  runCli().catch(async (error) => {
    console.error('Import failed:', error)
    await pgClient.end()
    process.exit(1)
  })
}
