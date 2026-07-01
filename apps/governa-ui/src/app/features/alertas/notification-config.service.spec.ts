/**
 * notification-config.service.spec.ts — TDD para NotificationConfigStore.
 *
 * Padrão: HttpClientTestingModule + flush manual.
 */

import { TestBed }                                        from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationConfigStore }                        from './notification-config.service';
import type { NotificationConfig }                        from '../../shared/models/notification-config.model';

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeConfig(partial: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    id:              'cfg-1',
    tenantId:        'tenant-1',
    emailEnabled:    false,
    emailRecipients: [],
    webhookEnabled:  false,
    webhookUrl:      null,
    minSeverity:     'MEDIUM',
    updatedAt:       '2026-06-30T10:00:00.000Z',
    ...partial,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('NotificationConfigStore', () => {
  let store: InstanceType<typeof NotificationConfigStore>;
  let http:  HttpTestingController;
  const BASE = 'http://localhost:3000/notifications/config';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    store = TestBed.inject(NotificationConfigStore);
    http  = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  // ── Estado inicial ──────────────────────────────────────────────────────────

  it('inicia com config null, loading false, error null', () => {
    expect(store.config()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('hasConfig retorna false quando config é null', () => {
    expect(store.hasConfig()).toBe(false);
  });

  it('hasError retorna false quando error é null', () => {
    expect(store.hasError()).toBe(false);
  });

  // ── loadConfig — sucesso ────────────────────────────────────────────────────

  it('loadConfig: define loading=true durante a requisição', () => {
    store.loadConfig();
    expect(store.loading()).toBe(true);
    http.expectOne(BASE).flush(makeConfig());
    expect(store.loading()).toBe(false);
  });

  it('loadConfig: popula config no estado ao receber resposta', () => {
    const cfg = makeConfig({ emailEnabled: true, emailRecipients: ['a@b.com'] });
    store.loadConfig();
    http.expectOne(BASE).flush(cfg);
    expect(store.config()).toEqual(cfg);
    expect(store.hasConfig()).toBe(true);
  });

  it('loadConfig: limpa error antes de disparar', () => {
    // força um erro primeiro
    store.loadConfig();
    http.expectOne(BASE).flush({ error: 'fail' }, { status: 500, statusText: 'Error' });
    expect(store.hasError()).toBe(true);

    // nova tentativa deve limpar o erro
    store.loadConfig();
    expect(store.error()).toBeNull();
    http.expectOne(BASE).flush(makeConfig());
  });

  // ── loadConfig — 404 (sem config) ──────────────────────────────────────────

  it('loadConfig: 404 deixa config null sem expor erro ao usuário', () => {
    store.loadConfig();
    http.expectOne(BASE).flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
    expect(store.config()).toBeNull();
    expect(store.hasError()).toBe(false);
  });

  // ── loadConfig — erro HTTP ─────────────────────────────────────────────────

  it('loadConfig: 500 expõe mensagem de erro', () => {
    store.loadConfig();
    http.expectOne(BASE).flush(
      { error: 'Erro interno' },
      { status: 500, statusText: 'Error' },
    );
    expect(store.hasError()).toBe(true);
    expect(store.error()).toBe('Erro interno');
  });

  it('loadConfig: erro sem body usa mensagem padrão', () => {
    store.loadConfig();
    http.expectOne(BASE).error(new ProgressEvent('error'));
    expect(store.hasError()).toBe(true);
    expect(store.error()).toBeTruthy();
  });

  // ── saveConfig — sucesso ───────────────────────────────────────────────────

  it('saveConfig: define saving=true durante a requisição', () => {
    store.saveConfig({ emailEnabled: true });
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('PUT');
    expect(store.saving()).toBe(true);
    req.flush(makeConfig({ emailEnabled: true }));
    expect(store.saving()).toBe(false);
  });

  it('saveConfig: atualiza config no estado', () => {
    const updated = makeConfig({ emailEnabled: true, emailRecipients: ['x@y.com'] });
    store.saveConfig({ emailEnabled: true, emailRecipients: ['x@y.com'] });
    http.expectOne(BASE).flush(updated);
    expect(store.config()).toEqual(updated);
  });

  it('saveConfig: envia body correto no PUT', () => {
    const patch = { webhookEnabled: true, webhookUrl: 'https://hook.io/x', minSeverity: 'HIGH' as const };
    store.saveConfig(patch);
    const req = http.expectOne(BASE);
    expect(req.request.body).toMatchObject(patch);
    req.flush(makeConfig());
  });

  // ── saveConfig — erro ──────────────────────────────────────────────────────

  it('saveConfig: expõe error no estado quando 400', () => {
    store.saveConfig({ emailRecipients: ['nao-e-email'] });
    http.expectOne(BASE).flush(
      { error: 'Body inválido' },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(store.hasError()).toBe(true);
    expect(store.error()).toBe('Body inválido');
    expect(store.saving()).toBe(false);
  });

  // ── clearError ─────────────────────────────────────────────────────────────

  it('clearError: zera o error no estado', () => {
    store.loadConfig();
    http.expectOne(BASE).flush({ error: 'falha' }, { status: 500, statusText: 'Error' });
    expect(store.hasError()).toBe(true);

    store.clearError();
    expect(store.hasError()).toBe(false);
    expect(store.error()).toBeNull();
  });
});
