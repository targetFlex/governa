import type { AgentRepository } from '../domain/agent-repository.port'
import type { ToolScope } from '../domain/tool-scope.types'
import {
  AgentNotFoundError,
  AgentWithoutPolicyError,
} from './policy.errors'
import { ToolScopeBuilder } from './tool-scope.builder'

/**
 * PolicyEngine — caso de uso central de governança.
 *
 * Dado (agentId, tenantId), carrega o agente via porta AgentRepository
 * e devolve o ToolScope montado pelo ToolScopeBuilder. Não conhece
 * Prisma, HTTP, JWT ou qualquer detalhe de infra (hexagonal).
 *
 * Garantias:
 *   - tenantId SEMPRE viaja para a porta (isolamento multi-tenant)
 *   - agente DEPRECATED → AgentNotFoundError (repository filtra)
 *   - agente sem policy → AgentWithoutPolicyError (erro descritivo)
 *   - retorno congelado (ToolScopeBuilder retorna objeto frozen)
 */
export class PolicyEngine {
  constructor(
    private readonly agents:       AgentRepository,
    private readonly scopeBuilder: ToolScopeBuilder,
  ) {}

  async buildScope(agentId: string, tenantId: string): Promise<ToolScope> {
    const agent = await this.agents.findActiveForTenant(agentId, tenantId)

    if (!agent) {
      throw new AgentNotFoundError(agentId, tenantId)
    }

    if (!agent.policy) {
      throw new AgentWithoutPolicyError(agent.id)
    }

    return this.scopeBuilder.build({
      agentId:        agent.id,
      tenantId:       agent.tenantId,
      autonomyLevel:  agent.policy.autonomyLevel,
      allowedActions: agent.policy.allowedActions,
      policyId:       agent.policy.id,
      policyVersion:  agent.policy.version,
    })
  }
}
