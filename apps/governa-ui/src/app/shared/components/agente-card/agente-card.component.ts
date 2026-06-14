// ============================================================
// agente-card.component.ts
//
// Componente standalone que exibe dados resumidos de um Agente
// e expõe ações de pause/ativar via @Output.
//
// Acessibilidade (WCAG 2.1 AA):
//   - <article> com aria-label descritivo (nome + status)
//   - <dl> semântico para pares chave/valor
//   - Badge de status com aria-label explícito e role="status"
//   - Botões com aria-label + aria-busy durante ação em andamento
//   - Contraste mínimo 4.5:1 em todas as variantes de cor
//   - Tokens --gov-* do design system (sem hardcode de cor)
//
// Transições de status permitidas (espelham o backend):
//   ACTIVE     → pode pausar   (não pode ativar)
//   PAUSED     → pode ativar   (não pode pausar)
//   SANDBOX    → pode ativar   (não pode pausar)
//   DEPRECATED → sem ações     (estado terminal)
// ============================================================
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Agente, AgentStatus } from '../../models/agente.model';

type StatusMeta = { label: string; bg: string; color: string };

const STATUS_META: Record<AgentStatus, StatusMeta> = {
  ACTIVE:     { label: 'Ativo',       bg: '#dcfce7', color: '#166534' },
  PAUSED:     { label: 'Pausado',     bg: '#fef9c3', color: '#854d0e' },
  SANDBOX:    { label: 'Sandbox',     bg: '#dbeafe', color: '#1e40af' },
  DEPRECATED: { label: 'Depreciado',  bg: '#f3f4f6', color: '#374151' },
};

