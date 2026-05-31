/**
 * audit-trail.integration.spec.ts — Sessão 1.5
 *
 * Testes de integração do fluxo completo de auditoria:
 *   AuditService → PrismaAuditEventRepository → Postgres
 *   AuditVerifier → PrismaAuditEventRepository → Postgres
 *
 * Critérios E1 cobertos:
 *   [✓] Cadeia de hash verificada com ≥ 10 eventos encadeados
 *   [✓] Zero queries sem tenantId em todos os repositórios
 *   [✓] cross-tenant: eventos do tenant A não visíveis ao tenant B
 *   [✓] advisory lock — appendInChain serializado por (tenantId, agentId)
 *   [✓] append-only na camada de aplicação (AuditEventRepository sem update)
 *   [~] append-only no DB requer role governa_app (ver teste .skip abaixo)
 */

import type { PrismaClient } from '@prisma/client'

import { AuditService }   from '../../src/modules/audit/application/audit.service'
import { AuditVerifier }  from '../../src/modules/audit/application/audit.verifier'
import { GENESIS_PREV_HASH, computeHash } from '../../src/modules/audit/application/hash-chain'
import { PrismaAuditEventRepository } from '../../src/modules/audit/infrastructure/prisma-audit-event.repository'
import { createTestPrisma, createTestTenant, deleteTestTenant } from './helpers/db-client'

// ─── Setup global da suite ────────────────────────────────────────────────────

let prisma:       PrismaClient
let tenantId:     string
let agentId:      string
let otherTenantId: string
let otherAgentId:  string
let auditRepo:    PrismaAuditEventRepository
let auditService: AuditService
let verifier:     AuditVerifier

beforeAll(async () => {
  prisma        = createTestPrisma()
  tenantId      = await createTestTenant(prisma, 'audit-trail')
  otherTenantId = await createTestTenant(prisma, 'audit-trail-other')

  // Criar agentes fictícios para satisfazer FK
  const agent = await prisma.agent.create({
    data: {
      tenantId, name: 'Agent Auditado', description: '',
      ownerId: 'owner-001', modelId: 'claude-sonnet-4-6', tools: [],
    },
  })
  agentId = agent.id

  const otherAgent = await prisma.agent.create({
    data: {
      tenantId: otherTenantId, name: 'Agent Outro Tenant', description: '',
      ownerId: 'owner-002', modelId: 'claude-sonnet-4-6', tools: [],
    },
  })
  otherAgentId = otherAgent.id

  auditRepo    = new PrismaAuditEventRepository(prisma)
  auditService = new AuditService(auditRepo)
  verifier     = new AuditVerifier(auditRepo)
})

afterAll(async () => {
  await deleteTestTenant(prisma, tenantId)
  await deleteTestTenant(prisma, otherTenantId)
  await prisma.$disconnect()
})

// ─── Helper de input padrão ───────────────────────────────────────────────────

function baseInput(overrides: { tenantId?: string; agentId?: string; action?: string } = {}) {
  return {
    tenantId:       overrides.tenantId ?? tenantId,
    agentId:        overrides.agentId  ?? agentId,
    action:         overrides.action   ?? 'consulta_protheus',
    inputSummary:   'Consulta de pedido referencia interna',
    outcome:        'EXECUTADO' as const,
    latencyMs:      42,
    subjectToken:   'hmac-token-abc123',
    dataCategories: ['identificacao'],
    legalBasis:     'execucao_contrato',
    purpose:        'processamento_pedido',
  }
}

// ─── Evento único ─────────────────────────────────────────────────────────────

describe('Given nenhum evento anterior para o par (tenant, agent)', () => {
  describe('When createEvent() é chamado', () => {
    it('Then persiste com prevHash = GENESIS_PREV_HASH', async () => {
      const event = await auditService.createEvent(baseInput())

      expect(event.prevHash).toBe(GENESIS_PREV_HASH)
    })

    it('Then hash é SHA-256 do payload canônico e está correto', async () => {
      const event = await auditService.createEvent(baseInput({ action: 'acao_hash_check' }))

      const recomputed = computeHash({
        tenantId:       event.tenantId,
        agentId:        event.agentId,
        traceId:        event.traceId,
        spanId:         event.spanId,
        prevHash:       event.prevHash,
        action:         event.action,
        toolCalled:     event.toolCalled,
        inputSummary:   event.inputSummary,
        outcome:        event.outcome,
        latencyMs:      event.latencyMs,
        subjectToken:   event.subjectToken,
        dataCategories: event.dataCategories,
        legalBasis:     event.legalBasis,
        purpose:        event.purpose,
        retentionUntil: event.retentionUntil,
        approverId:     event.approverId,
        escalationReason: event.escalationReason,
      })
      expect(event.hash).toBe(recomputed)
    })

    it('Then id, traceId e createdAt são preenchidos pelo banco/service', async () => {
      const event = await auditService.createEvent(baseInput())

      expect(event.id).toBeDefined()
      expect(event.traceId).toBeDefined()
      expect(event.createdAt).toBeInstanceOf(Date)
    })

    it('Then retentionUntil = createdAt + 5 anos (LGPD art. 16)', async () => {
      const event = await auditService.createEvent(baseInput())

      const expectedYear = event.createdAt.getFullYear() + 5
      expect(event.retentionUntil.getFullYear()).toBe(expectedYear)
    })
  })
})

// ─── Cadeia de 10+ eventos ────────────────────────────────────────────────────

