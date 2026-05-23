import type { AgentRepository } from '../../src/modules/policies/domain/agent-repository.port'
import type { AgentEntity } from '../../src/modules/policies/domain/agent.entity'

/**
 * InMemoryAgentRepository — adapter de teste.
 *
 * Permite simular cenários multi-tenant sem PrismaClient nem Postgres.
 * Replica fielmente o invariante da porta:
 *   - filtra por tenantId
 *   - oculta agentes DEPRECATED (retorna null como se não existissem)
 */
export class InMemoryAgentRepository implements AgentRepository {
  private readonly agents = new Map<string, AgentEntity>()

  add(agent: AgentEntity): void {
    this.agents.set(agent.id, agent)
  }

  clear(): void {
    this.agents.clear()
  }

  async findActiveForTenant(
    agentId: string,
    tenantId: string,
  ): Promise<AgentEntity | null> {
    const agent = this.agents.get(agentId)

    if (!agent)                       return null
    if (agent.tenantId !== tenantId)  return null
    if (agent.status === 'DEPRECATED') return null

    return agent
  }
}