@Component({
  selector: 'app-agente-card',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <article
      class="agente-card"
      [class.agente-card--deprecated]="agente.status === 'DEPRECATED'"
      [attr.aria-label]="'Agente: ' + agente.name + ', status: ' + statusMeta.label"
    >
      <!-- Cabeçalho ─────────────────────────────────────── -->
      <header class="agente-card__header">
        <h2 class="agente-card__nome">{{ agente.name }}</h2>
        <span
          class="agente-card__status"
          [style.background]="statusMeta.bg"
          [style.color]="statusMeta.color"
          [attr.aria-label]="'Status: ' + statusMeta.label"
          role="status"
        >
          {{ statusMeta.label }}
        </span>
      </header>

      <!-- Descrição ──────────────────────────────────────── -->
      @if (agente.description) {
        <p class="agente-card__descricao">{{ agente.description }}</p>
      }

      <!-- Dados ─────────────────────────────────────────── -->
      <dl class="agente-card__dados">
        <div class="agente-card__row">
          <dt>Modelo</dt>
          <dd>{{ agente.modelId }}</dd>
        </div>
        <div class="agente-card__row">
          <dt>Tools</dt>
          <dd>{{ agente.tools.length }} configurada{{ agente.tools.length !== 1 ? 's' : '' }}</dd>
        </div>
        <div class="agente-card__row">
          <dt>Política</dt>
          <dd>{{ agente.policyId ? 'Configurada' : 'Sem política' }}</dd>
        </div>
        @if (agente.lastActiveAt) {
          <div class="agente-card__row">
            <dt>Último ativo</dt>
            <dd>{{ agente.lastActiveAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
          </div>
        }
      </dl>

      <!-- Ações ─────────────────────────────────────────── -->
      @if (agente.status !== 'DEPRECATED') {
        <footer class="agente-card__footer">

          @if (agente.status === 'ACTIVE') {
            <button
              class="agente-card__btn agente-card__btn--pausar"
              type="button"
              [disabled]="emAndamento"
              [attr.aria-busy]="emAndamento"
              [attr.aria-label]="emAndamento ? 'Pausando ' + agente.name : 'Pausar ' + agente.name"
              (click)="onPausar()"
            >
              @if (emAndamento) {
                <span class="agente-card__spinner" aria-hidden="true"></span>
                Pausando…
              } @else {
                Pausar
              }
            </button>
          }

          @if (agente.status === 'PAUSED' || agente.status === 'SANDBOX') {
            <button
              class="agente-card__btn agente-card__btn--ativar"
              type="button"
              [disabled]="emAndamento || !agente.policyId"
              [attr.aria-busy]="emAndamento"
              [attr.aria-label]="emAndamento
                ? 'Ativando ' + agente.name
                : !agente.policyId
                  ? 'Ativar ' + agente.name + ' (requer política configurada)'
                  : 'Ativar ' + agente.name"
              [title]="!agente.policyId ? 'Configure uma política antes de ativar' : ''"
              (click)="onAtivar()"
            >
              @if (emAndamento) {
                <span class="agente-card__spinner" aria-hidden="true"></span>
                Ativando…
              } @else {
                Ativar
              }
            </button>
          }

        </footer>
      }
    </article>
  `,
  styles: [`
    .agente-card {
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      padding: var(--gov-space-4) var(--gov-space-5);
      background: var(--gov-color-surface);
      color: var(--gov-color-text-primary);
      font-family: inherit;
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-3);
    }

    .agente-card--deprecated {
      opacity: 0.6;
      background: var(--gov-color-neutral-50);
    }

    /* ── Cabeçalho ── */
    .agente-card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--gov-space-3);
    }

    .agente-card__nome {
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
      margin: 0;
      color: var(--gov-color-text-primary);
      line-height: var(--gov-line-height-tight);
    }

    .agente-card__status {
      font-size: var(--gov-font-size-xs);
      font-weight: var(--gov-font-weight-semibold);
      padding: 2px 10px;
      border-radius: var(--gov-radius-full);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Descrição ── */
    .agente-card__descricao {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      margin: 0;
      line-height: var(--gov-line-height-relaxed);
    }

    /* ── Dados ── */
    .agente-card__dados {
      margin: 0;
      padding: 0;
    }

    .agente-card__row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--gov-space-1) 0;
      border-bottom: 1px solid var(--gov-color-neutral-100);
      gap: var(--gov-space-2);
    }

    .agente-card__row:last-child {
      border-bottom: none;
    }

    dt {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
      white-space: nowrap;
    }

    dd {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-primary);
      margin: 0;
      text-align: right;
      word-break: break-word;
    }

    /* ── Rodapé / ações ── */
    .agente-card__footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--gov-space-2);
      margin-top: var(--gov-space-1);
    }

    .agente-card__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--gov-space-2);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
      padding: var(--gov-space-2) var(--gov-space-4);
      border-radius: var(--gov-radius-md);
      border: none;
      cursor: pointer;
      transition: background var(--gov-transition-fast);
    }

    .agente-card__btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .agente-card__btn--pausar {
      background: var(--gov-color-warning-100);
      color: var(--gov-color-warning-700);
    }

    .agente-card__btn--pausar:not(:disabled):hover {
      background: var(--gov-color-warning-500);
      color: var(--gov-color-white);
    }

    .agente-card__btn--pausar:focus-visible {
      outline: 3px solid var(--gov-color-warning-500);
      outline-offset: 2px;
    }

    .agente-card__btn--ativar {
      background: var(--gov-color-success-100);
      color: var(--gov-color-success-700);
    }

    .agente-card__btn--ativar:not(:disabled):hover {
      background: var(--gov-color-success-500);
      color: var(--gov-color-white);
    }

    .agente-card__btn--ativar:focus-visible {
      outline: 3px solid var(--gov-color-success-500);
      outline-offset: 2px;
    }

    /* ── Spinner inline ── */
    .agente-card__spinner {
      width: 12px;
      height: 12px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class AgenteCardComponent {
  @Input({ required: true }) agente!: Agente;
  /** true quando pause/ativar está em andamento para este agente */
  @Input() emAndamento = false;

  @Output() pausar = new EventEmitter<string>();
  @Output() ativar = new EventEmitter<string>();

  get statusMeta(): StatusMeta {
    return STATUS_META[this.agente.status];
  }

  onPausar(): void {
    if (!this.emAndamento) {
      this.pausar.emit(this.agente.id);
    }
  }

  onAtivar(): void {
    if (!this.emAndamento && this.agente.policyId) {
      this.ativar.emit(this.agente.id);
    }
  }
}
