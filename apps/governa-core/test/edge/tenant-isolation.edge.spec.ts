/**
 * tenant-isolation.edge.spec.ts — Sessão 1.5
 *
 * Edge cases críticos de isolamento multi-tenant.
 * Usa repositórios in-memory (sem banco real) — estes testes devem
 * passar em qualquer ambiente, incluindo CI sem Postgres.
 *
 * Foco: verificar que NENHUM módulo vaza dados entre tenants,
 * mesmo sob condições de borda.
 *
 * Módulos cobertos:
 *   - PolicyEngine (via InMemoryAgentRepository)
 *   - AuditService + AuditVerifier (via InMemoryAuditEventRepository)
 *   - InMemoryAuditEventRepository (contrato de filtragem por tenantId)
 *
 * Critério E1:
 *   "Todos os edge cases de cross-tenant retornam 404 / empty / null"
 */

import { PolicyEngine }    from '../../src/modules/policies/application/policy.engine'
import { ToolScopeBuilder } from '../../src/modules/policies/application/tool-scope.builder'
import { AgentNotFoundError } from '../../src/modules/policies/application/policy.errors'
import type { Tool }       from '../../src/modules/policies/domain/tool.types'
import type { AgentEntity } from '../../src/modules/policies/domain/agent.entity'

import { AuditService }  from '../../src/modules/audit/application/audit.service'
import { AuditVerifier } from '../../src/modules/audit/application/audit.verifier'
import { GENESIS_PREV_HASH } from '../../src/modules/audit/application/hash-chain'

import { InMemoryAgentRepository }      from '../fixtures/in-memory-agent.repository'
import { InMemoryAuditEventRepository } from '../fixtures/in-memory-audit-event.repository'

// ─── Constantes ───────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-alpha'
const TENANT_B = 'tenant-beta'
const AGENT_A  = 'agent-tenant-a-001'
const AGENT_B  = 'agent-tenant-b-001'

const makeT = (name: string, isWrite: boolean): Tool => ({
  name, description: name, isWrite, source: 'native', execute: async () => undefined,
})

const CATALOG: readonly Tool[] = [
  makeT('read_protheus_pedido',       false),
  makeT('write_protheus_pedido_nota', true),
]

function basePolicy(tenantId: string) {
  return {
    id: 'pol-1', tenantId, name: 'P',
    autonomyLevel: 'CONSULTIVO' as const,
    allowedActions: [],
    approvers: [],
    version: '1.0.0',
  }
}

function auditInput(tenantId: string, agentId: string, action = 'acao') {
  return {
    tenantId,
    agentId,
    action,
    inputSummary:   'Input sem dados sensiveis',
    outcome:        'EXECUTADO' as const,
    latencyMs:      10,
    subjectToken:   'token-hmac',
    dataCategories: ['identificacao'],
    legalBasis:     'execucao_contrato',
    purpose:        'teste',
  }
}

// ─── PolicyEngine — cross-tenant ─────────────────────────────────────────────

describe('PolicyEngine — isolamento cross-tenant', () => {
  let repoA: InMemoryAgentRepository
  let engine: PolicyEngine

  beforeEach(() => {
    repoA  = new InMemoryAgentRepository()
    engine = new PolicyEngine(repoA, new ToolScopeBuilder(CATALOG))
  })

  it('Edge: agente registrado no tenant A não deve ser visível ao tenant B', async () => {
    const agentInA: AgentEntity = {
      id: AGENT_A, tenantId: TENANT_A, status: 'ACTIVE',
      policy: basePolicy(TENANT_A),
    }
    repoA.add(agentInA)

    await expect(engine.buildScope(AGENT_A, TENANT_B))
      .rejects.toBeInstanceOf(AgentNotFoundError)
  })

  it('Edge: tentativa com agentId correto mas tenantId errado → AgentNotFoundError', async () => {
    repoA.add({ id: AGENT_A, tenantId: TENANT_A, status: 'ACTIVE', policy: basePolicy(TENANT_A) })

    await expect(engine.buildScope(AGENT_A, TENANT_B))
      .rejects.toBeInstanceOf(AgentNotFoundError)
  })

  it('Edge: dois tenants com mesmo agentId — cada um só vê o seu', async () => {
    // Mesmo agentId, tenants diferentes — situação teórica mas possível em bug de routing
    repoA.add({ id: 'shared-id', tenantId: TENANT_A, status: 'ACTIVE', policy: basePolicy(TENANT_A) })

    // Tenant B tentando acessar 'shared-id'
    await expect(engine.buildScope('shared-id', TENANT_B))
      .rejects.toBeInstanceOf(AgentNotFoundError)

    // Tenant A consegue normalmente
    const scope = await engine.buildScope('shared-id', TENANT_A)
    expect(scope.tenantId).toBe(TENANT_A)
  })
})

