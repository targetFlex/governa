// ============================================================
// agente-edit.component.ts
//
// Tela de edição de agente (/agentes/:id/editar) — E8.
//
// Fluxo:
//   1. Carrega agente via GET /agents/:id para pré-preencher form
//   2. Usuário edita os campos desejados
//   3. Submit envia PATCH /agents/:id com campos alterados
//   4. Após sucesso navega para /agentes/:id
//
// Campos editáveis (ownerId e status são imutáveis via PATCH):
//   - Nome (obrigatório, max 120)
//   - Descrição (opcional, max 500)
//   - Modelo de IA (select)
//   - Ferramentas habilitadas (checkboxes)
//   - Política de autonomia (UUID opcional)
//
// Acessibilidade (WCAG 2.1 AA):
//   - role="alert" no banner de erro
//   - aria-busy no botão durante atualização
//   - Labels explícitas em todos os inputs
//   - aria-describedby nos hints contextuais
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  effect,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule }                         from '@angular/common';
import { FormsModule }                          from '@angular/forms';
import { Router, RouterLink, ActivatedRoute }   from '@angular/router';
import { HttpClient }                           from '@angular/common/http';
import { catchError, finalize, tap, throwError } from 'rxjs';
import { environment }                          from '@env/environment';
import { AgentesStore }                         from '../agentes.service';
import { GovInputComponent }                    from '../../../shared/ui/input/gov-input.component';
import { GovSelectComponent, SelectOption }     from '../../../shared/ui/select/gov-select.component';
import { GovButtonComponent }                   from '../../../shared/ui/button/gov-button.component';
import { Agente, UpdateAgenteDto }              from '../../../shared/models/agente.model';

// ── Modelos disponíveis ──────────────────────────────────────

const MODELOS: SelectOption[] = [
  { value: 'claude-sonnet-5',           label: 'Claude Sonnet 5 (recomendado)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (leve e rápido)' },
  { value: 'claude-opus-4-8',           label: 'Claude Opus 4.8 (máxima capacidade)' },
  { value: 'gpt-4o',                    label: 'GPT-4o (OpenAI)' },
];

// ── Ferramentas disponíveis ──────────────────────────────────

interface ToolOption {
  value: string;
  label: string;
  hint:  string;
}

const TOOLS: ToolOption[] = [
  { value: 'read_protheus_pedido',      label: 'Consultar pedido',           hint: 'Lê dados de pedidos no Protheus' },
  { value: 'read_protheus_cliente',     label: 'Consultar cliente',          hint: 'Lê dados de clientes no Protheus' },
  { value: 'read_protheus_nf',          label: 'Consultar nota fiscal',      hint: 'Lê NFs emitidas no Protheus' },
  { value: 'read_politica_atendimento', label: 'Consultar política interna', hint: 'Acessa base de conhecimento interna' },
];

