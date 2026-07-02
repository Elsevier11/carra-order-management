import type { ConsegnaRecord } from './consegne.types';

export type BoardInfoBadgeTone = 'info' | 'warning' | 'positive' | 'muted' | 'violet';

export type BoardInfoBadge = {
  text: string;
  tone: BoardInfoBadgeTone;
};

export function orderWarnings(item: ConsegnaRecord, _isLate: (order: ConsegnaRecord) => boolean, _lateDays: (order: ConsegnaRecord) => number): string[] {
  const warnings: string[] = [];
  if (!item.dataConsegna) warnings.push('Data consegna mancante');
  if (!item.responsabileInternoId) warnings.push('Resp. mancante');
  return warnings;
}

export function boardCementiSummary(item: ConsegnaRecord): Array<{ nome: string; ordinata: boolean; fatta: boolean }> {
  if (!['DISEGNO APPROVATO', 'DA ASSEGNARE'].includes(item.stato) || !item.cementi?.length) return [];
  return item.cementi
    .filter((cemento) => cemento !== null && cemento !== undefined)
    .map((cemento) => ({
      nome: (cemento as { nome?: string; tipo?: string }).nome ?? cemento.tipo,
      ordinata: !!cemento.ordinata,
      fatta: !!cemento.fatta,
    }));
}

export function boardOperaiSummary(item: ConsegnaRecord): string[] {
  if (['PRONTI & AVVISATI', 'CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA', 'SOSPESO'].includes(item.stato)) {
    return [];
  }
  return item.operaiAssegnati?.map((operaio) => operaio.nome).filter(Boolean) ?? [];
}

export function boardOperaiWarning(item: ConsegnaRecord): string | null {
  if (item.stato !== 'ASSEGNATO') return null;
  return (item.operaiAssegnati?.length ?? 0) > 0 ? null : 'Operai mancanti';
}

export function boardResiduiLavorazioneBadges(item: ConsegnaRecord): BoardInfoBadge[] {
  const badges: BoardInfoBadge[] = [];
  if (item.lavorazioneParziale) badges.push({ text: 'Lavorazione parziale', tone: 'violet' });
  if (item.attesaMateriale) badges.push({ text: 'In attesa materiale', tone: 'violet' });
  if (item.residuiLavorazioneNote?.trim()) badges.push({ text: 'Vedi note', tone: 'violet' });
  return badges;
}

export function boardConsegnaPianificataBadges(
  item: ConsegnaRecord,
  nomeVettore?: (id: number | null | undefined) => string,
): BoardInfoBadge[] {
  if (item.stato !== 'CONSEGNA PIANIFICATA') return [];
  const dataEffettivaText = item.consegnaDataEffettiva
    ? `Data consegna effettiva ${new Date(item.consegnaDataEffettiva).toLocaleDateString('it-IT')}`
    : 'Data consegna effettiva';
  const biliciText = `N° bilici ${item.bilici ?? 0}`;
  const vettoreNome = nomeVettore?.(item.vettoreId) ?? '';
  const vettoreText = vettoreNome && vettoreNome !== '—' ? `Vettore ${vettoreNome}` : 'Vettore';
  return [
    { text: dataEffettivaText, tone: item.consegnaDataEffettiva ? 'info' : 'muted' },
    { text: biliciText, tone: (item.bilici ?? 0) > 0 ? 'info' : 'muted' },
    { text: vettoreText, tone: item.vettoreId ? 'info' : 'muted' },
    { text: 'DDT pronti', tone: item.ddtPronti ? 'positive' : 'muted' },
    { text: 'Bancale', tone: item.bancale ? 'positive' : 'muted' },
    { text: 'Chiusini', tone: item.chiusini ? 'positive' : 'muted' },
    { text: 'Carico verificato', tone: item.caricoVerificato ? 'positive' : 'muted' },
  ];
}

export function boardConclusiBadge(item: ConsegnaRecord, conclusiWeekLabel: (value: string | null | undefined) => string): string | null {
  if (!item.conclusiMode) return null;
  if (item.conclusiMode === 'week') {
    return `A.M.P.: ${conclusiWeekLabel(item.conclusiWeek)}`;
  }
  if (!item.conclusiDate) return null;
  const parsed = new Date(item.conclusiDate);
  if (Number.isNaN(parsed.getTime())) return `A.M.P.: ${item.conclusiDate}`;
  return `A.M.P.: ${parsed.toLocaleDateString('it-IT')}`;
}

export function boardProntiAvvisatiBadge(item: ConsegnaRecord): string | null {
  return null;
}

export function detailMissingItems(item: ConsegnaRecord): string[] {
  const missing: string[] = [];
  if (!item.dataConsegna) missing.push('Data consegna');
  if (!item.responsabileInternoId) missing.push('Responsabile');
  if (item.stato === 'CONSEGNA PIANIFICATA') {
    if (!item.consegnaDataEffettiva) missing.push('Data consegna effettiva');
    if (!item.vettoreId) missing.push('Vettore');
    if (!item.ddtPronti) missing.push('DDT pronti');
    if (!item.accontoPagato) missing.push('Acconto pagato');
  }
  return missing;
}

export function selectedCementiSummary<T extends { selezionato: boolean; tipoId: number; nome: string; ordinata: boolean; fatta: boolean }>(selections: T[]): T[] {
  return selections.filter((sel) => sel.selezionato);
}

export function cementoBadgeClass(sel: { selezionato: boolean; ordinata: boolean; fatta: boolean }): string {
  if (sel.fatta && sel.ordinata) return 'cemento-badge cemento-badge--verde';
  if (sel.ordinata) return 'cemento-badge cemento-badge--arancione';
  return 'cemento-badge cemento-badge--rosso';
}

export function cementoBadgeClassFromFlags(sel: { ordinata: boolean; fatta: boolean }): string {
  if (sel.fatta && sel.ordinata) return 'cemento-badge cemento-badge--verde';
  if (sel.ordinata) return 'cemento-badge cemento-badge--arancione';
  return 'cemento-badge cemento-badge--rosso';
}

export function onCementoOrdinataChange(sel: { ordinata: boolean; fatta: boolean }): void {
  if (!sel.ordinata) {
    sel.fatta = false;
  }
}

export function onCementoFattaChange(sel: { ordinata: boolean; fatta: boolean }, checked: boolean): void {
  sel.fatta = checked && sel.ordinata;
}

export function operaiNomiLabel(operai: { nome: string }[] | undefined): string {
  return operai?.length ? operai.map((o) => o.nome).join(', ') : '—';
}

export function conclusiWeekLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return value;
  return `Settimana ${match[2]} / ${match[1]}`;
}

export function conclusiDateLabel(value: string | null | undefined): string {
  return value ? value : '—';
}
