import { randomUUID } from 'crypto'

import { AgentService } from './agent.service'
import { InMemoryAgentInventoryRepository } from '../../../../test/fixtures/in-memory-agent-inventory.repository'
import {
  AgentNotFoundError,
  AgentNoPolicyError,
  AgentDeprecatedError,
  AgentInvalidStatusTransitionError,
} from '../domain/agent.errors'
import type { AgentInventoryEntity } from '../domain/agent-inventory.entity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-a'
const TENANT_B = 'tenant-b'

function makeAgent(overrides: Partial<AgentInventoryEntity> = {}): AgentInventoryEntity {
  const now = new Date()
  return {
    id:           randomUUID(),
    tenantId:     TENANT_A,
    name:         'Agente Teste',
    description:  'Descrição de teste',
    ownerId:      randomUUID(),
    policyId:     null,
    status:       'SANDBOX',
    modelId:      'claude-sonnet-4-6',
    tools:        ['read_pedido'],
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let repo: InMemoryAgentInventoryRepository
let service: AgentService

beforeEach(() => {
  repo = new InMemoryAgentInventoryRepository()
  service = new AgentService(repo)
})

// ---------------------------------------------------------------------------
// listAgents
// ---------------------------------------------------------------------------

describe('listAgents', () => {
  it('retorna apenas agentes do tenant autenticado', async () => {
    repo.seed([
      makeAgent({ tenantId: TENANT_A }),
      makeAgent({ tenantId: TENANT_A }),
      makeAgent({ tenantId: TENANT_B }),
    ])

    const result = await service.listAgents(TENANT_A)
    expect(result).toHaveLength(2)
    expect(result.every(a => a.tenantId === TENANT_A)).toBe(true)
  })

  it('retorna array vazio se tenant não tem agentes', async () => {
    const result = await service.listAgents(TENANT_A)
    expect(result).toEqual([])
  })

  it('nunca retorna o agente sintético de acesso via painel', async () => {
    await service.getOrCreateSystemAgent(TENANT_A)
    repo.seed([...repo.all(), makeAgent({ tenantId: TENANT_A })])

    const result = await service.listAgents(TENANT_A)
    expect(result).toHaveLength(1)
    expect(result.every(a => a.templateId !== '__system_panel_access__')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getOrCreateSystemAgent
// ---------------------------------------------------------------------------

describe('getOrCreateSystemAgent', () => {
  it('cria o agente sintético na primeira chamada', async () => {
    const agent = await service.getOrCreateSystemAgent(TENANT_A)

    expect(agent.tenantId).toBe(TENANT_A)
    expect(agent.templateId).toBe('__system_panel_access__')
    expect(agent.ownerId).toBe('system')
  })

  it('reutiliza o mesmo agente em chamadas subsequentes (idempotente)', async () => {
    const first  = await service.getOrCreateSystemAgent(TENANT_A)
    const second = await service.getOrCreateSystemAgent(TENANT_A)

    expect(second.id).toBe(first.id)
    expect(repo.all().filter(a => a.tenantId === TENANT_A)).toHaveLength(1)
  })

  it('cria agentes sintéticos independentes por tenant', async () => {
    const agentA = await service.getOrCreateSystemAgent(TENANT_A)
    const agentB = await service.getOrCreateSystemAgent(TENANT_B)

    expect(agentA.id).not.toBe(agentB.id)
    expect(agentA.tenantId).toBe(TENANT_A)
    expect(agentB.tenantId).toBe(TENANT_B)
  })
})

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('getAgent', () => {
  it('retorna agente existente do tenant', async () => {
    const agent = makeAgent()
    repo.seed([agent])

    const result = await service.getAgent(agent.id, TENANT_A)
    expect(result.id).toBe(agent.id)
  })

  it('lança AgentNotFoundError se agente não existe', async () => {
    await expect(service.getAgent(randomUUID(), TENANT_A))
      .rejects.toThrow(AgentNotFoundError)
  })

  it('lança AgentNotFoundError para agente de outro tenant (cross-tenant → 404)', async () => {
    const agent = makeAgent({ tenantId: TENANT_B })
    repo.seed([agent])

    await expect(service.getAgent(agent.id, TENANT_A))
      .rejects.toThrow(AgentNotFoundError)
  })
})

// ---------------------------------------------------------------------------
// createAgent
// ---------------------------------------------------------------------------

describe('createAgent', () => {
  it('cria agente com status SANDBOX', async () => {
    const result = await service.createAgent(TENANT_A, {
      name:        'Novo Agente',
      description: 'Desc',
      ownerId:     randomUUID(),
      policyId:    null,
      modelId:     'claude-haiku-4-5',
      tools:       ['read_pedido'],
    })

    expect(result.status).toBe('SANDBOX')
    expect(result.tenantId).toBe(TENANT_A)
    expect(result.id).toBeDefined()
  })

  it('preserva todos os campos informados', async () => {
    const ownerId = randomUUID()
    const policyId = randomUUID()
    const result = await service.createAgent(TENANT_A, {
      name:        'Agente Completo',
      description: 'Desc completa',
      ownerId,
      policyId,
      modelId:     'claude-opus-4-6',
      tools:       ['read_pedido', 'read_estoque'],
    })

    expect(result.name).toBe('Agente Completo')
    expect(result.ownerId).toBe(ownerId)
    expect(result.policyId).toBe(policyId)
    expect(result.tools).toEqual(['read_pedido', 'read_estoque'])
  })
})

// ---------------------------------------------------------------------------
// updateAgent
// ---------------------------------------------------------------------------

describe('updateAgent', () => {
  it('atualiza campos permitidos', async () => {
    const agent = makeAgent()
    repo.seed([agent])

    const result = await service.updateAgent(agent.id, TENANT_A, {
      name: 'Nome Atualizado',
      tools: ['read_pedido', 'read_nota_fiscal'],
    })

    expect(result.name).toBe('Nome Atualizado')
    expect(result.tools).toEqual(['read_pedido', 'read_nota_fiscal'])
  })

  it('lança AgentNotFoundError para agente de outro tenant', async () => {
    const agent = makeAgent({ tenantId: TENANT_B })
    repo.seed([agent])

    await expect(service.updateAgent(agent.id, TENANT_A, { name: 'X' }))
      .rejects.toThrow(AgentNotFoundError)
  })

  it('não altera status via updateAgent', async () => {
    const agent = makeAgent({ status: 'SANDBOX' })
    repo.seed([agent])

    // UpdateAgentInput não tem campo status — TypeScript já bloqueia, mas
    // validamos que o serviço não altera status de forma silenciosa
    const result = await service.updateAgent(agent.id, TENANT_A, { name: 'Novo Nome' })
    expect(result.status).toBe('SANDBOX')
  })
})

// ---------------------------------------------------------------------------
// pauseAgent
// ---------------------------------------------------------------------------

describe('pauseAgent', () => {
  it('pausa agente ACTIVE', async () => {
    const agent = makeAgent({ status: 'ACTIVE' })
    repo.seed([agent])

    const result = await service.pauseAgent(agent.id, TENANT_A)
    expect(result.status).toBe('PAUSED')
  })

  it('pausa agente SANDBOX', async () => {
    const agent = makeAgent({ status: 'SANDBOX' })
    repo.seed([agent])

    const result = await service.pauseAgent(agent.id, TENANT_A)
    expect(result.status).toBe('PAUSED')
  })

  it('é idempotente — agente já PAUSED retorna sem erro', async () => {
    const agent = makeAgent({ status: 'PAUSED' })
    repo.seed([agent])

    const result = await service.pauseAgent(agent.id, TENANT_A)
    expect(result.status).toBe('PAUSED')
  })

  it('lança AgentDeprecatedError para agente DEPRECATED', async () => {
    const agent = makeAgent({ status: 'DEPRECATED' })
    repo.seed([agent])

    await expect(service.pauseAgent(agent.id, TENANT_A))
      .rejects.toThrow(AgentDeprecatedError)
  })

  it('lança AgentNotFoundError para agente de outro tenant', async () => {
    const agent = makeAgent({ tenantId: TENANT_B })
    repo.seed([agent])

    await expect(service.pauseAgent(agent.id, TENANT_A))
      .rejects.toThrow(AgentNotFoundError)
  })

  it('lança AgentNotFoundError para id inexistente', async () => {
    await expect(service.pauseAgent(randomUUID(), TENANT_A))
      .rejects.toThrow(AgentNotFoundError)
  })
})

// ---------------------------------------------------------------------------
// activateAgent
// ---------------------------------------------------------------------------

describe('activateAgent', () => {
  it('ativa agente SANDBOX com policy atribuída', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: randomUUID() })
    repo.seed([agent])

    const result = await service.activateAgent(agent.id, TENANT_A)
    expect(result.status).toBe('ACTIVE')
  })

  it('ativa agente PAUSED com policy atribuída', async () => {
    const agent = makeAgent({ status: 'PAUSED', policyId: randomUUID() })
    repo.seed([agent])

    const result = await service.activateAgent(agent.id, TENANT_A)
    expect(result.status).toBe('ACTIVE')
  })

  it('é idempotente — agente já ACTIVE retorna sem erro', async () => {
    const agent = makeAgent({ status: 'ACTIVE', policyId: randomUUID() })
    repo.seed([agent])

    const result = await service.activateAgent(agent.id, TENANT_A)
    expect(result.status).toBe('ACTIVE')
  })

  it('lança AgentNoPolicyError se policyId é null', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: null })
    repo.seed([agent])

    await expect(service.activateAgent(agent.id, TENANT_A))
      .rejects.toThrow(AgentNoPolicyError)
  })

  it('lança AgentDeprecatedError para agente DEPRECATED (estado terminal)', async () => {
    const agent = makeAgent({ status: 'DEPRECATED', policyId: randomUUID() })
    repo.seed([agent])

    await expect(service.activateAgent(agent.id, TENANT_A))
      .rejects.toThrow(AgentDeprecatedError)
  })

  it('lança AgentNotFoundError para agente de outro tenant', async () => {
    const agent = makeAgent({ tenantId: TENANT_B, policyId: randomUUID() })
    repo.seed([agent])

    await expect(service.activateAgent(agent.id, TENANT_A))
      .rejects.toThrow(AgentNotFoundError)
  })

  it('lança AgentNotFoundError para id inexistente', async () => {
    await expect(service.activateAgent(randomUUID(), TENANT_A))
      .rejects.toThrow(AgentNotFoundError)
  })

  it('lastActiveAt é atualizado ao ativar', async () => {
    const agent = makeAgent({ status: 'SANDBOX', policyId: randomUUID(), lastActiveAt: null })
    repo.seed([agent])

    const result = await service.activateAgent(agent.id, TENANT_A)
    expect(result.lastActiveAt).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Códigos de erro estáveis
// ---------------------------------------------------------------------------

describe('códigos de erro', () => {
  it('AgentNotFoundError tem code AGENT_NOT_FOUND', () => {
    const err = new AgentNotFoundError('x')
    expect(err.code).toBe('AGENT_NOT_FOUND')
    expect(err.name).toBe('AgentNotFoundError')
  })

  it('AgentNoPolicyError tem code AGENT_NO_POLICY', () => {
    const err = new AgentNoPolicyError('x')
    expect(err.code).toBe('AGENT_NO_POLICY')
  })

  it('AgentDeprecatedError tem code AGENT_DEPRECATED', () => {
    const err = new AgentDeprecatedError('x')
    expect(err.code).toBe('AGENT_DEPRECATED')
  })

  it('AgentInvalidStatusTransitionError tem code AGENT_INVALID_STATUS_TRANSITION', () => {
    const err = new AgentInvalidStatusTransitionError('x', 'SANDBOX', 'ACTIVE')
    expect(err.code).toBe('AGENT_INVALID_STATUS_TRANSITION')
    expect(err.message).toContain('SANDBOX → ACTIVE')
  })
})