@Component({
  selector:        'app-agente-edit',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:         [CommonModule, FormsModule, RouterLink, GovInputComponent, GovSelectComponent, GovButtonComponent],
  template: `
    <section class="ae" aria-label="Editar agente">

      <!-- ── Cabeçalho ───────────────────────────────────────── -->
      <header class="ae__header">
        <a class="ae__back" [routerLink]="['/agentes', id]" aria-label="Voltar para detalhe do agente">
          ← Agente
        </a>
        <h1 class="ae__titulo">Editar Agente</h1>
      </header>

      <!-- ── Loading do agente ───────────────────────────────── -->
      @if (loadingAgente()) {
        <div class="ae__loading" role="status" aria-live="polite">
          <div class="ae__skeleton" aria-hidden="true"></div>
          <span class="sr-only">Carregando agente…</span>
        </div>
      }

      <!-- ── Erro ao carregar ─────────────────────────────────── -->
      @if (loadError()) {
        <div class="ae__error" role="alert">
          <p class="ae__error-msg">{{ loadError() }}</p>
          <button type="button" class="ae__retry-btn" (click)="loadAgente()">
            Tentar novamente
          </button>
        </div>
      }

      <!-- ── Não encontrado ──────────────────────────────────── -->
      @if (notFound()) {
        <div class="ae__not-found" role="status">
          <p>Agente não encontrado.</p>
          <a routerLink="/agentes" class="ae__back-link">Voltar para a lista</a>
        </div>
      }

      <!-- ── Erro de atualização ─────────────────────────────── -->
      @if (store.updateError()) {
        <div class="ae__error" role="alert">
          <p class="ae__error-msg">{{ store.updateError() }}</p>
          <button
            class="ae__dismiss-btn"
            type="button"
            aria-label="Fechar mensagem de erro"
            (click)="store.clearUpdateError()"
          >✕</button>
        </div>
      }

      <!-- ── Formulário ──────────────────────────────────────── -->
      @if (!loadingAgente() && !loadError() && !notFound()) {
        <form class="ae__form" (ngSubmit)="onSubmit()" #form="ngForm" novalidate>

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
          <fieldset class="ae__fieldset">
            <legend class="ae__legend">Ferramentas habilitadas</legend>
            <p class="ae__legend-hint">
              Define quais operações o agente pode executar.
              Mais ferramentas = mais capacidade, mas mais superfície de risco.
            </p>

            <div class="ae__tools-grid" role="group" aria-label="Selecionar ferramentas">
              @for (tool of tools; track tool.value) {
                <label class="ae__tool-item" [attr.aria-label]="tool.label + ': ' + tool.hint">
                  <input
                    type="checkbox"
                    class="ae__tool-checkbox"
                    [name]="'tool_' + tool.value"
                    [checked]="isToolSelected(tool.value)"
                    (change)="toggleTool(tool.value)"
                  />
                  <span class="ae__tool-label">{{ tool.label }}</span>
                  <span class="ae__tool-hint">{{ tool.hint }}</span>
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
            hint="UUID da política a vincular. Deixe em branco para desvincular."
            [error]="policyIdError"
          />

          <!-- Rodapé -->
          <footer class="ae__footer">
            <gov-button
              type="submit"
              [disabled]="!isFormValid() || store.updating()"
              [loading]="store.updating()"
              [attr.aria-busy]="store.updating()"
            >
              Salvar alterações
            </gov-button>
            <a [routerLink]="['/agentes', id]" class="ae__cancel-link">Cancelar</a>
          </footer>

        </form>
      }

    </section>
  `,
  styles: [`
    .ae {
      max-width: 720px;
      margin: 0 auto;
      padding: var(--gov-space-8) var(--gov-space-6);
      font-family: var(--gov-font-family-sans);
      color: var(--gov-color-text-primary);
    }

    /* ── Cabeçalho ── */
    .ae__header { margin-bottom: var(--gov-space-8); }

    .ae__back {
      display: inline-block;
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-brand);
      text-decoration: none;
      margin-bottom: var(--gov-space-4);
    }
    .ae__back:hover { text-decoration: underline; }

    .ae__titulo {
      font-size: var(--gov-font-size-2xl);
      font-weight: var(--gov-font-weight-bold);
      margin: 0 0 var(--gov-space-2);
    }

    /* ── Erro ── */
    .ae__error {
      background: var(--gov-color-error-100);
      border: 1px solid var(--gov-color-error-500);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-4);
      margin-bottom: var(--gov-space-6);
      display: flex;
      align-items: center;
      gap: var(--gov-space-4);
    }
    .ae__error-msg { margin: 0; color: var(--gov-color-error-700); flex: 1; }
    .ae__dismiss-btn, .ae__retry-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--gov-color-error-700);
      font-size: var(--gov-font-size-base);
      white-space: nowrap;
    }
    .ae__retry-btn {
      background: var(--gov-color-error-500);
      color: var(--gov-color-white);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-1) var(--gov-space-3);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
    }

    /* ── Formulário ── */
    .ae__form { display: flex; flex-direction: column; gap: var(--gov-space-6); }

    /* ── Ferramentas ── */
    .ae__fieldset {
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      padding: var(--gov-space-5);
      margin: 0;
    }
    .ae__legend {
      padding: 0 var(--gov-space-2);
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
    }
    .ae__legend-hint {
      margin: var(--gov-space-2) 0 var(--gov-space-4);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
    }

    .ae__tools-grid {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-3);
    }

    .ae__tool-item {
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
      column-gap: var(--gov-space-3);
      align-items: start;
      cursor: pointer;
    }

    .ae__tool-checkbox {
      grid-row: 1 / 3;
      margin-top: 2px;
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: var(--gov-color-brand);
    }

    .ae__tool-label {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-primary);
    }

    .ae__tool-hint {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
    }

    /* ── Rodapé ── */
    .ae__footer {
      display: flex;
      align-items: center;
      gap: var(--gov-space-6);
      padding-top: var(--gov-space-2);
    }

    .ae__cancel-link {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      text-decoration: none;
    }
    .ae__cancel-link:hover { text-decoration: underline; }

    /* ── Loading skeleton ── */
    .ae__loading { display: flex; flex-direction: column; gap: var(--gov-space-4); }

    .ae__skeleton {
      height: 300px;
      border-radius: var(--gov-radius-xl);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-300) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
    }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Não encontrado ── */
    .ae__not-found {
      text-align: center;
      padding: var(--gov-space-12) 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--gov-space-4);

      p { font-size: var(--gov-font-size-base); color: var(--gov-color-text-secondary); margin: 0; }
    }

    .ae__back-link {
      color: var(--gov-color-brand);
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }

    /* ── Accessibility ── */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 640px) {
      .ae { padding: var(--gov-space-5) var(--gov-space-4); }
      .ae__footer { flex-wrap: wrap; gap: var(--gov-space-3); }
    }
  `],
})
export class AgenteEditComponent implements OnInit, OnDestroy {
  readonly store  = inject(AgentesStore);
  readonly router = inject(Router);

