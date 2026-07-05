// ============================================================
// agentes-list.component.ts
//
// Tela de inventário de agentes (/agentes) — E4.2.
//
// Responsabilidades (SRP):
//   - Carregar lista via AgentesStore.loadAgentes() no ngOnInit
//   - Renderizar chips de filtro por status (com contagem)
//   - Renderizar estados: loading / error / empty / lista
//   - Delegar exibição de cada card ao AgenteCardComponent
//   - Despachar ações pause/ativar à store (atualiza otimisticamente)
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="status" no loading e no empty state
//   - role="alert" no banner de erro (leitura imediata pelo SR)
//   - aria-live="polite" na região da lista
//   - Chips de filtro com aria-pressed e aria-label descritivo
//   - Botão retry com texto explícito
// ============================================================
import {
  Component,
  OnInit,
  DestroyRef,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { interval } from 'rxjs';
import { AgentesStore } from '../agentes.service';
import { AgenteCardComponent } from '../../../shared/components/agente-card/agente-card.component';
import { AgentStatus } from '../../../shared/models/agente.model';

type FiltroStatus = AgentStatus | 'TODOS';

interface ChipFiltro {
  valor: FiltroStatus;
  label: string;
}

const CHIPS: ChipFiltro[] = [
  { valor: 'TODOS',      label: 'Todos'      },
  { valor: 'ACTIVE',     label: 'Ativos'     },
  { valor: 'PAUSED',     label: 'Pausados'   },
  { valor: 'SANDBOX',    label: 'Sandbox'    },
  { valor: 'DEPRECATED', label: 'Depreciados'},
];

const AGENTES_REFRESH_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-agentes-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, AgenteCardComponent],
  template: `
    <section class="agentes-list" aria-label="Inventário de agentes">

      <!-- ── Cabeçalho ────────────────────────────────────────── -->
      <header class="agentes-list__header">
        <div class="agentes-list__header-text">
          <h1 class="agentes-list__titulo">Agentes</h1>
          <p class="agentes-list__subtitulo">
            Gerencie o ciclo de vida dos agentes do tenant.
          </p>
        </div>
        <div class="agentes-list__header-right">
          @if (store.lastRefreshed()) {
            <p class="agentes-list__refresh-hint" aria-live="polite" aria-atomic="true">
              Atualizado às {{ store.lastRefreshed() | date: 'HH:mm:ss' }}
            </p>
          }
          <a
            routerLink="/agentes/novo"
            class="agentes-list__novo-btn"
            aria-label="Criar novo agente"
          >+ Novo Agente</a>
        </div>
      </header>

      <!-- ── Chips de filtro ──────────────────────────────────── -->
      @if (!store.loading() && !store.hasError() && !store.isEmpty()) {
        <div class="agentes-list__filtros" role="group" aria-label="Filtrar por status">
          @for (chip of chips; track chip.valor) {
            <button
              class="agentes-list__chip"
              [class.agentes-list__chip--ativo]="store.filtroStatus() === chip.valor"
              type="button"
              [attr.aria-pressed]="store.filtroStatus() === chip.valor"
              [attr.aria-label]="chip.label + ': ' + (store.contagemPorStatus()[chip.valor]) + ' agente(s)'"
              (click)="setFiltro(chip.valor)"
            >
              {{ chip.label }}
              <span class="agentes-list__chip-count" aria-hidden="true">
                {{ store.contagemPorStatus()[chip.valor] }}
              </span>
            </button>
          }
        </div>
      }

      <!-- ── Erro global de ação (pause/ativar) ───────────────── -->
      @if (store.hasError() && !store.loading()) {
        <div class="agentes-list__error" role="alert">
          <p class="agentes-list__error-msg">{{ store.error() }}</p>
          <button
            class="agentes-list__retry-btn"
            type="button"
            (click)="retry()"
          >
            Tentar novamente
          </button>
        </div>
      }

      <!-- ── Loading ──────────────────────────────────────────── -->
      @if (store.loading()) {
        <div class="agentes-list__loading" role="status" aria-live="polite">
          @for (_ of skeletons; track $index) {
            <div class="agentes-list__skeleton" aria-hidden="true"></div>
          }
          <span class="sr-only">Carregando agentes…</span>
        </div>
      }

      <!-- ── Lista ─────────────────────────────────────────────── -->
      @if (!store.loading()) {
        <div aria-live="polite">

          @if (store.isEmpty()) {
            <p class="agentes-list__empty" role="status">
              Nenhum agente encontrado.
            </p>
          } @else if (store.agentesFiltrados().length === 0) {
            <p class="agentes-list__empty" role="status">
              Nenhum agente com status "{{ filtroLabel }}".
            </p>
          } @else {
            <div class="agentes-list__grid">
              @for (agente of store.agentesFiltrados(); track agente.id) {
                <app-agente-card
                  [agente]="agente"
                  [emAndamento]="isEmAndamento(agente.id)"
                  (pausar)="onPausar($event)"
                  (ativar)="onAtivar($event)"
                />
              }
            </div>

            <p class="agentes-list__count" aria-live="polite">
              Exibindo {{ store.agentesFiltrados().length }}
              de {{ store.total() }} agente(s)
            </p>
          }

        </div>
      }

    </section>
  `,
  styles: [`
    .agentes-list {
      padding: var(--gov-space-6) var(--gov-space-4);
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-6);
    }

    /* ── Cabeçalho ── */
    .agentes-list__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gov-space-4);
    }

    .agentes-list__header-text {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-1);
    }

    .agentes-list__titulo {
      font-size: var(--gov-font-size-2xl);
      font-weight: var(--gov-font-weight-bold);
      color: var(--gov-color-text-primary);
      margin: 0;
    }

    .agentes-list__subtitulo {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      margin: 0;
    }

    .agentes-list__header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--gov-space-2);
    }

    .agentes-list__refresh-hint {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
      margin: 0;
      white-space: nowrap;
    }

    .agentes-list__novo-btn {
      display: inline-flex;
      align-items: center;
      padding: var(--gov-space-2) var(--gov-space-4);
      background: var(--gov-color-brand);
      color: var(--gov-color-text-inverse);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      text-decoration: none;
      white-space: nowrap;
      transition: background var(--gov-transition-fast);
    }
    .agentes-list__novo-btn:hover { background: var(--gov-color-brand-hover); }

    /* ── Chips de filtro ── */
    .agentes-list__filtros {
      display: flex;
      flex-wrap: wrap;
      gap: var(--gov-space-2);
    }

    .agentes-list__chip {
      display: inline-flex;
      align-items: center;
      gap: var(--gov-space-2);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      padding: var(--gov-space-2) var(--gov-space-4);
      border-radius: var(--gov-radius-full);
      border: 1px solid var(--gov-color-border);
      background: var(--gov-color-surface);
      color: var(--gov-color-text-secondary);
      cursor: pointer;
      transition: all var(--gov-transition-fast);
    }

    .agentes-list__chip:hover {
      border-color: var(--gov-color-brand);
      color: var(--gov-color-brand);
    }

    .agentes-list__chip--ativo {
      background: var(--gov-color-primary-100);
      border-color: var(--gov-color-brand);
      color: var(--gov-color-primary-700);
      font-weight: var(--gov-font-weight-semibold);
    }

    .agentes-list__chip:focus-visible {
      outline: 3px solid var(--gov-color-brand);
      outline-offset: 2px;
    }

    .agentes-list__chip-count {
      font-size: var(--gov-font-size-xs);
      background: var(--gov-color-neutral-100);
      border-radius: var(--gov-radius-full);
      padding: 1px 7px;
      font-weight: var(--gov-font-weight-semibold);
    }

    .agentes-list__chip--ativo .agentes-list__chip-count {
      background: var(--gov-color-primary-200);
      color: var(--gov-color-primary-800);
    }

    /* ── Erro ── */
    .agentes-list__error {
      border: 1px solid var(--gov-color-error-500);
      background: var(--gov-color-error-100);
      border-radius: var(--gov-radius-lg);
      padding: var(--gov-space-4) var(--gov-space-5);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gov-space-4);
    }

    .agentes-list__error-msg {
      margin: 0;
      color: var(--gov-color-error-700);
      font-size: var(--gov-font-size-sm);
    }

    .agentes-list__retry-btn {
      background: var(--gov-color-error-500);
      color: var(--gov-color-white);
      border: none;
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-2) var(--gov-space-4);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--gov-transition-fast);
    }

    .agentes-list__retry-btn:hover {
      background: var(--gov-color-error-700);
    }

    .agentes-list__retry-btn:focus-visible {
      outline: 3px solid var(--gov-color-error-500);
      outline-offset: 2px;
    }

    /* ── Skeletons ── */
    .agentes-list__loading {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--gov-space-4);
    }

    .agentes-list__skeleton {
      height: 200px;
      border-radius: var(--gov-radius-lg);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-300) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease infinite;
    }

    @keyframes skeleton-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Grid ── */
    .agentes-list__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--gov-space-4);
    }

    /* ── Empty / count ── */
    .agentes-list__empty {
      color: var(--gov-color-text-secondary);
      text-align: center;
      padding: var(--gov-space-12) 0;
      font-size: var(--gov-font-size-base);
    }

    .agentes-list__count {
      margin-top: var(--gov-space-3);
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
      text-align: right;
    }

    /* ── Screen-reader only ── */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `],
})
export class AgentesListComponent implements OnInit {
  readonly store      = inject(AgentesStore);
  readonly chips      = CHIPS;
  readonly skeletons  = Array(6).fill(null);

  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.store.loadAgentes();

    interval(AGENTES_REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.refreshAgentes());
  }

  get filtroLabel(): string {
    return CHIPS.find((c) => c.valor === this.store.filtroStatus())?.label ?? '';
  }

  isEmAndamento(id: string): boolean {
    return this.store.acoesEmAndamento().includes(id);
  }

  setFiltro(filtro: FiltroStatus): void {
    this.store.setFiltroStatus(filtro);
  }

  onPausar(id: string): void {
    this.store.pauseAgente(id);
  }

  onAtivar(id: string): void {
    this.store.activateAgente(id);
  }

  retry(): void {
    this.store.clearError();
    this.store.loadAgentes();
  }
}
