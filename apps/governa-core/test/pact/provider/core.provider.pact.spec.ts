// ============================================================
// core.provider.pact.spec.ts
//
// Provider Verification: governa-core como provider do governa-ui
//
// Inicia um servidor Express real (porta aleatória) e verifica
// manualmente cada interação definida no seed pact, sem depender
// do Pact Verifier (que usa Rust FFI com bug no ambiente Linux arm64).
//
// Fluxo:
//  1. beforeAll → sobe Express com AgentService + InMemoryRepo
//  2. Para cada interação do seed pact:
//     a. stateHandler → seed/clear repositório
//     b. doRequest()  → HTTP request com JWT real
//     c. assertBody() → valida status e corpo com matchingRules
//  3. afterAll → derruba servidor
//
// Para verificar contra o broker (CI):
//   PACT_BROKER_URL=http://localhost:9292 pnpm pact:verify
//
// Referências:
//   pact seed:   test/pact/pacts/seed/governa-ui-governa-core.json
//   router:      src/modules/agents/presentation/agent.router.ts
//   service:     src/modules/agents/application/agent.service.ts
//   middleware:  src/shared/middleware/tenant.middleware.ts
// ============================================================

import path from 'path'
import http from 'http'
import fs from 'fs'
import express from 'express'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

import { createAgentRouter } from '../../../src/modules/agents/presentation/agent.router'
import { AgentService } from '../../../src/modules/agents/application/agent.service'
import { InMemoryAgentInventoryRepository } from '../../fixtures/in-memory-agent-inventory.repository'
import { createTenantMiddleware } from '../../../src/shared/middleware/tenant.middleware'
import type { AgentInventoryEntity } from '../../../src/modules/agents/domain/agent-inventory.entity'

// ── Constantes de teste ───────────────────────────────────────

const JWT_SECRET = 'pact-provider-core-test-secret-32c'
const TENANT_ID  = 'tenant-pact-001'
const OWNER_ID   = '00000000-0000-0000-0000-000000000001'
const SEED_PACT  = path.resolve(__dirname, '../pacts/seed/governa-ui-governa-core.json')

// ── Repositório compartilhado entre stateHandlers e rotas ─────
let inventoryRepo: InMemoryAgentInventoryRepository
let server: http.Server
let serverPort: number

// ── Helper: gera token válido para o TENANT_ID ────────────────

function buildTestToken(): string {
  return jwt.sign({ tenantId: TENANT_ID, userId: OWNER_ID }, JWT_SECRET)
}

// ── Helper: constrói AgentInventoryEntity para seed ───────────

function makeAgent(overrides: Partial<AgentInventoryEntity> = {}): AgentInventoryEntity {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id:           randomUUID(),
    tenantId:     TENANT_ID,
    name:         'Pact Agent Alpha',
    description:  'Agente de teste Pact',
    ownerId:      OWNER_ID,
    policyId:     null,
    status:       'SANDBOX',
    modelId:      'claude-haiku-4-5',
    tools:        [],
    systemPrompt: null,
    mcpServers:   [],
    skills:       [],
    templateId:   null,
    createdAt:    now,
    updatedAt:    now,
    lastActiveAt: null,
    ...overrides,
  }
}

// ── State handlers ────────────────────────────────────────────

const stateHandlers: Record<string, () => void> = {
  'tenant-pact-001 não tem agentes': () => {
    inventoryRepo.clear()
  },
  'agente agent-pact-001 existe': () => {
    inventoryRepo.clear()
    inventoryRepo.seed([
      makeAgent({ id: 'agent-pact-001', name: 'Pact Agent Alpha' }),
    ])
  },
  'agente agent-pact-999 não existe': () => {
    inventoryRepo.clear()
  },
  'tenant-pact-001 pode criar agentes': () => {
    inventoryRepo.clear()
  },
}

// ── doRequest: envia HTTP request para o servidor ────────────

interface PactRequest {
  method: string
  path: string
  headers?: Record<string, string>
  body?: unknown
}

interface HttpResponse {
  status: number
  body: unknown
}

