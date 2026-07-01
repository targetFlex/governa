// ============================================================
// notification-config-panel.component.spec.ts
//
// TDD — Given/When/Then + jest-axe WCAG 2.1 AA
// ============================================================

import { TestBed }             from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { axe, toHaveNoViolations } from 'jest-axe';
import { NotificationConfigPanelComponent } from './notification-config-panel.component';
import { NotificationConfigStore }          from '../notification-config.service';
import { HttpClientTestingModule }          from '@angular/common/http/testing';
import type { NotificationConfig }          from '../../../shared/models/notification-config.model';

expect.extend(toHaveNoViolations);

// ─── Fixtures ────────────────────────────────────────────────────────────────

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

// ─── Mock Store ──────────────────────────────────────────────────────────────

function makeStoreMock(overrides: Record<string, unknown> = {}) {
  const config:   WritableSignal<NotificationConfig | null> = signal(null);
  const loading:  WritableSignal<boolean>                   = signal(false);
  const saving:   WritableSignal<boolean>                   = signal(false);
  const error:    WritableSignal<string | null>             = signal(null);

  return {
    provide: NotificationConfigStore,
    useValue: {
      config,
      loading,
      saving,
      error,
      hasError:   () => error() !== null,
      loadConfig: jest.fn(),
      saveConfig: jest.fn(),
      clearError: jest.fn(),
      ...overrides,
    },
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

async function setup(storeMock = makeStoreMock()) {
  await TestBed.configureTestingModule({
    imports:   [NotificationConfigPanelComponent, HttpClientTestingModule],
    providers: [storeMock],
  }).compileComponents();

  const fixture = TestBed.createComponent(NotificationConfigPanelComponent);
  fixture.detectChanges();
  return { fixture, comp: fixture.componentInstance, store: storeMock.useValue };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('NotificationConfigPanelComponent', () => {

  // ── NCP-1: inicialização ────────────────────────────────────────────────────

  describe('NCP-1: inicialização', () => {
    it('chama loadConfig no ngOnInit', async () => {
      const { store } = await setup();
      expect(store.loadConfig).toHaveBeenCalledTimes(1);
    });

    it('renderiza título do painel', async () => {
      const { fixture } = await setup();
      const titulo = fixture.nativeElement.querySelector('.notif-config__titulo');
      expect(titulo?.textContent).toContain('Canais de notificação');
    });
  });

  // ── NCP-2: estado de loading ────────────────────────────────────────────────

  describe('NCP-2: estado de loading', () => {
    it('exibe skeletons e oculta form quando loading=true', async () => {
      const mock = makeStoreMock();
      const { fixture } = await setup(mock);

      (mock.useValue.loading as WritableSignal<boolean>).set(true);
      fixture.detectChanges();

      const skeletons = fixture.nativeElement.querySelectorAll('.notif-config__skeleton');
      const form      = fixture.nativeElement.querySelector('.notif-config__form');
      expect(skeletons.length).toBe(3);
      expect(form).toBeNull();
    });

    it('oculta skeletons e exibe form quando loading=false', async () => {
      const { fixture } = await setup();
      const form = fixture.nativeElement.querySelector('.notif-config__form');
      expect(form).not.toBeNull();
    });
  });

  // ── NCP-3: estado de erro ───────────────────────────────────────────────────

  describe('NCP-3: estado de erro', () => {
    it('exibe banner de erro quando hasError=true', async () => {
      const mock = makeStoreMock();
      const { fixture } = await setup(mock);

      (mock.useValue.error as WritableSignal<string | null>).set('Falha ao carregar');
      mock.useValue.hasError = () => (mock.useValue.error as WritableSignal<string | null>)() !== null;
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector('.notif-config__erro');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Falha ao carregar');
    });

    it('botão fechar no banner de erro chama store.clearError', async () => {
      const mock = makeStoreMock();
      const { fixture } = await setup(mock);

      (mock.useValue.error as WritableSignal<string | null>).set('Erro X');
      mock.useValue.hasError = () => true;
      fixture.detectChanges();

      const btnFechar: HTMLButtonElement = fixture.nativeElement.querySelector('.notif-config__erro-fechar');
      btnFechar?.click();
      expect(mock.useValue.clearError).toHaveBeenCalledTimes(1);
    });

    it('não exibe banner de erro quando não há erro', async () => {
      const { fixture } = await setup();
      const banner = fixture.nativeElement.querySelector('.notif-config__erro');
      expect(banner).toBeNull();
    });
  });

  // ── NCP-4: sincronização do formulário com o store ──────────────────────────

  describe('NCP-4: sincronização do formulário', () => {
    it('sincroniza emailEnabled, recipients, webhookEnabled, webhookUrl e minSeverity quando config chega', async () => {
      const mock = makeStoreMock();
      const { fixture, comp } = await setup(mock);

      (mock.useValue.config as WritableSignal<NotificationConfig | null>).set(
        makeConfig({
          emailEnabled:    true,
          emailRecipients: ['a@b.com', 'c@d.com'],
          webhookEnabled:  true,
          webhookUrl:      'https://hooks.exemplo.com',
          minSeverity:     'HIGH',
        })
      );
      fixture.detectChanges();

      expect(comp.emailEnabled).toBe(true);
      expect(comp.emailRecipients).toEqual(['a@b.com', 'c@d.com']);
      expect(comp.webhookEnabled).toBe(true);
      expect(comp.webhookUrl).toBe('https://hooks.exemplo.com');
      expect(comp.webhookSecret).toBe('');  // nunca pré-popula o secret
      expect(comp.minSeverity).toBe('HIGH');
    });

    it('não sincroniza quando config é null', async () => {
      const mock = makeStoreMock();
      const { comp } = await setup(mock);

      comp.emailEnabled = true;
      comp.emailRecipients = ['x@y.com'];

      (mock.useValue.config as WritableSignal<NotificationConfig | null>).set(null);

      expect(comp.emailEnabled).toBe(true);
      expect(comp.emailRecipients).toEqual(['x@y.com']);
    });
  });

  // ── NCP-5: gerenciamento de destinatários ───────────────────────────────────

  describe('NCP-5: destinatários de e-mail', () => {
    it('adicionarDestinatario adiciona string vazia ao array', async () => {
      const { comp } = await setup();
      comp.emailRecipients = ['a@b.com'];
      comp.adicionarDestinatario();
      expect(comp.emailRecipients).toEqual(['a@b.com', '']);
    });

    it('removerDestinatario remove o email no índice correto', async () => {
      const { comp } = await setup();
      comp.emailRecipients = ['a@b.com', 'c@d.com', 'e@f.com'];
      comp.removerDestinatario(1);
      expect(comp.emailRecipients).toEqual(['a@b.com', 'e@f.com']);
    });

    it('removerDestinatario no índice 0 mantém os demais', async () => {
      const { comp } = await setup();
      comp.emailRecipients = ['a@b.com', 'c@d.com'];
      comp.removerDestinatario(0);
      expect(comp.emailRecipients).toEqual(['c@d.com']);
    });
  });

  // ── NCP-6: salvar ───────────────────────────────────────────────────────────

  describe('NCP-6: salvar', () => {
    it('chama store.saveConfig com patch correto (sem webhookSecret vazio)', async () => {
      const mock = makeStoreMock();
      const { comp } = await setup(mock);

      comp.emailEnabled    = true;
      comp.emailRecipients = ['a@b.com', '  ', 'c@d.com'];  // email em branco deve ser filtrado
      comp.webhookEnabled  = true;
      comp.webhookUrl      = 'https://hooks.exemplo.com ';    // trim
      comp.webhookSecret   = '';                               // não deve ser incluído
      comp.minSeverity     = 'HIGH';

      comp.salvar();

      expect(mock.useValue.saveConfig).toHaveBeenCalledWith({
        emailEnabled:    true,
        emailRecipients: ['a@b.com', 'c@d.com'],
        webhookEnabled:  true,
        webhookUrl:      'https://hooks.exemplo.com',
        minSeverity:     'HIGH',
      });
    });

    it('inclui webhookSecret no patch quando preenchido', async () => {
      const mock = makeStoreMock();
      const { comp } = await setup(mock);

      comp.webhookSecret = '  minhasecret123  ';
      comp.salvar();

      const call = (mock.useValue.saveConfig as jest.Mock).mock.calls[0][0];
      expect(call.webhookSecret).toBe('minhasecret123');
    });

    it('webhookUrl null quando campo vazio', async () => {
      const mock = makeStoreMock();
      const { comp } = await setup(mock);

      comp.webhookUrl = '   ';
      comp.salvar();

      const call = (mock.useValue.saveConfig as jest.Mock).mock.calls[0][0];
      expect(call.webhookUrl).toBeNull();
    });

    it('reseta savedOk antes de salvar', async () => {
      const mock = makeStoreMock();
      const { comp } = await setup(mock);

      comp.savedOk.set(true);
      comp.salvar();
      expect(comp.savedOk()).toBe(false);
    });
  });

  // ── NCP-7: acessibilidade ───────────────────────────────────────────────────

  describe('NCP-7: acessibilidade WCAG 2.1 AA', () => {
    it('painel sem config não tem violações de acessibilidade', async () => {
      const { fixture } = await setup();
      fixture.detectChanges();
      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });

    it('painel com config carregada não tem violações de acessibilidade', async () => {
      const mock = makeStoreMock();
      const { fixture } = await setup(mock);

      (mock.useValue.config as WritableSignal<NotificationConfig | null>).set(
        makeConfig({ emailEnabled: true, emailRecipients: ['a@b.com'] })
      );
      fixture.detectChanges();

      const results = await axe(fixture.nativeElement);
      expect(results).toHaveNoViolations();
    });
  });
});
