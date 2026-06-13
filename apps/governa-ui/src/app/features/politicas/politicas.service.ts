// ============================================================
// politicas.service.ts
//
// Consome GET /policies/:id e PATCH /policies/:id do governa-core
// e expõe estado reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Carregar uma política por id (loadPolitica)
//   - Salvar alterações (savePolitica) — chama PATCH, bumpa versão
//   - Controlar estados: loading, saving, error, sucesso
//   - Expor politica() como signal para o formulário
//
// Nota de arquitetura:
//   Usa coreBaseUrl (governa-core :3000) — endpoint /policies
//   serve pelo core (PolicyEngine ali já existia).
// ============================================================

import { computed, inject }                 from '@angular/core';
import { HttpClient }                       from '@angular/common/http';
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
}                                           from '@ngrx/signals';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { environment }                      from '@env/environment';
import type { Politica, PoliticaResponse, UpdatePoliticaDto } from '../../shared/models/politica.model';

// ── Estado ───────────────────────────────────────────────────

interface PoliticasState {
  politica:      Politica | null;
  loading:       boolean;
  saving:        boolean;
  error:         string | null;
  saveSuccess:   boolean;
}

const initialState: PoliticasState = {
  politica:    null,
  loading:     false,
  saving:      false,
  error:       null,
  saveSuccess: false,
};

// ── SignalStore ──────────────────────────────────────────────

export const PoliticasStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((store) => ({
    hasError:    computed(() => store.error() !== null),
    isLoaded:    computed(() => store.politica() !== null && !store.loading()),
    /** Nível atual — util para ocultar/exibir seções condicionais no form */
    nivelAtual:  computed(() => store.politica()?.autonomyLevel ?? null),
  })),

  withMethods((store, http = inject(HttpClient)) => ({

    /** Carrega política pelo id */
    loadPolitica(id: string): void {
      patchState(store, { loading: true, error: null, saveSuccess: false });

      http
        .get<PoliticaResponse>(`${environment.coreBaseUrl}/policies/${id}`)
        .pipe(
          tap((res) => patchState(store, { politica: res.data })),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.message ??
              /* istanbul ignore next */
              'Erro ao carregar política. Tente novamente.';
            patchState(store, { error: msg, politica: null });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { loading: false })),
        )
        .subscribe();
    },

    /** Salva alterações via PATCH — emite saveSuccess ao concluir */
    savePolitica(id: string, dto: UpdatePoliticaDto): void {
      patchState(store, { saving: true, error: null, saveSuccess: false });

      http
        .patch<PoliticaResponse>(`${environment.coreBaseUrl}/policies/${id}`, dto)
        .pipe(
          tap((res) => patchState(store, { politica: res.data, saveSuccess: true })),
          catchError((err) => {
            const msg =
              err?.error?.message ??
              err?.error?.issues?.[0]?.message ??
              err?.message ??
              /* istanbul ignore next */
              'Erro ao salvar política. Tente novamente.';
            patchState(store, { error: msg });
            return throwError(() => err);
          }),
          finalize(() => patchState(store, { saving: false })),
        )
        .subscribe();
    },

    clearError(): void {
      patchState(store, { error: null });
    },

    clearSaveSuccess(): void {
      patchState(store, { saveSuccess: false });
    },
  })),
);
