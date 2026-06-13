// ============================================================
// politica-form.component.ts
//
// Tela de configuração de política (/politicas/:id) — E4.3.
//
// Formulário de autonomia para gestor NÃO-TÉCNICO:
//   1. Seletor de nível (cards visuais: Consultivo / Assistido / Autônomo)
//   2. Campos de limite (maxValueBrl, timeWindowH) — só ASSISTIDO/AUTONOMO
//   3. Aprovadores (lista de e-mails) — só ASSISTIDO
//   4. Ações permitidas — exibidas como tags legíveis ao gestor
//   5. Banner de sucesso com versão nova após salvar
//
// Acessibilidade (WCAG 2.1 AA):
//   - Cards de nível com role="radio" + aria-checked
//   - Campos de limite com aria-describedby para dica contextual
//   - role="alert" no banner de erro
//   - role="status" no banner de sucesso
//   - Labels explícitas em todos os inputs
//   - Botão salvar com aria-busy durante saving
// ============================================================

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  signal,
  computed,
}                               from '@angular/core';
import { CommonModule }         from '@angular/common';
import { ActivatedRoute }       from '@angular/router';
import { FormsModule }          from '@angular/forms';
import { PoliticasStore }       from '../politicas.service';
import type { AutonomyLevel, UpdatePoliticaDto } from '../../../shared/models/politica.model';

// ── Metadados dos níveis (orientados ao gestor não-técnico) ──

interface NivelMeta {
  valor:       AutonomyLevel;
  label:       string;
  descricao:   string;
  icone:       string;   // emoji / símbolo semântico
  cor:         string;   // CSS var token
  corBg:       string;
}

const NIVEIS: NivelMeta[] = [
  {
    valor:     'CONSULTIVO',
    label:     'Somente Consulta',
    descricao: 'O agente apenas lê dados e responde perguntas. Nenhuma ação é tomada sem aprovação humana.',
    icone:     '👁',
    cor:       'var(--gov-color-primary-600)',
    corBg:     'var(--gov-color-primary-50)',
  },
  {
    valor:     'ASSISTIDO',
    label:     'Com Aprovação',
    descricao: 'O agente propõe ações. Cada proposta aguarda sua aprovação antes de ser executada.',
    icone:     '🤝',
    cor:       'var(--gov-color-warning-700)',
    corBg:     'var(--gov-color-warning-100)',
  },
  {
    valor:     'AUTONOMO',
    label:     'Ação Direta',
    descricao: 'O agente age automaticamente dentro dos limites que você definir abaixo.',
    icone:     '⚡',
    cor:       'var(--gov-color-success-700)',
    corBg:     'var(--gov-color-success-100)',
  },
];

