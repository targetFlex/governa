import { Component, Input, Output, EventEmitter } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize    = 'sm' | 'md' | 'lg';

@Component({
  selector: 'gov-button',
  standalone: true,
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [attr.aria-busy]="loading || null"
      [attr.aria-label]="ariaLabel ?? null"
      class="gov-btn gov-btn--{{ variant }} gov-btn--{{ size }}"
      [class.gov-btn--full-width]="fullWidth"
      (click)="clicked.emit($event)"
    >
      @if (loading) {
        <span class="gov-btn__spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: [`
    :host { display: contents; }

    .gov-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--gov-space-2);
      font-family: inherit;
      font-weight: var(--gov-font-weight-semibold);
      border-radius: var(--gov-radius-md);
      border: 1px solid transparent;
      cursor: pointer;
      transition: background var(--gov-transition-fast),
                  border-color var(--gov-transition-fast),
                  color var(--gov-transition-fast),
                  opacity var(--gov-transition-fast);
      white-space: nowrap;

      &:focus-visible {
        outline: 2px solid var(--gov-color-brand);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    }

    /* sizes */
    .gov-btn--sm { font-size: var(--gov-font-size-xs); padding: var(--gov-space-1) var(--gov-space-3); }
    .gov-btn--md { font-size: var(--gov-font-size-sm); padding: var(--gov-space-2) var(--gov-space-4); }
    .gov-btn--lg { font-size: var(--gov-font-size-base); padding: var(--gov-space-3) var(--gov-space-6); }

    /* variants */
    .gov-btn--primary {
      background: var(--gov-color-brand);
      color: var(--gov-color-white);
      &:hover:not(:disabled) { background: var(--gov-color-brand-hover); }
    }

    .gov-btn--secondary {
      background: var(--gov-color-surface);
      color: var(--gov-color-text-primary);
      border-color: var(--gov-color-border);
      &:hover:not(:disabled) { background: var(--gov-color-neutral-100); }
    }

    .gov-btn--ghost {
      background: transparent;
      color: var(--gov-color-text-secondary);
      border-color: transparent;
      &:hover:not(:disabled) { background: var(--gov-color-neutral-100); color: var(--gov-color-text-primary); }
    }

    .gov-btn--danger {
      background: var(--gov-color-error-100);
      color: var(--gov-color-error-700);
      border-color: transparent;
      &:hover:not(:disabled) { background: var(--gov-color-error-500); color: var(--gov-color-white); }
    }

    /* spinner */
    .gov-btn__spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: gov-spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    .gov-btn--full-width { width: 100%; }

    @keyframes gov-spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class GovButtonComponent {
  @Input() variant: ButtonVariant  = 'primary';
  @Input() size: ButtonSize        = 'md';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled   = false;
  @Input() loading    = false;
  @Input() fullWidth  = false;
  @Input() ariaLabel?: string;

  @Output() clicked = new EventEmitter<MouseEvent>();
}
