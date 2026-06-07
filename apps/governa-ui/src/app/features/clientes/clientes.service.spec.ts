// ============================================================
// clientes.service.spec.ts
//
// Testa ClientesService + ClientesStore.
// Cobertura de: loadClientes (sucesso, erro, loading, filtro),
// clearError, computed signals (isEmpty, hasError, totalPages,
// clientesAtivos).
// ============================================================

import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { throwError } from 'rxjs';
import { ClientesService, ClientesStore } from './clientes.service';
import { Cliente, ClientesResponse } from '../../shared/models/cliente.model';
import { environment } from '@env/environment';

// ── Fixtures ─────────────────────────────────────────────────

const mockClienteAtivo: Cliente = {
  id: 'c1',
  codigo: 'CLI-001',
  nome: 'Empresa Alfa Ltda',
  tipoPessoa: 'PJ',
  documento: '12.345.678/0001-99',
  email: 'contato@alfa.com.br',
  telefone: '(11) 99999-0001',
  ativo: true,
  limiteCredito: 50000.0,
  saldoDevedor: 12500.0,
  moeda: 'BRL',
  criadoEm: '2025-01-15T00:00:00.000Z',
  atualizadoEm: '2026-05-01T00:00:00.000Z',
};

const mockClienteInativo: Cliente = {
  ...mockClienteAtivo,
  id: 'c2',
  codigo: 'CLI-002',
  nome: 'Empresa Beta ME',
  ativo: false,
};

const mockResponse: ClientesResponse = {
  data: [mockClienteAtivo, mockClienteInativo],
  total: 55,
  page: 1,
  pageSize: 20,
};

// ── Suite ─────────────────────────────────────────────────────

describe('ClientesService', () => {
  let service: ClientesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ClientesService, ClientesStore],
    });

    service  = TestBed.inject(ClientesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── Estado inicial ─────────────────────────────────────────

  it('deve iniciar com estado vazio', () => {
    expect(service.clientes()).toEqual([]);
    expect(service.total()).toBe(0);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('isEmpty deve ser true no estado inicial', () => {
    expect(service.isEmpty()).toBe(true);
  });

  it('clientesAtivos deve retornar lista vazia no estado inicial', () => {
    expect(service.clientesAtivos()).toEqual([]);
  });

  it('totalPages deve ser 0 no estado inicial', () => {
    expect(service.totalPages()).toBe(0);
  });

  // ── loadClientes — sucesso ─────────────────────────────────

  it('deve emitir loading=true antes da resposta', () => {
    service.loadClientes();
    expect(service.loading()).toBe(true);

    httpMock.expectOne(() => true).flush(mockResponse);
  });

  it('deve popular clientes e total após resposta 200', () => {
    service.loadClientes();

    httpMock.expectOne(() => true).flush(mockResponse);

    expect(service.clientes()).toHaveLength(2);
    expect(service.clientes()[0].nome).toBe('Empresa Alfa Ltda');
    expect(service.total()).toBe(55);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve calcular totalPages corretamente', () => {
    service.loadClientes(1, 20);
    httpMock.expectOne(() => true).flush(mockResponse); // total 55, pageSize 20 → 3 páginas

    expect(service.totalPages()).toBe(3);
  });

  // ── clientesAtivos (computed) ──────────────────────────────

  it('clientesAtivos deve filtrar apenas clientes com ativo=true', () => {
    service.loadClientes();
    httpMock.expectOne(() => true).flush(mockResponse);

    expect(service.clientesAtivos()).toHaveLength(1);
    expect(service.clientesAtivos()[0].id).toBe('c1');
  });

  it('isEmpty deve ser false após carregar clientes', () => {
    service.loadClientes();
    httpMock.expectOne(() => true).flush(mockResponse);

    expect(service.isEmpty()).toBe(false);
  });

  // ── loadClientes — erro ────────────────────────────────────

  it('deve definir error e zerar clientes em caso de 500', () => {
    service.loadClientes();

    httpMock.expectOne(() => true).flush(
      { message: 'Falha ao consultar Protheus' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(service.error()).toBe('Falha ao consultar Protheus');
    expect(service.clientes()).toEqual([]);
    expect(service.hasError()).toBe(true);
  });

  it('deve setar error quando resposta não tem body message (usa err.message do HttpErrorResponse)', () => {
    service.loadClientes();

    httpMock.expectOne(() => true).flush(null, { status: 502, statusText: 'Bad Gateway' });

    // HttpErrorResponse.message é sempre preenchida ("Http failure response for ...").
    // O branch final ?? 'Erro...' só seria atingido por erros fora do HttpClient.
    expect(service.error()).not.toBeNull();
    expect(service.hasError()).toBe(true);
    expect(service.loading()).toBe(false);
  });

  // ── clearError ─────────────────────────────────────────────

  it('clearError deve limpar o estado de erro', () => {
    service.loadClientes();
    httpMock.expectOne(() => true).flush(
      { message: 'Erro' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    service.clearError();

    expect(service.error()).toBeNull();
    expect(service.hasError()).toBe(false);
  });

  // ── Query params ───────────────────────────────────────────

  it('deve enviar page e pageSize como query params', () => {
    service.loadClientes(3, 10);

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.gatewayBaseUrl}/clientes` &&
        r.params.get('page') === '3' &&
        r.params.get('pageSize') === '10',
    );
    expect(req).toBeTruthy();
    req.flush({ data: [], total: 0, page: 3, pageSize: 10 });
  });

  it('deve enviar filtro como query param q quando informado', () => {
    service.loadClientes(1, 20, 'alfa');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.gatewayBaseUrl}/clientes` &&
        r.params.get('q') === 'alfa',
    );
    expect(req).toBeTruthy();
    req.flush(mockResponse);
  });

  it('não deve enviar param q quando filtro é string vazia', () => {
    service.loadClientes(1, 20, '');

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.gatewayBaseUrl}/clientes` &&
        !r.params.has('q'),
    );
    expect(req).toBeTruthy();
    req.flush(mockResponse);
  });

  it('não deve enviar param q quando filtro contém apenas espaços', () => {
    service.loadClientes(1, 20, '   ');

    const req = httpMock.expectOne(
      (r) => !r.params.has('q'),
    );
    expect(req).toBeTruthy();
    req.flush(mockResponse);
  });

  // ── Fallback de mensagem de erro ───────────────────────────

  it('deve usar mensagem de fallback quando err não tem error.message nem message', () => {
    // Cobre o branch ?? 'Erro ao carregar clientes...' — inalcançável via HttpTestingController
    // pois HttpErrorResponse.message é sempre preenchida.
    const http = TestBed.inject(HttpClient);
    const spy = jest.spyOn(http, 'get').mockReturnValueOnce(
      throwError(() => ({ error: null, message: null })),
    );

    service.loadClientes();

    expect(service.error()).toBe('Erro ao carregar clientes. Tente novamente.');
    expect(service.hasError()).toBe(true);
    spy.mockRestore();
  });
});
