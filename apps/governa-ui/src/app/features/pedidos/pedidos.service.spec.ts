// ============================================================
// pedidos.service.spec.ts
//
// Testa PedidosService + PedidosStore.
// Cobertura de: loadPedidos (sucesso, erro, loading), clearError,
// computed signals (isEmpty, hasError, totalPages).
// ============================================================

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PedidosService, PedidosStore } from './pedidos.service';
import { Pedido, PedidosResponse } from '../../shared/models/pedido.model';
import { environment } from '@env/environment';

// ── Fixtures ─────────────────────────────────────────────────

const mockPedido: Pedido = {
  numeroPedido: 'PED-001',
  clienteId: 'CLI-001',
  loja: '01',
  status: 'ABERTO',
  valorTotal: 1500.0,
  dataEmissao: '2026-05-01T00:00:00.000Z',
  itens: [
    { codigoProduto: 'SKU-001', quantidade: 3, precoUnitario: 500.0 },
  ],
};

const mockResponse: PedidosResponse = {
  data: [mockPedido],
  total: 42,
  page: 1,
  pageSize: 20,
};

// ── Suite ─────────────────────────────────────────────────────

describe('PedidosService', () => {
  let service: PedidosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PedidosService, PedidosStore],
    });

    service  = TestBed.inject(PedidosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── Estado inicial ─────────────────────────────────────────

  it('deve iniciar com estado vazio', () => {
    expect(service.pedidos()).toEqual([]);
    expect(service.total()).toBe(0);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('isEmpty deve ser true no estado inicial', () => {
    expect(service.isEmpty()).toBe(true);
  });

  it('hasError deve ser false no estado inicial', () => {
    expect(service.hasError()).toBe(false);
  });

  it('totalPages deve ser 0 no estado inicial', () => {
    expect(service.totalPages()).toBe(0);
  });

  // ── loadPedidos — sucesso ──────────────────────────────────

  it('deve emitir loading=true antes da resposta', () => {
    service.loadPedidos();
    expect(service.loading()).toBe(true);

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.gatewayBaseUrl}/pedidos`,
    );
    req.flush(mockResponse);
  });

  it('deve popular pedidos e total após resposta 200', () => {
    service.loadPedidos(1, 20);

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.gatewayBaseUrl}/pedidos`,
    );
    req.flush(mockResponse);

    expect(service.pedidos()).toHaveLength(1);
    expect(service.pedidos()[0].numeroPedido).toBe('PED-001');
    expect(service.total()).toBe(42);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve calcular totalPages corretamente', () => {
    service.loadPedidos(1, 20);
    httpMock.expectOne(() => true).flush(mockResponse); // total 42, pageSize 20 → 3 páginas

    expect(service.totalPages()).toBe(3);
  });

  it('isEmpty deve ser false após carregar pedidos', () => {
    service.loadPedidos();
    httpMock.expectOne(() => true).flush(mockResponse);

    expect(service.isEmpty()).toBe(false);
  });

  // ── loadPedidos — erro ─────────────────────────────────────

  it('deve definir error e zerar pedidos em caso de 500', () => {
    service.loadPedidos();

    const req = httpMock.expectOne(() => true);
    req.flush(
      { message: 'Erro interno no gateway' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(service.error()).toBe('Erro interno no gateway');
    expect(service.pedidos()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.hasError()).toBe(true);
  });

  it('deve setar error quando resposta não tem body message (usa err.message do HttpErrorResponse)', () => {
    service.loadPedidos();

    const req = httpMock.expectOne(() => true);
    req.flush(null, { status: 503, statusText: 'Service Unavailable' });

    // HttpErrorResponse.message é sempre preenchida ("Http failure response for ...").
    // O branch final ?? 'Erro...' só seria atingido por erros fora do HttpClient.
    expect(service.error()).not.toBeNull();
    expect(service.hasError()).toBe(true);
    expect(service.loading()).toBe(false);
  });

  // ── clearError ─────────────────────────────────────────────

  it('clearError deve limpar o estado de erro', () => {
    service.loadPedidos();
    httpMock.expectOne(() => true).flush(
      { message: 'Erro' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(service.hasError()).toBe(true);

    service.clearError();

    expect(service.error()).toBeNull();
    expect(service.hasError()).toBe(false);
  });

  // ── Query params ───────────────────────────────────────────

  it('deve enviar page e pageSize como query params', () => {
    service.loadPedidos(2, 10);

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.gatewayBaseUrl}/pedidos` &&
        r.params.get('page') === '2' &&
        r.params.get('pageSize') === '10',
    );
    expect(req).toBeTruthy();
    req.flush({ data: [], total: 0, page: 2, pageSize: 10 });
  });

  it('deve enviar filtro como query param q quando informado', () => {
    service.loadPedidos(1, 20, 'PED-001');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.gatewayBaseUrl}/pedidos` &&
        r.params.get('q') === 'PED-001',
    );
    expect(req).toBeTruthy();
    req.flush(mockResponse);
  });

  it('não deve enviar param q quando filtro é string vazia', () => {
    service.loadPedidos(1, 20, '');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.gatewayBaseUrl}/pedidos` &&
        !r.params.has('q'),
    );
    expect(req).toBeTruthy();
    req.flush(mockResponse);
  });

  it('não deve enviar param q quando filtro contém apenas espaços', () => {
    service.loadPedidos(1, 20, '   ');

    const req = httpMock.expectOne(
      (r) => !r.params.has('q'),
    );
    expect(req).toBeTruthy();
    req.flush(mockResponse);
  });

});
