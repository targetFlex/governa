// ============================================================
// clientes-list.component.spec.ts
//
// Testes unitários do ClientesListComponent.
// Cobertura: loading / error / empty / lista / retry / a11y
// ============================================================
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, computed } from '@angular/core';
import { axe, toHaveNoViolations } from 'jest-axe';

import { ClientesListComponent } from './clientes-list.component';
import { ClientesStore } from '../clientes.service';
import { Cliente } from '../../../shared/models/cliente.model';

expect.extend(toHaveNoViolations);

// ── Helpers ──────────────────────────────────────────────────

function makeCliente(override: Partial<Cliente> = {}): Cliente {
  return {
    id: '1',
    codigo: 'CLI001',
    nome: 'Acme Ltda',
    tipoPessoa: 'PJ',
    documento: '12.345.678/0001-99',
    email: 'contato@acme.com',
    telefone: '(11) 99999-9999',
    ativo: true,
    limiteCredito: 50000,
    saldoDevedor: 1000,
    moeda: 'BRL',
    criadoEm: '2024-01-01T00:00:00Z',
    atualizadoEm: '2024-01-01T00:00:00Z',
    ...override,
  };
}

interface MockStoreOptions {
  clientes?: Cliente[];
  loading?: boolean;
  error?: string | null;
  total?: number;
}

function createMockStore(opts: MockStoreOptions = {}) {
  const clientes = signal<Cliente[]>(opts.clientes ?? []);
  const loading  = signal<boolean>(opts.loading ?? false);
  const error    = signal<string | null>(opts.error ?? null);
  const total    = signal<number>(opts.total ?? 0);

  const isEmpty  = computed(() => !loading() && clientes().length === 0);
  const hasError = computed(() => error() !== null);

  return {
    clientes,
    loading,
    error,
    total,
    isEmpty,
    hasError,
    loadClientes: jest.fn(),
    clearError:   jest.fn(),
  };
}

// ── Suite ─────────────────────────────────────────────────────

describe('ClientesListComponent', () => {
  let fixture: ComponentFixture<ClientesListComponent>;
  let component: ClientesListComponent;
  let mockStore: ReturnType<typeof createMockStore>;

  function setup(opts: MockStoreOptions = {}) {
    mockStore = createMockStore(opts);

    TestBed.configureTestingModule({
      imports: [ClientesListComponent],
      providers: [
        { provide: ClientesStore, useValue: mockStore },
      ],
    });

    fixture   = TestBed.createComponent(ClientesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // ── Inicialização ─────────────────────────────────────────

  describe('ngOnInit', () => {
    it('deve chamar store.loadClientes() ao inicializar', () => {
      setup();
      expect(mockStore.loadClientes).toHaveBeenCalledTimes(1);
    });
  });

  // ── Estado: loading ───────────────────────────────────────

  describe('loading state', () => {
    it('deve exibir skeletons quando loading=true', () => {
      setup({ loading: true });
      const skeletons = fixture.nativeElement.querySelectorAll('.clientes-list__skeleton');
      expect(skeletons.length).toBe(6);
    });

    it('deve ter texto sr-only para leitores de tela durante loading', () => {
      setup({ loading: true });
      const srOnly = fixture.nativeElement.querySelector('.sr-only');
      expect(srOnly?.textContent?.trim()).toBe('Carregando clientes…');
    });

    it('não deve exibir grid de clientes durante loading', () => {
      setup({ loading: true, clientes: [makeCliente()] });
      const grid = fixture.nativeElement.querySelector('.clientes-list__grid');
      expect(grid).toBeNull();
    });
  });

  // ── Estado: erro ──────────────────────────────────────────

  describe('error state', () => {
    it('deve exibir banner de erro com role=alert', () => {
      setup({ error: 'Falha na conexão com o servidor.' });
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert.textContent).toContain('Falha na conexão com o servidor.');
    });

    it('deve exibir botão "Tentar novamente"', () => {
      setup({ error: 'Erro' });
      const btn = fixture.nativeElement.querySelector('.clientes-list__retry-btn');
      expect(btn?.textContent?.trim()).toBe('Tentar novamente');
    });

    it('deve chamar clearError + loadClientes ao clicar em retry', () => {
      setup({ error: 'Erro' });
      const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.clientes-list__retry-btn');
      btn?.click();
      expect(mockStore.clearError).toHaveBeenCalledTimes(1);
      expect(mockStore.loadClientes).toHaveBeenCalledTimes(2); // ngOnInit + retry
    });

    it('não deve exibir banner de erro enquanto loading=true', () => {
      setup({ loading: true, error: 'Erro anterior' });
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).toBeNull();
    });
  });

  // ── Estado: vazio ─────────────────────────────────────────

  describe('empty state', () => {
    it('deve exibir mensagem de vazio quando lista está vazia', () => {
      setup({ clientes: [], loading: false });
      const empty = fixture.nativeElement.querySelector('.clientes-list__empty');
      expect(empty?.textContent?.trim()).toBe('Nenhum cliente encontrado.');
    });

    it('deve ter role=status na mensagem de vazio', () => {
      setup({ clientes: [] });
      const empty = fixture.nativeElement.querySelector('.clientes-list__empty');
      expect(empty?.getAttribute('role')).toBe('status');
    });
  });

  // ── Estado: lista ─────────────────────────────────────────

  describe('list state', () => {
    it('deve renderizar um ClienteCard para cada cliente', () => {
      const clientes = [
        makeCliente({ id: '1', nome: 'Acme' }),
        makeCliente({ id: '2', nome: 'Beta' }),
        makeCliente({ id: '3', nome: 'Gama' }),
      ];
      setup({ clientes, total: 3 });

      const cards = fixture.nativeElement.querySelectorAll('app-cliente-card');
      expect(cards.length).toBe(3);
    });

    it('deve exibir contagem de clientes', () => {
      const clientes = [makeCliente({ id: '1' }), makeCliente({ id: '2' })];
      setup({ clientes, total: 50 });

      const count = fixture.nativeElement.querySelector('.clientes-list__count');
      expect(count?.textContent).toContain('2 de 50');
    });

    it('não deve exibir mensagem de vazio quando há clientes', () => {
      setup({ clientes: [makeCliente()] });
      const empty = fixture.nativeElement.querySelector('.clientes-list__empty');
      expect(empty).toBeNull();
    });
  });

  // ── Acessibilidade ────────────────────────────────────────

  describe('acessibilidade (axe-core)', () => {
    it('estado de loading não deve ter violações WCAG', async () => {
      setup({ loading: true });
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('estado de erro não deve ter violações WCAG', async () => {
      setup({ error: 'Falha ao carregar.' });
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('estado vazio não deve ter violações WCAG', async () => {
      setup({ clientes: [] });
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('estado de lista não deve ter violações WCAG', async () => {
      setup({ clientes: [makeCliente()], total: 1 });
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });
  });
});
