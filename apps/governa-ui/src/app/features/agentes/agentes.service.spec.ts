// ============================================================
// agentes.service.spec.ts
//
// Testa AgentesService + AgentesStore.
// Cobertura de:
//   - Estado inicial
//   - loadAgentes (sucesso, erro, loading flag)
//   - pauseAgente (sucesso, erro, acoesEmAndamento)
//   - activateAgente (sucesso, erro, acoesEmAndamento)
//   - setFiltroStatus + computed agentesFiltrados
//   - computed contagemPorStatus
//   - clearError
// ============================================================

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AgentesService, AgentesStore } from './agentes.service';
import { Agente, AgentesResponse, CreateAgenteDto } from '../../shared/models/agente.model';
import { environment } from '@env/environment';

// ── Fixtures ─────────────────────────────────────────────────

const makeAgente = (overrides: Partial<Agente> = {}): Agente => ({
  id:           'ag-1',
  tenantId:     'tenant-tf',
  name:         'Agente Alpha',
  description:  'Agente de teste',
  ownerId:      'user-1',
  policyId:     'policy-1',
  status:       'ACTIVE',
  modelId:      'claude-sonnet-4',
  tools:        ['read_protheus_pedido'],
  createdAt:    '2026-05-01T10:00:00Z',
  updatedAt:    '2026-06-01T08:00:00Z',
  lastActiveAt: '2026-06-13T14:00:00Z',
  ...overrides,
});

const agenteActive    = makeAgente({ id: 'ag-1', status: 'ACTIVE'     });
const agentePaused    = makeAgente({ id: 'ag-2', status: 'PAUSED'     });
const agenteSandbox   = makeAgente({ id: 'ag-3', status: 'SANDBOX'    });
const agenteDeprec    = makeAgente({ id: 'ag-4', status: 'DEPRECATED' });

const mockResponse: AgentesResponse = {
  data:  [agenteActive, agentePaused, agenteSandbox, agenteDeprec],
  total: 4,
};

const AGENTS_URL = `${environment.coreBaseUrl}/agents`;

// ── Suite ─────────────────────────────────────────────────────

