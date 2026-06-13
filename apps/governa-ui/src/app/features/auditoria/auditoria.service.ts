// ============================================================
// auditoria.service.ts
//
// Consome GET /audit-events e GET /audit-events/export
// do governa-core e expõe estado reativo via NGRX SignalStore.
//
// Responsabilidades (SRP):
//   - Carregar eventos paginados com filtros
//   - Exportar lista completa (para geração de PDF via print)
//   - Expor signals: eventos[], total, page, limit, loading, error
//   - Gerenciar estado de filtros (agentId, from, to, outcome)
//
// Arquitetura hexagonal: depende de HttpClient (porta) —
// sem lógica de negócio, sem formatação de datas no service.
// ============================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  AuditEvent,
  AuditEventPage,
  AuditFiltros,
  Outcome,
} from '../../shared/models/auditoria.model';

// ── Estado do store ──────────────────────────────────────────

interface AuditoriaState {
  eventos:         AuditEvent[];
  total:           number;
  page:            number;
  limit:           number;
  loading:         boolean;
  loadingExport:   boolean;
  error:           string | null;
  filtros:         AuditFiltros;
}

const LIMIT_PADRAO = 20;

const initialState: AuditoriaState = {
  eventos:       [],
  total:         0,
  page:          1,
  limit:         LIMIT_PADRAO,
  loading:       false,
  loadingExport: false,
  error:         null,
  filtros: {
    agentId: '',
    from:    '',
    to:      '',
    outcome: '',
    page:    1,
    limit:   LIMIT_PADRAO,
  },
};

// ── SignalStore ──────────────────────────────────────────────

export const AuditoriaStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),

  withComputed((state) => ({
    hasError:   computed(() => state.error() !== null),
    isEmpty:    computed(() => !state.loading() && state.eventos().length === 0),
    totalPages: computed(() => Math.max(1, Math.ceil(state.total() / state.limit()))),
  })),

  withMethods((store) => {
    const http = inject(HttpClient);
    const base = `${environment.coreBaseUrl}/audit-events`;

    function buildParams(filtros: AuditFiltros, page?: number): HttpParams {
      let p = new HttpParams()
        .set('page',  String(page ?? filtros.page))
        .set('limit', String(filtros.limit));
      if (filtros.agentId) p = p.set('agentId', filtros.agentId);
      if (filtros.from)    p = p.set('from',    `${filtros.from}T00:00:00Z`);
      if (filtros.to)      p = p.set('to',      `${filtros.to}T23:59:59Z`);
      if (filtros.outcome) p = p.set('outcome', filtros.outcome);
      return p;
    }

    return {
      // ── Carrega eventos com filtros/paginação ────────────────
      loadEventos(filtros?: Partial<AuditFiltros>, page?: number): void {
        const filtrosAtuais = { ...store.filtros(), ...filtros };
        const paginaAtual   = page ?? filtrosAtuais.page;

        patchState(store, {
          loading: true,
          error:   null,
          filtros: { ...filtrosAtuais, page: paginaAtual },
        });

        http
          .get<AuditEventPage>(base, { params: buildParams(filtrosAtuais, paginaAtual) })
          .pipe(
            tap((resp) => {
              patchState(store, {
                eventos: resp.data,
                total:   resp.total,
                page:    resp.page,
                limit:   resp.limit,
              });
            }),
            catchError((err) => {
              patchState(store, { error: err?.message ?? 'Erro ao carregar eventos.' });
              return throwError(() => err);
            }),
            finalize(() => patchState(store, { loading: false })),
          )
          .subscribe();
      },

      // ── Exporta todos os eventos e abre janela de impressão ──
      exportarPDF(): void {
        const filtros = store.filtros();

        let p = new HttpParams();
        if (filtros.agentId) p = p.set('agentId', filtros.agentId);
        if (filtros.from)    p = p.set('from',    `${filtros.from}T00:00:00Z`);
        if (filtros.to)      p = p.set('to',      `${filtros.to}T23:59:59Z`);
        if (filtros.outcome) p = p.set('outcome', filtros.outcome);

        patchState(store, { loadingExport: true, error: null });

        http
          .get<{ data: AuditEvent[]; total: number }>(`${base}/export`, { params: p })
          .pipe(
            tap((resp) => abrirJanelaPrint(resp.data)),
            catchError((err) => {
              patchState(store, { error: err?.message ?? 'Erro ao exportar.' });
              return throwError(() => err);
            }),
            finalize(() => patchState(store, { loadingExport: false })),
          )
          .subscribe();
      },

      // ── Limpa filtros e recarrega ────────────────────────────
      limparFiltros(): void {
        patchState(store, { filtros: { ...initialState.filtros } });
      },

      // ── Limpa erro ───────────────────────────────────────────
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);

// ─── Geração de HTML para impressão ───────────────────────────────────────────

function abrirJanelaPrint(eventos: AuditEvent[]): void {
  const linhas = eventos
    .map(
      (e) => `
      <tr>
        <td>${formatDate(e.createdAt)}</td>
        <td>${e.agentId.slice(0, 8)}…</td>
        <td>${e.action}</td>
        <td>${e.outcome}</td>
        <td>${e.latencyMs} ms</td>
        <td>${e.inputSummary}</td>
        <td>${e.legalBasis}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Audit Trail — Governa Agentes</title>
  <style>
    @page { margin: 15mm; }
    body  { font-family: Arial, sans-serif; font-size: 10px; color: #111; }
    h1    { font-size: 14px; margin-bottom: 4px; }
    p.sub { font-size: 9px; color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th    { background: #1a3a5c; color: #fff; padding: 4px 6px; text-align: left; font-size: 9px; }
    td    { padding: 3px 6px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
    tr:nth-child(even) td { background: #f7f9fb; }
    .badge-EXECUTADO  { color: #15803d; font-weight: bold; }
    .badge-BLOQUEADO  { color: #b91c1c; font-weight: bold; }
    .badge-AGUARDANDO { color: #92400e; font-weight: bold; }
    .badge-ESCALADO   { color: #9a3412; font-weight: bold; }
    .badge-ERRO       { color: #374151; font-weight: bold; }
    tfoot td { font-size: 8px; color: #777; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>Audit Trail — Governa Agentes</h1>
  <p class="sub">Exportado em: ${formatDate(new Date().toISOString())} | Total de registros: ${eventos.length} | Retenção: 5 anos (LGPD art. 16)</p>
  <table>
    <thead>
      <tr>
        <th>Data/Hora</th>
        <th>Agente (ID)</th>
        <th>Ação</th>
        <th>Desfecho</th>
        <th>Latência</th>
        <th>Resumo da entrada</th>
        <th>Base legal</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    <tfoot>
      <tr>
        <td colspan="7">
          Documento gerado automaticamente pelo sistema Governa Agentes.
          Hash de integridade encadeada (SHA-256) verificável via API /audit-events.
        </td>
      </tr>
    </tfoot>
  </table>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}
