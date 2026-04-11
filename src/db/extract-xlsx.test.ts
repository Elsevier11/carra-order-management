import XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { extractWorkbook } from './extract-xlsx'

function buildWorkbook() {
  const wb = XLSX.utils.book_new()

  const inCorso = XLSX.utils.aoa_to_sheet([
    ['Rif.to', 'Cliente', 'Tipo impianto', 'Data consegna ', 'Cantiere', 'Data Ordine', 'Traspor', 'Scarico', 'Vasche c.a.v.', 'Accessori', 'OPERAI', 'Avvisi e note'],
    ['100/26', 'Cliente A', 'MT10', '17-Apr-26', 'Milano', '11-Mar-26', 'SI', 'NO', 'ok', 'std', 'IN LAVORAZIONE', 'nota 1'],
    ['', 'Riga non valida', '', '', '', '', '', '', '', '', '', ''],
  ])

  const inLavorazione = XLSX.utils.aoa_to_sheet([
    [],
    ['Rif.to', 'Cliente', 'Tipo impianto', 'Data consegna ', 'Cantiere', 'Data Ordine', 'Traspor', 'Scarico', 'Vasche c.a.v.', 'Accessori', 'OPERAI', 'Avvisi e note'],
    ['200/26', 'Cliente B', 'MT20', 'Da concordare', 'Roma', '10-Feb-26', 'NO', 'SI', 'ok', 'std', 'IN LAVORAZIONE', 'nota 2'],
  ])

  const conclusi = XLSX.utils.aoa_to_sheet([
    ['Rif.to', 'Cliente'],
    ['300/26', 'Cliente C'],
  ])

  const pronti = XLSX.utils.aoa_to_sheet([
    [],
    ['Rif.to', 'Cliente', 'Trasporto', 'Montaggio / Pulizia ', 'Avvisi e note'],
    ['400/26', 'Cliente D', 'SI', 'OK', 'nota 4'],
  ])

  XLSX.utils.book_append_sheet(wb, inCorso, 'IN CORSO')
  XLSX.utils.book_append_sheet(wb, inLavorazione, 'IN LAVORAZIONE')
  XLSX.utils.book_append_sheet(wb, conclusi, 'CONCLUSI')
  XLSX.utils.book_append_sheet(wb, pronti, 'PRONTI & AVVISATI')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['IGNORA']]), 'ALTRO')

  return wb
}

describe('extractWorkbook', () => {
  it('extracts valid rows from first 4 sheets and sets stato from sheet name', () => {
    const wb = buildWorkbook()
    const result = extractWorkbook(wb, 4)

    expect(result.sheetsUsed).toEqual(['IN CORSO', 'IN LAVORAZIONE', 'CONCLUSI', 'PRONTI & AVVISATI'])
    expect(result.extracted).toHaveLength(4)
    expect(result.extracted.map((r) => r.stato)).toEqual(['IN CORSO', 'IN LAVORAZIONE', 'CONCLUSI', 'PRONTI & AVVISATI'])
  })

  it('reports skipped rows when rif or cliente are missing', () => {
    const wb = buildWorkbook()
    const result = extractWorkbook(wb, 4)
    const inCorsoReport = result.reports.find((r) => r.sheet === 'IN CORSO')

    expect(inCorsoReport).toBeDefined()
    expect(inCorsoReport?.skippedRows).toBe(1)
    expect(inCorsoReport?.skippedExamples[0]?.reason).toBe('missing_rif')
  })
})
