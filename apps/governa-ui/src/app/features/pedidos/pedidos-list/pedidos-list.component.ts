// ============================================================
// pedidos-list.component.ts
//
// Componente de listagem de Pedidos — feature standalone.
//
// Responsabilidades (SRP):
//   - Carregar lista via PedidosStore.loadPedidos() no ngOnInit
//   - Renderizar estados: loading / error / empty / lista
//   - Expor ação de retry (clearError + reload)
//   - Delegar exibição de cada card ao PedidoCardComponent
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="status" no loading e no empty state
//   - role="alert" no banner de erro (leitura imediata por SR)
//   - aria-live="polite" na região da lista
//   - Botão de retry com texto descritivo
// ============================================================
import {
  Component,
  OnInit,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PedidosStore } from '../pedidos.service';
import { PedidoCardComponent } from '../../../shared/components/pedido-card/pedido-card.component';

@Component({
  selector: 'app-pedidos-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PedidoCardComponent],
  template: `
    <section class="pedidos-list" aria-label="Lista de pedidos">

      <!-- ── Busca ────────────────────────────────────────── -->
      <form class="pedidos-list__search" role="search" (ngSubmit)="search()">
        <label class="sr-only" for="pedidos-search-input">Buscar pedidos por número, cliente ou status</label>
        <input
          id="pedidos-search-input"
          class="pedidos-list__search-input"
          type="search"
          placeholder="Buscar por número, cliente ou status…"
          [(ngModel)]="searchTerm"
          name="pedidosSearch"
        />
        <button class="pedidos-list__search-btn" type="submit">Buscar</button>
        @if (store.filtro()) {
          <button class="pedidos-list__search-clear" type="button" (click)="clearSearch()">
            Limpar
          </button>
        }
      </form>

      <!-- ── Loading ──────────────────────────────────────── -->
      @if (store.loading()) {
        <div class="pedidos-list__loading" role="status" aria-live="polite">
          @for (_ of skeletons; track $index) {
            <div class="pedidos-list__skeleton" aria-hidden="true"></div>
          }
          <span class="sr-only">Carregando pedidos…</span>
        </div>
      }

      <!-- ── Erro ─────────────────────────────────────────── -->
      @if (store.hasError() && !store.loading()) {
        <div class="pedidos-list__error" role="alert">
          <p class="pedidos-list__error-msg">{{ store.error() }}</p>
          <button
            class="pedidos-list__retry-btn"
            type="button"
            (click)="retry()"
          >
            Tentar novamente
          </button>
        </div>
      }

      <!-- ── Lista ─────────────────────────────────────────── -->
      @if (!store.loading() && !store.hasError()) {
        <div aria-live="polite">

          @if (store.isEmpty()) {
            <p class="pedidos-list__empty" role="status">
              Nenhum pedido encontrado.
            </p>
          } @else {
            <div class="pedidos-list__grid">
              @for (pedido of store.pedidos(); track pedido.id) {
                <app-pedido-card [pedido]="pedido" />
              }
            </div>

            <p class="pedidos-list__count" aria-live="polite">
              Exibindo {{ store.pedidos().length }} de {{ store.total() }} pedido(s)
            </p>

            <!-- ── Paginação ──────────────────────────────── -->
            <nav class="pedidos-list__pagination" aria-label="Paginação de pedidos">
              <button
                type="button"
                class="pedidos-list__page-btn"
                [disabled]="store.page() <= 1"
                (click)="previousPage()"
              >
                Anterior
              </button>
              <span aria-live="polite">Página {{ store.page() }} de {{ store.totalPages() || 1 }}</span>
              <button
                type="button"
                class="pedidos-list__page-btn"
                [disabled]="store.page() >= store.totalPages()"
                (click)="nextPage()"
              >
                Próxima
              </button>
            </nav>
          }

        </div>
      }

    </section>
  `,
  styles: [`
    .pedidos-list {
      padding: 1rem;
    }

    /* ── Busca ── */
    .pedidos-list__search {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .pedidos-list__search-input {
      flex: 1;
      min-width: 0;
      padding: 0.45rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 0.9rem;
    }

    .pedidos-list__search-btn,
    .pedidos-list__search-clear {
      padding: 0.45rem 0.9rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .pedidos-list__search-btn {
      background: #1d4ed8;
      color: #ffffff;
      border: none;
    }

    .pedidos-list__search-clear {
      background: #ffffff;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    /* ── Paginação ── */
    .pedidos-list__pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      margin-top: 1rem;
      font-size: 0.85rem;
      color: #374151;
    }

    .pedidos-list__page-btn {
      padding: 0.4rem 0.9rem;
      border-radius: 6px;
      border: 1px solid #d1d5db;
      background: #ffffff;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .pedidos-list__page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ── Skeletons ── */
    .pedidos-list__loading {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .pedidos-list__skeleton {
      height: 180px;
      border-radius: 8px;
      background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
      background-size: 200% 100%;
      animation: skeleton-shimmer 1.4s ease infinite;
    }

    @keyframes skeleton-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Erro ── */
    .pedidos-list__error {
      border: 1px solid #fca5a5;
      background: #fef2f2;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .pedidos-list__error-msg {
      margin: 0;
      color: #991b1b;
      font-size: 0.9rem;
    }

    .pedidos-list__retry-btn {
      background: #dc2626;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 0.4rem 0.9rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }

    .pedidos-list__retry-btn:hover {
      background: #b91c1c;
    }

    .pedidos-list__retry-btn:focus-visible {
      outline: 3px solid #ef4444;
      outline-offset: 2px;
    }

    /* ── Grid ── */
    .pedidos-list__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    /* ── Empty / count ── */
    .pedidos-list__empty {
      color: #6b7280;
      text-align: center;
      padding: 2rem 0;
      font-size: 0.95rem;
    }

    .pedidos-list__count {
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: #6b7280;
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
export class PedidosListComponent implements OnInit {
  readonly store = inject(PedidosStore);

  /** Número de skeleton cards exibidos durante o loading */
  readonly skeletons = Array(6).fill(null);

  searchTerm = '';

  ngOnInit(): void {
    this.store.loadPedidos();
  }

  retry(): void {
    this.store.clearError();
    this.store.loadPedidos();
  }

  search(): void {
    this.store.loadPedidos(1, this.store.pageSize(), this.searchTerm);
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.store.loadPedidos(1, this.store.pageSize(), '');
  }

  previousPage(): void {
    this.store.loadPedidos(this.store.page() - 1, this.store.pageSize(), this.store.filtro());
  }

  nextPage(): void {
    this.store.loadPedidos(this.store.page() + 1, this.store.pageSize(), this.store.filtro());
  }
}
