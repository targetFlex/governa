import { Component, Input } from '@angular/core';

export type KpiVariant = 'default' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'gov-kpi-card',
  standalone: true,
  template: `
    <article
      class="kpi kpi--{{ variant }}"
      [attr.aria-label]="ariaLabel ?? (label + ': ' + value)"
    >
      <div class="kpi__icon-wrap" aria-hidden="true">
        <svg class="kpi__icon" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5">
          <path [attr.d]="svgPath" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <span class="kpi__value">{{ value }}</span>
      <span class="kpi__label">{{ label }}</span>
    </article>
  `,
  styles: [`
    :host { display: contents; }

    .kpi {
      background: var(--gov-color-surface);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-xl);
      padding: var(--gov-space-5) var(--gov-space-6);
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-2);
      position: relative;
      overflow: hidden;
      box-shadow: var(--gov-shadow-sm);
    }

    .kpi::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
    }

    .kpi--default::before { background: var(--gov-color-primary-400); }
    .kpi--success::before { background: var(--gov-color-success-500); }
    .kpi--warning::before { background: var(--gov-color-warning-500); }
    .kpi--danger::before  { background: var(--gov-color-error-500);   }

    .kpi__icon-wrap {
      width: 36px;
      height: 36px;
      border-radius: var(--gov-radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--gov-space-1);
    }

    .kpi--default .kpi__icon-wrap { background: var(--gov-color-primary-100); color: var(--gov-color-primary-700); }
    .kpi--success .kpi__icon-wrap { background: var(--gov-color-success-100); color: var(--gov-color-success-700); }
    .kpi--warning .kpi__icon-wrap { background: var(--gov-color-warning-100); color: var(--gov-color-warning-700); }
    .kpi--danger  .kpi__icon-wrap { background: var(--gov-color-error-100);   color: var(--gov-color-error-700);   }

    .kpi__icon { width: 20px; height: 20px; }

    .kpi__value {
      font-size: var(--gov-font-size-3xl);
      font-weight: var(--gov-font-weight-bold);
      color: var(--gov-color-text-primary);
      line-height: 1;
    }

    .kpi__label {
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
      font-weight: var(--gov-font-weight-medium);
    }
  `],
})
export class GovKpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input() svgPath = '';
  @Input() variant: KpiVariant = 'default';
  @Input() ariaLabel?: string;
}
