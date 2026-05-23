import type { PrismaClient } from '@prisma/client'

import type { AgentRepository } from '../domain/agent-repository.port'
import type { AgentEntity, AgentStatus } from '../domain/agent.entity'
import type { AutonomyLevel } from '../domain/autonomy-level'
import type { PolicyConfig } from '../domain/policy.types'

/**
 * PrismaAgentRepository — ADAPTER (hexagonal).
 *
 * Implementa AgentRepository delegando ao PrismaClient. Único lugar
 * autorizado a importar de @prisma/client dentro do módulo policies.
 *
 * Invariante crítico (critério #6 do E1, sessão 1.2):
 *   "Nenhuma query Prisma sem filtro tenantId"
 *   → o where { id, tenantId } é OBRIGATÓRIO; remoção quebra LGPD.
 *
 * Status DEPRECATED é tratado como ausência (`not: 'DEPRECATED'`)
 * para que o engine não diferencie "não existe" de "aposentado" —
 * ambos resultam em AgentNotFoundError.
 */
export class PrismaAgentRepository implements AgentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveForTenant(
    agentId: string,
    tenantId: string,
  ): Promise<AgentEntity | null> {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id:       agentId,
        tenantId,
        status:   { not: 'DEPRECATED' },
      },
      include: { policy: true },
    })

    if (!agent) return null

    return {
      id:       agent.id,
      tenantId: agent.tenantId,
      status:   agent.status as AgentStatus,
      policy:   agent.policy
        ? this.mapPolicy(agent.policy)
        : null,
    }
  }

  private mapPolicy(p: NonNullable<Awaited<ReturnType<PrismaClient['policy']['findFirst']>>>): PolicyConfig {
    return {
      id:             p.id,
      tenantId:       p.tenantId,
      name:           p.name,
      autonomyLevel:  p.autonomyLevel as AutonomyLevel,
      allowedActions: p.allowedActions,
      maxValueBrl:    p.maxValueBrl != null ? Number(p.maxValueBrl) : undefined,
      timeWindowH:    p.timeWindowH ?? undefined,
      approvers:      p.approvers,
      version:        p.version,
    }
  }
}
