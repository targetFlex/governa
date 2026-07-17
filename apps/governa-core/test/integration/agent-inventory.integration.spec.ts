/**
 * agent-inventory.integration.spec.ts — Sessão 1.5
 *
 * Testes de integração do PrismaAgentInventoryRepository contra banco real.
 *
 * Estratégia de isolamento:
 *   - Cada suite cria um tenantId UUID único → sem interferência entre suites.
 *   - afterAll deleta todos os dados do tenant (FK-safe via deleteTestTenant).
 *   - Não usa transações rollback: o advisory lock do AuditService já usa
 *     transações serialized; misturar aqui causaria deadlock.
 *
 * Critérios E1 cobertos:
 *   [✓] Zero queries sem tenantId em todos os repositórios
 *   [✓] cross-tenant retorna null / [] (nunca vaza dados)
 *   [✓] Adapters Prisma cobertos por banco real (excluídos do coverage unitário)
 */

import type { PrismaClient } from '@prisma/client'

import { PrismaAgentInventoryRepository } from '../../src/modules/agents/infrastructure/prisma-agent-inventory.repository'
import { createTestPrisma, createTestTenant, deleteTestTenant } from './helpers/db-client'

// ─── Setup global da suite ────────────────────────────────────────────────────

let prisma:   PrismaClient
let tenantId: string
let otherTenantId: string
let repo:     PrismaAgentInventoryRepository

beforeAll(async () => {
  prisma         = createTestPrisma()
  tenantId       = await createTestTenant(prisma, 'agent-inv')
  otherTenantId  = await createTestTenant(prisma, 'agent-inv-other')
  repo           = new PrismaAgentInventoryRepository(prisma)
})

afterAll(async () => {
  await deleteTestTenant(prisma, tenantId)
  await deleteTestTenant(prisma, otherTenantId)
  await prisma.$disconnect()
})

// Helper — input de criação com defaults razoáveis
function agentInput(overrides: Partial<{
  tenantId: string
  name: string
  description: string
  ownerId: string
  policyId: string | null
  modelId: string
  tools: string[]
}> = {}) {
  return {
    tenantId:    overrides.tenantId    ?? tenantId,
    name:        overrides.name        ?? 'Agent de Teste',
    description: overrides.description ?? 'Descrição padrão',
    ownerId:     overrides.ownerId     ?? 'owner-001',
    policyId:    overrides.policyId    ?? null,
    modelId:     overrides.modelId     ?? 'claude-sonnet-4-6',
    tools:       overrides.tools       ?? ['read_protheus_pedido'],
  }
}

// ─── Criação ─────────────────────────────────────────────────────────────────

describe('Given um tenant existente', () => {
  describe('When create() é chamado com input válido', () => {
    it('Then persiste o agente com status SANDBOX', async () => {
      const agent = await repo.create(agentInput())

      expect(agent.id).toBeDefined()
      expect(agent.tenantId).toBe(tenantId)
      expect(agent.name).toBe('Agent de Teste')
      expect(agent.status).toBe('SANDBOX')
      expect(agent.lastActiveAt).toBeNull()
      expect(agent.createdAt).toBeInstanceOf(Date)
      expect(agent.updatedAt).toBeInstanceOf(Date)
    })

    it('Then persiste tools como array preservado', async () => {
      const tools = ['read_protheus_pedido', 'write_protheus_pedido_status']
      const agent = await repo.create(agentInput({ name: 'Agent Multi-Tool', tools }))

      expect(agent.tools).toEqual(tools)
    })

    it('Then policyId null é armazenado corretamente', async () => {
      const agent = await repo.create(agentInput({ name: 'Agent sem Policy', policyId: null }))

      expect(agent.policyId).toBeNull()
    })
  })
})

// ─── Leitura ─────────────────────────────────────────────────────────────────

describe('Given agentes criados para o tenant', () => {
  let agentIdA: string
  let agentIdB: string

  beforeAll(async () => {
    const a = await repo.create(agentInput({ name: 'Alpha' }))
    const b = await repo.create(agentInput({ name: 'Beta' }))
    agentIdA = a.id
    agentIdB = b.id
  })

  describe('When findAllForTenant() é chamado', () => {
    it('Then retorna apenas agentes do tenant correto', async () => {
      const agents = await repo.findAllForTenant(tenantId)

      const ids = agents.map(a => a.id)
      expect(ids).toContain(agentIdA)
      expect(ids).toContain(agentIdB)
      agents.forEach(a => expect(a.tenantId).toBe(tenantId))
    })

    it('Then retorna array vazio para tenant sem agentes', async () => {
      const agents = await repo.findAllForTenant(otherTenantId)

      expect(agents).toEqual([])
    })
  })

  describe('When findByIdForTenant() é chamado com id e tenantId corretos', () => {
    it('Then retorna o agente correto', async () => {
      const agent = await repo.findByIdForTenant(agentIdA, tenantId)

      expect(agent).not.toBeNull()
      expect(agent!.id).toBe(agentIdA)
      expect(agent!.name).toBe('Alpha')
      expect(agent!.tenantId).toBe(tenantId)
    })
  })

  describe('When findByIdForTenant() é chamado com id inexistente', () => {
    it('Then retorna null', async () => {
      const agent = await repo.findByIdForTenant('00000000-0000-0000-0000-000000000000', tenantId)

      expect(agent).toBeNull()
    })
  })
})

