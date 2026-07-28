export const MAX_DELIVERY_PLAN_ENTRIES = 4;

export interface DeliveryPlanEntry {
  data: string;
  vettoreId: number | null;
  bilici: number | null;
}

export interface LegacyDeliveryPlanFields {
  consegnaDataEffettiva?: string | null;
  consegnaDataEffettivaSeconda?: string | null;
  vettoreId?: number | null;
  vettoreSecondoId?: number | null;
  bilici?: number | null;
  biliciSecondi?: number | null;
}

function normalizeDate(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

function normalizeNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeVettoreId(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export function normalizeDeliveryPlanEntries(entries: Array<Partial<DeliveryPlanEntry> | null | undefined> | null | undefined): DeliveryPlanEntry[] {
  const normalized = (entries ?? []).slice(0, MAX_DELIVERY_PLAN_ENTRIES).map((entry) => ({
    data: normalizeDate(entry?.data),
    vettoreId: normalizeVettoreId(entry?.vettoreId),
    bilici: normalizeNumber(entry?.bilici),
  }));
  while (normalized.length < MAX_DELIVERY_PLAN_ENTRIES && normalized.length === 0) {
    normalized.push({ data: '', vettoreId: null, bilici: null });
  }
  return normalized;
}

export function buildDeliveryPlanFromLegacy(fields: LegacyDeliveryPlanFields): DeliveryPlanEntry[] {
  const plan: DeliveryPlanEntry[] = [];
  plan.push({
    data: normalizeDate(fields.consegnaDataEffettiva),
    vettoreId: normalizeVettoreId(fields.vettoreId),
    bilici: normalizeNumber(fields.bilici),
  });
  if (fields.consegnaDataEffettivaSeconda || fields.vettoreSecondoId || fields.biliciSecondi != null) {
    plan.push({
      data: normalizeDate(fields.consegnaDataEffettivaSeconda),
      vettoreId: normalizeVettoreId(fields.vettoreSecondoId),
      bilici: normalizeNumber(fields.biliciSecondi),
    });
  }
  return normalizeDeliveryPlanEntries(plan);
}

export function deliveryPlanHasAnyValue(plan: DeliveryPlanEntry[] | null | undefined): boolean {
  return !!plan?.some((entry) => !!entry.data || !!entry.vettoreId || (entry.bilici ?? 0) > 0);
}

export function splitDeliveryPlanToLegacy(plan: DeliveryPlanEntry[] | null | undefined): LegacyDeliveryPlanFields {
  const entries = normalizeDeliveryPlanEntries(plan);
  const first = entries[0] ?? { data: '', vettoreId: null, bilici: null };
  const second = entries[1] ?? { data: '', vettoreId: null, bilici: null };
  return {
    consegnaDataEffettiva: first.data || null,
    vettoreId: first.vettoreId ?? null,
    bilici: first.bilici ?? 0,
    consegnaDataEffettivaSeconda: second.data || null,
    vettoreSecondoId: second.vettoreId ?? null,
    biliciSecondi: second.bilici ?? 0,
  };
}
