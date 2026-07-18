// ============================================================
// cliente-card.component.spec.ts
//
// Testes unitários + a11y (WCAG 2.1 AA via jest-axe)
//
// Cobertura:
//   - Renderização básica (clienteId/loja, tokens não expostos)
//   - Badge de status ativo/bloqueado
//   - Revelação sob demanda de PII (loading/revealed/error)
//   - aria-label no article e no badge
//   - Zero violações axe-core (WCAG 2.1 AA)
// ============================================================
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ClienteCardComponent } from './cliente-card.component';
import type { Cliente, ClientePii } from '../../models/cliente.model';
import { environment } from '@env/environment';

expect.extend(toHaveNoViolations);

// ── Fixture de cliente ────────────────────────────────────────
const clienteAtivo: Cliente = {
  clienteId: 'CLI001',
  loja: '01',
  nomeToken: 'a'.repeat(64),
  documentoToken: 'b'.repeat(64),
  enderecoToken: 'c'.repeat(64),
  emailToken: 'd'.repeat(64),
  telefoneToken: 'e'.repeat(64),
  bloqueado: false,
};

const clienteBloqueado: Cliente = {
  ...clienteAtivo,
  clienteId: 'CLI002',
  loja: '02',
  telefoneToken: null,
  bloqueado: true,
};

const piiFixture: ClientePii = {
  clienteId: 'CLI001',
  loja: '01',
  nome: 'Empresa Exemplo LTDA',
  documento: '12.345.678/0001-90',
  email: 'contato@empresa.com',
  telefone: '(11) 99999-9999',
  endereco: 'Rua Exemplo, 1|São Paulo|SP|01000000',
};

// ── Helper ────────────────────────────────────────────────────
function mountComponent(cliente: Cliente): ComponentFixture<ClienteCardComponent> {
  const fixture = TestBed.createComponent(ClienteCardComponent);
  fixture.componentInstance.cliente = cliente;
  fixture.detectChanges();
  return fixture;
}

// ── Testes ────────────────────────────────────────────────────
describe('ClienteCardComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClienteCardComponent, HttpClientTestingModule],
      providers: [{ provide: LOCALE_ID, useValue: 'en' }],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Given um cliente ativo, antes de revelar', () => {
    let fixture: ComponentFixture<ClienteCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(clienteAtivo);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then exibe o clienteId no cabeçalho (sem PII)', () => {
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Cliente CLI001');
    });

    it('When renderizado, Then não expõe nomeToken/documentoToken em texto visível como PII real', () => {
      expect(el.textContent).not.toContain(clienteAtivo.nomeToken);
    });

    it('When renderizado, Then exibe o badge "Ativo"', () => {
      const badge = el.querySelector('.cliente-card__status');
      expect(badge?.textContent?.trim()).toBe('Ativo');
      expect(badge?.getAttribute('aria-label')).toBe('Cliente ativo');
    });

    it('When renderizado, Then exibe botão "Revelar dados"', () => {
      const btn = el.querySelector('.cliente-card__reveal-btn');
      expect(btn?.textContent?.trim()).toBe('Revelar dados');
    });

    it('When renderizado, Then aria-label do article contém o clienteId', () => {
      const article = el.querySelector('article');
      expect(article?.getAttribute('aria-label')).toContain('CLI001');
    });

    it('When renderizado, Then não tem violações de acessibilidade (WCAG 2.1 AA)', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe('Given um cliente ativo, ao revelar dados', () => {
    let fixture: ComponentFixture<ClienteCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(clienteAtivo);
      el = fixture.nativeElement;
    });

    it('When clica em "Revelar dados", Then chama GET /clientes/:id/reidentificar e exibe PII', () => {
      (el.querySelector('.cliente-card__reveal-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (r) => r.url === `${environment.coreBaseUrl}/clientes/CLI001/reidentificar` && r.params.get('loja') === '01',
      );
      req.flush({ data: piiFixture, traceId: 't1', latencyMs: 5 });
      fixture.detectChanges();

      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Empresa Exemplo LTDA');
      expect(el.textContent).toContain('12.345.678/0001-90');
      const link = el.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
      expect(link?.href).toContain('mailto:contato@empresa.com');
    });

    it('When a requisição falha, Then exibe estado de erro com opção de retry', () => {
      (el.querySelector('.cliente-card__reveal-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      const req = httpMock.expectOne(() => true);
      req.flush({ error: 'falhou' }, { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      expect(el.querySelector('.cliente-card__reveal-error')).toBeTruthy();
    });
  });

  describe('Given um cliente bloqueado sem telefone', () => {
    let fixture: ComponentFixture<ClienteCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(clienteBloqueado);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then badge mostra "Bloqueado"', () => {
      const badge = el.querySelector('.cliente-card__status');
      expect(badge?.textContent?.trim()).toBe('Bloqueado');
      expect(badge?.getAttribute('aria-label')).toBe('Cliente bloqueado');
    });

    it('When bloqueado, Then article tem classe de bloqueado', () => {
      const article = el.querySelector('article');
      expect(article?.classList).toContain('cliente-card--bloqueado');
    });

    it('When renderizado, Then não tem violações de acessibilidade (WCAG 2.1 AA)', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });
});