// ─── Atualização ─────────────────────────────────────────────────────────────

describe('Given um agente existente', () => {
  let agentId: string

  beforeAll(async () => {
    const agent = await repo.create(agentInput({ name: 'Para Atualizar' }))
    agentId = agent.id
  })

  describe('When update() é chamado com campos parciais', () => {
    it('Then aplica apenas os campos informados', async () => {
      const updated = await repo.update(agentId, tenantId, {
        name:  'Nome Novo',
        tools: ['write_protheus_pedido_nota'],
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('Nome Novo')
      expect(updated!.tools).toEqual(['write_protheus_pedido_nota'])
      expect(updated!.modelId).toBe('claude-sonnet-4-6') // inalterado
    })
  })
})

// ─── Conectores MCP (Fase 3 — sessão 2.75) ────────────────────────────────────

describe('Given mcpServers com url/headers (conectores MCP funcionais)', () => {
  it('create() persiste e round-trip preserva url e headers', async () => {
    const created = await repo.create({
      ...agentInput({ name: 'Agente com Conector MCP' }),
      mcpServers: [{
        id: 'mcp-1', name: 'Servidor MCP', url: 'https://mcp.example.com/mcp',
        headers: { Authorization: 'Bearer token-abc' },
      }],
    })

    expect(created.mcpServers).toEqual([{
      id: 'mcp-1', name: 'Servidor MCP', url: 'https://mcp.example.com/mcp',
      headers: { Authorization: 'Bearer token-abc' },
    }])

    const fetched = await repo.findByIdForTenant(created.id, tenantId)
    expect(fetched!.mcpServers).toEqual(created.mcpServers)
  })

  it('update() altera mcpServers preservando os demais campos', async () => {
    const created = await repo.create(agentInput({
      name: 'Agente para Atualizar Conector',
    }))

    const updated = await repo.update(created.id, tenantId, {
      mcpServers: [{ id: 'mcp-2', name: 'Novo Conector', url: 'https://outro.example.com' }],
    })

    expect(updated!.mcpServers).toEqual([
      { id: 'mcp-2', name: 'Novo Conector', url: 'https://outro.example.com' },
    ])
    expect(updated!.name).toBe('Agente para Atualizar Conector') // inalterado
  })

  it('mcpServers ausente (agente legado) retorna array vazio, sem lançar', async () => {
    const created = await repo.create(agentInput({ name: 'Agente Legado Sem Conector' }))
    expect(created.mcpServers).toEqual([])

    const fetched = await repo.findByIdForTenant(created.id, tenantId)
    expect(fetched!.mcpServers).toEqual([])
  })
})

// ─── Transições de status ─────────────────────────────────────────────────────

describe('Given um agente em SANDBOX', () => {
  let agentId: string

  beforeEach(async () => {
    const agent = await repo.create(agentInput({ name: 'Agente Status' }))
    agentId = agent.id
  })

  describe('When updateStatus() → PAUSED', () => {
    it('Then status muda para PAUSED e lastActiveAt permanece null', async () => {
      const updated = await repo.updateStatus(agentId, tenantId, 'PAUSED')

      expect(updated!.status).toBe('PAUSED')
      expect(updated!.lastActiveAt).toBeNull()
    })
  })

  describe('When updateStatus() → ACTIVE', () => {
    it('Then status muda para ACTIVE e lastActiveAt é preenchido', async () => {
      const updated = await repo.updateStatus(agentId, tenantId, 'ACTIVE')

      expect(updated!.status).toBe('ACTIVE')
      expect(updated!.lastActiveAt).toBeInstanceOf(Date)
    })
  })

  describe('When updateStatus() → DEPRECATED', () => {
    it('Then status muda para DEPRECATED (status terminal)', async () => {
      const updated = await repo.updateStatus(agentId, tenantId, 'DEPRECATED')

      expect(updated!.status).toBe('DEPRECATED')
    })
  })
})

// ─── Isolamento cross-tenant ──────────────────────────────────────────────────

describe('Isolamento cross-tenant (critério #1 do E1)', () => {
  let ownAgentId: string

  beforeAll(async () => {
    const agent = await repo.create(agentInput({ name: 'Agente do Tenant A', tenantId }))
    ownAgentId = agent.id
  })

  it('findByIdForTenant com tenantId errado → null (não vaza existência)', async () => {
    const result = await repo.findByIdForTenant(ownAgentId, otherTenantId)

    expect(result).toBeNull()
  })

  it('findAllForTenant com tenantId errado → array vazio', async () => {
    const result = await repo.findAllForTenant(otherTenantId)

    expect(result).toEqual([])
  })

  it('update com tenantId errado → null (sem modificação cross-tenant)', async () => {
    const result = await repo.update(ownAgentId, otherTenantId, { name: 'Ataque' })

    expect(result).toBeNull()
    // Confirmar que o dado original não foi alterado
    const original = await repo.findByIdForTenant(ownAgentId, tenantId)
    expect(original!.name).toBe('Agente do Tenant A')
  })

  it('updateStatus com tenantId errado → null (sem escalonamento cross-tenant)', async () => {
    const result = await repo.updateStatus(ownAgentId, otherTenantId, 'ACTIVE')

    expect(result).toBeNull()
    // Status original inalterado
    const original = await repo.findByIdForTenant(ownAgentId, tenantId)
    expect(original!.status).toBe('SANDBOX')
  })
})
