import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AgentesResponse } from '../../shared/models/agente.model';
import { AlertPage } from '../../shared/models/alertas.model';
import { AuditEventPage } from '../../shared/models/auditoria.model';

export interface CockpitData {
  agentes:    AgentesResponse;
  alertas:    AlertPage;
  decisoes:   AuditEventPage;
  bloqueados: AuditEventPage;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  loadCockpit(): Observable<CockpitData> {
    const CORE = environment.coreBaseUrl;
    return forkJoin({
      agentes: this.http.get<AgentesResponse>(`${CORE}/agents`),
      alertas: this.http.get<AlertPage>(`${CORE}/alerts`, {
        params: new HttpParams({ fromObject: { status: 'OPEN', limit: '5', page: '1' } }),
      }),
      decisoes: this.http.get<AuditEventPage>(`${CORE}/audit-events`, {
        params: new HttpParams({ fromObject: { limit: '5', page: '1' } }),
      }),
      bloqueados: this.http.get<AuditEventPage>(`${CORE}/audit-events`, {
        params: new HttpParams({ fromObject: { outcome: 'BLOQUEADO', limit: '1', page: '1' } }),
      }),
    });
  }
}
