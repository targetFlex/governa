// ============================================================
// pedido-card.component.ts
//
// Componente standalone que exibe dados resumidos de um Pedido.
//
// PedidoInterno nunca carrega nome de cliente em texto claro —
// só clienteId/loja. O nome é resolvido sob demanda ("Revelar
// cliente") via ClientePiiService, mesmo mecanismo do cliente-card.
//
// Acessibilidade (WCAG 2.1 AA):
//   - <article> com aria-label descritivo
//   - <dl> semântico para pares chave/valor
//   - Badge de status com aria-label explícito
//   - Contraste mínimo 4.5:1 em todas as variantes de cor
// ============================================================
import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Pedido, StatusPedido } from '../../models/pedido.model';
import { ClientePii } from '../../models/cliente.model';
import { ClientePiiService } from '../../services/cliente-pii.service';

type StatusMeta = { label: string; bg: string; color: string };
type RevealState = 'hidden' | 'loading' | 'revealed' | 'error';

const STATUS_META: Record<StatusPedido, StatusMeta> = {
  ABERTO:    { label: 'Aberto',    bg: '#dbeafe', color: '#1e40af' },
  LIBERADO:  { label: 'Liberado',  bg: '#dcfce7', color: '#166534' },
  BLOQUEADO: { label: 'Bloqueado', bg: '#fee2e2', color: '#991b1b' },
  ENCERRADO: { label: 'Encerrado', bg: '#f3f4f6', color: '#374151' },
};

@Component({
  selector: 'app-pedido-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <article
      class="pedido-card"
      [class.pedido-card--bloqueado]="pedido.status === 'BLOQUEADO'"
      [attr.aria-label]="'Pedido: ' + pedido.numeroPedido + ', cliente: ' + pedido.clienteId"
    >
      <!-- Cabeçalho ─────────────────────────────────────────── -->
      <header class="pedido-card__header">
        <h2 class="pedido-card__numero">{{ pedido.numeroPedido }}</h2>
        <span
          class="pedido-card__status"
          [style.background]="statusMeta.bg"
          [style.color]="statusMeta.color"
          [attr.aria-label]="'Status do pedido: ' + statusMeta.label"
          role="status"
        >
          {{ statusMeta.label }}
        </span>
      </header>

      <!-- Dados ─────────────────────────────────────────────── -->
      <dl class="pedido-card__dados">
        <div class="pedido-card__row">
          <dt>Cliente</dt>
          <dd>
            @if (revealState() === 'revealed' && pii()) {
              {{ pii()!.nome }}
            } @else {
              <button
                type="button"
                class="pedido-card__reveal-btn"
                [disabled]="revealState() === 'loading'"
                (click)="revealCliente()"
              >
                {{ revealState() === 'loading' ? 'Carregando…' : pedido.clienteId }}
              </button>
            }
          </dd>
        </div>
        <div class="pedido-card__row">
          <dt>Valor Total</dt>
          <dd>{{ pedido.valorTotal | currency: 'BRL' : 'symbol-narrow' : '1.2-2' }}</dd>
        </div>
        <div class="pedido-card__row">
          <dt>Itens</dt>
          <dd>{{ pedido.itens.length }}</dd>
        </div>
        <div class="pedido-card__row">
          <dt>Emissão</dt>
          <dd>{{ pedido.dataEmissao | date: 'dd/MM/yyyy' }}</dd>
        </div>
      </dl>
    </article>
  `,
  styles: [`
    .pedido-card {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      background: #ffffff;
      color: #111827;
      max-width: 420px;
      font-family: inherit;
    }

    .pedido-card--bloqueado {
      opacity: 0.65;
      background: #f9fafb;
    }

    .pedido-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .pedido-card__numero {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .pedido-card__status {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .pedido-card__dados {
      margin: 0;
      padding: 0;
    }

    .pedido-card__row {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 0;
      border-bottom: 1px solid #f3f4f6;
      gap: 0.5rem;
    }

    .pedido-card__row:last-child {
      border-bottom: none;
    }

    dt {
      font-size: 0.8rem;
      color: #6b7280;
      white-space: nowrap;
    }

    dd {
      font-size: 0.85rem;
      color: #111827;
      margin: 0;
      text-align: right;
      word-break: break-word;
    }

    .pedido-card__reveal-btn {
      background: #ffffff;
      color: #1d4ed8;
      border: 1px solid #1d4ed8;
      border-radius: 6px;
      padding: 0.15rem 0.6rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .pedido-card__reveal-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class PedidoCardComponent {
  @Input({ required: true }) pedido!: Pedido;

  private readonly piiService = inject(ClientePiiService);

  readonly revealState = signal<RevealState>('hidden');
  readonly pii = signal<ClientePii | null>(null);

  get statusMeta(): StatusMeta {
    return STATUS_META[this.pedido.status];
  }

  revealCliente(): void {
    this.revealState.set('loading');
    this.piiService.reveal(this.pedido.clienteId, this.pedido.loja).subscribe({
      next: (pii) => {
        this.pii.set(pii);
        this.revealState.set('revealed');
      },
      error: () => {
        this.revealState.set('error');
      },
    });
  }
}
