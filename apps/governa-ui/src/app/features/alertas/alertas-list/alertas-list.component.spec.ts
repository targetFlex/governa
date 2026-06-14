// ============================================================
// alertas-list.component.spec.ts
//
// TDD — Given/When/Then + jest-axe WCAG 2.1 AA
// ============================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe, toHaveNoViolations }   from 'jest-axe';
import { AlertasListComponent }      from './alertas-list.component';
import { AlertasStore }              from '../alertas.service';
import { HttpClientTestingModule }   from '@angular/common/http/testing';
import { Alert, AlertThreshold }     from '../../../shared/models/alertas.model';

expect.extend(toHaveNoViolations);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAlert(partial: Partial<Alert> = {}): Alert {
  return {
    id:        'alert-1',
    tenantId:  'tenant-1',
    agentId:   '00000000-0000-0000-0000-000000000001',
    kind:      'TOOL_BLOCKED',
    severity:  'HIGH',
    status:    'OPEN',
    message:   'Tool read_clientes bloqueada por política consultiva',
    metadata:  {},
    createdAt: '2026-06-13T10:00:00.000Z',
    updatedAt: '2026-06-13T10:00:00.000Z',
    ...partial,
  };
}

function makeThreshold(kind = 'TOOL_BLOCKED'): AlertThreshold {
  return {
    id: 'thresh-1', tenantId: 'tenant-1',
    kind: kind as AlertThreshold['kind'],
    enabled: true,
    errorRatePercent: null,
    volumePerHour: null,
    checkpointExpiryMin: null,
    updatedAt: '2026-06-13T10:00:00.000Z',
  };
}

// ─── Mock Store ───────────────────────────────────────────────────────────────

