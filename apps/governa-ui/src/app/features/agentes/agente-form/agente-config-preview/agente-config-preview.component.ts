// ============================================================
// agente-config-preview.component.ts
//
// Painel de preview de configuração do agente (E8) — SOMENTE LEITURA.
//
//   - Toggle "Pretty" / "Code" (como Railway).
//   - Pretty: resumo legível dos campos preenchidos.
//   - Code:   bloco YAML gerado ao vivo a partir do form state.
//   - Botão "Copiar" (copia o YAML).
//
// Componente presentacional puro: recebe `config` + `yaml` já computados
// pelo orquestrador (funções puras em agente-form.utils.ts) e apenas
// apresenta. Nenhuma regra de negócio aqui.
//
// Acessibilidade (spec §11):
//   - Toggle: role="tablist" / role="tab" com aria-selected.
//   - YAML read-only: <pre aria-label> navegável por teclado (tabindex="0").
// ============================================================

import {
  Component,
  Input,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentConfig } from '../agente-form.utils';

type PreviewMode = 'pretty' | 'code';

@Component({
  selector:        'app-agente-config-preview',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:         [CommonModule],
  template: `
    <aside class="acp" aria-label="Preview da configuração do agente">

      <header class="acp__header">
        <div class="acp__toggle" role="tablist" aria-label="Formato do preview">
          <button
            class="acp__toggle-btn"
            role="tab"
            type="button"
            [class.acp__toggle-btn--active]="mode() === 'pretty'"
            [attr.aria-selected]="mode() === 'pretty'"
            (click)="setMode('pretty')"
          >Pretty</button>
          <button
            class="acp__toggle-btn"
            role="tab"
            type="button"
            [class.acp__toggle-btn--active]="mode() === 'code'"
            [attr.aria-selected]="mode() === 'code'"
            (click)="setMode('code')"
          >Code</button>
        </div>

        <button
          class="acp__copy"
          type="button"
          (click)="copy()"
          [attr.aria-label]="copied() ? 'Configuração copiada' : 'Copiar configuração em YAML'"
        >
          {{ copied() ? 'Copiado!' : 'Copiar' }}
        </button>
      </header>

      <!-- ── Pretty ─────────────────────────────────────────────── -->
      @if (mode() === 'pretty') {
        <dl class="acp__pretty">
          <div class="acp__row">
            <dt class="acp__key">Nome</dt>
            <dd class="acp__val">{{ config.name || '—' }}</dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Modelo</dt>
            <dd class="acp__val">{{ config.model || '—' }}</dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Descrição</dt>
            <dd class="acp__val">{{ config.description || '—' }}</dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">System prompt</dt>
            <dd class="acp__val acp__val--pre">{{ config.system || '—' }}</dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Ferramentas</dt>
            <dd class="acp__val">
              @if (config.tools.length) {
                <ul class="acp__list">
                  @for (t of config.tools; track t) { <li>{{ t }}</li> }
                </ul>
              } @else { — }
            </dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Skills</dt>
            <dd class="acp__val">
              @if (config.skills.length) {
                <ul class="acp__list">
                  @for (s of config.skills; track s) { <li>{{ s }}</li> }
                </ul>
              } @else { — }
            </dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Conectores MCP</dt>
            <dd class="acp__val">
              @if (config.mcpServers.length) {
                <ul class="acp__list">
                  @for (m of config.mcpServers; track m.id) { <li>{{ m.name }}</li> }
                </ul>
              } @else { — }
            </dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Política</dt>
            <dd class="acp__val">{{ config.policy || '—' }}</dd>
          </div>
          <div class="acp__row">
            <dt class="acp__key">Template</dt>
            <dd class="acp__val">{{ config.template || '—' }}</dd>
          </div>
        </dl>
      }

      <!-- ── Code (YAML read-only) ─────────────────────────────── -->
      @if (mode() === 'code') {
        <pre
          class="acp__code"
          tabindex="0"
          aria-label="Configuração do agente em YAML"
        >{{ yaml }}</pre>
      }
    </aside>
  `,
  styles: [`
    .acp {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-3);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      padding: var(--gov-space-4);
      background: var(--gov-color-surface);
    }

    .acp__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gov-space-3);
    }

    .acp__toggle {
      display: inline-flex;
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      overflow: hidden;
    }
    .acp__toggle-btn {
      background: none;
      border: none;
      padding: var(--gov-space-1) var(--gov-space-3);
      font-family: inherit;
      font-size: var(--gov-font-size-xs);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-secondary);
      cursor: pointer;
    }
    .acp__toggle-btn--active {
      background: var(--gov-color-brand);
      color: #fff;
    }
    .acp__toggle-btn:focus-visible { outline: 2px solid var(--gov-color-brand); outline-offset: -2px; }

    .acp__copy {
      background: none;
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-1) var(--gov-space-3);
      font-family: inherit;
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-primary);
      cursor: pointer;
    }
    .acp__copy:hover { border-color: var(--gov-color-brand); }
    .acp__copy:focus-visible { outline: 2px solid var(--gov-color-brand); outline-offset: 2px; }

    /* ── Pretty ── */
    .acp__pretty { margin: 0; display: flex; flex-direction: column; gap: var(--gov-space-3); }
    .acp__row { display: flex; flex-direction: column; gap: var(--gov-space-1); }
    .acp__key {
      font-size: var(--gov-font-size-xs);
      font-weight: var(--gov-font-weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--gov-color-text-secondary);
    }
    .acp__val {
      margin: 0;
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-primary);
      word-break: break-word;
    }
    .acp__val--pre { white-space: pre-wrap; }
    .acp__list { margin: 0; padding-left: var(--gov-space-5); }

    /* ── Code ── */
    .acp__code {
      margin: 0;
      background: var(--gov-color-neutral-100);
      border-radius: var(--gov-radius-md);
      padding: var(--gov-space-4);
      font-family: var(--gov-font-family-mono, monospace);
      font-size: var(--gov-font-size-xs);
      line-height: var(--gov-line-height-relaxed);
      color: var(--gov-color-text-primary);
      overflow-x: auto;
      white-space: pre;
    }
    .acp__code:focus-visible { outline: 2px solid var(--gov-color-brand); outline-offset: 2px; }
  `],
})
export class AgenteConfigPreviewComponent {
  @Input({ required: true }) config!: AgentConfig;
  @Input() yaml = '';

  protected readonly mode   = signal<PreviewMode>('pretty');
  protected readonly copied = signal(false);

  setMode(mode: PreviewMode): void {
    this.mode.set(mode);
  }

  copy(): void {
    const done = () => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    };
    const clip = navigator?.clipboard;
    if (clip?.writeText) {
      clip.writeText(this.yaml).then(done).catch(() => { /* clipboard indisponível — silencioso */ });
    } else {
      done();
    }
  }
}
