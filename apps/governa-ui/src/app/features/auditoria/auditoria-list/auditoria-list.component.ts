// ============================================================
// auditoria-list.component.ts
//
// Tela de audit trail (/auditoria) — E4.4.
//
// Responsabilidades (SRP):
//   - Carregar eventos via AuditoriaStore.loadEventos() no ngOnInit
//   - Renderizar filtros (agentId, from, to, outcome)
//   - Renderizar tabela de eventos paginada
//   - Botão de exportação PDF (abre janela de impressão)
//   - Estados: loading / error / empty / lista
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="status" no loading e empty state
//   - role="alert" no banner de erro (leitura imediata pelo SR)
//   - aria-live="polite" na região da tabela
//   - aria-label descritivo em cada botão
//   - caption na <table> para leitores de tela
// ============================================================

import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }  from '@angular/forms';
import { AuditoriaStore } from '../auditoria.service';
import {
  OUTCOMES,
  OUTCOME_LABELS,
  OUTCOME_CSS,
  Outcome,
} from '../../../shared/models/auditoria.model';
import { GovInputComponent } from '../../../shared/ui/input/gov-input.component';
import { GovSelectComponent, SelectOption } from '../../../shared/ui/select/gov-select.component';
import { GovButtonComponent } from '../../../shared/ui/button/gov-button.component';

