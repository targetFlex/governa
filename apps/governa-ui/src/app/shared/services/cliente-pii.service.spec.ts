// ============================================================
// cliente-pii.service.spec.ts
//
// Cobertura: reveal() happy path, cache por (clienteId, loja),
// eviction do cache em erro (permite retry manual).
// ============================================================
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ClientePiiService } from './cliente-pii.service';
import { ClientePii } from '../models/cliente.model';
import { environment } from '@env/environment';

const mockPii: ClientePii = {
  clienteId: 'CLI001',
  loja: '01',
  nome: 'Empresa Exemplo LTDA',
  documento: '12.345.678/0001-90',
  email: 'contato@empresa.com',
  telefone: '(11) 99999-9999',
  endereco: 'Rua Exemplo, 1|São Paulo|SP|01000000',
};

describe('ClientePiiService', () => {
  let service: ClientePiiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ClientePiiService],
    });

    service  = TestBed.inject(ClientePiiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('resolve PII via GET /clientes/:clienteId/reidentificar?loja=', (done) => {
    service.reveal('CLI001', '01').subscribe((pii) => {
      expect(pii).toEqual(mockPii);
      done();
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.coreBaseUrl}/clientes/CLI001/reidentificar` && r.params.get('loja') === '01',
    );
    req.flush({ data: mockPii, traceId: 't1', latencyMs: 5 });
  });

  it('cacheia por (clienteId, loja) — segunda chamada não dispara novo HTTP', (done) => {
    service.reveal('CLI001', '01').subscribe(() => {
      service.reveal('CLI001', '01').subscribe((pii) => {
        expect(pii).toEqual(mockPii);
        done();
      });
    });

    const req = httpMock.expectOne(() => true);
    req.flush({ data: mockPii, traceId: 't1', latencyMs: 5 });
  });

  it('clienteId/loja diferentes disparam chamadas HTTP independentes', () => {
    service.reveal('CLI001', '01').subscribe();
    service.reveal('CLI002', '01').subscribe();

    httpMock.expectOne((r) => r.url.endsWith('/clientes/CLI001/reidentificar')).flush({ data: mockPii, traceId: 't1', latencyMs: 5 });
    httpMock.expectOne((r) => r.url.endsWith('/clientes/CLI002/reidentificar')).flush({ data: { ...mockPii, clienteId: 'CLI002' }, traceId: 't2', latencyMs: 5 });
  });

  it('em caso de erro, remove do cache e permite retry com nova chamada HTTP', (done) => {
    service.reveal('CLI001', '01').subscribe({
      error: () => {
        service.reveal('CLI001', '01').subscribe((pii) => {
          expect(pii).toEqual(mockPii);
          done();
        });

        const retryReq = httpMock.expectOne(() => true);
        retryReq.flush({ data: mockPii, traceId: 't1', latencyMs: 5 });
      },
    });

    const req = httpMock.expectOne(() => true);
    req.flush({ error: 'falhou' }, { status: 500, statusText: 'Internal Server Error' });
  });

  it('clear() limpa o cache — próxima chamada dispara novo HTTP', () => {
    service.reveal('CLI001', '01').subscribe();
    httpMock.expectOne(() => true).flush({ data: mockPii, traceId: 't1', latencyMs: 5 });

    service.clear();
    service.reveal('CLI001', '01').subscribe();
    httpMock.expectOne(() => true).flush({ data: mockPii, traceId: 't1', latencyMs: 5 });
  });
});
