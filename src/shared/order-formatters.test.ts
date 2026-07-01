import { describe, expect, it } from 'vitest'
import { boardCementiSummary, orderWarnings } from '../../frontend/src/app/order-formatters'

describe('order-formatters', () => {
  it('shows late warning only from PRONTI & AVVISATI onward', () => {
    const item = {
      stato: 'DISEGNO APPROVATO',
      dataConsegna: '2026-06-01',
      responsabileInternoId: 1,
    } as never

    expect(orderWarnings(item, () => true, () => 5)).toEqual([])
  })

  it('shows cement tags in DA ASSEGNARE', () => {
    const item = {
      stato: 'DA ASSEGNARE',
      cementi: [
        { nome: 'Cemento A', tipo: 'Cemento A', ordinata: true, fatta: false },
      ],
    } as never

    expect(boardCementiSummary(item)).toEqual([
      { nome: 'Cemento A', ordinata: true, fatta: false },
    ])
  })
})
