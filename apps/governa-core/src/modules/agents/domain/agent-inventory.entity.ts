import type { AgentStatus } from '../../policies/domain/agent.entity'

/**
 * AgentInventoryEntity — visão completa do agente para o módulo de inventário.
 *
 * Diferente de AgentEntity (usada pelo PolicyEngine — view mínima),
 * esta entidade expõe todos os campos do modelo Prisma para suportar
 * CRUD completo via endpoints REST.
 *
 * Invariante: tenantId sempre presente — nunca retornar agente sem tenant.
 */
export interface AgentInventoryEntity {
  readonly id:           string
  readonly tenantId:     string
  readonly name:         string
  readonly description:  string
  readonly ownerId:      string
  readonly policyId:     string | null
  readonly status:       AgentStatus
  readonly modelId:      string
  readonly tools:        readonly string[]
  readonly createdAt:    Date
  readonly updatedAt:    Date
  readonly lastActiveAt: Date | null
}

/**
 * Input para criação de agente.
 * status não é informado pelo client — começa sempre em SANDBOX.
 */
export interface CreateAgentInput {
  readonly tenantId:    string
  readonly name:        string
  readonly description: string
  readonly ownerId:     string
  readonly policyId:    string | null
  readonly modelId:     string
  readonly tools:       readonly string[]
}

/**
 * Input para atualização parcial.
 * tenantId e status NÃO são atualizáveis via PATCH genérico —
 * status muda via /pause e /activate apenas.
 */
export interface UpdateAgentInput {
  readonly name?:        string
  readonly description?: string
  readonly policyId?:    string | null
  readonly modelId?:     string
  readonly tools?:       readonly string[]
}
