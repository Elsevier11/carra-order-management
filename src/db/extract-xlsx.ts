import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX, { WorkBook } from 'xlsx'

export type ExtractedRow = {
  rif: string
  cliente: string
  tipoImpianto: string
  dataConsegna: string
  cantiere: string
  dataOrdine: string
  scarico: string
  vascheCav: string
  accessori: string
  operai: string
  note: string
  stato: string
}

export type SheetReport = {
  sheet: string
  headerRow: number
  totalRows: number
  extractedRows: number
  skippedRows: number
  skippedExamples: Array<{
    excelRow: number
    reason: string
    rif: string
    cliente: string
  }>
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cell(row: unknown[], index: number): string {
  if (index < 0) return ''
  return String(row[index] ?? '').replace(/\r?\n/g, ' ').trim()
}

function findHeaderRow(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(12, aoa.length); i += 1) {
    const normalized = (aoa[i] ?? []).map((v) => normalize(String(v ?? '')))
    if (normalized.some((v) => v.startsWith('rif')) && normalized.includes('cliente')) {
      return i
    }
  }
  return -1
}

function findColumnIndex(header: unknown[], candidates: string[], startsWith = false): number {
  const normalized = header.map((h) => normalize(String(h ?? '')))
  return normalized.findIndex((h) =>
    candidates.some((candidate) => (startsWith ? h.startsWith(candidate) : h === candidate)),
  )
}

export function extractWorkbook(workbook: WorkBook, sheetsCount = 4) {
  const selectedSheets = workbook.SheetNames.slice(0, sheetsCount)
  const extracted: ExtractedRow[] = []
  const reports: SheetReport[] = []

  for (const sheetName of selectedSheets) {
    const ws = workbook.Sheets[sheetName]
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    })

    const headerRow = findHeaderRow(aoa)
    if (headerRow < 0) {
      reports.push({
        sheet: sheetName,
        headerRow: -1,
        totalRows: 0,
        extractedRows: 0,
        skippedRows: 0,
        skippedExamples: [],
      })
      continue
    }

    const header = aoa[headerRow]
    const column = {
      rif: findColumnIndex(header, ['rif.to', 'rifto', 'rif'], true),
      cliente: findColumnIndex(header, ['cliente']),
      tipoImpianto: findColumnIndex(header, ['tipo impianto'], true),
      dataConsegna: findColumnIndex(header, ['data consegna'], true),
      cantiere: findColumnIndex(header, ['cantiere']),
      dataOrdine: findColumnIndex(header, ['data ordine'], true),
      scarico: findColumnIndex(header, ['scarico']),
      vascheCav: findColumnIndex(header, ['vasche c.a.v.']),
      accessori: findColumnIndex(header, ['accessori']),
      operai: findColumnIndex(header, ['operai', 'montaggio / pulizia']),
      note: findColumnIndex(header, ['avvisi e note']),
    }

    const dataRows = aoa
      .slice(headerRow + 1)
      .map((row, idx) => ({ row, excelRow: headerRow + 2 + idx }))
      .filter(({ row }) => row.some((v) => String(v ?? '').trim() !== ''))

    const skippedExamples: SheetReport['skippedExamples'] = []
    let extractedRows = 0
    let skippedRows = 0

    for (const { row, excelRow } of dataRows) {
      const rif = cell(row, column.rif)
      const cliente = cell(row, column.cliente)

      if (!rif || !cliente) {
        skippedRows += 1
        if (skippedExamples.length < 12) {
          skippedExamples.push({
            excelRow,
            reason: !rif && !cliente ? 'missing_rif_and_cliente' : !rif ? 'missing_rif' : 'missing_cliente',
            rif,
            cliente,
          })
        }
        continue
      }

      extracted.push({
        rif,
        cliente,
        tipoImpianto: cell(row, column.tipoImpianto),
        dataConsegna: cell(row, column.dataConsegna),
        cantiere: cell(row, column.cantiere),
        dataOrdine: cell(row, column.dataOrdine),
        scarico: cell(row, column.scarico),
        vascheCav: cell(row, column.vascheCav),
        accessori: cell(row, column.accessori),
        operai: cell(row, column.operai),
        note: cell(row, column.note),
        stato: sheetName,
      })
      extractedRows += 1
    }

    reports.push({
      sheet: sheetName,
      headerRow: headerRow + 1,
      totalRows: dataRows.length,
      extractedRows,
      skippedRows,
      skippedExamples,
    })
  }

  return {
    sheetsUsed: selectedSheets,
    extracted,
    reports,
  }
}

async function runCli() {
  const args = process.argv.slice(2)
  const inputFile = args[0] ?? process.env.XLSX_SOURCE
  const outFile = args[1] ?? './data/consegne.full.json'
  const reportFile = args[2] ?? './data/consegne.full.report.json'

  if (!inputFile) {
    throw new Error('Missing xlsx input path. Usage: tsx src/db/extract-xlsx.ts "<xlsxPath>"')
  }

  const workbook = XLSX.readFile(inputFile, { raw: false })
  const { sheetsUsed, extracted, reports } = extractWorkbook(workbook, 4)
  const outPath = path.resolve(outFile)
  const outReportPath = path.resolve(reportFile)
  await fs.writeFile(outPath, JSON.stringify(extracted, null, 2), 'utf8')
  await fs.writeFile(
    outReportPath,
    JSON.stringify(
      {
        inputFile: path.resolve(inputFile),
        sheetsUsed,
        extractedRows: extracted.length,
        sheetReports: reports,
      },
      null,
      2,
    ),
    'utf8',
  )

  console.log(`Excel extraction completed: ${extracted.length} rows`)
  console.log(`JSON: ${outPath}`)
  console.log(`Report: ${outReportPath}`)
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMainModule) {
  runCli().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
