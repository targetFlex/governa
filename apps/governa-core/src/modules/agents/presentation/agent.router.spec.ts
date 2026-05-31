/**
 * Testes do AgentRouter usando servidor HTTP nativo do Node (sem supertest).
 *
 * Estratégia: cria um servidor Express real em porta aleatória, faz requests
 * com fetch nativo (Node 18+), destrói o servidor após cada suite.
 *
 * Cobre: HTTP status codes, body de resposta, cross-tenant, Zod validation.
 * A lógica de negócio está coberta em agent.service.spec.ts — aqui testamos
 * apenas a camada de tradução HTTP ↔ service.
 */

import http from 'http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

import { createAgentRouter } from './agent.router'
import { AgentService } from '../application/agent.service'
import { InMemoryAgentInventoryRepository } from '../../../../test/fixtures/in-memory-agent-inventory.repository'
import { createTenantMiddleware } from '../../../shared/middleware/tenant.middleware'
import type { AgentInventoryEntity } from '../domain/agent-inventory.entity'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const JWT_SECRET = 'test-secret-router-suite'
const TENANT_A   = 'tenant-http-a'
const TENANT_B   = 'tenant-http-b'
const OWNER_ID   = randomUUID()

let server: http.Server
let baseUrl: string
let repo: InMemoryAgentInventoryRepository

function makeToken(tenantId: string, userId = OWNER_ID): string {
  return jwt.sign({ tenantId, userId }, JWT_SECRET)
}

function makeAgent(overrides: Partial<AgentInventoryEntity> = {}): AgentInventoryEntity {
  const now = new Date()
  return {
    id:           randomUUID(),
    tenantId:     TENANT_A,
    name:         'Router Test Agent',
    description:  '',
    ownerId:      OWNER_ID,
    policyId:     null,
    status:       'SANDBOX',
    modelId:      'claude-haiku-4-5',
    tools:        [],
    createdAt:    now,
    updatedAt:    now,
    lastActiveAt: null,
    ...overrides,
  }
}

