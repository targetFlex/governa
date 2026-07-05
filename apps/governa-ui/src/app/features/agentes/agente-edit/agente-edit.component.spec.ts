// ============================================================
// agente-edit.component.spec.ts
//
// TDD — Given/When/Then
// Suites:
//   1. Loading (skeleton enquanto carrega agente)
//   2. Erro de carregamento (banner + retry)
//   3. Não encontrado (404)
//   4. Pré-preenchimento (campos populados com dados do agente)
//   5. Validação (submit desabilitado sem nome válido)
//   6. Submit (chama store.updateAgente com DTO correto)
//   7. Navegação (navega para /agentes/:id ao updatedAgent não-null)
//   8. Erro de atualização (exibe banner e limpa ao fechar)
//   9. Ferramentas (toggleTool adiciona/remove)
// ============================================================

import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { signal }                from '@angular/core';
import { Router }                from '@angular/router';
import { ActivatedRoute }        from '@angular/router';
import { RouterTestingModule }   from '@angular/router/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AgenteEditComponent }   from './agente-edit.component';
import { AgentesStore }          from '../agentes.service';
import { Agente }                from '../../../shared/models/agente.model';
import { environment }           from '@env/environment';

// ── Fixtures ───────────────────────────────────────────────────

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const makeAgente = (overrides: Partial<Agente> = {}): Agente => ({
  id:           'ag-edit',
  tenantId:     'tenant-tf',
  name:         'Agente Existente',
  description:  'Descrição original',
  ownerId:      'user-uuid-1',
  policyId:     VALID_UUID,
  status:       'SANDBOX',
  modelId:      'claude-sonnet-4-6',
  tools:        ['read_protheus_pedido', 'read_protheus_cliente'],
  createdAt:    '2026-07-05T10:00:00Z',
  updatedAt:    '2026-07-05T10:00:00Z',
  lastActiveAt: null,
  ...overrides,
});

const AGENT_URL = `${environment.coreBaseUrl}/agents/ag-edit`;

// ── Mock da store ─────────────────────────────────────────────

function createStoreMock() {
  return {
    updating:         signal(false),
    updateError:      signal<string | null>(null),
    updatedAgent:     signal<Agente | null>(null),
    updateAgente:     jest.fn(),
    clearUpdateError: jest.fn(),
    clearUpdatedAgent: jest.fn(),
  };
}

