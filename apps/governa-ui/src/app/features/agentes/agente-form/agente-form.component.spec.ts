// ============================================================
// agente-form.component.spec.ts
//
// TDD — Given/When/Then
// Suites:
//   1. Renderização (campos presentes)
//   2. Validação (submit desabilitado sem nome)
//   3. Submit (chama store.createAgente com DTO correto)
//   4. Navegação (navega para /agentes ao createdAgent não-null)
//   5. Erro (exibe banner e limpa ao fechar)
//   6. Ferramentas (toggleTool adiciona/remove)
// ============================================================

import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AgenteFormComponent } from './agente-form.component';
import { AgentesStore } from '../agentes.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Agente } from '../../../shared/models/agente.model';
import { TEMPLATES, BLANK_TEMPLATE_ID, AgentTemplate } from './agente-templates.data';

const tplById = (id: string): AgentTemplate =>
  TEMPLATES.find((t) => t.id === id)!;

// ── Fixture ───────────────────────────────────────────────────

const makeAgente = (overrides: Partial<Agente> = {}): Agente => ({
  id:           'ag-novo',
  tenantId:     'tenant-tf',
  name:         'Agente Novo',
  description:  '',
  ownerId:      'user-uuid-1',
  policyId:     null,
  status:       'SANDBOX',
  modelId:      'claude-sonnet-4-6',
  tools:        [],
  createdAt:    '2026-07-05T10:00:00Z',
  updatedAt:    '2026-07-05T10:00:00Z',
  lastActiveAt: null,
  ...overrides,
});

// ── Mock da store ─────────────────────────────────────────────

function createStoreMock() {
  return {
    creating:      signal(false),
    createError:   signal<string | null>(null),
    createdAgent:  signal<Agente | null>(null),
    createAgente:  jest.fn(),
    clearCreateError: jest.fn(),
    clearCreatedAgent: jest.fn(),
  };
}

// ── Mock do AuthService ───────────────────────────────────────

function createAuthMock(userId: string | null = 'user-uuid-1') {
  return {
    userId: signal<string | null>(userId),
  };
}

// ── Setup ─────────────────────────────────────────────────────

function setup(
  storeMock: ReturnType<typeof createStoreMock>,
  authMock: ReturnType<typeof createAuthMock>,
): { fixture: ComponentFixture<AgenteFormComponent>; router: Router } {
  TestBed.configureTestingModule({
    imports: [AgenteFormComponent, RouterTestingModule],
    providers: [
      { provide: AgentesStore,  useValue: storeMock },
      { provide: AuthService,   useValue: authMock  },
    ],
  });

  const fixture = TestBed.createComponent(AgenteFormComponent);
  const router  = TestBed.inject(Router);
  fixture.detectChanges();
  return { fixture, router };
}

// ── Suite 1: Renderização ────────────────────────────────────

describe('AgenteFormComponent — renderização', () => {

  it('inicia no passo 1 (ponto de partida) exibindo a galeria de templates', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const el: HTMLElement = fixture.nativeElement;

    expect(fixture.componentInstance.step()).toBe(1);
    expect(el.querySelector('app-agente-starting-point')).not.toBeNull();
    expect(el.querySelector('[role="radiogroup"]')).not.toBeNull();
    // Formulário só aparece no passo 2
    expect(el.innerHTML).not.toContain('Nome do agente');
  });

  it('exibe campo de nome no passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.innerHTML).toContain('Nome do agente');
  });

  it('exibe campo de descrição no passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.innerHTML).toContain('Descrição');
  });

  it('exibe select de modelo de IA no passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.innerHTML).toContain('Modelo de IA');
  });

  it('exibe textarea de System Prompt e fieldset de Skills no passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('#af-system-prompt')).not.toBeNull();
    expect(el.innerHTML).toContain('Skills');
  });

  it('exibe painel de preview no passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('app-agente-config-preview')).not.toBeNull();
  });

  it('exibe checkboxes de ferramentas no passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    fixture.componentInstance.step.set(2);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    const checkboxes = el.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('exibe link de voltar para /agentes', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const el: HTMLElement = fixture.nativeElement;

    const backLink = el.querySelector('[routerlink="/agentes"], a[href="/agentes"]');
    expect(backLink).not.toBeNull();
  });

});

// ── Suite 2: Validação ───────────────────────────────────────

