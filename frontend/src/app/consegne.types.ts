export interface OrderCemento {
  id: number;
  tipoId: number;
  tipo: string;
  ordinata: boolean;
  fatta: boolean;
}

export interface OrderAccessorio {
  id: number;
  tipoId: number;
  tipo: string;
  ordinata: boolean;
  fatta: boolean;
}

export interface Operaio {
  id: number;
  nome: string;
  createdAt: string | null;
}

export interface Vettore {
  id: number;
  nome: string;
  createdAt: string | null;
}

export interface MittenteDisegno {
  id: number;
  nome: string;
  createdAt: string | null;
}

export interface CementoTipo {
  id: number;
  nome: string;
  ordine: number;
  createdAt: string | null;
}

export interface AccessorioTipo {
  id: number;
  nome: string;
  ordine: number;
  createdAt: string | null;
}

export interface ConsegnaRecord {
  id: number;
  rif: string;
  cliente: string;
  tipoImpianto: string | null;
  dataConsegna: string | null;
  cantiere: string | null;
  dataOrdine: string | null;
  referente: string | null;
  telefono: string | null;
  scarico: string | null;
  vascheCav: string | null;
  stato: string;
  note: string | null;
  trasporto: boolean;
  scaricoCarico: boolean;
  accontoPagato: boolean;
  commercialeId: number | null;
  responsabileInternoId: number | null;
  folderLinkDocumenti: string | null;
  folderLinkFoto: string | null;
  // Disegno
  disegnoSpeditoAt: string | null;
  disegnoMittenteId: number | null;
  disegnoNote: string | null;
  // Massicciata / tipo carici
  massicciataNota: string | null;
  tipoCariciNota: string | null;
  // Lavorazione
  lavorazioneAssegnataAt: string | null;
  // Consegna
  consegnaDataEffettiva: string | null;
  vettoreId: number | null;
  bilici: number;
  ddtPronti: boolean;
  bancale: boolean;
  chiusini: boolean;
  caricoVerificato: boolean;
  camSiNo: boolean;
  conclusiMode?: 'week' | 'date' | null;
  conclusiWeek?: string | null;
  conclusiDate?: string | null;
  // Relazioni
  operaiAssegnati: { id: number; nome: string }[];
  cementi: OrderCemento[];
  accessori: OrderAccessorio[];
}

export interface CommercialeRecord {
  id: number;
  nome: string;
  createdAt: string | null;
}

export interface ResponsabileRecord {
  id: number;
  nome: string;
  createdAt: string | null;
}

export type ConsegnaStatus = 'IN CORSO' | 'DISEGNO IN GESTIONE' | 'DISEGNO APPROVATO' | 'DA ASSEGNARE' | 'ASSEGNATO' | 'CONCLUSI' | 'PRONTI & AVVISATI' | 'CONSEGNA PIANIFICATA' | 'CONSEGNA EFFETTUATA' | 'SOSPESO';

export interface ConsegnaFilters {
  q?: string;
  cliente?: string;
  stato?: string;
  fromDate?: string;
  toDate?: string;
}

export interface BoardResponse {
  columns: BoardColumn[];
}

export interface ConsegneResponse {
  data: ConsegnaRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ConsegnaStats {
  kpi: {
    consegneSettimanaCorrente: number;
    consegneProssimaSettimana: number;
    ritardi: number;
    totaleAttivi: number;
    accontiDaIncassare: number;
    ordiniIncompleti: number;
    senzaResponsabile: number;
    senzaDocumenti: number;
    senzaFoto: number;
  };
  byStatus: Array<{ stato: string; count: number }>;
  pipelineConRitardi: Array<{ stato: string; total: number; late: number }>;
  weeklyTrend: Array<{ week: string; count: number }>;
  upcomingByWeek: Array<{ week: string; count: number }>;
  byClienteAttivi: Array<{ cliente: string; count: number }>;
}

export interface FilterOptions {
  clienti: string[];
  stati: string[];
}

export interface AuthUser {
  username: string;
  role: 'admin' | 'operativo' | 'lettura';
}

export interface OrderEvent {
  id: number;
  orderId: number;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  actor: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface BoardColumn {
  status: ConsegnaStatus;
  count: number;
  items: ConsegnaRecord[];
}

export interface AttachmentRecord {
  id: number;
  orderId: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string | null;
}

export interface AuditLogRecord {
  id: number;
  username: string | null;
  role: string | null;
  action: string;
  method: string;
  path: string;
  entity: string | null;
  entityId: number | null;
  success: boolean;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AppUserRecord {
  id: number;
  username: string;
  role: 'admin' | 'operativo' | 'lettura';
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

// ── ERP SQL Server import ────────────────────────────────────────────────────

export interface ErpOrderPreviewItem {
  externalRef: string;
  rifto: string;
  cliente: string;
  dataOrdine: string | null;
  dataConsegna: string | null;
  cantiere: string | null;
  agenteNome: string | null;
  agenteCodice: string | null;
}

export interface SqlServerPreviewResponse {
  orders: ErpOrderPreviewItem[];
  lastImportDate: string;
  alreadyImportedCount: number;
  isTruncated: boolean;
}

export interface SqlServerImportResult {
  imported: number;
  skippedDuplicates: number;
  newLastImportDate: string;
}

export interface ImportConfig {
  lastImportDate: string;
}

// ── Settings: configurazione ERP SQL Server ──────────────────────────────────

export interface SqlServerConfigParam {
  value: string;
  source: 'db' | 'env';
}

export interface SqlServerConfigResponse {
  host: SqlServerConfigParam;
  port: SqlServerConfigParam;
  database: SqlServerConfigParam;
  user: SqlServerConfigParam;
  password: SqlServerConfigParam;
  timeoutMs: SqlServerConfigParam;
}

export interface SqlServerConfigSavePayload {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  timeoutMs: string;
}

export interface SqlServerTestResult {
  ok: boolean;
  message?: string;
}
