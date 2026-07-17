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
import { PANEL_SYSTEM_AGENT_TEMPLATE_ID } from '../domain/system-agent.constants'

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
 *  - getOrCreateSystemAgent: agente sintético de acesso via painel (ver
 *    system-agent.constants.ts) — nunca listado em listAgents
 */
export class AgentService {
  constructor(private readonly repo: AgentInventoryRepository) {}

  async listAgents(tenantId: string): Promise<AgentInventoryEntity[]> {
    const agents = await this.repo.findAllForTenant(tenantId)
    return agents.filter((a) => a.templateId !== PANEL_SYSTEM_AGENT_TEMPLATE_ID)
  }

  /**
   * Retorna (criando se necessário) o agente sintético de acesso via painel
   * do tenant — âncora de auditoria LGPD para listagens humanas de
   * clientes/pedidos que não partem de um agente de IA nem de um titular
   * específico. Idempotente por tenant.
   */
  async getOrCreateSystemAgent(tenantId: string): Promise<AgentInventoryEntity> {
    const agents = await this.repo.findAllForTenant(tenantId)
    const existing = agents.find((a) => a.templateId === PANEL_SYSTEM_AGENT_TEMPLATE_ID)
    if (existing) return existing

    return this.repo.create({
      tenantId,
      name: 'Painel — Acesso Direto (Sistema)',
      description:
        'Agente sintético interno usado para auditar listagens feitas via painel administrativo (acesso humano, sem IA). Não executa ferramentas nem é ativável.',
      ownerId: 'system',
      policyId: null,
      modelId: 'n/a',
      tools: [],
      templateId: PANEL_SYSTEM_AGENT_TEMPLATE_ID,
    })
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