async function req(
  path: string,
  options: {
    method?: string
    token?: string
    body?: unknown
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { method = 'GET', token, body } = options
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = await res.json() as Record<string, unknown>
  return { status: res.status, body: json }
}

beforeEach(() => new Promise<void>(resolve => {
  repo = new InMemoryAgentInventoryRepository()
  const service = new AgentService(repo)
  const router  = createAgentRouter(service)
  const app     = express()
  app.use(express.json())
  app.use(createTenantMiddleware({ secret: JWT_SECRET }))
  app.use('/agents', router)

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
// GET /agents
// ---------------------------------------------------------------------------

describe('GET /agents', () => {
  it('200 — retorna agentes do tenant', async () => {
    repo.seed([makeAgent(), makeAgent()])
    const { status, body } = await req('/agents', { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as unknown[]).length).toBe(2)
    expect(body.total).toBe(2)
  })

  it('200 — não retorna agentes de outro tenant (cross-tenant)', async () => {
    repo.seed([makeAgent({ tenantId: TENANT_B })])
    const { status, body } = await req('/agents', { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as unknown[]).length).toBe(0)
  })

  it('401 — sem token', async () => {
    const { status } = await req('/agents')
    expect(status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// GET /agents/:id
// ---------------------------------------------------------------------------

describe('GET /agents/:id', () => {
  it('200 — retorna agente do tenant', async () => {
    const agent = makeAgent()
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}`, { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as { id: string }).id).toBe(agent.id)
  })

  it('404 — agente não existe', async () => {
    const { status, body } = await req(`/agents/${randomUUID()}`, { token: makeToken(TENANT_A) })
    expect(status).toBe(404)
    expect(body.code).toBe('AGENT_NOT_FOUND')
  })

  it('404 — agente de outro tenant (não 403)', async () => {
    const agent = makeAgent({ tenantId: TENANT_B })
    repo.seed([agent])

    const { status } = await req(`/agents/${agent.id}`, { token: makeToken(TENANT_A) })
    expect(status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST /agents
// ---------------------------------------------------------------------------

describe('POST /agents', () => {
  it('201 — cria agente SANDBOX', async () => {
    const { status, body } = await req('/agents', {
      method: 'POST',
      token:  makeToken(TENANT_A),
      body:   { name: 'Novo Agente', ownerId: randomUUID(), modelId: 'claude-haiku-4-5' },
    })

    expect(status).toBe(201)
    expect((body.data as { status: string }).status).toBe('SANDBOX')
    expect((body.data as { tenantId: string }).tenantId).toBe(TENANT_A)
  })

  it('400 — name ausente', async () => {
    const { status, body } = await req('/agents', {
      method: 'POST',
      token:  makeToken(TENANT_A),
      body:   { modelId: 'model' },
    })

    expect(status).toBe(400)
    expect(body.issues).toBeDefined()
  })

  it('400 — ownerId inválido', async () => {
    const { status } = await req('/agents', {
      method: 'POST',
      token:  makeToken(TENANT_A),
      body:   { name: 'X', ownerId: 'not-uuid', modelId: 'model' },
    })
    expect(status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// PATCH /agents/:id
// ---------------------------------------------------------------------------

describe('PATCH /agents/:id', () => {
  it('200 — atualiza campos', async () => {
    const agent = makeAgent()
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}`, {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { name: 'Nome Atualizado' },
    })

    expect(status).toBe(200)
    expect((body.data as { name: string }).name).toBe('Nome Atualizado')
  })

  it('404 — cross-tenant (não 403)', async () => {
    const agent = makeAgent({ tenantId: TENANT_B })
    repo.seed([agent])

    const { status } = await req(`/agents/${agent.id}`, {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { name: 'Hack' },
    })
    expect(status).toBe(404)
  })

  it('400 — campo desconhecido (strict schema)', async () => {
    const agent = makeAgent()
    repo.seed([agent])

    const { status } = await req(`/agents/${agent.id}`, {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { status: 'ACTIVE' }, // campo não permitido
    })
    expect(status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /agents/:id/pause
// ---------------------------------------------------------------------------

describe('POST /agents/:id/pause', () => {
  it('200 — pausa agente ACTIVE', async () => {
    const agent = makeAgent({ status: 'ACTIVE' })
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}/pause`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })

    expect(status).toBe(200)
    expect((body.data as { status: string }).status).toBe('PAUSED')
  })

  it('404 — agente não existe', async () => {
    const { status } = await req(`/agents/${randomUUID()}/pause`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })
    expect(status).toBe(404)
  })

  it('422 — agente DEPRECATED', async () => {
    const agent = makeAgent({ status: 'DEPRECATED' })
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}/pause`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })
    expect(status).toBe(422)
    expect(body.code).toBe('AGENT_DEPRECATED')
  })
})

// ---------------------------------------------------------------------------
// POST /agents/:id/activate
// ---------------------------------------------------------------------------

describe('POST /agents/:id/activate', () => {
  it('200 — ativa agente SANDBOX com policy', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: randomUUID() })
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}/activate`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })

    expect(status).toBe(200)
    expect((body.data as { status: string }).status).toBe('ACTIVE')
  })

  it('422 — agente sem policy', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: null })
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}/activate`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })
    expect(status).toBe(422)
    expect(body.code).toBe('AGENT_NO_POLICY')
  })

  it('422 — agente DEPRECATED', async () => {
    const agent = makeAgent({ status: 'DEPRECATED', policyId: randomUUID() })
    repo.seed([agent])

    const { status, body } = await req(`/agents/${agent.id}/activate`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })
    expect(status).toBe(422)
    expect(body.code).toBe('AGENT_DEPRECATED')
  })

  it('404 — cross-tenant', async () => {
    const agent = makeAgent({ tenantId: TENANT_B, policyId: randomUUID() })
    repo.seed([agent])

    const { status } = await req(`/agents/${agent.id}/activate`, {
      method: 'POST',
      token:  makeToken(TENANT_A),
    })
    expect(status).toBe(404)
  })
})
