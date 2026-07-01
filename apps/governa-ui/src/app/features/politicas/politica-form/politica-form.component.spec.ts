// ============================================================
// politica-form.component.spec.ts
//
// TDD — Given/When/Then  (13 testes)
// ============================================================

import { TestBed }         from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { axe, toHaveNoViolations }   from 'jest-axe';
import { PoliticaFormComponent }     from './politica-form.component';
import { PoliticasStore }            from '../politicas.service';
import { HttpClientTestingModule }   from '@angular/common/http/testing';

expect.extend(toHaveNoViolations);

const POLITICA_STUB = {
  id:             'policy-1',
  tenantId:       'tenant-a',
  name:           'Atendimento Consultivo',
  autonomyLevel:  'CONSULTIVO' as const,
  allowedActions: ['read_protheus_pedido', 'read_protheus_cliente'],
  approvers:      [],
  version:        '1.0.0',
};

function makeActivatedRoute(id = 'policy-1') {
  return {
    provide: ActivatedRoute,
    useValue: {
      snapshot: { paramMap: { get: () => id } },
    },
  };
}

function makeStoreMock(overrides: Record<string, unknown> = {}) {
  return {
    provide: PoliticasStore,
    useValue: {
      politica:      () => POLITICA_STUB,
      loading:       () => false,
      saving:        () => false,
      error:         () => null,
      saveSuccess:   () => false,
      hasError:      () => false,
      isLoaded:      () => true,
      nivelAtual:    () => 'CONSULTIVO',
      loadPolitica:  jest.fn(),
      savePolitica:  jest.fn(),
      clearError:    jest.fn(),
      clearSaveSuccess: jest.fn(),
      ...overrides,
    },
  };
}

async function setup(storeOverrides: Record<string, unknown> = {}, routeId = 'policy-1') {
  await TestBed.configureTestingModule({
    imports:   [PoliticaFormComponent, HttpClientTestingModule],
    providers: [makeActivatedRoute(routeId), makeStoreMock(storeOverrides)],
  }).compileComponents();

  const fixture = TestBed.createComponent(PoliticaFormComponent);
  const store   = TestBed.inject(PoliticasStore) as unknown as ReturnType<typeof makeStoreMock>['useValue'];
  fixture.detectChanges();
  return { fixture, store };
}

describe('PoliticaFormComponent — renderização', () => {
  it('exibe o título da seção', async () => {
    const { fixture } = await setup();
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1.textContent).toContain('Configurar Política de Autonomia');
  });

  it('exibe versão atual da política no cabeçalho', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.textContent).toContain('1.0.0');
  });

  it('renderiza os 3 cards de nível de autonomia', async () => {
    const { fixture } = await setup();
    const cards = fixture.nativeElement.querySelectorAll('.pf__nivel-card');
    expect(cards).toHaveLength(3);
  });

  it('card CONSULTIVO está selecionado por padrão (política stub)', async () => {
    const { fixture } = await setup();
    const cards = fixture.nativeElement.querySelectorAll('.pf__nivel-card');
    const consultivo = Array.from(cards).find((c: Element) =>
      c.textContent?.includes('Somente Consulta'),
    ) as HTMLElement;
    expect(consultivo.getAttribute('aria-checked')).toBe('true');
    expect(consultivo.classList).toContain('pf__nivel-card--selecionado');
  });

  it('exibe tags de allowed actions como legíveis', async () => {
    const { fixture } = await setup();
    const tags = fixture.nativeElement.querySelectorAll('.pf__action-tag');
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].textContent).toContain('Consultar pedido');
  });

  it('oculta seção de limites operacionais quando nível é CONSULTIVO', async () => {
    const { fixture } = await setup();
    const limites = fixture.nativeElement.querySelector('#pf-valor-max');
    expect(limites).toBeNull();
  });
});

describe('PoliticaFormComponent — estados especiais', () => {
  it('exibe skeletons durante loading', async () => {
    const { fixture } = await setup({ loading: () => true, isLoaded: () => false });
    fixture.detectChanges();
    const skeletons = fixture.nativeElement.querySelectorAll('.pf__skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('exibe banner de erro com role=alert quando há erro de carga', async () => {
    const { fixture } = await setup({
      hasError: () => true,
      error:    () => 'Política não encontrada',
      loading:  () => false,
      saving:   () => false,
      isLoaded: () => false,
    });
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Política não encontrada');
  });

  it('exibe banner de sucesso com role=status após save', async () => {
    const { fixture } = await setup({ saveSuccess: () => true });
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status?.textContent).toContain('atualizada com sucesso');
  });

  it('exibe campos de aprovadores apenas no nível ASSISTIDO', async () => {
    const { fixture } = await setup({
      politica: () => ({ ...POLITICA_STUB, autonomyLevel: 'ASSISTIDO' }),
      nivelAtual: () => 'ASSISTIDO',
    });
    const component = fixture.componentInstance;
    component.formNivel = 'ASSISTIDO';
    fixture.detectChanges();
    const addBtn = fixture.nativeElement.querySelector('.pf__approvers-list ~ gov-button button');
    expect(addBtn).not.toBeNull();
  });

  it('botão salvar fica desabilitado durante saving', async () => {
    const { fixture } = await setup({ saving: () => true });
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.pf__footer gov-button button') as HTMLButtonElement;
    expect(btn?.disabled).toBe(true);
  });
});

