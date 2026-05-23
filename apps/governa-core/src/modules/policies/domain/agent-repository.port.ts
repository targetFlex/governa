import type { AgentEntity } from './agent.entity'

/**
 * AgentRepository — PORTA (hexagonal).
 *
 * PolicyEngine depende deste contrato, NUNCA de PrismaClient direto.
 * Implementações:
 *   - PrismaAgentRepository (infrastructure/) — produção
 *   - InMemoryAgentRepository (test fixtures) — testes unitários
 *
 * Contrato: TODA implementação deve aplicar filtro por tenantId.
 * Vazamento cross-tenant é falha LGPD — coberta no edge case
 * 'agente de tenant A não deve ser acessível por tenant B'.
 */
export interface AgentRepository {
  /**
   * Carrega agente + política ativa para o tenant informado.
   *
   * Retorna `null` se:
   *   - agente não existe
   *   - agente pertence a outro tenant
   *   - agente está com status DEPRECATED
   *
   * Não retorna `null` por ausência de política — quem ergue erro
   * descritivo nesse caso é o PolicyEngine.
   */
  findActiveForTenant(agentId: string, tenantId: string): Promise<AgentEntity | null>
}
