// ============================================================
// pedido-card.component.spec.ts
//
// Testes unitários + a11y (WCAG 2.1 AA via jest-axe)
//
// Cobertura:
//   - Renderização de número e revelação sob demanda do cliente
//   - Badge de status com texto e aria-label corretos (4 status reais)
//   - Classe CSS para pedido bloqueado
//   - Zero violações axe-core (WCAG 2.1 AA)
// ============================================================
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PedidoCardComponent } from './pedido-card.component';
import type { Pedido } from '../../models/pedido.model';
import type { ClientePii } from '../../models/cliente.model';
import { environment } from '@env/environment';

expect.extend(toHaveNoViolations);

// ── Fixtures ─────────────────────────────────────────────────

const pedidoAberto: Pedido = {
  numeroPedido: 'PED-0001',
  clienteId: 'CLI001',
  loja: '01',
  status: 'ABERTO',
  valorTotal: 15000,
  dataEmissao: '2026-01-15T00:00:00Z',
  itens: [
    { codigoProduto: 'PROD01', quantidade: 2, precoUnitario: 5000 },
    { codigoProduto: 'PROD02', quantidade: 1, precoUnitario: 5000 },
  ],
};

const pedidoBloqueado: Pedido = {
  ...pedidoAberto,
  numeroPedido: 'PED-0002',
  status: 'BLOQUEADO',
  itens: [],
};

const pedidoLiberado: Pedido = {
  ...pedidoAberto,
  numeroPedido: 'PED-0003',
  status: 'LIBERADO',
};

const pedidoEncerrado: Pedido = {
  ...pedidoAberto,
  numeroPedido: 'PED-0004',
  status: 'ENCERRADO',
};

const piiFixture: ClientePii = {
  clienteId: 'CLI001',
  loja: '01',
  nome: 'Acme Tecnologia Ltda',
  documento: '12.345.678/0001-90',
  email: 'contato@acme.com',
  telefone: null,
  endereco: 'Rua Acme, 1|São Paulo|SP|01000000',
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
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PedidoCardComponent, HttpClientTestingModule],
      providers: [{ provide: LOCALE_ID, useValue: 'en' }],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
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

    it('When renderizado, Then exibe o clienteId como botão de revelação (sem PII ainda)', () => {
      const btn = el.querySelector('.pedido-card__reveal-btn');
      expect(btn?.textContent?.trim()).toBe('CLI001');
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

    it('When renderizado, Then aria-label do article contém o número', () => {
      const article = el.querySelector('article');
      expect(article?.getAttribute('aria-label')).toContain('PED-0001');
    });

    it('When clica no botão de cliente, Then chama reidentificação e exibe o nome', () => {
      (el.querySelector('.pedido-card__reveal-btn') as HTMLButtonElement).click();
      fixture.detectChanges();

      const req = httpMock.expectOne(
        (r) => r.url === `${environment.coreBaseUrl}/clientes/CLI001/reidentificar` && r.params.get('loja') === '01',
      );
      req.flush({ data: piiFixture, traceId: 't1', latencyMs: 5 });
      fixture.detectChanges();

      expect(el.textContent).toContain('Acme Tecnologia Ltda');
    });

    it('When renderizado, Then não tem violações WCAG 2.1 AA', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });

  // ── Pedido bloqueado ──────────────────────────────────────

  describe('Given um pedido BLOQUEADO', () => {
    let fixture: ComponentFixture<PedidoCardComponent>;
    let el: HTMLElement;

    beforeEach(() => {
      fixture = mountComponent(pedidoBloqueado);
      el = fixture.nativeElement;
    });

    it('When renderizado, Then badge exibe "Bloqueado" (não quebra o card)', () => {
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.textContent?.trim()).toBe('Bloqueado');
    });

    it('When bloqueado, Then article tem classe de bloqueado', () => {
      const article = el.querySelector('article');
      expect(article?.classList).toContain('pedido-card--bloqueado');
    });

    it('When renderizado, Then não tem violações WCAG 2.1 AA', async () => {
      const results = await axe(el, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      expect(results).toHaveNoViolations();
    });
  });

  // ── Pedido liberado ───────────────────────────────────────

  describe('Given um pedido LIBERADO', () => {
    it('When renderizado, Then badge exibe "Liberado" (não quebra o card)', () => {
      const fixture = mountComponent(pedidoLiberado);
      const el = fixture.nativeElement as HTMLElement;
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.textContent?.trim()).toBe('Liberado');
    });
  });

  // ── Pedido encerrado ──────────────────────────────────────

  describe('Given um pedido ENCERRADO', () => {
    it('When renderizado, Then badge exibe "Encerrado"', () => {
      const fixture = mountComponent(pedidoEncerrado);
      const el = fixture.nativeElement as HTMLElement;
      const badge = el.querySelector('.pedido-card__status');
      expect(badge?.textContent?.trim()).toBe('Encerrado');
    });
  });
});
