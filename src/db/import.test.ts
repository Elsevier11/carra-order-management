import { describe, expect, it } from 'vitest'
import { normalizeRow, parseDate } from './import'

describe('import helpers', () => {
  it('parseDate returns null for invalid values', () => {
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('Da concordare')).toBeNull()
  })

  it('parseDate parses valid date values', () => {
    const parsed = parseDate('2026-03-13')
    expect(parsed).toBeInstanceOf(Date)
    expect(parsed?.toISOString().slice(0, 10)).toBe('2026-03-13')
  })

  it('normalizeRow maps camel/snake keys and requires rif+cliente', () => {
    const valid = normalizeRow({
      rif: '50025',
      cliente: 'Lucchini Costruzioni',
      tipo_impianto: 'N1 METEOTANK',
      data_consegna: '2026-03-13',
      traspor: '2 COTRAM',
      stato: 'IN CORSO',
    })

    expect(valid).toBeTruthy()
    expect(valid?.rifto).toBe('50025')
    expect(valid?.tipoImpianto).toBe('N1 METEOTANK')
    expect(valid?.traspor).toBe('2 COTRAM')
    expect(valid?.dataConsegna?.toISOString().slice(0, 10)).toBe('2026-03-13')

    const invalid = normalizeRow({
      rif: '',
      cliente: 'x',
    })
    expect(invalid).toBeNull()
  })
})