@Component({
  selector: 'app-auditoria-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, GovInputComponent, GovSelectComponent, GovButtonComponent],
  template: `
    <section class="auditoria" aria-label="Audit trail de eventos">

      <!-- ── Cabeçalho ──────────────────────────────────────── -->
      <header class="auditoria__header">
        <div class="auditoria__header-texto">
          <h1 class="auditoria__titulo">Audit Trail</h1>
          <p class="auditoria__subtitulo">
            Registro imutável de todas as decisões dos agentes. Retenção: 5 anos (LGPD art. 16).
          </p>
        </div>
        <gov-button
          [loading]="store.loadingExport()"
          [disabled]="store.loadingExport() || store.loading()"
          ariaLabel="Exportar audit trail como PDF"
          (clicked)="exportarPDF()"
        >⬇ Exportar PDF</gov-button>
      </header>

      <!-- ── Banner de erro ─────────────────────────────────── -->
      @if (store.hasError()) {
        <div class="auditoria__erro" role="alert">
          <span>{{ store.error() }}</span>
          <gov-button variant="danger" size="sm" ariaLabel="Tentar novamente" (clicked)="retry()">
            Tentar novamente
          </gov-button>
          <gov-button variant="ghost" size="sm" ariaLabel="Fechar mensagem de erro" (clicked)="store.clearError()">
            ✕
          </gov-button>
        </div>
      }

      <!-- ── Filtros ────────────────────────────────────────── -->
      <form class="auditoria__filtros" aria-label="Filtros do audit trail" (ngSubmit)="aplicarFiltros()">
        <gov-input
          label="Agente (UUID)"
          type="text"
          placeholder="ex: 00000000-…"
          [(ngModel)]="agentId"
          name="agentId"
        />
        <gov-input
          label="De"
          type="date"
          [(ngModel)]="from"
          name="from"
        />
        <gov-input
          label="Até"
          type="date"
          [(ngModel)]="to"
          name="to"
        />
        <gov-select
          label="Desfecho"
          [(ngModel)]="outcome"
          name="outcome"
          placeholder="Todos"
          [options]="outcomeOptions"
        />
        <div class="auditoria__filtro-acoes">
          <gov-button type="submit" ariaLabel="Aplicar filtros">Filtrar</gov-button>
          <gov-button variant="secondary" ariaLabel="Limpar filtros" (clicked)="limparFiltros()">Limpar</gov-button>
        </div>
      </form>

      <!-- ── Loading ────────────────────────────────────────── -->
      @if (store.loading()) {
        <div class="auditoria__loading" role="status" aria-live="polite">
          <div class="auditoria__skeleton auditoria__skeleton--header"></div>
          @for (i of skeletons; track i) {
            <div class="auditoria__skeleton auditoria__skeleton--row"></div>
          }
          <span class="sr-only">Carregando eventos de auditoria…</span>
        </div>
      }

      <!-- ── Empty state ────────────────────────────────────── -->
      @if (store.isEmpty() && !store.hasError()) {
        <div class="auditoria__empty" role="status">
          <p class="auditoria__empty-msg">Nenhum evento encontrado para os filtros selecionados.</p>
          <gov-button variant="secondary" ariaLabel="Limpar filtros e recarregar" (clicked)="limparFiltros()">
            Limpar filtros
          </gov-button>
        </div>
      }

      <!-- ── Tabela de eventos ───────────────────────────────── -->
      @if (!store.loading() && store.eventos().length > 0) {
        <div class="auditoria__tabela-wrapper" aria-live="polite">
          <table class="auditoria__tabela" aria-label="Eventos de auditoria">
            <caption class="sr-only">
              {{ store.total() }} eventos encontrados, exibindo página {{ store.page() }} de {{ store.totalPages() }}.
            </caption>
            <thead>
              <tr>
                <th scope="col">Data/Hora</th>
                <th scope="col">Agente</th>
                <th scope="col">Ação</th>
                <th scope="col">Desfecho</th>
                <th scope="col">Latência</th>
                <th scope="col">Resumo</th>
                <th scope="col">Base legal</th>
              </tr>
            </thead>
            <tbody>
              @for (evento of store.eventos(); track evento.id) {
                <tr class="auditoria__row">
                  <td class="auditoria__col-data">{{ formatDate(evento.createdAt) }}</td>
                  <td class="auditoria__col-agente" title="{{ evento.agentId }}">
                    {{ evento.agentId.slice(0, 8) }}…
                  </td>
                  <td class="auditoria__col-acao">{{ evento.action }}</td>
                  <td class="auditoria__col-outcome">
                    <span
                      class="auditoria__badge {{ outcomeCss(evento.outcome) }}"
                      [attr.aria-label]="'Desfecho: ' + outcomeLabel(evento.outcome)"
                    >
                      {{ outcomeLabel(evento.outcome) }}
                    </span>
                  </td>
                  <td class="auditoria__col-latencia">{{ evento.latencyMs }} ms</td>
                  <td class="auditoria__col-resumo" title="{{ evento.inputSummary }}">
                    {{ truncar(evento.inputSummary, 60) }}
                  </td>
                  <td class="auditoria__col-legal">{{ evento.legalBasis }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- ── Paginação ──────────────────────────────────────── -->
        <nav class="auditoria__paginacao" aria-label="Navegação de páginas">
          <gov-button variant="secondary" size="sm" [disabled]="store.page() <= 1"
            ariaLabel="Página anterior" (clicked)="irParaPagina(store.page() - 1)">
            ‹ Anterior
          </gov-button>
          <span class="auditoria__pag-info" aria-current="page">
            Página {{ store.page() }} de {{ store.totalPages() }} — {{ store.total() }} eventos
          </span>
          <gov-button variant="secondary" size="sm" [disabled]="store.page() >= store.totalPages()"
            ariaLabel="Próxima página" (clicked)="irParaPagina(store.page() + 1)">
            Próxima ›
          </gov-button>
        </nav>
      }
    </section>
  `,
  styles: [`
    .auditoria {
      padding: var(--gov-spacing-lg, 24px);
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ── Cabeçalho ─────────────────────────────────────────── */
    .auditoria__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--gov-spacing-md, 16px);
      gap: var(--gov-spacing-md, 16px);
    }

    .auditoria__titulo {
      font-size: var(--gov-font-size-xl, 1.5rem);
      font-weight: 700;
      color: var(--gov-color-text-primary, #1a1a2e);
      margin: 0 0 4px;
    }

    .auditoria__subtitulo {
      font-size: var(--gov-font-size-sm, 0.875rem);
      color: var(--gov-color-text-secondary, #6b7280);
      margin: 0;
    }

    /* ── Botão export ──────────────────────────────────────── */
    .auditoria__btn-export {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: var(--gov-color-primary, #1a3a5c);
      color: #fff;
      border: none;
      border-radius: var(--gov-radius, 6px);
      font-size: var(--gov-font-size-sm, 0.875rem);
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: opacity 0.15s;
    }

    .auditoria__btn-export:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .auditoria__btn-export-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Erro ──────────────────────────────────────────────── */
    .auditoria__erro {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--gov-color-error-bg, #fef2f2);
      border: 1px solid var(--gov-color-error-border, #fca5a5);
      border-radius: var(--gov-radius, 6px);
      color: var(--gov-color-error, #b91c1c);
      font-size: var(--gov-font-size-sm, 0.875rem);
      margin-bottom: 16px;
    }

    .auditoria__erro-retry,
    .auditoria__erro-fechar {
      margin-left: auto;
      background: none;
      border: 1px solid currentColor;
      border-radius: 4px;
      color: inherit;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 0.8rem;
    }

    /* ── Filtros ───────────────────────────────────────────── */
    .auditoria__filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      padding: 16px;
      background: var(--gov-color-surface, #f8fafc);
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: var(--gov-radius, 6px);
      margin-bottom: 20px;
    }

    .auditoria__filtro-campo {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1 1 180px;
    }

    .auditoria__label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--gov-color-text-secondary, #6b7280);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .auditoria__input,
    .auditoria__select {
      padding: 8px 10px;
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: 4px;
      font-size: 0.875rem;
      color: var(--gov-color-text-primary, #1a1a2e);
      background: #fff;
    }

    .auditoria__input:focus,
    .auditoria__select:focus {
      outline: 2px solid var(--gov-color-primary, #1a3a5c);
      outline-offset: 1px;
    }

    .auditoria__filtro-acoes {
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex: 0 0 auto;
    }

    .auditoria__btn-filtrar,
    .auditoria__btn-limpar {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--gov-color-primary, #1a3a5c);
    }

    .auditoria__btn-filtrar {
      background: var(--gov-color-primary, #1a3a5c);
      color: #fff;
    }

    .auditoria__btn-limpar {
      background: transparent;
      color: var(--gov-color-primary, #1a3a5c);
    }

    /* ── Loading skeletons ─────────────────────────────────── */
    .auditoria__loading { padding: 8px 0; }

    .auditoria__skeleton {
      background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .auditoria__skeleton--header { height: 40px; width: 100%; }
    .auditoria__skeleton--row    { height: 52px; width: 100%; }

    @keyframes shimmer { to { background-position: -200% 0; } }

    /* ── Empty ─────────────────────────────────────────────── */
    .auditoria__empty {
      text-align: center;
      padding: 48px 24px;
      color: var(--gov-color-text-secondary, #6b7280);
    }

    .auditoria__empty-msg { margin-bottom: 16px; font-size: 0.9rem; }

    /* ── Tabela ────────────────────────────────────────────── */
    .auditoria__tabela-wrapper {
      overflow-x: auto;
      border: 1px solid var(--gov-color-border, #e2e8f0);
      border-radius: var(--gov-radius, 6px);
      margin-bottom: 16px;
    }

    .auditoria__tabela {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .auditoria__tabela thead th {
      background: var(--gov-color-primary, #1a3a5c);
      color: #fff;
      padding: 10px 12px;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .auditoria__row td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--gov-color-border, #e2e8f0);
      vertical-align: top;
      color: var(--gov-color-text-primary, #1a1a2e);
    }

    .auditoria__row:last-child td { border-bottom: none; }
    .auditoria__row:nth-child(even) td { background: var(--gov-color-surface, #f8fafc); }

    .auditoria__col-data    { white-space: nowrap; font-size: 0.8rem; color: var(--gov-color-text-secondary, #6b7280); }
    .auditoria__col-agente  { font-family: monospace; font-size: 0.8rem; }
    .auditoria__col-latencia { text-align: right; white-space: nowrap; }
    .auditoria__col-resumo  { max-width: 220px; word-break: break-word; }

    /* ── Badges de outcome ─────────────────────────────────── */
    .auditoria__badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .badge--verde    { background: #dcfce7; color: #15803d; }
    .badge--vermelho { background: #fee2e2; color: #b91c1c; }
    .badge--amarelo  { background: #fef9c3; color: #92400e; }
    .badge--laranja  { background: #ffedd5; color: #9a3412; }
    .badge--cinza    { background: #f3f4f6; color: #374151; }

    /* ── Paginação ─────────────────────────────────────────── */
    .auditoria__paginacao {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    .auditoria__pag-btn {
      padding: 6px 14px;
      border: 1px solid var(--gov-color-primary, #1a3a5c);
      border-radius: 4px;
      background: transparent;
      color: var(--gov-color-primary, #1a3a5c);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .auditoria__pag-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .auditoria__pag-info {
      font-size: 0.85rem;
      color: var(--gov-color-text-secondary, #6b7280);
    }

    /* ── Utilitário ────────────────────────────────────────── */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border: 0;
    }
  `],
})
export class AuditoriaListComponent implements OnInit {
  readonly store    = inject(AuditoriaStore);
  readonly outcomes = OUTCOMES;
  readonly skeletons = Array(5).fill(0);

