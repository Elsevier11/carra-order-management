export interface TransitionStateLike {
  toStatus: string | null | undefined;
  note?: string | null;
  skipAssegnazione?: boolean;
  disegnoSpeditoAt?: string | null;
  disegnoMittenteId?: number | null;
  disegnoApprovatoAt?: string | null;
  lavorazioneAssegnataAt?: string | null;
  operaiIds?: number[];
  conclusiMode?: 'week' | 'date' | null;
  conclusiWeek?: string | null;
  conclusiDate?: string | null;
  consegnaDataEffettiva?: string | null;
  vettoreId?: number | null;
  bilici?: number | null;
  accontoPagato?: boolean | null;
}

export function validateTransitionState(state: TransitionStateLike): string | null {
  if (state.toStatus === 'SOSPESO' && !state.note?.trim()) {
    return 'Inserisci il motivo della sospensione.';
  }

  if (state.toStatus === 'DISEGNO IN GESTIONE') {
    if (!state.disegnoSpeditoAt) {
      return 'Inserisci la data spedizione disegno.';
    }
    if (!state.disegnoMittenteId) {
      return 'Seleziona il mittente del disegno.';
    }
  }

  if (state.toStatus === 'DISEGNO APPROVATO' && !state.disegnoApprovatoAt) {
    return 'Inserisci la data approvazione disegno.';
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

  if (state.toStatus === 'CONCLUSI' || state.toStatus === 'PRONTI & AVVISATI') {
    if ((state.conclusiMode ?? 'week') === 'week' && !state.conclusiWeek) {
      return 'Seleziona la settimana.';
    }
    if ((state.conclusiMode ?? 'week') === 'date' && !state.conclusiDate) {
      return 'Seleziona la data.';
    }
  }

  if (state.toStatus === 'CONSEGNA PIANIFICATA') {
    if (!state.consegnaDataEffettiva) {
      return 'Inserisci la data consegna effettiva.';
    }
    if (!Number.isFinite(state.bilici ?? NaN) || Number(state.bilici) < 0) {
      return 'Inserisci il numero di bilici.';
    }
    if (!state.vettoreId) {
      return 'Seleziona il vettore.';
    }
    if (state.accontoPagato === false) {
      return 'L\'acconto deve risultare pagato prima della pianificazione consegna.';
    }
  }

  if (state.toStatus === 'CONSEGNA EFFETTUATA' && !state.consegnaDataEffettiva) {
    return 'Inserisci la data consegna effettiva.';
  }

  return null
}
