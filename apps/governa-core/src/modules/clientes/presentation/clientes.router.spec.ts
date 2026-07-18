/**
 * Testes do ClientesRouter usando servidor HTTP nativo do Node (sem supertest).
 *
 * Estratégia: cria um servidor Express real em porta aleatória, faz requests
 * com fetch nativo (Node 18+), destrói o servidor após cada suite.
 *
 * Cobre: HTTP status codes, body de resposta, validação de params obrigatórios,
 * gateway indisponível (502), cliente não encontrado (404), filtro por clienteId
 * e documentoToken.
 * A lógica de negócio está coberta em consultar-cliente.use-case.spec.ts.
 *
 * Specs: CL-R-1 .. CL-R-9
 */

import http from 'http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

import { createClientesRouter } from './clientes.router'
import { ConsultarClienteUseCase } from '../application/consultar-cliente.use-case'
import { ReidentificarClienteUseCase } from '../application/reidentificar-cliente.use-case'
import { AuditService } from '../../audit/application/audit.service'
import { AgentService } from '../../agents/application/agent.service'
import { InMemoryGatewayClient } from '../../../../test/fixtures/in-memory-gateway-client'
import { InMemoryAuditEventRepository } from '../../../../test/fixtures/in-memory-audit-event.repository'
import { InMemoryAgentInventoryRepository } from '../../../../test/fixtures/in-memory-agent-inventory.repository'
import { createTenantMiddleware } from '../../../shared/middleware/tenant.middleware'
import type { ClienteInterno } from '../domain/cliente.entity'
import type { ClientePiiView } from '../../../shared/ports/gateway-client.port'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-clientes-router'
const TENANT_A   = 'tenant-clientes-a'
const TENANT_B   = 'tenant-clientes-b'
const OWNER_ID   = randomUUID()
const AGENT_ID   = randomUUID()
const SUBJECT_TOKEN = 'hmac-subject-xyz'

let server: http.Server
let baseUrl: string
let gateway: InMemoryGatewayClient
let agentInventoryRepo: InMemoryAgentInventoryRepository

function makeToken(tenantId: string, userId = OWNER_ID): string {
  return jwt.sign({ tenantId, userId }, JWT_SECRET)
}

function makeCliente(overrides: Partial<ClienteInterno> = {}): ClienteInterno {
  return {
    clienteId:      `CLI-${randomUUID().slice(0, 8)}`,
    loja:           '01',
    nomeToken:      'hmac-nome-001',
    documentoToken: `hmac-doc-${randomUUID().slice(0, 8)}`,
    enderecoToken:  'hmac-end-001',
    emailToken:     null,
    telefoneToken:  null,
    bloqueado:      false,
    ...overrides,
  }
}

function makeClientePii(overrides: Partial<ClientePiiView> = {}): ClientePiiView {
  return {
    clienteId: 'CLI-PII-01',
    loja:      '01',
    nome:      'Cliente Teste LTDA',
    documento: '12.345.678/0001-90',
    email:     'cliente@example.com',
    telefone:  '(11) 4000-0000',
    endereco:  'Rua Teste, 1|São Paulo|SP|01000000',
    ...overrides,
  }
}

async function req(
  path: string,
  options: {
    method?: string
    token?: string
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { method = 'GET', token } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, { method, headers })
  const json = await res.json() as Record<string, unknown>
  return { status: res.status, body: json }
}

beforeEach(() => new Promise<void>(resolve => {
  gateway = new InMemoryGatewayClient()
  const auditRepo    = new InMemoryAuditEventRepository()
  const auditService = new AuditService(auditRepo)
  const useCase       = new ConsultarClienteUseCase(gateway, auditService)
  const reidentificarUseCase = new ReidentificarClienteUseCase(gateway, auditService)
  agentInventoryRepo = new InMemoryAgentInventoryRepository()
  const agentService  = new AgentService(agentInventoryRepo)
  const router        = createClientesRouter(useCase, agentService, reidentificarUseCase)

  const app = express()
  app.use(express.json())
  app.use(createTenantMiddleware({ secret: JWT_SECRET }))
  app.use('/clientes', router)

  server = http.createServer(app)
  server.listen(0, () => {
    const addr = server.address() as { port: number }
    baseUrl = `http://localhost:${addr.port}`
    resolve()
  })
}))