describe('PoliticaFormComponent — ações do formulário', () => {
  it('selecionarNivel(AUTONOMO) atualiza formNivel e limpa aprovadores', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance;
    comp.formApprovers = ['user@test.com'];
    comp.selecionarNivel('AUTONOMO');
    expect(comp.formNivel).toBe('AUTONOMO');
    expect(comp.formApprovers).toEqual([]);
  });

  it('selecionarNivel(CONSULTIVO) limpa maxValue e timeWindow', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance;
    comp.formMaxValue   = 1000;
    comp.formTimeWindow = 24;
    comp.selecionarNivel('CONSULTIVO');
    expect(comp.formMaxValue).toBeNull();
    expect(comp.formTimeWindow).toBeNull();
  });

  it('adicionarAprovador() adiciona entrada vazia ao array', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance;
    const antes = comp.formApprovers.length;
    comp.adicionarAprovador();
    expect(comp.formApprovers.length).toBe(antes + 1);
    expect(comp.formApprovers[comp.formApprovers.length - 1]).toBe('');
  });

  it('removerAprovador(0) remove o primeiro aprovador', async () => {
    const { fixture } = await setup();
    const comp = fixture.componentInstance;
    comp.formApprovers = ['a@test.com', 'b@test.com'];
    comp.removerAprovador(0);
    expect(comp.formApprovers).toEqual(['b@test.com']);
  });

  it('retry() chama clearError e loadPolitica quando há policyId', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;
    comp.retry();
    expect(store.clearError).toHaveBeenCalled();
    expect(store.loadPolitica).toHaveBeenCalledWith('policy-1');
  });

  it('onSubmit() não salva quando formNome está vazio', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;
    comp.formNome = '';
    comp.onSubmit();
    expect(store.savePolitica).not.toHaveBeenCalled();
  });

  it('onSubmit() chama savePolitica com dados corretos', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;
    comp.formNome  = 'Política Teste';
    comp.formNivel = 'CONSULTIVO';
    comp.onSubmit();
    expect(store.savePolitica).toHaveBeenCalledWith('policy-1', expect.objectContaining({
      name:          'Política Teste',
      autonomyLevel: 'CONSULTIVO',
    }));
  });

  it('onSubmit() com nível ASSISTIDO inclui maxValueBrl e timeWindowH no dto', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;
    comp.formNome       = 'Política ASSISTIDO';
    comp.formNivel      = 'ASSISTIDO';
    comp.formMaxValue   = 5000;
    comp.formTimeWindow = 48;
    comp.onSubmit();
    expect(store.savePolitica).toHaveBeenCalledWith('policy-1', expect.objectContaining({
      autonomyLevel: 'ASSISTIDO',
      maxValueBrl:   5000,
      timeWindowH:   48,
    }));
  });

  it('onSubmit() filtra aprovadores vazios do array antes de salvar', async () => {
    const { fixture, store } = await setup();
    const comp = fixture.componentInstance;
    comp.formNome      = 'Política Filtro';
    comp.formNivel     = 'CONSULTIVO';
    comp.formApprovers = ['user@test.com', '', '  '];
    comp.onSubmit();
    const savedDto = (store.savePolitica as jest.Mock).mock.calls[0][1];
    expect(savedDto.approvers).toEqual(['user@test.com']);
  });
});

describe('PoliticaFormComponent — acessibilidade WCAG 2.1 AA', () => {
  it('cards de nível têm role=radio e aria-checked', async () => {
    const { fixture } = await setup();
    const cards = fixture.nativeElement.querySelectorAll('[role="radio"]');
    expect(cards.length).toBe(3);
    cards.forEach((card: Element) => {
      expect(card.hasAttribute('aria-checked')).toBe(true);
      expect(card.hasAttribute('aria-label')).toBe(true);
    });
  });

  it('não tem violações axe no estado padrão (WCAG 2.1 AA)', async () => {
    const { fixture } = await setup();
    const results = await axe(fixture.nativeElement);
    expect(results).toHaveNoViolations();
  });
});
