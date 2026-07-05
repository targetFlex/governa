// ============================================================
// agentes-list.component.spec.ts
//
// TDD — Given/When/Then
// Suites:
//   1. Estado loading (skeletons + sr-only)
//   2. Estado de erro (banner + retry)
//   3. Estado vazio (empty state)
//   4. Lista com agentes (grid + contagem)
//   5. Filtros por status (chips + filtragem)
//   6. Ações (pause/ativar via store)
//   7. Acessibilidade WCAG 2.1 AA (jest-axe)
// ============================================================
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
  discardPeriodicTasks,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { axe, toHaveNoViolations } from 'jest-axe';
import { AgentesListComponent } from './agentes-list.component';
import { AgentesStore } from '../agentes.service';
import { Agente } from '../../../shared/models/agente.model';

expect.extend(toHaveNoViolations);

// ── Fixtures ─────────────────────────────────────────────────

const makeAgente = (overrides: Partial<Agente> = {}): Agente => ({
  id:           'ag-1',
  tenantId:     'tenant-tf',
  name:         'Agente Alpha',
  description:  'Agente de teste',
  ownerId:      'user-1',
  policyId:     'policy-1',
  status:       'ACTIVE',
  modelId:      'claude-sonnet-4',
  tools:        ['read_protheus_pedido'],
  createdAt:    '2026-05-01T10:00:00Z',
  updatedAt:    '2026-06-01T08:00:00Z',
  lastActiveAt: '2026-06-13T14:00:00Z',
  ...overrides,
});

// ── Helper: mock da store ─────────────────────────────────────

function makeStoreMock(overrides: Partial<ReturnType<typeof createStoreMock>> = {}) {
  return { ...createStoreMock(), ...overrides };
}

function createStoreMock() {
  return {
    loading:          signal(false),
    error:            signal<string | null>(null),
    total:            signal(0),
    filtroStatus:     signal<'TODOS' | 'ACTIVE' | 'PAUSED' | 'SANDBOX' | 'DEPRECATED'>('TODOS'),
    agentes:          signal<Agente[]>([]),
    isEmpty:          signal(true),
    hasError:         signal(false),
    agentesFiltrados: signal<Agente[]>([]),
    acoesEmAndamento: signal<string[]>([]),
    lastRefreshed:    signal<Date | null>(null),
    contagemPorStatus: signal({
      TODOS: 0, ACTIVE: 0, PAUSED: 0, SANDBOX: 0, DEPRECATED: 0,
    }),
    loadAgentes:     jest.fn(),
    refreshAgentes:  jest.fn(),
    pauseAgente:     jest.fn(),
    activateAgente:  jest.fn(),
    setFiltroStatus: jest.fn(),
    clearError:      jest.fn(),
  };
}

function setup(storeMock: ReturnType<typeof createStoreMock>): ComponentFixture<AgentesListComponent> {
  TestBed.configureTestingModule({
    imports: [AgentesListComponent, RouterTestingModule],
    providers: [
      { provide: AgentesStore, useValue: storeMock },
    ],
  });
  const fixture = TestBed.createComponent(AgentesListComponent);
  fixture.detectChanges();
  return fixture;
}

// ── Suite 1: Estado loading ───────────────────────────────────

describe('AgentesListComponent — loading', () => {

  it('exibe skeletons e texto de sr-only durante loading', () => {
    // Given: store em loading
    const store = makeStoreMock({ loading: signal(true), isEmpty: signal(false) });
    const fixture = setup(store);
    const el: HTMLElement = fixture.nativeElement;

    // Then: skeletons presentes
    expect(el.querySelectorAll('.agentes-list__skeleton').length).toBe(6);
    // Then: texto acessível para screen readers
    expect(el.querySelector('.sr-only')?.textContent?.trim()).toBe('Carregando agentes…');
    // Then: grid ausente
    expect(el.querySelector('.agentes-list__grid')).toBeNull();
  });

  it('chama loadAgentes no ngOnInit', () => {
    // Given
    const store = makeStoreMock();

    // When: componente inicializado
    setup(store);

    // Then
    expect(store.loadAgentes).toHaveBeenCalledTimes(1);
  });

});

// ── Suite 2: Estado de erro ───────────────────────────────────

