// ============================================================
// agentes.service.ts
//
// Consome GET /agents, POST /agents/:id/pause e
// POST /agents/:id/activate do governa-core e expõe estado
// reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Carregar inventário de agentes do tenant autenticado
//   - Expor signals: agentes[], loading, error, total, filtroStatus
//   - Rastrear ações individuais em andamento (pause/ativar por id)
//   - Filtrar localmente por status (inventário tipicamente pequeno)
//
// Nota de arquitetura:
//   Usa coreBaseUrl (governa-core :3000) — não o gatewayBaseUrl
//   (:3100). O endpoint /agents só existe no core.
//   Tech debt registrado: clientes/pedidos deveriam também ser
//   servidos pelo core em vez do gateway diretamente.
// ============================================================

import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { EMPTY, catchError, finalize, tap, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { Agente, AgentStatus, AgentesResponse, CreateAgenteDto, UpdateAgenteDto } from '../../shared/models/agente.model';

// ── Estado do store ──────────────────────────────────────────

interface AgentesState {
  agentes:          Agente[];
  total:            number;
  loading:          boolean;
  error:            string | null;
  filtroStatus:     AgentStatus | 'TODOS';
  /** IDs de agentes com ação (pause/ativar) em andamento */
  acoesEmAndamento: string[];
  lastRefreshed:    Date | null;
  creating:         boolean;
  createError:      string | null;
  /** Agente recém-criado — não-null por um ciclo após POST /agents bem-sucedido */
  createdAgent:     Agente | null;
  updating:         boolean;
  updateError:      string | null;
  /** Agente recém-editado — não-null por um ciclo após PATCH /agents/:id bem-sucedido */
  updatedAgent:     Agente | null;
}

const initialState: AgentesState = {
  agentes:          [],
  total:            0,
  loading:          false,
  error:            null,
  filtroStatus:     'TODOS',
  acoesEmAndamento: [],
  lastRefreshed:    null,
  creating:         false,
  createError:      null,
  createdAgent:     null,
  updating:         false,
  updateError:      null,
  updatedAgent:     null,
};

// ── SignalStore ──────────────────────────────────────────────

export const AgentesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    isEmpty: computed(() => !store.loading() && store.agentes().length === 0),
    hasError: computed(() => store.error() !== null),

    /** Agentes filtrados pelo status selecionado nos chips */
    agentesFiltrados: computed(() => {
      const filtro = store.filtroStatus();
      return filtro === 'TODOS'
        ? store.agentes()
        : store.agentes().filter((a) => a.status === filtro);
    }),

    /** Contagem por status para os chips de filtro */
    contagemPorStatus: computed(() => {
      const agentes = store.agentes();
      return {
        TODOS:      agentes.length,
        ACTIVE:     agentes.filter((a) => a.status === 'ACTIVE').length,
        PAUSED:     agentes.filter((a) => a.status === 'PAUSED').length,
        SANDBOX:    agentes.filter((a) => a.status === 'SANDBOX').length,
        DEPRECATED: agentes.filter((a) => a.status === 'DEPRECATED').length,
      };
    }),
  })),

  withMethods((store, http = inject(HttpClient)) => ({

    /** Carrega inventário completo do tenant (sem paginação — inventário pequeno) */
    loadAgentes(): void {
      patchState(store, { loading: true, error: null });

      http
        .get<AgentesResponse>(`${environment.coreBaseUrl}/agents`)
        .pipe(
          tap((res) => patchState(store, { agentes: res.data, total: res.total, lastRefreshed: new Date() })),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.message ??
              /* istanbul ignore next */
              'Erro ao carregar agentes. Tente novamente.';
            patchState(store, { error: msg, agentes: [] });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loading: false })),
        )
        .subscribe();
    },

    /** Atualiza inventário silenciosamente (sem skeleton, sem propagar erros) */
    refreshAgentes(): void {
      http
        .get<AgentesResponse>(`${environment.coreBaseUrl}/agents`)
        .pipe(
          tap((res) =>
            patchState(store, { agentes: res.data, total: res.total, lastRefreshed: new Date() }),
          ),
          catchError(() => EMPTY),
        )
        .subscribe();
    },

    /** Pausa agente (ACTIVE → PAUSED) */
    pauseAgente(id: string): void {
      patchState(store, {
        acoesEmAndamento: [...store.acoesEmAndamento(), id],
      });

      http
        .post<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${id}/pause`, {})
        .pipe(
          tap((res) =>
            patchState(store, {
              agentes: store.agentes().map((a) =>
                a.id === id ? res.data : a,
              ),
            }),
          ),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.message ??
              /* istanbul ignore next */
              `Erro ao pausar agente ${id}.`;
            patchState(store, { error: msg });
            return throwError(() => err);
          }),
          finalize(() =>
            patchState(store, {
              acoesEmAndamento: store.acoesEmAndamento().filter((i) => i !== id),
            }),
          ),
        )
        .subscribe();
    },

    /** Ativa agente (PAUSED/SANDBOX → ACTIVE, requer policyId no backend) */
    activateAgente(id: string): void {
      patchState(store, {
        acoesEmAndamento: [...store.acoesEmAndamento(), id],
      });

      http
        .post<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${id}/activate`, {})
        .pipe(
          tap((res) =>
            patchState(store, {
              agentes: store.agentes().map((a) =>
                a.id === id ? res.data : a,
              ),
            }),
          ),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.message ??
              /* istanbul ignore next */
              `Erro ao ativar agente ${id}.`;
            patchState(store, { error: msg });
            return throwError(() => err);
          }),
          finalize(() =>
            patchState(store, {
              acoesEmAndamento: store.acoesEmAndamento().filter((i) => i !== id),
            }),
          ),
        )
        .subscribe();
    },

    /** Cria novo agente via POST /agents (status inicial: SANDBOX) */
    createAgente(dto: CreateAgenteDto): void {
      patchState(store, { creating: true, createError: null, createdAgent: null });

      http
        .post<{ data: Agente }>(`${environment.coreBaseUrl}/agents`, dto)
        .pipe(
          tap((res) =>
            patchState(store, {
              agentes:      [res.data, ...store.agentes()],
              total:        store.total() + 1,
              createdAgent: res.data,
            }),
          ),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.error?.issues?.[0]?.message ??
              err?.message ??
              /* istanbul ignore next */
              'Erro ao criar agente. Tente novamente.';
            patchState(store, { createError: msg });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { creating: false })),
        )
        .subscribe();
    },

    setFiltroStatus(filtro: AgentStatus | 'TODOS'): void {
      patchState(store, { filtroStatus: filtro });
    },

    clearError(): void {
      patchState(store, { error: null });
    },

    clearCreateError(): void {
      patchState(store, { createError: null });
    },

    clearCreatedAgent(): void {
      patchState(store, { createdAgent: null });
    },

    /** Edita agente via PATCH /agents/:id */
    updateAgente(id: string, dto: UpdateAgenteDto): void {
      patchState(store, { updating: true, updateError: null, updatedAgent: null });

      http
        .patch<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${id}`, dto)
        .pipe(
          tap((res) =>
            patchState(store, {
              agentes:      store.agentes().map((a) => (a.id === id ? res.data : a)),
              updatedAgent: res.data,
            }),
          ),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.error?.issues?.[0]?.message ??
              err?.message ??
              /* istanbul ignore next */
              'Erro ao editar agente. Tente novamente.';
            patchState(store, { updateError: msg });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { updating: false })),
        )
        .subscribe();
    },

    clearUpdateError(): void {
      patchState(store, { updateError: null });
    },

    clearUpdatedAgent(): void {
      patchState(store, { updatedAgent: null });
    },
  })),
);

// ── Service facade ───────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AgentesService {
  readonly store = inject(AgentesStore);

  readonly agentes           = this.store.agentes;
  readonly loading           = this.store.loading;
  readonly error             = this.store.error;
  readonly total             = this.store.total;
  readonly filtroStatus      = this.store.filtroStatus;
  readonly isEmpty           = this.store.isEmpty;
  readonly hasError          = this.store.hasError;
  readonly agentesFiltrados  = this.store.agentesFiltrados;
  readonly contagemPorStatus = this.store.contagemPorStatus;
  readonly acoesEmAndamento  = this.store.acoesEmAndamento;
  readonly lastRefreshed     = this.store.lastRefreshed;
  readonly creating          = this.store.creating;
  readonly createError       = this.store.createError;
  readonly createdAgent      = this.store.createdAgent;
  readonly updating          = this.store.updating;
  readonly updateError       = this.store.updateError;
  readonly updatedAgent      = this.store.updatedAgent;

  loadAgentes():                              void { this.store.loadAgentes(); }
  refreshAgentes():                           void { this.store.refreshAgentes(); }
  pauseAgente(id: string):                    void { this.store.pauseAgente(id); }
  activateAgente(id: string):                 void { this.store.activateAgente(id); }
  createAgente(dto: CreateAgenteDto):         void { this.store.createAgente(dto); }
  updateAgente(id: string, dto: UpdateAgenteDto): void { this.store.updateAgente(id, dto); }
  setFiltroStatus(f: AgentStatus | 'TODOS'):  void { this.store.setFiltroStatus(f); }
  clearError():                               void { this.store.clearError(); }
  clearCreateError():                         void { this.store.clearCreateError(); }
  clearCreatedAgent():                        void { this.store.clearCreatedAgent(); }
  clearUpdateError():                         void { this.store.clearUpdateError(); }
  clearUpdatedAgent():                        void { this.store.clearUpdatedAgent(); }
}
