import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { DashboardService, CockpitData } from './dashboard.service';
import { RouterTestingModule } from '@angular/router/testing';
import { Agente } from '../../shared/models/agente.model';
import { Alert } from '../../shared/models/alertas.model';
import { AuditEvent } from '../../shared/models/auditoria.model';

// ── Fixtures ──────────────────────────────────────────────────

function makeAgente(overrides: Partial<Agente> = {}): Agente {
  return {
    id: 'ag-1', tenantId: 't1', name: 'Alpha', description: '',
    ownerId: 'u1', policyId: null, status: 'ACTIVE',
    modelId: 'claude-sonnet-4-6', tools: [], createdAt: '', updatedAt: '', lastActiveAt: null,
    ...overrides,
  };
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'al-1', tenantId: 't1', agentId: 'ag-1',
    kind: 'ERROR_RATE', severity: 'HIGH', status: 'OPEN',
    message: 'Taxa de erro elevada', metadata: {},
    createdAt: '2026-07-05T10:00:00Z', updatedAt: '2026-07-05T10:00:00Z',
    ...overrides,
  };
}

function makeEvento(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'ev-1', tenantId: 't1', agentId: 'ag-1', traceId: 'tr-1',
    action: 'read_protheus_pedido', outcome: 'EXECUTADO',
    inputSummary: 'Pedido #123', latencyMs: 320,
    subjectToken: 'tok-1', dataCategories: ['pedidos'],
    legalBasis: 'contract_execution', purpose: 'atendimento',
    retentionUntil: '2031-07-05T00:00:00Z',
    createdAt: '2026-07-05T10:00:00Z',
    ...overrides,
  };
}

const mockCockpit: CockpitData = {
  agentes:    { data: [makeAgente({ status: 'ACTIVE' }), makeAgente({ id: 'ag-2', status: 'PAUSED' })], total: 2 },
  alertas:    { data: [makeAlert()], total: 3, page: 1, limit: 5 },
  decisoes:   { data: [makeEvento()], total: 10, page: 1, limit: 5 },
  bloqueados: { data: [], total: 2, page: 1, limit: 1 },
};

// ── Suite ─────────────────────────────────────────────────────

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let svc: { loadCockpit: jest.Mock };

  function setup(cockpit: CockpitData | 'error' = mockCockpit): void {
    svc = {
      loadCockpit: jest.fn().mockReturnValue(
        cockpit === 'error'
          ? throwError(() => ({ error: { message: 'Falha' } }))
          : of(cockpit),
      ),
    };

    TestBed.configureTestingModule({
      imports:   [DashboardComponent, RouterTestingModule],
      providers: [{ provide: DashboardService, useValue: svc }],
    });

    const fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('deve chamar loadCockpit no ngOnInit', () => {
    setup();
    component.ngOnInit();
    expect(svc.loadCockpit).toHaveBeenCalledTimes(1);
  });

  it('deve definir loading=true antes de load() e false após sucesso', () => {
    setup();
    // Antes de ngOnInit, o signal já começa em true (inicializado na declaração)
    expect(component['loading']()).toBe(true);
    component.ngOnInit();
    expect(component['loading']()).toBe(false);
  });

  it('deve contar apenas agentes ACTIVE', () => {
    setup();
    component.ngOnInit();
    // mockCockpit.agentes tem 1 ACTIVE e 1 PAUSED
    expect(component['agentesAtivos']()).toBe(1);
  });

  it('deve usar total retornado pela API para alertasAbertos', () => {
    setup();
    component.ngOnInit();
    expect(component['alertasAbertos']()).toBe(3);
  });

  it('deve usar total de decisoes', () => {
    setup();
    component.ngOnInit();
    expect(component['totalDecisoes']()).toBe(10);
  });

  it('deve usar total de bloqueados', () => {
    setup();
    component.ngOnInit();
    expect(component['totalBloqueados']()).toBe(2);
  });

  it('deve popular eventosRecentes com os dados retornados', () => {
    setup();
    component.ngOnInit();
    expect(component['eventosRecentes']()).toHaveLength(1);
  });

  it('deve popular alertasTop5 com os dados retornados', () => {
    setup();
    component.ngOnInit();
    expect(component['alertasTop5']()).toHaveLength(1);
  });

  it('deve ordenar alertas por severidade descrescente', () => {
    const cockpit: CockpitData = {
      ...mockCockpit,
      alertas: {
        data: [
          makeAlert({ id: 'al-low',  severity: 'LOW'      }),
          makeAlert({ id: 'al-crit', severity: 'CRITICAL' }),
          makeAlert({ id: 'al-med',  severity: 'MEDIUM'   }),
        ],
        total: 3, page: 1, limit: 5,
      },
    };
    setup(cockpit);
    component.ngOnInit();

    const sorted = component['alertasSorted']();
    expect(sorted[0].severity).toBe('CRITICAL');
    expect(sorted[1].severity).toBe('MEDIUM');
    expect(sorted[2].severity).toBe('LOW');
  });

  it('deve definir error e loading=false quando loadCockpit falha', () => {
    setup('error');
    component.ngOnInit();
    expect(component['error']()).toBe('Falha');
    expect(component['loading']()).toBe(false);
  });

  it('reload() deve chamar loadCockpit novamente', () => {
    setup();
    component.ngOnInit();
    component.load();
    expect(svc.loadCockpit).toHaveBeenCalledTimes(2);
  });

  it('outcomeBadge deve mapear EXECUTADO para success', () => {
    setup();
    expect(component.outcomeBadge('EXECUTADO')).toBe('success');
  });

  it('outcomeBadge deve mapear BLOQUEADO para error', () => {
    setup();
    expect(component.outcomeBadge('BLOQUEADO')).toBe('error');
  });

  it('severityBadge deve mapear CRITICAL para error', () => {
    setup();
    expect(component.severityBadge('CRITICAL')).toBe('error');
  });

  it('severityBadge deve mapear LOW para neutral', () => {
    setup();
    expect(component.severityBadge('LOW')).toBe('neutral');
  });

  it('deve definir lastRefreshed após carga inicial', () => {
    setup();
    component.ngOnInit();
    expect(component['lastRefreshed']()).toBeInstanceOf(Date);
  });

  it('lastRefreshed deve ser null antes de qualquer carga', () => {
    setup();
    expect(component['lastRefreshed']()).toBeNull();
  });

  it('background refresh chama loadCockpit silenciosamente sem alterar loading', fakeAsync(() => {
    setup();
    component.ngOnInit();
    expect(svc.loadCockpit).toHaveBeenCalledTimes(1);
    expect(component['loading']()).toBe(false);

    tick(30_000);
    expect(svc.loadCockpit).toHaveBeenCalledTimes(2);
    expect(component['loading']()).toBe(false);

    discardPeriodicTasks();
  }));

  it('background refresh atualiza dados e lastRefreshed', fakeAsync(() => {
    setup();
    component.ngOnInit();
    const primeiroRefresh = component['lastRefreshed']()!.getTime();

    tick(30_000);
    expect(svc.loadCockpit).toHaveBeenCalledTimes(2);
    expect(component['lastRefreshed']()!.getTime()).toBeGreaterThanOrEqual(primeiroRefresh);

    discardPeriodicTasks();
  }));

  it('background refresh ignora erros silenciosamente', fakeAsync(() => {
    setup();
    component.ngOnInit();

    svc.loadCockpit.mockReturnValue(throwError(() => ({ error: { message: 'Falha' } })));
    tick(30_000);

    expect(component['error']()).toBeNull();
    expect(component['loading']()).toBe(false);

    discardPeriodicTasks();
  }));
});
