// ============================================================
// pedidos-list.component.spec.ts
//
// Testes unitários do PedidosListComponent.
// Padrão: TestBed configurado em beforeEach; estado controlado
// via WritableSignal.set() antes de fixture.detectChanges().
// ============================================================
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { signal, WritableSignal, computed } from '@angular/core';
import { axe, toHaveNoViolations } from 'jest-axe';

import { PedidosListComponent } from './pedidos-list.component';
import { PedidosStore } from '../pedidos.service';
import { Pedido } from '../../../shared/models/pedido.model';

expect.extend(toHaveNoViolations);

// ── Helpers ──────────────────────────────────────────────────

function makePedido(override: Partial<Pedido> = {}): Pedido {
  return {
    numeroPedido: 'PED-0001',
    clienteId: 'CLI001',
    loja: '01',
    status: 'ABERTO',
    valorTotal: 10000,
    dataEmissao: '2026-01-01T00:00:00Z',
    itens: [],
    ...override,
  };
}

// ── Suite ─────────────────────────────────────────────────────

describe('PedidosListComponent', () => {
  let fixture: ComponentFixture<PedidosListComponent>;

  let pedidos:          WritableSignal<Pedido[]>;
  let loading:          WritableSignal<boolean>;
  let error:            WritableSignal<string | null>;
  let total:            WritableSignal<number>;
  let page:             WritableSignal<number>;
  let pageSize:         WritableSignal<number>;
  let filtro:           WritableSignal<string>;
  let loadPedidosMock:  jest.Mock;
  let clearErrorMock:   jest.Mock;

  beforeEach(() => {
    pedidos         = signal<Pedido[]>([]);
    loading         = signal<boolean>(false);
    error           = signal<string | null>(null);
    total           = signal<number>(0);
    page            = signal<number>(1);
    pageSize        = signal<number>(20);
    filtro          = signal<string>('');
    loadPedidosMock = jest.fn();
    clearErrorMock  = jest.fn();

    const mockStore = {
      pedidos,
      loading,
      error,
      total,
      page,
      pageSize,
      filtro,
      isEmpty:    computed(() => !loading() && pedidos().length === 0),
      hasError:   computed(() => error() !== null),
      totalPages: computed(() => Math.ceil(total() / pageSize())),
      loadPedidos: loadPedidosMock,
      clearError:  clearErrorMock,
    };

    TestBed.configureTestingModule({
      imports: [PedidosListComponent, HttpClientTestingModule],
      providers: [
        { provide: PedidosStore, useValue: mockStore },
        { provide: LOCALE_ID, useValue: 'en' },
      ],
    });

    fixture = TestBed.createComponent(PedidosListComponent);
    // NÃO chamar detectChanges() aqui — cada teste controla o estado antes
  });

  afterEach(() => jest.clearAllMocks());

  // ── Inicialização ─────────────────────────────────────────

  it('deve chamar store.loadPedidos() ao inicializar', () => {
    fixture.detectChanges();
    expect(loadPedidosMock).toHaveBeenCalledTimes(1);
  });

  // ── Loading ──────────────────────────────────────────────

  describe('loading state', () => {
    beforeEach(() => loading.set(true));

    it('deve exibir skeletons quando loading=true', () => {
      fixture.detectChanges();
      const skeletons = fixture.nativeElement.querySelectorAll('.pedidos-list__skeleton');
      expect(skeletons.length).toBe(6);
    });

    it('deve ter texto sr-only durante loading', () => {
      fixture.detectChanges();
      const srOnly = fixture.nativeElement.querySelector('.pedidos-list__loading .sr-only');
      expect(srOnly?.textContent?.trim()).toBe('Carregando pedidos…');
    });

    it('não deve exibir grid durante loading', () => {
      pedidos.set([makePedido()]);
      fixture.detectChanges();
      const grid = fixture.nativeElement.querySelector('.pedidos-list__grid');
      expect(grid).toBeNull();
    });
  });

  // ── Erro ─────────────────────────────────────────────────

  describe('error state', () => {
    beforeEach(() => error.set('Falha na conexão.'));

    it('deve exibir banner com role=alert', () => {
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert.textContent).toContain('Falha na conexão.');
    });

    it('deve exibir botão "Tentar novamente"', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.pedidos-list__retry-btn');
      expect(btn?.textContent?.trim()).toBe('Tentar novamente');
    });

    it('deve chamar clearError + loadPedidos ao clicar retry', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.pedidos-list__retry-btn');
      btn?.click();
      expect(clearErrorMock).toHaveBeenCalledTimes(1);
      expect(loadPedidosMock).toHaveBeenCalledTimes(2); // ngOnInit + retry
    });

    it('não deve exibir erro quando loading=true', () => {
      loading.set(true);
      fixture.detectChanges();
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).toBeNull();
    });
  });

  // ── Empty ────────────────────────────────────────────────

  describe('empty state', () => {
    it('deve exibir mensagem de vazio', () => {
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.pedidos-list__empty');
      expect(empty?.textContent?.trim()).toBe('Nenhum pedido encontrado.');
    });

    it('deve ter role=status na mensagem de vazio', () => {
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.pedidos-list__empty');
      expect(empty?.getAttribute('role')).toBe('status');
    });
  });

  // ── Lista ────────────────────────────────────────────────

  describe('list state', () => {
    beforeEach(() => {
      pedidos.set([
        makePedido({ numeroPedido: 'PED-0001' }),
        makePedido({ numeroPedido: 'PED-0002' }),
        makePedido({ numeroPedido: 'PED-0003' }),
      ]);
      total.set(3);
    });

    it('deve renderizar um PedidoCard por pedido', () => {
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('app-pedido-card');
      expect(cards.length).toBe(3);
    });

    it('deve exibir contagem de pedidos', () => {
      total.set(50);
      fixture.detectChanges();
      const count = fixture.nativeElement.querySelector('.pedidos-list__count');
      expect(count?.textContent).toContain('3 de 50');
    });

    it('não deve exibir mensagem de vazio quando há pedidos', () => {
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.pedidos-list__empty');
      expect(empty).toBeNull();
    });
  });

  // ── Busca ────────────────────────────────────────────────

  describe('busca', () => {
    it('deve chamar loadPedidos(1, pageSize, termo) ao submeter a busca', () => {
      fixture.detectChanges();
      loadPedidosMock.mockClear();

      const component = fixture.componentInstance;
      component.searchTerm = 'PED-0001';
      const form = fixture.nativeElement.querySelector('.pedidos-list__search');
      form.dispatchEvent(new Event('submit'));

      expect(loadPedidosMock).toHaveBeenCalledWith(1, 20, 'PED-0001');
    });

    it('não deve exibir botão "Limpar" quando não há filtro ativo', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.pedidos-list__search-clear');
      expect(btn).toBeNull();
    });

    it('deve exibir botão "Limpar" e recarregar sem filtro ao clicar', () => {
      filtro.set('PED-0001');
      fixture.detectChanges();
      loadPedidosMock.mockClear();

      const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.pedidos-list__search-clear');
      expect(btn).not.toBeNull();
      btn?.click();

      expect(loadPedidosMock).toHaveBeenCalledWith(1, 20, '');
    });
  });

  // ── Paginação ────────────────────────────────────────────

  describe('paginação', () => {
    beforeEach(() => {
      pedidos.set([makePedido({ numeroPedido: 'PED-0001' }), makePedido({ numeroPedido: 'PED-0002' })]);
      total.set(50);
    });

    it('deve desabilitar "Anterior" na primeira página', () => {
      page.set(1);
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelectorAll('.pedidos-list__page-btn')[0] as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('deve habilitar "Próxima" quando há mais páginas', () => {
      page.set(1);
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelectorAll('.pedidos-list__page-btn')[1] as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('deve desabilitar "Próxima" na última página', () => {
      page.set(3); // totalPages = ceil(50/20) = 3
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelectorAll('.pedidos-list__page-btn')[1] as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('deve chamar loadPedidos com page+1 ao clicar em "Próxima"', () => {
      page.set(1);
      fixture.detectChanges();
      loadPedidosMock.mockClear();

      const btn = fixture.nativeElement.querySelectorAll('.pedidos-list__page-btn')[1] as HTMLButtonElement;
      btn.click();

      expect(loadPedidosMock).toHaveBeenCalledWith(2, 20, '');
    });

    it('deve chamar loadPedidos com page-1 ao clicar em "Anterior"', () => {
      page.set(2);
      fixture.detectChanges();
      loadPedidosMock.mockClear();

      const btn = fixture.nativeElement.querySelectorAll('.pedidos-list__page-btn')[0] as HTMLButtonElement;
      btn.click();

      expect(loadPedidosMock).toHaveBeenCalledWith(1, 20, '');
    });
  });

  // ── Acessibilidade ────────────────────────────────────────

  describe('acessibilidade (axe-core)', () => {
    it('estado loading não deve ter violações WCAG', async () => {
      loading.set(true);
      fixture.detectChanges();
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('estado erro não deve ter violações WCAG', async () => {
      error.set('Falha ao carregar.');
      fixture.detectChanges();
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('estado vazio não deve ter violações WCAG', async () => {
      fixture.detectChanges();
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });
  });
});
