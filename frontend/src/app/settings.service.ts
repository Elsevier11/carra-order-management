import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  SqlServerConfigResponse,
  SqlServerConfigSavePayload,
  SqlServerTestResult,
} from './consegne.types';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/settings`;

  getSqlServerConfig(): Observable<SqlServerConfigResponse> {
    return this.http.get<SqlServerConfigResponse>(`${this.baseUrl}/sqlserver`);
  }

  saveSqlServerConfig(payload: SqlServerConfigSavePayload): Observable<{ ok: boolean }> {
    return this.http.put<{ ok: boolean }>(`${this.baseUrl}/sqlserver`, payload);
  }

  testSqlServerConnection(): Observable<SqlServerTestResult> {
    return this.http.post<SqlServerTestResult>(`${this.baseUrl}/sqlserver/test`, {});
  }
}
