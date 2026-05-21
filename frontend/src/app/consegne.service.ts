import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { AppUserRecord, AttachmentRecord, AuditLogResponse, BoardResponse, CommercialeRecord, ConsegnaFilters, ConsegneResponse, ConsegnaStats, FilterOptions, OrderEvent, ResponsabileRecord } from './consegne.types';

@Injectable({ providedIn: 'root' })
export class ConsegneService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/consegne`;
  private readonly auditUrl = `${environment.apiUrl}/audit`;
  private readonly usersUrl = `${environment.apiUrl}/users`;
  private readonly commercialiUrl = `${environment.apiUrl}/commerciali`;
  private readonly responsabiliUrl = `${environment.apiUrl}/responsabili`;

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

  createUser(payload: { username: string; role: 'admin' | 'operativo' | 'lettura'; password: string; isActive: boolean }): Observable<AppUserRecord> {
    return this.http.post<AppUserRecord>(this.usersUrl, payload);
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
}
