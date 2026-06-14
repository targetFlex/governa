/**
 * audit.router.spec.ts — Testes do AuditRouter via HTTP nativo.
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * AuditQueryService mockado — sem banco.
 */

import http                   from 'node:http'
import express                from 'express'
import { createAuditRouter }  from './audit.router'
import { tenantMiddleware }   from '../../../shared/middleware/tenant.middleware'
import type { AuditQueryService } from '../application/audit.query.service'
import type { AuditEventPage }    from '../domain/audit-event-repository.port'
import type { AuditEventEntity }  from '../domain/audit-event.entity'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function startApp(service: AuditQueryService): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/audit-events', createAuditRouter(service))

  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const port = (server.address() as { port: number }).port
      resolve({
        url:   `http://127.0.0.1:${port}`,
        close: () => server.close(),
      })
    })
    server.on('error', reject)
  })
}

async function get(
  url: string,
  path: string,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res  = await fetch(`${url}${path}`, { headers })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-test'

function makeJwt(): string {
  // JWT mínimo: tenantId + userId obrigatórios pelo tenantMiddleware
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { sign } = require('jsonwebtoken') as typeof import('jsonwebtoken')
  return sign(
    { tenantId: TENANT, userId: 'user-test' },
    process.env['JWT_SECRET'] ?? 'test-secret',
  )
}

function makeEvent(): AuditEventEntity {
  return {
    id:             'evt-abc',
    tenantId:       TENANT,
    agentId:        'agent-1',
    traceId:        'trace-1',
    prevHash:       'GENESIS',
    hash:           'hash-1',
    action:         'read_protheus_pedido',
    inputSummary:   'consulta pedido #1',
    outcome:        'EXECUTADO',
    latencyMs:      100,
    subjectToken:   'sub-token',
    dataCategories: ['pedido'],
    legalBasis:     'Legítimo interesse',
    purpose:        'Atendimento',
    retentionUntil: new Date('2031-01-01'),
    createdAt:      new Date('2026-06-01T10:00:00Z'),
  }
}

function makePage(): AuditEventPage {
  return { data: [makeEvent()], total: 1, page: 1, limit: 20 }
}

function makeMockService(overrides: Partial<AuditQueryService> = {}): AuditQueryService {
  return {
    listEvents:   jest.fn().mockResolvedValue(makePage()),
    exportEvents: jest.fn().mockResolvedValue([makeEvent()]),
    ...overrides,
  } as unknown as AuditQueryService
}

// ─── Testes ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env['JWT_SECRET'] = 'test-secret'
})

// AR-1: GET /audit-events sem token → 401

describe('AR-1: GET /audit-events sem token', () => {
  it('retorna 401', async () => {
    const { url, close } = await startApp(makeMockService())
    try {
      const { status } = await get(url, '/audit-events')
      expect(status).toBe(401)
    } finally { close() }
  })
})

// AR-2: GET /audit-events com token → 200 + página

describe('AR-2: GET /audit-events com token', () => {
  it('retorna 200 com data, total, page, limit', async () => {
    const service        = makeMockService()
    const { url, close } = await startApp(service)
    try {
      const { status, body } = await get(url, '/audit-events', makeJwt())
      const b = body as Record<string, unknown>
      expect(status).toBe(200)
      expect(Array.isArray(b['data'])).toBe(true)
      expect(b['total']).toBe(1)
      expect(b['page']).toBe(1)
      expect(b['limit']).toBe(20)
    } finally { close() }
  })
})

// AR-3: GET /audit-events?outcome=INVALIDO → 400

describe('AR-3: GET /audit-events?outcome=INVALIDO', () => {
  it('retorna 400 com issues', async () => {
    const { url, close } = await startApp(makeMockService())
    try {
      const { status, body } = await get(url, '/audit-events?outcome=INVALIDO', makeJwt())
      const b = body as Record<string, unknown>
      expect(status).toBe(400)
      expect(b['error']).toBe('Parâmetros inválidos')
      expect(Array.isArray(b['issues'])).toBe(true)
    } finally { close() }
  })
})

// AR-4: GET /audit-events?agentId=nao-uuid → 400

describe('AR-4: GET /audit-events?agentId=nao-uuid', () => {
  it('retorna 400', async () => {
    const { url, close } = await startApp(makeMockService())
    try {
      const { status } = await get(url, '/audit-events?agentId=nao-e-uuid', makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})

// AR-5: GET /audit-events?from= data inválida → 400

describe('AR-5: GET /audit-events?from=data-invalida', () => {
  it('retorna 400', async () => {
    const { url, close } = await startApp(makeMockService())
    try {
      const { status } = await get(url, '/audit-events?from=nao-e-data', makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})

// AR-6: GET /audit-events/export com token → 200 + lista

describe('AR-6: GET /audit-events/export', () => {
  it('retorna 200 com data e total', async () => {
    const service        = makeMockService()
    const { url, close } = await startApp(service)
    try {
      const { status, body } = await get(url, '/audit-events/export', makeJwt())
      const b = body as Record<string, unknown>
      expect(status).toBe(200)
      expect(Array.isArray(b['data'])).toBe(true)
      expect(b['total']).toBe(1)
    } finally { close() }
  })
})

// AR-7: GET /audit-events/export sem token → 401

describe('AR-7: GET /audit-events/export sem token', () => {
  it('retorna 401', async () => {
    const { url, close } = await startApp(makeMockService())
    try {
      const { status } = await get(url, '/audit-events/export')
      expect(status).toBe(401)
    } finally { close() }
  })
})

// AR-8: GET /audit-events?page=2&limit=10 → service chamado com page/limit

describe('AR-8: paginação repassada ao service', () => {
  it('chama listEvents com page=2 e limit=10', async () => {
    const service        = makeMockService()
    const { url, close } = await startApp(service)
    try {
      await get(url, '/audit-events?page=2&limit=10', makeJwt())
      expect(service.listEvents).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ page: 2, limit: 10 }),
      )
    } finally { close() }
  })
})

// AR-9: GET /audit-events?limit=999 → 400 (max 100)

describe('AR-9: limit > 100 → 400', () => {
  it('retorna 400 quando limit > 100', async () => {
    const { url, close } = await startApp(makeMockService())
    try {
      const { status } = await get(url, '/audit-events?limit=999', makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})

// AR-10: GET /audit-events/export?outcome=BLOQUEADO → service chamado com outcome

describe('AR-10: exportEvents repassa outcome', () => {
  it('chama exportEvents com outcome=BLOQUEADO', async () => {
    const service        = makeMockService()
    const { url, close } = await startApp(service)
    try {
      await get(url, '/audit-events/export?outcome=BLOQUEADO', makeJwt())
      expect(service.exportEvents).toHaveBeenCalledWith(
        TENANT,
        expect.objectContaining({ outcome: 'BLOQUEADO' }),
      )
    } finally { close() }
  })
})

// AR-11: isolamento tenant — tenantId do JWT, não da query

describe('AR-11: tenantId extraído do JWT', () => {
  it('service.listEvents recebe tenantId do JWT, não da query string', async () => {
    const service        = makeMockService()
    const { url, close } = await startApp(service)
    try {
      await get(url, '/audit-events?tenantId=invasor', makeJwt())
      expect(service.listEvents).toHaveBeenCalledWith(
        TENANT, // do JWT — não 'invasor'
        expect.any(Object),
      )
    } finally { close() }
  })
})
