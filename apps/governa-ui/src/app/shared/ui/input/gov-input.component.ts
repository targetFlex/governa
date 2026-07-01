import {
  Component,
  Input,
  forwardRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type InputType =
  | 'text' | 'email' | 'password' | 'number'
  | 'date' | 'datetime-local' | 'tel' | 'url' | 'search';

let inputIdCounter = 0;

@Component({
  selector: 'gov-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => GovInputComponent),
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

      <input
        [id]="fieldId"
        [type]="type"
        [placeholder]="placeholder ?? ''"
        [disabled]="isDisabled"
        [required]="required"
        [attr.autocomplete]="autocomplete ?? null"
        [attr.aria-describedby]="(hint || error) ? fieldId + '-desc' : null"
        [attr.aria-invalid]="error ? 'true' : null"
        [attr.aria-required]="required || null"
        [attr.min]="min ?? null"
        [attr.max]="max ?? null"
        [attr.step]="step ?? null"
        [attr.maxlength]="maxlength ?? null"
        [value]="value"
        class="gov-field__input"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />

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

    .gov-field__input {
      width: 100%;
      padding: var(--gov-space-2) var(--gov-space-3);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      font-family: inherit;
      color: var(--gov-color-text-primary);
      background: var(--gov-color-surface);
      outline: none;
      transition: border-color var(--gov-transition-fast),
                  box-shadow var(--gov-transition-fast);

      &::placeholder { color: var(--gov-color-text-secondary); }

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

    .gov-field--error .gov-field__input {
      border-color: var(--gov-color-error-500);
      &:focus { box-shadow: 0 0 0 3px var(--gov-color-error-100); }
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
export class GovInputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() type: InputType   = 'text';
  @Input() placeholder?: string;
  @Input() hint?: string;
  @Input() error?: string;
  @Input() required  = false;
  @Input() autocomplete?: string;
  @Input() min?: string | number;
  @Input() max?: string | number;
  @Input() step?: string | number;
  @Input() maxlength?: number;

  protected readonly fieldId = `gov-input-${++inputIdCounter}`;
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

  protected onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onChange(this.value);
  }

  protected onBlur(): void { this.onTouched(); }
}
