/**
 * anchor-agent.router.spec.ts
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * tenantId injetado via middleware simulado (JWT-free).
 */

import http     from 'node:http'
import express  from 'express'
import { sign } from 'jsonwebtoken'
import { createAnchorAgentRouter }                   from './anchor-agent.router'
import { tenantMiddleware }                           from '../../../shared/middleware/tenant.middleware'
import type { AnchorAgentService }                   from '../application/anchor-agent.service'
import { AnchorAgentNotConfiguredError }              from '../domain/anchor-agent.types'
import { AgentNotFoundError, ToolBlockedError }      from '../../policies/application/policy.errors'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret'
const TENANT     = 'tenant-test'

function makeJwt(): string {
  return sign({ tenantId: TENANT, userId: 'user-test' }, JWT_SECRET, { expiresIn: '1h' })
}

async function startApp(
  service: Partial<AnchorAgentService>,
): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/anchor-agent', createAnchorAgentRouter(service as AnchorAgentService))

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
  url:     string,
  method:  string,
  path:    string,
  body?:   unknown,
  jwt?:    string,
): Promise<{ status: number; body: unknown }> {
  const token = jwt ?? makeJwt()
  const res   = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  process.env['JWT_SECRET'] = JWT_SECRET
})

afterEach(() => {
  delete process.env['JWT_SECRET']
})

const VALID_BODY = {
  agentId:      'agent-1',
  subjectToken: 'tok-abc',
  message:      'Qual o status do pedido 123?',
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('POST /anchor-agent/chat', () => {
  describe('Given valid request with JWT', () => {
    it('When service resolves, Then returns 200 with reply', async () => {
      const service: Partial<AnchorAgentService> = {
        chat: jest.fn().mockResolvedValue({
          reply:     'Pedido 123 em separação.',
          toolCalls: [],
          sessionId: 'sess-1',
        }),
      }
      const { url, close } = await startApp(service)
      try {
        const { status, body } = await req(url, 'POST', '/anchor-agent/chat', VALID_BODY)
        expect(status).toBe(200)
        expect((body as Record<string, unknown>)['reply']).toBe('Pedido 123 em separação.')
      } finally {
        close()
      }
    })

    it('When agentId is empty, Then returns 400', async () => {
      const service: Partial<AnchorAgentService> = { chat: jest.fn() }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, 'POST', '/anchor-agent/chat', { ...VALID_BODY, agentId: '' })
        expect(status).toBe(400)
      } finally {
        close()
      }
    })

    it('When service not configured, Then returns 503', async () => {
      const service: Partial<AnchorAgentService> = {
        chat: jest.fn().mockRejectedValue(new AnchorAgentNotConfiguredError()),
      }
      const { url, close } = await startApp(service)
      try {
        const { status, body } = await req(url, 'POST', '/anchor-agent/chat', VALID_BODY)
        expect(status).toBe(503)
        expect((body as Record<string, unknown>)['code']).toBe('ANCHOR_AGENT_NOT_CONFIGURED')
      } finally {
        close()
      }
    })

    it('When agent not found, Then returns 404', async () => {
      const service: Partial<AnchorAgentService> = {
        chat: jest.fn().mockRejectedValue(new AgentNotFoundError('agent-1', TENANT)),
      }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, 'POST', '/anchor-agent/chat', VALID_BODY)
        expect(status).toBe(404)
      } finally {
        close()
      }
    })

    it('When tool blocked, Then returns 403', async () => {
      const service: Partial<AnchorAgentService> = {
        chat: jest.fn().mockRejectedValue(new ToolBlockedError('read_x', 'pol-1', 'sem permissão')),
      }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, 'POST', '/anchor-agent/chat', VALID_BODY)
        expect(status).toBe(403)
      } finally {
        close()
      }
    })
  })

  describe('Given missing JWT', () => {
    it('When no Authorization header, Then returns 401', async () => {
      const service: Partial<AnchorAgentService> = { chat: jest.fn() }
      const { url, close } = await startApp(service)
      try {
        const res = await fetch(`${url}/anchor-agent/chat`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(VALID_BODY),
        })
        expect(res.status).toBe(401)
      } finally {
        close()
      }
    })
  })
})
