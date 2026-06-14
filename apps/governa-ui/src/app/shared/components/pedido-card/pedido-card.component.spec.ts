// ============================================================
// pedido-card.component.spec.ts
//
// Testes unitários + a11y (WCAG 2.1 AA via jest-axe)
//
// Cobertura:
//   - Renderização de número e cliente
//   - Badge de status com texto e aria-label corretos
//   - Exibição condicional de dataEntregaPrevista
//   - Classe CSS para pedido cancelado
//   - Zero violações axe-core (WCAG 2.1 AA)
// ============================================================
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PedidoCardComponent } from './pedido-card.component';
import type { Pedido } from '../../models/pedido.model';

expect.extend(toHaveNoViolations);

// ── Fixtures ─────────────────────────────────────────────────

const pedidoAberto: Pedido = {
  id: 'p1',
  numero: 'PED-0001',
  clienteId: 'c1',
  clienteNome: 'Acme Tecnologia Ltda',
  status: 'ABERTO',
  valor: 15000,
  moeda: 'BRL',
  dataEmissao: '2026-01-15T00:00:00Z',
  dataEntregaPrevista: '2026-02-01T00:00:00Z',
  itens: [
    { codigo: 'PROD01', descricao: 'Produto A', quantidade: 2, valorUnitario: 5000, valorTotal: 10000 },
    { codigo: 'PROD02', descricao: 'Produto B', quantidade: 1, valorUnitario: 5000, valorTotal: 5000 },
  ],
};

const pedidoCancelado: Pedido = {
  ...pedidoAberto,
  id: 'p2',
  numero: 'PED-0002',
  clienteNome: 'Beta Comércio SA',
  status: 'CANCELADO',
  dataEntregaPrevista: null,
  itens: [],
};

const pedidoEmAprovacao: Pedido = {
  ...pedidoAberto,
  id: 'p3',
  numero: 'PED-0003',
  status: 'EM_APROVACAO',
  dataEntregaPrevista: null,
};

// ── Helper ────────────────────────────────────────────────────

function mountComponent(pedido: Pedido): ComponentFixture<PedidoCardComponent> {
  const fixture = TestBed.createComponent(PedidoCardComponent);
  fixture.componentInstance.pedido = pedido;
  fixture.detectChanges();
  return fixture;
}

// ── Suite ─────────────────────────────────────────────────────

describe('PedidoCardComponent', () => {

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PedidoCardComponent],
      providers: [{ provide: LOCALE_ID, useValue: 'en' }],
    }).compileComponents();
  });

  // ── Pedido aberto ─────────────────────────────────────────

  describe('Given um pedido ABERTO', () => {
    let fixture: ComponentFixture<PedidoCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(pedidoAberto);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then exibe o número do pedido', () => {
      expect(el.querySelector('h2')?.textContent?.trim()).toBe('PED-0001');
    });

    it('When renderizado, Then exibe o nome do cliente', () => {
      expect(el.textContent).toContain('Acme Tecnologia Ltda');
    });

    it('When renderizado, Then badge exibe "Aberto"', () => {
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.textContent?.trim()).toBe('Aberto');
    });

    it('When renderizado, Then badge aria-label contém o status', () => {
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.getAttribute('aria-label')).toBe('Status do pedido: Aberto');
    });

    it('When renderizado, Then exibe a quantidade de itens', () => {
      expect(el.textContent).toContain('2');
    });

    it('When dataEntregaPrevista preenchida, Then exibe a linha de entrega', () => {
      expect(el.textContent).toContain('Entrega prevista');
    });

    it('When renderizado, Then aria-label do article contém o número', () => {
      const article = el.querySelector('article');
      expect(article?.getAttribute('aria-label')).toContain('PED-0001');
    });

    it('When renderizado, Then aria-label do article contém o cliente', () => {
      const article = el.querySelector('article');
      expect(article?.getAttribute('aria-label')).toContain('Acme Tecnologia Ltda');
    });

    it('When renderizado, Then não tem violações WCAG 2.1 AA', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });

  // ── Pedido cancelado ──────────────────────────────────────

  describe('Given um pedido CANCELADO sem dataEntregaPrevista', () => {
    let fixture: ComponentFixture<PedidoCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(pedidoCancelado);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then badge exibe "Cancelado"', () => {
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.textContent?.trim()).toBe('Cancelado');
    });

    it('When cancelado, Then article tem classe cancelado', () => {
      const article = el.querySelector('article');
      expect(article?.classList).toContain('pedido-card--cancelado');
    });

    it('When dataEntregaPrevista null, Then linha de entrega não é exibida', () => {
      expect(el.textContent).not.toContain('Entrega prevista');
    });

    it('When renderizado, Then não tem violações WCAG 2.1 AA', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });

  // ── Pedido em aprovação ───────────────────────────────────

  describe('Given um pedido EM_APROVACAO', () => {
    let fixture: ComponentFixture<PedidoCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(pedidoEmAprovacao);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then badge exibe "Em aprovação"', () => {
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.textContent?.trim()).toBe('Em aprovação');
    });

    it('When renderizado, Then não tem violações WCAG 2.1 AA', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });
});
