/**
 * auditoria.service.spec.ts — TDD para AuditoriaStore.
 *
 * Padrão: HttpClientTestingModule + flush manual (sem spy em window.open).
 */

import { TestBed }                              from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AuditoriaStore }                       from './auditoria.service';
import { AuditEventPage, AuditEvent }           from '../../shared/models/auditoria.model';

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
    latencyMs:      100,
    subjectToken:   'sub',
    dataCategories: ['pedido'],
    legalBasis:     'Legítimo interesse',
    purpose:        'Atendimento',
    retentionUntil: '2031-01-01T00:00:00.000Z',
    createdAt:      '2026-06-01T10:00:00.000Z',
    ...partial,
  };
}

function makePage(partial: Partial<AuditEventPage> = {}): AuditEventPage {
  return {
    data:  [makeEvent()],
    total: 1,
    page:  1,
    limit: 20,
    ...partial,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function setup() {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [AuditoriaStore],
  });
  const store = TestBed.inject(AuditoriaStore);
  const http  = TestBed.inject(HttpTestingController);
  return { store, http };
}

const BASE = 'http://localhost:3000/audit-events';

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AuditoriaStore', () => {

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    http.verify();
  });

  // AS-1: estado inicial

  describe('AS-1: estado inicial', () => {
    it('eventos vazio, loading false, sem error', () => {
      const { store, http } = setup();
      expect(store.eventos()).toEqual([]);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.total()).toBe(0);
      http.expectNone(BASE);
    });
  });

  // AS-2: loadEventos — sucesso

  describe('AS-2: loadEventos — sucesso', () => {
    it('popula eventos, total, page, limit após flush', () => {
      const { store, http } = setup();
      const page = makePage({ total: 5, page: 1, limit: 20 });

      store.loadEventos();
      const req = http.expectOne((r) => r.url === BASE);
      expect(store.loading()).toBe(true);
      req.flush(page);

      expect(store.loading()).toBe(false);
      expect(store.eventos()).toHaveLength(1);
      expect(store.total()).toBe(5);
      expect(store.page()).toBe(1);
      expect(store.limit()).toBe(20);
      expect(store.error()).toBeNull();
    });
  });

  // AS-3: loadEventos — erro HTTP

  describe('AS-3: loadEventos — erro HTTP 500', () => {
    it('seta error e limpa loading', () => {
      const { store, http } = setup();

      store.loadEventos();
      const req = http.expectOne((r) => r.url === BASE);
      req.flush({ message: 'Erro interno' }, { status: 500, statusText: 'Server Error' });

      expect(store.loading()).toBe(false);
      expect(store.error()).not.toBeNull();
    });
  });

  // AS-4: loadEventos — filtro agentId repassa na query string

  describe('AS-4: loadEventos — filtro agentId', () => {
    it('inclui agentId nos params', () => {
      const { store, http } = setup();
      const agentId = '00000000-0000-0000-0000-000000000001';

      store.loadEventos({ agentId });
      const req = http.expectOne((r) => {
        return r.url === BASE && r.params.get('agentId') === agentId;
      });
      req.flush(makePage());

      expect(store.filtros().agentId).toBe(agentId);
    });
  });

  // AS-5: loadEventos — filtro outcome

  describe('AS-5: loadEventos — filtro outcome BLOQUEADO', () => {
    it('inclui outcome nos params', () => {
      const { store, http } = setup();

      store.loadEventos({ outcome: 'BLOQUEADO' });
      const req = http.expectOne((r) => r.params.get('outcome') === 'BLOQUEADO');
      req.flush(makePage());
      expect(store.filtros().outcome).toBe('BLOQUEADO');
    });
  });

  // AS-6: loadEventos — filtro from/to converte para ISO com hora

  describe('AS-6: filtros from/to convertidos para ISO com hora', () => {
    it('from YYYY-MM-DD → T00:00:00Z e to → T23:59:59Z', () => {
      const { store, http } = setup();

      store.loadEventos({ from: '2026-01-01', to: '2026-06-30' });
      const req = http.expectOne((r) => {
        return (
          r.params.get('from') === '2026-01-01T00:00:00Z' &&
          r.params.get('to')   === '2026-06-30T23:59:59Z'
        );
      });
      req.flush(makePage());
      expect(req).toBeTruthy();
    });
  });

  // AS-7: clearError

  describe('AS-7: clearError', () => {
    it('zera o erro após chamada', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE)
          .flush({}, { status: 500, statusText: 'Server Error' });

      expect(store.error()).not.toBeNull();
      store.clearError();
      expect(store.error()).toBeNull();
    });
  });

  // AS-8: limparFiltros

  describe('AS-8: limparFiltros', () => {
    it('reseta filtros para estado inicial', () => {
      const { store } = setup();
      store.limparFiltros();
      expect(store.filtros()).toMatchObject({ agentId: '', from: '', to: '', outcome: '' });
    });
  });

  // AS-9: totalPages computed

  describe('AS-9: totalPages computed', () => {
    it('calcula ceil(total / limit)', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE).flush(makePage({ total: 45, limit: 20 }));

      expect(store.totalPages()).toBe(3);
    });
  });

  // AS-10: isEmpty

  describe('AS-10: isEmpty signal', () => {
    it('true quando eventos vazio e não carregando', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE).flush(makePage({ data: [], total: 0 }));

      expect(store.isEmpty()).toBe(true);
    });
  });

  // AS-11: paginação — page repassa no query param

  describe('AS-11: paginação — page=2', () => {
    it('envia page=2 na query string', () => {
      const { store, http } = setup();

      store.loadEventos({}, 2);
      const req = http.expectOne((r) => r.params.get('page') === '2');
      req.flush(makePage({ page: 2 }));
      expect(store.page()).toBe(2);
    });
  });

  // AS-12: loadingExport inicia false

  describe('AS-12: loadingExport inicial false', () => {
    it('loadingExport começa false', () => {
      const { store } = setup();
      expect(store.loadingExport()).toBe(false);
    });
  });

  // AS-13: exportarPDF — inicia loadingExport

  describe('AS-13: exportarPDF — seta loadingExport true e chama /export', () => {
    it('faz request para /audit-events/export', () => {
      const { store, http } = setup();

      // mock window.open para não abrir janela real no teste
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

      store.exportarPDF();
      const req = http.expectOne((r) => r.url === `${BASE}/export`);
      req.flush({ data: [makeEvent()], total: 1 });

      expect(store.loadingExport()).toBe(false);
      openSpy.mockRestore();
    });
  });

  // AS-14: hasError computed

  describe('AS-14: hasError computed', () => {
    it('false quando error é null', () => {
      const { store } = setup();
      expect(store.hasError()).toBe(false);
    });
  });

  // AS-15: exportarPDF — erro HTTP

  describe('AS-15: exportarPDF — erro HTTP seta error', () => {
    it('seta error após falha no export', () => {
      const { store, http } = setup();

      store.exportarPDF();
      http.expectOne((r) => r.url === `${BASE}/export`)
          .flush({}, { status: 503, statusText: 'Service Unavailable' });

      expect(store.error()).not.toBeNull();
      expect(store.loadingExport()).toBe(false);
    });
  });

  // AS-16: loadEventos sem filtros — page=1 no param

  describe('AS-16: loadEventos sem filtros — page=1 no param', () => {
    it('envia page=1 por padrão', () => {
      const { store, http } = setup();

      store.loadEventos();
      const req = http.expectOne((r) => r.params.get('page') === '1');
      req.flush(makePage());
      expect(req).toBeTruthy();
    });
  });

  // AS-17: loadEventos — limit padrão = 20

  describe('AS-17: loadEventos — limit padrão 20', () => {
    it('envia limit=20 por padrão', () => {
      const { store, http } = setup();

      store.loadEventos();
      const req = http.expectOne((r) => r.params.get('limit') === '20');
      req.flush(makePage());
      expect(req).toBeTruthy();
    });
  });

  // AS-18: loadEventos — sem agentId não envia param agentId

  describe('AS-18: loadEventos — sem agentId não envia param', () => {
    it('params não contém agentId quando filtro está vazio', () => {
      const { store, http } = setup();

      store.loadEventos({ agentId: '' });
      const req = http.expectOne((r) => r.url === BASE);
      expect(req.request.params.has('agentId')).toBe(false);
      req.flush(makePage());
    });
  });

  // AS-19: loadEventos — resultado anterior substituído

  describe('AS-19: loadEventos — resultado anterior substituído', () => {
    it('segunda chamada substitui eventos da primeira', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE).flush(makePage({ total: 1 }));
      expect(store.total()).toBe(1);

      store.loadEventos();
      http.expectOne((r) => r.url === BASE).flush(makePage({ total: 99, data: [makeEvent(), makeEvent({ id: 'evt-2' })] }));
      expect(store.total()).toBe(99);
      expect(store.eventos()).toHaveLength(2);
    });
  });

  // AS-20: exportarPDF sem filtros — não envia params desnecessários

  describe('AS-20: exportarPDF sem filtros — query string limpa', () => {
    it('não envia agentId/outcome/from/to quando filtros vazios', () => {
      const { store, http } = setup();
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

      store.exportarPDF();
      const req = http.expectOne((r) => r.url === `${BASE}/export`);
      expect(req.request.params.has('agentId')).toBe(false);
      expect(req.request.params.has('outcome')).toBe(false);
      req.flush({ data: [], total: 0 });

      openSpy.mockRestore();
    });
  });

  // AS-21: filtros persistem entre chamadas

  describe('AS-21: filtros persistem no store após loadEventos', () => {
    it('filtro agentId fica no estado após carga', () => {
      const { store, http } = setup();
      const agentId = '00000000-0000-0000-0000-000000000001';

      store.loadEventos({ agentId });
      http.expectOne((r) => r.url === BASE).flush(makePage());
      expect(store.filtros().agentId).toBe(agentId);
    });
  });

  // AS-22: loadEventos — loading vira false tanto no sucesso quanto no erro

  describe('AS-22: loading false após erro também', () => {
    it('loading === false depois de erro', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE)
          .flush({}, { status: 404, statusText: 'Not Found' });

      expect(store.loading()).toBe(false);
    });
  });

  // AS-23: totalPages mínimo 1

  describe('AS-23: totalPages mínimo 1', () => {
    it('totalPages é 1 quando total é 0', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE).flush(makePage({ data: [], total: 0 }));
      expect(store.totalPages()).toBe(1);
    });
  });

  // AS-24: loadEventos — não envia outcome quando vazio

  describe('AS-24: loadEventos — outcome vazio não enviado', () => {
    it('params não contém outcome quando filtro está vazio', () => {
      const { store, http } = setup();

      store.loadEventos({ outcome: '' });
      const req = http.expectOne((r) => r.url === BASE);
      expect(req.request.params.has('outcome')).toBe(false);
      req.flush(makePage());
    });
  });

  // AS-25: clearError não afeta eventos

  describe('AS-25: clearError não afeta eventos', () => {
    it('eventos permanecem após clearError', () => {
      const { store, http } = setup();

      store.loadEventos();
      http.expectOne((r) => r.url === BASE).flush(makePage());
      const eventosSalvos = store.eventos();

      store.clearError();
      expect(store.eventos()).toEqual(eventosSalvos);
    });
  });

  // AS-26: exportarPDF — window.open retorna janela real (ramo if-win true)

  describe('AS-26: exportarPDF — win não-null (if-win true branch)', () => {
    it('escreve HTML e fecha o documento quando window.open retorna objeto', () => {
      const { store, http } = setup();

      const mockDoc = { write: jest.fn(), close: jest.fn() };
      const mockWin = { document: mockDoc } as unknown as Window;
      const openSpy = jest.spyOn(window, 'open').mockReturnValue(mockWin);

      store.exportarPDF();
      http.expectOne((r) => r.url === `${BASE}/export`).flush({ data: [makeEvent()], total: 1 });

      expect(mockDoc.write).toHaveBeenCalled();
      expect(mockDoc.close).toHaveBeenCalled();
      openSpy.mockRestore();
    });
  });

  // AS-27: exportarPDF — filtros aplicados geram params corretos na URL

  describe('AS-27: exportarPDF com filtros agentId/from/to/outcome', () => {
    it('envia agentId, from, to, outcome quando filtros definidos', () => {
      const { store, http } = setup();

      // carrega com filtros para que store.filtros() tenha valores não-vazios
      store.loadEventos({ agentId: 'agt-1', from: '2026-01-01', to: '2026-06-30', outcome: 'BLOQUEADO' });
      http.expectOne((r) => r.url === BASE).flush(makePage());

      const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);
      store.exportarPDF();
      const req = http.expectOne((r) => r.url === `${BASE}/export`);
      expect(req.request.params.get('agentId')).toBe('agt-1');
      expect(req.request.params.get('from')).toContain('2026-01-01');
      expect(req.request.params.get('to')).toContain('2026-06-30');
      expect(req.request.params.get('outcome')).toBe('BLOQUEADO');
      req.flush({ data: [makeEvent()], total: 1 });
      openSpy.mockRestore();
    });
  });
});
