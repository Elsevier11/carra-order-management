export const ORDER_STATUS_FLOW = [
  'IN CORSO',
  'DISEGNO IN GESTIONE',
  'DISEGNO APPROVATO',
  'DA ASSEGNARE',
  'ASSEGNATO',
  'CONCLUSI',
  'PRONTI & AVVISATI',
  'CONSEGNA PIANIFICATA',
  'CONSEGNA EFFETTUATA',
  'SOSPESO',
] as const

export type ConsegnaStatus = (typeof ORDER_STATUS_FLOW)[number]

export const ORDER_TRANSITIONS: Record<ConsegnaStatus, readonly ConsegnaStatus[]> = {
  'IN CORSO': ['DISEGNO IN GESTIONE', 'SOSPESO'],
  'DISEGNO IN GESTIONE': ['DISEGNO APPROVATO', 'SOSPESO'],
  'DISEGNO APPROVATO': ['DA ASSEGNARE', 'SOSPESO'],
  'DA ASSEGNARE': ['ASSEGNATO', 'SOSPESO'],
  ASSEGNATO: ['CONCLUSI', 'SOSPESO'],
  CONCLUSI: ['PRONTI & AVVISATI', 'SOSPESO'],
  'PRONTI & AVVISATI': ['CONSEGNA PIANIFICATA', 'SOSPESO'],
  'CONSEGNA PIANIFICATA': ['CONSEGNA EFFETTUATA', 'SOSPESO'],
  'CONSEGNA EFFETTUATA': [],
  SOSPESO: ['IN CORSO', 'DISEGNO IN GESTIONE', 'DISEGNO APPROVATO', 'DA ASSEGNARE', 'ASSEGNATO', 'CONCLUSI', 'PRONTI & AVVISATI', 'CONSEGNA PIANIFICATA', 'CONSEGNA EFFETTUATA'],
}

export const ORDER_STATUS_CLASS: Record<ConsegnaStatus, string> = {
  'IN CORSO': 'status-in-corso',
  'DISEGNO IN GESTIONE': 'status-disegno-gestione',
  'DISEGNO APPROVATO': 'status-disegno-approvato',
  'DA ASSEGNARE': 'status-da-assegnare',
  ASSEGNATO: 'status-assegnato',
  CONCLUSI: 'status-conclusi',
  'PRONTI & AVVISATI': 'status-pronti-avvisati',
  'CONSEGNA PIANIFICATA': 'status-consegna-pianificata',
  'CONSEGNA EFFETTUATA': 'status-consegna-effettuata',
  SOSPESO: 'status-sospeso',
}

export const ORDER_STATUS_SHORT_LABEL: Record<ConsegnaStatus, string> = {
  'IN CORSO': 'In corso',
  'DISEGNO IN GESTIONE': 'Dis. gestione',
  'DISEGNO APPROVATO': 'Dis. approvato',
  'DA ASSEGNARE': 'Da assegnare',
  ASSEGNATO: 'Assegnato',
  CONCLUSI: 'Conclusi',
  'PRONTI & AVVISATI': 'Pronti',
  'CONSEGNA PIANIFICATA': 'Cons. pianif.',
  'CONSEGNA EFFETTUATA': 'Cons. eff.',
  SOSPESO: 'Sospeso',
}

export function allowedNextStatuses(currentStatus: string): ConsegnaStatus[] {
  const casted = currentStatus as ConsegnaStatus
  return [...(ORDER_TRANSITIONS[casted] ?? [])]
}

export function statusClass(status: string): string {
  return ORDER_STATUS_CLASS[status as ConsegnaStatus] ?? ''
}

export function statusShortLabel(status: ConsegnaStatus): string {
  return ORDER_STATUS_SHORT_LABEL[status] ?? status
}

