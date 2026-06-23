export interface TransitionStateLike {
  toStatus: string | null | undefined;
  note?: string | null;
  skipAssegnazione?: boolean;
  lavorazioneAssegnataAt?: string | null;
  operaiIds?: number[];
  conclusiMode?: 'week' | 'date' | null;
  conclusiWeek?: string | null;
  conclusiDate?: string | null;
}

export function validateTransitionState(state: TransitionStateLike): string | null {
  if (state.toStatus === 'SOSPESO' && !state.note?.trim()) {
    return 'Inserisci il motivo della sospensione.';
  }

  const requiresAssignment = state.toStatus === 'ASSEGNATO' && !state.skipAssegnazione
  if (requiresAssignment) {
    if (!state.lavorazioneAssegnataAt) {
      return 'Inserisci la data assegnazione.';
    }
    if (!state.operaiIds?.length) {
      return 'Seleziona almeno un operaio.';
    }
  }

  if (state.toStatus === 'CONCLUSI') {
    if ((state.conclusiMode ?? 'week') === 'week' && !state.conclusiWeek) {
      return 'Seleziona la settimana.';
    }
    if ((state.conclusiMode ?? 'week') === 'date' && !state.conclusiDate) {
      return 'Seleziona la data.';
    }
  }

  return null
}
