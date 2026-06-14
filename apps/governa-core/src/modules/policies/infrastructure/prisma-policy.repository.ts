// ============================================================
// prisma-policy.repository.ts
//
// Adaptador Prisma para o repositório de políticas.
// Isolamento multi-tenant absoluto: toda query filtra por tenantId.
//
// SRP: apenas persistência — sem regras de negócio.
// ============================================================

import type { PrismaClient } from '@prisma/client'
import type { PolicyConfig }  from '../domain/policy.types'
import type { AutonomyLevel } from '../domain/autonomy-level'

export interface PolicyRepository {
  findByIdForTenant(id: string, tenantId: string): Promise<PolicyConfig | null>
  findAllForTenant(tenantId: string): Promise<PolicyConfig[]>
  update(id: string, tenantId: string, data: UpdatePolicyInput): Promise<PolicyConfig | null>
}

export interface UpdatePolicyInput {
  name?:           string
  autonomyLevel?:  AutonomyLevel
  allowedActions?: string[]
  maxValueBrl?:    number | null
  timeWindowH?:    number | null
  approvers?:      string[]
}

export class PrismaPolicyRepository implements PolicyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdForTenant(id: string, tenantId: string): Promise<PolicyConfig | null> {
    const policy = await this.prisma.policy.findFirst({
      where: { id, tenantId, active: true },
    })
    if (!policy) return null
    return this.toConfig(policy)
  }

  async findAllForTenant(tenantId: string): Promise<PolicyConfig[]> {
    const policies = await this.prisma.policy.findMany({
      where:   { tenantId, active: true },
      orderBy: { createdAt: 'desc' },
    })
    return policies.map((p) => this.toConfig(p))
  }

  async update(
    id:       string,
    tenantId: string,
    data:     UpdatePolicyInput,
  ): Promise<PolicyConfig | null> {
    const existing = await this.prisma.policy.findFirst({
      where: { id, tenantId, active: true },
    })
    if (!existing) return null

    // Bump minor version on each save (e.g. "1.0.0" → "1.1.0")
    const [major, minor, patch] = existing.version.split('.').map(Number)
    const nextVersion = `${major}.${minor + 1}.${patch ?? 0}`

    const updated = await this.prisma.policy.update({
      where: { id },
      data: {
        ...(data.name           !== undefined && { name: data.name }),
        ...(data.autonomyLevel  !== undefined && { autonomyLevel: data.autonomyLevel }),
        ...(data.allowedActions !== undefined && { allowedActions: data.allowedActions }),
        ...(data.maxValueBrl    !== undefined && {
          maxValueBrl: data.maxValueBrl !== null
            ? new (require('@prisma/client').Prisma.Decimal)(data.maxValueBrl)
            : null,
        }),
        ...(data.timeWindowH    !== undefined && { timeWindowH: data.timeWindowH }),
        ...(data.approvers      !== undefined && { approvers: data.approvers }),
        version: nextVersion,
      },
    })

    return this.toConfig(updated)
  }

  // ── Mapeamento Prisma → domínio ───────────────────────────

  private toConfig(p: {
    id:             string
    tenantId:       string
    name:           string
    autonomyLevel:  string
    allowedActions: string[]
    maxValueBrl:    { toNumber(): number } | null
    timeWindowH:    number | null
    approvers:      string[]
    version:        string
  }): PolicyConfig {
    return {
      id:             p.id,
      tenantId:       p.tenantId,
      name:           p.name,
      autonomyLevel:  p.autonomyLevel as AutonomyLevel,
      allowedActions: p.allowedActions,
      maxValueBrl:    p.maxValueBrl?.toNumber(),
      timeWindowH:    p.timeWindowH ?? undefined,
      approvers:      p.approvers,
      version:        p.version,
    }
  }
}
