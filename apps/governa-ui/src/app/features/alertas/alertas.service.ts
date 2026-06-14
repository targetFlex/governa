// ============================================================
// alertas.service.ts
//
// Consome GET /alerts, PATCH /alerts/:id/status, GET/PUT /alerts/thresholds
// e GET /alerts/stream (SSE) do governa-core.
// Expõe estado reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Carregar alertas paginados com filtros
//   - Atualizar status de um alerta (acknowledge / resolve)
//   - Carregar e salvar thresholds de configuração
//   - Conectar ao feed SSE e adicionar alertas recebidos ao estado
//   - Desconectar SSE no destroy do store
//
// Hexagonal: depende de HttpClient (porta) e EventSource (nativo).
// Sem lógica de negócio — apenas orquestração de I/O e estado.
// ============================================================

import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams }         from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { computed } from '@angular/core';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import {
  Alert,
  AlertPage,
  AlertStatus,
  AlertThreshold,
  AlertasFiltros,
  AlertKind,
} from '../../shared/models/alertas.model';

// ── Estado do store ──────────────────────────────────────────

interface AlertasState {
  alertas:         Alert[];
  total:           number;
  page:            number;
  limit:           number;
  loading:         boolean;
  loadingStatus:   boolean;   // loading para patch de status
  loadingThresh:   boolean;   // loading de thresholds
  error:           string | null;
  filtros:         AlertasFiltros;
  thresholds:      AlertThreshold[];
  streamConnected: boolean;
}

const LIMIT_PADRAO = 20;

const initialState: AlertasState = {
  alertas:         [],
  total:           0,
  page:            1,
  limit:           LIMIT_PADRAO,
  loading:         false,
  loadingStatus:   false,
  loadingThresh:   false,
  error:           null,
  filtros: {
    agentId: '',
    kind:    '',
    status:  '',
    from:    '',
    to:      '',
    page:    1,
    limit:   LIMIT_PADRAO,
  },
  thresholds:      [],
  streamConnected: false,
};

// ── SignalStore ──────────────────────────────────────────────

export const AlertasStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((state) => ({
    hasError:      computed(() => state.error() !== null),
    isEmpty:       computed(() => !state.loading() && state.alertas().length === 0),
    totalPages:    computed(() => Math.max(1, Math.ceil(state.total() / state.limit()))),
    openCount:     computed(() => state.alertas().filter((a) => a.status === 'OPEN').length),
  })),

  withMethods((store, http = inject(HttpClient)) => {
    const BASE = `${environment.apiUrl}/alerts`;

    // ── SSE ──────────────────────────────────────────────────

    let eventSource: EventSource | null = null;

    function conectarStream(): void {
      if (eventSource) return;  // já conectado

      const token = localStorage.getItem('governa_token') ?? '';
      // EventSource não suporta headers nativamente — passa token via query param
      const url   = `${BASE}/stream?token=${encodeURIComponent(token)}`;
      eventSource  = new EventSource(url);

      patchState(store, { streamConnected: true });

      eventSource.addEventListener('alert', (e: MessageEvent) => {
        try {
          const alerta: Alert = JSON.parse(e.data as string);
          patchState(store, (s) => ({
            alertas: [alerta, ...s.alertas],
            total:   s.total + 1,
          }));
        } catch { /* ignore parse error */ }
      });

      eventSource.onerror = () => {
        patchState(store, { streamConnected: false });
        // reconecta em 10s
        setTimeout(() => {
          eventSource?.close();
          eventSource = null;
          conectarStream();
        }, 10_000);
      };
    }

    function desconectarStream(): void {
      eventSource?.close();
      eventSource = null;
      patchState(store, { streamConnected: false });
    }

    // ── HTTP methods ──────────────────────────────────────────

    function buildParams(filtros: AlertasFiltros): HttpParams {
      let params = new HttpParams();
      if (filtros.agentId) params = params.set('agentId', filtros.agentId);
      if (filtros.kind)    params = params.set('kind',    filtros.kind);
      if (filtros.status)  params = params.set('status',  filtros.status);
      if (filtros.from)    params = params.set('from',    filtros.from);
      if (filtros.to)      params = params.set('to',      filtros.to);
      params = params.set('page',  String(filtros.page));
      params = params.set('limit', String(filtros.limit));
      return params;
    }

    function loadAlertas(filtros?: Partial<AlertasFiltros>): void {
      const merged: AlertasFiltros = { ...store.filtros(), ...filtros };
      patchState(store, { loading: true, error: null, filtros: merged });

      http.get<AlertPage>(BASE, { params: buildParams(merged) })
        .pipe(
          tap((page) =>
            patchState(store, {
              alertas: page.data,
              total:   page.total,
              page:    page.page,
              limit:   page.limit,
            }),
          ),
          catchError((err) => {
            patchState(store, { error: err?.error?.error ?? 'Erro ao carregar alertas' });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loading: false })),
        )
        .subscribe();
    }

    function atualizarStatus(id: string, status: AlertStatus): void {
      patchState(store, { loadingStatus: true, error: null });

      http.patch<Alert>(`${BASE}/${id}/status`, { status })
        .pipe(
          tap((updated) =>
            patchState(store, (s) => ({
              alertas: s.alertas.map((a) => (a.id === updated.id ? updated : a)),
            })),
          ),
          catchError((err) => {
            patchState(store, { error: err?.error?.error ?? 'Erro ao atualizar status' });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loadingStatus: false })),
        )
        .subscribe();
    }

    function loadThresholds(): void {
      patchState(store, { loadingThresh: true, error: null });

      http.get<{ data: AlertThreshold[] }>(`${BASE}/thresholds`)
        .pipe(
          tap((res) => patchState(store, { thresholds: res.data })),
          catchError((err) => {
            patchState(store, { error: err?.error?.error ?? 'Erro ao carregar thresholds' });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loadingThresh: false })),
        )
        .subscribe();
    }

    function salvarThreshold(kind: AlertKind, patch: Partial<Omit<AlertThreshold, 'id' | 'tenantId' | 'kind' | 'updatedAt'>>): void {
      patchState(store, { loadingThresh: true, error: null });

      http.put<AlertThreshold>(`${BASE}/thresholds/${kind}`, patch)
        .pipe(
          tap((updated) =>
            patchState(store, (s) => ({
              thresholds: s.thresholds.map((t) => (t.kind === updated.kind ? updated : t)),
            })),
          ),
          catchError((err) => {
            patchState(store, { error: err?.error?.error ?? 'Erro ao salvar threshold' });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loadingThresh: false })),
        )
        .subscribe();
    }

    function limparFiltros(): void {
      patchState(store, { filtros: { ...initialState.filtros } });
      loadAlertas({ ...initialState.filtros });
    }

    function clearError(): void {
      patchState(store, { error: null });
    }

    return {
      loadAlertas,
      atualizarStatus,
      loadThresholds,
      salvarThreshold,
      limparFiltros,
      clearError,
      conectarStream,
      desconectarStream,
    };
  }),
);
