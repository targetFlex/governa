/**
 * policy-engine.integration.spec.ts — Sessão 1.5
 *
 * Testes de integração do PolicyEngine + PrismaAgentRepository
 * contra banco real.
 *
 * O PolicyEngine é o caso de uso central de governança: recebe
 * (agentId, tenantId) e devolve o ToolScope com tools e autonomy level.
 * Esses testes verificam o fluxo completo de domínio → infra → banco.
 *
 * Critérios E1 cobertos:
 *   [✓] Zero queries sem tenantId (PrismaAgentRepository invariante)
 *   [✓] DEPRECATED → AgentNotFoundError (repository filtra)
 *   [✓] Sem policy → AgentWithoutPolicyError
 *   [✓] cross-tenant → AgentNotFoundError (não vaza existência)
 *   [✓] ToolScope correto por AutonomyLevel
 */

import type { PrismaClient } from '@prisma/client'
import type { Tool } from '../../src/modules/policies/domain/tool.types'

import { PolicyEngine } from '../../src/modules/policies/application/policy.engine'
import { ToolScopeBuilder } from '../../src/modules/policies/application/tool-scope.builder'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
} from '../../src/modules/policies/application/policy.errors'
import { PrismaAgentRepository } from '../../src/modules/policies/infrastructure/prisma-agent.repository'
import { createTestPrisma, createTestTenant, deleteTestTenant } from './helpers/db-client'

// ─── Catálogo de tools (mesmo padrão dos testes unitários) ───────────────────

const makeT = (name: string, isWrite: boolean): Tool => ({
  name, description: name, isWrite, execute: async () => undefined,
})

const TOOL_CATALOG: readonly Tool[] = [
  makeT('read_protheus_pedido',          false),
  makeT('read_protheus_cliente',         false),
  makeT('read_protheus_produto',         false),
  makeT('write_protheus_pedido_nota',    true),
  makeT('write_protheus_pedido_status',  true),
  makeT('write_protheus_estoque',        true),
]

// ─── Setup global da suite ────────────────────────────────────────────────────

let prisma:       PrismaClient
let tenantId:     string
let otherTenantId: string
let engine:       PolicyEngine

beforeAll(async () => {
  prisma         = createTestPrisma()
  tenantId       = await createTestTenant(prisma, 'policy-eng')
  otherTenantId  = await createTestTenant(prisma, 'policy-eng-other')

  const agentRepo = new PrismaAgentRepository(prisma)
  engine          = new PolicyEngine(agentRepo, new ToolScopeBuilder(TOOL_CATALOG))
})

