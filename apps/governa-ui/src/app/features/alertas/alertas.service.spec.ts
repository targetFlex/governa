/**
 * alertas.service.spec.ts — TDD para AlertasStore.
 *
 * Padrão: HttpClientTestingModule + flush manual.
 * SSE (EventSource) mockado via jest.
 */

import { TestBed }                                         from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController }  from '@angular/common/http/testing';
import { AlertasStore }                                    from './alertas.service';
import { Alert, AlertPage, AlertThreshold }                from '../../shared/models/alertas.model';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAlert(partial: Partial<Alert> = {}): Alert {
  return {
    id:        'alert-1',
    tenantId:  'tenant-1',
    agentId:   '00000000-0000-0000-0000-000000000001',
    kind:      'TOOL_BLOCKED',
    severity:  'HIGH',
    status:    'OPEN',
    message:   'Tool bloqueada por política consultiva',
    metadata:  {},
    createdAt: '2026-06-13T10:00:00.000Z',
    updatedAt: '2026-06-13T10:00:00.000Z',
    ...partial,
  };
}

function makePage(partial: Partial<AlertPage> = {}): AlertPage {
  return {
    data:  [makeAlert()],
    total: 1,
    page:  1,
    limit: 20,
    ...partial,
  };
}

function makeThreshold(kind = 'TOOL_BLOCKED'): AlertThreshold {
  return {
    id:                  'thresh-1',
    tenantId:            'tenant-1',
    kind:                kind as AlertThreshold['kind'],
    enabled:             true,
    errorRatePercent:    null,
    volumePerHour:       null,
    checkpointExpiryMin: null,
    updatedAt:           '2026-06-13T10:00:00.000Z',
  };
}

// ─── Mock EventSource ─────────────────────────────────────────────────────────

class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onerror: ((e: Event) => void) | null = null;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(fn);
  }

  dispatchAlert(data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent;
    (this.listeners['alert'] ?? []).forEach((fn) => fn(evt));
  }

  close() {}
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function setup() {
  MockEventSource.instances = [];
  // @ts-expect-error mock global
  globalThis.EventSource = MockEventSource;

  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [AlertasStore],
  });

  const store = TestBed.inject(AlertasStore);
  const http  = TestBed.inject(HttpTestingController);
  return { store, http };
}