@Component({
  selector:        'app-politica-form',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:         [CommonModule, FormsModule],
  template: `
    <section class="pf" aria-label="Configuração de política">

      <!-- ── Cabeçalho ─────────────────────────────────────── -->
      <header class="pf__header">
        <a class="pf__back" routerLink="/agentes" aria-label="Voltar para lista de agentes">
          ← Agentes
        </a>
        <h1 class="pf__titulo">Configurar Política de Autonomia</h1>
        @if (store.politica()) {
          <p class="pf__versao">Versão atual: <strong>{{ store.politica()!.version }}</strong></p>
        }
      </header>

      <!-- ── Loading ───────────────────────────────────────── -->
      @if (store.loading()) {
        <div class="pf__loading" role="status" aria-live="polite">
          <div class="pf__skeleton pf__skeleton--header" aria-hidden="true"></div>
          <div class="pf__skeleton pf__skeleton--cards" aria-hidden="true"></div>
          <div class="pf__skeleton pf__skeleton--fields" aria-hidden="true"></div>
          <span class="sr-only">Carregando política…</span>
        </div>
      }

      <!-- ── Erro de carga ──────────────────────────────────── -->
      @if (store.hasError() && !store.loading() && !store.saving()) {
        <div class="pf__error" role="alert">
          <p class="pf__error-msg">{{ store.error() }}</p>
          <button class="pf__retry-btn" type="button" (click)="retry()">
            Tentar novamente
          </button>
        </div>
      }

      <!-- ── Sucesso ao salvar ──────────────────────────────── -->
      @if (store.saveSuccess()) {
        <div class="pf__success" role="status" aria-live="polite">
          ✅ Política atualizada com sucesso!
          Versão <strong>{{ store.politica()!.version }}</strong> criada.
          <button
            class="pf__dismiss-btn"
            type="button"
            aria-label="Fechar mensagem de sucesso"
            (click)="store.clearSaveSuccess()"
          >✕</button>
        </div>
      }

      <!-- ── Formulário ─────────────────────────────────────── -->
      @if (store.isLoaded() && !store.loading()) {
        <form class="pf__form" (ngSubmit)="onSubmit()" #form="ngForm" novalidate>

          <!-- Nome da política -->
          <div class="pf__field">
            <label class="pf__label" for="pf-nome">Nome da política</label>
            <input
              id="pf-nome"
              class="pf__input"
              type="text"
              name="nome"
              maxlength="120"
              required
              [(ngModel)]="formNome"
              aria-describedby="pf-nome-hint"
            />
            <span id="pf-nome-hint" class="pf__hint">
              Identifica esta política no painel e nos relatórios de auditoria.
            </span>
          </div>

          <!-- ── Seletor de nível ───────────────────────────── -->
          <fieldset class="pf__fieldset">
            <legend class="pf__legend">Nível de autonomia</legend>
            <p class="pf__legend-hint">
              Define o que o agente pode fazer por conta própria.
            </p>

            <div
              class="pf__nivel-grid"
              role="radiogroup"
              aria-label="Selecione o nível de autonomia"
            >
              @for (nivel of niveis; track nivel.valor) {
                <button
                  type="button"
                  class="pf__nivel-card"
                  [class.pf__nivel-card--selecionado]="formNivel === nivel.valor"
                  role="radio"
                  [attr.aria-checked]="formNivel === nivel.valor"
                  [attr.aria-label]="nivel.label + ': ' + nivel.descricao"
                  [style.--card-cor]="nivel.cor"
                  [style.--card-bg]="nivel.corBg"
                  (click)="selecionarNivel(nivel.valor)"
                >
                  <span class="pf__nivel-icone" aria-hidden="true">{{ nivel.icone }}</span>
                  <span class="pf__nivel-label">{{ nivel.label }}</span>
                  <span class="pf__nivel-desc">{{ nivel.descricao }}</span>
                  @if (formNivel === nivel.valor) {
                    <span class="pf__nivel-check" aria-hidden="true">✓</span>
                  }
                </button>
              }
            </div>
          </fieldset>

          <!-- ── Limites operacionais (ASSISTIDO / AUTONOMO) ── -->
          @if (formNivel !== 'CONSULTIVO') {
            <fieldset class="pf__fieldset">
              <legend class="pf__legend">Limites operacionais</legend>
              <p class="pf__legend-hint">
                O agente não pode ultrapassar estes valores em nenhuma operação.
              </p>

              <div class="pf__fields-row">
                <div class="pf__field">
                  <label class="pf__label" for="pf-valor-max">
                    Valor máximo por operação (R$)
                  </label>
                  <input
                    id="pf-valor-max"
                    class="pf__input"
                    type="number"
                    name="maxValueBrl"
                    min="0"
                    step="0.01"
                    [(ngModel)]="formMaxValue"
                    aria-describedby="pf-valor-max-hint"
                    placeholder="Ex.: 5000.00"
                  />
                  <span id="pf-valor-max-hint" class="pf__hint">
                    Deixe em branco para sem limite financeiro.
                  </span>
                </div>

                <div class="pf__field">
                  <label class="pf__label" for="pf-janela">
                    Janela de ação (horas)
                  </label>
                  <input
                    id="pf-janela"
                    class="pf__input"
                    type="number"
                    name="timeWindowH"
                    min="1"
                    step="1"
                    [(ngModel)]="formTimeWindow"
                    aria-describedby="pf-janela-hint"
                    placeholder="Ex.: 24"
                  />
                  <span id="pf-janela-hint" class="pf__hint">
                    Período em que o agente pode agir sem nova autorização.
                  </span>
                </div>
              </div>
            </fieldset>
          }

          <!-- ── Aprovadores (ASSISTIDO) ───────────────────── -->
          @if (formNivel === 'ASSISTIDO') {
            <fieldset class="pf__fieldset">
              <legend class="pf__legend">Aprovadores</legend>
              <p class="pf__legend-hint">
                Estas pessoas recebem notificação e devem aprovar cada ação
                proposta pelo agente.
              </p>

              <div class="pf__approvers-list">
                @for (email of formApprovers; track $index) {
                  <div class="pf__approver-row">
                    <input
                      class="pf__input pf__input--approver"
                      type="email"
                      [name]="'approver_' + $index"
                      [(ngModel)]="formApprovers[$index]"
                      [attr.aria-label]="'E-mail do aprovador ' + ($index + 1)"
                      placeholder="aprovador@empresa.com"
                    />
                    <button
                      type="button"
                      class="pf__remove-btn"
                      [attr.aria-label]="'Remover aprovador ' + ($index + 1)"
                      (click)="removerAprovador($index)"
                    >✕</button>
                  </div>
                }
              </div>

              <button
                type="button"
                class="pf__add-approver-btn"
                (click)="adicionarAprovador()"
              >
                + Adicionar aprovador
              </button>
            </fieldset>
          }

          <!-- ── Ações permitidas ────────────────────────────── -->
          <fieldset class="pf__fieldset">
            <legend class="pf__legend">Capacidades do agente</legend>
            <p class="pf__legend-hint">
              Estas são as operações que este agente está autorizado a
              executar dentro do nível de autonomia configurado.
            </p>
            <div class="pf__actions-grid" aria-label="Lista de capacidades">
              @for (action of formActions; track $index) {
                <span class="pf__action-tag">{{ actionLabel(action) }}</span>
              }
              @if (formActions.length === 0) {
                <span class="pf__empty-actions">Nenhuma capacidade configurada.</span>
              }
            </div>
          </fieldset>

          <!-- ── Erro de save ────────────────────────────────── -->
          @if (store.hasError() && store.saving() === false && store.saveSuccess() === false) {
            <div class="pf__error pf__error--inline" role="alert">
              {{ store.error() }}
            </div>
          }

          <!-- ── Rodapé do formulário ────────────────────────── -->
          <footer class="pf__footer">
            <button
              type="submit"
              class="pf__save-btn"
              [disabled]="store.saving() || !formNome.trim()"
              [attr.aria-busy]="store.saving()"
            >
              @if (store.saving()) {
                <span class="pf__spinner" aria-hidden="true"></span>
                Salvando…
              } @else {
                Salvar política
              }
            </button>
            <p class="pf__version-hint">
              Cada salvamento cria uma nova versão. O histórico completo fica
              no audit trail.
            </p>
          </footer>

        </form>
      }

    </section>
  `,
  styles: [`
    .pf {
      max-width: 760px;
      margin: 0 auto;
      padding: var(--gov-space-8) var(--gov-space-6);
      font-family: var(--gov-font-family-sans);
      color: var(--gov-color-text-primary);
    }

    /* ── Cabeçalho ──────────────────────────────────────────── */
    .pf__header { margin-bottom: var(--gov-space-8); }

    .pf__back {
      display: inline-block;
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-brand);
      text-decoration: none;
      margin-bottom: var(--gov-space-4);
    }
    .pf__back:hover { text-decoration: underline; }

    .pf__titulo {
      font-size: var(--gov-font-size-2xl);
      font-weight: var(--gov-font-weight-bold);
      margin: 0 0 var(--gov-space-2);
    }

    .pf__versao {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      margin: 0;
    }

    /* ── Loading skeletons ───────────────────────────────────── */
    .pf__loading { display: flex; flex-direction: column; gap: var(--gov-space-4); }

    .pf__skeleton {
      border-radius: var(--gov-radius-md);
      background: linear-gradient(
        90deg,
        var(--gov-color-neutral-100) 25%,
        var(--gov-color-neutral-50) 50%,
        var(--gov-color-neutral-100) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .pf__skeleton--header { height: 80px; }
    .pf__skeleton--cards  { height: 180px; }
    .pf__skeleton--fields { height: 120px; }

    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* ── Erro / Sucesso ──────────────────────────────────────── */
    .pf__error {
      background: var(--gov-color-error-100);
      border: 1px solid var(--gov-color-error-500);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-4);
      margin-bottom: var(--gov-space-6);
      display: flex;
      align-items: center;
      gap: var(--gov-space-4);
    }
    .pf__error--inline { margin-top: var(--gov-space-4); }
    .pf__error-msg { margin: 0; color: var(--gov-color-error-700); flex: 1; }
    .pf__retry-btn {
      padding: var(--gov-space-2) var(--gov-space-4);
      border-radius: var(--gov-radius-sm);
      border: 1px solid var(--gov-color-error-500);
      background: transparent;
      color: var(--gov-color-error-700);
      cursor: pointer;
      font-size: var(--gov-font-size-sm);
      white-space: nowrap;
    }

    .pf__success {
      background: var(--gov-color-success-100);
      border: 1px solid var(--gov-color-success-500);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-4);
      margin-bottom: var(--gov-space-6);
      color: var(--gov-color-success-700);
      display: flex;
      align-items: center;
      gap: var(--gov-space-4);
      font-size: var(--gov-font-size-sm);
    }
    .pf__dismiss-btn {
      margin-left: auto;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--gov-color-success-700);
      font-size: var(--gov-font-size-base);
    }

    /* ── Formulário ──────────────────────────────────────────── */
    .pf__form { display: flex; flex-direction: column; gap: var(--gov-space-8); }

    .pf__fieldset {
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      padding: var(--gov-space-6);
      margin: 0;
    }
    .pf__legend {
      padding: 0 var(--gov-space-2);
      font-size: var(--gov-font-size-lg);
      font-weight: var(--gov-font-weight-semibold);
    }
    .pf__legend-hint {
      margin: var(--gov-space-2) 0 var(--gov-space-4);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
    }

    /* ── Campo genérico ──────────────────────────────────────── */
    .pf__field { display: flex; flex-direction: column; gap: var(--gov-space-2); }
    .pf__label { font-size: var(--gov-font-size-sm); font-weight: var(--gov-font-weight-medium); }
    .pf__input {
      padding: var(--gov-space-3) var(--gov-space-4);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-base);
      color: var(--gov-color-text-primary);
      background: var(--gov-color-surface);
      transition: border-color 150ms;
      width: 100%;
      box-sizing: border-box;
    }
    .pf__input:focus {
      outline: 2px solid var(--gov-color-brand);
      outline-offset: 1px;
      border-color: var(--gov-color-brand);
    }
    .pf__hint {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
    }

    .pf__fields-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--gov-space-6);
    }

    /* ── Cards de nível ──────────────────────────────────────── */
    .pf__nivel-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--gov-space-4);
    }

    .pf__nivel-card {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-3);
      padding: var(--gov-space-5);
      border: 2px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      background: var(--gov-color-surface);
      cursor: pointer;
      text-align: left;
      transition: border-color 150ms, background 150ms, box-shadow 150ms;
      position: relative;
    }
    .pf__nivel-card:hover {
      border-color: var(--card-cor, var(--gov-color-brand));
      box-shadow: var(--gov-shadow-md);
    }
    .pf__nivel-card:focus-visible {
      outline: 2px solid var(--gov-color-brand);
      outline-offset: 2px;
    }
    .pf__nivel-card--selecionado {
      border-color: var(--card-cor);
      background: var(--card-bg);
    }

    .pf__nivel-icone {
      font-size: 2rem;
      line-height: 1;
    }
    .pf__nivel-label {
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
      color: var(--card-cor, var(--gov-color-text-primary));
    }
    .pf__nivel-desc {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
      line-height: var(--gov-line-height-relaxed);
    }
    .pf__nivel-check {
      position: absolute;
      top: var(--gov-space-3);
      right: var(--gov-space-4);
      font-size: var(--gov-font-size-lg);
      color: var(--card-cor);
      font-weight: var(--gov-font-weight-bold);
    }

    /* ── Aprovadores ─────────────────────────────────────────── */
    .pf__approvers-list { display: flex; flex-direction: column; gap: var(--gov-space-3); }
    .pf__approver-row   { display: flex; gap: var(--gov-space-3); align-items: center; }
    .pf__input--approver { flex: 1; }

    .pf__remove-btn {
      padding: var(--gov-space-2) var(--gov-space-3);
      border: 1px solid var(--gov-color-error-500);
      border-radius: var(--gov-radius-sm);
      background: transparent;
      color: var(--gov-color-error-700);
      cursor: pointer;
      font-size: var(--gov-font-size-sm);
      flex-shrink: 0;
    }
    .pf__add-approver-btn {
      margin-top: var(--gov-space-4);
      padding: var(--gov-space-2) var(--gov-space-5);
      border: 1px dashed var(--gov-color-brand);
      border-radius: var(--gov-radius-md);
      background: transparent;
      color: var(--gov-color-brand);
      cursor: pointer;
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
    }

    /* ── Tags de ações ───────────────────────────────────────── */
    .pf__actions-grid { display: flex; flex-wrap: wrap; gap: var(--gov-space-2); }
    .pf__action-tag {
      padding: var(--gov-space-1) var(--gov-space-3);
      background: var(--gov-color-primary-50);
      border: 1px solid var(--gov-color-primary-200);
      border-radius: var(--gov-radius-full);
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-primary-700);
      font-family: var(--gov-font-family-mono);
    }
    .pf__empty-actions {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
    }

    /* ── Rodapé ──────────────────────────────────────────────── */
    .pf__footer { display: flex; flex-direction: column; gap: var(--gov-space-3); }
    .pf__save-btn {
      padding: var(--gov-space-4) var(--gov-space-8);
      background: var(--gov-color-brand);
      color: var(--gov-color-text-inverse);
      border: none;
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--gov-space-3);
      align-self: flex-start;
      transition: background 150ms;
    }
    .pf__save-btn:hover:not(:disabled) { background: var(--gov-color-brand-hover); }
    .pf__save-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .pf__version-hint {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
      margin: 0;
    }

    /* ── Spinner ─────────────────────────────────────────────── */
    .pf__spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Acessibilidade ──────────────────────────────────────── */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0,0,0,0);
      white-space: nowrap;
      border-width: 0;
    }
  `],
})
export class PoliticaFormComponent implements OnInit, OnDestroy {
  readonly store  = inject(PoliticasStore);
  readonly route  = inject(ActivatedRoute);
  readonly niveis = NIVEIS;

