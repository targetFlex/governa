// ============================================================
// agente-form.component.ts
//
// Tela de criação de agente (/agentes/novo) — E8.
//
// Formulário orientado ao gestor não-técnico:
//   1. Nome do agente (obrigatório, max 120)
//   2. Descrição (opcional, max 500)
//   3. Modelo de IA (select de lista pré-definida)
//   4. Ferramentas habilitadas (checkboxes)
//   5. Política de autonomia (UUID opcional)
//
// Novo agente é criado com status SANDBOX (imutável na criação).
// Após sucesso navega automaticamente para /agentes.
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="alert" no banner de erro
//   - aria-busy no botão durante criação
//   - Labels explícitas em todos os inputs
//   - aria-describedby nos hints contextuais
//   - role="group" + aria-label no bloco de ferramentas
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AgentesStore }       from '../agentes.service';
import { AuthService }        from '../../../core/auth/auth.service';
import { GovInputComponent }  from '../../../shared/ui/input/gov-input.component';
import { GovSelectComponent, SelectOption } from '../../../shared/ui/select/gov-select.component';
import { GovButtonComponent } from '../../../shared/ui/button/gov-button.component';
import { CreateAgenteDto }    from '../../../shared/models/agente.model';

// ── Modelos disponíveis ──────────────────────────────────────

