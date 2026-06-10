// ============================================================
// pedidos.service.ts
//
// Consome GET /pedidos do governa-gateway e expõe estado
// reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Buscar lista de pedidos com paginação
//   - Expor signals: pedidos[], loading, error, total
//   - Método loadPedidos(page?, pageSize?) → dispara fetch
// ============================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { Pedido, PedidosResponse } from '../../shared/models/pedido.model';

// ── Estado do store ──────────────────────────────────────────

interface PedidosState {
  pedidos: Pedido[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
}

const initialState: PedidosState = {
  pedidos: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,
};

// ── SignalStore ──────────────────────────────────────────────

export const PedidosStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isEmpty: computed(() => !store.loading() && store.pedidos().length === 0),
    hasError: computed(() => store.error() !== null),
    totalPages: computed(() => Math.ceil(store.total() / store.pageSize())),
  })),
  withMethods((store, http = inject(HttpClient)) => ({
    loadPedidos(page = 1, pageSize = 20): void {
      patchState(store, { loading: true, error: null, page, pageSize });

      const params = new HttpParams()
        .set('page', page)
        .set('pageSize', pageSize);

      http
        .get<PedidosResponse>(`${environment.gatewayBaseUrl}/pedidos`, { params })
        .pipe(
          tap((res) => patchState(store, { pedidos: res.data, total: res.total })),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.message ??
              /* istanbul ignore next -- fallback para erros não-HTTP; HttpErrorResponse.message é sempre definida */
              'Erro ao carregar pedidos. Tente novamente.';
            patchState(store, { error: msg, pedidos: [] });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loading: false })),
        )
        .subscribe();
    },

    clearError(): void {
      patchState(store, { error: null });
    },
  })),
);

// ── Service facade (injetável via DI) ────────────────────────
// Expõe o store como service para componentes que preferirem DI
// sem importar o token do store diretamente.

@Injectable({ providedIn: 'root' })
export class PedidosService {
  readonly store = inject(PedidosStore);

  readonly pedidos  = this.store.pedidos;
  readonly loading  = this.store.loading;
  readonly error    = this.store.error;
  readonly total    = this.store.total;
  readonly isEmpty  = this.store.isEmpty;
  readonly hasError = this.store.hasError;
  readonly totalPages = this.store.totalPages;

  loadPedidos(page = 1, pageSize = 20): void {
    this.store.loadPedidos(page, pageSize);
  }

  clearError(): void {
    this.store.clearError();
  }
}
