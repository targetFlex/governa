import type {
  AgentInventoryEntity,
  CreateAgentInput,
  UpdateAgentInput,
} from './agent-inventory.entity'
import type { AgentStatus } from '../../policies/domain/agent.entity'

/**
 * AgentInventoryRepository — PORTA (hexagonal).
 *
 * Contrato para CRUD completo de agentes.
 * Implementações:
 *   - PrismaAgentInventoryRepository (infrastructure/) — produção
 *   - InMemoryAgentInventoryRepository (test/fixtures/) — testes unitários
 *
 * Invariante crítica: TODO método aplica filtro por tenantId.
 * Nenhuma query pode retornar dados de outro tenant (LGPD).
 */
export interface AgentInventoryRepository {
  /**
   * Lista todos os agentes do tenant.
   * Nunca retorna agentes de outros tenants.
   */
  findAllForTenant(tenantId: string): Promise<AgentInventoryEntity[]>

  /**
   * Carrega agente pelo id, garantindo que pertence ao tenant.
   * Retorna null se não existir OU se pertencer a outro tenant
   * (não diferenciamos — evita vazamento de existência).
   */
  findByIdForTenant(id: string, tenantId: string): Promise<AgentInventoryEntity | null>

  /**
   * Cria novo agente com status SANDBOX.
   */
  create(input: CreateAgentInput): Promise<AgentInventoryEntity>

  /**
   * Atualiza campos do agente. Retorna null se não encontrado para o tenant.
   * status NÃO é atualizado aqui — use updateStatus.
   */
  update(id: string, tenantId: string, input: UpdateAgentInput): Promise<AgentInventoryEntity | null>

  /**
   * Atualiza status do agente. Retorna null se não encontrado para o tenant.
   */
  updateStatus(id: string, tenantId: string, status: AgentStatus): Promise<AgentInventoryEntity | null>
}