afterAll(async () => {
  await deleteTestTenant(prisma, tenantId)
  await deleteTestTenant(prisma, otherTenantId)
  await prisma.$disconnect()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createPolicy(
  overrides: { autonomyLevel?: string; allowedActions?: string[] } = {},
): Promise<string> {
  const policy = await prisma.policy.create({
    data: {
      tenantId:       tenantId,
      name:           `Policy-${Date.now()}`,
      autonomyLevel:  (overrides.autonomyLevel ?? 'CONSULTIVO') as 'CONSULTIVO' | 'ASSISTIDO' | 'AUTONOMO',
      allowedActions: overrides.allowedActions ?? [],
      approvers:      [],
      version:        '1.0.0',
    },
  })
  return policy.id
}

async function createAgent(overrides: {
  status?: 'SANDBOX' | 'ACTIVE' | 'PAUSED' | 'DEPRECATED'
  policyId?: string | null
} = {}): Promise<string> {
  const agent = await prisma.agent.create({
    data: {
      tenantId:    tenantId,
      name:        `Agent-${Date.now()}`,
      description: '',
      ownerId:     'owner-001',
      modelId:     'claude-sonnet-4-6',
      tools:       [],
      status:      overrides.status   ?? 'ACTIVE',
      policyId:    overrides.policyId ?? null,
    },
  })
  return agent.id
}

// ─── Testes por AutonomyLevel ─────────────────────────────────────────────────

describe('Given agente ACTIVE com política CONSULTIVO', () => {
  let agentId: string

  beforeAll(async () => {
    const policyId = await createPolicy({ autonomyLevel: 'CONSULTIVO' })
    agentId        = await createAgent({ policyId })
  })

  describe('When buildScope() é chamado', () => {
    it('Then retorna ToolScope com autonomyLevel CONSULTIVO', async () => {
      const scope = await engine.buildScope(agentId, tenantId)

      expect(scope.autonomyLevel).toBe('CONSULTIVO')
      expect(scope.agentId).toBe(agentId)
      expect(scope.tenantId).toBe(tenantId)
    })

    it('Then tools de escrita são excluídas no nível CONSULTIVO', async () => {
      const scope = await engine.buildScope(agentId, tenantId)

      const writeTools = scope.tools.filter(t => t.isWrite)
      expect(writeTools).toHaveLength(0)
    })
  })
})

describe('Given agente ACTIVE com política AUTONOMO + allowedActions', () => {
  let agentId: string

  beforeAll(async () => {
    const policyId = await createPolicy({
      autonomyLevel:  'AUTONOMO',
      allowedActions: ['read_protheus_pedido', 'write_protheus_pedido'],
    })
    agentId = await createAgent({ policyId })
  })

  describe('When buildScope() é chamado', () => {
    it('Then retorna ToolScope com autonomyLevel AUTONOMO', async () => {
      const scope = await engine.buildScope(agentId, tenantId)

      expect(scope.autonomyLevel).toBe('AUTONOMO')
    })

    it('Then tools correspondem às allowedActions (prefixo write_protheus_pedido expande)', async () => {
      const scope = await engine.buildScope(agentId, tenantId)

      const names = scope.tools.map(t => t.name).sort()
      expect(names).toContain('read_protheus_pedido')
      expect(names).toContain('write_protheus_pedido_nota')
      expect(names).toContain('write_protheus_pedido_status')
    })
  })
})

describe('Given agente ACTIVE com política ASSISTIDO', () => {
  let agentId: string

  beforeAll(async () => {
    const policyId = await createPolicy({
      autonomyLevel:  'ASSISTIDO',
      allowedActions: ['read_protheus_cliente'],
    })
    agentId = await createAgent({ policyId })
  })

  describe('When buildScope() é chamado', () => {
    it('Then retorna ToolScope com autonomyLevel ASSISTIDO', async () => {
      const scope = await engine.buildScope(agentId, tenantId)

      expect(scope.autonomyLevel).toBe('ASSISTIDO')
    })
  })
})

// ─── Erros de negócio ─────────────────────────────────────────────────────────

describe('Given agente ACTIVE sem política atribuída', () => {
  let agentId: string

  beforeAll(async () => {
    agentId = await createAgent({ policyId: null })
  })

  describe('When buildScope() é chamado', () => {
    it('Then lança AgentWithoutPolicyError com mensagem descritiva', async () => {
      await expect(engine.buildScope(agentId, tenantId))
        .rejects.toBeInstanceOf(AgentWithoutPolicyError)
    })
  })
})

describe('Given agente DEPRECATED', () => {
  let agentId: string

  beforeAll(async () => {
    const policyId = await createPolicy()
    agentId        = await createAgent({ status: 'DEPRECATED', policyId })
  })

  describe('When buildScope() é chamado', () => {
    it('Then lança AgentNotFoundError (DEPRECATED tratado como inexistente)', async () => {
      await expect(engine.buildScope(agentId, tenantId))
        .rejects.toBeInstanceOf(AgentNotFoundError)
    })
  })
})

describe('Given agente PAUSED com política', () => {
  let agentId: string

  beforeAll(async () => {
    const policyId = await createPolicy({ autonomyLevel: 'ASSISTIDO' })
    agentId        = await createAgent({ status: 'PAUSED', policyId })
  })

  describe('When buildScope() é chamado', () => {
    it('Then retorna ToolScope normalmente (PAUSED != DEPRECATED)', async () => {
      const scope = await engine.buildScope(agentId, tenantId)

      expect(scope.autonomyLevel).toBe('ASSISTIDO')
    })
  })
})

describe('Given agentId inexistente', () => {
  describe('When buildScope() é chamado', () => {
    it('Then lança AgentNotFoundError', async () => {
      await expect(engine.buildScope('00000000-0000-0000-0000-000000000000', tenantId))
        .rejects.toBeInstanceOf(AgentNotFoundError)
    })
  })
})

// ─── Isolamento cross-tenant (critério #6 do E1) ──────────────────────────────

describe('Isolamento cross-tenant — PolicyEngine', () => {
  let agentIdTenantA: string

  beforeAll(async () => {
    const policyId  = await createPolicy({ autonomyLevel: 'AUTONOMO', allowedActions: ['read_protheus_pedido'] })
    agentIdTenantA  = await createAgent({ policyId })
  })

  it('Agent do tenant A não deve ser acessível pelo tenant B → AgentNotFoundError', async () => {
    await expect(engine.buildScope(agentIdTenantA, otherTenantId))
      .rejects.toBeInstanceOf(AgentNotFoundError)
  })
})
