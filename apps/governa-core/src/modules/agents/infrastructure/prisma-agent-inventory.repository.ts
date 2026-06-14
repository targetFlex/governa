import type { PrismaClient } from '@prisma/client'

import type { AgentInventoryRepository } from '../domain/agent-inventory-repository.port'
import type {
  AgentInventoryEntity,
  CreateAgentInput,
  UpdateAgentInput,
} from '../domain/agent-inventory.entity'
import type { AgentStatus } from '../../policies/domain/agent.entity'

/**
 * PrismaAgentInventoryRepository — ADAPTER (hexagonal).
 *
 * Implementa AgentInventoryRepository delegando ao PrismaClient.
 * Único ponto autorizado a importar @prisma/client no módulo agents.
 *
 * Invariante crítica (LGPD + critério #1 do E1, sessão 1.4):
 *   TODA query inclui filtro `tenantId` — sem exceção.
 *   Remoção do filtro é falha de segurança, não apenas bug.
 */
export class PrismaAgentInventoryRepository implements AgentInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAllForTenant(tenantId: string): Promise<AgentInventoryEntity[]> {
    const agents = await this.prisma.agent.findMany({
      where:   { tenantId },
      orderBy: { createdAt: 'desc' },
    })
    return agents.map(this.toEntity)
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<AgentInventoryEntity | null> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, tenantId },
    })
    return agent ? this.toEntity(agent) : null
  }

  async create(input: CreateAgentInput): Promise<AgentInventoryEntity> {
    const agent = await this.prisma.agent.create({
      data: {
        tenantId:    input.tenantId,
        name:        input.name,
        description: input.description,
        ownerId:     input.ownerId,
        policyId:    input.policyId ?? null,
        modelId:     input.modelId,
        tools:       [...input.tools],
        status:      'SANDBOX',
      },
    })
    return this.toEntity(agent)
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateAgentInput,
  ): Promise<AgentInventoryEntity | null> {
    // Verificar existência antes de tentar atualizar (tenantId obrigatório)
    const exists = await this.prisma.agent.findFirst({ where: { id, tenantId } })
    if (!exists) return null

    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        ...(input.name        !== undefined && { name:        input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.policyId    !== undefined && { policyId:    input.policyId }),
        ...(input.modelId     !== undefined && { modelId:     input.modelId }),
        ...(input.tools       !== undefined && { tools:       [...input.tools] }),
      },
    })
    return this.toEntity(agent)
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: AgentStatus,
  ): Promise<AgentInventoryEntity | null> {
    const exists = await this.prisma.agent.findFirst({ where: { id, tenantId } })
    if (!exists) return null

    const agent = await this.prisma.agent.update({
      where: { id },
      data: {
        status,
        ...(status === 'ACTIVE' && { lastActiveAt: new Date() }),
      },
    })
    return this.toEntity(agent)
  }

  private toEntity(
    agent: {
      id: string
      tenantId: string
      name: string
      description: string
      ownerId: string
      policyId: string | null
      status: string
      modelId: string
      tools: string[]
      createdAt: Date
      updatedAt: Date
      lastActiveAt: Date | null
    },
  ): AgentInventoryEntity {
    return {
      id:           agent.id,
      tenantId:     agent.tenantId,
      name:         agent.name,
      description:  agent.description,
      ownerId:      agent.ownerId,
      policyId:     agent.policyId,
      status:       agent.status as AgentStatus,
      modelId:      agent.modelId,
      tools:        agent.tools,
      createdAt:    agent.createdAt,
      updatedAt:    agent.updatedAt,
      lastActiveAt: agent.lastActiveAt,
    }
  }
}