function makeStoreMock(overrides: Record<string, unknown> = {}) {
  return {
    provide: AlertasStore,
    useValue: {
      alertas:         () => [],
      total:           () => 0,
      page:            () => 1,
      limit:           () => 20,
      totalPages:      () => 1,
      loading:         () => false,
      loadingStatus:   () => false,
      loadingThresh:   () => false,
      error:           () => null,
      hasError:        () => false,
      isEmpty:         () => true,
      openCount:       () => 0,
      streamConnected: () => false,
      thresholds:      () => [],
      filtros:         () => ({ agentId: '', kind: '', status: '', from: '', to: '', page: 1, limit: 20 }),
      loadAlertas:       jest.fn(),
      atualizarStatus:   jest.fn(),
      loadThresholds:    jest.fn(),
      salvarThreshold:   jest.fn(),
      limparFiltros:     jest.fn(),
      clearError:        jest.fn(),
      conectarStream:    jest.fn(),
      desconectarStream: jest.fn(),
      ...overrides,
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup(storeMock = makeStoreMock()) {
  await TestBed.configureTestingModule({
    imports:   [AlertasListComponent, HttpClientTestingModule],
    providers: [storeMock],
  }).compileComponents();

  const fixture = TestBed.createComponent(AlertasListComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AlertasListComponent', () => {

  // ── AL-1: estado inicial ──────────────────────────────────────────────────

  describe('AL-1: estado inicial', () => {
    it('chama loadAlertas, loadThresholds e conectarStream no ngOnInit', async () => {
      const mock = makeStoreMock();
      await setup(mock);
      expect(mock.useValue.loadAlertas).toHaveBeenCalled();
      expect(mock.useValue.loadThresholds).toHaveBeenCalled();
      expect(mock.useValue.conectarStream).toHaveBeenCalled();
    });

    it('chama desconectarStream no ngOnDestroy', async () => {
      const mock            = makeStoreMock();
      const { fixture, comp } = await setup(mock);
      comp.ngOnDestroy();
      expect(mock.useValue.desconectarStream).toHaveBeenCalled();
    });
  });

  // ── AL-2: loading skeleton ────────────────────────────────────────────────

  describe('AL-2: loading state', () => {
    it('exibe skeletons quando loading=true', async () => {
      const { fixture } = await setup(makeStoreMock({ loading: () => true, isEmpty: () => false }));
      const skeletons   = fixture.nativeElement.querySelectorAll('.alertas__skeleton--row');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('oculta tabela enquanto loading=true', async () => {
      const { fixture } = await setup(makeStoreMock({ loading: () => true, isEmpty: () => false }));
      const tabela      = fixture.nativeElement.querySelector('.alertas__tabela-wrapper');
      expect(tabela).toBeNull();
    });
  });

  // ── AL-3: empty state ─────────────────────────────────────────────────────

  describe('AL-3: empty state', () => {
    it('exibe mensagem de empty quando isEmpty=true', async () => {
      const { fixture } = await setup(makeStoreMock({ isEmpty: () => true, hasError: () => false }));
      const empty       = fixture.nativeElement.querySelector('.alertas__empty');
      expect(empty).not.toBeNull();
    });
  });

  // ── AL-4: tabela com alertas ──────────────────────────────────────────────

  describe('AL-4: tabela com alertas', () => {
    it('renderiza uma linha por alerta', async () => {
      const alertas = [makeAlert({ id: 'a1' }), makeAlert({ id: 'a2', status: 'ACKNOWLEDGED' })];
      const { fixture } = await setup(makeStoreMock({
        alertas: () => alertas,
        total:   () => 2,
        isEmpty: () => false,
        loading: () => false,
      }));
      const rows = fixture.nativeElement.querySelectorAll('.alertas__row');
      expect(rows.length).toBe(2);
    });

    it('exibe badge de severidade HIGH', async () => {
      const { fixture } = await setup(makeStoreMock({
        alertas: () => [makeAlert({ severity: 'HIGH' })],
        isEmpty: () => false,
        loading: () => false,
        total:   () => 1,
      }));
      const badge = fixture.nativeElement.querySelector('.badge--high');
      expect(badge).not.toBeNull();
    });

    it('exibe botão Reconhecer para alertas OPEN', async () => {
      const { fixture } = await setup(makeStoreMock({
        alertas: () => [makeAlert({ status: 'OPEN' })],
        isEmpty: () => false,
        loading: () => false,
        total:   () => 1,
      }));
      const btn = fixture.nativeElement.querySelector('.alertas__btn-ack');
      expect(btn).not.toBeNull();
    });

    it('exibe botão Resolver para alertas ACKNOWLEDGED', async () => {
      const { fixture } = await setup(makeStoreMock({
        alertas: () => [makeAlert({ status: 'ACKNOWLEDGED' })],
        isEmpty: () => false,
        loading: () => false,
        total:   () => 1,
      }));
      const btn = fixture.nativeElement.querySelector('.alertas__btn-resolve');
      expect(btn).not.toBeNull();
    });

    it('chama atualizarStatus com ACKNOWLEDGED ao clicar Reconhecer', async () => {
      const mock = makeStoreMock({
        alertas: () => [makeAlert({ id: 'alert-x', status: 'OPEN' })],
        isEmpty: () => false,
        loading: () => false,
        total:   () => 1,
      });
      const { fixture } = await setup(mock);
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.alertas__btn-ack');
      btn.click();
      expect(mock.useValue.atualizarStatus).toHaveBeenCalledWith('alert-x', 'ACKNOWLEDGED');
    });
  });

  // ── AL-5: painel de configuração ─────────────────────────────────────────

  describe('AL-5: painel de configuração', () => {
    it('não exibe config inicialmente', async () => {
      const { fixture } = await setup();
      const painel = fixture.nativeElement.querySelector('#painel-config');
      expect(painel).toBeNull();
    });

    it('exibe config ao clicar no botão de configurar', async () => {
      const mock = makeStoreMock({ thresholds: () => [makeThreshold()] });
      const { fixture } = await setup(mock);
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.alertas__btn-config');
      btn.click();
      fixture.detectChanges();
      const painel = fixture.nativeElement.querySelector('#painel-config');
      expect(painel).not.toBeNull();
    });
  });

  // ── AL-6: badge de SSE ───────────────────────────────────────────────────

  describe('AL-6: badge SSE', () => {
    it('mostra "Ao vivo" quando streamConnected=true', async () => {
      const { fixture } = await setup(makeStoreMock({ streamConnected: () => true }));
      const badge: HTMLElement = fixture.nativeElement.querySelector('.alertas__sse-badge');
      expect(badge.textContent).toContain('Ao vivo');
    });

    it('mostra "Desconectado" quando streamConnected=false', async () => {
      const { fixture } = await setup(makeStoreMock({ streamConnected: () => false }));
      const badge: HTMLElement = fixture.nativeElement.querySelector('.alertas__sse-badge');
      expect(badge.textContent).toContain('Desconectado');
    });
  });

  // ── AL-7: WCAG 2.1 AA ───────────────────────────────────────────────────

  describe('AL-7: acessibilidade WCAG 2.1 AA', () => {
    it('estado vazio — sem violações de acessibilidade', async () => {
      const { fixture } = await setup();
      const results     = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('tabela com alertas — sem violações de acessibilidade', async () => {
      const { fixture } = await setup(makeStoreMock({
        alertas: () => [makeAlert()],
        isEmpty: () => false,
        loading: () => false,
        total:   () => 1,
      }));
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });
  });
});
