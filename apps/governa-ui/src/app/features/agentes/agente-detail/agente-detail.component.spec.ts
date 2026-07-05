// ============================================================
// agente-detail.component.spec.ts
//
// TDD — Given/When/Then
// Suites:
//   1. Loading (skeleton)
//   2. Erro genérico (banner + retry)
//   3. Não encontrado (404)
//   4. Exibição do conteúdo
//   5. Ação: pausar
//   6. Ação: ativar
//   7. Ação: ativar desabilitado sem política
//   8. Acessibilidade WCAG 2.1 AA (jest-axe)
// ============================================================

import { TestBed }          from '@angular/core/testing';
import { ActivatedRoute }   from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { axe, toHaveNoViolations }  from 'jest-axe';
import { AgenteDetailComponent }    from './agente-detail.component';
import { Agente }                   from '../../../shared/models/agente.model';
import { environment }              from '@env/environment';

expect.extend(toHaveNoViolations);

// ── Fixtures ──────────────────────────────────────────────────

const makeAgente = (overrides: Partial<Agente> = {}): Agente => ({
  id:           'ag-42',
  tenantId:     'tenant-tf',
  name:         'Agente Detalhado',
  description:  'Agente de teste para o detalhe',
  ownerId:      'user-1',
  policyId:     'policy-abc',
  status:       'ACTIVE',
  modelId:      'claude-sonnet-4-6',
  tools:        ['read_protheus_pedido', 'escalate_to_human'],
  createdAt:    '2026-05-01T10:00:00Z',
  updatedAt:    '2026-06-01T08:00:00Z',
  lastActiveAt: '2026-07-05T12:00:00Z',
  ...overrides,
});

const AGENT_URL   = `${environment.coreBaseUrl}/agents/ag-42`;
const PAUSE_URL   = `${environment.coreBaseUrl}/agents/ag-42/pause`;
const ACTIVATE_URL = `${environment.coreBaseUrl}/agents/ag-42/activate`;

function makeRoute(id = 'ag-42') {
  return {
    provide: ActivatedRoute,
    useValue: { snapshot: { paramMap: { get: () => id } } },
  };
}

async function setup(id = 'ag-42') {
  await TestBed.configureTestingModule({
    imports:   [AgenteDetailComponent, HttpClientTestingModule],
    providers: [makeRoute(id)],
  }).compileComponents();

  const fixture = TestBed.createComponent(AgenteDetailComponent);
  const ctrl    = TestBed.inject(HttpTestingController);
  return { fixture, ctrl };
}

// ── Suite 1: Loading ──────────────────────────────────────────

describe('AgenteDetailComponent — loading', () => {
  it('exibe skeletons enquanto a requisição está pendente', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.agente-detail__skeleton--header')).toBeTruthy();
    expect(el.querySelector('.agente-detail__skeleton--body')).toBeTruthy();
    expect(el.querySelector('.sr-only')?.textContent).toContain('Carregando agente');

    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente() });
    ctrl.verify();
  });

  it('oculta skeletons após resposta', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente() });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.agente-detail__skeleton--header')).toBeNull();
  });
});

// ── Suite 2: Erro genérico ────────────────────────────────────

describe('AgenteDetailComponent — erro genérico', () => {
  it('exibe mensagem do servidor quando a API retorna 500', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    ctrl.expectOne(AGENT_URL).flush(
      { message: 'Internal Server Error' },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Internal Server Error');
  });

  it('exibe mensagem padrão quando não há message no body', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    ctrl.expectOne(AGENT_URL).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Erro ao carregar agente');
  });

  it('recarrega ao clicar em "Tentar novamente"', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    ctrl.expectOne(AGENT_URL).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const btn: HTMLButtonElement = fixture.nativeElement.querySelector('.agente-detail__retry');
    btn.click();
    fixture.detectChanges();

    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente() });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('.agente-detail__nome')?.textContent).toContain('Agente Detalhado');
    ctrl.verify();
  });
});

// ── Suite 3: Não encontrado ───────────────────────────────────

describe('AgenteDetailComponent — 404', () => {
  it('exibe "Agente não encontrado" quando status 404', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    ctrl.expectOne(AGENT_URL).flush(
      { error: 'AGENT_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.agente-detail__not-found')).toBeTruthy();
    expect(el.textContent).toContain('Agente não encontrado');
  });

  it('não exibe banner de erro genérico para 404', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    ctrl.expectOne(AGENT_URL).flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.agente-detail__error')).toBeNull();
  });
});

// ── Suite 4: Exibição de conteúdo ────────────────────────────

