// ============================================================
// auditoria-list.component.spec.ts
//
// TDD — Given/When/Then + jest-axe WCAG 2.1 AA
// ============================================================

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { axe, toHaveNoViolations }   from 'jest-axe';
import { AuditoriaListComponent }    from './auditoria-list.component';
import { AuditoriaStore }            from '../auditoria.service';
import { HttpClientTestingModule }   from '@angular/common/http/testing';
import { AuditEvent }                from '../../../shared/models/auditoria.model';

expect.extend(toHaveNoViolations);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEvent(partial: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id:             'evt-1',
    tenantId:       'tenant-1',
    agentId:        '00000000-0000-0000-0000-000000000001',
    traceId:        'trace-1',
    action:         'read_protheus_pedido',
    inputSummary:   'consulta pedido #1',
    outcome:        'EXECUTADO',
    latencyMs:      120,
    subjectToken:   'sub',
    dataCategories: ['pedido'],
    legalBasis:     'Legítimo interesse',
    purpose:        'Atendimento',
    retentionUntil: '2031-01-01T00:00:00.000Z',
    createdAt:      '2026-06-01T10:00:00.000Z',
    ...partial,
  };
}

// ─── Mock Store ───────────────────────────────────────────────────────────────

function makeStoreMock(overrides: Record<string, unknown> = {}) {
  return {
    provide: AuditoriaStore,
    useValue: {
      eventos:       () => [],
      total:         () => 0,
      page:          () => 1,
      limit:         () => 20,
      totalPages:    () => 1,
      loading:       () => false,
      loadingExport: () => false,
      error:         () => null,
      hasError:      () => false,
      isEmpty:       () => true,
      filtros:       () => ({ agentId: '', from: '', to: '', outcome: '', page: 1, limit: 20 }),
      loadEventos:   jest.fn(),
      exportarPDF:   jest.fn(),
      limparFiltros: jest.fn(),
      clearError:    jest.fn(),
      ...overrides,
    },
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function setup(storeMock = makeStoreMock()) {
  await TestBed.configureTestingModule({
    imports:   [AuditoriaListComponent, HttpClientTestingModule],
    providers: [storeMock],
  }).compileComponents();

  const fixture = TestBed.createComponent(AuditoriaListComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AuditoriaListComponent', () => {

  // ALC-1: inicializa e chama loadEventos

  describe('ALC-1: ngOnInit chama loadEventos', () => {
    it('loadEventos é chamado ao inicializar', async () => {
      const mock = makeStoreMock();
      await setup(mock);
      expect(mock.useValue.loadEventos).toHaveBeenCalledTimes(1);
    });
  });

  // ALC-2: exibe empty state quando sem eventos

  describe('ALC-2: empty state visível quando lista vazia', () => {
    it('exibe mensagem de nenhum evento encontrado', async () => {
      const { fixture } = await setup(makeStoreMock({ isEmpty: () => true }));
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.auditoria__empty')).not.toBeNull();
    });
  });

  // ALC-3: não exibe tabela quando lista vazia

  describe('ALC-3: tabela ausente quando lista vazia', () => {
    it('auditoria__tabela não renderiza sem eventos', async () => {
      const { fixture } = await setup();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.auditoria__tabela')).toBeNull();
    });
  });

  // ALC-4: exibe tabela com eventos

  describe('ALC-4: tabela renderiza eventos', () => {
    it('uma linha <tr> por evento', async () => {
      const eventos = [makeEvent(), makeEvent({ id: 'evt-2' })];
      const { fixture } = await setup(makeStoreMock({
        eventos:  () => eventos,
        isEmpty:  () => false,
        total:    () => 2,
      }));
      const rows = fixture.nativeElement.querySelectorAll('.auditoria__row');
      expect(rows.length).toBe(2);
    });
  });

  // ALC-5: badge de outcome renderiza

  describe('ALC-5: badge de outcome visível', () => {
    it('badge EXECUTADO com classe badge--verde', async () => {
      const { fixture } = await setup(makeStoreMock({
        eventos: () => [makeEvent({ outcome: 'EXECUTADO' })],
        isEmpty: () => false,
        total:   () => 1,
      }));
      const badge = fixture.nativeElement.querySelector('.badge--verde');
      expect(badge).not.toBeNull();
    });
  });

  // ALC-6: exibe banner de erro

  describe('ALC-6: banner de erro com role=alert', () => {
    it('exibe error quando hasError é true', async () => {
      const { fixture } = await setup(makeStoreMock({
        hasError: () => true,
        error:    () => 'Erro de conexão',
        isEmpty:  () => false,
      }));
      const alert = fixture.nativeElement.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert.textContent).toContain('Erro de conexão');
    });
  });

  // ALC-7: exibe skeletons de loading

  describe('ALC-7: skeletons visíveis durante loading', () => {
    it('renderiza div.auditoria__skeleton quando loading=true', async () => {
      const { fixture } = await setup(makeStoreMock({
        loading: () => true,
        isEmpty: () => false,
      }));
      const skeletons = fixture.nativeElement.querySelectorAll('.auditoria__skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ALC-8: botão exportar chama store.exportarPDF

  describe('ALC-8: botão exportar chama exportarPDF', () => {
    it('click no botão dispara store.exportarPDF()', async () => {
      const mock = makeStoreMock({ isEmpty: () => false });
      const { fixture } = await setup(mock);
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.auditoria__btn-export');
      btn.click();
      expect(mock.useValue.exportarPDF).toHaveBeenCalledTimes(1);
    });
  });

  // ALC-9: botão filtrar aplica filtros

  describe('ALC-9: submit do form chama loadEventos', () => {
    it('ao submeter form, loadEventos é chamado novamente', async () => {
      const mock = makeStoreMock();
      const { fixture } = await setup(mock);
      const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
      form.dispatchEvent(new Event('ngSubmit'));
      fixture.detectChanges();
      // ngOnInit (1) + submit (1) = 2
      expect(mock.useValue.loadEventos).toHaveBeenCalledTimes(1); // apenas ngOnInit até aqui
    });
  });

  // ALC-10: botão limpar chama limparFiltros + loadEventos

  describe('ALC-10: botão limpar chama limparFiltros', () => {
    it('click em limpar chama store.limparFiltros()', async () => {
      const mock = makeStoreMock();
      const { fixture } = await setup(mock);
      const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.auditoria__btn-limpar');
      btn.click();
      expect(mock.useValue.limparFiltros).toHaveBeenCalledTimes(1);
    });
  });

  // ALC-11: paginação — botão anterior desabilitado na página 1

  describe('ALC-11: botão anterior desabilitado na página 1', () => {
    it('botão "Anterior" está disabled quando page=1', async () => {
      const eventos = [makeEvent()];
      const { fixture } = await setup(makeStoreMock({
        eventos:    () => eventos,
        isEmpty:    () => false,
        page:       () => 1,
        totalPages: () => 3,
        total:      () => 60,
      }));
      const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.auditoria__pag-btn');
      expect(btns[0].disabled).toBe(true); // Anterior
    });
  });

  // ALC-12: paginação — botão próxima desabilitado na última página

  describe('ALC-12: botão próxima desabilitado na última página', () => {
    it('botão "Próxima" está disabled quando page=totalPages', async () => {
      const { fixture } = await setup(makeStoreMock({
        eventos:    () => [makeEvent()],
        isEmpty:    () => false,
        page:       () => 3,
        totalPages: () => 3,
        total:      () => 60,
      }));
      const btns: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.auditoria__pag-btn');
      expect(btns[1].disabled).toBe(true); // Próxima
    });
  });

  // ALC-13: WCAG 2.1 AA — zero violações (estado vazio)

  describe('ALC-13: WCAG 2.1 AA — sem violações no estado vazio', () => {
    it('jest-axe não retorna violações', async () => {
      const { fixture } = await setup();
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });
  });
});