function doRequest(req: PactRequest): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const bodyStr = req.body ? JSON.stringify(req.body) : undefined
    const headers: Record<string, string> = {
      Authorization: `Bearer ${buildTestToken()}`,
      ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(bodyStr)) } : {}),
    }

    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port:     serverPort,
      method:   req.method.toUpperCase(),
      path:     req.path,
      headers,
    }

    const httpReq = http.request(options, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        let body: unknown
        try { body = JSON.parse(raw) } catch { body = raw }
        resolve({ status: res.statusCode ?? 0, body })
      })
    })

    httpReq.on('error', reject)
    if (bodyStr) httpReq.write(bodyStr)
    httpReq.end()
  })
}

// ── assertBody: valida resposta com matchingRules Pact V2 ─────
//
// Suporte a { "match": "type" } — verifica que typeof actual === typeof expected.
// Campos sem matchingRule → exact equality.

function resolvePath(obj: unknown, jpath: string): unknown {
  // jpath = "$.body.data.id" → navegamos por ["data","id"]
  const parts = jpath.replace(/^\$\.body\./, '').split('.')
  let cur = obj
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

function assertBody(
  actual: unknown,
  expected: unknown,
  matchingRules?: Record<string, { match: string }>,
): void {
  if (!matchingRules || Object.keys(matchingRules).length === 0) {
    expect(actual).toEqual(expected)
    return
  }

  // Collect type-matched paths
  const typePaths = new Set<string>()
  for (const [jpath, rule] of Object.entries(matchingRules)) {
    if (rule.match === 'type') typePaths.add(jpath)
  }

  // For each type-matched path, check typeof only
  for (const jpath of typePaths) {
    const actualVal   = resolvePath(actual, jpath)
    const expectedVal = resolvePath(expected, jpath)
    expect(typeof actualVal).toBe(typeof expectedVal)
  }

  // Deep equality check, but skip fields that are type-only matched
  function deepEqual(act: unknown, exp: unknown, currentPath: string): void {
    if (exp === null || exp === undefined) {
      expect(act).toBe(exp)
      return
    }
    if (typeof exp === 'object' && !Array.isArray(exp)) {
      for (const key of Object.keys(exp as Record<string, unknown>)) {
        const childPath = currentPath ? `${currentPath}.${key}` : key
        const pactPath  = `$.body.${childPath}`
        if (!typePaths.has(pactPath)) {
          deepEqual(
            (act as Record<string, unknown>)?.[key],
            (exp as Record<string, unknown>)[key],
            childPath,
          )
        }
      }
    } else {
      expect(act).toEqual(exp)
    }
  }

  deepEqual(actual, expected, '')
}

// ── Setup: sobe Express antes de todos os testes ──────────────

beforeAll(() => {
  inventoryRepo = new InMemoryAgentInventoryRepository()
  const service = new AgentService(inventoryRepo)

  const app = express()
  app.use(express.json())
  app.use(
    '/agents',
    createTenantMiddleware({ secret: JWT_SECRET }),
    createAgentRouter(service),
  )

  server = http.createServer(app)
  return new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      serverPort = addr.port
      resolve()
    })
  })
})

afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    ),
)

// ── Provider Verification ─────────────────────────────────────

describe('Pact Provider Verification (manual): governa-core satisfaz contratos do governa-ui', () => {
  // Carrega pact file uma vez
  const pactFile = JSON.parse(fs.readFileSync(SEED_PACT, 'utf-8')) as {
    interactions: Array<{
      description: string
      providerState: string
      request: PactRequest & { headers?: Record<string, string> }
      response: {
        status: number
        body?: unknown
        matchingRules?: Record<string, { match: string }>
      }
    }>
  }

  for (const interaction of pactFile.interactions) {
    it(interaction.description, async () => {
      // 1. Aplicar state handler
      const handler = stateHandlers[interaction.providerState]
      if (!handler) throw new Error(`stateHandler não definido: "${interaction.providerState}"`)
      handler()

      // 2. Disparar request
      const result = await doRequest({
        method:  interaction.request.method,
        path:    interaction.request.path,
        headers: interaction.request.headers,
        body:    interaction.request.body,
      })

      // 3. Validar status
      expect(result.status).toBe(interaction.response.status)

      // 4. Validar body (com matchingRules se presentes)
      if (interaction.response.body !== undefined) {
        assertBody(result.body, interaction.response.body, interaction.response.matchingRules)
      }
    })
  }
})
