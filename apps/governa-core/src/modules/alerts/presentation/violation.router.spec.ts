/**
 * violation.router.spec.ts — Testes do ViolationRouter via HTTP nativo.
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * PolicyViolationAlertService mockado — sem banco.
 *
 * Endpoint:
 *   POST /violations  — avalia evento e dispara alertas se necessário
 */

import http    from 'node:http'
import express from 'express'
import { createViolationRouter } from './violation.router'
import { tenantMiddleware }      from '../../../shared/middleware/tenant.middleware'
import type { PolicyViolationAlertService } from '../application/policy-violation-alert.service'
import type { Alert }                       from '../domain/alert.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret'
})

const TENANT = 'tenant-1'

function makeJwt(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sign } = require('jsonwebtoken') as typeof import('jsonwebtoken')
  return sign(
    { tenantId: TENANT, userId: 'user-1' },
    process.env['JWT_SECRET'] ?? 'test-secret',
  )
}

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id:        'alert-1',
  tenantId:  TENANT,
  agentId:   'agent-1',
  kind:      'TOOL_BLOCKED',
  severity:  'HIGH',
  status:    'OPEN',
  message:   'Tool write_db bloqueada pelo agente agent-1',
  metadata:  { toolName: 'write_db' },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

async function startApp(
  svc: Pick<PolicyViolationAlertService, 'evaluate'>,
): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/violations', createViolationRouter(svc as PolicyViolationAlertService))

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
  const res = await fetch(`${url}/violations`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('POST /violations', () => {
  it('retorna 200 com lista de alertas disparados', async () => {
    const alert = makeAlert()
    const svc = { evaluate: jest.fn().mockResolvedValue([alert]) }
    const { url, close } = await startApp(svc)

    const { status, body } = await req(url, {
      kind:     'TOOL_BLOCKED',
      agentId:  'agent-1',
      toolName: 'write_db',
      policyId: 'pol-1',
      reason:   'autonomyLevel CONSULTIVO não permite escrita',
    }, makeJwt())

    expect(status).toBe(200)
    expect((body as { alerts: Alert[] }).alerts).toHaveLength(1)
    expect((body as { alerts: Alert[] }).alerts[0].kind).toBe('TOOL_BLOCKED')

    close()
  })

  it('retorna 200 com lista vazia quando nenhum alerta disparado', async () => {
    const svc = { evaluate: jest.fn().mockResolvedValue([]) }
    const { url, close } = await startApp(svc)

    const { status, body } = await req(url, {
      kind:    'AUDIT_RECORDED',
      agentId: 'agent-1',
      outcome: 'EXECUTADO',
    }, makeJwt())

    expect(status).toBe(200)
    expect((body as { alerts: Alert[] }).alerts).toEqual([])

    close()
  })

  it('passa tenantId do JWT ao serviço (isolamento multi-tenant)', async () => {
    const svc = { evaluate: jest.fn().mockResolvedValue([]) }
    const { url, close } = await startApp(svc)

    await req(url, {
      kind:    'AUDIT_RECORDED',
      agentId: 'agent-1',
      outcome: 'ERRO',
    }, makeJwt())

    const event = (svc.evaluate as jest.Mock).mock.calls[0][0]
    expect(event.tenantId).toBe(TENANT)  // nunca do body

    close()
  })

  it('retorna 400 para kind inválido', async () => {
    const svc = { evaluate: jest.fn() }
    const { url, close } = await startApp(svc)

    const { status } = await req(url, { kind: 'INVALID_KIND', agentId: 'agent-1' }, makeJwt())

    expect(status).toBe(400)
    expect(svc.evaluate).not.toHaveBeenCalled()

    close()
  })

  it('retorna 400 quando agentId ausente', async () => {
    const svc = { evaluate: jest.fn() }
    const { url, close } = await startApp(svc)

    const { status } = await req(url, { kind: 'TOOL_BLOCKED' }, makeJwt())

    expect(status).toBe(400)

    close()
  })

  it('retorna 401 sem JWT', async () => {
    const svc = { evaluate: jest.fn() }
    const { url, close } = await startApp(svc)

    const { status } = await req(url, { kind: 'TOOL_BLOCKED', agentId: 'agent-1' })

    expect(status).toBe(401)

    close()
  })

  it('event TOOL_BLOCKED: inclui toolName, policyId, reason no evento', async () => {
    const svc = { evaluate: jest.fn().mockResolvedValue([]) }
    const { url, close } = await startApp(svc)

    await req(url, {
      kind:     'TOOL_BLOCKED',
      agentId:  'agent-1',
      toolName: 'delete_records',
      policyId: 'pol-abc',
      reason:   'não permitido',
    }, makeJwt())

    const event = (svc.evaluate as jest.Mock).mock.calls[0][0]
    expect(event.kind).toBe('TOOL_BLOCKED')
    expect(event.toolName).toBe('delete_records')
    expect(event.policyId).toBe('pol-abc')
    expect(event.reason).toBe('não permitido')

    close()
  })

  it('event AUDIT_RECORDED: inclui outcome no evento', async () => {
    const svc = { evaluate: jest.fn().mockResolvedValue([]) }
    const { url, close } = await startApp(svc)

    await req(url, {
      kind:    'AUDIT_RECORDED',
      agentId: 'agent-1',
      outcome: 'BLOQUEADO',
    }, makeJwt())

    const event = (svc.evaluate as jest.Mock).mock.calls[0][0]
    expect(event.kind).toBe('AUDIT_RECORDED')
    expect(event.outcome).toBe('BLOQUEADO')

    close()
  })
})