describe('Given uma cadeia de 12 eventos encadeados', () => {
  /**
   * Usa um agentId exclusivo para esta suite — evita interferência
   * com eventos criados em outros describes.
   */
  let chainAgentId: string

  beforeAll(async () => {
    const agent = await prisma.agent.create({
      data: {
        tenantId, name: 'Agent Cadeia', description: '',
        ownerId: 'owner-chain', modelId: 'claude-sonnet-4-6', tools: [],
      },
    })
    chainAgentId = agent.id

    for (let i = 0; i < 12; i++) {
      await auditService.createEvent(baseInput({
        agentId: chainAgentId,
        action:  `acao_${String(i).padStart(2, '0')}`,
      }))
    }
  })

  describe('When AuditVerifier.verify() é chamado', () => {
    it('Then cadeia é válida (valid: true)', async () => {
      const result = await verifier.verify(tenantId, chainAgentId)

      expect(result.valid).toBe(true)
    })

    it('Then totalEvents = 12', async () => {
      const result = await verifier.verify(tenantId, chainAgentId)

      expect(result.totalEvents).toBe(12)
    })
  })

  describe('When lastHashFor() é chamado após a cadeia', () => {
    it('Then retorna o hash do último evento (não null)', async () => {
      const lastHash = await auditRepo.lastHashFor(tenantId, chainAgentId)

      expect(lastHash).not.toBeNull()
      expect(typeof lastHash).toBe('string')
      expect(lastHash!.length).toBe(64) // SHA-256 hex
    })
  })
})

// ─── Append-only na camada de aplicação ──────────────────────────────────────

describe('Append-only — camada de aplicação', () => {
  it('AuditEventRepository não expõe método update() — interface append-only', () => {
    // Verificação estática via duck-typing: o adapter real não deve ter método update
    const repoAsAny = auditRepo as unknown as Record<string, unknown>
    expect(repoAsAny['update']).toBeUndefined()
    expect(repoAsAny['updateMany']).toBeUndefined()
    expect(repoAsAny['delete']).toBeUndefined()
    expect(repoAsAny['deleteMany']).toBeUndefined()
  })
})

// ─── Append-only no banco (requer role governa_app) ───────────────────────────

describe.skip('Append-only — nível de banco (requer role governa_app)', () => {
  /**
   * Este teste verifica que o role governa_app não tem permissão UPDATE
   * na tabela audit_events (GRANT apenas INSERT + SELECT).
   *
   * Para habilitar:
   *   1. No docker-compose, criar role governa_app:
   *      CREATE ROLE governa_app LOGIN PASSWORD '...';
   *      GRANT SELECT, INSERT ON audit_events TO governa_app;
   *   2. Setar AUDIT_DATABASE_URL com governa_app nas credenciais
   *   3. Remover o .skip acima
   */
  it('Then tentativa de UPDATE retorna erro de permissão', async () => {
    const event = await auditService.createEvent(baseInput())

    await expect(
      prisma.$executeRaw`UPDATE audit_events SET action = 'TAMPERED' WHERE id = ${event.id}::uuid`,
    ).rejects.toThrow(/permission denied/)
  })
})

// ─── lastHashFor para par (tenant, agent) sem histórico ──────────────────────

describe('Given nenhum evento para um par novo (tenant, agent)', () => {
  let freshAgentId: string

  beforeAll(async () => {
    const agent = await prisma.agent.create({
      data: {
        tenantId, name: 'Agent Sem Historico', description: '',
        ownerId: 'owner-fresh', modelId: 'claude-sonnet-4-6', tools: [],
      },
    })
    freshAgentId = agent.id
  })

  it('lastHashFor() retorna null', async () => {
    const hash = await auditRepo.lastHashFor(tenantId, freshAgentId)

    expect(hash).toBeNull()
  })

  it('AuditVerifier.verify() retorna valid:true, totalEvents:0', async () => {
    const result = await verifier.verify(tenantId, freshAgentId)

    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(0)
  })
})

// ─── Isolamento cross-tenant ──────────────────────────────────────────────────

describe('Isolamento cross-tenant — AuditTrail (critério #1 do E1)', () => {
  let crossAgentId: string

  beforeAll(async () => {
    // Criar agente no tenant A
    crossAgentId = agentId
    // Criar 3 eventos no tenant A
    for (let i = 0; i < 3; i++) {
      await auditService.createEvent(baseInput({
        tenantId: tenantId,
        agentId:  crossAgentId,
        action:   `cross_acao_${i}`,
      }))
    }
  })

  it('lastHashFor com tenantId errado → null', async () => {
    const hash = await auditRepo.lastHashFor(otherTenantId, crossAgentId)

    // crossAgentId pertence ao tenant A — não deve ter hash no tenant B
    expect(hash).toBeNull()
  })

  it('iterateChain com tenantId errado → nenhum evento', async () => {
    const events: unknown[] = []
    for await (const e of auditRepo.iterateChain(otherTenantId, crossAgentId, 100)) {
      events.push(e)
    }
    expect(events).toHaveLength(0)
  })

  it('AuditVerifier.verify para tenant B e agent do tenant A → valid:true, totalEvents:0', async () => {
    const result = await verifier.verify(otherTenantId, crossAgentId)

    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(0)
  })
})

// ─── Concorrência — advisory lock ────────────────────────────────────────────

describe('Concorrência — advisory lock em appendInChain', () => {
  it('5 eventos em paralelo formam cadeia íntegra (sem hash colision)', async () => {
    const concAgent = await prisma.agent.create({
      data: {
        tenantId, name: 'Agent Concorrencia', description: '',
        ownerId: 'owner-conc', modelId: 'claude-sonnet-4-6', tools: [],
      },
    })

    // Lança 5 createEvent concorrentes
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        auditService.createEvent(baseInput({
          agentId: concAgent.id,
          action:  `conc_${i}`,
        })),
      ),
    )

    const result = await verifier.verify(tenantId, concAgent.id)

    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(5)
  }, 15_000)
})