describe('AgentesListComponent — erro', () => {

  it('exibe banner de erro com mensagem da store', () => {
    // Given
    const store = makeStoreMock({
      loading:  signal(false),
      error:    signal('Erro de rede: conexão recusada'),
      hasError: signal(true),
    });
    const fixture = setup(store);
    const el: HTMLElement = fixture.nativeElement;

    // Then
    const banner = el.querySelector('[role="alert"]');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('Erro de rede: conexão recusada');
  });

  it('chama clearError e loadAgentes ao clicar em retry', () => {
    // Given
    const store = makeStoreMock({
      loading:  signal(false),
      error:    signal('Timeout'),
      hasError: signal(true),
    });
    const fixture = setup(store);

    // When
    fixture.nativeElement.querySelector<HTMLButtonElement>('.agentes-list__retry-btn')?.click();

    // Then
    expect(store.clearError).toHaveBeenCalled();
    expect(store.loadAgentes).toHaveBeenCalledTimes(2); // 1 no ngOnInit + 1 no retry
  });

});

// ── Suite 3: Estado vazio ─────────────────────────────────────

describe('AgentesListComponent — vazio', () => {

  it('exibe mensagem de empty state quando lista está vazia', () => {
    // Given
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(true),
      agentesFiltrados: signal([]),
    });
    const fixture = setup(store);
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelector('[role="status"]')?.textContent?.trim()).toBe('Nenhum agente encontrado.');
    expect(el.querySelector('.agentes-list__grid')).toBeNull();
  });

});

// ── Suite 4: Lista com agentes ───────────────────────────────

describe('AgentesListComponent — lista', () => {

  it('renderiza um card por agente na lista filtrada', () => {
    // Given: 3 agentes
    const agentes = [
      makeAgente({ id: 'a1', name: 'Alpha', status: 'ACTIVE'  }),
      makeAgente({ id: 'a2', name: 'Beta',  status: 'PAUSED'  }),
      makeAgente({ id: 'a3', name: 'Gamma', status: 'SANDBOX' }),
    ];
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      agentesFiltrados: signal(agentes),
      total:            signal(3),
      contagemPorStatus: signal({ TODOS: 3, ACTIVE: 1, PAUSED: 1, SANDBOX: 1, DEPRECATED: 0 }),
    });
    const fixture = setup(store);
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelectorAll('app-agente-card').length).toBe(3);
  });

  it('exibe contagem correta de agentes', () => {
    // Given: 2 de 5 (filtro aplicado)
    const agentes = [
      makeAgente({ id: 'a1', status: 'ACTIVE' }),
      makeAgente({ id: 'a2', status: 'ACTIVE' }),
    ];
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      agentesFiltrados: signal(agentes),
      total:            signal(5),
      contagemPorStatus: signal({ TODOS: 5, ACTIVE: 2, PAUSED: 1, SANDBOX: 1, DEPRECATED: 1 }),
    });
    const fixture = setup(store);
    const el: HTMLElement = fixture.nativeElement;

    // Then
    expect(el.querySelector('.agentes-list__count')?.textContent).toContain('2');
    expect(el.querySelector('.agentes-list__count')?.textContent).toContain('5');
  });

});

// ── Suite 5: Filtros ─────────────────────────────────────────

describe('AgentesListComponent — filtros', () => {

  it('renderiza 5 chips de filtro quando há agentes', () => {
    // Given
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      agentesFiltrados: signal([makeAgente()]),
      contagemPorStatus: signal({ TODOS: 1, ACTIVE: 1, PAUSED: 0, SANDBOX: 0, DEPRECATED: 0 }),
    });
    const fixture = setup(store);

    // Then
    expect(fixture.nativeElement.querySelectorAll('.agentes-list__chip').length).toBe(5);
  });

  it('chama setFiltroStatus ao clicar em chip', () => {
    // Given
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      agentesFiltrados: signal([makeAgente()]),
      contagemPorStatus: signal({ TODOS: 1, ACTIVE: 1, PAUSED: 0, SANDBOX: 0, DEPRECATED: 0 }),
    });
    const fixture = setup(store);

    // When: clica no chip "Ativos"
    const chips = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.agentes-list__chip');
    chips[1]?.click(); // índice 1 = ACTIVE

    // Then
    expect(store.setFiltroStatus).toHaveBeenCalledWith('ACTIVE');
  });

  it('chip selecionado tem aria-pressed="true"', () => {
    // Given: filtro atual = PAUSED
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      filtroStatus:     signal('PAUSED'),
      agentesFiltrados: signal([makeAgente({ status: 'PAUSED' })]),
      contagemPorStatus: signal({ TODOS: 3, ACTIVE: 1, PAUSED: 1, SANDBOX: 1, DEPRECATED: 0 }),
    });
    const fixture = setup(store);

    // Then: chip PAUSED (índice 2) tem aria-pressed="true"
    const chips = fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.agentes-list__chip');
    expect(chips[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(chips[0]?.getAttribute('aria-pressed')).toBe('false');
  });

});

