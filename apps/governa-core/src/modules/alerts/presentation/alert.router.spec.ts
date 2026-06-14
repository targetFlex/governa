/**
 * alert.router.spec.ts — Testes do AlertRouter via HTTP nativo.
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * AlertService usando InMemoryAlertRepository — sem banco.
 */

import http                   from 'node:http'
import express                from 'express'
import { createAlertRouter }  from './alert.router'
import { tenantMiddleware }   from '../../../shared/middleware/tenant.middleware'
import { AlertService }       from '../application/alert.service'
import { InMemoryAlertRepository } from '../../../../test/fixtures/in-memory-alert.repository'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function startApp(service: AlertService): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/alerts', createAlertRouter(service))

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
  path:    string,
  method:  'GET' | 'POST' | 'PUT' | 'PATCH' = 'GET',
  body?:   unknown,
  token?:  string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TENANT = 'tenant-test'
const AGENT  = '00000000-0000-0000-0000-000000000001'

function makeJwt(): string {
  const { sign } = require('jsonwebtoken') as typeof import('jsonwebtoken')
  return sign(
    { tenantId: TENANT, userId: 'user-test' },
    process.env['JWT_SECRET'] ?? 'test-secret',
  )
}

function makeService() {
  return new AlertService(new InMemoryAlertRepository())
}

// ─── Setup global ────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env['JWT_SECRET'] = 'test-secret'
})

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('GET /alerts', () => {
  it('retorna 401 sem token', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status } = await req(url, '/alerts')
      expect(status).toBe(401)
    } finally { close() }
  })

  it('retorna página vazia com token válido', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status, body } = await req(url, '/alerts', 'GET', undefined, makeJwt())
      expect(status).toBe(200)
      const b = body as { data: unknown[]; total: number }
      expect(b.data).toEqual([])
      expect(b.total).toBe(0)
    } finally { close() }
  })

  it('retorna alertas criados via POST /trigger', async () => {
    const service        = makeService()
    const { url, close } = await startApp(service)
    try {
      const jwt = makeJwt()
      await req(url, '/alerts/trigger', 'POST', {
        agentId:  AGENT,
        kind:     'TOOL_BLOCKED',
        severity: 'HIGH',
        message:  'Tool bloqueada',
      }, jwt)

      const { status, body } = await req(url, '/alerts', 'GET', undefined, jwt)
      expect(status).toBe(200)
      const b = body as { data: unknown[]; total: number }
      expect(b.total).toBe(1)
      expect(Array.isArray(b.data)).toBe(true)
      expect(b.data).toHaveLength(1)
    } finally { close() }
  })

  it('filtra por kind via query param', async () => {
    const service        = makeService()
    const { url, close } = await startApp(service)
    try {
      const jwt = makeJwt()
      await req(url, '/alerts/trigger', 'POST', { agentId: AGENT, kind: 'TOOL_BLOCKED', severity: 'HIGH', message: 'A' }, jwt)
      await req(url, '/alerts/trigger', 'POST', { agentId: AGENT, kind: 'ERROR_RATE',   severity: 'LOW',  message: 'B' }, jwt)

      const { status, body } = await req(url, '/alerts?kind=TOOL_BLOCKED', 'GET', undefined, jwt)
      expect(status).toBe(200)
      const b = body as { data: Array<{ kind: string }>; total: number }
      expect(b.total).toBe(1)
      expect(b.data[0].kind).toBe('TOOL_BLOCKED')
    } finally { close() }
  })

  it('retorna 400 para query param inválido', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status } = await req(url, '/alerts?kind=INVALIDO', 'GET', undefined, makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})

describe('POST /alerts/trigger', () => {
  it('cria alerta e retorna 201', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status, body } = await req(url, '/alerts/trigger', 'POST', {
        agentId:  AGENT,
        kind:     'CHECKPOINT_EXPIRED',
        severity: 'HIGH',
        message:  'Checkpoint expirou',
        metadata: { checkpointId: 'ck-1' },
      }, makeJwt())
      expect(status).toBe(201)
      const b = body as { id: string; status: string; kind: string }
      expect(b.id).toBeDefined()
      expect(b.status).toBe('OPEN')
      expect(b.kind).toBe('CHECKPOINT_EXPIRED')
    } finally { close() }
  })

  it('retorna 400 se kind inválido', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status } = await req(url, '/alerts/trigger', 'POST', {
        agentId: AGENT, kind: 'INVALIDO', severity: 'HIGH', message: 'X',
      }, makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })

  it('retorna 400 se agentId não for UUID', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status } = await req(url, '/alerts/trigger', 'POST', {
        agentId: 'nao-uuid', kind: 'TOOL_BLOCKED', severity: 'HIGH', message: 'X',
      }, makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})

describe('PATCH /alerts/:id/status', () => {
  it('transiciona status para ACKNOWLEDGED', async () => {
    const service        = makeService()
    const { url, close } = await startApp(service)
    try {
      const jwt    = makeJwt()
      const create = await req(url, '/alerts/trigger', 'POST', {
        agentId: AGENT, kind: 'ERROR_RATE', severity: 'MEDIUM', message: 'X',
      }, jwt)
      const id = (create.body as { id: string }).id

      const { status, body } = await req(url, `/alerts/${id}/status`, 'PATCH', { status: 'ACKNOWLEDGED' }, jwt)
      expect(status).toBe(200)
      expect((body as { status: string }).status).toBe('ACKNOWLEDGED')
    } finally { close() }
  })

  it('retorna 400 para status inválido', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status } = await req(url, '/alerts/algum-id/status', 'PATCH', { status: 'INVALIDO' }, makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})

describe('GET /alerts/thresholds', () => {
  it('retorna 4 thresholds com defaults', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status, body } = await req(url, '/alerts/thresholds', 'GET', undefined, makeJwt())
      expect(status).toBe(200)
      const b = body as { data: Array<{ kind: string }> }
      expect(b.data).toHaveLength(4)
      const kinds = b.data.map((t) => t.kind)
      expect(kinds).toContain('TOOL_BLOCKED')
      expect(kinds).toContain('VOLUME_ANOMALY')
    } finally { close() }
  })
})

describe('PUT /alerts/thresholds/:kind', () => {
  it('atualiza errorRatePercent', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const jwt = makeJwt()
      const { status, body } = await req(
        url, '/alerts/thresholds/ERROR_RATE', 'PUT',
        { enabled: true, errorRatePercent: 20 },
        jwt,
      )
      expect(status).toBe(200)
      expect((body as { errorRatePercent: number }).errorRatePercent).toBe(20)
    } finally { close() }
  })

  it('retorna 400 para kind inválido', async () => {
    const { url, close } = await startApp(makeService())
    try {
      const { status } = await req(url, '/alerts/thresholds/INVALIDO', 'PUT', { enabled: true }, makeJwt())
      expect(status).toBe(400)
    } finally { close() }
  })
})
