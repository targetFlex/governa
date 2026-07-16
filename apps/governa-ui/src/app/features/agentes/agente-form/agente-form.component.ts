// ============================================================
// agente-form.component.ts
//
// Tela de criação de agente (/agentes/novo) — E8 (jornada com templates).
//
// Fluxo em 2 passos:
//   Passo 1 — Ponto de partida: galeria de templates do domínio TOTVS
//             (tab "Descrever" desabilitada — fase 2).
//   Passo 2 — Formulário estendido + painel de preview (Pretty/Code):
//               1. Nome do agente (obrigatório, max 120)
//               2. Descrição (opcional, max 500)
//               3. Modelo de IA (select)
//               4. Ferramentas habilitadas (checkboxes)
//               5. System Prompt (textarea, opcional, max 4000)  [NOVO]
//               6. Skills (multi-select, pode ficar vazio)        [NOVO]
//               7. Política de autonomia (UUID opcional)
//
// Novo agente é criado com status SANDBOX. Após sucesso navega para /agentes.
//
// Estado em propriedades simples + signals locais (sem NGRX neste componente,
// consistente com o padrão original). Serialização do preview e merge de
// template ficam em funções puras (agente-form.utils.ts).
//
// Acessibilidade (WCAG 2.1 AA): ver agente-starting-point / agente-config-preview
// e os aria-describedby/labels dos campos abaixo.
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
import { CommonModule }       from '@angular/common';
import { FormsModule }        from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AgentesStore }       from '../agentes.service';
import { AuthService }        from '../../../core/auth/auth.service';
import { GovInputComponent }  from '../../../shared/ui/input/gov-input.component';
import { GovSelectComponent, SelectOption } from '../../../shared/ui/select/gov-select.component';
import { GovButtonComponent } from '../../../shared/ui/button/gov-button.component';
import { CreateAgenteDto, McpServerRef } from '../../../shared/models/agente.model';
import { AgenteStartingPointComponent } from './agente-starting-point/agente-starting-point.component';
import { AgenteConfigPreviewComponent } from './agente-config-preview/agente-config-preview.component';
import { AgentTemplate, BLANK_TEMPLATE_ID } from './agente-templates.data';
import {
  AgentFormState,
  AgentConfig,
  buildAgentConfig,
  buildAgentYamlPreview,
  mergeTemplateFields,
  TemplateFields,
} from './agente-form.utils';

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
  { value: 'read_protheus_pedido',     label: 'Consultar pedido',          hint: 'Lê dados de pedidos no Protheus' },
  { value: 'read_protheus_cliente',    label: 'Consultar cliente',         hint: 'Lê dados de clientes no Protheus' },
  { value: 'read_protheus_nf',         label: 'Consultar nota fiscal',     hint: 'Lê NFs emitidas no Protheus' },
  { value: 'read_politica_atendimento', label: 'Consultar política interna', hint: 'Acessa base de conhecimento interna' },
];

// ── Skills disponíveis (multi-select, catálogo inicial) ──────

interface SkillOption {
  value: string;
  label: string;
  hint:  string;
}

const SKILLS: SkillOption[] = [
  { value: 'resumo-executivo', label: 'Resumo executivo', hint: 'Condensa respostas longas em pontos objetivos' },
  { value: 'traducao',         label: 'Tradução',          hint: 'Traduz respostas entre PT/EN/ES' },
  { value: 'extracao-dados',   label: 'Extração de dados',  hint: 'Estrutura dados de texto livre em tabela' },
];

