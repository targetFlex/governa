import type { PolicyConfig } from './policy.types'

/**
 * Status do agente no ciclo de vida (replica enum Prisma `AgentStatus`).
 * DEPRECATED é estado terminal — não recebe ToolScope.
 */
export type AgentStatus = 'SANDBOX' | 'ACTIVE' | 'PAUSED' | 'DEPRECATED'

/**
 * AgentEntity — visão de domínio do agente, decoplada do schema Prisma.
 * Contém só o que PolicyEngine consome. Adapter Prisma faz o mapping.
 *
 * `policy` é opcional para refletir o schema (Agent.policyId é nullable),
 * mas PolicyEngine recusa qualquer agente sem policy (regra de negócio).
 */
export interface AgentEntity {
  readonly id:       string
  readonly tenantId: string
  readonly status:   AgentStatus
  readonly policy:   PolicyConfig | null
}
