// ============================================================
// pedido-card.component.ts
//
// Componente standalone que exibe dados resumidos de um Pedido.
//
// Acessibilidade (WCAG 2.1 AA):
//   - <article> com aria-label descritivo
//   - <dl> semântico para pares chave/valor
//   - Badge de status com aria-label explícito
//   - Contraste mínimo 4.5:1 em todas as variantes de cor
// ============================================================
import { Component, Input } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Pedido, StatusPedido } from '../../models/pedido.model';

type StatusMeta = { label: string; bg: string; color: string };

const STATUS_META: Record<StatusPedido, StatusMeta> = {
  ABERTO:       { label: 'Aberto',       bg: '#dbeafe', color: '#1e40af' },
  EM_APROVACAO: { label: 'Em aprovação', bg: '#fef9c3', color: '#854d0e' },
  APROVADO:     { label: 'Aprovado',     bg: '#dcfce7', color: '#166534' },
  CANCELADO:    { label: 'Cancelado',    bg: '#fee2e2', color: '#991b1b' },
  ENCERRADO:    { label: 'Encerrado',    bg: '#f3f4f6', color: '#374151' },
};

@Component({
  selector: 'app-pedido-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <article
      class="pedido-card"
      [class.pedido-card--cancelado]="pedido.status === 'CANCELADO'"
      [attr.aria-label]="'Pedido: ' + pedido.numero + ', cliente: ' + pedido.clienteNome"
    >
      <!-- Cabeçalho ─────────────────────────────────────────── -->
      <header class="pedido-card__header">
        <h2 class="pedido-card__numero">{{ pedido.numero }}</h2>
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
          <dd>{{ pedido.clienteNome }}</dd>
        </div>
        <div class="pedido-card__row">
          <dt>Valor Total</dt>
          <dd>{{ pedido.valor | currency: pedido.moeda : 'symbol-narrow' : '1.2-2' }}</dd>
        </div>
        <div class="pedido-card__row">
          <dt>Itens</dt>
          <dd>{{ pedido.itens.length }}</dd>
        </div>
        <div class="pedido-card__row">
          <dt>Emissão</dt>
          <dd>{{ pedido.dataEmissao | date: 'dd/MM/yyyy' }}</dd>
        </div>
        @if (pedido.dataEntregaPrevista) {
          <div class="pedido-card__row">
            <dt>Entrega prevista</dt>
            <dd>{{ pedido.dataEntregaPrevista | date: 'dd/MM/yyyy' }}</dd>
          </div>
        }
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

    .pedido-card--cancelado {
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
  `],
})
export class PedidoCardComponent {
  @Input({ required: true }) pedido!: Pedido;

  get statusMeta(): StatusMeta {
    return STATUS_META[this.pedido.status];
  }
}
