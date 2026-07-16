import { randomUUID } from 'crypto'

import { AgentService } from '../../src/modules/agents/application/agent.service'
import { InMemoryAgentInventoryRepository } from '../fixtures/in-memory-agent-inventory.repository'
import {
  AgentNotFoundError,
  AgentNoPolicyError,
  AgentDeprecatedError,
} from '../../src/modules/agents/domain/agent.errors'
import type { AgentInventoryEntity } from '../../src/modules/agents/domain/agent-inventory.entity'

// ---------------------------------------------------------------------------
// Edge cases — agent inventory
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-edge-a'
const TENANT_B = 'tenant-edge-b'

function makeAgent(overrides: Partial<AgentInventoryEntity> = {}): AgentInventoryEntity {
  const now = new Date()
  return {
    id:           randomUUID(),
    tenantId:     TENANT_A,
    name:         'Edge Agent',
    description:  '',
    ownerId:      randomUUID(),
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

let repo: InMemoryAgentInventoryRepository
let service: AgentService

beforeEach(() => {
  repo = new InMemoryAgentInventoryRepository()
  service = new AgentService(repo)
})

// ---------------------------------------------------------------------------
// Cross-tenant isolation — CRÍTICO LGPD
// ---------------------------------------------------------------------------

describe('isolamento cross-tenant', () => {
  it('GET /agents — tenant B não vê agentes de tenant A', async () => {
    repo.seed([makeAgent({ tenantId: TENANT_A }), makeAgent({ tenantId: TENANT_A })])
    const result = await service.listAgents(TENANT_B)
    expect(result).toHaveLength(0)
  })

  it('GET /agents/:id — tenant B recebe 404 para agente de tenant A', async () => {
    const agent = makeAgent({ tenantId: TENANT_A })
    repo.seed([agent])
    await expect(service.getAgent(agent.id, TENANT_B)).rejects.toThrow(AgentNotFoundError)
  })

  it('PATCH /agents/:id — tenant B recebe 404 (não 403) para agente de tenant A', async () => {
    const agent = makeAgent({ tenantId: TENANT_A })
    repo.seed([agent])
    await expect(service.updateAgent(agent.id, TENANT_B, { name: 'Hack' }))
      .rejects.toThrow(AgentNotFoundError)
  })

  it('pause — tenant B recebe 404 para agente de tenant A', async () => {
    const agent = makeAgent({ tenantId: TENANT_A, status: 'ACTIVE' })
    repo.seed([agent])
    await expect(service.pauseAgent(agent.id, TENANT_B)).rejects.toThrow(AgentNotFoundError)
  })

  it('activate — tenant B recebe 404 para agente de tenant A', async () => {
    const agent = makeAgent({ tenantId: TENANT_A, policyId: randomUUID() })
    repo.seed([agent])
    await expect(service.activateAgent(agent.id, TENANT_B)).rejects.toThrow(AgentNotFoundError)
  })
})

// ---------------------------------------------------------------------------
// Estado DEPRECATED — terminal
// ---------------------------------------------------------------------------

describe('agente DEPRECATED é estado terminal', () => {
  it('DEPRECATED não pode ser ativado mesmo com policy', async () => {
    const agent = makeAgent({ status: 'DEPRECATED', policyId: randomUUID() })
    repo.seed([agent])
    await expect(service.activateAgent(agent.id, TENANT_A)).rejects.toThrow(AgentDeprecatedError)
  })

  it('DEPRECATED não pode ser pausado', async () => {
    const agent = makeAgent({ status: 'DEPRECATED' })
    repo.seed([agent])
    await expect(service.pauseAgent(agent.id, TENANT_A)).rejects.toThrow(AgentDeprecatedError)
  })

  it('DEPRECATED ainda retorna no GET /agents (visibilidade de histórico)', async () => {
    repo.seed([makeAgent({ status: 'DEPRECATED' })])
    const agents = await service.listAgents(TENANT_A)
    expect(agents.some(a => a.status === 'DEPRECATED')).toBe(true)
  })

  it('DEPRECATED ainda retorna no GET /agents/:id', async () => {
    const agent = makeAgent({ status: 'DEPRECATED' })
    repo.seed([agent])
    const result = await service.getAgent(agent.id, TENANT_A)
    expect(result.status).toBe('DEPRECATED')
  })
})

// ---------------------------------------------------------------------------
// Activate sem policy
// ---------------------------------------------------------------------------

describe('activate requer policy', () => {
  it('SANDBOX sem policy → AgentNoPolicyError', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: null })
    repo.seed([agent])
    await expect(service.activateAgent(agent.id, TENANT_A)).rejects.toThrow(AgentNoPolicyError)
  })

  it('PAUSED sem policy → AgentNoPolicyError', async () => {
    const agent = makeAgent({ status: 'PAUSED', policyId: null })
    repo.seed([agent])
    await expect(service.activateAgent(agent.id, TENANT_A)).rejects.toThrow(AgentNoPolicyError)
  })

  it('assign policy e ativar na sequência funciona', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: null })
    repo.seed([agent])

    // Primeiro assign policy via updateAgent
    const policyId = randomUUID()
    await service.updateAgent(agent.id, TENANT_A, { policyId })

    // Depois ativa
    const activated = await service.activateAgent(agent.id, TENANT_A)
    expect(activated.status).toBe('ACTIVE')
    expect(activated.policyId).toBe(policyId)
  })
})

// ---------------------------------------------------------------------------
// Múltiplos agentes no mesmo tenant — isolamento interno
// ---------------------------------------------------------------------------

describe('múltiplos agentes no mesmo tenant', () => {
  it('operações em um agente não afetam outro do mesmo tenant', async () => {
    const agentA = makeAgent({ name: 'Agente A', status: 'SANDBOX' })
    const agentB = makeAgent({ name: 'Agente B', status: 'ACTIVE' })
    repo.seed([agentA, agentB])

    await service.pauseAgent(agentB.id, TENANT_A)

    const resultA = await service.getAgent(agentA.id, TENANT_A)
    expect(resultA.status).toBe('SANDBOX') // não foi afetado
  })

  it('listAgents retorna todos os status (SANDBOX, ACTIVE, PAUSED, DEPRECATED)', async () => {
    repo.seed([
      makeAgent({ status: 'SANDBOX' }),
      makeAgent({ status: 'ACTIVE' }),
      makeAgent({ status: 'PAUSED' }),
      makeAgent({ status: 'DEPRECATED' }),
    ])
    const agents = await service.listAgents(TENANT_A)
    const statuses = agents.map(a => a.status)
    expect(statuses).toContain('SANDBOX')
    expect(statuses).toContain('ACTIVE')
    expect(statuses).toContain('PAUSED')
    expect(statuses).toContain('DEPRECATED')
  })
})
