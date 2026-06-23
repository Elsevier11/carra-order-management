import { describe, expect, it } from 'vitest';
import { validateTransitionState } from './transition-validation';

describe('validateTransitionState', () => {
  it('requires assignment data for ASSEGNATO unless skipAssegnazione is true', () => {
    expect(validateTransitionState({ toStatus: 'ASSEGNATO' })).toBe('Inserisci la data assegnazione.');
    expect(
      validateTransitionState({
        toStatus: 'ASSEGNATO',
        skipAssegnazione: false,
        lavorazioneAssegnataAt: '2026-06-23',
      }),
    ).toBe('Seleziona almeno un operaio.');
    expect(
      validateTransitionState({
        toStatus: 'ASSEGNATO',
        skipAssegnazione: true,
      }),
    ).toBeNull();
  });

  it('requires week or date for CONCLUSI', () => {
    expect(validateTransitionState({ toStatus: 'CONCLUSI', conclusiMode: 'week' })).toBe('Seleziona la settimana.');
    expect(validateTransitionState({ toStatus: 'CONCLUSI', conclusiMode: 'date' })).toBe('Seleziona la data.');
    expect(validateTransitionState({ toStatus: 'CONCLUSI', conclusiMode: 'week', conclusiWeek: '2026-W26' })).toBeNull();
  });

  it('requires a note for SOSPESO', () => {
    expect(validateTransitionState({ toStatus: 'SOSPESO', note: '   ' })).toBe('Inserisci il motivo della sospensione.');
    expect(validateTransitionState({ toStatus: 'SOSPESO', note: 'Motivo' })).toBeNull();
  });
});
