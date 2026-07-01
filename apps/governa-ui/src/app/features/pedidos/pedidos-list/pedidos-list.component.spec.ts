// ============================================================
// pedidos-list.component.spec.ts
//
// Testes unitários do PedidosListComponent.
// Padrão: TestBed configurado em beforeEach; estado controlado
// via WritableSignal.set() antes de fixture.detectChanges().
// ============================================================
import { LOCALE_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal, computed } from '@angular/core';
import { axe, toHaveNoViolations } from 'jest-axe';

import { PedidosListComponent } from './pedidos-list.component';
import { PedidosStore } from '../pedidos.service';
import { Pedido } from '../../../shared/models/pedido.model';

expect.extend(toHaveNoViolations);

// ── Helpers ──────────────────────────────────────────────────

function makePedido(override: Partial<Pedido> = {}): Pedido {
  return {
    id: '1',
    numero: 'PED-0001',
    clienteId: 'c1',
    clienteNome: 'Acme Ltda',
    status: 'ABERTO',
    valor: 10000,
    moeda: 'BRL',
    dataEmissao: '2026-01-01T00:00:00Z',
    dataEntregaPrevista: null,
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
  let loadPedidosMock:  jest.Mock;
  let clearErrorMock:   jest.Mock;

  beforeEach(() => {
    pedidos         = signal<Pedido[]>([]);
    loading         = signal<boolean>(false);
    error           = signal<string | null>(null);
    total           = signal<number>(0);
    loadPedidosMock = jest.fn();
    clearErrorMock  = jest.fn();

    const mockStore = {
      pedidos,
      loading,
      error,
      total,
      isEmpty:  computed(() => !loading() && pedidos().length === 0),
      hasError: computed(() => error() !== null),
      loadPedidos: loadPedidosMock,
      clearError:  clearErrorMock,
    };

    TestBed.configureTestingModule({
      imports: [PedidosListComponent],
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
      const srOnly = fixture.nativeElement.querySelector('.sr-only');
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
        makePedido({ id: '1', numero: 'PED-0001' }),
        makePedido({ id: '2', numero: 'PED-0002' }),
        makePedido({ id: '3', numero: 'PED-0003' }),
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
