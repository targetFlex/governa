// ============================================================
// app-shell.component.spec.ts
//
// TDD — Given/When/Then
// ============================================================

import { TestBed }        from '@angular/core/testing';
import { Router }         from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AppShellComponent }  from './app-shell.component';
import { AuthService }         from '../../../core/auth/auth.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';

// ─── Mock AuthService ─────────────────────────────────────────────────────────

function makeAuthMock() {
  return {
    provide: AuthService,
    useValue: {
      user:       () => ({ name: 'Fabio', email: 'fabio@test.com' }),
      isLoggedIn: () => true,
      logout:     jest.fn(),
    },
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

async function setup() {
  await TestBed.configureTestingModule({
    imports:   [AppShellComponent, RouterTestingModule, HttpClientTestingModule],
    providers: [makeAuthMock()],
  }).compileComponents();

  const fixture = TestBed.createComponent(AppShellComponent);
  fixture.detectChanges();
  return {
    fixture,
    comp:   fixture.componentInstance,
    auth:   TestBed.inject(AuthService),
    router: TestBed.inject(Router),
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('AppShellComponent', () => {

  // ── AS-1: estrutura ────────────────────────────────────────────────────────

  describe('AS-1: estrutura', () => {
    it('renderiza a sidebar de navegação', async () => {
      const { fixture } = await setup();
      const sidebar = fixture.nativeElement.querySelector('.sidebar');
      expect(sidebar).not.toBeNull();
    });

    it('renderiza o brand AICOCKPIT', async () => {
      const { fixture } = await setup();
      const brand = fixture.nativeElement.querySelector('.sidebar__brand');
      expect(brand?.textContent).toContain('AICOCKPIT');
    });

    it('renderiza todos os 6 itens de navegação', async () => {
      const { fixture } = await setup();
      const links = fixture.nativeElement.querySelectorAll('.sidebar__link');
      expect(links.length).toBe(6);
    });

    it('inclui link para Dashboard', async () => {
      const { fixture } = await setup();
      const labels = Array.from(fixture.nativeElement.querySelectorAll('.sidebar__label')) as HTMLElement[];
      expect(labels.some(l => l.textContent?.includes('Dashboard'))).toBe(true);
    });

    it('inclui link para Alertas', async () => {
      const { fixture } = await setup();
      const labels = Array.from(fixture.nativeElement.querySelectorAll('.sidebar__label')) as HTMLElement[];
      expect(labels.some(l => l.textContent?.includes('Alertas'))).toBe(true);
    });
  });

  // ── AS-2: logout ───────────────────────────────────────────────────────────

  describe('AS-2: logout', () => {
    it('chama auth.logout ao clicar no botão de logout', async () => {
      const { fixture, auth } = await setup();
      const btnLogout: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-label="Encerrar sessão"]');
      btnLogout?.click();
      expect(auth.logout).toHaveBeenCalledTimes(1);
    });

    it('método logout() delega para auth.logout', async () => {
      const { comp, auth } = await setup();
      comp.logout();
      expect(auth.logout).toHaveBeenCalledTimes(1);
    });
  });

  // ── AS-3: pageTitle ────────────────────────────────────────────────────────

  describe('AS-3: pageTitle', () => {
    it('pageTitle inicia como string vazia', async () => {
      const { comp } = await setup();
      expect(comp['pageTitle']()).toBe('');
    });
  });
});
