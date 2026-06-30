// ============================================================
// notification-config.service.ts
//
// Consome GET /notifications/config e PUT /notifications/config
// do governa-core. Expõe estado reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Carregar configuração de notificação do tenant
//   - Salvar alterações parciais (PUT upsert no backend)
//   - Expor loading / saving / error para a UI
// ============================================================

import { inject, computed } from '@angular/core'
import { HttpClient }       from '@angular/common/http'
import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals'
import { catchError, finalize, tap, throwError } from 'rxjs'
import { environment } from '@env/environment'
import type {
  NotificationConfig,
  NotificationConfigPatch,
} from '../../shared/models/notification-config.model'

// ── Estado ────────────────────────────────────────────────────

interface NotificationConfigState {
  config:   NotificationConfig | null
  loading:  boolean
  saving:   boolean
  error:    string | null
}

const initialState: NotificationConfigState = {
  config:  null,
  loading: false,
  saving:  false,
  error:   null,
}

// ── SignalStore ───────────────────────────────────────────────

export const NotificationConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((state) => ({
    hasError:  computed(() => state.error() !== null),
    hasConfig: computed(() => state.config() !== null),
  })),

  withMethods((store, http = inject(HttpClient)) => {
    const BASE = `${environment.coreBaseUrl}/notifications/config`

    function loadConfig(): void {
      patchState(store, { loading: true, error: null })

      http.get<NotificationConfig>(BASE)
        .pipe(
          tap((config) => patchState(store, { config })),
          catchError((err) => {
            const status = (err as { status?: number }).status
            // 404 significa que ainda não há config — não é erro para o usuário
            if (status === 404) {
              patchState(store, { config: null })
              return throwError(() => err)
            }
            patchState(store, { error: err?.error?.error ?? 'Erro ao carregar configuração' })
            return throwError(() => err)
          }),
          finalize(() => patchState(store, { loading: false })),
        )
        .subscribe({ error: () => { /* já tratado acima */ } })
    }

    function saveConfig(patch: NotificationConfigPatch): void {
      patchState(store, { saving: true, error: null })

      http.put<NotificationConfig>(BASE, patch)
        .pipe(
          tap((config) => patchState(store, { config })),
          catchError((err) => {
            patchState(store, { error: err?.error?.error ?? 'Erro ao salvar configuração' })
            return throwError(() => err)
          }),
          finalize(() => patchState(store, { saving: false })),
        )
        .subscribe({ error: () => { /* já tratado acima */ } })
    }

    function clearError(): void {
      patchState(store, { error: null })
    }

    return { loadConfig, saveConfig, clearError }
  }),
)
