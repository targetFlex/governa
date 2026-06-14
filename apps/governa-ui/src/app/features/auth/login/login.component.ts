// ============================================================
// login.component.ts
//
// Componente standalone de autenticação.
// Formulário reativo com validação inline e feedback visual.
//
// Fluxo:
//   submit → AuthService.login() → sucesso: /dashboard
//                                → erro: exibe mensagem
//
// Acessibilidade: WCAG 2.1 AA
//   - aria-label em campos
//   - aria-live na área de erro
//   - foco gerenciado após erro
// ============================================================

import {
  Component,
  inject,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'gov-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="login-page" role="main">
      <section class="login-card" aria-labelledby="login-title">

        <header class="login-header">
          <h1 id="login-title" class="login-title">Governa</h1>
          <p class="login-subtitle">Faça login para continuar</p>
        </header>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          novalidate
          class="login-form"
        >
          <!-- Email -->
          <div class="field-group">
            <label for="email" class="field-label">E-mail</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
              aria-label="Endereço de e-mail"
              [attr.aria-invalid]="emailInvalid ? 'true' : null"
              class="field-input"
              [class.field-input--error]="emailInvalid"
              placeholder="seu@email.com"
            />
            @if (emailInvalid) {
              <span class="field-error" role="alert">
                Informe um e-mail válido.
              </span>
            }
          </div>

          <!-- Senha -->
          <div class="field-group">
            <label for="password" class="field-label">Senha</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              autocomplete="current-password"
              aria-label="Senha de acesso"
              [attr.aria-invalid]="passwordInvalid ? 'true' : null"
              class="field-input"
              [class.field-input--error]="passwordInvalid"
              placeholder="••••••••"
            />
            @if (passwordInvalid) {
              <span class="field-error" role="alert">
                Informe sua senha.
              </span>
            }
          </div>

          <!-- Erro de autenticação -->
          @if (authError()) {
            <div
              #errorBanner
              class="auth-error"
              role="alert"
              aria-live="assertive"
            >
              {{ authError() }}
            </div>
          }

          <!-- Submit -->
          <button
            type="submit"
            class="btn-primary"
            [disabled]="loading()"
            [attr.aria-busy]="loading()"
          >
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span>
              Entrando…
            } @else {
              Entrar
            }
          </button>
        </form>

      </section>
    </main>
  `,
  styles: [`
    .login-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--gov-color-bg);
      padding: var(--gov-space-4);
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: var(--gov-color-surface);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-xl);
      padding: var(--gov-space-8);
      box-shadow: var(--gov-shadow-lg);
    }

    .login-header {
      text-align: center;
      margin-bottom: var(--gov-space-8);
    }

    .login-title {
      font-size: var(--gov-font-size-3xl);
      font-weight: var(--gov-font-weight-bold);
      color: var(--gov-color-brand);
      letter-spacing: -0.02em;
    }

    .login-subtitle {
      margin-top: var(--gov-space-1);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-text-secondary);
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-5);
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: var(--gov-space-1);
    }

    .field-label {
      font-size: var(--gov-font-size-sm);
      font-weight: var(--gov-font-weight-medium);
      color: var(--gov-color-text-primary);
    }

    .field-input {
      width: 100%;
      padding: var(--gov-space-3) var(--gov-space-4);
      border: 1px solid var(--gov-color-border);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-base);
      color: var(--gov-color-text-primary);
      background: var(--gov-color-surface);
      transition: border-color var(--gov-transition-fast),
                  box-shadow var(--gov-transition-fast);
      outline: none;

      &::placeholder {
        color: var(--gov-color-text-secondary);
      }

      &:focus {
        border-color: var(--gov-color-brand);
        box-shadow: 0 0 0 3px var(--gov-color-primary-100);
      }

      &--error {
        border-color: var(--gov-color-error-500);

        &:focus {
          box-shadow: 0 0 0 3px var(--gov-color-error-100);
        }
      }
    }

    .field-error {
      font-size: var(--gov-font-size-xs);
      color: var(--gov-color-error-700);
    }

    .auth-error {
      padding: var(--gov-space-3) var(--gov-space-4);
      background: var(--gov-color-error-100);
      border: 1px solid var(--gov-color-error-500);
      border-radius: var(--gov-radius-md);
      font-size: var(--gov-font-size-sm);
      color: var(--gov-color-error-700);
    }

    .btn-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--gov-space-2);
      width: 100%;
      padding: var(--gov-space-3) var(--gov-space-4);
      background: var(--gov-color-brand);
      color: var(--gov-color-text-inverse);
      font-size: var(--gov-font-size-base);
      font-weight: var(--gov-font-weight-semibold);
      border: none;
      border-radius: var(--gov-radius-md);
      transition: background var(--gov-transition-fast);

      &:hover:not(:disabled) {
        background: var(--gov-color-brand-hover);
      }

      &:focus-visible {
        outline: 2px solid var(--gov-color-brand);
        outline-offset: 2px;
      }

      &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgb(255 255 255 / 0.35);
      border-top-color: white;
      border-radius: var(--gov-radius-full);
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class LoginComponent {
  private readonly fb      = inject(FormBuilder);
  private readonly auth    = inject(AuthService);
  private readonly router  = inject(Router);

  protected readonly errorBanner = viewChild<ElementRef>('errorBanner');

  // ── Estado ────────────────────────────────────────────────

  protected readonly loading   = signal(false);
  protected readonly authError = signal<string | null>(null);

  protected readonly form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // ── Getters de validação inline ───────────────────────────
  // Usamos getters (não computed signals) porque Angular 17 reavalia
  // getters em cada ciclo de change detection (zone-based), enquanto
  // computed signals só atualizam quando dependências REATIVAS mudam.
  // AbstractControl.invalid / .touched não são signals → computed cachearia
  // o valor inicial e nunca atualizaria após markAsTouched / setValue.

  protected get emailInvalid(): boolean {
    const ctrl = this.form.get('email');
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  protected get passwordInvalid(): boolean {
    const ctrl = this.form.get('password');
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  // ── Submit ────────────────────────────────────────────────

  protected onSubmit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.authError.set(null);

    const { email, password } = this.form.getRawValue();

    this.auth.login({ email: email!, password: password! }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.authError.set(
          err?.error?.message ?? 'Credenciais inválidas. Tente novamente.',
        );
        // Foca o banner de erro para screen readers
        setTimeout(() => this.errorBanner()?.nativeElement?.focus(), 0);
      },
    });
  }
}
