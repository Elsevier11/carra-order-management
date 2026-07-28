import type { ConsegnaRecord } from './consegne.types';
import { buildDeliveryPlanFromLegacy, normalizeDeliveryPlanEntries } from '../../../src/shared/delivery-plan';

export type BoardInfoBadgeTone = 'info' | 'warning' | 'positive' | 'muted' | 'danger' | 'cam';

export type BoardInfoBadge = {
  text: string;
  tone: BoardInfoBadgeTone;
  multiline?: boolean;
  kind?: 'note';
  html?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderRichTextHtml(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return 'â€”';
  if (/<\/?[a-z][\s\S]*>/i.test(raw)) return raw;
  return escapeHtml(raw).replace(/\n/g, '<br>');
}

export function composeNoteBadgeHtml(label: string, value: string | null | undefined): string {
  return `${escapeHtml(label)} ${renderRichTextHtml(value)}`;
}

export function deliveryBadgePrefix(item: ConsegnaRecord): string {
  return item.consegnaTassativa ? 'Consegna TASSATIVA' : 'Consegna stimata';
}

export function deliveryDateValue(item: ConsegnaRecord): string | null {
  return item.consegnaTassativa ? (item.dataConsegnaTassativa ?? item.dataConsegna) : item.dataConsegna;
}

export function deliveryBadgeText(item: ConsegnaRecord, value: string | null | undefined = deliveryDateValue(item)): string {
  const prefix = deliveryBadgePrefix(item);
  if (!value) return prefix;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return `${prefix} ${value}`;
  return `${prefix} ${parsed.toLocaleDateString('it-IT')}`;
}

export function orderWarnings(item: ConsegnaRecord, _isLate: (order: ConsegnaRecord) => boolean, _lateDays: (order: ConsegnaRecord) => number): string[] {
  const warnings: string[] = [];
  if (!deliveryDateValue(item)) warnings.push('Data consegna mancante');
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

export function boardAccessoriSummary(item: ConsegnaRecord): Array<{ nome: string; ordinata: boolean; fatta: boolean }> {
  if (!['DISEGNO APPROVATO', 'DA ASSEGNARE'].includes(item.stato) || !item.accessori?.length) return [];
  return item.accessori
    .filter((accessorio) => accessorio !== null && accessorio !== undefined)
    .map((accessorio) => ({
      nome: (accessorio as { nome?: string; tipo?: string }).nome ?? accessorio.tipo,
      ordinata: !!accessorio.ordinata,
      fatta: !!accessorio.fatta,
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
  if (item.camSiNo) badges.push({ text: 'C.A.M.', tone: 'cam' });
  if (item.lavorazioneParziale) badges.push({ text: 'Lavorazione parziale', tone: 'danger' });
  if (item.attesaMateriale) badges.push({ text: 'In attesa materiale', tone: 'danger' });
  const note = item.residuiLavorazioneNote?.trim();
  if (note) {
    badges.push({
      text: note,
      html: composeNoteBadgeHtml('Note residui:', note),
      tone: 'danger',
      kind: 'note',
      multiline: true,
    });
  }
  return badges;
}

function deliveryPlanForItem(item: ConsegnaRecord) {
  return normalizeDeliveryPlanEntries(item.deliveryPlan?.length ? item.deliveryPlan : buildDeliveryPlanFromLegacy(item));
}

export function boardConsegnaPianificataBadges(
  item: ConsegnaRecord,
  nomeVettore?: (id: number | null | undefined) => string,
): BoardInfoBadge[] {
  if (!['CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA'].includes(item.stato)) return [];
  const deliveryPlan = deliveryPlanForItem(item);
  const badges: BoardInfoBadge[] = [];
  const actualDate = item.consegnaDataEffettiva?.trim() ?? '';

  badges.push({
    text: actualDate ? `Cons. effettiva ${new Date(actualDate).toLocaleDateString('it-IT')}` : 'Cons. effettiva',
    tone: actualDate ? 'info' : 'muted',
  });

  deliveryPlan.forEach((entry, index) => {
    if (index === 0 && actualDate && entry.data === actualDate) {
      return;
    }

    const label = `${index + 1}a consegna`;
    const dateText = entry.data ? new Date(entry.data).toLocaleDateString('it-IT') : 'data mancante';
    const biliciText = entry.bilici != null ? ` · ${entry.bilici} bilici` : '';
    const vettoreNome = nomeVettore?.(entry.vettoreId ?? null) ?? '';
    const vettoreText = vettoreNome && vettoreNome !== '—' ? ` · ${vettoreNome}` : '';
    badges.push({ text: `${label} ${dateText}${biliciText}${vettoreText}`, tone: entry.data ? 'danger' : 'muted' });
  });

  badges.push({ text: 'DDT pronti', tone: item.ddtPronti ? 'positive' : 'muted' });
  return badges;
}

export function boardProntiAvvisatiBadges(item: ConsegnaRecord): BoardInfoBadge[] {
  if (item.stato !== 'PRONTI & AVVISATI') return [];
  return [
    { text: 'Bancale', tone: item.bancale ? 'positive' : 'muted' },
    { text: 'Chiusini', tone: item.chiusini ? 'positive' : 'muted' },
  ];
}

export function boardConclusiBadge(item: ConsegnaRecord, conclusiWeekLabel: (value: string | null | undefined) => string): string | null {
  if (!item.conclusiMode || item.stato === 'CONSEGNA PIANIFICATA') return null;
  if (item.conclusiMode === 'week') {
    return `A.M.P.: ${conclusiWeekLabel(item.conclusiWeek)}`;
  }
  if (!item.conclusiDate) return null;
  const parsed = new Date(item.conclusiDate);
  if (Number.isNaN(parsed.getTime())) return `A.M.P.: ${item.conclusiDate}`;
  return `A.M.P.: ${parsed.toLocaleDateString('it-IT')}`;
}

export function detailMissingItems(item: ConsegnaRecord): string[] {
  const missing: string[] = [];
  if (!deliveryDateValue(item)) missing.push('Data consegna');
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
  return operai?.length ? operai.map((o) => o.nome).join(', ') : 'â€”';
}

export function conclusiWeekLabel(value: string | null | undefined): string {
  if (!value) return 'â€”';
  const match = /^(\d{4})-W(\d{2})$/.exec(value);
  if (!match) return value;
  return `Settimana ${match[2]} / ${match[1]}`;
}

export function conclusiDateLabel(value: string | null | undefined): string {
  return value ? value : 'â€”';
}