describe('AgenteFormComponent — validação', () => {

  it('isFormValid retorna false quando nome está vazio', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName = '';
    expect(comp.isFormValid()).toBe(false);
  });

  it('isFormValid retorna true quando nome e modelId estão preenchidos', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName    = 'Agente Teste';
    comp.formModelId = 'claude-sonnet-4-6';
    expect(comp.isFormValid()).toBe(true);
  });

  it('policyIdError retorna mensagem quando UUID inválido', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formPolicyId = 'nao-e-uuid';
    expect(comp.policyIdError).toBeTruthy();
  });

  it('policyIdError retorna undefined quando policyId é vazio', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formPolicyId = '';
    expect(comp.policyIdError).toBeUndefined();
  });

  it('policyIdError retorna undefined para UUID válido', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formPolicyId = '550e8400-e29b-41d4-a716-446655440000';
    expect(comp.policyIdError).toBeUndefined();
  });

});

// ── Suite 3: Submit ──────────────────────────────────────────

describe('AgenteFormComponent — submit', () => {

  it('onSubmit chama store.createAgente com DTO correto', () => {
    const store = createStoreMock();
    const auth  = createAuthMock('user-uuid-1');
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName    = 'Agente Teste';
    comp.formModelId = 'claude-haiku-4-5-20251001';
    comp.formTools   = ['read_protheus_pedido'];

    comp.onSubmit();

    expect(store.createAgente).toHaveBeenCalledWith({
      name:    'Agente Teste',
      ownerId: 'user-uuid-1',
      modelId: 'claude-haiku-4-5-20251001',
      tools:   ['read_protheus_pedido'],
    });
  });

  it('onSubmit inclui description quando preenchida', () => {
    const store = createStoreMock();
    const auth  = createAuthMock('user-uuid-1');
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName        = 'Agente Teste';
    comp.formDescription = 'Descrição do agente';
    comp.formModelId     = 'claude-sonnet-4-6';

    comp.onSubmit();

    expect(store.createAgente).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Descrição do agente' }),
    );
  });

  it('onSubmit inclui policyId quando UUID válido fornecido', () => {
    const store = createStoreMock();
    const auth  = createAuthMock('user-uuid-1');
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName     = 'Agente Teste';
    comp.formModelId  = 'claude-sonnet-4-6';
    comp.formPolicyId = '550e8400-e29b-41d4-a716-446655440000';

    comp.onSubmit();

    expect(store.createAgente).toHaveBeenCalledWith(
      expect.objectContaining({ policyId: '550e8400-e29b-41d4-a716-446655440000' }),
    );
  });

  it('onSubmit não chama store quando nome está vazio', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName = '';
    comp.onSubmit();

    expect(store.createAgente).not.toHaveBeenCalled();
  });

  it('onSubmit não chama store quando policyId é UUID inválido', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName     = 'Agente Teste';
    comp.formModelId  = 'claude-sonnet-4-6';
    comp.formPolicyId = 'nao-e-uuid';
    comp.onSubmit();

    expect(store.createAgente).not.toHaveBeenCalled();
  });

});

// ── Suite 4: Navegação ───────────────────────────────────────

describe('AgenteFormComponent — navegação', () => {

  it('clearCreateError é chamado no ngOnInit', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    setup(store, auth);

    expect(store.clearCreateError).toHaveBeenCalled();
  });

  it('navega para /agentes e chama clearCreatedAgent quando createdAgent é definido', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture, router } = setup(store, auth);
    const navigateSpy = jest.spyOn(router, 'navigate');

    store.createdAgent.set(makeAgente());
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith(['/agentes']);
    expect(store.clearCreatedAgent).toHaveBeenCalled();
  });

});

// ── Suite 5: Erro ────────────────────────────────────────────

describe('AgenteFormComponent — erro', () => {

  it('exibe banner de erro quando createError está definido', () => {
    const store = createStoreMock();
    store.createError = signal<string | null>('Erro ao criar agente.');
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain('Erro ao criar agente.');
  });

  it('não exibe banner de erro quando createError é null', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

});

// ── Suite 6: Ferramentas ─────────────────────────────────────

describe('AgenteFormComponent — ferramentas', () => {

  it('toggleTool adiciona ferramenta quando não selecionada', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formTools = [];
    comp.toggleTool('read_protheus_pedido');

    expect(comp.formTools).toContain('read_protheus_pedido');
  });

  it('toggleTool remove ferramenta quando já selecionada', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formTools = ['read_protheus_pedido'];
    comp.toggleTool('read_protheus_pedido');

    expect(comp.formTools).not.toContain('read_protheus_pedido');
  });

  it('isToolSelected retorna true para ferramenta na lista', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formTools = ['read_protheus_cliente'];
    expect(comp.isToolSelected('read_protheus_cliente')).toBe(true);
    expect(comp.isToolSelected('read_protheus_pedido')).toBe(false);
  });

});

// ── Suite 7: Skills ──────────────────────────────────────────

