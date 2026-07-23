import { describe, expect, it } from 'vitest'
import { boardCementiSummary, boardResiduiLavorazioneBadges, deliveryBadgeText, orderWarnings } from '../../frontend/src/app/order-formatters'

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

  it('switches delivery badge label when consegna is tassativa', () => {
    const item = {
      consegnaTassativa: true,
      dataConsegnaTassativa: '2026-07-20',
    } as never

    expect(deliveryBadgeText(item)).toContain('Consegna TASSATIVA')
    expect(deliveryBadgeText(item)).toContain('20/07/2026')
  })

  it('shows CAM badge only when camSiNo is true', () => {
    const onItem = {
      stato: 'IN CORSO',
      camSiNo: true,
    } as never
    const offItem = {
      stato: 'IN CORSO',
      camSiNo: false,
    } as never

    expect(boardResiduiLavorazioneBadges(onItem).some((badge) => badge.text === 'C.A.M.')).toBe(true)
    expect(boardResiduiLavorazioneBadges(offItem).some((badge) => badge.text === 'C.A.M.')).toBe(false)
  })

  it('renders residui notes the same way in ASSEGNATO and PRONTI & AVVISATI', () => {
    const assignedItem = {
      stato: 'ASSEGNATO',
      residuiLavorazioneNote: 'Prima riga\nSeconda riga',
    } as never
    const readyItem = {
      stato: 'PRONTI & AVVISATI',
      residuiLavorazioneNote: 'Prima riga\nSeconda riga',
    } as never

    const assignedBadge = boardResiduiLavorazioneBadges(assignedItem).find((badge) => badge.kind === 'note')
    const readyBadge = boardResiduiLavorazioneBadges(readyItem).find((badge) => badge.kind === 'note')

    expect(assignedBadge?.multiline).toBe(true)
    expect(readyBadge?.multiline).toBe(true)
    expect(assignedBadge?.html).toContain('Note residui:')
    expect(readyBadge?.html).toContain('Note residui:')
    expect(assignedBadge?.html).toContain('Seconda riga')
    expect(readyBadge?.html).toContain('Seconda riga')
  })
})
