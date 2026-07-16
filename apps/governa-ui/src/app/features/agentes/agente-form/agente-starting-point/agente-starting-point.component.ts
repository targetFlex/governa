// ============================================================
// agente-starting-point.component.ts
//
// Passo 1 da criação de agente (E8): "Ponto de partida".
//
//   - Tab "Descrever seu agente"  → fase 2, desabilitada (tooltip "em breve").
//   - Tab "Modelo" (default)      → galeria de templates do domínio TOTVS.
//
// Emite (templateSelect) quando um template é escolhido. Não guarda estado
// de formulário — apenas apresenta a galeria e destaca a seleção atual.
//
// Acessibilidade (WCAG 2.1 AA, spec §11):
//   - Tabs: role="tablist" / role="tab" com aria-selected e aria-disabled.
//   - Galeria: role="radiogroup"; cada card role="radio" com aria-checked.
//   - Navegação por teclado: setas movem o foco (roving tabindex),
//     Enter/Espaço selecionam (nativo do <button>).
// ============================================================

import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgentTemplate, TEMPLATES } from '../agente-templates.data';

type StartingTab = 'descrever' | 'modelo';

@Component({
  selector:        'app-agente-starting-point',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports:         [CommonModule],
  template: `
    <section class="asp" aria-label="Ponto de partida do agente">

      <!-- ── Tabs ─────────────────────────────────────────────── -->
      <div class="asp__tabs" role="tablist" aria-label="Como começar">
        <button
          class="asp__tab"
          role="tab"
          type="button"
          [attr.aria-selected]="activeTab === 'descrever'"
          [attr.aria-disabled]="true"
          [disabled]="true"
          title="Em breve — geração assistida por descrição (fase 2)"
        >
          Descrever seu agente
          <span class="asp__tab-badge">em breve</span>
        </button>
        <button
          class="asp__tab asp__tab--active"
          role="tab"
          type="button"
          [attr.aria-selected]="activeTab === 'modelo'"
        >
          Modelo
        </button>
      </div>

      <!-- ── Galeria de templates ─────────────────────────────── -->
      <p class="asp__hint" id="asp-gallery-hint">
        Escolha um modelo do seu domínio como ponto de partida. Tudo é editável
        no próximo passo.
      </p>

      <div
        class="asp__grid"
        role="radiogroup"
        aria-labelledby="asp-gallery-hint"
        (keydown)="onGridKeydown($event)"
      >
        @for (tpl of templates; track tpl.id; let i = $index) {
          <button
            type="button"
            class="asp__card"
            role="radio"
            [class.asp__card--selected]="tpl.id === selectedTemplateId"
            [attr.aria-checked]="tpl.id === selectedTemplateId"
            [attr.tabindex]="rovingTabindex(tpl.id, i)"
            [attr.data-index]="i"
            (click)="select(tpl)"
          >
            <span class="asp__card-icon" aria-hidden="true">{{ tpl.icon }}</span>
            <span class="asp__card-body">
              <span class="asp__card-name">{{ tpl.name }}</span>
              <span class="asp__card-desc">{{ tpl.description }}</span>
            </span>
          </button>
        }
      </div>
    </section>
  `,
  styles: [`
    .asp { display: flex; flex-direction: column; gap: var(--gov-space-5); }

    /* ── Tabs ── */
    .asp__tabs {
      display: flex;
      gap: var(--gov-space-2);
      border-bottom: 1px solid var(--gov-color-border);
    }
    .asp__tab {
      position: relative;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      padding: var(--gov-space-3) var(--gov-space-4);
      font-family: inherit;
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--gov-space-2);
    }
    .asp__tab--active {
      color: var(--gov-color-brand);
      border-bottom-color: var(--gov-color-brand);
    }
    .asp__tab:disabled { cursor: not-allowed; opacity: 0.6; }
    .asp__tab:focus-visible { outline: 2px solid var(--gov-color-brand); outline-offset: 2px; }
    .asp__tab-badge {
      font-size: var(--gov-font-size-xs);
      background: var(--gov-color-neutral-100);
      color: var(--gov-color-text-secondary);
      border-radius: var(--gov-radius-sm);
      padding: 0 var(--gov-space-2);
    }

    .asp__hint {
      margin: 0;
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
    }

    /* ── Grid ── */
    .asp__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--gov-space-4);
    }

    .asp__card {
      display: flex;
      align-items: flex-start;
      gap: var(--gov-space-3);
      text-align: left;
      padding: var(--gov-space-4);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-lg);
      background: var(--gov-color-surface);
      font-family: inherit;
      cursor: pointer;
      transition: border-color var(--gov-transition-fast),
                  box-shadow var(--gov-transition-fast);
    }
    .asp__card:hover { border-color: var(--gov-color-brand); }
    .asp__card:focus-visible { outline: 2px solid var(--gov-color-brand); outline-offset: 2px; }
    .asp__card--selected {
      border-color: var(--gov-color-brand);
      box-shadow: 0 0 0 3px var(--gov-color-primary-100);
    }

    .asp__card-icon { font-size: 1.5rem; line-height: 1; }
    .asp__card-body { display: flex; flex-direction: column; gap: var(--gov-space-1); }
    .asp__card-name {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-semibold);
      color: var(--gov-color-text-primary);
    }
    .asp__card-desc {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
      line-height: var(--gov-line-height-relaxed);
    }

    @media (max-width: 640px) {
      .asp__grid { grid-template-columns: 1fr; }
    }
  `],
})
export class AgenteStartingPointComponent {
  /** Template atualmente selecionado (para destaque + aria-checked). */
  @Input() selectedTemplateId: string | null = null;

  /** Emitido quando o usuário escolhe um template. */
  @Output() templateSelect = new EventEmitter<AgentTemplate>();

  readonly templates = TEMPLATES;
  readonly activeTab: StartingTab = 'modelo';

  select(template: AgentTemplate): void {
    this.templateSelect.emit(template);
  }

  /**
   * Roving tabindex: o card selecionado é focável (0); se nada selecionado,
   * o primeiro card é focável. Os demais ficam com -1.
   */
  rovingTabindex(templateId: string, index: number): number {
    if (this.selectedTemplateId) {
      return templateId === this.selectedTemplateId ? 0 : -1;
    }
    return index === 0 ? 0 : -1;
  }

  /** Navegação por setas dentro do radiogroup (a11y de radiogroup). */
  onGridKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    if (!keys.includes(event.key)) return;

    const target = event.target as HTMLElement;
    const currentIndex = Number(target.getAttribute('data-index'));
    if (Number.isNaN(currentIndex)) return;

    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const nextIndex = forward
      ? (currentIndex + 1) % this.templates.length
      : (currentIndex - 1 + this.templates.length) % this.templates.length;

    const grid = target.closest('.asp__grid');
    const next = grid?.querySelector<HTMLElement>(`[data-index="${nextIndex}"]`);
    if (next) {
      event.preventDefault();
      next.focus();
    }
  }
}
