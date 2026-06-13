/**
 * audit.query.service.ts — Caso de uso de leitura do audit trail.
 *
 * Responsabilidades (SRP):
 *   - Validar filtros recebidos do router
 *   - Delegar listagem paginada ao repositório
 *   - Delegar listagem completa (exportação) ao repositório
 *
 * Hexagonal: depende SÓ da porta AuditEventRepository.
 * Sem Prisma, sem Express, sem PDF — concerns separados.
 *
 * Isolamento multi-tenant: tenantId NUNCA vem do body / query —
 * sempre extraído do JWT pelo tenantMiddleware (responsabilidade do router).
 */

import type {
  AuditEventFilter,
  AuditEventPage,
  AuditEventRepository,
} from '../domain/audit-event-repository.port'
import type { AuditEventEntity } from '../domain/audit-event.entity'

export class AuditQueryService {
  constructor(private readonly repo: AuditEventRepository) {}

  /**
   * Lista eventos paginados para a tela de auditoria.
   *
   * @param tenantId  Extraído do JWT — isolamento multi-tenant.
   * @param filter    Filtros opcionais (agentId, from, to, outcome, page, limit).
   */
  async listEvents(tenantId: string, filter: AuditEventFilter): Promise<AuditEventPage> {
    if (!tenantId) throw new Error('tenantId é obrigatório')
    return this.repo.list(tenantId, filter)
  }

  /**
   * Retorna todos os eventos (máx 10 000) para exportação PDF.
   *
   * @param tenantId  Extraído do JWT — isolamento multi-tenant.
   * @param filter    Filtros opcionais sem paginação.
   */
  async exportEvents(
    tenantId: string,
    filter:   Omit<AuditEventFilter, 'page' | 'limit'>,
  ): Promise<AuditEventEntity[]> {
    if (!tenantId) throw new Error('tenantId é obrigatório')
    return this.repo.listForExport(tenantId, filter)
  }
}
