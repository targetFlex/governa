import { Component, Input } from '@angular/core';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';
export type BadgeSize    = 'sm' | 'md';

@Component({
  selector: 'gov-badge',
  standalone: true,
  template: `
    <span
      class="gov-badge gov-badge--{{ variant }} gov-badge--{{ size }}"
      [attr.aria-label]="ariaLabel ?? null"
    ><ng-content /></span>
  `,
  styles: [`
    :host { display: contents; }

    .gov-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--gov-font-weight-semibold);
      border-radius: var(--gov-radius-full);
      white-space: nowrap;
      line-height: 1;
    }

    .gov-badge--sm {
      font-size: var(--gov-font-size-xs);
      padding: 2px 8px;
      min-width: 20px;
      height: 20px;
    }

    .gov-badge--md {
      font-size: var(--gov-font-size-sm);
      padding: 3px 12px;
      min-width: 24px;
      height: 24px;
    }

    .gov-badge--primary { background: var(--gov-color-primary-100); color: var(--gov-color-primary-700); }
    .gov-badge--success { background: var(--gov-color-success-100); color: var(--gov-color-success-700); }
    .gov-badge--warning { background: var(--gov-color-warning-100); color: var(--gov-color-warning-700); }
    .gov-badge--error   { background: var(--gov-color-error-100);   color: var(--gov-color-error-700);   }
    .gov-badge--neutral { background: var(--gov-color-neutral-100); color: var(--gov-color-neutral-700); }
  `],
})
export class GovBadgeComponent {
  @Input() variant: BadgeVariant = 'primary';
  @Input() size: BadgeSize       = 'sm';
  @Input() ariaLabel?: string;
}