// ─── AuditService + AuditVerifier — cross-tenant ─────────────────────────────

describe('AuditService + AuditVerifier — isolamento cross-tenant', () => {
  let repoA:    InMemoryAuditEventRepository
  let serviceA: AuditService
  let verifier: AuditVerifier

  beforeEach(() => {
    repoA    = new InMemoryAuditEventRepository()
    serviceA = new AuditService(repoA)
    verifier = new AuditVerifier(repoA)
  })

  it('Edge: eventos criados para tenant A não aparecem ao verificar tenant B', async () => {
    await serviceA.createEvent(auditInput(TENANT_A, AGENT_A))
    await serviceA.createEvent(auditInput(TENANT_A, AGENT_A))

    const result = await verifier.verify(TENANT_B, AGENT_A)

    expect(result.totalEvents).toBe(0)
    expect(result.valid).toBe(true)
  })

  it('Edge: lastHashFor tenant B com agentId do tenant A → null', async () => {
    await serviceA.createEvent(auditInput(TENANT_A, AGENT_A))

    const hash = await repoA.lastHashFor(TENANT_B, AGENT_A)

    expect(hash).toBeNull()
  })

  it('Edge: iterateChain para tenant B e agentId do tenant A → nenhum evento', async () => {
    await serviceA.createEvent(auditInput(TENANT_A, AGENT_A))

    const events: unknown[] = []
    for await (const e of repoA.iterateChain(TENANT_B, AGENT_A, 100)) {
      events.push(e)
    }
    expect(events).toHaveLength(0)
  })

  it('Edge: cadeia do tenant A permanece íntegra mesmo depois de tentativa cross-tenant', async () => {
    for (let i = 0; i < 5; i++) {
      await serviceA.createEvent(auditInput(TENANT_A, AGENT_A, `acao_${i}`))
    }

    // "Ataque": tenant B tenta verificar a cadeia do tenant A
    const attackResult = await verifier.verify(TENANT_B, AGENT_A)
    expect(attackResult.totalEvents).toBe(0)

    // Cadeia legítima do tenant A continua válida
    const legitimateResult = await verifier.verify(TENANT_A, AGENT_A)
    expect(legitimateResult.valid).toBe(true)
    expect(legitimateResult.totalEvents).toBe(5)
  })
})

// ─── InMemoryAuditEventRepository — contrato de filtragem ────────────────────

describe('InMemoryAuditEventRepository — filtragem estrita por (tenantId, agentId)', () => {
  let repo:    InMemoryAuditEventRepository
  let service: AuditService

  beforeEach(() => {
    repo    = new InMemoryAuditEventRepository()
    service = new AuditService(repo)
  })

  it('Edge: dois agentes no mesmo tenant têm cadeias independentes', async () => {
    await service.createEvent(auditInput(TENANT_A, AGENT_A, 'acao_a'))
    await service.createEvent(auditInput(TENANT_A, AGENT_A, 'acao_a2'))
    await service.createEvent(auditInput(TENANT_A, AGENT_B, 'acao_b'))

    const resultA = await new AuditVerifier(repo).verify(TENANT_A, AGENT_A)
    const resultB = await new AuditVerifier(repo).verify(TENANT_A, AGENT_B)

    expect(resultA.totalEvents).toBe(2)
    expect(resultB.totalEvents).toBe(1)
    expect(resultA.valid).toBe(true)
    expect(resultB.valid).toBe(true)
  })

  it('Edge: primeiro evento da cadeia tem prevHash = GENESIS_PREV_HASH', async () => {
    const event = await service.createEvent(auditInput(TENANT_A, AGENT_A))

    expect(event.prevHash).toBe(GENESIS_PREV_HASH)
  })

  it('Edge: segundo evento da cadeia tem prevHash = hash do primeiro', async () => {
    const first  = await service.createEvent(auditInput(TENANT_A, AGENT_A, 'acao_1'))
    const second = await service.createEvent(auditInput(TENANT_A, AGENT_A, 'acao_2'))

    expect(second.prevHash).toBe(first.hash)
  })

  it('Edge: cadeia vazia → verify retorna valid:true e totalEvents:0', async () => {
    const result = await new AuditVerifier(repo).verify(TENANT_A, 'agent-nunca-usado')

    expect(result.valid).toBe(true)
    expect(result.totalEvents).toBe(0)
  })
})
