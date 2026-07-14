// ============================================================
// auth.service.ts
//
// Gerencia o estado de autenticação do usuário.
// Usa NGRX Signals (signalStore) para estado reativo.
//
// Responsabilidades:
//   - login(credentials) → POST /auth/login no gateway
//   - logout()           → limpa token e redireciona
//   - isAuthenticated()  → computed signal derivado do token
//
// O token JWT é armazenado apenas em memória (não em
// localStorage/sessionStorage) para mitigar XSS.
// ============================================================

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { signal, computed } from '@angular/core';
import { tap, catchError, throwError } from 'rxjs';
import { environment } from '@env/environment';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  token: string;
  expiresIn: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  // ── Estado reativo (em memória) ───────────────────────────

  private readonly _token = signal<string | null>(null);

  readonly token           = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._token() !== null);

  /** userId extraído do payload JWT — null se não autenticado */
  readonly userId = computed<string | null>(() => {
    const token = this._token();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return (payload as { userId?: string }).userId ?? null;
    } catch {
      return null;
    }
  });

  // ── Métodos públicos ──────────────────────────────────────

  login(credentials: LoginCredentials) {
    return this.http
      .post<AuthTokenPayload>(
        `${environment.coreBaseUrl}/auth/login`,
        credentials,
      )
      .pipe(
        tap(({ token }) => this._token.set(token)),
        catchError((err) => {
          this._token.set(null);
          return throwError(() => err);
        }),
      );
  }

  logout(): void {
    this._token.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this._token();
  }
}
