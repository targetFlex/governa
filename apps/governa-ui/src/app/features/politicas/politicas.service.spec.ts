// ============================================================
// politicas.service.spec.ts
//
// TDD — Given/When/Then  (25 testes)
// Estratégia: HttpClientTestingModule + flush manual de requests.
// ============================================================

import { TestBed }                from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
}                                 from '@angular/common/http/testing';
import { PoliticasStore }         from './politicas.service';
import type { Politica }          from '../../shared/models/politica.model';

const POLITICA_STUB: Politica = {
  id:             'policy-1',
  tenantId:       'tenant-a',
  name:           'Atendimento Consultivo',
  autonomyLevel:  'CONSULTIVO',
  allowedActions: ['read_protheus_pedido'],
  approvers:      [],
  version:        '1.0.0',
};

describe('PoliticasStore — estado inicial', () => {
  let store: InstanceType<typeof PoliticasStore>;
  let http:  HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    store = TestBed.inject(PoliticasStore);
    http  = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('politica inicia como null', () => {
    expect(store.politica()).toBeNull();
  });

  it('loading inicia como false', () => {
    expect(store.loading()).toBe(false);
  });

  it('saving inicia como false', () => {
    expect(store.saving()).toBe(false);
  });

  it('error inicia como null', () => {
    expect(store.error()).toBeNull();
  });

  it('saveSuccess inicia como false', () => {
    expect(store.saveSuccess()).toBe(false);
  });

  it('hasError é false no estado inicial', () => {
    expect(store.hasError()).toBe(false);
  });

  it('isLoaded é false no estado inicial', () => {
    expect(store.isLoaded()).toBe(false);
  });

  it('nivelAtual é null no estado inicial', () => {
    expect(store.nivelAtual()).toBeNull();
  });
});

describe('PoliticasStore.loadPolitica', () => {
  let store: InstanceType<typeof PoliticasStore>;
  let http:  HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    store = TestBed.inject(PoliticasStore);
    http  = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('chama GET /policies/:id e popula politica()', () => {
    // Given
    store.loadPolitica('policy-1');

    // When
    const req = http.expectOne((r) => r.url.includes('/policies/policy-1'));
    req.flush({ data: POLITICA_STUB });

    // Then
    expect(store.politica()?.id).toBe('policy-1');
    expect(store.loading()).toBe(false);
  });

  it('set loading=true durante a requisição', () => {
    store.loadPolitica('policy-1');
    expect(store.loading()).toBe(true);
    http.expectOne((r) => r.url.includes('/policies/policy-1')).flush({ data: POLITICA_STUB });
  });

  it('isLoaded=true após carga bem-sucedida', () => {
    store.loadPolitica('policy-1');
    http.expectOne((r) => r.url.includes('/policies/policy-1')).flush({ data: POLITICA_STUB });
    expect(store.isLoaded()).toBe(true);
  });

  it('nivelAtual reflete autonomyLevel da política carregada', () => {
    store.loadPolitica('policy-1');
    http.expectOne((r) => r.url.includes('/policies/policy-1')).flush({ data: POLITICA_STUB });
    expect(store.nivelAtual()).toBe('CONSULTIVO');
  });

  it('set error quando GET falha com 404', () => {
    store.loadPolitica('inexistente');
    http
      .expectOne((r) => r.url.includes('/policies/inexistente'))
      .flush({ message: 'Política inexistente não encontrada' }, { status: 404, statusText: 'Not Found' });

    expect(store.error()).toContain('não encontrada');
    expect(store.politica()).toBeNull();
  });

  it('set error genérico quando GET falha com 503', () => {
    store.loadPolitica('policy-1');
    http
      .expectOne((r) => r.url.includes('/policies/policy-1'))
      .flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('limpa erro ao carregar nova política', () => {
    // First load fails
    store.loadPolitica('policy-1');
    http
      .expectOne((r) => r.url.includes('/policies/policy-1'))
      .flush(null, { status: 500, statusText: 'Error' });
    expect(store.error()).toBeTruthy();

    // Second load succeeds
    store.loadPolitica('policy-1');
    http
      .expectOne((r) => r.url.includes('/policies/policy-1'))
      .flush({ data: POLITICA_STUB });
    expect(store.error()).toBeNull();
  });
});

describe('PoliticasStore.savePolitica', () => {
  let store: InstanceType<typeof PoliticasStore>;
  let http:  HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    store = TestBed.inject(PoliticasStore);
    http  = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('chama PATCH /policies/:id com o dto correto', () => {
    store.savePolitica('policy-1', { name: 'Novo Nome' });

    const req = http.expectOne((r) =>
      r.url.includes('/policies/policy-1') && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({ name: 'Novo Nome' });
    req.flush({ data: { ...POLITICA_STUB, name: 'Novo Nome', version: '1.1.0' } });
  });

  it('atualiza politica() após save bem-sucedido', () => {
    store.savePolitica('policy-1', { autonomyLevel: 'ASSISTIDO' });
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush({ data: { ...POLITICA_STUB, autonomyLevel: 'ASSISTIDO', version: '1.1.0' } });

    expect(store.politica()?.autonomyLevel).toBe('ASSISTIDO');
    expect(store.politica()?.version).toBe('1.1.0');
  });

  it('set saveSuccess=true após PATCH bem-sucedido', () => {
    store.savePolitica('policy-1', { name: 'X' });
    http.expectOne((r) => r.method === 'PATCH').flush({ data: POLITICA_STUB });
    expect(store.saveSuccess()).toBe(true);
  });

  it('saving=false após PATCH concluído', () => {
    store.savePolitica('policy-1', { name: 'X' });
    expect(store.saving()).toBe(true);
    http.expectOne((r) => r.method === 'PATCH').flush({ data: POLITICA_STUB });
    expect(store.saving()).toBe(false);
  });

  it('set error quando PATCH falha com 400', () => {
    store.savePolitica('policy-1', { approvers: ['invalid'] as string[] });
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush(
        { issues: [{ message: 'Aprovador deve ser e-mail válido' }] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(store.error()).toContain('e-mail válido');
    expect(store.saveSuccess()).toBe(false);
  });

  it('set error quando PATCH falha com 404 (cross-tenant)', () => {
    store.savePolitica('policy-1', { name: 'hack' });
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush(
        { message: 'Política policy-1 não encontrada ou inativa' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(store.error()).toContain('não encontrada');
  });
});

describe('PoliticasStore.clearError e clearSaveSuccess', () => {
  let store: InstanceType<typeof PoliticasStore>;
  let http:  HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    store = TestBed.inject(PoliticasStore);
    http  = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('clearError limpa o erro', () => {
    store.savePolitica('p', { name: 'x' });
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush(null, { status: 500, statusText: 'Error' });
    expect(store.error()).toBeTruthy();

    store.clearError();
    expect(store.error()).toBeNull();
    expect(store.hasError()).toBe(false);
  });

  it('clearSaveSuccess limpa o flag de sucesso', () => {
    store.savePolitica('p', { name: 'x' });
    http.expectOne((r) => r.method === 'PATCH').flush({ data: POLITICA_STUB });
    expect(store.saveSuccess()).toBe(true);

    store.clearSaveSuccess();
    expect(store.saveSuccess()).toBe(false);
  });
});