function makeRoute(id = 'ag-edit') {
  return {
    provide: ActivatedRoute,
    useValue: {
      snapshot: { paramMap: { get: (_: string) => id } },
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────

function setup(
  storeMock: ReturnType<typeof createStoreMock>,
  id = 'ag-edit',
): {
  fixture: ComponentFixture<AgenteEditComponent>;
  router:  Router;
  http:    HttpTestingController;
} {
  TestBed.configureTestingModule({
    imports:   [AgenteEditComponent, RouterTestingModule, HttpClientTestingModule],
    providers: [
      { provide: AgentesStore, useValue: storeMock },
      makeRoute(id),
    ],
  });

  const fixture = TestBed.createComponent(AgenteEditComponent);
  const router  = TestBed.inject(Router);
  const http    = TestBed.inject(HttpTestingController);

  return { fixture, router, http };
}

// ── Suites ────────────────────────────────────────────────────

describe('AgenteEditComponent', () => {

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  // ── Suite 1: Loading ──────────────────────────────────────

  describe('Suite 1 — Loading', () => {
    it('deve exibir skeleton enquanto carrega agente', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ae__loading')).toBeTruthy();
      expect(el.querySelector('.ae__form')).toBeFalsy();

      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();

      expect(el.querySelector('.ae__loading')).toBeFalsy();
      expect(el.querySelector('.ae__form')).toBeTruthy();
    });

    it('deve ocultar skeleton após resposta bem-sucedida', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[role="status"]')).toBeFalsy();
    });
  });

  // ── Suite 2: Erro de carregamento ─────────────────────────

  describe('Suite 2 — Erro de carregamento', () => {
    it('deve exibir banner de erro genérico ao falhar', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush('', { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[role="alert"]')).toBeTruthy();
      expect(el.querySelector('.ae__form')).toBeFalsy();
    });

    it('deve exibir mensagem do backend ao falhar', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush(
        { message: 'Agente inativo no backend' },
        { status: 500, statusText: 'Server Error' },
      );
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Agente inativo no backend');
    });

    it('deve tentar recarregar ao clicar em "Tentar novamente"', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush('', { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();

      const retryBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ae__retry-btn');
      retryBtn.click();
      fixture.detectChanges();

      // Deve ter feito uma segunda requisição
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.ae__form')).toBeTruthy();
    });
  });

  // ── Suite 3: Não encontrado ───────────────────────────────

  describe('Suite 3 — Não encontrado', () => {
    it('deve exibir mensagem de não encontrado ao receber 404', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush(
        { message: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ae__not-found')).toBeTruthy();
      expect(el.querySelector('.ae__form')).toBeFalsy();
    });
  });

  // ── Suite 4: Pré-preenchimento ────────────────────────────

  describe('Suite 4 — Pré-preenchimento', () => {
    it('deve pré-preencher nome com o nome do agente carregado', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente({ name: 'Agente Editado' }) });
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      expect(comp.formName).toBe('Agente Editado');
    });

    it('deve pré-preencher descrição com a descrição do agente carregado', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente({ description: 'Desc original' }) });
      fixture.detectChanges();

      expect(fixture.componentInstance.formDescription).toBe('Desc original');
    });

    it('deve pré-preencher modelId com o modelo do agente carregado', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente({ modelId: 'gpt-4o' }) });
      fixture.detectChanges();

      expect(fixture.componentInstance.formModelId).toBe('gpt-4o');
    });

    it('deve pré-preencher tools com as ferramentas do agente carregado', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      const agente = makeAgente({ tools: ['read_protheus_pedido', 'read_protheus_nf'] });
      http.expectOne(AGENT_URL).flush({ data: agente });
      fixture.detectChanges();

      const comp = fixture.componentInstance;
      expect(comp.formTools).toContain('read_protheus_pedido');
      expect(comp.formTools).toContain('read_protheus_nf');
    });

    it('deve pré-preencher policyId com a política do agente carregado', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente({ policyId: VALID_UUID }) });
      fixture.detectChanges();

      expect(fixture.componentInstance.formPolicyId).toBe(VALID_UUID);
    });

    it('deve pré-preencher policyId como string vazia quando policyId é null', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente({ policyId: null }) });
      fixture.detectChanges();

      expect(fixture.componentInstance.formPolicyId).toBe('');
    });
  });

  // ── Suite 5: Validação ────────────────────────────────────

  describe('Suite 5 — Validação', () => {
    function loadAndDetect(fixture: ComponentFixture<AgenteEditComponent>, http: HttpTestingController) {
      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();
    }

    it('deve retornar isFormValid=true quando form está pré-preenchido', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      expect(fixture.componentInstance.isFormValid()).toBe(true);
    });

    it('deve retornar isFormValid=false quando nome está vazio', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formName = '';
      expect(fixture.componentInstance.isFormValid()).toBe(false);
    });

    it('deve retornar isFormValid=false quando nome excede 120 chars', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formName = 'a'.repeat(121);
      expect(fixture.componentInstance.isFormValid()).toBe(false);
    });

    it('deve exibir erro de policyId quando UUID é inválido', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formPolicyId = 'nao-e-um-uuid';
      expect(fixture.componentInstance.policyIdError).toBe('Formato UUID inválido.');
    });

    it('deve aceitar policyId vazio (sem vínculo de política)', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formPolicyId = '';
      expect(fixture.componentInstance.policyIdError).toBeUndefined();
      expect(fixture.componentInstance.isFormValid()).toBe(true);
    });
  });

  // ── Suite 6: Submit ───────────────────────────────────────

  describe('Suite 6 — Submit', () => {
    function loadAndDetect(fixture: ComponentFixture<AgenteEditComponent>, http: HttpTestingController) {
      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();
    }

    it('deve chamar store.updateAgente com DTO correto ao submeter', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      const comp = fixture.componentInstance;
      comp.formName        = 'Agente Atualizado';
      comp.formDescription = 'Nova descrição';
      comp.formModelId     = 'gpt-4o';
      comp.formTools       = ['read_protheus_pedido'];
      comp.formPolicyId    = VALID_UUID;

      comp.onSubmit();

      expect(storeMock.updateAgente).toHaveBeenCalledWith('ag-edit', {
        name:        'Agente Atualizado',
        description: 'Nova descrição',
        modelId:     'gpt-4o',
        tools:       ['read_protheus_pedido'],
        policyId:    VALID_UUID,
      });
    });

    it('deve enviar policyId=null quando policyId está vazio', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formPolicyId = '';
      fixture.componentInstance.onSubmit();

      expect(storeMock.updateAgente).toHaveBeenCalledWith(
        'ag-edit',
        expect.objectContaining({ policyId: null }),
      );
    });

    it('não deve enviar description no DTO quando está vazio', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formDescription = '';
      fixture.componentInstance.onSubmit();

      const dto = (storeMock.updateAgente as jest.Mock).mock.calls[0][1];
      expect(dto.description).toBeUndefined();
    });

    it('não deve chamar store.updateAgente quando form é inválido', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      fixture.componentInstance.formName = '';
      fixture.componentInstance.onSubmit();

      expect(storeMock.updateAgente).not.toHaveBeenCalled();
    });
  });

  // ── Suite 7: Navegação ────────────────────────────────────

  describe('Suite 7 — Navegação', () => {
    it('deve navegar para /agentes/:id quando updatedAgent é setado', fakeAsync(() => {
      const storeMock = createStoreMock();
      const { fixture, http, router } = setup(storeMock);
      const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();

      storeMock.updatedAgent.set(makeAgente());
      fixture.detectChanges();
      tick();

      expect(navigateSpy).toHaveBeenCalledWith(['/agentes', 'ag-edit']);
    }));
  });

  // ── Suite 8: Erro de atualização ──────────────────────────

  describe('Suite 8 — Erro de atualização', () => {
    function loadAndDetect(fixture: ComponentFixture<AgenteEditComponent>, http: HttpTestingController) {
      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();
    }

    it('deve exibir banner de erro de atualização quando updateError é setado', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      storeMock.updateError.set('Erro de atualização no servidor');
      fixture.detectChanges();

      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[role="alert"]')).toBeTruthy();
      expect(el.textContent).toContain('Erro de atualização no servidor');
    });

    it('deve chamar store.clearUpdateError ao fechar banner de erro', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      storeMock.updateError.set('Erro qualquer');
      fixture.detectChanges();

      const dismissBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.ae__dismiss-btn');
      dismissBtn.click();

      expect(storeMock.clearUpdateError).toHaveBeenCalled();
    });
  });

  // ── Suite 9: Ferramentas ──────────────────────────────────

  describe('Suite 9 — Ferramentas', () => {
    function loadAndDetect(fixture: ComponentFixture<AgenteEditComponent>, http: HttpTestingController) {
      fixture.detectChanges();
      http.expectOne(AGENT_URL).flush({ data: makeAgente() });
      fixture.detectChanges();
    }

    it('toggleTool deve adicionar ferramenta não selecionada', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      const comp = fixture.componentInstance;
      comp.formTools = [];
      comp.toggleTool('read_protheus_nf');

      expect(comp.formTools).toContain('read_protheus_nf');
    });

    it('toggleTool deve remover ferramenta já selecionada', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      const comp = fixture.componentInstance;
      comp.formTools = ['read_protheus_pedido'];
      comp.toggleTool('read_protheus_pedido');

      expect(comp.formTools).not.toContain('read_protheus_pedido');
    });

    it('isToolSelected deve retornar true para ferramenta pré-selecionada', () => {
      const storeMock = createStoreMock();
      const { fixture, http } = setup(storeMock);
      loadAndDetect(fixture, http);

      const comp = fixture.componentInstance;
      expect(comp.isToolSelected('read_protheus_pedido')).toBe(true);
      expect(comp.isToolSelected('read_protheus_nf')).toBeFalsy();
    });
  });
});