// ── Suite 6: Ações pause / ativar ────────────────────────────

describe('AgentesListComponent — ações', () => {

  it('chama pauseAgente na store ao receber evento pausar do card', fakeAsync(() => {
    // Given
    const agente = makeAgente({ id: 'ag-pause', status: 'ACTIVE' });
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      agentesFiltrados: signal([agente]),
      contagemPorStatus: signal({ TODOS: 1, ACTIVE: 1, PAUSED: 0, SANDBOX: 0, DEPRECATED: 0 }),
    });
    const fixture = setup(store);
    tick();

    // When: simula evento de pausa emitido pelo card
    fixture.componentInstance.onPausar('ag-pause');

    // Then
    expect(store.pauseAgente).toHaveBeenCalledWith('ag-pause');
    discardPeriodicTasks();
  }));

  it('chama activateAgente na store ao receber evento ativar do card', fakeAsync(() => {
    // Given
    const agente = makeAgente({ id: 'ag-act', status: 'PAUSED' });
    const store = makeStoreMock({
      loading:          signal(false),
      isEmpty:          signal(false),
      agentesFiltrados: signal([agente]),
      contagemPorStatus: signal({ TODOS: 1, ACTIVE: 0, PAUSED: 1, SANDBOX: 0, DEPRECATED: 0 }),
    });
    const fixture = setup(store);
    tick();

    // When
    fixture.componentInstance.onAtivar('ag-act');

    // Then
    expect(store.activateAgente).toHaveBeenCalledWith('ag-act');
    discardPeriodicTasks();
  }));

  it('isEmAndamento retorna true para id em acoesEmAndamento', () => {
    // Given
    const store = makeStoreMock({
      acoesEmAndamento: signal(['ag-busy']),
    });
    const fixture = setup(store);

    // Then
    expect(fixture.componentInstance.isEmAndamento('ag-busy')).toBe(true);
    expect(fixture.componentInstance.isEmAndamento('ag-idle')).toBe(false);
  });

});

// ── Suite 7: Acessibilidade ───────────────────────────────────

describe('AgentesListComponent — acessibilidade (WCAG 2.1 AA)', () => {

  it('estado de loading não tem violações', async () => {
    const store = makeStoreMock({ loading: signal(true) });
    const fixture = setup(store);
    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });

  it('estado de erro não tem violações', async () => {
    const store = makeStoreMock({
      loading:  signal(false),
      error:    signal('Falha na conexão'),
      hasError: signal(true),
    });
    const fixture = setup(store);
    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });

  it('estado vazio não tem violações', async () => {
    const store = makeStoreMock({ loading: signal(false), isEmpty: signal(true) });
    const fixture = setup(store);
    expect(await axe(fixture.nativeElement)).toHaveNoViolations();
  });

});

// ── Suite 8: filtroLabel fallback ─────────────────────────────

describe('AgentesListComponent — filtroLabel', () => {
  it('retorna label do chip quando status é válido', () => {
    const store   = makeStoreMock({ filtroStatus: signal('TODOS' as const) });
    const fixture = setup(store);
    expect(fixture.componentInstance.filtroLabel).toBeTruthy();
  });

  it('retorna string vazia quando status não está nos chips', () => {
    const store   = makeStoreMock({ filtroStatus: signal('INVALIDO' as never) });
    const fixture = setup(store);
    expect(fixture.componentInstance.filtroLabel).toBe('');
  });
});

// ── Suite 9: live refresh ─────────────────────────────────────

describe('AgentesListComponent — live refresh', () => {

  it('chama refreshAgentes após 30 s de intervalo', fakeAsync(() => {
    const store = makeStoreMock();
    setup(store);

    expect(store.refreshAgentes).not.toHaveBeenCalled();
    tick(30_000);
    expect(store.refreshAgentes).toHaveBeenCalledTimes(1);

    discardPeriodicTasks();
  }));

  it('chama refreshAgentes duas vezes após 60 s', fakeAsync(() => {
    const store = makeStoreMock();
    setup(store);

    tick(60_000);
    expect(store.refreshAgentes).toHaveBeenCalledTimes(2);

    discardPeriodicTasks();
  }));

  it('não altera loading durante refresh em background', fakeAsync(() => {
    const store = makeStoreMock({ loading: signal(false) });
    setup(store);

    tick(30_000);
    expect(store.loading()).toBe(false);

    discardPeriodicTasks();
  }));

});
