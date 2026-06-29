/**
 * pending-action.router.spec.ts
 * Padrão: http.createServer + fetch, JWT via tenantMiddleware.
 */

import http    from 'node:http'
import express from 'express'
import { sign } from 'jsonwebtoken'
import { createPendingActionRouter }                               from './pending-action.router'
import { tenantMiddleware }                                        from '../../../shared/middleware/tenant.middleware'
import type { PendingActionService }                               from '../application/pending-action.service'
import { PendingActionNotFoundError, PendingActionAlreadyResolvedError } from '../application/pending-action.service'
import type { PendingAction }                                      from '../domain/pending-action.entity'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret'
const TENANT     = 'tenant-test'

function makeJwt(): string {
  return sign({ tenantId: TENANT, userId: 'op-1' }, JWT_SECRET, { expiresIn: '1h' })
}

function makeAction(overrides: Partial<PendingAction> = {}): PendingAction {
  return {
    id:         'pa-1',
    tenantId:   TENANT,
    agentId:    'agent-1',
    toolName:   'USER_REQUESTED',
    payload: {
      ticketId: 'ticket-001', sessionId: 'sess-1',
      userMessage: 'msg', agentReply: '',
      escalationReason: 'USER_REQUESTED', escalationSummary: 'Resumo.',
    },
    status:     'PENDING',
    approverId: null,
    expiresAt:  new Date(Date.now() + 86400000),
    createdAt:  new Date(),
    resolvedAt: null,
    ...overrides,
  }
}

async function startApp(service: Partial<PendingActionService>): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/pending-actions', createPendingActionRouter(service as PendingActionService))

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
  method: string,
  path:   string,
  body?:  unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${makeJwt()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

beforeEach(() => { process.env['JWT_SECRET'] = JWT_SECRET })
afterEach(()  => { delete process.env['JWT_SECRET'] })

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('GET /pending-actions', () => {
  it('When called, Then returns list', async () => {
    const svc = { listPending: jest.fn().mockResolvedValue([makeAction()]) }
    const { url, close } = await startApp(svc)
    try {
      const { status, body } = await req(url, 'GET', '/pending-actions')
      expect(status).toBe(200)
      expect((body as Record<string, unknown>)['total']).toBe(1)
    } finally { close() }
  })
})

describe('GET /pending-actions/:id', () => {
  it('When found, Then returns action', async () => {
    const svc = { findById: jest.fn().mockResolvedValue(makeAction()) }
    const { url, close } = await startApp(svc)
    try {
      const { status, body } = await req(url, 'GET', '/pending-actions/pa-1')
      expect(status).toBe(200)
      expect((body as Record<string, unknown>)['id']).toBe('pa-1')
    } finally { close() }
  })

  it('When not found, Then returns 404', async () => {
    const svc = { findById: jest.fn().mockRejectedValue(new PendingActionNotFoundError('pa-x')) }
    const { url, close } = await startApp(svc)
    try {
      const { status } = await req(url, 'GET', '/pending-actions/pa-x')
      expect(status).toBe(404)
    } finally { close() }
  })
})

describe('POST /pending-actions/:id/approve', () => {
  it('When valid, Then returns approved action', async () => {
    const svc = { findById: jest.fn().mockResolvedValue(makeAction()), approve: jest.fn().mockResolvedValue(makeAction({ status: 'APPROVED' })) }
    const { url, close } = await startApp(svc)
    try {
      const { status, body } = await req(url, 'POST', '/pending-actions/pa-1/approve', { approverId: 'op-1' })
      expect(status).toBe(200)
      expect((body as Record<string, unknown>)['status']).toBe('APPROVED')
    } finally { close() }
  })

  it('When approverId missing, Then returns 400', async () => {
    const svc = { approve: jest.fn() }
    const { url, close } = await startApp(svc)
    try {
      const { status } = await req(url, 'POST', '/pending-actions/pa-1/approve', {})
      expect(status).toBe(400)
    } finally { close() }
  })

  it('When already resolved, Then returns 409', async () => {
    const svc = { findById: jest.fn().mockResolvedValue(makeAction()), approve: jest.fn().mockRejectedValue(new PendingActionAlreadyResolvedError('pa-1', 'APPROVED')) }
    const { url, close } = await startApp(svc)
    try {
      const { status } = await req(url, 'POST', '/pending-actions/pa-1/approve', { approverId: 'op-1' })
      expect(status).toBe(409)
    } finally { close() }
  })
})

describe('POST /pending-actions/:id/reject', () => {
  it('When valid, Then returns rejected action', async () => {
    const svc = { findById: jest.fn().mockResolvedValue(makeAction()), reject: jest.fn().mockResolvedValue(makeAction({ status: 'REJECTED' })) }
    const { url, close } = await startApp(svc)
    try {
      const { status, body } = await req(url, 'POST', '/pending-actions/pa-1/reject', { approverId: 'op-1' })
      expect(status).toBe(200)
      expect((body as Record<string, unknown>)['status']).toBe('REJECTED')
    } finally { close() }
  })

  it('When approverId missing, Then returns 400', async () => {
    const svc = { reject: jest.fn() }
    const { url, close } = await startApp(svc)
    try {
      const { status } = await req(url, 'POST', '/pending-actions/pa-1/reject', {})
      expect(status).toBe(400)
    } finally { close() }
  })
})
