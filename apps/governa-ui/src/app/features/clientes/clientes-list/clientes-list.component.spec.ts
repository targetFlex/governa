// ============================================================
// clientes-list.component.spec.ts
//
// Testes unitários do ClientesListComponent.
// Padrão: TestBed configurado em beforeEach; estado controlado
// via WritableSignal.set() antes de fixture.detectChanges().
// ============================================================
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal, computed } from '@angular/core';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ClientesListComponent } from './clientes-list.component';
import { ClientesStore } from '../clientes.service';
import { Cliente } from '../../../shared/models/cliente.model';

expect.extend(toHaveNoViolations);

// ── Helpers ──────────────────────────────────────────────────

function makeCliente(override: Partial<Cliente> = {}): Cliente {
  return {
    id: '1', codigo: 'CLI001', nome: 'Acme Ltda', tipoPessoa: 'PJ',
    documento: '12.345.678/0001-99', email: 'contato@acme.com',
    telefone: '(11) 99999-9999', ativo: true,
    limiteCredito: 50000, saldoDevedor: 1000, moeda: 'BRL',
    criadoEm: '2024-01-01T00:00:00Z', atualizadoEm: '2024-01-01T00:00:00Z',
    ...override,
  };
}

// ── Suite ─────────────────────────────────────────────────────

describe('ClientesListComponent', () => {
  let fixture:   ComponentFixture<ClientesListComponent>;
  let component: ClientesListComponent;

  // Signals mutáveis — alterados por cada teste antes de detectChanges()
  let clientes: WritableSignal<Cliente[]>;
  let loading:  WritableSignal<boolean>;
  let error:    WritableSignal<string | null>;
  let total:    WritableSignal<number>;
  let loadClientesMock: jest.Mock;
  let clearErrorMock:   jest.Mock;

  beforeEach(() => {
    clientes         = signal<Cliente[]>([]);
    loading          = signal<boolean>(false);
    error            = signal<string | null>(null);
    total            = signal<number>(0);
    loadClientesMock = jest.fn();
    clearErrorMock   = jest.fn();

    const mockStore = {
      clientes,
      loading,
      error,
      total,
      isEmpty:  computed(() => !loading() && clientes().length === 0),
      hasError: computed(() => error() !== null),
      loadClientes: loadClientesMock,
      clearError:   clearErrorMock,
    };

    TestBed.configureTestingModule({
      imports: [ClientesListComponent],
      providers: [{ provide: ClientesStore, useValue: mockStore }],
    });

    fixture   = TestBed.createComponent(ClientesListComponent);
    component = fixture.componentInstance;
    // NÃO chamar detectChanges() aqui — cada teste controla o estado antes
  });

  afterEach(() => jest.clearAllMocks());

  // ── Inicialização ─────────────────────────────────────────

  it('deve chamar store.loadClientes() ao inicializar', () => {
    fixture.detectChanges();
    expect(loadClientesMock).toHaveBeenCalledTimes(1);
  });

  // ── Loading ──────────────────────────────────────────────

  describe('loading state', () => {
    beforeEach(() => loading.set(true));

    it('deve exibir skeletons quando loading=true', () => {
      fixture.detectChanges();
      const skeletons = fixture.nativeElement.querySelectorAll('.clientes-list__skeleton');
      expect(skeletons.length).toBe(6);
    });

    it('deve ter texto sr-only durante loading', () => {
      fixture.detectChanges();
      const srOnly = fixture.nativeElement.querySelector('.sr-only');
      expect(srOnly?.textContent?.trim()).toBe('Carregando clientes…');
    });

    it('não deve exibir grid durante loading', () => {
      clientes.set([makeCliente()]);
      fixture.detectChanges();
      const grid = fixture.nativeElement.querySelector('.clientes-list__grid');
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
      const btn = fixture.nativeElement.querySelector('.clientes-list__retry-btn');
      expect(btn?.textContent?.trim()).toBe('Tentar novamente');
    });

    it('deve chamar clearError + loadClientes ao clicar retry', () => {
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.clientes-list__retry-btn');
      btn?.click();
      expect(clearErrorMock).toHaveBeenCalledTimes(1);
      expect(loadClientesMock).toHaveBeenCalledTimes(2); // ngOnInit + retry
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
      const empty = fixture.nativeElement.querySelector('.clientes-list__empty');
      expect(empty?.textContent?.trim()).toBe('Nenhum cliente encontrado.');
    });

    it('deve ter role=status na mensagem de vazio', () => {
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.clientes-list__empty');
      expect(empty?.getAttribute('role')).toBe('status');
    });
  });

  // ── Lista ────────────────────────────────────────────────

  describe('list state', () => {
    beforeEach(() => {
      clientes.set([
        makeCliente({ id: '1', nome: 'Acme' }),
        makeCliente({ id: '2', nome: 'Beta' }),
        makeCliente({ id: '3', nome: 'Gama' }),
      ]);
      total.set(3);
    });

    it('deve renderizar um ClienteCard por cliente', () => {
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('app-cliente-card');
      expect(cards.length).toBe(3);
    });

    it('deve exibir contagem de clientes', () => {
      total.set(50);
      fixture.detectChanges();
      const count = fixture.nativeElement.querySelector('.clientes-list__count');
      expect(count?.textContent).toContain('3 de 50');
    });

    it('não deve exibir mensagem de vazio quando há clientes', () => {
      fixture.detectChanges();
      const empty = fixture.nativeElement.querySelector('.clientes-list__empty');
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
