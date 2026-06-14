// ============================================================
// auth.guard.spec.ts
//
// Testes unitários do AuthGuard (functional guard).
// Cenários:
//   - usuário autenticado → retorna true
//   - usuário não autenticado → retorna UrlTree para /login
// ============================================================

import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';

import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

// ── Helpers ───────────────────────────────────────────────────

const mockRoute = {} as ActivatedRouteSnapshot;
const mockState = {} as RouterStateSnapshot;

function runGuard(): ReturnType<typeof authGuard> {
  return TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
}

// ── Testes ───────────────────────────────────────────────────

describe('authGuard', () => {
  let routerSpy: jest.Mock;
  let loginUrlTree: UrlTree;
  let isAuthenticated: WritableSignal<boolean>;

  beforeEach(() => {
    loginUrlTree    = {} as UrlTree;
    isAuthenticated = signal(true); // valor padrão; cada describe ajusta com .set()

    TestBed.configureTestingModule({
      providers: [
        {
          provide: Router,
          useValue: {
            createUrlTree: jest.fn().mockReturnValue(loginUrlTree),
            navigate:      jest.fn(),
          },
        },
        {
          provide:  AuthService,
          useValue: { isAuthenticated },
        },
      ],
    });

    routerSpy = TestBed.inject(Router).createUrlTree as jest.Mock;
  });

  afterEach(() => jest.clearAllMocks());

  // ── Autenticado ───────────────────────────────────────────

  describe('quando o usuário está autenticado', () => {
    beforeEach(() => isAuthenticated.set(true));

    it('deve retornar true', () => {
      expect(runGuard()).toBe(true);
    });

    it('não deve chamar createUrlTree', () => {
      runGuard();
      expect(routerSpy).not.toHaveBeenCalled();
    });
  });

  // ── Não autenticado ──────────────────────────────────────

  describe('quando o usuário NÃO está autenticado', () => {
    beforeEach(() => isAuthenticated.set(false));

    it('deve retornar um UrlTree', () => {
      const result = runGuard();
      expect(result).toBe(loginUrlTree);
    });

    it('deve redirecionar para /login', () => {
      runGuard();
      expect(routerSpy).toHaveBeenCalledWith(['/login']);
    });
  });
});
