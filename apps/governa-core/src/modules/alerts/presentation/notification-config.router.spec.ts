/**
 * notification-config.router.spec.ts
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * NotificationService mockado manualmente.
 */

import http from 'node:http'
import express from 'express'
import { sign } from 'jsonwebtoken'
import { createNotificationConfigRouter } from './notification-config.router'
import { tenantMiddleware }               from '../../../shared/middleware/tenant.middleware'
import type { NotificationService }       from '../application/notification.service'
import type { NotificationConfig }        from '../domain/notification-config.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret'
const TENANT     = 'tenant-test'

function makeJwt(): string {
  return sign({ tenantId: TENANT, userId: 'user-test' }, JWT_SECRET)
}

function makeConfig(overrides: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    id:              'cfg-1',
    tenantId:        TENANT,
    emailEnabled:    false,
    emailRecipients: [],
    webhookEnabled:  false,
    webhookUrl:      null,
    webhookSecret:   'secret-hidden',
    minSeverity:     'HIGH',
    updatedAt:       new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

async function startApp(
  service: Partial<NotificationService>,
): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use(tenantMiddleware)
  app.use('/notifications', createNotificationConfigRouter(service as NotificationService))

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
  path:   string,
  method: 'GET' | 'PUT' = 'GET',
  body?:  unknown,
  token?: string,
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

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env['JWT_SECRET'] = JWT_SECRET
})

// ─── GET /notifications/config ────────────────────────────────────────────────

describe('GET /notifications/config', () => {
  it('retorna 401 sem token', async () => {
    const svc = { getConfig: jest.fn() }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(url, '/notifications/config')
      expect(res.status).toBe(401)
    } finally { close() }
  })

  it('retorna 404 quando tenant não tem configuração', async () => {
    const svc = { getConfig: jest.fn().mockResolvedValue(null) }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(url, '/notifications/config', 'GET', undefined, makeJwt())
      expect(res.status).toBe(404)
    } finally { close() }
  })

  it('retorna config sem expor webhookSecret', async () => {
    const svc = { getConfig: jest.fn().mockResolvedValue(makeConfig({ emailEnabled: true })) }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(url, '/notifications/config', 'GET', undefined, makeJwt())
      expect(res.status).toBe(200)
      const body = res.body as Record<string, unknown>
      expect(body['emailEnabled']).toBe(true)
      expect(body['webhookSecret']).toBeUndefined()
    } finally { close() }
  })
})

// ─── PUT /notifications/config ────────────────────────────────────────────────

describe('PUT /notifications/config', () => {
  it('retorna 401 sem token', async () => {
    const svc = { upsertConfig: jest.fn() }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(url, '/notifications/config', 'PUT', { emailEnabled: true })
      expect(res.status).toBe(401)
    } finally { close() }
  })

  it('retorna 400 para e-mail inválido na lista de destinatários', async () => {
    const svc = { upsertConfig: jest.fn() }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(
        url, '/notifications/config', 'PUT',
        { emailRecipients: ['not-an-email'] },
        makeJwt(),
      )
      expect(res.status).toBe(400)
      expect(svc.upsertConfig).not.toHaveBeenCalled()
    } finally { close() }
  })

  it('retorna 400 quando webhookSecret tem menos de 16 caracteres', async () => {
    const svc = { upsertConfig: jest.fn() }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(
        url, '/notifications/config', 'PUT',
        { webhookSecret: 'curto' },
        makeJwt(),
      )
      expect(res.status).toBe(400)
    } finally { close() }
  })

  it('salva configuração e retorna sem webhookSecret', async () => {
    const saved = makeConfig({ emailEnabled: true, emailRecipients: ['ops@target.com'] })
    const svc   = { upsertConfig: jest.fn().mockResolvedValue(saved) }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(
        url, '/notifications/config', 'PUT',
        { emailEnabled: true, emailRecipients: ['ops@target.com'] },
        makeJwt(),
      )
      expect(res.status).toBe(200)
      expect(svc.upsertConfig).toHaveBeenCalledWith(TENANT, {
        emailEnabled:    true,
        emailRecipients: ['ops@target.com'],
      })
      const body = res.body as Record<string, unknown>
      expect(body['emailEnabled']).toBe(true)
      expect(body['webhookSecret']).toBeUndefined()
    } finally { close() }
  })

  it('aceita webhookUrl null para desabilitar', async () => {
    const saved = makeConfig({ webhookEnabled: false, webhookUrl: null, webhookSecret: null })
    const svc   = { upsertConfig: jest.fn().mockResolvedValue(saved) }
    const { url, close } = await startApp(svc)
    try {
      const res = await req(
        url, '/notifications/config', 'PUT',
        { webhookEnabled: false, webhookUrl: null },
        makeJwt(),
      )
      expect(res.status).toBe(200)
    } finally { close() }
  })
})