describe('AgenteDetailComponent — conteúdo', () => {
  async function setupWithAgente(overrides: Partial<Agente> = {}) {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente(overrides) });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('exibe nome do agente no h1', async () => {
    const { el } = await setupWithAgente();
    expect(el.querySelector('.agente-detail__nome')?.textContent).toContain('Agente Detalhado');
  });

  it('exibe descrição', async () => {
    const { el } = await setupWithAgente();
    expect(el.querySelector('.agente-detail__descricao')?.textContent).toContain('Agente de teste para o detalhe');
  });

  it('exibe badge de status', async () => {
    const { el } = await setupWithAgente();
    expect(el.querySelector('.agente-detail__status')?.textContent).toContain('Ativo');
  });

  it('exibe modelId na seção de informações', async () => {
    const { el } = await setupWithAgente();
    expect(el.textContent).toContain('claude-sonnet-4-6');
  });

  it('exibe "Configurada" com link quando policyId presente', async () => {
    const { el } = await setupWithAgente({ policyId: 'policy-abc' });
    expect(el.querySelector('.agente-detail__policy-link')?.textContent).toContain('Configurada');
  });

  it('exibe "Sem política" em itálico quando policyId ausente', async () => {
    const { el } = await setupWithAgente({ policyId: null });
    expect(el.querySelector('.agente-detail__no-policy')?.textContent).toContain('Sem política');
  });

  it('exibe tools como tags', async () => {
    const { el } = await setupWithAgente();
    const tags = el.querySelectorAll('.agente-detail__tool-tag');
    expect(tags.length).toBe(2);
    expect(tags[0].textContent).toContain('read_protheus_pedido');
    expect(tags[1].textContent).toContain('escalate_to_human');
  });

  it('exibe "Nenhuma ferramenta" quando tools vazia', async () => {
    const { el } = await setupWithAgente({ tools: [] });
    expect(el.querySelector('.agente-detail__tools-empty')?.textContent).toContain('Nenhuma ferramenta');
  });

  it('não exibe link "← Agentes" dá push para /agentes', async () => {
    const { el } = await setupWithAgente();
    const backLink = el.querySelector('.agente-detail__back');
    expect(backLink).toBeTruthy();
    expect(backLink?.getAttribute('href') ?? backLink?.getAttribute('ng-reflect-router-link')).toBeTruthy();
  });
});

// ── Suite 5: Ação — pausar ────────────────────────────────────

describe('AgenteDetailComponent — pausar', () => {
  async function setupActive() {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente({ status: 'ACTIVE' }) });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, ctrl };
  }

  it('exibe botão "Pausar" para agente ACTIVE', async () => {
    const { el } = await setupActive();
    expect(el.querySelector('.agente-detail__btn--pausar')).toBeTruthy();
  });

  it('não exibe botão "Ativar" para agente ACTIVE', async () => {
    const { el } = await setupActive();
    expect(el.querySelector('.agente-detail__btn--ativar')).toBeNull();
  });

  it('chama POST /pause e atualiza status ao pausar', async () => {
    const { fixture, el, ctrl } = await setupActive();

    const btn: HTMLButtonElement = el.querySelector('.agente-detail__btn--pausar')!;
    btn.click();
    fixture.detectChanges();

    ctrl.expectOne(PAUSE_URL).flush({ data: makeAgente({ status: 'PAUSED' }) });
    fixture.detectChanges();

    expect(el.querySelector('.agente-detail__status')?.textContent).toContain('Pausado');
    ctrl.verify();
  });

  it('exibe erro quando POST /pause falha', async () => {
    const { fixture, el, ctrl } = await setupActive();

    el.querySelector<HTMLButtonElement>('.agente-detail__btn--pausar')!.click();
    fixture.detectChanges();

    ctrl.expectOne(PAUSE_URL).flush(
      { message: 'Transição inválida' },
      { status: 422, statusText: 'Unprocessable' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Transição inválida');
    ctrl.verify();
  });
});

// ── Suite 6: Ação — ativar ────────────────────────────────────

describe('AgenteDetailComponent — ativar', () => {
  async function setupPaused(policyId: string | null = 'policy-abc') {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente({ status: 'PAUSED', policyId }) });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, ctrl };
  }

  it('exibe botão "Ativar" para agente PAUSED com política', async () => {
    const { el } = await setupPaused();
    const btn = el.querySelector<HTMLButtonElement>('.agente-detail__btn--ativar')!;
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
  });

  it('chama POST /activate e atualiza status ao ativar', async () => {
    const { fixture, el, ctrl } = await setupPaused();

    el.querySelector<HTMLButtonElement>('.agente-detail__btn--ativar')!.click();
    fixture.detectChanges();

    ctrl.expectOne(ACTIVATE_URL).flush({ data: makeAgente({ status: 'ACTIVE' }) });
    fixture.detectChanges();

    expect(el.querySelector('.agente-detail__status')?.textContent).toContain('Ativo');
    ctrl.verify();
  });

  it('exibe erro quando POST /activate falha', async () => {
    const { fixture, el, ctrl } = await setupPaused();

    el.querySelector<HTMLButtonElement>('.agente-detail__btn--ativar')!.click();
    fixture.detectChanges();

    ctrl.expectOne(ACTIVATE_URL).flush(
      { message: 'Sem política configurada' },
      { status: 422, statusText: 'Unprocessable' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Sem política configurada');
    ctrl.verify();
  });
});

// ── Suite 7: Ativar desabilitado sem política ─────────────────

describe('AgenteDetailComponent — ativar sem política', () => {
  it('desabilita botão "Ativar" quando policyId é null', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente({ status: 'PAUSED', policyId: null }) });
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector<HTMLButtonElement>('.agente-detail__btn--ativar');
    expect(btn?.disabled).toBe(true);
  });

  it('não exibe ações para DEPRECATED', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente({ status: 'DEPRECATED' }) });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.agente-detail__acoes')).toBeNull();
  });
});

// ── Suite 8: Acessibilidade ───────────────────────────────────

describe('AgenteDetailComponent — acessibilidade', () => {
  it('não apresenta violações axe no estado de conteúdo', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();
    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente() });
    fixture.detectChanges();

    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });

  it('não apresenta violações axe no estado de loading', async () => {
    const { fixture, ctrl } = await setup();
    fixture.detectChanges();

    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();

    ctrl.expectOne(AGENT_URL).flush({ data: makeAgente() });
    ctrl.verify();
  });
});
