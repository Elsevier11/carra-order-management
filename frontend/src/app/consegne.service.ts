import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { AttachmentRecord, AuditLogResponse, BoardColumn, ConsegnaFilters, ConsegneResponse, ConsegnaStats, FilterOptions, OrderEvent } from './consegne.types';

@Injectable({ providedIn: 'root' })
export class ConsegneService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/consegne`;
  private readonly auditUrl = `${environment.apiUrl}/audit`;

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

  board(): Observable<{ columns: BoardColumn[] }> {
    return this.http.get<{ columns: BoardColumn[] }>(`${this.baseUrl}/board`);
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
}
