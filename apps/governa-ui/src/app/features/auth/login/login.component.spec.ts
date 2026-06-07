// ============================================================
// login.component.spec.ts
//
// Testes unitários do LoginComponent.
// Cenários cobertos:
//   - renderização e estado inicial do formulário
//   - validação inline (email inválido, senha vazia)
//   - submit com formulário inválido → não chama AuthService
//   - submit com sucesso → navega para /dashboard
//   - submit com erro → exibe mensagem de erro
//   - loading state durante requisição
// ============================================================

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';

// ── Factory helpers ───────────────────────────────────────────

function makeAuthServiceMock(options: {
  loginResult?: 'success' | 'error';
} = {}) {
  const { loginResult = 'success' } = options;

  return {
    login: jest.fn().mockReturnValue(
      loginResult === 'success'
        ? of({ token: 'jwt', expiresIn: 3600 })
        : throwError(() => ({ error: { message: 'Credenciais inválidas.' } })),
    ),
    isAuthenticated: jest.fn().mockReturnValue(false),
  };
}

// ── Testes ───────────────────────────────────────────────────

describe('LoginComponent', () => {
  let fixture:   ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authMock:  ReturnType<typeof makeAuthServiceMock>;
  let router:    Router;

  function setup(options?: Parameters<typeof makeAuthServiceMock>[0]) {
    authMock = makeAuthServiceMock(options);

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    fixture   = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router    = TestBed.inject(Router);
    fixture.detectChanges();
  }

  afterEach(() => jest.clearAllMocks());

  // ── Renderização ──────────────────────────────────────────

  describe('renderização', () => {
    beforeEach(() => setup());

    it('deve criar o componente', () => {
      expect(component).toBeTruthy();
    });

    it('deve exibir o título "Governa"', () => {
      const h1: HTMLElement = fixture.nativeElement.querySelector('h1');
      expect(h1.textContent?.trim()).toBe('Governa');
    });

    it('deve exibir os campos de e-mail e senha', () => {
      const email    = fixture.nativeElement.querySelector('#email');
      const password = fixture.nativeElement.querySelector('#password');
      expect(email).toBeTruthy();
      expect(password).toBeTruthy();
    });

    it('não deve exibir erro de e-mail inicialmente', () => {
      const emailError = fixture.nativeElement.querySelector('.field-error');
      expect(emailError).toBeNull();
    });

    it('não deve exibir banner de erro de auth inicialmente', () => {
      const banner = fixture.nativeElement.querySelector('.auth-error');
      expect(banner).toBeNull();
    });
  });

  // ── Validação de e-mail ───────────────────────────────────

  describe('validação do campo e-mail', () => {
    beforeEach(() => setup());

    it('deve marcar como inválido após touch com valor vazio', () => {
      const ctrl = fixture.componentInstance['form'].get('email')!;
      ctrl.markAsTouched();
      ctrl.setValue('');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('.field-error');
      expect(error).toBeTruthy();
    });

    it('deve marcar como inválido com e-mail mal-formatado', () => {
      const ctrl = fixture.componentInstance['form'].get('email')!;
      ctrl.markAsTouched();
      ctrl.setValue('not-an-email');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('.field-error');
      expect(error).toBeTruthy();
    });

    it('não deve mostrar erro com e-mail válido', () => {
      const ctrl = fixture.componentInstance['form'].get('email')!;
      ctrl.markAsTouched();
      ctrl.setValue('user@example.com');
      fixture.detectChanges();

      const error = fixture.nativeElement.querySelector('.field-error');
      expect(error).toBeNull();
    });
  });

  // ── Validação de senha ────────────────────────────────────

  describe('validação do campo senha', () => {
    beforeEach(() => setup());

    it('deve mostrar erro com senha vazia após touch', () => {
      const ctrl = fixture.componentInstance['form'].get('password')!;
      ctrl.markAsTouched();
      ctrl.setValue('');
      fixture.detectChanges();

      const errors = fixture.nativeElement.querySelectorAll('.field-error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('deve mostrar erro com senha menor que 6 caracteres', () => {
      const ctrl = fixture.componentInstance['form'].get('password')!;
      ctrl.markAsTouched();
      ctrl.setValue('abc');
      fixture.detectChanges();

      const errors = fixture.nativeElement.querySelectorAll('.field-error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  // ── Submit com formulário inválido ────────────────────────

  describe('submit com formulário inválido', () => {
    beforeEach(() => setup());

    it('não deve chamar AuthService.login se formulário inválido', () => {
      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      expect(authMock.login).not.toHaveBeenCalled();
    });
  });

  // ── Submit com sucesso ────────────────────────────────────

  describe('submit com sucesso', () => {
    beforeEach(() => setup({ loginResult: 'success' }));

    it('deve chamar AuthService.login com as credenciais', fakeAsync(() => {
      fixture.componentInstance['form'].setValue({
        email:    'admin@governa.com',
        password: 'secret123',
      });
      fixture.detectChanges();

      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      tick();
      fixture.detectChanges();

      expect(authMock.login).toHaveBeenCalledWith({
        email:    'admin@governa.com',
        password: 'secret123',
      });
    }));

    it('deve navegar para /dashboard após login bem-sucedido', fakeAsync(() => {
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.componentInstance['form'].setValue({
        email:    'admin@governa.com',
        password: 'secret123',
      });

      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      tick();

      expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
    }));
  });

  // ── Submit com erro ───────────────────────────────────────

  describe('submit com erro de autenticação', () => {
    beforeEach(() => setup({ loginResult: 'error' }));

    it('deve exibir mensagem de erro após falha no login', fakeAsync(() => {
      fixture.componentInstance['form'].setValue({
        email:    'wrong@governa.com',
        password: 'wrongpass',
      });

      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      tick();
      fixture.detectChanges();

      const banner: HTMLElement = fixture.nativeElement.querySelector('.auth-error');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('Credenciais inválidas');
    }));

    it('deve desativar loading após erro', fakeAsync(() => {
      fixture.componentInstance['form'].setValue({
        email:    'wrong@governa.com',
        password: 'wrongpass',
      });

      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      tick();
      fixture.detectChanges();

      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(btn.disabled).toBe(false);
    }));

    it('deve usar mensagem padrão quando err.error.message está ausente', fakeAsync(() => {
      // Cobre o branch ?? 'Credenciais inválidas. Tente novamente.' (linha 315)
      authMock.login.mockReturnValueOnce(throwError(() => ({ error: null })));

      fixture.componentInstance['form'].setValue({
        email:    'x@x.com',
        password: 'wrongpass',
      });

      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('submit'));
      tick();
      fixture.detectChanges();

      const banner: HTMLElement = fixture.nativeElement.querySelector('.auth-error');
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('Credenciais inválidas. Tente novamente.');
    }));
  });
});
