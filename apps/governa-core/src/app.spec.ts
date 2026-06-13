/**
 * app.spec.ts — Testes de integração leve do wiring do app Express.
 *
 * Valida que:
 *  - GET /health responde 200 sem autenticação
 *  - GET /pedidos sem Bearer token responde 401
 *  - GET /clientes sem Bearer token responde 401
 *  - GET /agents sem Bearer token responde 401
 *
 * Estratégia: cria o app com mocks mínimos (sem Prisma, sem HTTP externo).
 */

import { type Application } from 'express'
import { createApp }        from './app'
import type { AgentService }                from './modules/agents/application/agent.service'
import type { ConsultarPedidoUseCase }      from './modules/pedidos/application/consultar-pedido.use-case'
import type { ConsultarClienteUseCase }     from './modules/clientes/application/consultar-cliente.use-case'
import type { PolicyService }               from './modules/policies/application/policy.service'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Executa uma request HTTP diretamente no app (sem porta de rede). */
async function req(
  app: Application,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port
      fetch(`http://127.0.0.1:${port}${path}`, { method, headers })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}))
          server.close()
          resolve({ status: res.status, body })
        })
        .catch((err) => { server.close(); reject(err) })
    })
  })
}

// ─── Mock deps ────────────────────────────────────────────────────────────────

const mockAgentService = {
  listAgents:    jest.fn().mockResolvedValue([]),
  getAgent:      jest.fn(),
  createAgent:   jest.fn(),
  updateAgent:   jest.fn(),
  pauseAgent:    jest.fn(),
  activateAgent: jest.fn(),
} as unknown as AgentService

const mockPedidoUseCase = {
  execute: jest.fn(),
} as unknown as ConsultarPedidoUseCase

const mockClienteUseCase = {
  execute: jest.fn(),
} as unknown as ConsultarClienteUseCase

const mockPolicyService = {
  getPolicy:     jest.fn(),
  listPolicies:  jest.fn().mockResolvedValue([]),
  updatePolicy:  jest.fn(),
} as unknown as PolicyService

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('App — wiring', () => {
  const app = createApp({
    agentService:            mockAgentService,
    consultarPedidoUseCase:  mockPedidoUseCase,
    consultarClienteUseCase: mockClienteUseCase,
    policyService:           mockPolicyService,
  })

  beforeEach(() => {
    delete process.env.JWT_SECRET
    process.env.JWT_SECRET = 'test-secret'
  })

  describe('APP-W-1: GET /health', () => {
    it('responde 200 sem autenticação', async () => {
      const { status, body } = await req(app, 'GET', '/health')
      expect(status).toBe(200)
      expect(body).toMatchObject({ status: 'ok' })
    })
  })

  describe('APP-W-2: GET /pedidos sem token', () => {
    it('responde 401', async () => {
      const { status } = await req(app, 'GET', '/pedidos?agentId=a1&subjectToken=t1')
      expect(status).toBe(401)
    })
  })

  describe('APP-W-3: GET /clientes sem token', () => {
    it('responde 401', async () => {
      const { status } = await req(app, 'GET', '/clientes?agentId=a1&subjectToken=t1')
      expect(status).toBe(401)
    })
  })

  describe('APP-W-4: GET /agents sem token', () => {
    it('responde 401', async () => {
      const { status } = await req(app, 'GET', '/agents')
      expect(status).toBe(401)
    })
  })
})