const BASE = 'http://localhost:3000/alerts';

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('AlertasStore', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  // ── Estado inicial ──────────────────────────────────────────────────────────

  describe('estado inicial', () => {
    it('alertas vazio, loading false, sem error', () => {
      const { store, http } = setup();
      expect(store.alertas()).toEqual([]);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.total()).toBe(0);
      expect(store.streamConnected()).toBe(false);
      http.expectNone(BASE);
    });
  });

  // ── loadAlertas — sucesso ───────────────────────────────────────────────────

  describe('loadAlertas', () => {
    it('popula alertas e total após flush', () => {
      const { store, http } = setup();
      store.loadAlertas();

      expect(store.loading()).toBe(true);
      http.expectOne((req) => req.url === BASE).flush(makePage());
      expect(store.loading()).toBe(false);
      expect(store.alertas()).toHaveLength(1);
      expect(store.total()).toBe(1);
    });

    it('seta error ao falhar', () => {
      const { store, http } = setup();
      store.loadAlertas();

      http.expectOne((req) => req.url === BASE)
        .flush({ error: 'Falha interna' }, { status: 500, statusText: 'Error' });

      expect(store.error()).toBeTruthy();
      expect(store.alertas()).toEqual([]);
    });

    it('respeita filtro de kind na URL', () => {
      const { store, http } = setup();
      store.loadAlertas({ kind: 'ERROR_RATE' });

      const req = http.expectOne((r) => r.url === BASE && r.params.get('kind') === 'ERROR_RATE');
      req.flush(makePage({ data: [], total: 0 }));
      expect(store.filtros().kind).toBe('ERROR_RATE');
    });

    it('respeita filtro de status na URL', () => {
      const { store, http } = setup();
      store.loadAlertas({ status: 'OPEN' });

      const req = http.expectOne((r) => r.url === BASE && r.params.get('status') === 'OPEN');
      req.flush(makePage());
    });

    it('computed isEmpty = true após flush vazio', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE).flush(makePage({ data: [], total: 0 }));
      expect(store.isEmpty()).toBe(true);
    });

    it('computed totalPages calcula corretamente', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE)
        .flush(makePage({ data: [makeAlert(), makeAlert()], total: 45 }));
      expect(store.totalPages()).toBe(3);  // ceil(45/20)
    });
  });

  // ── atualizarStatus ─────────────────────────────────────────────────────────

  describe('atualizarStatus', () => {
    it('atualiza alerta no estado após patch bem-sucedido', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE)
        .flush(makePage({ data: [makeAlert({ id: 'alert-1', status: 'OPEN' })] }));

      store.atualizarStatus('alert-1', 'ACKNOWLEDGED');
      const patchReq = http.expectOne(`${BASE}/alert-1/status`);
      expect(patchReq.request.method).toBe('PATCH');
      expect(patchReq.request.body).toEqual({ status: 'ACKNOWLEDGED' });

      patchReq.flush(makeAlert({ id: 'alert-1', status: 'ACKNOWLEDGED' }));
      expect(store.alertas()[0].status).toBe('ACKNOWLEDGED');
    });

    it('seta error ao falhar no patch', () => {
      const { store, http } = setup();
      store.atualizarStatus('id-x', 'RESOLVED');
      http.expectOne(`${BASE}/id-x/status`)
        .flush({ error: 'Não encontrado' }, { status: 404, statusText: 'Not Found' });
      expect(store.error()).toBeTruthy();
    });
  });

  // ── thresholds ──────────────────────────────────────────────────────────────

  describe('loadThresholds', () => {
    it('popula thresholds após flush', () => {
      const { store, http } = setup();
      store.loadThresholds();

      http.expectOne(`${BASE}/thresholds`)
        .flush({ data: [makeThreshold(), makeThreshold('ERROR_RATE')] });

      expect(store.thresholds()).toHaveLength(2);
    });
  });

  describe('salvarThreshold', () => {
    it('faz PUT e atualiza threshold no estado', () => {
      const { store, http } = setup();
      store.loadThresholds();
      http.expectOne(`${BASE}/thresholds`)
        .flush({ data: [makeThreshold('ERROR_RATE')] });

      store.salvarThreshold('ERROR_RATE', { enabled: true, errorRatePercent: 20 });
      const putReq = http.expectOne(`${BASE}/thresholds/ERROR_RATE`);
      expect(putReq.request.method).toBe('PUT');

      putReq.flush(makeThreshold('ERROR_RATE'));
      expect(store.thresholds()[0].kind).toBe('ERROR_RATE');
    });
  });

  // ── SSE ─────────────────────────────────────────────────────────────────────

  describe('conectarStream', () => {
    it('marca streamConnected=true e adiciona alerta ao estado', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE).flush(makePage({ data: [], total: 0 }));

      store.conectarStream();
      expect(store.streamConnected()).toBe(true);
      expect(MockEventSource.instances).toHaveLength(1);

      const novoAlerta = makeAlert({ id: 'alert-new', kind: 'ERROR_RATE' });
      MockEventSource.instances[0].dispatchAlert(novoAlerta);

      expect(store.alertas()[0].id).toBe('alert-new');
      expect(store.total()).toBe(1);
    });

    it('não cria segunda instância de EventSource se já conectado', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE).flush(makePage({ data: [], total: 0 }));

      store.conectarStream();
      store.conectarStream();
      expect(MockEventSource.instances).toHaveLength(1);
    });

    it('desconectarStream fecha EventSource', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE).flush(makePage({ data: [], total: 0 }));

      store.conectarStream();
      store.desconectarStream();
      expect(store.streamConnected()).toBe(false);
    });
  });

  // ── limparFiltros ───────────────────────────────────────────────────────────

  describe('limparFiltros', () => {
    it('reseta filtros e recarrega', () => {
      const { store, http } = setup();
      store.loadAlertas({ kind: 'ERROR_RATE', status: 'OPEN' });
      http.expectOne((req) => req.url === BASE).flush(makePage());

      store.limparFiltros();
      const req = http.expectOne((r) => r.url === BASE);
      req.flush(makePage({ data: [], total: 0 }));

      expect(store.filtros().kind).toBe('');
      expect(store.filtros().status).toBe('');
    });
  });

  // ── clearError ──────────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('zera o error', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE)
        .flush({ error: 'Erro' }, { status: 500, statusText: 'Error' });

      expect(store.error()).toBeTruthy();
      store.clearError();
      expect(store.error()).toBeNull();
    });
  });

  // ── hasError computed — true branch ────────────────────────────────────────

  describe('hasError computed — ramo true', () => {
    it('hasError() retorna true quando há error', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE)
        .flush({ error: 'Falha' }, { status: 500, statusText: 'Error' });
      expect(store.hasError()).toBe(true);
    });
  });

  // ── openCount — filter false branch ────────────────────────────────────────

  describe('openCount — alertas não-OPEN não contam', () => {
    it('openCount exclui alertas com status != OPEN', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE).flush(
        makePage({ data: [makeAlert({ status: 'ACKNOWLEDGED' }), makeAlert({ status: 'RESOLVED' })], total: 2 })
      );
      expect(store.openCount()).toBe(0);
    });
  });

  // ── SSE — catch parse error ─────────────────────────────────────────────────

  describe('conectarStream — JSON inválido descartado silenciosamente', () => {
    it('não lança ao receber evento SSE com JSON inválido', () => {
      const { store, http } = setup();
      store.loadAlertas();
      http.expectOne((req) => req.url === BASE).flush(makePage({ data: [], total: 0 }));

      store.conectarStream();
      const sse = MockEventSource.instances[0];
      // dispara evento com dados que não são JSON válido
      const badEvt = { data: 'INVALID_JSON' } as MessageEvent;
      expect(() => {
        (sse.listeners['alert'] ?? []).forEach((fn) => fn(badEvt));
      }).not.toThrow();
      expect(store.alertas()).toHaveLength(0);
    });
  });

  // ── loadThresholds — erro HTTP ──────────────────────────────────────────────

  describe('loadThresholds — erro HTTP seta error', () => {
    it('seta error ao falhar no GET /thresholds', () => {
      const { store, http } = setup();
      store.loadThresholds();
      http.expectOne(`${BASE}/thresholds`)
        .flush({ error: 'Não autorizado' }, { status: 401, statusText: 'Unauthorized' });
      expect(store.error()).toBeTruthy();
    });
  });

  // ── salvarThreshold — erro HTTP ─────────────────────────────────────────────

  describe('salvarThreshold — erro HTTP seta error', () => {
    it('seta error ao falhar no PUT /thresholds/:kind', () => {
      const { store, http } = setup();
      store.salvarThreshold('ERROR_RATE', { enabled: false });
      http.expectOne(`${BASE}/thresholds/ERROR_RATE`)
        .flush({ error: 'Timeout' }, { status: 504, statusText: 'Gateway Timeout' });
      expect(store.error()).toBeTruthy();
    });
  });
});