describe('AgentesService', () => {
  let service:  AgentesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports:   [HttpClientTestingModule],
      providers: [AgentesService, AgentesStore],
    });

    service  = TestBed.inject(AgentesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ── Estado inicial ──────────────────────────────────────────

  it('deve iniciar com estado vazio', () => {
    expect(service.agentes()).toEqual([]);
    expect(service.total()).toBe(0);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.filtroStatus()).toBe('TODOS');
    expect(service.acoesEmAndamento()).toEqual([]);
    expect(service.lastRefreshed()).toBeNull();
  });

  it('isEmpty deve ser true no estado inicial', () => {
    expect(service.isEmpty()).toBe(true);
  });

  it('hasError deve ser false no estado inicial', () => {
    expect(service.hasError()).toBe(false);
  });

  it('agentesFiltrados deve retornar lista vazia no estado inicial', () => {
    expect(service.agentesFiltrados()).toEqual([]);
  });

  it('contagemPorStatus deve retornar zeros no estado inicial', () => {
    const c = service.contagemPorStatus();
    expect(c.TODOS).toBe(0);
    expect(c.ACTIVE).toBe(0);
    expect(c.PAUSED).toBe(0);
    expect(c.SANDBOX).toBe(0);
    expect(c.DEPRECATED).toBe(0);
  });

  // ── loadAgentes — sucesso ───────────────────────────────────

  it('deve emitir loading=true antes da resposta', () => {
    service.loadAgentes();
    expect(service.loading()).toBe(true);
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);
  });

  it('deve popular agentes e total após resposta 200', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    expect(service.agentes()).toHaveLength(4);
    expect(service.total()).toBe(4);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('deve definir lastRefreshed após carga bem-sucedida', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    expect(service.lastRefreshed()).toBeInstanceOf(Date);
  });

  it('isEmpty deve ser false após carregar agentes', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    expect(service.isEmpty()).toBe(false);
  });

  it('deve chamar GET /agents no coreBaseUrl (não gatewayBaseUrl)', () => {
    service.loadAgentes();

    const req = httpMock.expectOne(AGENTS_URL);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  // ── loadAgentes — erro ──────────────────────────────────────

  it('deve definir error e zerar agentes em caso de 500', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(
      { message: 'Erro interno do servidor' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(service.error()).toBe('Erro interno do servidor');
    expect(service.agentes()).toEqual([]);
    expect(service.hasError()).toBe(true);
    expect(service.loading()).toBe(false);
  });

  it('deve setar error quando resposta não tem body message', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(null, { status: 503, statusText: 'Service Unavailable' });

    expect(service.error()).not.toBeNull();
    expect(service.hasError()).toBe(true);
    expect(service.loading()).toBe(false);
  });

  // ── clearError ──────────────────────────────────────────────

  it('clearError deve limpar o estado de erro', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(
      { message: 'Erro' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    service.clearError();

    expect(service.error()).toBeNull();
    expect(service.hasError()).toBe(false);
  });

  // ── pauseAgente — sucesso ───────────────────────────────────

  it('pauseAgente deve adicionar id a acoesEmAndamento antes da resposta', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.pauseAgente('ag-1');
    expect(service.acoesEmAndamento()).toContain('ag-1');

    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-1/pause`)
      .flush({ data: { ...agenteActive, status: 'PAUSED' } });
  });

  it('pauseAgente deve remover id de acoesEmAndamento após resposta', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.pauseAgente('ag-1');
    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-1/pause`)
      .flush({ data: { ...agenteActive, status: 'PAUSED' } });

    expect(service.acoesEmAndamento()).not.toContain('ag-1');
  });

  it('pauseAgente deve atualizar o agente na lista com dados retornados pelo backend', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.pauseAgente('ag-1');
    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-1/pause`)
      .flush({ data: { ...agenteActive, status: 'PAUSED' } });

    const atualizado = service.agentes().find((a) => a.id === 'ag-1');
    expect(atualizado?.status).toBe('PAUSED');
  });

  // ── pauseAgente — erro ──────────────────────────────────────

  it('pauseAgente deve remover id de acoesEmAndamento e setar error em caso de falha', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.pauseAgente('ag-1');
    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-1/pause`)
      .flush(
        { message: 'Transição de status inválida' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(service.acoesEmAndamento()).not.toContain('ag-1');
    expect(service.error()).toBe('Transição de status inválida');
  });

  // ── activateAgente — sucesso ────────────────────────────────

  it('activateAgente deve adicionar id a acoesEmAndamento antes da resposta', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.activateAgente('ag-2');
    expect(service.acoesEmAndamento()).toContain('ag-2');

    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-2/activate`)
      .flush({ data: { ...agentePaused, status: 'ACTIVE' } });
  });

  it('activateAgente deve atualizar o agente na lista com status ACTIVE', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.activateAgente('ag-2');
    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-2/activate`)
      .flush({ data: { ...agentePaused, status: 'ACTIVE' } });

    const atualizado = service.agentes().find((a) => a.id === 'ag-2');
    expect(atualizado?.status).toBe('ACTIVE');
    expect(service.acoesEmAndamento()).not.toContain('ag-2');
  });

  // ── activateAgente — erro ───────────────────────────────────

  it('activateAgente deve setar error quando agente não tem política', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.activateAgente('ag-3');
    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-3/activate`)
      .flush(
        { message: 'Agente sem política de autonomia configurada' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(service.error()).toBe('Agente sem política de autonomia configurada');
    expect(service.acoesEmAndamento()).not.toContain('ag-3');
  });

  // ── setFiltroStatus + agentesFiltrados ──────────────────────

  it('agentesFiltrados retorna todos quando filtro é TODOS', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.setFiltroStatus('TODOS');
    expect(service.agentesFiltrados()).toHaveLength(4);
  });

  it('agentesFiltrados retorna apenas ACTIVE quando filtro é ACTIVE', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.setFiltroStatus('ACTIVE');
    const filtrados = service.agentesFiltrados();
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe('ag-1');
  });

  it('agentesFiltrados retorna apenas PAUSED quando filtro é PAUSED', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.setFiltroStatus('PAUSED');
    const filtrados = service.agentesFiltrados();
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].id).toBe('ag-2');
  });

  it('agentesFiltrados retorna lista vazia quando nenhum agente corresponde ao filtro', () => {
    // Carrega apenas agente ACTIVE — filtro DEPRECATED retorna vazio
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush({ data: [agenteActive], total: 1 });

    service.setFiltroStatus('DEPRECATED');
    expect(service.agentesFiltrados()).toHaveLength(0);
  });

  // ── contagemPorStatus ───────────────────────────────────────

  it('contagemPorStatus deve refletir a composição real da lista', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    const c = service.contagemPorStatus();
    expect(c.TODOS).toBe(4);
    expect(c.ACTIVE).toBe(1);
    expect(c.PAUSED).toBe(1);
    expect(c.SANDBOX).toBe(1);
    expect(c.DEPRECATED).toBe(1);
  });

  it('contagemPorStatus deve ser atualizado após pauseAgente bem-sucedido', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    // ACTIVE: 1, PAUSED: 1 → após pause do ag-1: ACTIVE: 0, PAUSED: 2
    service.pauseAgente('ag-1');
    httpMock
      .expectOne(`${environment.coreBaseUrl}/agents/ag-1/pause`)
      .flush({ data: { ...agenteActive, status: 'PAUSED' } });

    const c = service.contagemPorStatus();
    expect(c.ACTIVE).toBe(0);
    expect(c.PAUSED).toBe(2);
  });

  // ── refreshAgentes ──────────────────────────────────────────

  it('refreshAgentes deve atualizar agentes sem alterar loading', () => {
    service.refreshAgentes();
    expect(service.loading()).toBe(false);

    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    expect(service.agentes()).toHaveLength(4);
    expect(service.total()).toBe(4);
    expect(service.loading()).toBe(false);
  });

  it('refreshAgentes deve definir lastRefreshed após sucesso', () => {
    service.refreshAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    expect(service.lastRefreshed()).toBeInstanceOf(Date);
  });

  it('refreshAgentes deve ignorar erro sem alterar estado de error', () => {
    service.refreshAgentes();
    httpMock.expectOne(AGENTS_URL).flush(
      { message: 'Erro interno' },
      { status: 500, statusText: 'Internal Server Error' },
    );

    expect(service.error()).toBeNull();
    expect(service.loading()).toBe(false);
  });

  // ── createAgente ────────────────────────────────────────────

  const CREATE_DTO: CreateAgenteDto = {
    name:    'Agente Novo',
    ownerId: 'user-uuid-123',
    modelId: 'claude-sonnet-4-6',
    tools:   ['read_protheus_pedido'],
  };

  const novoAgente = makeAgente({ id: 'ag-novo', name: 'Agente Novo', status: 'SANDBOX', modelId: 'claude-sonnet-4-6' });

  it('deve iniciar com creating=false e createError=null', () => {
    expect(service.creating()).toBe(false);
    expect(service.createError()).toBeNull();
    expect(service.createdAgent()).toBeNull();
  });

  it('createAgente deve emitir creating=true antes da resposta', () => {
    service.createAgente(CREATE_DTO);
    expect(service.creating()).toBe(true);
    httpMock.expectOne({ method: 'POST', url: AGENTS_URL }).flush({ data: novoAgente });
  });

  it('createAgente deve adicionar agente à lista e setar createdAgent após 201', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.createAgente(CREATE_DTO);
    httpMock
      .expectOne({ method: 'POST', url: AGENTS_URL })
      .flush({ data: novoAgente });

    expect(service.agentes()).toHaveLength(5);
    expect(service.agentes()[0].id).toBe('ag-novo');
    expect(service.total()).toBe(5);
    expect(service.creating()).toBe(false);
    expect(service.createdAgent()?.id).toBe('ag-novo');
  });

  it('createAgente deve setar createError e não alterar a lista em caso de erro', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.createAgente(CREATE_DTO);
    httpMock
      .expectOne({ method: 'POST', url: AGENTS_URL })
      .flush(
        { message: 'Dados inválidos' },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(service.createError()).toBe('Dados inválidos');
    expect(service.creating()).toBe(false);
    expect(service.agentes()).toHaveLength(4);
    expect(service.createdAgent()).toBeNull();
  });

  it('createAgente deve usar issues[0].message de resposta Zod quando disponível', () => {
    service.createAgente(CREATE_DTO);
    httpMock
      .expectOne({ method: 'POST', url: AGENTS_URL })
      .flush(
        { issues: [{ message: 'name é obrigatório' }] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(service.createError()).toBe('name é obrigatório');
  });

  it('clearCreateError deve limpar createError', () => {
    service.createAgente(CREATE_DTO);
    httpMock
      .expectOne({ method: 'POST', url: AGENTS_URL })
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Internal Server Error' });

    service.clearCreateError();

    expect(service.createError()).toBeNull();
  });

  it('clearCreatedAgent deve limpar createdAgent', () => {
    service.createAgente(CREATE_DTO);
    httpMock.expectOne({ method: 'POST', url: AGENTS_URL }).flush({ data: novoAgente });

    expect(service.createdAgent()).not.toBeNull();

    service.clearCreatedAgent();

    expect(service.createdAgent()).toBeNull();
  });

  // ── updateAgente ────────────────────────────────────────────

  const UPDATE_DTO = { name: 'Agente Renomeado', modelId: 'gpt-4o', tools: [] as string[], policyId: null };
  const agenteAtualizado = makeAgente({ id: 'ag-1', name: 'Agente Renomeado', modelId: 'gpt-4o', tools: [], policyId: null });

  it('updateAgente deve setar updating=true durante a requisição', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.updateAgente('ag-1', UPDATE_DTO);
    expect(service.updating()).toBe(true);

    httpMock.expectOne({ method: 'PATCH', url: `${AGENTS_URL}/ag-1` }).flush({ data: agenteAtualizado });
    expect(service.updating()).toBe(false);
  });

  it('updateAgente bem-sucedido deve atualizar agente na lista e setar updatedAgent', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.updateAgente('ag-1', UPDATE_DTO);
    httpMock.expectOne({ method: 'PATCH', url: `${AGENTS_URL}/ag-1` }).flush({ data: agenteAtualizado });

    const updated = service.agentes().find((a) => a.id === 'ag-1');
    expect(updated?.name).toBe('Agente Renomeado');
    expect(updated?.modelId).toBe('gpt-4o');
    expect(service.updatedAgent()?.id).toBe('ag-1');
    expect(service.updateError()).toBeNull();
  });

  it('updateAgente com erro deve setar updateError e manter lista inalterada', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.updateAgente('ag-1', UPDATE_DTO);
    httpMock
      .expectOne({ method: 'PATCH', url: `${AGENTS_URL}/ag-1` })
      .flush(
        { message: 'Agente não encontrado' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(service.updateError()).toBe('Agente não encontrado');
    expect(service.updating()).toBe(false);
    expect(service.updatedAgent()).toBeNull();
    expect(service.agentes().find((a) => a.id === 'ag-1')?.name).toBe('Agente Alpha');
  });

  it('updateAgente deve usar issues[0].message de resposta Zod quando disponível', () => {
    service.updateAgente('ag-1', UPDATE_DTO);
    httpMock
      .expectOne({ method: 'PATCH', url: `${AGENTS_URL}/ag-1` })
      .flush(
        { issues: [{ message: 'name não pode ser vazio' }] },
        { status: 400, statusText: 'Bad Request' },
      );

    expect(service.updateError()).toBe('name não pode ser vazio');
  });

  it('clearUpdateError deve limpar updateError', () => {
    service.updateAgente('ag-1', UPDATE_DTO);
    httpMock
      .expectOne({ method: 'PATCH', url: `${AGENTS_URL}/ag-1` })
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Internal Server Error' });

    service.clearUpdateError();

    expect(service.updateError()).toBeNull();
  });

  it('clearUpdatedAgent deve limpar updatedAgent', () => {
    service.loadAgentes();
    httpMock.expectOne(AGENTS_URL).flush(mockResponse);

    service.updateAgente('ag-1', UPDATE_DTO);
    httpMock.expectOne({ method: 'PATCH', url: `${AGENTS_URL}/ag-1` }).flush({ data: agenteAtualizado });

    expect(service.updatedAgent()).not.toBeNull();

    service.clearUpdatedAgent();

    expect(service.updatedAgent()).toBeNull();
  });

});
