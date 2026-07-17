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
  consegnaDataEffettivaSeconda?: string | null;
  problemiScaricoNota?: string | null;
  vettoreId?: number | null;
  vettoreSecondoId?: number | null;
  bilici?: number | null;
  biliciSecondi?: number | null;
  accontoPagato?: boolean | null;
  secondaConsegna?: boolean;
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
    if (state.secondaConsegna) {
      if (!state.consegnaDataEffettivaSeconda) {
        return 'Inserisci la seconda data di consegna.';
      }
      if (!Number.isFinite(state.biliciSecondi ?? NaN) || Number(state.biliciSecondi) < 0) {
        return 'Inserisci il numero di bilici per la seconda consegna.';
      }
      if (!state.vettoreSecondoId) {
        return 'Seleziona il vettore per la seconda consegna.';
      }
      const firstDate = new Date(state.consegnaDataEffettiva);
      const secondDate = new Date(state.consegnaDataEffettivaSeconda);
      if (!Number.isNaN(firstDate.getTime()) && !Number.isNaN(secondDate.getTime()) && secondDate.getTime() < firstDate.getTime()) {
        return 'La seconda consegna non può precedere la prima.';
      }
    }
  }

  if (state.toStatus === 'CONSEGNA EFFETTUATA' && !state.consegnaDataEffettiva) {
    return 'Inserisci la data consegna effettiva.';
  }

  return null
}
