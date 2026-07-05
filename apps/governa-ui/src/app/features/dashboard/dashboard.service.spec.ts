import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { DashboardService, CockpitData } from './dashboard.service';
import { environment } from '@env/environment';

const CORE = environment.coreBaseUrl;

const mockAgentesResp = { data: [], total: 0 };
const mockAlertasPage = { data: [], total: 0, page: 1, limit: 5 };
const mockDecisoes    = { data: [], total: 0, page: 1, limit: 5 };
const mockBloqueados  = { data: [], total: 0, page: 1, limit: 1 };

describe('DashboardService', () => {
  let svc:      DashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports:   [HttpClientTestingModule],
      providers: [DashboardService],
    });
    svc      = TestBed.inject(DashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // Consome todos os requests pendentes sem assertions — usado como limpeza no final de cada teste.
  // Pula requests marcados como cancelados (forkJoin aborta os pares quando um falha).
  function drainAll(): void {
    httpMock.match(() => true).forEach((r) => {
      if (!(r as any).cancelled) r.flush({});
    });
  }

  it('deve disparar GET /agents', () => {
    svc.loadCockpit().subscribe();
    const reqs = httpMock.match((r) => r.url === `${CORE}/agents`);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.method).toBe('GET');
    drainAll();
  });

  it('deve disparar GET /alerts com status=OPEN e limit=5', () => {
    svc.loadCockpit().subscribe();
    const reqs = httpMock.match((r) => r.url === `${CORE}/alerts`);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].request.params.get('status')).toBe('OPEN');
    expect(reqs[0].request.params.get('limit')).toBe('5');
    reqs[0].flush(mockAlertasPage);
    drainAll();
  });

  it('deve disparar GET /audit-events sem outcome para decisoes recentes', () => {
    svc.loadCockpit().subscribe();
    const reqs = httpMock.match((r) => r.url === `${CORE}/audit-events`);
    expect(reqs).toHaveLength(2);
    const decisoesReq = reqs.find((r) => !r.request.params.has('outcome'));
    expect(decisoesReq).toBeDefined();
    expect(decisoesReq?.request.params.get('limit')).toBe('5');
    reqs.forEach((r, i) => r.flush(i === 0 ? mockDecisoes : mockBloqueados));
    drainAll();
  });

  it('deve disparar GET /audit-events com outcome=BLOQUEADO e limit=1', () => {
    svc.loadCockpit().subscribe();
    const reqs = httpMock.match((r) => r.url === `${CORE}/audit-events`);
    const bloqReq = reqs.find((r) => r.request.params.get('outcome') === 'BLOQUEADO');
    expect(bloqReq).toBeDefined();
    expect(bloqReq?.request.params.get('limit')).toBe('1');
    reqs.forEach((r, i) => r.flush(i === 0 ? mockDecisoes : mockBloqueados));
    drainAll();
  });

  it('deve emitir CockpitData composto quando todos os requests completam', () => {
    let result: CockpitData | undefined;
    svc.loadCockpit().subscribe((d) => (result = d));

    httpMock.match((r) => r.url === `${CORE}/agents`)[0].flush(mockAgentesResp);
    httpMock.match((r) => r.url === `${CORE}/alerts`)[0].flush(mockAlertasPage);
    const auditReqs = httpMock.match((r) => r.url === `${CORE}/audit-events`);
    auditReqs[0].flush(mockDecisoes);
    auditReqs[1].flush(mockBloqueados);

    expect(result).toBeDefined();
    expect(result!.agentes).toEqual(mockAgentesResp);
    expect(result!.alertas).toEqual(mockAlertasPage);
    expect(result!.decisoes).toEqual(mockDecisoes);
    expect(result!.bloqueados).toEqual(mockBloqueados);
  });

  it('deve propagar erro quando /agents falha', () => {
    let errored = false;
    svc.loadCockpit().subscribe({ error: () => (errored = true) });

    httpMock.match((r) => r.url === `${CORE}/agents`)[0].flush(null, {
      status: 500, statusText: 'Internal Server Error',
    });

    expect(errored).toBe(true);

    // Angular 17: forkJoin não cancela os requests restantes sincronamente
    // — drenamos para satisfazer o verify() do afterEach.
    drainAll();
  });
});
