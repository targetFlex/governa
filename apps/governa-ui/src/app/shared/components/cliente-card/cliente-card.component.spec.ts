// ============================================================
// cliente-card.component.spec.ts
//
// Testes unitários + a11y (WCAG 2.1 AA via jest-axe)
//
// Cobertura:
//   - Renderização básica de nome e código
//   - Exibição condicional de telefone
//   - Badge de status ativo/inativo
//   - Link mailto com e-mail correto
//   - aria-label no article e no badge
//   - Zero violações axe-core (WCAG 2.1 AA)
// ============================================================
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ClienteCardComponent } from './cliente-card.component';
import type { Cliente } from '../../models/cliente.model';

expect.extend(toHaveNoViolations);

// ── Fixture de cliente ────────────────────────────────────────
const clienteAtivo: Cliente = {
  id: 'c1',
  codigo: 'CLI001',
  nome: 'Empresa Exemplo LTDA',
  tipoPessoa: 'PJ',
  documento: '12.345.678/0001-90',
  email: 'contato@empresa.com',
  telefone: '(11) 99999-9999',
  ativo: true,
  limiteCredito: 50000,
  saldoDevedor: 12500,
  moeda: 'BRL',
  criadoEm: '2024-01-01T00:00:00Z',
  atualizadoEm: '2024-01-15T00:00:00Z',
};

const clienteInativo: Cliente = {
  ...clienteAtivo,
  id: 'c2',
  codigo: 'CLI002',
  nome: 'João Silva',
  tipoPessoa: 'PF',
  documento: '123.456.789-00',
  telefone: null,
  ativo: false,
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClienteCardComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'en' }],
    }).compileComponents();
  });

  describe('Given um cliente ativo', () => {
    let fixture: ComponentFixture<ClienteCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(clienteAtivo);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then exibe o nome do cliente', () => {
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('Empresa Exemplo LTDA');
    });

    it('When renderizado, Then exibe o código', () => {
      expect(el.textContent).toContain('CLI001');
    });

    it('When renderizado, Then exibe o badge "Ativo"', () => {
      const badge = el.querySelector('.cliente-card__status');
      expect(badge?.textContent?.trim()).toBe('Ativo');
      expect(badge?.getAttribute('aria-label')).toBe('Cliente ativo');
    });

    it('When renderizado, Then exibe o link de e-mail correto', () => {
      const link = el.querySelector('a[href^="mailto:"]') as HTMLAnchorElement;
      expect(link?.href).toContain('mailto:contato@empresa.com');
      expect(link?.textContent?.trim()).toBe('contato@empresa.com');
    });

    it('When telefone preenchido, Then exibe o telefone', () => {
      expect(el.textContent).toContain('(11) 99999-9999');
    });

    it('When renderizado, Then aria-label do article contém o nome', () => {
      const article = el.querySelector('article');
      expect(article?.getAttribute('aria-label')).toContain('Empresa Exemplo LTDA');
    });

    it('When renderizado, Then não tem violações de acessibilidade (WCAG 2.1 AA)', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });

  describe('Given um cliente inativo sem telefone', () => {
    let fixture: ComponentFixture<ClienteCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(clienteInativo);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then badge mostra "Inativo"', () => {
      const badge = el.querySelector('.cliente-card__status');
      expect(badge?.textContent?.trim()).toBe('Inativo');
      expect(badge?.getAttribute('aria-label')).toBe('Cliente inativo');
    });

    it('When telefone null, Then linha de telefone não é exibida', () => {
      expect(el.textContent).not.toContain('Telefone');
    });

    it('When inativo, Then article tem classe inativo', () => {
      const article = el.querySelector('article');
      expect(article?.classList).toContain('cliente-card--inativo');
    });

    it('When renderizado, Then não tem violações de acessibilidade (WCAG 2.1 AA)', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });
});
