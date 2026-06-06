import type { AgentInventoryRepository } from '../domain/agent-inventory-repository.port'
import type {
  AgentInventoryEntity,
  CreateAgentInput,
  UpdateAgentInput,
} from '../domain/agent-inventory.entity'
import {
  AgentNotFoundError,
  AgentNoPolicyError,
  AgentDeprecatedError,
} from '../domain/agent.errors'

/**
 * AgentService — application layer (hexagonal).
 *
 * Orquestra regras de negócio do inventário de agentes.
 * Depende apenas de AgentInventoryRepository (porta) — jamais de Prisma diretamente.
 *
 * Regras de negócio:
 *  - listAgents / getAgent: isolamento multi-tenant absoluto
 *  - createAgent: status inicial sempre SANDBOX
 *  - updateAgent: status não é atualizável via update (usa pause/activate)
 *  - pauseAgent: SANDBOX | ACTIVE → PAUSED
 *  - activateAgent: SANDBOX | PAUSED → ACTIVE, requer policyId
 *  - agente DEPRECATED: estado terminal, não pode ser reativado
 *  - cross-tenant: sempre 404, nunca 403 (não vazar existência)
 */
export class AgentService {
  constructor(private readonly repo: AgentInventoryRepository) {}

  async listAgents(tenantId: string): Promise<AgentInventoryEntity[]> {
    return this.repo.findAllForTenant(tenantId)
  }

  async getAgent(id: string, tenantId: string): Promise<AgentInventoryEntity> {
    const agent = await this.repo.findByIdForTenant(id, tenantId)
    if (!agent) throw new AgentNotFoundError(id)
    return agent
  }

  async createAgent(
    tenantId: string,
    input: Omit<CreateAgentInput, 'tenantId'>,
  ): Promise<AgentInventoryEntity> {
    return this.repo.create({ ...input, tenantId })
  }

  async updateAgent(
    id: string,
    tenantId: string,
    input: UpdateAgentInput,
  ): Promise<AgentInventoryEntity> {
    const updated = await this.repo.update(id, tenantId, input)
    if (!updated) throw new AgentNotFoundError(id)
    return updated
  }

  async pauseAgent(id: string, tenantId: string): Promise<AgentInventoryEntity> {
    const agent = await this.repo.findByIdForTenant(id, tenantId)
    if (!agent) throw new AgentNotFoundError(id)

    if (agent.status === 'DEPRECATED') {
      throw new AgentDeprecatedError(id)
    }

    if (agent.status === 'PAUSED') {
      // Idempotente — já está pausado, retorna sem erro
      return agent
    }

    // Aqui chega apenas SANDBOX ou ACTIVE — todos os outros já foram tratados acima
    const updated = await this.repo.updateStatus(id, tenantId, 'PAUSED')
    if (!updated) throw new AgentNotFoundError(id)
    return updated
  }

  async activateAgent(id: string, tenantId: string): Promise<AgentInventoryEntity> {
    const agent = await this.repo.findByIdForTenant(id, tenantId)
    if (!agent) throw new AgentNotFoundError(id)

    // Critério #4: DEPRECATED é estado terminal
    if (agent.status === 'DEPRECATED') {
      throw new AgentDeprecatedError(id)
    }

    // Critério #3: requer política atribuída
    if (!agent.policyId) {
      throw new AgentNoPolicyError(id)
    }

    if (agent.status === 'ACTIVE') {
      // Idempotente — já está ativo
      return agent
    }

    // Aqui chega apenas SANDBOX ou PAUSED — todos os outros já foram tratados acima
    const updated = await this.repo.updateStatus(id, tenantId, 'ACTIVE')
    if (!updated) throw new AgentNotFoundError(id)
    return updated
  }
}