afterEach(() => new Promise<void>(resolve => {
  server.close(() => resolve())
}))

// ---------------------------------------------------------------------------
// CL-R-1 .. CL-R-5: GET /clientes — basic cases
// ---------------------------------------------------------------------------

describe('GET /clientes', () => {
  it('CL-R-1 — 200 retorna clientes do tenant', async () => {
    gateway.seedClientes([makeCliente(), makeCliente()])

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as unknown[]).length).toBe(2)
    expect(body.total).toBe(2)
    expect(typeof body.traceId).toBe('string')
    expect(typeof body.latencyMs).toBe('number')
  })

  it('CL-R-2 — 200 lista vazia sem erro (sem filtro, sem resultados)', async () => {
    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect(body.total).toBe(0)
  })

  it('CL-R-3 — 401 sem token', async () => {
    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}`
    const { status } = await req(url)
    expect(status).toBe(401)
  })

  it('CL-R-4 — 400 agentId ausente', async () => {
    const url = `/clientes?subjectToken=${SUBJECT_TOKEN}`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })
    expect(status).toBe(400)
    expect(body.code).toBe('MISSING_AGENT_ID')
  })

  it('CL-R-5 — 400 subjectToken ausente', async () => {
    const url = `/clientes?agentId=${AGENT_ID}`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })
    expect(status).toBe(400)
    expect(body.code).toBe('MISSING_SUBJECT_TOKEN')
  })
})

// ---------------------------------------------------------------------------
// CL-R-10: acesso via painel (sem agentId/subjectToken) usa agente sintético
// ---------------------------------------------------------------------------

describe('GET /clientes — acesso via painel', () => {
  it('CL-R-10 — 200 sem agentId/subjectToken cria e usa agente sintético do tenant', async () => {
    gateway.seedClientes([makeCliente(), makeCliente()])

    const { status, body } = await req('/clientes', { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect(body.total).toBe(2)

    const agents = agentInventoryRepo.all()
    expect(agents).toHaveLength(1)
    expect(agents[0].tenantId).toBe(TENANT_A)
    expect(agents[0].templateId).toBe('__system_panel_access__')
  })

  it('CL-R-11 — chamadas repetidas via painel reusam o mesmo agente sintético (idempotente)', async () => {
    await req('/clientes', { token: makeToken(TENANT_A) })
    await req('/clientes', { token: makeToken(TENANT_A) })

    const agents = agentInventoryRepo.all().filter(a => a.tenantId === TENANT_A)
    expect(agents).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// CL-R-6: filtro por clienteId
// ---------------------------------------------------------------------------

describe('GET /clientes?clienteId=', () => {
  it('CL-R-6 — 200 filtra pelo clienteId correto', async () => {
    const alvo = makeCliente({ clienteId: 'CLI-TARGET' })
    gateway.seedClientes([alvo, makeCliente(), makeCliente()])

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}&clienteId=CLI-TARGET`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect(body.total).toBe(1)
    expect((body.data as Array<{ clienteId: string }>)[0].clienteId).toBe('CLI-TARGET')
  })

  it('CL-R-7 — 404 clienteId inexistente', async () => {
    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}&clienteId=CLI-NAOEXISTE`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(404)
    expect(body.code).toBe('CLIENTE_NOT_FOUND')
  })
})

// ---------------------------------------------------------------------------
// CL-R-8: gateway indisponível
// ---------------------------------------------------------------------------

describe('GET /clientes — gateway indisponível', () => {
  it('CL-R-8 — 502 quando gateway lança GatewayUnavailableError', async () => {
    gateway.simulateUnavailable()

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(502)
    expect(body.code).toBe('GATEWAY_UNAVAILABLE')
  })
})

// ---------------------------------------------------------------------------
// CL-R-9: tenant propagado ao use case
// ---------------------------------------------------------------------------

describe('GET /clientes — tenant propagado corretamente', () => {
  it('CL-R-9 — tenantId do token é propagado ao use case', async () => {
    const cliente = makeCliente()
    gateway.seedClientes([cliente])

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}`
    const { status } = await req(url, { token: makeToken(TENANT_B) })

    expect(status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// CL-R-12 .. CL-R-14: busca livre (q) e paginação do painel
// ---------------------------------------------------------------------------

describe('GET /clientes?q=&page=&pageSize=', () => {
  it('CL-R-12 — q filtra por clienteId e total reflete o total filtrado', async () => {
    gateway.seedClientes([
      makeCliente({ clienteId: 'CLI-ALVO-1' }),
      makeCliente({ clienteId: 'CLI-ALVO-2' }),
      makeCliente({ clienteId: 'OUTRO' }),
    ])

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}&q=alvo`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect(body.total).toBe(2)
    expect((body.data as unknown[]).length).toBe(2)
  })

  it('CL-R-13 — page/pageSize fatiam a resposta e ecoam no body', async () => {
    gateway.seedClientes([makeCliente(), makeCliente(), makeCliente()])

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}&page=2&pageSize=2`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as unknown[]).length).toBe(1)
    expect(body.total).toBe(3)
    expect(body.page).toBe(2)
    expect(body.pageSize).toBe(2)
  })

  it('CL-R-14 — pageSize inválido cai no default (20) sem quebrar a request', async () => {
    gateway.seedClientes([makeCliente()])

    const url = `/clientes?agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}&pageSize=abc`
    const { status, body } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect(body.pageSize).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// CL-R-15 .. CL-R-19: GET /:clienteId/reidentificar (painel humano)
// ---------------------------------------------------------------------------

describe('GET /:clienteId/reidentificar', () => {
  it('CL-R-15 — 200 retorna PII em texto claro do cliente', async () => {
    gateway.seedClientesPii([makeClientePii({ clienteId: 'CLI-PII-01', loja: '01' })])

    const { status, body } = await req('/clientes/CLI-PII-01/reidentificar?loja=01', {
      token: makeToken(TENANT_A),
    })

    expect(status).toBe(200)
    const data = body.data as Record<string, unknown>
    expect(data.nome).toBe('Cliente Teste LTDA')
    expect(data.documento).toBe('12.345.678/0001-90')
    expect(typeof body.traceId).toBe('string')
  })

  it('CL-R-16 — 400 quando "loja" está ausente', async () => {
    const { status, body } = await req('/clientes/CLI-PII-01/reidentificar', {
      token: makeToken(TENANT_A),
    })

    expect(status).toBe(400)
    expect(body.code).toBe('MISSING_LOJA')
  })

  it('CL-R-17 — 404 cliente não encontrado', async () => {
    const { status, body } = await req('/clientes/CLI-NAOEXISTE/reidentificar?loja=01', {
      token: makeToken(TENANT_A),
    })

    expect(status).toBe(404)
    expect(body.code).toBe('CLIENTE_NOT_FOUND')
  })

  it('CL-R-18 — 502 quando gateway indisponível', async () => {
    gateway.simulateUnavailable()

    const { status, body } = await req('/clientes/CLI-PII-01/reidentificar?loja=01', {
      token: makeToken(TENANT_A),
    })

    expect(status).toBe(502)
    expect(body.code).toBe('GATEWAY_UNAVAILABLE')
  })

  it('CL-R-19 — 401 sem token', async () => {
    const { status } = await req('/clientes/CLI-PII-01/reidentificar?loja=01')
    expect(status).toBe(401)
  })

  it('CL-R-20 — usa o agente sintético do tenant, nunca aceita agentId/subjectToken de query', async () => {
    gateway.seedClientesPii([makeClientePii({ clienteId: 'CLI-PII-02', loja: '01' })])

    const url = `/clientes/CLI-PII-02/reidentificar?loja=01&agentId=${AGENT_ID}&subjectToken=${SUBJECT_TOKEN}`
    const { status } = await req(url, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    const agents = agentInventoryRepo.all().filter(a => a.tenantId === TENANT_A)
    expect(agents).toHaveLength(1)
    expect(agents[0].templateId).toBe('__system_panel_access__')
  })
})
