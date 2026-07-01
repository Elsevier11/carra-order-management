import { describe, expect, it } from 'vitest'
import { validateTransitionState } from './transition-validation'

describe('validateTransitionState', () => {
  it('requires drawing dispatch data for DISEGNO IN GESTIONE', () => {
    expect(
      validateTransitionState({
        toStatus: 'DISEGNO IN GESTIONE',
        disegnoSpeditoAt: '',
        disegnoMittenteId: null,
      }),
    ).toMatch(/spedizione disegno/i)

    expect(
      validateTransitionState({
        toStatus: 'DISEGNO IN GESTIONE',
        disegnoSpeditoAt: '2026-07-01',
        disegnoMittenteId: 3,
      }),
    ).toBeNull()
  })

  it('requires A.M.P. data for PRONTI & AVVISATI', () => {
    expect(
      validateTransitionState({
        toStatus: 'PRONTI & AVVISATI',
        conclusiMode: 'week',
        conclusiWeek: '',
      }),
    ).toMatch(/settimana/i)

    expect(
      validateTransitionState({
        toStatus: 'PRONTI & AVVISATI',
        conclusiMode: 'date',
        conclusiDate: '2026-07-01',
      }),
    ).toBeNull()
  })

  it('requires delivery planning data and paid deposit for CONSEGNA PIANIFICATA', () => {
    expect(
      validateTransitionState({
        toStatus: 'CONSEGNA PIANIFICATA',
        consegnaDataEffettiva: '2026-07-01',
        vettoreId: 4,
        bilici: 2,
        accontoPagato: false,
      }),
    ).toMatch(/acconto/i)

    expect(
      validateTransitionState({
        toStatus: 'CONSEGNA PIANIFICATA',
        consegnaDataEffettiva: '2026-07-01',
        vettoreId: 4,
        bilici: 2,
        accontoPagato: true,
      }),
    ).toBeNull()
  })

  it('requires delivery date for CONSEGNA EFFETTUATA', () => {
    expect(
      validateTransitionState({
        toStatus: 'CONSEGNA EFFETTUATA',
        consegnaDataEffettiva: '',
      }),
    ).toMatch(/consegna effettiva/i)
  })
})
