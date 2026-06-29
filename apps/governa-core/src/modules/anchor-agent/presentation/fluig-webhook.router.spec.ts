/**
 * fluig-webhook.router.spec.ts
 *
 * Padrão do projeto: servidor HTTP nativo + fetch (sem supertest).
 * Sem tenantMiddleware — o webhook Fluig usa X-Fluig-Api-Key.
 */

import http    from 'node:http'
import express from 'express'
import { createFluigWebhookRouter }              from './fluig-webhook.router'
import type { FluigWebhookService }              from '../application/fluig-webhook.service'
import { AgentNotFoundError, AgentWithoutPolicyError } from '../../policies/application/policy.errors'
import { AnchorAgentNotConfiguredError }          from '../domain/anchor-agent.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_KEY = 'test-fluig-api-key'

async function startApp(
  service: Partial<FluigWebhookService>,
): Promise<{ url: string; close(): void }> {
  const app = express()
  app.use(express.json())
  app.use('/webhooks', createFluigWebhookRouter(service as FluigWebhookService, API_KEY))

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
  apiKey?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey !== undefined) headers['X-Fluig-Api-Key'] = apiKey
  const res = await fetch(`${url}/webhooks/fluig`, {
    method: 'POST',
    headers,
    body:   JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

const VALID_BODY = {
  ticketId: 'ticket-001',
  tenantId: 'tenant-1',
  agentId:  'agent-1',
  userId:   'user-42',
  message:  'Qual o status do pedido 123?',
}

const OK_RESPONSE = {
  ticketId:    'ticket-001',
  sessionId:   'sess-1',
  reply:       'Pedido 123 em separação.',
  processedAt: new Date().toISOString(),
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('POST /webhooks/fluig', () => {
  describe('Given valid API key and payload', () => {
    it('When service resolves, Then returns 200 with ticketId', async () => {
      const service = { processTicket: jest.fn().mockResolvedValue(OK_RESPONSE) }
      const { url, close } = await startApp(service)
      try {
        const { status, body } = await req(url, VALID_BODY, API_KEY)
        expect(status).toBe(200)
        expect((body as Record<string, unknown>)['ticketId']).toBe('ticket-001')
      } finally { close() }
    })

    it('When response includes escalation, Then escalation is in body', async () => {
      const service = {
        processTicket: jest.fn().mockResolvedValue({
          ...OK_RESPONSE,
          escalation: { reason: 'USER_REQUESTED', summary: 'Usuário pediu humano.' },
        }),
      }
      const { url, close } = await startApp(service)
      try {
        const { status, body } = await req(url, VALID_BODY, API_KEY)
        expect(status).toBe(200)
        expect((body as Record<string, unknown>)['escalation']).toMatchObject({ reason: 'USER_REQUESTED' })
      } finally { close() }
    })
  })

  describe('Given authentication failure', () => {
    it('When X-Fluig-Api-Key is missing, Then returns 401', async () => {
      const service = { processTicket: jest.fn() }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, VALID_BODY, undefined)
        expect(status).toBe(401)
        expect(service.processTicket).not.toHaveBeenCalled()
      } finally { close() }
    })

    it('When X-Fluig-Api-Key is wrong, Then returns 401', async () => {
      const service = { processTicket: jest.fn() }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, VALID_BODY, 'wrong-key')
        expect(status).toBe(401)
      } finally { close() }
    })
  })

  describe('Given invalid payload', () => {
    it('When message is missing, Then returns 400', async () => {
      const service = { processTicket: jest.fn() }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, { ...VALID_BODY, message: '' }, API_KEY)
        expect(status).toBe(400)
        expect(service.processTicket).not.toHaveBeenCalled()
      } finally { close() }
    })

    it('When callbackUrl is not a URL, Then returns 400', async () => {
      const service = { processTicket: jest.fn() }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, { ...VALID_BODY, callbackUrl: 'not-a-url' }, API_KEY)
        expect(status).toBe(400)
      } finally { close() }
    })
  })

  describe('Given service errors', () => {
    it('When AnchorAgentNotConfiguredError, Then returns 503', async () => {
      const service = { processTicket: jest.fn().mockRejectedValue(new AnchorAgentNotConfiguredError()) }
      const { url, close } = await startApp(service)
      try {
        const { status, body } = await req(url, VALID_BODY, API_KEY)
        expect(status).toBe(503)
        expect((body as Record<string, unknown>)['code']).toBe('ANCHOR_AGENT_NOT_CONFIGURED')
      } finally { close() }
    })

    it('When AgentNotFoundError, Then returns 404', async () => {
      const service = { processTicket: jest.fn().mockRejectedValue(new AgentNotFoundError('a1', 't1')) }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, VALID_BODY, API_KEY)
        expect(status).toBe(404)
      } finally { close() }
    })

    it('When AgentWithoutPolicyError, Then returns 422', async () => {
      const service = { processTicket: jest.fn().mockRejectedValue(new AgentWithoutPolicyError('a1')) }
      const { url, close } = await startApp(service)
      try {
        const { status } = await req(url, VALID_BODY, API_KEY)
        expect(status).toBe(422)
      } finally { close() }
    })
  })
})