@Component({
  selector:        'app-agente-form',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule, RouterLink,
    GovInputComponent, GovSelectComponent, GovButtonComponent,
    AgenteStartingPointComponent, AgenteConfigPreviewComponent,
  ],
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

      <!-- ══ PASSO 1 — Ponto de partida ══════════════════════════ -->
      @if (step() === 1) {
        <app-agente-starting-point
          [selectedTemplateId]="selectedTemplateId"
          (templateSelect)="selectTemplate($event)"
        />
      }

      <!-- ══ PASSO 2 — Formulário + Preview ══════════════════════ -->
      @if (step() === 2) {
        <div class="af__step2">

          <!-- Coluna do formulário -->
          <form class="af__form" (ngSubmit)="onSubmit()" #form="ngForm" novalidate>

            <button type="button" class="af__change-template" (click)="backToStartingPoint()">
              ← Trocar modelo
              @if (selectedTemplateName()) {
                <span class="af__current-template">({{ selectedTemplateName() }})</span>
              }
            </button>

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

            <!-- System Prompt (NOVO) -->
            <div class="af__field">
              <label for="af-system-prompt" class="af__label">System Prompt</label>
              <textarea
                id="af-system-prompt"
                class="af__textarea"
                name="systemPrompt"
                rows="6"
                [maxlength]="4000"
                [(ngModel)]="formSystemPrompt"
                aria-describedby="af-system-prompt-hint"
              ></textarea>
              <span id="af-system-prompt-hint" class="af__hint">
                Instruções base do agente. Pré-preenchido pelo modelo escolhido; edite livremente (máx. 4000 caracteres).
              </span>
            </div>

            <!-- Skills (NOVO) -->
            <fieldset class="af__fieldset">
              <legend class="af__legend">Skills</legend>
              <p class="af__legend-hint">
                Módulos de capacidade opcionais. Pode ficar vazio nesta fase.
              </p>
              <div class="af__tools-grid" role="group" aria-label="Selecionar skills">
                @for (skill of skillsCatalog; track skill.value) {
                  <label class="af__tool-item" [attr.aria-label]="skill.label + ': ' + skill.hint">
                    <input
                      type="checkbox"
                      class="af__tool-checkbox"
                      [name]="'skill_' + skill.value"
                      [checked]="isSkillSelected(skill.value)"
                      (change)="toggleSkill(skill.value)"
                    />
                    <span class="af__tool-label">{{ skill.label }}</span>
                    <span class="af__tool-hint">{{ skill.hint }}</span>
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

          <!-- Coluna do preview -->
          <app-agente-config-preview
            class="af__preview"
            [config]="previewConfig()"
            [yaml]="previewYaml()"
          />
        </div>
      }

    </section>
  `,
  styles: [`
    .af {
      max-width: 1080px;
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

    /* ── Passo 2: layout duas colunas ── */
    .af__step2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 380px);
      gap: var(--gov-space-8);
      align-items: start;
    }

    /* ── Formulário ── */
    .af__form { display: flex; flex-direction: column; gap: var(--gov-space-6); }

    .af__change-template {
      align-self: flex-start;
      background: none;
      border: none;
      padding: 0;
      font-family: inherit;
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-brand);
      cursor: pointer;
    }
    .af__change-template:hover { text-decoration: underline; }
    .af__change-template:focus-visible { outline: 2px solid var(--gov-color-brand); outline-offset: 2px; }
    .af__current-template { color: var(--gov-color-text-secondary); }

    /* ── Campo genérico (textarea) ── */
    .af__field { display: flex; flex-direction: column; gap: var(--gov-space-1); }
    .af__label {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-primary);
    }
    .af__textarea {
      width: 100%;
      padding: var(--gov-space-2) var(--gov-space-3);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      font-family: inherit;
      color: var(--gov-color-text-primary);
      background: var(--gov-color-surface);
      outline: none;
      resize: vertical;
      min-height: 96px;
      transition: border-color var(--gov-transition-fast), box-shadow var(--gov-transition-fast);
    }
    .af__textarea:focus {
      border-color: var(--gov-color-brand);
      box-shadow: 0 0 0 3px var(--gov-color-primary-100);
    }
    .af__hint { font-size: var(--gov-font-size-xs); color: var(--gov-color-text-secondary); }

    /* ── Ferramentas / Skills ── */
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

    .af__preview { position: sticky; top: var(--gov-space-6); }

    @media (max-width: 900px) {
      .af__step2 { grid-template-columns: 1fr; }
      .af__preview { position: static; }
    }

    @media (max-width: 640px) {
      .af { padding: var(--gov-space-5) var(--gov-space-4); }
      .af__footer { flex-wrap: wrap; gap: var(--gov-space-3); }
    }
  `],
})
export class AgenteFormComponent implements OnInit, OnDestroy {
  readonly store  = inject(AgentesStore);
  readonly auth   = inject(AuthService);
  readonly router = inject(Router);

  readonly modelos       = MODELOS;
  readonly tools         = TOOLS;
  readonly skillsCatalog = SKILLS;

  /** Passo atual do fluxo (1 = ponto de partida, 2 = formulário). */
  readonly step = signal<1 | 2>(1);

  // ── Estado do formulário ──
  formName         = '';
  formDescription  = '';
  formModelId      = 'claude-sonnet-5';
  formTools:       string[] = [];
  formSystemPrompt = '';
  formSkills:      string[] = [];
  formPolicyId     = '';

  /** Conectores MCP — metadado descritivo nesta fase (sem editor de UI). */
  formMcpServers: McpServerRef[] = [];

  /** id do template selecionado (null = nenhum ainda). */
  selectedTemplateId: string | null = null;

  /** Valores-placeholder do último template aplicado — base do merge. */
  private prevTemplateFields: TemplateFields | null = null;

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

  // ── Passo 1 → 2: seleção de template ──────────────────────────

  /**
   * Aplica um template ao formulário preservando edições manuais
   * (merge: sobrescreve apenas campos ainda no valor-placeholder anterior)
   * e avança para o passo 2.
   */
  selectTemplate(template: AgentTemplate): void {
    const next: TemplateFields = {
      formName:        template.formName,
      formDescription: template.formDescription,
      tools:           template.tools,
      systemPrompt:    template.systemPrompt,
    };

    const current: TemplateFields = {
      formName:        this.formName,
      formDescription: this.formDescription,
      tools:           this.formTools,
      systemPrompt:    this.formSystemPrompt,
    };

    const merged = mergeTemplateFields(current, this.prevTemplateFields, next);

    this.formName         = merged.formName;
    this.formDescription  = merged.formDescription;
    this.formTools        = [...merged.tools];
    this.formSystemPrompt = merged.systemPrompt;
    // mcpServers é metadado do template (sem editor de UI) — sobrescreve direto.
    this.formMcpServers   = template.mcpServers.map((m) => ({ ...m }));

    this.prevTemplateFields = next;
    this.selectedTemplateId = template.id;
    this.step.set(2);
  }

  backToStartingPoint(): void {
    this.step.set(1);
  }

  selectedTemplateName(): string | null {
    if (!this.selectedTemplateId) return null;
    return this.selectedTemplateId === BLANK_TEMPLATE_ID ? 'Agente em branco' : this.selectedTemplateId;
  }

  // ── Ferramentas ───────────────────────────────────────────────

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

  // ── Skills ────────────────────────────────────────────────────

  isSkillSelected(value: string): boolean {
    return this.formSkills.includes(value);
  }

  toggleSkill(value: string): void {
    if (this.formSkills.includes(value)) {
      this.formSkills = this.formSkills.filter((s) => s !== value);
    } else {
      this.formSkills = [...this.formSkills, value];
    }
  }

  // ── Preview (funções puras) ───────────────────────────────────

  private buildState(): AgentFormState {
    return {
      name:         this.formName,
      description:  this.formDescription,
      modelId:      this.formModelId,
      tools:        this.formTools,
      systemPrompt: this.formSystemPrompt,
      skills:       this.formSkills,
      mcpServers:   this.formMcpServers,
      policyId:     this.formPolicyId,
      templateId:   this.effectiveTemplateId(),
    };
  }

  previewConfig(): AgentConfig {
    return buildAgentConfig(this.buildState());
  }

  previewYaml(): string {
    return buildAgentYamlPreview(this.buildState());
  }

  // ── Submit ────────────────────────────────────────────────────

  isFormValid(): boolean {
    return (
      this.formName.trim().length > 0 &&
      this.formName.length <= 120 &&
      !!this.formModelId &&
      !this.policyIdError
    );
  }

  /** templateId efetivo enviado ao backend — null quando "Agente em branco". */
  private effectiveTemplateId(): string | null {
    if (!this.selectedTemplateId || this.selectedTemplateId === BLANK_TEMPLATE_ID) return null;
    return this.selectedTemplateId;
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

    const systemPrompt = this.formSystemPrompt.trim();
    if (systemPrompt) {
      dto.systemPrompt = systemPrompt;
    }

    if (this.formSkills.length > 0) {
      dto.skills = [...this.formSkills];
    }

    if (this.formMcpServers.length > 0) {
      dto.mcpServers = [...this.formMcpServers];
    }

    const templateId = this.effectiveTemplateId();
    if (templateId) {
      dto.templateId = templateId;
    }

    const policyId = this.formPolicyId.trim();
    if (policyId) {
      dto.policyId = policyId;
    }

    this.store.createAgente(dto);
  }
}