const MODELOS: SelectOption[] = [
  { value: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6 (recomendado)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (leve e rápido)' },
  { value: 'claude-opus-4-7',           label: 'Claude Opus 4.7 (máxima capacidade)' },
  { value: 'gpt-4o',                    label: 'GPT-4o (OpenAI)' },
];

// ── Ferramentas disponíveis ──────────────────────────────────

interface ToolOption {
  value: string;
  label: string;
  hint:  string;
}

const TOOLS: ToolOption[] = [
  { value: 'read_protheus_pedido',     label: 'Consultar pedido',          hint: 'Lê dados de pedidos no Protheus' },
  { value: 'read_protheus_cliente',    label: 'Consultar cliente',         hint: 'Lê dados de clientes no Protheus' },
  { value: 'read_protheus_nf',         label: 'Consultar nota fiscal',     hint: 'Lê NFs emitidas no Protheus' },
  { value: 'read_politica_atendimento', label: 'Consultar política interna', hint: 'Acessa base de conhecimento interna' },
];

@Component({
  selector:        'app-agente-form',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:         [CommonModule, FormsModule, RouterLink, GovInputComponent, GovSelectComponent, GovButtonComponent],
  template: `
    <section class="af" aria-label="Criar novo agente">

      <!-- ── Cabeçalho ───────────────────────────────────────── -->
      <header class="af__header">
        <a class="af__back" routerLink="/agentes" aria-label="Voltar para lista de agentes">
          ← Agentes
        </a>
        <h1 class="af__titulo">Novo Agente</h1>
        <p class="af__subtitulo">
          O agente será criado em modo <strong>Sandbox</strong> e poderá ser ativado
          após configurar uma política de autonomia.
        </p>
      </header>

      <!-- ── Erro de criação ──────────────────────────────────── -->
      @if (store.createError()) {
        <div class="af__error" role="alert">
          <p class="af__error-msg">{{ store.createError() }}</p>
          <button
            class="af__dismiss-btn"
            type="button"
            aria-label="Fechar mensagem de erro"
            (click)="store.clearCreateError()"
          >✕</button>
        </div>
      }

      <!-- ── Formulário ──────────────────────────────────────── -->
      <form class="af__form" (ngSubmit)="onSubmit()" #form="ngForm" novalidate>

        <!-- Nome -->
        <gov-input
          label="Nome do agente"
          type="text"
          name="nome"
          [maxlength]="120"
          [required]="true"
          [(ngModel)]="formName"
          hint="Identifica o agente no painel e nos logs de auditoria."
          [error]="nameError"
        />

        <!-- Descrição -->
        <gov-input
          label="Descrição"
          type="text"
          name="descricao"
          [maxlength]="500"
          [(ngModel)]="formDescription"
          hint="Explique o propósito do agente (opcional, max 500 caracteres)."
        />

        <!-- Modelo de IA -->
        <gov-select
          label="Modelo de IA"
          name="modelId"
          [options]="modelos"
          [required]="true"
          [(ngModel)]="formModelId"
          hint="Define o LLM que o agente irá usar para raciocínio."
        />

        <!-- Ferramentas -->
        <fieldset class="af__fieldset">
          <legend class="af__legend">Ferramentas habilitadas</legend>
          <p class="af__legend-hint">
            Define quais operações o agente pode executar.
            Mais ferramentas = mais capacidade, mas mais superfície de risco.
          </p>

          <div class="af__tools-grid" role="group" aria-label="Selecionar ferramentas">
            @for (tool of tools; track tool.value) {
              <label class="af__tool-item" [attr.aria-label]="tool.label + ': ' + tool.hint">
                <input
                  type="checkbox"
                  class="af__tool-checkbox"
                  [name]="'tool_' + tool.value"
                  [checked]="isToolSelected(tool.value)"
                  (change)="toggleTool(tool.value)"
                />
                <span class="af__tool-label">{{ tool.label }}</span>
                <span class="af__tool-hint">{{ tool.hint }}</span>
              </label>
            }
          </div>
        </fieldset>

        <!-- Política de Autonomia -->
        <gov-input
          label="Política de Autonomia (opcional)"
          type="text"
          name="policyId"
          [(ngModel)]="formPolicyId"
          placeholder="ex.: 550e8400-e29b-41d4-a716-446655440000"
          hint="UUID da política a vincular. Pode ser configurada depois na tela de detalhes."
          [error]="policyIdError"
        />

        <!-- Rodapé -->
        <footer class="af__footer">
          <gov-button
            type="submit"
            [disabled]="!isFormValid() || store.creating()"
            [loading]="store.creating()"
            [attr.aria-busy]="store.creating()"
          >
            Criar Agente
          </gov-button>
          <a routerLink="/agentes" class="af__cancel-link">Cancelar</a>
        </footer>

      </form>

    </section>
  `,
  styles: [`
    .af {
      max-width: 720px;
      margin: 0 auto;
      padding: var(--gov-space-8) var(--gov-space-6);
      font-family: var(--gov-font-family-sans);
      color: var(--gov-color-text-primary);
    }

    /* ── Cabeçalho ── */
    .af__header { margin-bottom: var(--gov-space-8); }

    .af__back {
      display: inline-block;
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-brand);
      text-decoration: none;
      margin-bottom: var(--gov-space-4);
    }
    .af__back:hover { text-decoration: underline; }

    .af__titulo {
      font-size: var(--gov-font-size-2xl);
      font-weight: var(--gov-font-weight-bold);
      margin: 0 0 var(--gov-space-2);
    }

    .af__subtitulo {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      margin: 0;
      line-height: var(--gov-line-height-relaxed);
    }

    /* ── Erro ── */
    .af__error {
      background: var(--gov-color-error-100);
      border: 1px solid var(--gov-color-error-500);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-4);
      margin-bottom: var(--gov-space-6);
      display: flex;
      align-items: center;
      gap: var(--gov-space-4);
    }
    .af__error-msg { margin: 0; color: var(--gov-color-error-700); flex: 1; }
    .af__dismiss-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--gov-color-error-700);
      font-size: var(--gov-font-size-base);
    }

    /* ── Formulário ── */
    .af__form { display: flex; flex-direction: column; gap: var(--gov-space-6); }

    /* ── Ferramentas ── */
    .af__fieldset {
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      padding: var(--gov-space-5);
      margin: 0;
    }
    .af__legend {
      padding: 0 var(--gov-space-2);
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
    }
    .af__legend-hint {
      margin: var(--gov-space-2) 0 var(--gov-space-4);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
    }

    .af__tools-grid {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-3);
    }

    .af__tool-item {
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
      column-gap: var(--gov-space-3);
      align-items: start;
      cursor: pointer;
    }

    .af__tool-checkbox {
      grid-row: 1 / 3;
      margin-top: 2px;
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--gov-color-brand);
    }

    .af__tool-label {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-primary);
    }

    .af__tool-hint {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
    }

    /* ── Rodapé ── */
    .af__footer {
      display: flex;
      align-items: center;
      gap: var(--gov-space-6);
      padding-top: var(--gov-space-2);
    }

    .af__cancel-link {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      text-decoration: none;
    }
    .af__cancel-link:hover { text-decoration: underline; }
  `],
})
export class AgenteFormComponent implements OnInit, OnDestroy {
  readonly store  = inject(AgentesStore);
  readonly auth   = inject(AuthService);
  readonly router = inject(Router);

  readonly modelos = MODELOS;
  readonly tools   = TOOLS;

  formName        = '';
  formDescription = '';
  formModelId     = 'claude-sonnet-4-6';
  formTools:      string[] = [];
  formPolicyId    = '';

  get nameError(): string | undefined {
    return this.formName.length > 120 ? 'Máximo 120 caracteres.' : undefined;
  }

  get policyIdError(): string | undefined {
    const v = this.formPolicyId.trim();
    if (!v) return undefined;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(v) ? undefined : 'Formato UUID inválido.';
  }

  constructor() {
    effect(() => {
      if (this.store.createdAgent()) {
        this.store.clearCreatedAgent();
        this.router.navigate(['/agentes']);
      }
    });
  }

  ngOnInit(): void {
    this.store.clearCreateError();
  }

  ngOnDestroy(): void {
    this.store.clearCreateError();
  }

  isToolSelected(value: string): boolean {
    return this.formTools.includes(value);
  }

  toggleTool(value: string): void {
    if (this.formTools.includes(value)) {
      this.formTools = this.formTools.filter((t) => t !== value);
    } else {
      this.formTools = [...this.formTools, value];
    }
  }

  isFormValid(): boolean {
    return (
      this.formName.trim().length > 0 &&
      this.formName.length <= 120 &&
      !!this.formModelId &&
      !this.policyIdError
    );
  }

  onSubmit(): void {
    if (!this.isFormValid()) return;

    const ownerId = this.auth.userId() ?? '';

    const dto: CreateAgenteDto = {
      name:    this.formName.trim(),
      ownerId,
      modelId: this.formModelId,
      tools:   this.formTools,
    };

    if (this.formDescription.trim()) {
      dto.description = this.formDescription.trim();
    }

    const policyId = this.formPolicyId.trim();
    if (policyId) {
      dto.policyId = policyId;
    }

    this.store.createAgente(dto);
  }
}
