// ============================================================
// dashboard.component.ts
//
// Rota protegida — exibe pedidos e clientes do governa-gateway.
// Consome PedidosService e ClientesService via NGRX Signals.
//
// WCAG 2.1 AA:
//   - tabelas com <caption>, scope="col", role="status" em erros
//   - aria-live="polite" para estados de loading/erro
//   - botões com type e aria-label explícitos
// ============================================================

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { PedidosService } from '../pedidos/pedidos.service';
import { ClientesService } from '../clientes/clientes.service';

@Component({
  selector: 'gov-dashboard',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <main class="dashboard" role="main">
      <!-- ── Pedidos ────────────────────────────────────────── -->
      <section class="dashboard-section" aria-labelledby="secao-pedidos">
        <div class="section-header">
          <h2 id="secao-pedidos" class="section-title">
            Pedidos
            @if (!pedidosSvc.loading()) {
              <span class="badge">{{ pedidosSvc.total() }}</span>
            }
          </h2>
          <button
            class="btn-refresh"
            type="button"
            aria-label="Atualizar pedidos"
            [disabled]="pedidosSvc.loading()"
            (click)="reloadPedidos()"
          >
            Atualizar
          </button>
        </div>

        <!-- Loading -->
        @if (pedidosSvc.loading()) {
          <div class="skeleton-table" aria-live="polite" aria-busy="true" role="status">
            <span class="sr-only">Carregando pedidos…</span>
            @for (_ of skeletonRows; track $index) {
              <div class="skeleton-row"></div>
            }
          </div>
        }

        <!-- Erro -->
        @if (pedidosSvc.hasError()) {
          <div class="alert-error" role="alert" aria-live="assertive">
            <span>{{ pedidosSvc.error() }}</span>
            <button type="button" aria-label="Fechar alerta de erro" (click)="pedidosSvc.clearError()">✕</button>
          </div>
        }

        <!-- Tabela -->
        @if (!pedidosSvc.loading() && !pedidosSvc.hasError()) {
          @if (pedidosSvc.isEmpty()) {
            <p class="empty-state">Nenhum pedido encontrado.</p>
          } @else {
            <div class="table-wrapper" role="region" aria-labelledby="secao-pedidos" tabindex="0">
              <table class="data-table" aria-describedby="secao-pedidos">
                <caption class="sr-only">Lista de pedidos — {{ pedidosSvc.total() }} registros</caption>
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Status</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Emissão</th>
                    <th scope="col">Entrega Prevista</th>
                  </tr>
                </thead>
                <tbody>
                  @for (pedido of pedidosSvc.pedidos(); track pedido.id) {
                    <tr>
                      <td>{{ pedido.numero }}</td>
                      <td>{{ pedido.clienteNome }}</td>
                      <td>
                        <span class="status-badge status-{{ pedido.status | lowercase }}">
                          {{ pedido.status }}
                        </span>
                      </td>
                      <td>{{ pedido.valor | currency: pedido.moeda : 'symbol' : '1.2-2' : 'pt-BR' }}</td>
                      <td>{{ pedido.dataEmissao | date: 'dd/MM/yyyy' }}</td>
                      <td>{{ pedido.dataEntregaPrevista ? (pedido.dataEntregaPrevista | date: 'dd/MM/yyyy') : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Paginação -->
            @if (pedidosSvc.totalPages() > 1) {
              <nav class="pagination" aria-label="Navegação de páginas de pedidos">
                <button
                  type="button"
                  [disabled]="pedidosPage === 1"
                  aria-label="Página anterior de pedidos"
                  (click)="prevPedidos()"
                >
                  ‹
                </button>
                <span aria-current="page">{{ pedidosPage }} / {{ pedidosSvc.totalPages() }}</span>
                <button
                  type="button"
                  [disabled]="pedidosPage >= pedidosSvc.totalPages()"
                  aria-label="Próxima página de pedidos"
                  (click)="nextPedidos()"
                >
                  ›
                </button>
              </nav>
            }
          }
        }
      </section>

      <!-- ── Clientes ───────────────────────────────────────── -->
      <section class="dashboard-section" aria-labelledby="secao-clientes">
        <div class="section-header">
          <h2 id="secao-clientes" class="section-title">
            Clientes
            @if (!clientesSvc.loading()) {
              <span class="badge">{{ clientesSvc.total() }}</span>
            }
          </h2>
          <button
            class="btn-refresh"
            type="button"
            aria-label="Atualizar clientes"
            [disabled]="clientesSvc.loading()"
            (click)="reloadClientes()"
          >
            Atualizar
          </button>
        </div>

        <!-- Loading -->
        @if (clientesSvc.loading()) {
          <div class="skeleton-table" aria-live="polite" aria-busy="true" role="status">
            <span class="sr-only">Carregando clientes…</span>
            @for (_ of skeletonRows; track $index) {
              <div class="skeleton-row"></div>
            }
          </div>
        }

        <!-- Erro -->
        @if (clientesSvc.hasError()) {
          <div class="alert-error" role="alert" aria-live="assertive">
            <span>{{ clientesSvc.error() }}</span>
            <button type="button" aria-label="Fechar alerta de erro" (click)="clientesSvc.clearError()">✕</button>
          </div>
        }

        <!-- Tabela -->
        @if (!clientesSvc.loading() && !clientesSvc.hasError()) {
          @if (clientesSvc.isEmpty()) {
            <p class="empty-state">Nenhum cliente encontrado.</p>
          } @else {
            <div class="table-wrapper" role="region" aria-labelledby="secao-clientes" tabindex="0">
              <table class="data-table">
                <caption class="sr-only">Lista de clientes — {{ clientesSvc.total() }} registros</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Nome</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Documento</th>
                    <th scope="col">Limite</th>
                    <th scope="col">Saldo Devedor</th>
                    <th scope="col">Ativo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (cliente of clientesSvc.clientes(); track cliente.id) {
                    <tr>
                      <td>{{ cliente.codigo }}</td>
                      <td>{{ cliente.nome }}</td>
                      <td>{{ cliente.tipoPessoa }}</td>
                      <td>{{ cliente.documento }}</td>
                      <td>{{ cliente.limiteCredito | currency: cliente.moeda : 'symbol' : '1.2-2' : 'pt-BR' }}</td>
                      <td>{{ cliente.saldoDevedor | currency: cliente.moeda : 'symbol' : '1.2-2' : 'pt-BR' }}</td>
                      <td>
                        <span
                          class="status-badge"
                          [class.status-aprovado]="cliente.ativo"
                          [class.status-cancelado]="!cliente.ativo"
                        >
                          {{ cliente.ativo ? 'Sim' : 'Não' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Paginação -->
            @if (clientesSvc.totalPages() > 1) {
              <nav class="pagination" aria-label="Navegação de páginas de clientes">
                <button
                  type="button"
                  [disabled]="clientesPage === 1"
                  aria-label="Página anterior de clientes"
                  (click)="prevClientes()"
                >
                  ‹
                </button>
                <span aria-current="page">{{ clientesPage }} / {{ clientesSvc.totalPages() }}</span>
                <button
                  type="button"
                  [disabled]="clientesPage >= clientesSvc.totalPages()"
                  aria-label="Próxima página de clientes"
                  (click)="nextClientes()"
                >
                  ›
                </button>
              </nav>
            }
          }
        }
      </section>
    </main>
  `,
  styles: [`
    .dashboard {
      padding: var(--gov-space-8);
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ── Seções ─────────────────────────────────────────────── */
    .dashboard-section {
      margin-bottom: var(--gov-space-10);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--gov-space-4);
    }

    .section-title {
      font-size: var(--gov-font-size-xl);
      font-weight: var(--gov-font-weight-semibold);
      color: var(--gov-color-text-primary);
      display: flex;
      align-items: center;
      gap: var(--gov-space-2);
    }

    /* ── Badges ─────────────────────────────────────────────── */
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      height: 24px;
      padding: 0 var(--gov-space-2);
      background: var(--gov-color-primary-100);
      color: var(--gov-color-primary-700);
      border-radius: var(--gov-radius-full);
      font-size: var(--gov-font-size-xs);
      font-weight: var(--gov-font-weight-semibold);
    }

    /* ── Buttons ─────────────────────────────────────────────── */
    .btn-refresh {
      padding: var(--gov-space-2) var(--gov-space-4);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      transition: all var(--gov-transition-fast);
      cursor: pointer;
      background: var(--gov-color-primary-600);
      color: #fff;
      border: none;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      &:hover:not(:disabled) {
        background: var(--gov-color-primary-700);
      }
    }

    /* ── Tabela ─────────────────────────────────────────────── */
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--gov-font-size-sm);

      thead {
        background: var(--gov-color-neutral-50);

        th {
          padding: var(--gov-space-3) var(--gov-space-4);
          text-align: left;
          font-weight: var(--gov-font-weight-semibold);
          color: var(--gov-color-text-secondary);
          border-bottom: 1px solid var(--gov-color-border);
          white-space: nowrap;
        }
      }

      tbody {
        tr {
          border-bottom: 1px solid var(--gov-color-border);
          transition: background var(--gov-transition-fast);

          &:last-child {
            border-bottom: none;
          }

          &:hover {
            background: var(--gov-color-primary-50);
          }
        }

        td {
          padding: var(--gov-space-3) var(--gov-space-4);
          color: var(--gov-color-text-primary);
        }
      }
    }

    /* ── Status badges ──────────────────────────────────────── */
    .status-badge {
      display: inline-block;
      padding: 2px var(--gov-space-2);
      border-radius: var(--gov-radius-full);
      font-size: var(--gov-font-size-xs);
      font-weight: var(--gov-font-weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .status-aberto        { background: var(--gov-color-neutral-100); color: var(--gov-color-neutral-700); }
    .status-em_aprovacao  { background: var(--gov-color-warning-100); color: var(--gov-color-warning-700); }
    .status-aprovado      { background: var(--gov-color-success-100); color: var(--gov-color-success-700); }
    .status-cancelado     { background: var(--gov-color-error-100);   color: var(--gov-color-error-700);   }
    .status-encerrado     { background: var(--gov-color-neutral-200); color: var(--gov-color-neutral-600); }

    /* ── Skeleton loading ───────────────────────────────────── */
    .skeleton-table {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-2);
    }

    .skeleton-row {
      height: 44px;
      border-radius: var(--gov-radius-md);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-200) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Alert de erro ──────────────────────────────────────── */
    .alert-error {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--gov-space-3) var(--gov-space-4);
      background: var(--gov-color-error-50);
      border: 1px solid var(--gov-color-error-300);
      border-radius: var(--gov-radius-md);
      color: var(--gov-color-error-700);
      font-size: var(--gov-font-size-sm);
      margin-bottom: var(--gov-space-4);

      button {
        background: transparent;
        border: none;
        color: var(--gov-color-error-500);
        cursor: pointer;
        font-size: var(--gov-font-size-base);
        line-height: 1;
        padding: 0 var(--gov-space-1);
      }
    }

    /* ── Empty state ────────────────────────────────────────── */
    .empty-state {
      padding: var(--gov-space-8);
      text-align: center;
      color: var(--gov-color-text-secondary);
      font-size: var(--gov-font-size-sm);
      border: 1px dashed var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
    }

    /* ── Paginação ──────────────────────────────────────────── */
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--gov-space-3);
      margin-top: var(--gov-space-4);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);

      button {
        width: 32px;
        height: 32px;
        border: 1px solid var(--gov-color-border);
        border-radius: var(--gov-radius-md);
        background: transparent;
        cursor: pointer;
        font-size: var(--gov-font-size-lg);
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--gov-transition-fast);

        &:hover:not(:disabled) {
          background: var(--gov-color-primary-50);
          border-color: var(--gov-color-primary-300);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }
    }

    /* ── Acessibilidade ─────────────────────────────────────── */
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
export class DashboardComponent implements OnInit {
  protected readonly pedidosSvc   = inject(PedidosService);
  protected readonly clientesSvc  = inject(ClientesService);

  readonly skeletonRows = Array(5);

  pedidosPage  = 1;
  clientesPage = 1;

  ngOnInit(): void {
    this.pedidosSvc.loadPedidos();
    this.clientesSvc.loadClientes();
  }

  reloadPedidos(): void {
    this.pedidosSvc.loadPedidos(this.pedidosPage);
  }

  reloadClientes(): void {
    this.clientesSvc.loadClientes(this.clientesPage);
  }

  nextPedidos(): void {
    this.pedidosPage++;
    this.pedidosSvc.loadPedidos(this.pedidosPage);
  }

  prevPedidos(): void {
    this.pedidosPage--;
    this.pedidosSvc.loadPedidos(this.pedidosPage);
  }

  nextClientes(): void {
    this.clientesPage++;
    this.clientesSvc.loadClientes(this.clientesPage);
  }

  prevClientes(): void {
    this.clientesPage--;
    this.clientesSvc.loadClientes(this.clientesPage);
  }
}