  // ── Estado local do formulário (controlado) ──────────────────
  formNome       = '';
  formNivel:     AutonomyLevel = 'CONSULTIVO';
  formMaxValue:  number | null = null;
  formTimeWindow: number | null = null;
  formApprovers: string[] = [];
  formActions:   string[] = [];

  private policyId = '';

  ngOnInit(): void {
    this.policyId = this.route.snapshot.paramMap.get('id') ?? '';
    if (this.policyId) {
      this.store.loadPolitica(this.policyId);
    }
    // Sincroniza form quando politica() carrega
    this.syncForm();
  }

  ngOnDestroy(): void {
    this.store.clearError();
    this.store.clearSaveSuccess();
  }

  // ── Sincronização store → form ───────────────────────────────

  syncForm(): void {
    const p = this.store.politica();
    if (!p) return;
    this.formNome        = p.name;
    this.formNivel       = p.autonomyLevel;
    this.formMaxValue    = p.maxValueBrl   ?? null;
    this.formTimeWindow  = p.timeWindowH   ?? null;
    this.formApprovers   = [...p.approvers];
    this.formActions     = [...p.allowedActions];
  }

  // ── Ações do formulário ──────────────────────────────────────

  selecionarNivel(nivel: AutonomyLevel): void {
    this.formNivel = nivel;
    // Reset aprovadores ao sair de ASSISTIDO
    if (nivel !== 'ASSISTIDO') this.formApprovers = [];
    // Reset limites ao voltar para CONSULTIVO
    if (nivel === 'CONSULTIVO') {
      this.formMaxValue   = null;
      this.formTimeWindow = null;
    }
  }

