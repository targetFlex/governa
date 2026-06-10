// ============================================================
// cliente-card.component.ts
//
// Componente standalone que exibe dados resumidos de um Cliente.
//
// Acessibilidade (WCAG 2.1 AA):
//   - <article> com aria-label descritivo
//   - <dl> semântico para pares chave/valor
//   - Contraste mínimo 4.5:1 (variáveis CSS definidas em styles.scss)
//   - Badge de status com aria-label explícito
//   - Link de e-mail com texto visível e href:mailto
// ============================================================
import { Component, Input } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Cliente } from '../../models/cliente.model';

@Component({
  selector: 'app-cliente-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <article
      class="cliente-card"
      [class.cliente-card--inativo]="!cliente.ativo"
      [attr.aria-label]="'Cliente: ' + cliente.nome"
    >
      <!-- Cabeçalho ─────────────────────────────────────── -->
      <header class="cliente-card__header">
        <h2 class="cliente-card__nome">{{ cliente.nome }}</h2>
        <span
          class="cliente-card__tipo"
          [attr.aria-label]="'Tipo de pessoa: ' + (cliente.tipoPessoa === 'PF' ? 'Física' : 'Jurídica')"
        >
          {{ cliente.tipoPessoa }}
        </span>
      </header>

      <!-- Dados ─────────────────────────────────────────── -->
      <dl class="cliente-card__dados">
        <div class="cliente-card__row">
          <dt>Código</dt>
          <dd>{{ cliente.codigo }}</dd>
        </div>
        <div class="cliente-card__row">
          <dt>Documento</dt>
          <dd>{{ cliente.documento }}</dd>
        </div>
        <div class="cliente-card__row">
          <dt>E-mail</dt>
          <dd>
            <a [href]="'mailto:' + cliente.email">{{ cliente.email }}</a>
          </dd>
        </div>
        @if (cliente.telefone) {
          <div class="cliente-card__row">
            <dt>Telefone</dt>
            <dd>{{ cliente.telefone }}</dd>
          </div>
        }
        <div class="cliente-card__row">
          <dt>Limite de Crédito</dt>
          <dd>{{ cliente.limiteCredito | currency: cliente.moeda : 'symbol-narrow' : '1.2-2' }}</dd>
        </div>
        <div class="cliente-card__row">
          <dt>Saldo Devedor</dt>
          <dd>{{ cliente.saldoDevedor | currency: cliente.moeda : 'symbol-narrow' : '1.2-2' }}</dd>
        </div>
      </dl>

      <!-- Rodapé / status ───────────────────────────────── -->
      <footer class="cliente-card__footer">
        <span
          class="cliente-card__status"
          [class.cliente-card__status--ativo]="cliente.ativo"
          [class.cliente-card__status--inativo]="!cliente.ativo"
          [attr.aria-label]="cliente.ativo ? 'Cliente ativo' : 'Cliente inativo'"
          role="status"
        >
          {{ cliente.ativo ? 'Ativo' : 'Inativo' }}
        </span>
      </footer>
    </article>
  `,
  styles: [`
    .cliente-card {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      background: #ffffff;
      color: #111827;
      max-width: 420px;
      font-family: inherit;
    }

    .cliente-card--inativo {
      opacity: 0.65;
      background: #f9fafb;
    }

    .cliente-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }

    .cliente-card__nome {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .cliente-card__tipo {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      background: #dbeafe;
      color: #1e40af;  /* contraste > 4.5:1 sobre #dbeafe */
    }

    .cliente-card__dados {
      margin: 0 0 0.75rem;
      padding: 0;
    }

    .cliente-card__row {
      display: flex;
      justify-content: space-between;
      padding: 0.25rem 0;
      border-bottom: 1px solid #f3f4f6;
      gap: 0.5rem;
    }

    .cliente-card__row:last-child {
      border-bottom: none;
    }

    dt {
      font-size: 0.8rem;
      color: #6b7280;  /* contraste 4.6:1 sobre #fff */
      white-space: nowrap;
    }

    dd {
      font-size: 0.85rem;
      color: #111827;
      margin: 0;
      text-align: right;
      word-break: break-word;
    }

    dd a {
      color: #1d4ed8;  /* contraste 7.1:1 — WCAG AA */
      text-decoration: underline;
    }

    .cliente-card__footer {
      display: flex;
      justify-content: flex-end;
    }

    .cliente-card__status {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 12px;
    }

    .cliente-card__status--ativo {
      background: #dcfce7;
      color: #166534;  /* contraste > 7:1 — WCAG AAA */
    }

    .cliente-card__status--inativo {
      background: #fee2e2;
      color: #991b1b;  /* contraste > 7:1 — WCAG AAA */
    }
  `],
})
export class ClienteCardComponent {
  @Input({ required: true }) cliente!: Cliente;
}
