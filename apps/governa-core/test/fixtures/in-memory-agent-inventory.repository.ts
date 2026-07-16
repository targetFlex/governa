import { randomUUID } from 'crypto'

import type { AgentInventoryRepository } from '../../src/modules/agents/domain/agent-inventory-repository.port'
import type {
  AgentInventoryEntity,
  CreateAgentInput,
  UpdateAgentInput,
} from '../../src/modules/agents/domain/agent-inventory.entity'
import type { AgentStatus } from '../../src/modules/policies/domain/agent.entity'

/**
 * InMemoryAgentInventoryRepository — adapter de teste.
 *
 * Implementa AgentInventoryRepository em memória para testes unitários.
 * Sem dependência de Prisma / banco de dados.
 *
 * Invariante mantida: todos os métodos filtram por tenantId —
 * mesmo comportamento da implementação Prisma (garantia de contrato).
 */
export class InMemoryAgentInventoryRepository implements AgentInventoryRepository {
  private store: AgentInventoryEntity[] = []

  /** Popula o repositório com dados iniciais (usado em testes) */
  seed(agents: AgentInventoryEntity[]): void {
    this.store = [...agents]
  }

  /** Limpa o repositório entre testes */
  clear(): void {
    this.store = []
  }

  /** Snapshot atual (para assertions) */
  all(): AgentInventoryEntity[] {
    return [...this.store]
  }

  async findAllForTenant(tenantId: string): Promise<AgentInventoryEntity[]> {
    return this.store.filter(a => a.tenantId === tenantId)
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<AgentInventoryEntity | null> {
    return this.store.find(a => a.id === id && a.tenantId === tenantId) ?? null
  }

  async create(input: CreateAgentInput): Promise<AgentInventoryEntity> {
    const now = new Date()
    const entity: AgentInventoryEntity = {
      id:           randomUUID(),
      tenantId:     input.tenantId,
      name:         input.name,
      description:  input.description,
      ownerId:      input.ownerId,
      policyId:     input.policyId,
      modelId:      input.modelId,
      tools:        [...input.tools],
      systemPrompt: input.systemPrompt ?? null,
      mcpServers:   input.mcpServers ? [...input.mcpServers] : [],
      skills:       input.skills ? [...input.skills] : [],
      templateId:   input.templateId ?? null,
      status:       'SANDBOX',
      createdAt:    now,
      updatedAt:    now,
      lastActiveAt: null,
    }
    this.store.push(entity)
    return entity
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateAgentInput,
  ): Promise<AgentInventoryEntity | null> {
    const idx = this.store.findIndex(a => a.id === id && a.tenantId === tenantId)
    if (idx === -1) return null

    const current = this.store[idx]
    const updated: AgentInventoryEntity = {
      ...current,
      ...(input.name        !== undefined && { name:        input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.policyId    !== undefined && { policyId:    input.policyId }),
      ...(input.modelId     !== undefined && { modelId:     input.modelId }),
      ...(input.tools       !== undefined && { tools:       [...input.tools] }),
      updatedAt: new Date(),
    }
    this.store[idx] = updated
    return updated
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: AgentStatus,
  ): Promise<AgentInventoryEntity | null> {
    const idx = this.store.findIndex(a => a.id === id && a.tenantId === tenantId)
    if (idx === -1) return null

    const updated: AgentInventoryEntity = {
      ...this.store[idx],
      status,
      updatedAt:    new Date(),
      lastActiveAt: status === 'ACTIVE' ? new Date() : this.store[idx].lastActiveAt,
    }
    this.store[idx] = updated
    return updated
  }
}
