// ============================================================
// policy.router.spec.ts
//
// Testes do PolicyRouter usando servidor HTTP nativo do Node.
// Padrão: sem supertest — usa fetch nativo (Node 18+).
//
// Cobre: HTTP status codes, body, Zod validation, cross-tenant.
// Lógica de negócio coberta em policy.service.spec.ts.
// ============================================================

import http from 'http'
import express from 'express'
import jwt from 'jsonwebtoken'

import { createPolicyRouter }  from './policy.router'
import { PolicyNotFoundError } from '../application/policy.service'
import type { PolicyService }  from '../application/policy.service'
import { createTenantMiddleware } from '../../../shared/middleware/tenant.middleware'

// ── Setup ────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-policy-router'
const TENANT_A   = 'tenant-policy-a'

const POLICY_STUB = {
  id:             'policy-1',
  tenantId:       TENANT_A,
  name:           'Atendimento Consultivo',
  autonomyLevel:  'CONSULTIVO',
  allowedActions: ['read_protheus_pedido'],
  approvers:      [],
  version:        '1.0.0',
}

let server:  http.Server
let baseUrl: string
let mockSvc: jest.Mocked<PolicyService>

function makeToken(tenantId: string): string {
  return jwt.sign({ tenantId, userId: 'user-1' }, JWT_SECRET)
}

async function req(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
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

beforeEach(() => new Promise<void>((resolve) => {
  mockSvc = {
    listPolicies:  jest.fn().mockResolvedValue([POLICY_STUB]),
    getPolicy:     jest.fn().mockResolvedValue(POLICY_STUB),
    updatePolicy:  jest.fn().mockResolvedValue({ ...POLICY_STUB, version: '1.1.0' }),
  } as unknown as jest.Mocked<PolicyService>

  const app = express()
  app.use(express.json())
  app.use(createTenantMiddleware({ secret: JWT_SECRET }))
  app.use('/policies', createPolicyRouter(mockSvc))

  server = http.createServer(app)
  server.listen(0, () => {
    const addr = server.address() as { port: number }
    baseUrl = `http://localhost:${addr.port}`
    resolve()
  })
}))

afterEach(() => new Promise<void>((resolve) => {
  server.close(() => resolve())
}))

// ── GET /policies ─────────────────────────────────────────────

describe('GET /policies', () => {
  it('200 — retorna lista de políticas do tenant', async () => {
    const { status, body } = await req('/policies', { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as unknown[]).length).toBe(1)
    expect(body.total).toBe(1)
    expect(mockSvc.listPolicies).toHaveBeenCalledWith(TENANT_A)
  })

  it('200 — lista vazia quando tenant não tem políticas', async () => {
    mockSvc.listPolicies.mockResolvedValueOnce([])
    const { status, body } = await req('/policies', { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect(body.total).toBe(0)
  })

  it('401 — sem token retorna erro de autenticação', async () => {
    const { status } = await req('/policies')
    expect(status).toBe(401)
  })
})

// ── GET /policies/:id ─────────────────────────────────────────

describe('GET /policies/:id', () => {
  it('200 — retorna política do tenant', async () => {
    const { status, body } = await req('/policies/policy-1', { token: makeToken(TENANT_A) })

    expect(status).toBe(200)
    expect((body.data as { id: string }).id).toBe('policy-1')
    expect(mockSvc.getPolicy).toHaveBeenCalledWith('policy-1', TENANT_A)
  })

  it('404 — política inexistente retorna POLICY_NOT_FOUND', async () => {
    mockSvc.getPolicy.mockRejectedValueOnce(new PolicyNotFoundError('x'))
    const { status, body } = await req('/policies/x', { token: makeToken(TENANT_A) })

    expect(status).toBe(404)
    expect(body.code).toBe('POLICY_NOT_FOUND')
  })
})

// ── PATCH /policies/:id ───────────────────────────────────────

describe('PATCH /policies/:id', () => {
  it('200 — atualiza e retorna versão bumped', async () => {
    const { status, body } = await req('/policies/policy-1', {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { name: 'Novo Nome' },
    })

    expect(status).toBe(200)
    expect((body.data as { version: string }).version).toBe('1.1.0')
    expect(mockSvc.updatePolicy).toHaveBeenCalledWith('policy-1', TENANT_A, { name: 'Novo Nome' })
  })

  it('400 — autonomyLevel inválido', async () => {
    const { status, body } = await req('/policies/policy-1', {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { autonomyLevel: 'INVALIDO' },
    })

    expect(status).toBe(400)
    expect(body.issues).toBeDefined()
    expect(mockSvc.updatePolicy).not.toHaveBeenCalled()
  })

  it('400 — approver não-email rejeitado pelo Zod', async () => {
    const { status, body } = await req('/policies/policy-1', {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { approvers: ['nao-e-email'] },
    })

    expect(status).toBe(400)
    const issues = body.issues as Array<{ message: string }>
    expect(issues[0].message).toBe('Aprovador deve ser e-mail válido')
  })

  it('400 — campo desconhecido rejeitado (strict schema)', async () => {
    const { status } = await req('/policies/policy-1', {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { tenantId: 'inject-attempt' },
    })

    expect(status).toBe(400)
    expect(mockSvc.updatePolicy).not.toHaveBeenCalled()
  })

  it('200 — maxValueBrl null aceito para zerar limite', async () => {
    const updated = { ...POLICY_STUB, autonomyLevel: 'CONSULTIVO' as const, maxValueBrl: undefined, version: '1.1.0' }
    mockSvc.updatePolicy.mockResolvedValueOnce(updated)

    const { status } = await req('/policies/policy-1', {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { maxValueBrl: null },
    })

    expect(status).toBe(200)
    expect(mockSvc.updatePolicy).toHaveBeenCalledWith(
      'policy-1', TENANT_A, { maxValueBrl: null },
    )
  })

  it('404 — política de outro tenant retorna POLICY_NOT_FOUND', async () => {
    mockSvc.updatePolicy.mockRejectedValueOnce(new PolicyNotFoundError('policy-1'))
    const { status, body } = await req('/policies/policy-1', {
      method: 'PATCH',
      token:  makeToken(TENANT_A),
      body:   { name: 'hack' },
    })

    expect(status).toBe(404)
    expect(body.code).toBe('POLICY_NOT_FOUND')
  })
})