  readonly outcomeOptions: SelectOption[] = OUTCOMES.map(o => ({
    value: o,
    label: OUTCOME_LABELS[o] ?? o,
  }));

  // ── Campos de filtro (two-way binding no template) ─────────────
  agentId = '';
  from    = '';
  to      = '';
  outcome: Outcome | '' = '';

  ngOnInit(): void {
    this.store.loadEventos();
  }

  aplicarFiltros(): void {
    this.store.loadEventos({ agentId: this.agentId, from: this.from, to: this.to, outcome: this.outcome }, 1);
  }

  limparFiltros(): void {
    this.agentId = '';
    this.from    = '';
    this.to      = '';
    this.outcome = '';
    this.store.limparFiltros();
    this.store.loadEventos();
  }

  exportarPDF(): void {
    this.store.exportarPDF();
  }

  retry(): void {
    this.store.clearError();
    this.store.loadEventos();
  }

  irParaPagina(page: number): void {
    this.store.loadEventos({}, page);
  }

  outcomeLabel(o: Outcome): string {
    return OUTCOME_LABELS[o] ?? o;
  }

  outcomeCss(o: Outcome): string {
    return OUTCOME_CSS[o] ?? '';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR', {
      day:    '2-digit',
      month:  '2-digit',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  truncar(texto: string, max: number): string {
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
  }
}
