/**
 * tool-check.router.spec.ts — E5.4
 *
 * Testes do endpoint POST /policies/check-tool via HTTP nativo.
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * PolicyEngine mockado — sem banco.
 *
 * Cenários cobertos:
 *   1. 200 tool permitida
 *   2. 403 TOOL_BLOCKED
 *   3. 404 AGENT_NOT_FOUND
 *   4. 422 AGENT_WITHOUT_POLICY
 *   5. 400 body inválido (toolName ausente)
 *   6. 400 body inválido (agentId ausente)
 *   7. 401 sem JWT
 *   8. tenantId vem do JWT (nunca do body)
 */

import http    from 'node:http'
import express from 'express'
import { createToolCheckRouter }    from './tool-check.router'
import { tenantMiddleware }         from '../../../shared/middleware/tenant.middleware'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
  ToolBlockedError,
}                                   from '../application/policy.errors'
import type { PolicyEngine }        from '../application/policy.engine'
import type { ToolScope }           from '../domain/tool-scope.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret'
})

const TENANT   = 'tenant-1'
const AGENT_ID = 'agent-abc'

function makeJwt(tenantId = TENANT): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sign } = require('jsonwebtoken') as typeof import('jsonwebtoken')
  return sign(
    { tenantId, userId: 'user-1' },
    process.env['JWT_SECRET'] ?? 'test-secret',
  )
}

function makeScope(overrides: Partial<ToolScope> = {}): ToolScope {
  return Object.freeze({
    agentId:       AGENT_ID,
    tenantId:      TENANT,
    autonomyLevel: 'CONSULTIVO' as const,
    policyId:      'pol-1',
    policyVersion: '1',
    tools:         [
      { name: 'read_db',  description: 'Leitura de banco', isWrite: false, execute: jest.fn() },
      { name: 'list_csv', description: 'Listar CSV',       isWrite: false, execute: jest.fn() },
    ],
    ...overrides,
  })
}

async function startApp(
  engine: Pick<PolicyEngine, 'buildScope' | 'assertToolAllowed'>,
): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/policies', createToolCheckRouter(engine as PolicyEngine))

  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() })
    })
    server.on('error', reject)
  })
}

async function req(
  url:    string,
  body:   unknown,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${url}/policies/check-tool`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('POST /policies/check-tool', () => {
  it('200 — tool permitida retorna allowed: true com policyId e autonomyLevel', async () => {
    const scope  = makeScope()
    const engine = {
      buildScope:        jest.fn().mockResolvedValue(scope),
      assertToolAllowed: jest.fn().mockResolvedValue(undefined),
    }
    const { url, close } = await startApp(engine)

    const { status, body } = await req(url, { agentId: AGENT_ID, toolName: 'read_db' }, makeJwt())

    expect(status).toBe(200)
    expect(body).toMatchObject({
      allowed:       true,
      agentId:       AGENT_ID,
      toolName:      'read_db',
      policyId:      'pol-1',
      autonomyLevel: 'CONSULTIVO',
    })

    close()
  })

  it('403 TOOL_BLOCKED — tool fora do escopo retorna allowed: false', async () => {
    const scope = makeScope()
    const engine = {
      buildScope:        jest.fn().mockResolvedValue(scope),
      assertToolAllowed: jest.fn().mockRejectedValue(
        new ToolBlockedError('delete_db', 'pol-1', "tool 'delete_db' não está no escopo"),
      ),
    }
    const { url, close } = await startApp(engine)

    const { status, body } = await req(url, { agentId: AGENT_ID, toolName: 'delete_db' }, makeJwt())

    expect(status).toBe(403)
    expect(body).toMatchObject({
      allowed:  false,
      code:     'TOOL_BLOCKED',
      toolName: 'delete_db',
      policyId: 'pol-1',
    })
    expect((body as Record<string, unknown>).reason).toBeDefined()

    close()
  })

  it('404 AGENT_NOT_FOUND — agente não existe para o tenant', async () => {
    const engine = {
      buildScope:        jest.fn().mockRejectedValue(new AgentNotFoundError('agent-missing', TENANT)),
      assertToolAllowed: jest.fn(),
    }
    const { url, close } = await startApp(engine)

    const { status, body } = await req(url, { agentId: 'agent-missing', toolName: 'read_db' }, makeJwt())

    expect(status).toBe(404)
    expect((body as Record<string, unknown>).code).toBe('AGENT_NOT_FOUND')

    close()
  })

  it('422 AGENT_WITHOUT_POLICY — agente sem política ativa', async () => {
    const engine = {
      buildScope:        jest.fn().mockRejectedValue(new AgentWithoutPolicyError(AGENT_ID)),
      assertToolAllowed: jest.fn(),
    }
    const { url, close } = await startApp(engine)

    const { status, body } = await req(url, { agentId: AGENT_ID, toolName: 'read_db' }, makeJwt())

    expect(status).toBe(422)
    expect((body as Record<string, unknown>).code).toBe('AGENT_WITHOUT_POLICY')

    close()
  })

  it('400 — toolName ausente retorna erro de validação', async () => {
    const engine = {
      buildScope:        jest.fn(),
      assertToolAllowed: jest.fn(),
    }
    const { url, close } = await startApp(engine)

    const { status } = await req(url, { agentId: AGENT_ID }, makeJwt())

    expect(status).toBe(400)
    expect(engine.buildScope).not.toHaveBeenCalled()

    close()
  })

  it('400 — agentId ausente retorna erro de validação', async () => {
    const engine = {
      buildScope:        jest.fn(),
      assertToolAllowed: jest.fn(),
    }
    const { url, close } = await startApp(engine)

    const { status } = await req(url, { toolName: 'read_db' }, makeJwt())

    expect(status).toBe(400)
    expect(engine.buildScope).not.toHaveBeenCalled()

    close()
  })

  it('401 — sem JWT retorna não autorizado', async () => {
    const engine = {
      buildScope:        jest.fn(),
      assertToolAllowed: jest.fn(),
    }
    const { url, close } = await startApp(engine)

    const { status } = await req(url, { agentId: AGENT_ID, toolName: 'read_db' })

    expect(status).toBe(401)
    expect(engine.buildScope).not.toHaveBeenCalled()

    close()
  })

  it('tenantId vem do JWT — nunca do body (isolamento multi-tenant)', async () => {
    const scope  = makeScope()
    const engine = {
      buildScope:        jest.fn().mockResolvedValue(scope),
      assertToolAllowed: jest.fn().mockResolvedValue(undefined),
    }
    const { url, close } = await startApp(engine)

    const customTenant = 'tenant-x'
    await req(
      url,
      // body tenta injetar tenantId — deve ser ignorado
      { agentId: AGENT_ID, toolName: 'read_db', tenantId: 'attacker-tenant' },
      makeJwt(customTenant),
    )

    const [calledAgentId, calledTenantId] = (engine.buildScope as jest.Mock).mock.calls[0]
    expect(calledTenantId).toBe(customTenant)
    expect(calledTenantId).not.toBe('attacker-tenant')
    expect(calledAgentId).toBe(AGENT_ID)

    close()
  })
})
