import {
  Component,
  Input,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

let selectIdCounter = 0;

@Component({
  selector: 'gov-select',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GovSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="gov-field"
      [class.gov-field--error]="!!error"
      [class.gov-field--disabled]="isDisabled"
    >
      @if (label) {
        <label [for]="fieldId" class="gov-field__label">
          {{ label }}
          @if (required) {
            <span class="gov-field__required" aria-hidden="true">*</span>
          }
        </label>
      }

      <div class="gov-field__select-wrapper">
        <select
          [id]="fieldId"
          [disabled]="isDisabled"
          [required]="required"
          [attr.aria-describedby]="(hint || error) ? fieldId + '-desc' : null"
          [attr.aria-invalid]="error ? 'true' : null"
          [attr.aria-required]="required || null"
          class="gov-field__select"
          (change)="onSelectChange($event)"
          (blur)="onBlur()"
        >
          @if (placeholder) {
            <option value="" [disabled]="required" [selected]="value === ''">
              {{ placeholder }}
            </option>
          }
          @for (opt of options; track opt.value) {
            <option
              [value]="opt.value"
              [disabled]="opt.disabled ?? false"
              [selected]="opt.value === value"
            >{{ opt.label }}</option>
          }
        </select>

        <!-- Chevron icon -->
        <svg class="gov-field__chevron" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd" />
        </svg>
      </div>

      @if (hint && !error) {
        <span [id]="fieldId + '-desc'" class="gov-field__hint">{{ hint }}</span>
      }
      @if (error) {
        <span [id]="fieldId + '-desc'" class="gov-field__error" role="alert">{{ error }}</span>
      }
    </div>
  `,
  styles: [`
    .gov-field {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-1);
    }

    .gov-field__label {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-primary);
      display: flex;
      align-items: center;
      gap: var(--gov-space-1);
    }

    .gov-field__required {
      color: var(--gov-color-error-500);
    }

    .gov-field__select-wrapper {
      position: relative;
    }

    .gov-field__select {
      width: 100%;
      padding: var(--gov-space-2) var(--gov-space-8) var(--gov-space-2) var(--gov-space-3);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      font-family: inherit;
      color: var(--gov-color-text-primary);
      background: var(--gov-color-surface);
      appearance: none;
      outline: none;
      cursor: pointer;
      transition: border-color var(--gov-transition-fast),
                  box-shadow var(--gov-transition-fast);

      &:focus {
        border-color: var(--gov-color-brand);
        box-shadow: 0 0 0 3px var(--gov-color-primary-100);
      }

      &:disabled {
        background: var(--gov-color-neutral-100);
        color: var(--gov-color-text-secondary);
        cursor: not-allowed;
      }
    }

    .gov-field--error .gov-field__select {
      border-color: var(--gov-color-error-500);
      &:focus { box-shadow: 0 0 0 3px var(--gov-color-error-100); }
    }

    .gov-field__chevron {
      position: absolute;
      right: var(--gov-space-3);
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      color: var(--gov-color-text-secondary);
      pointer-events: none;
    }

    .gov-field--disabled .gov-field__chevron {
      opacity: 0.4;
    }

    .gov-field__hint {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-text-secondary);
    }

    .gov-field__error {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-error-700);
    }
  `],
})
export class GovSelectComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() options: SelectOption[] = [];
  @Input() placeholder?: string;
  @Input() hint?: string;
  @Input() error?: string;
  @Input() required = false;

  protected readonly fieldId = `gov-select-${++selectIdCounter}`;
  protected value    = '';
  protected isDisabled = false;

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void         = () => {};

  writeValue(val: unknown): void {
    this.value = val != null ? String(val) : '';
  }

  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void         { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void        { this.isDisabled = disabled; }

  protected onSelectChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.onChange(this.value);
  }

  protected onBlur(): void { this.onTouched(); }
}