  private readonly route = inject(ActivatedRoute);
  private readonly http  = inject(HttpClient);

  readonly modelos = MODELOS;
  readonly tools   = TOOLS;

  readonly loadingAgente = signal(true);
  readonly loadError     = signal<string | null>(null);
  readonly notFound      = signal(false);

  formName        = '';
  formDescription = '';
  formModelId     = 'claude-sonnet-4-6';
  formTools:      string[] = [];
  formPolicyId    = '';

  get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

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
      if (this.store.updatedAgent()) {
        this.store.clearUpdatedAgent();
        this.router.navigate(['/agentes', this.id]);
      }
    });
  }

  ngOnInit(): void {
    this.store.clearUpdateError();
    this.loadAgente();
  }

  ngOnDestroy(): void {
    this.store.clearUpdateError();
  }

  loadAgente(): void {
    this.loadingAgente.set(true);
    this.loadError.set(null);
    this.notFound.set(false);

    this.http
      .get<{ data: Agente }>(`${environment.coreBaseUrl}/agents/${this.id}`)
      .pipe(
        tap((res) => this.prefillForm(res.data)),
        catchError((err) => {
          if (err.status === 404) {
            this.notFound.set(true);
          } else {
            this.loadError.set(err?.error?.message ?? 'Erro ao carregar agente.');
          }
          return throwError(() => err);
        }),
        finalize(() => this.loadingAgente.set(false)),
      )
      .subscribe();
  }

  private prefillForm(agente: Agente): void {
    this.formName        = agente.name;
    this.formDescription = agente.description ?? '';
    this.formModelId     = agente.modelId;
    this.formTools       = [...agente.tools];
    this.formPolicyId    = agente.policyId ?? '';
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

    const dto: UpdateAgenteDto = {
      name:    this.formName.trim(),
      modelId: this.formModelId,
      tools:   this.formTools,
    };

    if (this.formDescription.trim()) {
      dto.description = this.formDescription.trim();
    }

    const policyId = this.formPolicyId.trim();
    dto.policyId = policyId || null;

    this.store.updateAgente(this.id, dto);
  }
}
