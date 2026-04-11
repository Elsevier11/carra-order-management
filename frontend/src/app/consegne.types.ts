export interface ConsegnaRecord {
  id: number;
  rif: string;
  cliente: string;
  tipoImpianto: string | null;
  dataConsegna: string | null;
  cantiere: string | null;
  dataOrdine: string | null;
  vettore: string | null;
  scarico: string | null;
  vascheCav: string | null;
  accessori: string | null;
  operai: string | null;
  stato: string;
  note: string | null;
}

export type ConsegnaStatus = 'IN CORSO' | 'IN LAVORAZIONE' | 'PRONTI & AVVISATI' | 'CONCLUSI' | 'SOSPESO';

export interface ConsegnaFilters {
  q?: string;
  cliente?: string;
  vettore?: string;
  stato?: string;
  fromDate?: string;
  toDate?: string;
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
    ritardi: number;
  };
  byCarrier: Array<{ vettore: string; count: number }>;
  byStatus: Array<{ stato: string; count: number }>;
  weeklyTrend: Array<{ week: string; count: number }>;
}

export interface FilterOptions {
  clienti: string[];
  vettori: string[];
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
