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
  deliveryPlan?: Array<{ data: string; vettoreId: number | null; bilici: number | null }> | null;
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
    const deliveryPlan = state.deliveryPlan?.length
      ? state.deliveryPlan
      : [{
        data: state.consegnaDataEffettiva ?? '',
        vettoreId: state.vettoreId ?? null,
        bilici: state.bilici ?? null,
      }, ...(state.secondaConsegna ? [{
        data: state.consegnaDataEffettivaSeconda ?? '',
        vettoreId: state.vettoreSecondoId ?? null,
        bilici: state.biliciSecondi ?? null,
      }] : [])]

    if (!deliveryPlan[0]?.data) {
      return 'Inserisci la data consegna effettiva.'
    }
    if (!deliveryPlan[0].vettoreId) {
      return 'Seleziona il vettore.'
    }
    if (!Number.isFinite(deliveryPlan[0].bilici ?? NaN) || Number(deliveryPlan[0].bilici) < 0) {
      return 'Inserisci il numero di bilici.'
    }
    if (state.accontoPagato === false) {
      return 'L\'acconto deve risultare pagato prima della pianificazione consegna.'
    }
    for (let index = 1; index < deliveryPlan.length; index += 1) {
      const entry = deliveryPlan[index]
      if (!entry.data) {
        return `Inserisci la data della consegna ${index + 1}.`
      }
      if (!entry.vettoreId) {
        return `Seleziona il vettore della consegna ${index + 1}.`
      }
      if (!Number.isFinite(entry.bilici ?? NaN) || Number(entry.bilici) < 0) {
        return `Inserisci il numero di bilici della consegna ${index + 1}.`
      }
      const previousDate = new Date(deliveryPlan[index - 1].data)
      const currentDate = new Date(entry.data)
      if (!Number.isNaN(previousDate.getTime()) && !Number.isNaN(currentDate.getTime()) && currentDate.getTime() < previousDate.getTime()) {
        return `La consegna ${index + 1} non puo precedere la precedente.`
      }
    }
  }

  if (state.toStatus === 'CONSEGNA EFFETTUATA' && !state.consegnaDataEffettiva) {
    return 'Inserisci la data consegna effettiva.';
  }

  return null
}
