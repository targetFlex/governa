// ============================================================
// cliente-pii.service.ts
//
// Reidentificação sob demanda de PII de cliente — consome
// GET /clientes/:clienteId/reidentificar do governa-core.
//
// Responsabilidades (SRP):
//   - Buscar PII em texto claro (nome/documento/email/telefone)
//     de UM cliente, só quando o usuário explicitamente pede
//     ("Revelar dados") — nunca em bulk na listagem.
//   - Cachear por sessão (clienteId+loja) para evitar reconsultas
//     repetidas do mesmo card — cada reidentificação gera um
//     AuditEvent no core (LGPD), então evitar redundância.
// ============================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '@env/environment';
import { ClientePii, ClientePiiResponse } from '../models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClientePiiService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<ClientePii>>();

  /** Resolve PII em texto claro — cacheado por (clienteId, loja) na sessão. */
  reveal(clienteId: string, loja: string): Observable<ClientePii> {
    const key = `${clienteId}::${loja}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const request$ = this.http
      .get<ClientePiiResponse>(`${environment.coreBaseUrl}/clientes/${clienteId}/reidentificar`, {
        params: { loja },
      })
      .pipe(
        map((res) => res.data),
        tap({
          // Nunca cachear resposta de erro — permite retry manual.
          error: () => this.cache.delete(key),
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.cache.set(key, request$);
    return request$;
  }

  /** Limpa o cache — uso em testes ou logout. */
  clear(): void {
    this.cache.clear();
  }
}
