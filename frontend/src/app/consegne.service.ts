import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { AccessorioTipo, AppUserRecord, AttachmentRecord, AuditLogResponse, BoardResponse, CementoTipo, CommercialeRecord, ConsegnaFilters, ConsegneResponse, ConsegnaStats, ErpOrderPreviewItem, FilterOptions, ImportConfig, MittenteDisegno, Operaio, OrderAccessorio, OrderCemento, OrderEvent, ResponsabileRecord, SqlServerImportResult, SqlServerPreviewResponse, Vettore } from './consegne.types';

@Injectable({ providedIn: 'root' })
export class ConsegneService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/consegne`;
  private readonly auditUrl = `${environment.apiUrl}/audit`;
  private readonly usersUrl = `${environment.apiUrl}/users`;
  private readonly commercialiUrl = `${environment.apiUrl}/commerciali`;
  private readonly responsabiliUrl = `${environment.apiUrl}/responsabili`;
  private readonly importErpUrl = `${environment.apiUrl}/import/sqlserver`;

  list(query: ConsegnaFilters & { page: number; pageSize: number; sortBy: string; sortDir: string }): Observable<ConsegneResponse> {
    let params = new HttpParams();

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http.get<ConsegneResponse>(this.baseUrl, { params });
  }

  stats(): Observable<ConsegnaStats> {
    return this.http.get<ConsegnaStats>(`${this.baseUrl}/stats`);
  }

  filters(): Observable<FilterOptions> {
    return this.http.get<FilterOptions>(`${this.baseUrl}/filters`);
  }

  board(query: ConsegnaFilters = {}): Observable<BoardResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<BoardResponse>(`${this.baseUrl}/board`, { params });
  }

  history(id: number): Observable<{ data: OrderEvent[] }> {
    return this.http.get<{ data: OrderEvent[] }>(`${this.baseUrl}/${id}/history`);
  }

  transition(id: number, toStatus: string, note?: string) {
    return this.http.post(`${this.baseUrl}/${id}/transition`, { toStatus, note });
  }

  exportCsv(query: ConsegnaFilters & { sortBy?: string; sortDir?: string }): Observable<string> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'text',
    });
  }

  listAttachments(orderId: number): Observable<{ data: AttachmentRecord[] }> {
    return this.http.get<{ data: AttachmentRecord[] }>(`${this.baseUrl}/${orderId}/attachments`);
  }

  uploadAttachment(orderId: number, file: File): Observable<AttachmentRecord> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<AttachmentRecord>(`${this.baseUrl}/${orderId}/attachments`, formData);
  }

  downloadAttachment(orderId: number, attachmentId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${orderId}/attachments/${attachmentId}`, { responseType: 'blob' });
  }

  deleteAttachment(orderId: number, attachmentId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${orderId}/attachments/${attachmentId}`);
  }

  listAudit(query: { page: number; pageSize: number; username?: string; action?: string; entity?: string; fromDate?: string; toDate?: string; success?: string }): Observable<AuditLogResponse> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<AuditLogResponse>(this.auditUrl, { params });
  }

  exportAuditCsv(query: { username?: string; action?: string; entity?: string; fromDate?: string; toDate?: string; success?: string }): Observable<string> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get(`${this.auditUrl}/export`, {
      params,
      responseType: 'text',
    });
  }

  listUsers(): Observable<{ data: AppUserRecord[] }> {
    return this.http.get<{ data: AppUserRecord[] }>(this.usersUrl);
  }

  createUser(payload: { username: string; role: 'admin' | 'operativo' | 'lettura'; isActive: boolean }): Observable<AppUserRecord & { generatedPassword: string }> {
    return this.http.post<AppUserRecord & { generatedPassword: string }>(this.usersUrl, payload);
  }

  updateUser(id: number, payload: { role?: 'admin' | 'operativo' | 'lettura'; isActive?: boolean }): Observable<AppUserRecord> {
    return this.http.put<AppUserRecord>(`${this.usersUrl}/${id}`, payload);
  }

  resetUserPassword(id: number, password: string): Observable<void> {
    return this.http.put<void>(`${this.usersUrl}/${id}/password`, { password });
  }

  getById(id: number) {
    return this.http.get(`${this.baseUrl}/${id}`);
  }

  create(payload: Record<string, unknown>) {
    return this.http.post(this.baseUrl, payload);
  }

  update(id: number, payload: Record<string, unknown>) {
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  updateOperai(id: number, operaiIds: number[]): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${id}/operai`, { operaiIds });
  }

  delete(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  listCommerciali(): Observable<{ data: CommercialeRecord[] }> {
    return this.http.get<{ data: CommercialeRecord[] }>(this.commercialiUrl);
  }

  createCommerciale(payload: { nome: string }): Observable<CommercialeRecord> {
    return this.http.post<CommercialeRecord>(this.commercialiUrl, payload);
  }

  updateCommerciale(id: number, payload: { nome: string }): Observable<CommercialeRecord> {
    return this.http.put<CommercialeRecord>(`${this.commercialiUrl}/${id}`, payload);
  }

  deleteCommerciale(id: number): Observable<void> {
    return this.http.delete<void>(`${this.commercialiUrl}/${id}`);
  }

  listResponsabili(): Observable<{ data: ResponsabileRecord[] }> {
    return this.http.get<{ data: ResponsabileRecord[] }>(this.responsabiliUrl);
  }

  createResponsabile(payload: { nome: string }): Observable<ResponsabileRecord> {
    return this.http.post<ResponsabileRecord>(this.responsabiliUrl, payload);
  }

  updateResponsabile(id: number, payload: { nome: string }): Observable<ResponsabileRecord> {
    return this.http.put<ResponsabileRecord>(`${this.responsabiliUrl}/${id}`, payload);
  }

  deleteResponsabile(id: number): Observable<void> {
    return this.http.delete<void>(`${this.responsabiliUrl}/${id}`);
  }

  // ── Lookup lists ──────────────────────────────────────────────────────────

  listMittentiDisegno(): Observable<{ data: MittenteDisegno[] }> {
    return this.http.get<{ data: MittenteDisegno[] }>(`${environment.apiUrl}/mittenti-disegno`);
  }

  createMittenteDisegno(payload: { nome: string }): Observable<MittenteDisegno> {
    return this.http.post<MittenteDisegno>(`${environment.apiUrl}/mittenti-disegno`, payload);
  }

  updateMittenteDisegno(id: number, payload: { nome: string }): Observable<MittenteDisegno> {
    return this.http.put<MittenteDisegno>(`${environment.apiUrl}/mittenti-disegno/${id}`, payload);
  }

  deleteMittenteDisegno(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/mittenti-disegno/${id}`);
  }

  listOperai(): Observable<{ data: Operaio[] }> {
    return this.http.get<{ data: Operaio[] }>(`${environment.apiUrl}/operai`);
  }

  createOperaio(payload: { nome: string }): Observable<Operaio> {
    return this.http.post<Operaio>(`${environment.apiUrl}/operai`, payload);
  }

  updateOperaio(id: number, payload: { nome: string }): Observable<Operaio> {
    return this.http.put<Operaio>(`${environment.apiUrl}/operai/${id}`, payload);
  }

  deleteOperaio(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/operai/${id}`);
  }

  listVettori(): Observable<{ data: Vettore[] }> {
    return this.http.get<{ data: Vettore[] }>(`${environment.apiUrl}/vettori`);
  }

  createVettore(payload: { nome: string }): Observable<Vettore> {
    return this.http.post<Vettore>(`${environment.apiUrl}/vettori`, payload);
  }

  updateVettore(id: number, payload: { nome: string }): Observable<Vettore> {
    return this.http.put<Vettore>(`${environment.apiUrl}/vettori/${id}`, payload);
  }

  deleteVettore(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/vettori/${id}`);
  }

  // ── ERP SQL Server import ──────────────────────────────────────────────────

  getImportConfig(): Observable<ImportConfig> {
    return this.http.get<ImportConfig>(`${this.importErpUrl}/config`);
  }

  updateImportConfig(lastImportDate: string): Observable<ImportConfig> {
    return this.http.put<ImportConfig>(`${this.importErpUrl}/config`, { lastImportDate });
  }

  previewErpImport(): Observable<SqlServerPreviewResponse> {
    return this.http.post<SqlServerPreviewResponse>(`${this.importErpUrl}/preview`, {});
  }

  executeErpImport(orders: ErpOrderPreviewItem[]): Observable<SqlServerImportResult> {
    return this.http.post<SqlServerImportResult>(`${this.importErpUrl}/execute`, { orders });
  }

  // ── Cementi / Accessori tipi e ordini ─────────────────────────────────────

  listCementiTipi(): Observable<{ data: CementoTipo[] }> {
    return this.http.get<{ data: CementoTipo[] }>(`${environment.apiUrl}/cementi-tipi`);
  }

  createCementoTipo(payload: { nome: string; ordine: number }): Observable<CementoTipo> {
    return this.http.post<CementoTipo>(`${environment.apiUrl}/cementi-tipi`, payload);
  }

  updateCementoTipo(id: number, payload: { nome: string; ordine: number }): Observable<CementoTipo> {
    return this.http.put<CementoTipo>(`${environment.apiUrl}/cementi-tipi/${id}`, payload);
  }

  deleteCementoTipo(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/cementi-tipi/${id}`);
  }

  listAccessoriTipi(): Observable<{ data: AccessorioTipo[] }> {
    return this.http.get<{ data: AccessorioTipo[] }>(`${environment.apiUrl}/accessori-tipi`);
  }

  createAccessorioTipo(payload: { nome: string; ordine: number }): Observable<AccessorioTipo> {
    return this.http.post<AccessorioTipo>(`${environment.apiUrl}/accessori-tipi`, payload);
  }

  updateAccessorioTipo(id: number, payload: { nome: string; ordine: number }): Observable<AccessorioTipo> {
    return this.http.put<AccessorioTipo>(`${environment.apiUrl}/accessori-tipi/${id}`, payload);
  }

  deleteAccessorioTipo(id: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/accessori-tipi/${id}`);
  }

  getOrderCementi(id: number): Observable<{ data: OrderCemento[] }> {
    return this.http.get<{ data: OrderCemento[] }>(`${this.baseUrl}/${id}/cementi`);
  }

  getOrderAccessori(id: number): Observable<{ data: OrderAccessorio[] }> {
    return this.http.get<{ data: OrderAccessorio[] }>(`${this.baseUrl}/${id}/accessori`);
  }

  updateOrderCementi(id: number, items: { tipoId: number; ordinata: boolean; fatta: boolean }[]): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${id}/cementi`, items);
  }

  updateOrderAccessori(id: number, items: { tipoId: number; ordinata: boolean; fatta: boolean }[]): Observable<unknown> {
    return this.http.put(`${this.baseUrl}/${id}/accessori`, items);
  }
}