describe('AgenteFormComponent — skills', () => {

  it('toggleSkill adiciona e remove skill', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formSkills = [];
    comp.toggleSkill('resumo-executivo');
    expect(comp.isSkillSelected('resumo-executivo')).toBe(true);

    comp.toggleSkill('resumo-executivo');
    expect(comp.isSkillSelected('resumo-executivo')).toBe(false);
  });

});

// ── Suite 8: Seleção de template (Gherkin cenário 1) ─────────

describe('AgenteFormComponent — seleção de template', () => {

  it('selecionar um template preenche o formulário e avança para o passo 2', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.selectTemplate(tplById('consulta-pedidos'));

    expect(comp.step()).toBe(2);
    expect(comp.selectedTemplateId).toBe('consulta-pedidos');
    expect(comp.isToolSelected('read_protheus_pedido')).toBe(true);
    expect(comp.formSystemPrompt).toContain('consulta pedidos no Protheus');
    // preview reflete o template
    expect(comp.previewYaml()).toContain('read_protheus_pedido');
    expect(comp.previewConfig().mcpServers.length).toBeGreaterThan(0);
  });

  it('selecionar "Agente em branco" mantém templateId null no submit', () => {
    const store = createStoreMock();
    const auth  = createAuthMock('user-uuid-1');
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.selectTemplate(tplById(BLANK_TEMPLATE_ID));
    comp.formName = 'Meu Agente';
    comp.onSubmit();

    const dto = store.createAgente.mock.calls[0][0];
    expect(dto.templateId).toBeUndefined();
  });

  it('selectedTemplateName retorna o nome amigável do template, não o id', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.selectTemplate(tplById('consulta-pedidos'));

    expect(comp.selectedTemplateName()).toBe('Consulta de Pedidos');
    expect(comp.selectedTemplateName()).not.toBe('consulta-pedidos');
  });

  it('selectedTemplateName retorna "Agente em branco" para o template em branco', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.selectTemplate(tplById(BLANK_TEMPLATE_ID));

    expect(comp.selectedTemplateName()).toBe('Agente em branco');
  });

  it('selectedTemplateName retorna null antes de qualquer seleção', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    expect(comp.selectedTemplateName()).toBeNull();
  });

});

// ── Suite 9: Merge de template (Gherkin cenário 2) ───────────

describe('AgenteFormComponent — troca de template preserva edição manual', () => {

  it('mantém o nome editado manualmente e aplica ferramentas do novo template', () => {
    const store = createStoreMock();
    const auth  = createAuthMock();
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    // 1. Seleciona "Consulta de Pedidos"
    comp.selectTemplate(tplById('consulta-pedidos'));
    // 2. Edita manualmente o nome
    comp.formName = 'Meu Agente Custom';
    // 3. Volta e seleciona "Atendimento ao Cliente"
    comp.backToStartingPoint();
    comp.selectTemplate(tplById('atendimento-cliente'));

    // Nome preservado (edição manual)
    expect(comp.formName).toBe('Meu Agente Custom');
    // Ferramentas refletem o novo template
    expect(comp.isToolSelected('read_protheus_cliente')).toBe(true);
    expect(comp.isToolSelected('read_politica_atendimento')).toBe(true);
    expect(comp.isToolSelected('read_protheus_pedido')).toBe(false);
  });

});

// ── Suite 10: Submit com novos campos (Gherkin cenário 4) ────

describe('AgenteFormComponent — submit com campos estendidos', () => {

  it('POST inclui systemPrompt, mcpServers e templateId ao usar template', () => {
    const store = createStoreMock();
    const auth  = createAuthMock('user-uuid-1');
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.selectTemplate(tplById('triagem-nf'));
    comp.onSubmit();

    const dto = store.createAgente.mock.calls[0][0];
    expect(dto.systemPrompt).toContain('notas fiscais');
    expect(dto.templateId).toBe('triagem-nf');
    expect(dto.mcpServers).toEqual([
      expect.objectContaining({ id: 'protheus-rest', name: 'Protheus REST' }),
    ]);
    expect(dto.tools).toContain('read_protheus_nf');
  });

  it('inclui skills quando selecionadas', () => {
    const store = createStoreMock();
    const auth  = createAuthMock('user-uuid-1');
    const { fixture } = setup(store, auth);
    const comp = fixture.componentInstance;

    comp.formName = 'Agente X';
    comp.formModelId = 'claude-sonnet-5';
    comp.toggleSkill('resumo-executivo');
    comp.onSubmit();

    const dto = store.createAgente.mock.calls[0][0];
    expect(dto.skills).toEqual(['resumo-executivo']);
  });

});
