import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { BoardColumn, ConsegnaFilters, ConsegneResponse, ConsegnaStats, FilterOptions, OrderEvent } from './consegne.types';

@Injectable({ providedIn: 'root' })
export class ConsegneService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/consegne`;

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
