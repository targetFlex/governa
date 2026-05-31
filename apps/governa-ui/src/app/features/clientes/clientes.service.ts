// ============================================================
// clientes.service.ts
//
// Consome GET /clientes do governa-gateway e expõe estado
// reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Buscar lista de clientes com filtro e paginação
//   - Expor signals: clientes[], loading, error, total
//   - Método loadClientes(page?, pageSize?, filtro?) → dispara fetch
// ============================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { Cliente, ClientesResponse } from '../../shared/models/cliente.model';

// ── Estado do store ──────────────────────────────────────────

interface ClientesState {
  clientes: Cliente[];
  total: number;
  page: number;
  pageSize: number;
  filtro: string;
  loading: boolean;
  error: string | null;
}

const initialState: ClientesState = {
  clientes: [],
  total: 0,
  page: 1,
  pageSize: 20,
  filtro: '',
  loading: false,
  error: null,
};

// ── SignalStore ──────────────────────────────────────────────

export const ClientesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isEmpty: computed(() => !store.loading() && store.clientes().length === 0),
    hasError: computed(() => store.error() !== null),
    totalPages: computed(() => Math.ceil(store.total() / store.pageSize())),
    clientesAtivos: computed(() => store.clientes().filter((c) => c.ativo)),
  })),
  withMethods((store, http = inject(HttpClient)) => ({
    loadClientes(page = 1, pageSize = 20, filtro = ''): void {
      patchState(store, { loading: true, error: null, page, pageSize, filtro });

      let params = new HttpParams()
        .set('page', page)
        .set('pageSize', pageSize);

      if (filtro.trim()) {
        params = params.set('q', filtro.trim());
      }

      http
        .get<ClientesResponse>(`${environment.gatewayBaseUrl}/clientes`, { params })
        .pipe(
          tap((res) => patchState(store, { clientes: res.data, total: res.total })),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.message ??
              'Erro ao carregar clientes. Tente novamente.';
            patchState(store, { error: msg, clientes: [] });
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

@Injectable({ providedIn: 'root' })
export class ClientesService {
  readonly store = inject(ClientesStore);

  readonly clientes      = this.store.clientes;
  readonly loading       = this.store.loading;
  readonly error         = this.store.error;
  readonly total         = this.store.total;
  readonly isEmpty       = this.store.isEmpty;
  readonly hasError      = this.store.hasError;
  readonly totalPages    = this.store.totalPages;
  readonly clientesAtivos = this.store.clientesAtivos;

  loadClientes(page = 1, pageSize = 20, filtro = ''): void {
    this.store.loadClientes(page, pageSize, filtro);
  }

  clearError(): void {
    this.store.clearError();
  }
}
