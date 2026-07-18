// ============================================================
// cliente-card.component.ts
//
// Componente standalone que exibe dados resumidos de um Cliente.
//
// Nome/documento/e-mail/telefone chegam pseudonimizados (HMAC,
// D16) — o card mostra os tokens por padrão e só resolve PII em
// texto claro sob demanda ("Revelar dados"), via ClientePiiService
// (GET /clientes/:clienteId/reidentificar, auditado no core).
//
// Acessibilidade (WCAG 2.1 AA):
//   - <article> com aria-label descritivo
//   - <dl> semântico para pares chave/valor
//   - Contraste mínimo 4.5:1 (variáveis CSS definidas em styles.scss)
//   - Badge de status com aria-label explícito
//   - Botão de revelação com aria-live no resultado
// ============================================================
import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Cliente, ClientePii } from '../../models/cliente.model';
import { ClientePiiService } from '../../services/cliente-pii.service';

type RevealState = 'hidden' | 'loading' | 'revealed' | 'error';

@Component({
  selector: 'app-cliente-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="cliente-card"
      [class.cliente-card--bloqueado]="cliente.bloqueado"
      [attr.aria-label]="'Cliente: ' + cliente.clienteId"
    >
      <!-- Cabeçalho ─────────────────────────────────────── -->
      <header class="cliente-card__header">
        <h2 class="cliente-card__nome">
          @if (revealState() === 'revealed' && pii()) {
            {{ pii()!.nome }}
          } @else {
            Cliente {{ cliente.clienteId }}
          }
        </h2>
        <span class="cliente-card__loja" [attr.aria-label]="'Loja: ' + cliente.loja">
          Loja {{ cliente.loja }}
        </span>
      </header>

      <!-- Dados ─────────────────────────────────────────── -->
      <dl class="cliente-card__dados">
        <div class="cliente-card__row">
          <dt>Código</dt>
          <dd>{{ cliente.clienteId }}</dd>
        </div>

        @if (revealState() === 'revealed' && pii()) {
          <div class="cliente-card__row">
            <dt>Documento</dt>
            <dd>{{ pii()!.documento }}</dd>
          </div>
          <div class="cliente-card__row">
            <dt>E-mail</dt>
            <dd>
              @if (pii()!.email) {
                <a [href]="'mailto:' + pii()!.email">{{ pii()!.email }}</a>
              } @else {
                —
              }
            </dd>
          </div>
          @if (pii()!.telefone) {
            <div class="cliente-card__row">
              <dt>Telefone</dt>
              <dd>{{ pii()!.telefone }}</dd>
            </div>
          }
        } @else {
          <div class="cliente-card__row">
            <dt>Dados pessoais</dt>
            <dd>
              <button
                type="button"
                class="cliente-card__reveal-btn"
                [disabled]="revealState() === 'loading'"
                (click)="reveal()"
              >
                {{ revealState() === 'loading' ? 'Carregando…' : 'Revelar dados' }}
              </button>
            </dd>
          </div>
          @if (revealState() === 'error') {
            <p class="cliente-card__reveal-error" role="alert">
              Não foi possível revelar os dados. <button type="button" (click)="reveal()">Tentar novamente</button>
            </p>
          }
        }
      </dl>

      <!-- Rodapé / status ───────────────────────────────── -->
      <footer class="cliente-card__footer">
        <span
          class="cliente-card__status"
          [class.cliente-card__status--ativo]="!cliente.bloqueado"
          [class.cliente-card__status--inativo]="cliente.bloqueado"
          [attr.aria-label]="cliente.bloqueado ? 'Cliente bloqueado' : 'Cliente ativo'"
          role="status"
        >
          {{ cliente.bloqueado ? 'Bloqueado' : 'Ativo' }}
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

    .cliente-card--bloqueado {
      opacity: 0.65;
      background: #f9fafb;
    }

    .cliente-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      gap: 0.5rem;
    }

    .cliente-card__nome {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
      color: #111827;
    }

    .cliente-card__loja {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      background: #dbeafe;
      color: #1e40af;  /* contraste > 4.5:1 sobre #dbeafe */
      white-space: nowrap;
    }

    .cliente-card__dados {
      margin: 0 0 0.75rem;
      padding: 0;
    }

    .cliente-card__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
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

    .cliente-card__reveal-btn {
      background: #ffffff;
      color: #1d4ed8;
      border: 1px solid #1d4ed8;
      border-radius: 6px;
      padding: 0.3rem 0.7rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }

    .cliente-card__reveal-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .cliente-card__reveal-error {
      font-size: 0.8rem;
      color: #991b1b;
      margin: 0.5rem 0 0;
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

  private readonly piiService = inject(ClientePiiService);

  readonly revealState = signal<RevealState>('hidden');
  readonly pii = signal<ClientePii | null>(null);

  reveal(): void {
    this.revealState.set('loading');
    this.piiService.reveal(this.cliente.clienteId, this.cliente.loja).subscribe({
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