  adicionarAprovador(): void {
    this.formApprovers = [...this.formApprovers, ''];
  }

  removerAprovador(index: number): void {
    this.formApprovers = this.formApprovers.filter((_, i) => i !== index);
  }

  retry(): void {
    this.store.clearError();
    if (this.policyId) this.store.loadPolitica(this.policyId);
  }

  onSubmit(): void {
    if (!this.policyId || !this.formNome.trim()) return;

    const dto: UpdatePoliticaDto = {
      name:          this.formNome.trim(),
      autonomyLevel: this.formNivel,
      approvers:     this.formApprovers.filter((e) => e.trim()),
    };

    if (this.formNivel !== 'CONSULTIVO') {
      dto.maxValueBrl  = this.formMaxValue;
      dto.timeWindowH  = this.formTimeWindow;
    }

    this.store.savePolitica(this.policyId, dto);
  }

  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Converte nome técnico de action em label legível ao gestor.
   * Ex.: "read_protheus_pedido" → "Consultar pedido (Protheus)"
   */
  actionLabel(action: string): string {
    const MAP: Record<string, string> = {
      'read_protheus_pedido':     'Consultar pedido (Protheus)',
      'read_protheus_cliente':    'Consultar cliente (Protheus)',
      'read_protheus_estoque':    'Consultar estoque (Protheus)',
      'write_protheus_pedido':    'Criar/atualizar pedido (Protheus)',
      'read_carol_produto':       'Buscar produto (Carol)',
      'write_carol_sugestao':     'Registrar sugestão (Carol)',
    };
    return MAP[action] ?? action;
  }
}
